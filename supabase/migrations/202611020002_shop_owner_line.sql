-- The shop owner's own LINE account, reached through the shop's LINE OA, for
-- operational alerts (booking quota near / at the plan limit).
--
-- Linked by a one-time code: the owner creates it in /portal/line-settings and
-- sends it to the shop's OA; the webhook stores the sender's LINE user id.
-- Only a SHA-256 hash of the code is stored. Run before the matching deploy for
-- the link card to work; without it the app skips the LINE alert and keeps the
-- in-portal notification.
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS owner_line_user_id text,
  ADD COLUMN IF NOT EXISTS owner_line_display_name text,
  ADD COLUMN IF NOT EXISTS owner_line_linked_at timestamptz,
  ADD COLUMN IF NOT EXISTS owner_line_link_code_hash text,
  ADD COLUMN IF NOT EXISTS owner_line_link_code_expires_at timestamptz;

COMMENT ON COLUMN public.shops.owner_line_user_id IS
  'LINE user id (of the shop OA provider) that receives owner alerts. Set by the webhook link-code flow only.';
COMMENT ON COLUMN public.shops.owner_line_link_code_hash IS
  'SHA-256 hex of the pending one-time link code; cleared once used.';

-- Dedup lookups for quota alerts: notifications by shop + type, newest first.
CREATE INDEX IF NOT EXISTS idx_notifications_shop_type_created
  ON public.notifications (shop_id, type, created_at DESC);
