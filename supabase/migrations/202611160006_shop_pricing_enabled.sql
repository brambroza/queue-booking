-- Shop switch: time-range prices + consecutive discount on/off (2026-11-16).
--
-- Off by default: a shop owner turns it on at /portal/resources before the
-- editor shows and before any rule / discount changes a price. Off = every
-- booking is priced the old way (resource unit_price, else service price),
-- rules and discounts stay stored and come back when switched on again.
--
-- Shops that already have an active rule or a discount are switched on here,
-- so their prices do not change when this ships.
--
-- The app reads the flag defensively (isPricingEnabled): before this runs the
-- feature behaves as before (on, plan permitting) and saving the switch fails.

alter table public.shops
  add column if not exists pricing_enabled boolean not null default false;

comment on column public.shops.pricing_enabled is
  'Time-range prices + consecutive discount in force (Professional+). Default off; set on /portal/resources.';

update public.shops s
   set pricing_enabled = true
 where s.pricing_enabled = false
   and (
     exists (
       select 1 from public.service_price_rules r
        where r.shop_id = s.id and r.is_deleted = false and r.active = true
     )
     or exists (
       select 1 from public.services v
        where v.shop_id = s.id and v.is_deleted = false
          and v.consecutive_discount_type is not null and v.consecutive_discount_value > 0
     )
   );
