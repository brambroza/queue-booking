-- What a shop allows the automatic slip check to do:
--   off           no bank-side lookup, staff check every slip by hand
--   check_only    bank-side lookup runs, staff still press approve (default)
--   auto_approve  a slip the bank fully confirms is approved by the system
--
-- Marking a booking paid without a human is opt-in. Run before the matching
-- deploy for the setting to save; without it the app reads check_only.
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS slip_auto_mode text NOT NULL DEFAULT 'check_only'
  CONSTRAINT shops_slip_auto_mode_check CHECK (slip_auto_mode IN ('off', 'check_only', 'auto_approve'));

COMMENT ON COLUMN public.shops.slip_auto_mode IS
  'Automatic slip check level: off | check_only | auto_approve. Local QR checks always run.';

-- Shops that already enabled their own vendor key set this up on a screen that
-- promised auto-approval, so they keep it. Everyone else opts in.
DO $$
BEGIN
  IF to_regclass('public.shop_slip_verify_providers') IS NOT NULL THEN
    UPDATE public.shops s
    SET slip_auto_mode = 'auto_approve'
    WHERE EXISTS (
      SELECT 1
      FROM public.shop_slip_verify_providers p
      WHERE p.shop_id = s.id
        AND p.enabled = true
        AND p.credentials_enc IS NOT NULL
        AND p.is_deleted = false
    );
  END IF;
END $$;
