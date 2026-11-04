-- Paid add-ons sold outside the plans, and the first one: a Google Sheet as the
-- data source of the queue display (built for a veterinary hospital that runs
-- its queue in a sheet). The sheet only feeds the signage; it never writes to
-- bookings, so LIFF, LINE, quotas and reports are untouched.
--
-- Both tables are written by the service role only (API routes check the role
-- and the shop first): a shop must never switch on an add-on it has not bought.

CREATE TABLE IF NOT EXISTS public.shop_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  addon_key text NOT NULL CHECK (addon_key IN ('sheet_signage')),
  active boolean NOT NULL DEFAULT false,
  -- Last day the add-on is paid for (Bangkok date, inclusive). NULL = no end date.
  expires_on date,
  note text CHECK (note IS NULL OR char_length(note) <= 300),
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, addon_key)
);

CREATE TABLE IF NOT EXISTS public.signage_sheet_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  -- NULL = shop-wide (used when the display has no branch or the branch has no row).
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  spreadsheet_id text NOT NULL CHECK (spreadsheet_id ~ '^[A-Za-z0-9_-]{20,100}$'),
  -- Tab name; NULL = the first tab.
  sheet_name text CHECK (sheet_name IS NULL OR char_length(sheet_name) BETWEEN 1 AND 100),
  enabled boolean NOT NULL DEFAULT false,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_signage_sheet_sources_scope
  ON public.signage_sheet_sources (shop_id, COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid));

ALTER TABLE public.shop_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signage_sheet_sources ENABLE ROW LEVEL SECURITY;

-- Staff of the shop may read their own rows; no write policy on purpose.
DROP POLICY IF EXISTS shop_addons_shop_read ON public.shop_addons;
CREATE POLICY shop_addons_shop_read ON public.shop_addons
  FOR SELECT TO authenticated
  USING (public.can_access_shop(shop_id));

DROP POLICY IF EXISTS signage_sheet_sources_shop_read ON public.signage_sheet_sources;
CREATE POLICY signage_sheet_sources_shop_read ON public.signage_sheet_sources
  FOR SELECT TO authenticated
  USING (public.can_access_shop(shop_id));
