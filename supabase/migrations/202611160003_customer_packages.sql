-- Prepaid hour packages (2026-11-16).
--
-- A shop sells a package of hours (e.g. 10 ชม. 4,500 บาท, valid 90 days).
-- Staff sell it at the counter (cash / transfer → active at once) or the
-- customer buys it in LIFF (shop PromptPay QR → slip → staff approve). Each
-- LIFF / staff booking can then be paid with the package: the minutes of the
-- booked slots are deducted (× the rate of the time window the shop set, e.g.
-- after 15:00 = 1.5×), and given back when the queue is cancelled (not on
-- no_show).
--
-- Tables:
--   credit_packages   — what the shop sells (template). Edits never change
--                       packages already sold (customer_packages snapshots).
--   customer_packages — one bought package with its balance in minutes.
--   package_ledger    — append-only grant / redeem / refund / adjust / void.
--   package_slips     — transfer slips of LIFF purchases.
--   bookings.package_id / package_minutes / package_refunded_at
--                     — which package paid a queue; refund is once per redeem.
--
-- Balance changes go through the security-definer functions below (row lock,
-- check and write in one statement block), called by the service role only.
-- Writes from the app use the service role; RLS gives shop staff read access.
--
-- Run BEFORE deploying the matching app version. Without it the package
-- pages say "ยังไม่พร้อม" and LIFF shows no packages; booking is unaffected.

-- ── 1. Tables ───────────────────────────────────────────────────────────────

create table if not exists public.credit_packages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  shop_id uuid not null references public.shops(id),
  name text not null check (length(name) between 1 and 120),
  description text,
  credit_minutes int not null check (credit_minutes > 0 and credit_minutes <= 100000),
  price numeric(12,2) not null check (price >= 0),
  -- Days the package stays usable after it is activated; NULL = no expiry.
  valid_days int check (valid_days is null or (valid_days between 1 and 3650)),
  -- Services it can pay for; NULL / empty = every service.
  service_ids uuid[],
  -- [{ weekday: 0-6 | null, time_from: 'HH:MM', time_to: 'HH:MM', rate: number }]
  -- Empty = any time at 1 minute per minute. A slot outside every window cannot use the package.
  usage_windows jsonb not null default '[]'::jsonb,
  -- Shown to customers in LIFF for purchase.
  sell_online boolean not null default true,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean not null default false
);

create index if not exists idx_credit_packages_shop on public.credit_packages(shop_id) where is_deleted = false;

create table if not exists public.customer_packages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  shop_id uuid not null references public.shops(id),
  customer_id uuid not null references public.customers(id),
  package_id uuid references public.credit_packages(id),
  -- Snapshot of the template at sale time.
  name text not null,
  total_minutes int not null check (total_minutes > 0),
  remaining_minutes int not null default 0 check (remaining_minutes >= 0),
  price_paid numeric(12,2) not null default 0 check (price_paid >= 0),
  valid_days int,
  service_ids uuid[],
  usage_windows jsonb not null default '[]'::jsonb,
  starts_on date,
  -- Last usable day (inclusive, Bangkok); NULL = no expiry.
  expires_on date,
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'awaiting_verification', 'active', 'rejected', 'cancelled')),
  source text not null default 'staff' check (source in ('staff', 'liff')),
  payment_method text check (payment_method is null or payment_method in ('cash', 'bank_transfer', 'other')),
  payment_note text,
  payment_expires_at timestamptz,
  reject_reason text,
  sold_by uuid,
  activated_at timestamptz,
  activated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_customer_packages_customer on public.customer_packages(shop_id, customer_id);
create index if not exists idx_customer_packages_status on public.customer_packages(shop_id, status);

create table if not exists public.package_ledger (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  shop_id uuid not null references public.shops(id),
  customer_package_id uuid not null references public.customer_packages(id),
  booking_id uuid references public.bookings(id),
  kind text not null check (kind in ('grant', 'redeem', 'refund', 'adjust', 'void')),
  -- Signed: redeem negative, refund / grant positive.
  minutes int not null,
  balance_after int not null,
  note text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_package_ledger_package on public.package_ledger(customer_package_id, created_at);

create table if not exists public.package_slips (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  shop_id uuid not null references public.shops(id),
  customer_package_id uuid not null references public.customer_packages(id),
  storage_path text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'superseded')),
  reject_reason text,
  uploaded_by_line_user uuid,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_package_slips_package on public.package_slips(customer_package_id, created_at);

alter table public.bookings
  add column if not exists package_id uuid references public.customer_packages(id),
  add column if not exists package_minutes int,
  add column if not exists package_refunded_at timestamptz;

comment on column public.bookings.package_id is 'Customer package that paid this queue (minutes in package_minutes). Refunded once when cancelled (package_refunded_at).';

