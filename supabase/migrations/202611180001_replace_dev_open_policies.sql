-- Replace the dev-only open policies with tenant-scoped ones (security review 2026-11-18).
--
-- What was wrong
--   Production carried `p_<table>_all_auth` on 22 tables. Those come from
--   supabase/rls2.sql, a dev/debug script: `for all to authenticated using (true)
--   with check (true)`. Any logged-in account (self-registration is open) could
--   read and write every tenant's rows straight through PostgREST with the public
--   anon key: LINE channel secrets, Omise keys, customer phones, bookings, and it
--   could insert its own `super_admin` row into `user_roles`.
--   `shop_subscriptions` / `subscription_plans` never had RLS in any script.
--
-- What this does
--   1. Drops every `p_*_all_auth` policy.
--   2. Shop-scoped tables: select / insert / update for members of that shop
--      (`can_access_shop`). No delete policy: the app soft-deletes, and the
--      service role bypasses RLS for the few hard deletes.
--   3. Log tables: select + insert only, so a session cannot rewrite history.
--   4. shops: members read and update their own row; only the service role
--      creates or deletes shops.
--   5. companies: read-only for members.
--   6. users_profile: read own row and colleagues of the same shop; write own row
--      only (tenant columns stay guarded by trg_guard_users_profile_tenant).
--   7. Subscription tables: RLS on, no policy = service role only. The app reads
--      and writes both with the admin client.
--   8. Cron trigger functions: no longer callable through PostgREST.
--
-- What this does NOT fix (needs app changes first)
--   - `shops.line_channel_secret` / `line_channel_access_token` are still readable
--     by any staff member of the shop: /api/line-settings reads them with the
--     session client, so a column revoke would break that page.
--   - `notifications` keeps `p_notifications_rw`, whose WITH CHECK still lets a
--     user insert a row into another shop's feed.
--   - Branch scoping: re-run 202609080003_branch_rls.sql after this migration. It
--     skips any table that has no permissive policy, so it may have skipped all of
--     them the first time.
--
-- BEFORE RUNNING
--   a) Run on staging and click through the portal as owner, branch_manager and
--      staff. The app has only ever run against `using (true)`.
--   b) Accounts whose access rests on `users_profile.shop_id` alone (no user_roles
--      row, not the shop creator) lose access. List them first and grant real roles:
--        select up.id, up.email, up.shop_id
--          from public.users_profile up
--         where up.shop_id is not null and up.is_deleted = false
--           and not exists (select 1 from public.user_roles ur
--                            where ur.user_id = up.id and ur.shop_id = up.shop_id and ur.is_deleted = false)
--           and not exists (select 1 from public.shops s where s.id = up.shop_id and s.created_by = up.id);
--
-- Idempotent. Runs in one transaction: either every table is switched or none is.
-- Rollback: do NOT re-apply rls2.sql. Fix the failing policy forward instead.

begin;

-- ── 0. Preconditions ────────────────────────────────────────────────────────
-- The policies below are only as strong as can_access_shop(). Refuse to run
-- against the old version, which trusted users_profile.shop_id and was not
-- SECURITY DEFINER (202610020002 replaces it).
do $$
declare
  v_definer boolean;
begin
  select p.prosecdef into v_definer
    from pg_proc p
   where p.oid = to_regprocedure('public.can_access_shop(uuid)');

  if v_definer is null then
    raise exception 'can_access_shop(uuid) is missing: apply 202610020002_tenant_integrity_hardening.sql first';
  end if;
  if not v_definer then
    raise exception 'can_access_shop(uuid) is the old non-definer version: apply 202610020002_tenant_integrity_hardening.sql first';
  end if;
  if to_regprocedure('public.has_role(text)') is null then
    raise exception 'has_role(text) is missing: apply 202610020002_tenant_integrity_hardening.sql first';
  end if;
end$$;

-- ── 1. Drop the dev-only open policies ──────────────────────────────────────
do $$
declare
  p record;
begin
  for p in
    select tablename, policyname
      from pg_policies
     where schemaname = 'public'
       and policyname like 'p\_%\_all\_auth'
  loop
    execute format('drop policy if exists %I on public.%I;', p.policyname, p.tablename);
  end loop;
end$$;

-- ── 2. Shop-scoped tables: members of the shop may read / insert / update ───
do $$
declare
  t text;
