-- Per-shop rule: a customer may hold only one booking per day.
--
-- Some shops (clinics, government-style service counters, salons with a long
-- waiting list) want to stop one person from taking several queue numbers on
-- the same day. The rule is shop-wide (any service counts), opt-in, and applies
-- only to bookings the customer creates themselves through LIFF — staff
-- creating a booking from the portal may override it (walk-in, special cases).
--
-- The app already refuses such a booking before inserting, with a friendly
-- Thai message. This trigger is the backstop for the race that check cannot
-- close: two taps / two devices counting "0 bookings today" at the same time
-- and both inserting (the same lesson as 202609220001). It serialises per
-- (shop, customer, day) with an advisory lock and raises `daily_limit`, which
-- the app maps to the same 409 as its own check.
--
-- Origin is told apart by columns the write paths already set:
--   * portal inserts carry `created_by` (the staff user) → exempt
--   * demo sandbox rows carry `is_demo = true`             → exempt
--   * LIFF inserts carry neither                            → enforced
--
-- A cancelled / no-show booking frees the day; a completed one does not (one
-- visit per day, same reading as slot capacity in 202609150002).
--
-- Run BEFORE deploying the matching app version. The app reads the flag
-- through a defensive helper, so nothing breaks without it — but until the
-- trigger exists only the non-atomic app check guards the rule.

alter table public.shops
  add column if not exists one_booking_per_day boolean not null default false;

comment on column public.shops.one_booking_per_day is
  'When true, a customer booking through LIFF may hold at most one non-cancelled booking per day in this shop (any service). Staff bookings from the portal are exempt.';

create or replace function public.enforce_daily_booking_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enabled boolean;
begin
  -- Staff and demo rows are never limited; a row born cancelled cannot collide.
  if new.created_by is not null
     or coalesce(new.is_demo, false)
     or new.customer_id is null
     or new.status in ('cancelled', 'no_show') then
    return new;
  end if;

  select s.one_booking_per_day into v_enabled
  from public.shops s
  where s.id = new.shop_id;

  if not coalesce(v_enabled, false) then
    return new;
  end if;

  -- Serialise per (shop, customer, day) so two concurrent inserts cannot both
  -- pass the existence check below.
  perform pg_advisory_xact_lock(
    hashtext(new.shop_id::text || ':daily:' || new.customer_id::text || ':' || new.booking_date::text)
  );

  if exists (
    select 1
    from public.bookings b
    where b.shop_id = new.shop_id
      and b.customer_id = new.customer_id
      and b.booking_date = new.booking_date
      and b.is_deleted = false
      and coalesce(b.is_demo, false) = false
      and b.status not in ('cancelled', 'no_show')
  ) then
    raise exception 'daily_limit' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_bookings_daily_limit on public.bookings;
create trigger trg_bookings_daily_limit
before insert on public.bookings
for each row execute function public.enforce_daily_booking_limit();

-- The existence check above and the app-side count both hit this shape.
create index if not exists idx_bookings_customer_day
  on public.bookings(shop_id, customer_id, booking_date)
  where is_deleted = false;
