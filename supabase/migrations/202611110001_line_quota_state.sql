-- LINE push quota state per shop (2026-11-11).
--
-- Why: vspin's LINE OA Free plan ran out of push messages mid-month; every
-- push then failed with 429 and nobody was told. The app now reads the
-- channel's monthly cap and usage from LINE (free calls), stores them here,
-- warns the shop at 80 % / 100 %, and stamps line_quota_exhausted_at when a
-- push comes back "monthly limit reached" so LIFF can tell the customer to
-- rely on the screen instead of the chat.
--
-- The app reads these columns defensively: before this runs the quota card
-- says "ยังไม่พร้อม", nothing is stamped, and pushes behave as before.

alter table public.shops
  add column if not exists line_quota_exhausted_at timestamptz,
  add column if not exists line_quota_checked_at timestamptz,
  add column if not exists line_quota_used integer,
  add column if not exists line_quota_limit integer,
  add column if not exists line_quota_type text;

comment on column public.shops.line_quota_exhausted_at is
  'Set when a LINE push failed with "monthly limit reached"; cleared when usage drops below the cap (new month / upgrade). Same Bangkok month = LINE delivery paused.';
comment on column public.shops.line_quota_checked_at is 'Last time /v2/bot/message/quota was read for this shop.';
comment on column public.shops.line_quota_used is 'totalUsage from LINE at line_quota_checked_at.';
comment on column public.shops.line_quota_limit is 'Monthly cap from LINE (null on an unlimited plan).';
comment on column public.shops.line_quota_type is 'LINE quota type: limited | none.';
