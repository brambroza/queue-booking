-- Price by time of day + automatic consecutive-slot discount (2026-11-16).
--
-- 1. service_price_rules: optional time-range prices of a service, e.g.
--    08:00–15:00 = 500, 15:00–00:00 = 550. A rule may be narrowed to one
--    resource (court / room), one branch and/or one weekday; the most specific
--    match wins (resource > branch > weekday). A slot is priced by its start
--    time; time_to is exclusive and 00:00 as time_to means end of day.
--    No rows = the old price (resource unit_price when > 0, else services.price).
-- 2. services.consecutive_discount_*: a slot that starts right when the
--    previous slot of the same order on the same resource ends is discounted
--    once (500, 450, 450 …). NULL type = off.
-- 3. bookings.price_amount / price_breakdown: price of each queue at booking
--    time, so a partial cancel can re-price the rest and reports read the real
--    amount. NULL on every older row (the app falls back to the old formula).
--
-- Professional+ only — enforced in the app (rules are ignored on lower plans).
-- Run BEFORE deploying the matching app version. Without it the app keeps the
-- old price everywhere and the rule editor says "ยังไม่พร้อม". Safe while live.

create table if not exists public.service_price_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  shop_id uuid not null references public.shops(id),
  service_id uuid not null references public.services(id),
  -- NULL = every resource of the service.
  resource_id uuid references public.booking_resources(id),
  -- NULL = every branch.
  branch_id uuid references public.branches(id),
  -- 0 = Sunday … 6 = Saturday; NULL = every day.
  weekday int check (weekday between 0 and 6),
  time_from time not null,
  -- Exclusive; 00:00 = midnight at the end of the day.
  time_to time not null,
  price numeric(12,2) not null check (price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean not null default false,
  constraint service_price_rules_range_check check (time_from < time_to or time_to = '00:00'::time)
);

comment on table public.service_price_rules is
  'Optional time-range prices of a service. No rows = resource unit_price (when > 0) or services.price.';

create index if not exists idx_service_price_rules_lookup
  on public.service_price_rules(shop_id, service_id)
  where is_deleted = false and active = true;

alter table public.service_price_rules enable row level security;

-- Reads for the shop's own staff; writes go through the portal API.
drop policy if exists service_price_rules_shop_read on public.service_price_rules;
create policy service_price_rules_shop_read on public.service_price_rules
for select to authenticated
using (public.can_access_shop(shop_id));

drop policy if exists service_price_rules_shop_write on public.service_price_rules;
create policy service_price_rules_shop_write on public.service_price_rules
for all to authenticated
using (public.can_access_shop(shop_id))
with check (public.can_access_shop(shop_id));

alter table public.services
  add column if not exists consecutive_discount_type text,
  add column if not exists consecutive_discount_value numeric(12,2) not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'services_consecutive_discount_type_check') then
    alter table public.services
      add constraint services_consecutive_discount_type_check
      check (consecutive_discount_type is null or consecutive_discount_type in ('amount', 'percent'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'services_consecutive_discount_value_check') then
    alter table public.services
      add constraint services_consecutive_discount_value_check
      check (consecutive_discount_value >= 0 and (consecutive_discount_type is distinct from 'percent' or consecutive_discount_value <= 100));
  end if;
end $$;

comment on column public.services.consecutive_discount_type is
  'amount | percent | NULL (off). Each slot right after another slot of the same order on the same resource is discounted once.';

alter table public.bookings
  add column if not exists price_amount numeric(12,2),
  add column if not exists price_breakdown jsonb;

comment on column public.bookings.price_amount is
  'Price of this queue at booking time (time-range price + consecutive discount). NULL on rows before 202611160002.';
