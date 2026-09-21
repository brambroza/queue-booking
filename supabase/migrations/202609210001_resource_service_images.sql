-- Photos so a customer can recognise what they are booking (e.g. "court 3").
--
-- booking_resources.image_urls : up to 5 public shop-assets URLs, first = cover.
--   Stored as an array instead of a join table so no new RLS surface is needed
--   (same reasoning as service_ids in 202609120003).
-- services.image_url           : one cover photo per service.
-- branches.layout_image_url    : one venue map per branch, so the customer can
--   see where each court / room sits.
--
-- No storage SQL on purpose: buckets are created lazily (ensureBucket) and
-- shop-assets is already public.
--
-- MUST run before deploy: /api/public/shop/[shopKey]/meta selects these columns.

alter table if exists public.booking_resources
  add column if not exists image_urls text[] not null default '{}';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'booking_resources_image_urls_max'
  ) then
    alter table public.booking_resources
      add constraint booking_resources_image_urls_max
      check (cardinality(image_urls) <= 5)
      not valid;
  end if;
end $$;

alter table public.booking_resources
  validate constraint booking_resources_image_urls_max;

alter table if exists public.services
  add column if not exists image_url text;

alter table if exists public.branches
  add column if not exists layout_image_url text;
