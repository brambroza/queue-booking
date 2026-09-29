-- Per-branch rule: how far ahead a booking may be made.
--
-- Until now a customer could pick any future date. Shops want to cap that,
-- either as a rolling window ("1 week / 1 / 2 / 3 months ahead") or as a fixed
-- last date ("open for booking until 31 Dec"). Both are opt-in per branch and
-- independent; when both are set the earlier date wins. NULL = unlimited, so
-- existing branches behave exactly as before.
--
-- Scope decided 2026-09-29: the rule applies to staff booking from the portal
-- as well as customers on LIFF, and months are calendar months (29 Sep + 1
-- month = 29 Oct), computed in the app (src/lib/booking/booking-window.ts).
--
-- Run BEFORE deploying the matching app version: the booking flow reads these
-- columns through a defensive helper and keeps working without them, but
-- saving a branch from the portal writes them and fails until they exist.

alter table public.branches
  -- Default NULL = unlimited: every existing and newly created branch starts
  -- without a limit until the shop sets one.
  add column if not exists booking_advance_window text default null,
  add column if not exists booking_open_until date default null;

alter table public.branches
  drop constraint if exists branches_booking_advance_window_check;

alter table public.branches
  add constraint branches_booking_advance_window_check
  check (booking_advance_window is null or booking_advance_window ~ '^[1-9][0-9]?[dwm]$');

comment on column public.branches.booking_advance_window is
  'Rolling limit on how far ahead this branch may be booked: count + unit (d = days, w = weeks, m = calendar months), e.g. 1w, 1m, 3m. NULL = unlimited.';

comment on column public.branches.booking_open_until is
  'Fixed last date this branch accepts bookings for (inclusive, Bangkok date). NULL = no fixed end. When booking_advance_window is also set, the earlier date wins.';
