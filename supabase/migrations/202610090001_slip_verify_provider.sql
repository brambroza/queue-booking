-- Bank-side slip verification provider (EasySlip today; SlipOK / a bank's own
-- API later). Two things:
--   1. a per-shop vendor key, sealed like bank deeplink credentials, so a shop
--      can bring its own key on any plan (the platform key is plan-gated in code)
--   2. recheck bookkeeping on payment_slips, so an inconclusive bank answer
--      (vendor down, quota out, bank still posting) is retried by cron
--
-- Must run before the matching deploy: /api/payment-slips, approve/reject and
-- the recheck cron all reference the new payment_slips columns.

-- ── 1. Per-shop provider key ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shop_slip_verify_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  shop_id uuid NOT NULL REFERENCES public.shops(id),
  provider text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  -- AES-256-GCM sealed JSON (see src/lib/crypto/secret-box.ts), e.g. {"apiKey": "..."}.
  credentials_enc text,
  -- Last 4 characters of the key, for a masked "✓ configured (…abcd)" hint.
  credentials_hint text,
  last_test_at timestamptz,
  last_test_ok boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  is_demo boolean NOT NULL DEFAULT false,
  is_deleted boolean NOT NULL DEFAULT false,
  CONSTRAINT shop_slip_verify_providers_provider_check CHECK (provider IN ('easyslip')),
  CONSTRAINT shop_slip_verify_providers_unique UNIQUE (shop_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_shop_slip_verify_providers_shop
  ON public.shop_slip_verify_providers(shop_id) WHERE is_deleted = false;

COMMENT ON TABLE public.shop_slip_verify_providers IS
  'Per-shop slip verification vendor key. credentials_enc is AES-256-GCM sealed JSON; never readable by app roles.';

-- RLS is enabled with NO policies on purpose (same reasoning as
-- shop_bank_deeplink_providers): a SELECT policy cannot hide one column, and
-- this table holds a sealed vendor key, so every read and write goes through
-- the service-role client inside an authenticated owner route scoped by
-- profile.shop_id (src/app/api/shop-payment-settings/slip-verify).
ALTER TABLE public.shop_slip_verify_providers ENABLE ROW LEVEL SECURITY;

-- ── 2. Recheck bookkeeping on slips ──────────────────────────────────────────
ALTER TABLE public.payment_slips
  -- Attempts made so far (1 = only the upload-time check).
  ADD COLUMN IF NOT EXISTS provider_recheck_count integer NOT NULL DEFAULT 0,
  -- When the cron should look again; NULL = nothing scheduled.
  ADD COLUMN IF NOT EXISTS next_recheck_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_payment_slips_recheck
  ON public.payment_slips(next_recheck_at)
  WHERE next_recheck_at IS NOT NULL AND status = 'pending' AND is_deleted = false;
