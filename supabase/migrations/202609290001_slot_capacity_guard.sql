-- Slot capacity: one place to set it, and a guard that actually enforces it.
--
-- Three columns looked like "queues per slot", but only one was ever used:
--
--   services.capacity_per_slot       read by get_available_slots /
--                                    get_slot_availability — the value the
--                                    customer sees. This is the setting.
--   working_hours.capacity_per_slot  a fallback that could never fire (the
--                                    service column is NOT NULL). Deprecated.
--   branches.max_parallel_queues     never read by anything. Deprecated.
--
-- The portal now edits the service value only. The two deprecated columns stay
-- in place (no data is dropped); they are simply no longer shown or read.
--
-- Until now nothing refused a booking into a full slot: the LIFF greyed the
-- button, and that was all. The app checks capacity before inserting, with a
-- friendly Thai message; this trigger is the backstop for the race that check
-- cannot close — two devices reading "1 seat left" at the same time and both
-- inserting (same lesson as 202609220001 / 202609220002). It serialises per
-- slot with an advisory lock and raises `slot_full`, which the app maps to the
-- same 409 as its own check.
--
-- The rule mirrors the non-resource branch of get_slot_availability:
--   * counted per shop + branch + service + booking_date + start_time
--   * every status counts except cancelled / no_show
--   * full when count >= services.capacity_per_slot
--
-- Exempt rows:
--   * `resource_id` set  → the resource overlap guard (is_resource_available)
--                          governs that booking; a service with capacity 1 and
--                          three stylists must still take three bookings
--   * `created_by` set   → portal staff may overbook on purpose (walk-in,
--                          special cases); the portal asks them to confirm
--   * `is_demo`          → demo sandbox rows
--
-- Insert only: moving a booking is a staff action and is checked in the app.
-- Bookings that already exceed capacity are left untouched.
--
-- Run BEFORE deploying the matching app version. Nothing breaks without it,
-- but until the trigger exists only the non-atomic app check guards capacity.

comment on column public.services.capacity_per_slot is
  'Queues this service accepts at the same start time, per branch. The only slot-capacity setting in use.';
comment on column public.working_hours.capacity_per_slot is
  'Deprecated: not read. Slot capacity is services.capacity_per_slot.';
comment on column public.branches.max_parallel_queues is
  'Deprecated: not read. Slot capacity is services.capacity_per_slot.';

create or replace function public.enforce_slot_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capacity int;
  v_booked int;
begin
  if new.created_by is not null
     or coalesce(new.is_demo, false)
     or new.resource_id is not null
     or new.service_id is null
     or new.status in ('cancelled', 'no_show') then
    return new;
  end if;

  select s.capacity_per_slot into v_capacity
  from public.services s
  where s.id = new.service_id
    and s.shop_id = new.shop_id;

  -- Unknown service: not this trigger's business, the foreign key decides.
  if v_capacity is null then
    return new;
  end if;

  -- Serialise per slot so two concurrent inserts cannot both pass the count.
  perform pg_advisory_xact_lock(
    hashtext(
      new.shop_id::text || ':slot:' || coalesce(new.branch_id::text, '') || ':' || new.service_id::text
      || ':' || new.booking_date::text || ':' || new.start_time::text
    )
  );

  select count(*) into v_booked
  from public.bookings b
  where b.shop_id = new.shop_id
    and b.branch_id is not distinct from new.branch_id
    and b.service_id = new.service_id
    and b.booking_date = new.booking_date
    and b.start_time = new.start_time
    and b.is_deleted = false
    and b.status not in ('cancelled', 'no_show');

  if v_booked >= v_capacity then
    raise exception 'slot_full' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_bookings_slot_capacity on public.bookings;
create trigger trg_bookings_slot_capacity
before insert on public.bookings
for each row execute function public.enforce_slot_capacity();

-- The count above, the app-side count and get_slot_availability all hit this shape.
create index if not exists idx_bookings_slot_capacity
  on public.bookings(shop_id, branch_id, service_id, booking_date, start_time)
  where is_deleted = false;
