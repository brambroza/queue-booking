-- Per-branch rule: the first date this branch accepts bookings FOR.
--
-- `booking_open_until` (202609290002) caps the day being booked from above;
-- this column bounds it from below. Together they make a fixed range ("open
-- for 23–25 Oct"): a customer may book today, but only for days inside it.
-- Days before the range are left out of the LIFF calendar, the chatbot names
-- the range, and /book, /api/bookings refuse them with `beyond_booking_window`.
--
-- Decided 2026-10-16 from the shop's own example (SHOP-PDCLSQ, "open 23–25").
-- Staff are bound too, like the other window rules. NULL = from today, so
-- existing branches do not change.
--
-- Run BEFORE deploying the matching app version: the booking flow reads the
-- column through a defensive helper and keeps working without it, but saving
-- a branch from the portal writes it and fails until it exists.

alter table public.branches
  add column if not exists booking_open_from date default null;

alter table public.branches
  drop constraint if exists branches_booking_open_range_check;

-- A first date after the last date would leave a branch with no bookable
-- day; refuse that combination at the source.
alter table public.branches
  add constraint branches_booking_open_range_check
  check (
    booking_open_from is null
    or booking_open_until is null
    or booking_open_from <= booking_open_until
  );

comment on column public.branches.booking_open_from is
  'First date (inclusive, Bangkok) this branch accepts bookings for. NULL = from today. With booking_open_until it forms a fixed bookable range.';
