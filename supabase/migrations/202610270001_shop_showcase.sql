-- Shop showcase: a shop opts in (PDPA consent, separate from the terms) to be
-- shown on the public landing page with its name, logo, business type, area,
-- a short quote and a booking link. A super_admin reviews every submission;
-- only a published snapshot is ever shown, and withdrawing consent clears it.
--
-- Writes go through the service role only (API routes check the role and the
-- shop first): the shop must never be able to set its own row to published.

CREATE TABLE IF NOT EXISTS public.shop_showcase (
  shop_id uuid PRIMARY KEY REFERENCES public.shops(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  consent boolean NOT NULL DEFAULT false,
  consent_version text,
  consented_at timestamptz,
  show_logo boolean NOT NULL DEFAULT true,
  show_business_type boolean NOT NULL DEFAULT true,
  show_area boolean NOT NULL DEFAULT true,
  show_booking_link boolean NOT NULL DEFAULT true,
  area_label text CHECK (area_label IS NULL OR char_length(area_label) <= 40),
  quote text CHECK (quote IS NULL OR char_length(quote) <= 140),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'revoked')),
  -- What the landing page shows. Set on approve, cleared on revoke/unpublish;
  -- a later edit goes back to review while this snapshot stays live.
  published_quote text,
  published_at timestamptz,
  featured boolean NOT NULL DEFAULT false,
  submitted_at timestamptz,
  reviewed_by uuid,
  reviewed_at timestamptz,
  reject_reason text CHECK (reject_reason IS NULL OR char_length(reject_reason) <= 300),
  -- One-time portal banner inviting existing shops; set when the owner dismisses or opens it.
  prompt_dismissed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shop_showcase_published
  ON public.shop_showcase (featured DESC, published_at)
  WHERE consent AND published_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shop_showcase_pending
  ON public.shop_showcase (submitted_at)
  WHERE status = 'pending';

-- Append-only evidence of every consent, withdrawal and review decision.
CREATE TABLE IF NOT EXISTS public.shop_showcase_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  actor_id uuid,
  action text NOT NULL
    CHECK (action IN ('consent', 'revoke', 'update', 'submit', 'approve', 'reject', 'unpublish', 'feature', 'unfeature')),
  consent_version text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shop_showcase_events_shop
  ON public.shop_showcase_events (shop_id, created_at DESC);

ALTER TABLE public.shop_showcase ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_showcase_events ENABLE ROW LEVEL SECURITY;

-- Staff of the shop may read their own row; no write policy on purpose.
DROP POLICY IF EXISTS shop_showcase_shop_read ON public.shop_showcase;
CREATE POLICY shop_showcase_shop_read ON public.shop_showcase
  FOR SELECT TO authenticated
  USING (public.can_access_shop(shop_id));

DROP POLICY IF EXISTS shop_showcase_events_shop_read ON public.shop_showcase_events;
CREATE POLICY shop_showcase_events_shop_read ON public.shop_showcase_events
  FOR SELECT TO authenticated
  USING (public.can_access_shop(shop_id));
