-- Per-branch rule: the date on which this branch starts taking bookings.
--
-- `booking_open_until` (202609290002) caps the DAY BEING BOOKED. This column
-- is different: it gates WHEN bookings may be made at all. Before this date
-- (Bangkok) the branch accepts no booking for any day — LIFF shows "opens on
-- …", the chatbot answers the same, and /book, /api/bookings refuse with
-- `booking_not_open`. From that date on everything behaves as before.
--
-- Decided 2026-10-16 (option B of the two readings): a pre-sale style switch
-- rather than a lower bound on the booking date. Staff are bound too, like the
-- other window rules. NULL = open now, so existing branches do not change.
--
-- Run BEFORE deploying the matching app version: the booking flow reads the
-- column through a defensive helper and keeps working without it, but saving
-- a branch from the portal writes it and fails until it exists.

alter table public.branches
  add column if not exists booking_open_from date default null;

alter table public.branches
  drop constraint if exists branches_booking_open_range_check;

-- Opening after the last bookable day would leave a branch that never takes a
-- booking; refuse that combination at the source.
alter table public.branches
  add constraint branches_booking_open_range_check
  check (
    booking_open_from is null
    or booking_open_until is null
    or booking_open_from <= booking_open_until
  );

comment on column public.branches.booking_open_from is
  'Bangkok date from which this branch accepts bookings (inclusive). Before it no booking may be made for any day. NULL = open now.';