-- ── 2. RLS: shop staff read; writes via service role only ───────────────────

alter table public.credit_packages enable row level security;
alter table public.customer_packages enable row level security;
alter table public.package_ledger enable row level security;
alter table public.package_slips enable row level security;

drop policy if exists credit_packages_shop_read on public.credit_packages;
create policy credit_packages_shop_read on public.credit_packages for select to authenticated using (public.can_access_shop(shop_id));
drop policy if exists customer_packages_shop_read on public.customer_packages;
create policy customer_packages_shop_read on public.customer_packages for select to authenticated using (public.can_access_shop(shop_id));
drop policy if exists package_ledger_shop_read on public.package_ledger;
create policy package_ledger_shop_read on public.package_ledger for select to authenticated using (public.can_access_shop(shop_id));
drop policy if exists package_slips_shop_read on public.package_slips;
create policy package_slips_shop_read on public.package_slips for select to authenticated using (public.can_access_shop(shop_id));

-- ── 3. Balance functions ────────────────────────────────────────────────────

-- Deduct minutes for one or more just-created bookings of the package owner.
-- p_items: [{ "booking_id": uuid, "minutes": int }]. Raises:
--   package_unavailable  — not this shop / customer, not active, or expired
--   package_insufficient — not enough minutes left
create or replace function public.redeem_customer_package(
  p_shop_id uuid,
  p_customer_package_id uuid,
  p_customer_id uuid,
  p_items jsonb,
  p_actor uuid default null
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pkg public.customer_packages%rowtype;
  v_total int := 0;
  v_item jsonb;
  v_balance int;
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
begin
  select * into v_pkg from public.customer_packages
  where id = p_customer_package_id and shop_id = p_shop_id
  for update;

  if not found or v_pkg.customer_id <> p_customer_id or v_pkg.status <> 'active'
     or (v_pkg.expires_on is not null and v_pkg.expires_on < v_today) then
    raise exception 'package_unavailable';
  end if;

  select coalesce(sum((x->>'minutes')::int), 0) into v_total from jsonb_array_elements(p_items) x;
  if v_total <= 0 then
    raise exception 'package_unavailable';
  end if;
  if v_total > v_pkg.remaining_minutes then
    raise exception 'package_insufficient';
  end if;

  v_balance := v_pkg.remaining_minutes;
  for v_item in select * from jsonb_array_elements(p_items) loop
    update public.bookings
      set package_id = v_pkg.id,
          package_minutes = (v_item->>'minutes')::int,
          package_refunded_at = null
    where id = (v_item->>'booking_id')::uuid
      and shop_id = p_shop_id
      and customer_id = p_customer_id
      and package_id is null;
    if not found then
      raise exception 'package_unavailable';
    end if;
    v_balance := v_balance - (v_item->>'minutes')::int;
    insert into public.package_ledger(company_id, shop_id, customer_package_id, booking_id, kind, minutes, balance_after, created_by)
    values (v_pkg.company_id, p_shop_id, v_pkg.id, (v_item->>'booking_id')::uuid, 'redeem', -((v_item->>'minutes')::int), v_balance, p_actor);
  end loop;

  update public.customer_packages set remaining_minutes = v_balance, updated_at = now() where id = v_pkg.id;
  return v_balance;
end;
$$;

-- Give back the minutes of a cancelled booking. Once per redeem: returns NULL
-- when the booking has no package, was refunded already, or the package was cancelled.
create or replace function public.refund_customer_package_booking(
  p_shop_id uuid,
  p_booking_id uuid,
  p_note text default null,
  p_actor uuid default null
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking record;
  v_pkg public.customer_packages%rowtype;
  v_balance int;
begin
  select id, package_id, package_minutes, package_refunded_at into v_booking
  from public.bookings where id = p_booking_id and shop_id = p_shop_id
  for update;
  if not found or v_booking.package_id is null or v_booking.package_refunded_at is not null
     or coalesce(v_booking.package_minutes, 0) <= 0 then
    return null;
  end if;

  select * into v_pkg from public.customer_packages where id = v_booking.package_id and shop_id = p_shop_id for update;
  if not found or v_pkg.status = 'cancelled' then
    return null;
  end if;

  v_balance := v_pkg.remaining_minutes + v_booking.package_minutes;
  update public.customer_packages set remaining_minutes = v_balance, updated_at = now() where id = v_pkg.id;
  update public.bookings set package_refunded_at = now() where id = p_booking_id;
  insert into public.package_ledger(company_id, shop_id, customer_package_id, booking_id, kind, minutes, balance_after, note, created_by)
  values (v_pkg.company_id, p_shop_id, v_pkg.id, p_booking_id, 'refund', v_booking.package_minutes, v_balance, p_note, p_actor);
  return v_balance;
end;
$$;

-- Re-deduct a restored booking ("กู้คิวกลับ") that was refunded on cancel.
-- Raises package_insufficient / package_unavailable like redeem.
create or replace function public.reredeem_customer_package_booking(
  p_shop_id uuid,
  p_booking_id uuid,
  p_actor uuid default null
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking record;
  v_pkg public.customer_packages%rowtype;
  v_balance int;
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
begin
  select id, package_id, package_minutes, package_refunded_at into v_booking
  from public.bookings where id = p_booking_id and shop_id = p_shop_id
  for update;
  if not found or v_booking.package_id is null or v_booking.package_refunded_at is null then
    return null;
  end if;

  select * into v_pkg from public.customer_packages where id = v_booking.package_id and shop_id = p_shop_id for update;
  if not found or v_pkg.status <> 'active' or (v_pkg.expires_on is not null and v_pkg.expires_on < v_today) then
    raise exception 'package_unavailable';
  end if;
  if v_booking.package_minutes > v_pkg.remaining_minutes then
    raise exception 'package_insufficient';
  end if;

  v_balance := v_pkg.remaining_minutes - v_booking.package_minutes;
  update public.customer_packages set remaining_minutes = v_balance, updated_at = now() where id = v_pkg.id;
  update public.bookings set package_refunded_at = null where id = p_booking_id;
  insert into public.package_ledger(company_id, shop_id, customer_package_id, booking_id, kind, minutes, balance_after, note, created_by)
  values (v_pkg.company_id, p_shop_id, v_pkg.id, p_booking_id, 'redeem', -v_booking.package_minutes, v_balance, 'restore', p_actor);
  return v_balance;
end;
$$;

-- Staff correction of a balance (+/- minutes). Raises package_negative below 0.
create or replace function public.adjust_customer_package(
  p_shop_id uuid,
  p_customer_package_id uuid,
  p_minutes int,
  p_note text,
  p_actor uuid
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pkg public.customer_packages%rowtype;
  v_balance int;
begin
  select * into v_pkg from public.customer_packages where id = p_customer_package_id and shop_id = p_shop_id for update;
  if not found or v_pkg.status <> 'active' then
    raise exception 'package_unavailable';
  end if;
  v_balance := v_pkg.remaining_minutes + p_minutes;
  if v_balance < 0 then
    raise exception 'package_negative';
  end if;
  update public.customer_packages set remaining_minutes = v_balance, updated_at = now() where id = v_pkg.id;
  insert into public.package_ledger(company_id, shop_id, customer_package_id, kind, minutes, balance_after, note, created_by)
  values (v_pkg.company_id, p_shop_id, v_pkg.id, 'adjust', p_minutes, v_balance, p_note, p_actor);
  return v_balance;
end;
$$;

-- Activate a sold / paid package: balance = total, expiry from today (Bangkok).
-- Only from pending_payment / awaiting_verification. Returns false when not in such a state.
create or replace function public.activate_customer_package(
  p_shop_id uuid,
  p_customer_package_id uuid,
  p_actor uuid,
  p_note text default null
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pkg public.customer_packages%rowtype;
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
begin
  select * into v_pkg from public.customer_packages where id = p_customer_package_id and shop_id = p_shop_id for update;
  if not found or v_pkg.status not in ('pending_payment', 'awaiting_verification') then
    return false;
  end if;
  update public.customer_packages
    set status = 'active',
        remaining_minutes = v_pkg.total_minutes,
        starts_on = v_today,
        expires_on = case when v_pkg.valid_days is null then null else v_today + (v_pkg.valid_days - 1) end,
        activated_at = now(),
        activated_by = p_actor,
        reject_reason = null,
        updated_at = now()
  where id = v_pkg.id;
  insert into public.package_ledger(company_id, shop_id, customer_package_id, kind, minutes, balance_after, note, created_by)
  values (v_pkg.company_id, p_shop_id, v_pkg.id, 'grant', v_pkg.total_minutes, v_pkg.total_minutes, p_note, p_actor);
  return true;
end;
$$;

revoke all on function public.redeem_customer_package(uuid, uuid, uuid, jsonb, uuid) from public, anon, authenticated;
revoke all on function public.refund_customer_package_booking(uuid, uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.reredeem_customer_package_booking(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.adjust_customer_package(uuid, uuid, int, text, uuid) from public, anon, authenticated;
revoke all on function public.activate_customer_package(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.redeem_customer_package(uuid, uuid, uuid, jsonb, uuid) to service_role;
grant execute on function public.refund_customer_package_booking(uuid, uuid, text, uuid) to service_role;
grant execute on function public.reredeem_customer_package_booking(uuid, uuid, uuid) to service_role;
grant execute on function public.adjust_customer_package(uuid, uuid, int, text, uuid) to service_role;
grant execute on function public.activate_customer_package(uuid, uuid, uuid, text) to service_role;
