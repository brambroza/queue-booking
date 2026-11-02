-- The shop owner's LINE on the platform OA (QueueBooking), linked by a
-- super_admin from /portal/shop-subscriptions: the admin creates a one-time
-- code, the owner sends it to the QueueBooking OA, and the platform webhook
-- (/api/line/webhook/platform) stores the sender. Owner alerts go here first,
-- then fall back to the shop's own OA link (202611020002).
--
-- Separate from owner_line_user_id because a LINE user id is per provider: the
-- id seen by the platform OA cannot be pushed with a shop's token, and back.
-- Only a SHA-256 hash of the code is stored. Run before the matching deploy;
-- without it the admin column shows "not ready" and alerts use the shop OA.
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS platform_line_user_id text,
  ADD COLUMN IF NOT EXISTS platform_line_display_name text,
  ADD COLUMN IF NOT EXISTS platform_line_linked_at timestamptz,
  ADD COLUMN IF NOT EXISTS platform_line_link_code_hash text,
  ADD COLUMN IF NOT EXISTS platform_line_link_code_expires_at timestamptz;

COMMENT ON COLUMN public.shops.platform_line_user_id IS
  'Owner LINE user id as seen by the platform (QueueBooking) OA. Set by the platform webhook link-code flow only.';
COMMENT ON COLUMN public.shops.platform_line_link_code_hash IS
  'SHA-256 hex of the pending one-time platform link code; cleared once used.';

-- The platform webhook finds the shop by code hash alone.
CREATE UNIQUE INDEX IF NOT EXISTS uq_shops_platform_line_link_code_hash
  ON public.shops (platform_line_link_code_hash)
  WHERE platform_line_link_code_hash IS NOT NULL;
