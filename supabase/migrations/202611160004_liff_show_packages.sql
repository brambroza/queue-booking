-- Shop switch: always show the "แพ็กเกจของฉัน" section on the LIFF member page,
-- even before the customer owns a package (empty state "ยังไม่มีแพ็กเกจ").
-- Default off = the section appears only when there is something to show
-- (a package the customer holds, or one the shop sells online).
-- Set on /portal/packages via PATCH /api/shop-display-settings { liff_show_packages }.
-- The app reads it defensively: not run = off, saving the switch fails.
alter table public.shops
  add column if not exists liff_show_packages boolean not null default false;

comment on column public.shops.liff_show_packages is
  'Always show the prepaid packages section on the LIFF member page (Professional+). Default false = only when there is something to show.';
