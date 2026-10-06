-- Tenant / role integrity hardening (security review 2026-10-02).
--
-- 1. `users_profile.shop_id` / `company_id` can no longer be changed by a normal
--    session. Before this, the `auth.uid() = id` policy let a user rewrite those
--    columns on their own row, and `can_access_shop()` trusted them.
-- 2. `can_access_shop()` now requires a real grant: an active `user_roles` row
--    for that shop, the shop creator, or super_admin. A bare profile pointer
--    grants nothing.
-- 3. `user_roles` becomes read-only for sessions. Every grant goes through the
--    service-role client in the API (register, /api/staff), which bypasses RLS.
-- 4. Helper functions run as SECURITY DEFINER with a pinned search_path so a
--    policy cannot recurse through RLS or resolve objects from another schema.
-- 5. `rate_limits` table + `hit_rate_limit()` for unauthenticated API routes.
--
-- Run BEFORE deploying the matching app version. Idempotent.
-- Rollback: re-apply supabase/rls.sql (restores the old, weaker policies).
--
-- Accounts that only ever had `users_profile.shop_id` (no user_roles row and not
-- the shop creator) lose access to that shop. Check before running:
--   select up.id, up.email, up.shop_id
--     from public.users_profile up
--    where up.shop_id is not null and up.is_deleted = false
--      and not exists (select 1 from public.user_roles ur
--                       where ur.user_id = up.id and ur.shop_id = up.shop_id and ur.is_deleted = false)
--      and not exists (select 1 from public.shops s where s.id = up.shop_id and s.created_by = up.id);
-- Grant real roles to any legitimate account in that list first.

-- ── 1. Helper functions ─────────────────────────────────────────────────────

create or replace function public.has_role(p_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.code = p_role
      and ur.is_deleted = false
      and r.is_deleted = false
  );
$$;

create or replace function public.can_access_shop(p_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_shop_id is not null
    and (
      public.has_role('super_admin')
      or exists(
        select 1 from public.user_roles ur
        where ur.user_id = auth.uid()
          and ur.shop_id = p_shop_id
          and ur.is_deleted = false
      )
      or exists(
        select 1 from public.shops s
        where s.id = p_shop_id
          and s.created_by = auth.uid()
          and s.is_deleted = false
      )
    );
$$;

-- is_branch_bound / can_access_branch (202609080003) read user_roles and staff;
-- pin them the same way so they cannot be redirected through search_path.
do $$
begin
  if to_regprocedure('public.is_branch_bound(uuid)') is not null then
    execute 'alter function public.is_branch_bound(uuid) security definer set search_path = public';
  end if;
  if to_regprocedure('public.can_access_branch(uuid)') is not null then
    execute 'alter function public.can_access_branch(uuid) security definer set search_path = public';
  end if;
end$$;

-- ── 2. users_profile: tenant columns are server-managed ─────────────────────

create or replace function public.guard_users_profile_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := coalesce(auth.role(), current_setting('request.jwt.claim.role', true), '');
begin
  -- Service role (API admin client), direct DB sessions (migrations, SQL
  -- editor) and super_admin may manage tenant columns.
  if v_role = 'service_role' or auth.uid() is null or public.has_role('super_admin') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.shop_id is not null or new.company_id is not null then
      raise exception 'tenant_columns_protected' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.id is distinct from old.id
     or new.shop_id is distinct from old.shop_id
     or new.company_id is distinct from old.company_id
     or new.is_deleted is distinct from old.is_deleted then
    raise exception 'tenant_columns_protected' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_users_profile_tenant on public.users_profile;
create trigger trg_guard_users_profile_tenant
  before insert or update on public.users_profile
  for each row execute function public.guard_users_profile_tenant();

-- ── 3. user_roles: read-only for sessions ───────────────────────────────────

alter table public.user_roles enable row level security;

drop policy if exists p_user_roles_rw on public.user_roles;
drop policy if exists p_user_roles_read on public.user_roles;
drop policy if exists p_user_roles_insert on public.user_roles;
drop policy if exists p_user_roles_update on public.user_roles;
drop policy if exists p_user_roles_delete on public.user_roles;

create policy p_user_roles_read on public.user_roles
for select using (
  user_id = auth.uid()
  or public.has_role('super_admin')
  or (shop_id is not null and public.can_access_shop(shop_id))
);
-- No insert/update/delete policy on purpose: only the service role writes grants.

-- roles / permissions are seed data: read-only for sessions.
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
drop policy if exists p_roles_read on public.roles;
create policy p_roles_read on public.roles for select using (auth.uid() is not null);
drop policy if exists p_permissions_read on public.permissions;
create policy p_permissions_read on public.permissions for select using (auth.uid() is not null);

-- ── 4. Rate limiting for public routes ──────────────────────────────────────

create table if not exists public.rate_limits (
  bucket_key   text        not null,
  window_start timestamptz not null,
  hits         integer     not null default 0,
  primary key (bucket_key, window_start)
);

create index if not exists idx_rate_limits_window on public.rate_limits (window_start);

alter table public.rate_limits enable row level security;
-- No policies: only the service role (API) touches this table.

/*
 * Count one hit for `p_key` in the current fixed window.
 * Returns true while the caller is still within `p_max` hits per window.
 * Old windows are pruned opportunistically.
 */
create or replace function public.hit_rate_limit(p_key text, p_window_seconds integer, p_max integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits integer;
begin
  insert into public.rate_limits as rl (bucket_key, window_start, hits)
  values (p_key, v_window, 1)
  on conflict (bucket_key, window_start) do update set hits = rl.hits + 1
  returning hits into v_hits;

  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;

  return v_hits <= p_max;
end;
$$;

revoke all on function public.hit_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, integer, integer) to service_role;
revoke all on table public.rate_limits from anon, authenticated;