begin
  foreach t in array array[
    'branches', 'staff', 'staff_branches', 'customers', 'line_users',
    'service_categories', 'services', 'working_hours', 'holidays',
    'queue_slots', 'bookings', 'line_messages', 'settings'
  ]
  loop
    if to_regclass(format('public.%I', t)) is null then
      continue;
    end if;

    execute format('alter table public.%I enable row level security;', t);

    -- Names left behind by earlier hand-applied scripts.
    execute format('drop policy if exists %I on public.%I;', 'p_' || t || '_rw', t);
    execute format('drop policy if exists %I on public.%I;', 'p_' || t || '_select', t);
    execute format('drop policy if exists %I on public.%I;', 'p_' || t || '_insert', t);
    execute format('drop policy if exists %I on public.%I;', 'p_' || t || '_update', t);

    execute format(
      'create policy %I on public.%I for select to authenticated using (public.can_access_shop(shop_id));',
      'p_' || t || '_select', t
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.can_access_shop(shop_id));',
      'p_' || t || '_insert', t
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.can_access_shop(shop_id)) with check (public.can_access_shop(shop_id));',
      'p_' || t || '_update', t
    );
  end loop;
end$$;

-- ── 3. Log tables: append-only for sessions ─────────────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array['booking_logs', 'activity_logs']
  loop
    if to_regclass(format('public.%I', t)) is null then
      continue;
    end if;

    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I on public.%I;', 'p_' || t || '_rw', t);
    execute format('drop policy if exists %I on public.%I;', 'p_' || t || '_select', t);
    execute format('drop policy if exists %I on public.%I;', 'p_' || t || '_insert', t);

    execute format(
      'create policy %I on public.%I for select to authenticated using (public.can_access_shop(shop_id));',
      'p_' || t || '_select', t
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.can_access_shop(shop_id));',
      'p_' || t || '_insert', t
    );
  end loop;
end$$;

-- ── 4. shops: keyed on id, not shop_id ──────────────────────────────────────
alter table public.shops enable row level security;

drop policy if exists p_shops_rw on public.shops;
drop policy if exists p_shops_select on public.shops;
drop policy if exists p_shops_update on public.shops;

create policy p_shops_select on public.shops
  for select to authenticated
  using (public.can_access_shop(id));

create policy p_shops_update on public.shops
  for update to authenticated
  using (public.can_access_shop(id))
  with check (public.can_access_shop(id));
-- No insert / delete policy on purpose: registration creates shops with the service role.

-- ── 5. companies: read-only for members of one of its shops ─────────────────
alter table public.companies enable row level security;

drop policy if exists p_companies_rw on public.companies;
drop policy if exists p_companies_select on public.companies;

create policy p_companies_select on public.companies
  for select to authenticated
  using (
    public.has_role('super_admin')
    or exists (
      select 1
        from public.shops s
       where s.company_id = companies.id
         and public.can_access_shop(s.id)
    )
  );

-- ── 6. users_profile: read own row + colleagues, write own row only ─────────
alter table public.users_profile enable row level security;

drop policy if exists p_users_profile_rw on public.users_profile;
drop policy if exists p_users_profile_select on public.users_profile;
drop policy if exists p_users_profile_insert on public.users_profile;
drop policy if exists p_users_profile_update on public.users_profile;

create policy p_users_profile_select on public.users_profile
  for select to authenticated
  using (id = auth.uid() or public.can_access_shop(shop_id));

create policy p_users_profile_insert on public.users_profile
  for insert to authenticated
  with check (id = auth.uid());

create policy p_users_profile_update on public.users_profile
  for update to authenticated
  using (id = auth.uid() or public.has_role('super_admin'))
  with check (id = auth.uid() or public.has_role('super_admin'));
-- No delete policy: profiles are soft-deleted by the service role.

-- ── 7. Subscription tables: service role only ───────────────────────────────
alter table public.subscription_plans enable row level security;
alter table public.shop_subscriptions enable row level security;
revoke all on public.subscription_plans from anon, authenticated;
revoke all on public.shop_subscriptions from anon, authenticated;

-- ── 8. Cron trigger functions: not callable through PostgREST ───────────────
-- `revoke ... from public` alone leaves Supabase's default grants to anon and
-- authenticated in place.
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.trigger_booking_reminders()',
    'public.trigger_slip_recheck()',
    'public.trigger_customer_automations(text)',
    'public.trigger_payment_expiry()'
  ]
  loop
    if to_regprocedure(f) is not null then
      execute format('revoke execute on function %s from public, anon, authenticated;', f);
    end if;
  end loop;
end$$;

commit;

-- After running, this must return zero rows:
--   select tablename, policyname from pg_policies
--    where schemaname = 'public' and (qual = 'true' or with_check = 'true')
--      and policyname not like '%read_all';
