-- Queue numbers from a per-day counter row instead of counting the day.
--
-- 202609220001 issued a number by taking an advisory lock per (shop, branch,
-- day) and then `count(*)` over every booking of that day. At a booking rush
-- (one shop opening at 19:00) every insert of the day queued on that lock while
-- the count grew with each booking, so the lock was held longer and longer.
--
-- Now the lock is the counter row itself: one indexed UPDATE ... RETURNING per
-- insert, constant time. The day's first booking seeds the counter from the
-- rows already there, so numbering continues where it was (no reset, no reuse).
-- Format, letters, the unique index and the "explicit queue_number is left
-- alone" rule are unchanged.
--
-- Safe to run while the app is live; no app change depends on it.

create table if not exists public.queue_counters (
  shop_id uuid not null,
  branch_id uuid not null,
  booking_date date not null,
  last_ordinal integer not null,
  updated_at timestamptz not null default now(),
  primary key (shop_id, branch_id, booking_date)
);

-- Only the security-definer trigger touches it.
alter table public.queue_counters enable row level security;
revoke all on table public.queue_counters from anon, authenticated;

create or replace function public.assign_queue_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ordinal integer;
begin
  if new.queue_number is not null and new.queue_number <> '' then
    return new;
  end if;

  -- Fast path: the day already has a counter. The row lock taken here
  -- serialises issuing per (shop, branch, day) until the transaction ends.
  update public.queue_counters
     set last_ordinal = last_ordinal + 1, updated_at = now()
   where shop_id = new.shop_id
     and branch_id = new.branch_id
     and booking_date = new.booking_date
  returning last_ordinal into v_ordinal;

  if v_ordinal is null then
    -- First number of the day (or first since this migration): continue after
    -- the rows already there. Advisory lock so two first inserts do not both
    -- seed from the same count.
    perform pg_advisory_xact_lock(
      hashtext(new.shop_id::text || ':' || new.branch_id::text || ':' || new.booking_date::text)
    );
    insert into public.queue_counters as qc (shop_id, branch_id, booking_date, last_ordinal)
    values (
      new.shop_id,
      new.branch_id,
      new.booking_date,
      (select count(*) from public.bookings b
        where b.shop_id = new.shop_id and b.branch_id = new.branch_id and b.booking_date = new.booking_date) + 1
    )
    on conflict (shop_id, branch_id, booking_date)
      do update set last_ordinal = qc.last_ordinal + 1, updated_at = now()
    returning last_ordinal into v_ordinal;
  end if;

  new.queue_number := public.format_queue_number(v_ordinal);
  return new;
end;
$$;

-- Trigger trg_bookings_assign_queue_number (202609220001) already calls this
-- function; replacing the body is enough.
