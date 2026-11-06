-- Shop switch: customers must pick a resource in LIFF (2026-11-06).
--
-- Off by default = old behaviour: LIFF offers "ไม่ระบุสนาม / ผู้ให้บริการ" and a
-- booking may be saved without a resource. On = that option is hidden and
-- /api/public/shop/[shopKey]/book refuses a booking without resource_id
-- (400 code resource_required) whenever the service has at least one active
-- resource in the branch. Set on /portal/resources.
--
-- Why: vspin prices courts on the resource (service price 0). A customer who
-- skipped the court paid nothing and got a confirmed queue.
--
-- Staff bookings (/api/bookings) are not affected. The app reads the flag
-- defensively (isResourceChoiceRequired), so before this runs the switch is
-- off and saving it fails.

alter table public.shops
  add column if not exists require_resource_choice boolean not null default false;

comment on column public.shops.require_resource_choice is
  'LIFF customers must pick a resource (no "ไม่ระบุ" option) when the service has active resources. Default off.';
