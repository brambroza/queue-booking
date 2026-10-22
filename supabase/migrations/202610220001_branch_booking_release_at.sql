-- Per-branch "เปิดให้จองเวลา": the moment this branch starts accepting bookings
-- (e.g. a shop announces "เปิดจอง 19:00").
--
-- Before it the LIFF shows a countdown and calls no slot / booking API, and
-- /slots + /book refuse with `not_released`. This keeps a crowd refreshing the
-- page before the hour off the database (incident 2026-10: ~1M requests at a
-- 19:00 opening took Supabase down).
--
-- Different from `booking_open_from` (first DATE that can be booked FOR).
-- NULL = always open, so existing branches do not change.
--
-- Run BEFORE deploying the matching app version: saving a branch from the
-- portal writes this column; the booking flow reads it defensively.

alter table public.branches
  add column if not exists booking_release_at timestamptz default null;

comment on column public.branches.booking_release_at is
  'Moment this branch starts accepting bookings (waiting room before it). NULL = always open.';
