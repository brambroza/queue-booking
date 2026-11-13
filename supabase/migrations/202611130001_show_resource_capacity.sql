-- Shop switch: show "N ที่นั่ง" on resource cards in LIFF (2026-11-13).
--
-- On by default = old behaviour: the LIFF resource picker shows the resource
-- capacity ("1 ที่นั่ง") next to its type. Off = the capacity text is hidden.
-- Why: vspin courts all carry capacity 1, so "1 ที่นั่ง" on a court confuses
-- customers. Display only; capacity still drives booking rules. Set on
-- /portal/resources.
--
-- The app reads the flag defensively (isResourceCapacityVisible), so before
-- this runs the text stays visible and saving the switch fails.

alter table public.shops
  add column if not exists show_resource_capacity boolean not null default true;

comment on column public.shops.show_resource_capacity is
  'LIFF resource cards show "N ที่นั่ง" (capacity). Display only. Default on.';
