-- Shop switches for helper text under the LIFF time grid (2026-11-16).
--
-- All on by default = old behaviour. Set on /portal/resources.
--   liff_show_multi_pick_hint       "แตะเลือกได้หลายช่อง สูงสุด N ช่อง …" (the
--                                   "เลือกแล้ว N ช่อง" line stays)
--   liff_show_price_bands           "ราคาต่อรอบ: 08:00–15:00 500 บาท · …"
--   liff_show_consecutive_discount  "จองรอบต่อเนื่อง ลด 50 บาท/รอบ"
-- Display only: prices, the discount and the order summary are unchanged.
--
-- The app reads the flags defensively (getLiffBookingHints), so before this
-- runs every text stays visible and saving a switch fails.

alter table public.shops
  add column if not exists liff_show_multi_pick_hint boolean not null default true,
  add column if not exists liff_show_price_bands boolean not null default true,
  add column if not exists liff_show_consecutive_discount boolean not null default true;

comment on column public.shops.liff_show_multi_pick_hint is
  'LIFF shows the multi-pick hint under the time grid. Display only. Default on.';
comment on column public.shops.liff_show_price_bands is
  'LIFF shows the time-range price bands under the time grid. Display only. Default on.';
comment on column public.shops.liff_show_consecutive_discount is
  'LIFF shows the consecutive-slot discount line under the time grid. Display only. Default on.';
