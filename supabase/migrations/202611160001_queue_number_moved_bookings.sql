-- Queue numbers when a booking is moved to another day / branch.
--
-- Bug (2026-11-16): a queue moved from the 18th to the 16th kept its number
-- (e.g. A003). The 16th's counter (202610220002) knew nothing about it, so when
-- the counter reached 3 the next LIFF / portal booking on the 16th was issued
-- A003 again and the insert failed on uq_bookings_queue_number_per_day (23505).
-- The move itself could also fail when the target day already had that number.
--
-- Fix:
--   1. next_queue_number() issues the next ordinal from the counter and skips
--      every number already held that day. The counter row lock is held until
--      the transaction ends, so the skip loop is race-safe.
--   2. assign_queue_number() (BEFORE INSERT) uses it.
--   3. New BEFORE UPDATE trigger: when booking_date or branch_id changes, keep
--      the number if it is free on the target day, otherwise issue a new one.
--      The LINE "moved" Flex reads the row after the update, so the customer
--      sees the number actually held.
--
-- Rows with an explicit queue_number on insert (demo `D` prefix) are still left
-- alone. Safe to run while the app is live; no app change depends on it.

create or replace function public.next_queue_number(
  p_shop_id uuid,
  p_branch_id uuid,
  p_booking_date date,
  p_exclude_id uuid default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ordinal integer;
begin
  update public.queue_counters
     set last_ordinal = last_ordinal + 1, updated_at = now()
   where shop_id = p_shop_id
     and branch_id = p_branch_id
     and booking_date = p_booking_date
  returning last_ordinal into v_ordinal;

  if v_ordinal is null then
    perform pg_advisory_xact_lock(
      hashtext(p_shop_id::text || ':' || p_branch_id::text || ':' || p_booking_date::text)
    );
    insert into public.queue_counters as qc (shop_id, branch_id, booking_date, last_ordinal)
    values (
      p_shop_id, p_branch_id, p_booking_date,
      (select count(*) from public.bookings b
        where b.shop_id = p_shop_id and b.branch_id = p_branch_id
          and b.booking_date = p_booking_date) + 1
    )
    on conflict (shop_id, branch_id, booking_date)
      do update set last_ordinal = qc.last_ordinal + 1, updated_at = now()
    returning last_ordinal into v_ordinal;
  end if;

  -- Skip numbers already held that day (moved-in queues keep theirs; a seed
  -- from count(*) can also land on a number still in use after moves out).
  while exists (
    select 1 from public.bookings b
     where b.shop_id = p_shop_id
       and b.branch_id = p_branch_id
       and b.booking_date = p_booking_date
       and b.queue_number = public.format_queue_number(v_ordinal)
       and (p_exclude_id is null or b.id <> p_exclude_id)
  ) loop
    update public.queue_counters
       set last_ordinal = last_ordinal + 1, updated_at = now()
     where shop_id = p_shop_id
       and branch_id = p_branch_id
       and booking_date = p_booking_date
    returning last_ordinal into v_ordinal;
  end loop;

  return public.format_queue_number(v_ordinal);
end;
$$;

revoke all on function public.next_queue_number(uuid, uuid, date, uuid) from public, anon, authenticated;

create or replace function public.assign_queue_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.queue_number is not null and new.queue_number <> '' then
    return new;
  end if;
  new.queue_number := public.next_queue_number(new.shop_id, new.branch_id, new.booking_date);
  return new;
end;
$$;

create or replace function public.reassign_queue_number_on_move()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.booking_date is not distinct from old.booking_date
     and new.branch_id is not distinct from old.branch_id then
    return new;
  end if;

  -- Keep the customer's number when nobody holds it on the target day.
  if new.queue_number is not null and new.queue_number <> '' and not exists (
    select 1 from public.bookings b
     where b.shop_id = new.shop_id
       and b.branch_id = new.branch_id
       and b.booking_date = new.booking_date
       and b.queue_number = new.queue_number
       and b.id <> new.id
  ) then
    return new;
  end if;

  new.queue_number := public.next_queue_number(new.shop_id, new.branch_id, new.booking_date, new.id);
  return new;
end;
$$;

drop trigger if exists trg_bookings_reassign_queue_number on public.bookings;
create trigger trg_bookings_reassign_queue_number
before update of booking_date, branch_id on public.bookings
for each row execute function public.reassign_queue_number_on_move();
