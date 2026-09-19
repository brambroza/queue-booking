-- Automatic slip checks for bank-transfer payments.
--
-- On upload the server decodes the slip's verification QR (Bank of Thailand slip
-- profile, EMVCo TLV), validates its CRC, and looks for an earlier slip carrying
-- the same transaction reference. The outcome is stored here for the review
-- queue. A slip is only auto-approved on bank-side evidence (auto_check_status =
-- 'verified'); local checks alone never mark a booking paid.

ALTER TABLE public.payment_slips
  ADD COLUMN IF NOT EXISTS qr_payload text,
  ADD COLUMN IF NOT EXISTS sending_bank_code text,
  ADD COLUMN IF NOT EXISTS trans_ref text,
  ADD COLUMN IF NOT EXISTS auto_check_status text,
  ADD COLUMN IF NOT EXISTS auto_check_result jsonb,
  ADD COLUMN IF NOT EXISTS auto_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS auto_approved boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.payment_slips.trans_ref IS
  'Transaction reference decoded from the slip QR. NULL when no slip QR was readable.';
COMMENT ON COLUMN public.payment_slips.auto_check_status IS
  'verified (bank confirmed) | plausible (well-formed, unseen; amount NOT confirmed) | suspicious | unreadable | error';
COMMENT ON COLUMN public.payment_slips.verified_amount IS
  'Amount confirmed by the bank-side provider. NULL when no provider answered.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payment_slips_auto_check_status_check'
  ) THEN
    ALTER TABLE public.payment_slips
      ADD CONSTRAINT payment_slips_auto_check_status_check
      CHECK (auto_check_status IS NULL
        OR auto_check_status IN ('verified', 'plausible', 'suspicious', 'unreadable', 'error'));
  END IF;
END$$;

-- Duplicate lookup on upload (cross-tenant on purpose: one slip shown to two shops).
CREATE INDEX IF NOT EXISTS idx_payment_slips_trans_ref
  ON public.payment_slips(trans_ref, sending_bank_code)
  WHERE trans_ref IS NOT NULL;

-- Hard stop against double-spend: one bank transaction can settle one booking,
-- no matter how two approvals race. Rejected/superseded slips do not hold the
-- reference, so a customer can re-upload the same slip after a rejection.
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_slips_approved_trans_ref
  ON public.payment_slips(sending_bank_code, trans_ref)
  WHERE status = 'approved' AND trans_ref IS NOT NULL AND is_deleted = false;
