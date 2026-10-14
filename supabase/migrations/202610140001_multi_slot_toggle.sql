-- Shop switch for multi-slot bookings and staff "ต่อเวลา" (2026-10-14).
--
-- Off by default: a customer may book several consecutive slots in LIFF, and
-- staff may extend a booking from the portal, only after the owner turns this
-- on at /portal/services. Per-service limits still come from
-- services.booking_mode = 'flexible_duration' + min/max_duration_minutes.
--
-- The app reads the flag defensively (isMultiSlotEnabled), so before this runs
-- the feature simply stays off; saving the switch fails until it has run.

alter table public.shops
  add column if not exists multi_slot_enabled boolean not null default false;

comment on column public.shops.multi_slot_enabled is
  'Allow multi-slot LIFF bookings and staff extend time (resource-bound bookings only). Default off.';
