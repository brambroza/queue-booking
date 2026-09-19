import type { SupabaseClient } from '@supabase/supabase-js';
import { decodeSlipQr } from './decode-image';
import { parseThaiSlipQr } from './slip-qr';
import { resolveSlipProvider } from './provider';
import { evaluateSlip, type SlipEvaluation, type SlipProviderOutcome } from './evaluate';

/** Slip states that still "hold" a transaction reference. Rejected/superseded slips release it. */
const LIVE_SLIP_STATUSES = ['pending', 'approved'];

export interface AutoVerifySlipOptions {
  slipId: string;
  bookingId: string;
  shopId: string;
  /** The stored image bytes — the same ones the reviewer will see. */
  imageBytes: Uint8Array;
  expectedAmountTHB: number;
  amountClaimedTHB: number | null;
  paymentExpiresAt: string | null;
}

export interface AutoVerifySlipResult {
  evaluation: SlipEvaluation;
  transRef: string | null;
}

/**
 * Is this transaction reference already attached to another live slip?
 *
 * Deliberately cross-tenant (service role): the same slip presented to two
 * different shops is exactly the fraud this exists to catch. Only a boolean
 * leaves this function, so nothing about the other tenant is disclosed.
 */
async function isDuplicateTransRef(
  admin: SupabaseClient,
  opts: { transRef: string; sendingBankCode: string; bookingId: string },
): Promise<boolean> {
  const { count, error } = await admin
    .from('payment_slips')
    .select('id', { count: 'exact', head: true })
    .eq('trans_ref', opts.transRef)
    .eq('sending_bank_code', opts.sendingBankCode)
    .in('status', LIVE_SLIP_STATUSES)
    .neq('booking_id', opts.bookingId)
    .eq('is_deleted', false);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

/**
 * Run the automatic checks on a freshly stored slip and persist the outcome.
 *
 * Never throws: a crash here must not fail the customer's upload, it just
 * leaves the slip in the manual queue with `auto_check_status = 'error'`.
 * Approval itself is the caller's job — this only reports `autoApprove`.
 */
export async function autoVerifySlip(admin: SupabaseClient, opts: AutoVerifySlipOptions): Promise<AutoVerifySlipResult> {
  const uploadedAt = new Date();
  try {
    const qrPayload = await decodeSlipQr(opts.imageBytes);
    const parsed = qrPayload ? parseThaiSlipQr(qrPayload) : null;
    const slip = parsed?.ok ? parsed.slip : null;

    const [duplicate, shopRow, bookingRow] = await Promise.all([
      slip
        ? isDuplicateTransRef(admin, { transRef: slip.transRef, sendingBankCode: slip.sendingBankCode, bookingId: opts.bookingId })
        : Promise.resolve(false),
      admin.from('shops').select('promptpay_id,bank_account_no').eq('id', opts.shopId).maybeSingle(),
      admin.from('bookings').select('created_at').eq('id', opts.bookingId).eq('shop_id', opts.shopId).maybeSingle(),
    ]);

    // Only spend a bank lookup on a slip that survived the free checks.
    let provider: SlipProviderOutcome | null = null;
    if (slip && slip.crcValid && !duplicate && qrPayload) {
      const source = await resolveSlipProvider(admin, opts.shopId);
      if (source) {
        try {
          provider = { id: source.id, result: await source.verify({ payload: qrPayload, transRef: slip.transRef }) };
        } catch (e) {
          console.error('[slip] provider error:', e instanceof Error ? e.message : e);
          provider = { id: source.id, error: 'provider_unavailable' };
        }
      }
    }

    const createdAt = bookingRow.data?.created_at ? new Date(String(bookingRow.data.created_at)) : null;
    const evaluation = evaluateSlip({
      qrPayload,
      parsed,
      duplicate,
      expectedAmountTHB: opts.expectedAmountTHB,
      amountClaimedTHB: opts.amountClaimedTHB,
      uploadedAt,
      paymentExpiresAt: opts.paymentExpiresAt ? new Date(opts.paymentExpiresAt) : null,
      bookingCreatedAt: createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt : null,
      receiverTargets: [shopRow.data?.promptpay_id, shopRow.data?.bank_account_no].filter(
        (v): v is string => typeof v === 'string' && v.length > 0,
      ),
      provider,
    });

    const { error } = await admin
      .from('payment_slips')
      .update({
        qr_payload: slip ? qrPayload : null,
        sending_bank_code: slip?.sendingBankCode ?? null,
        trans_ref: slip?.transRef ?? null,
        auto_check_status: evaluation.status,
        auto_check_result: { checks: evaluation.checks, provider: evaluation.providerId },
        auto_checked_at: uploadedAt.toISOString(),
        verified_amount: evaluation.verifiedAmountTHB,
      })
      .eq('id', opts.slipId)
      .eq('shop_id', opts.shopId);
    if (error) throw new Error(error.message);

    return { evaluation, transRef: slip?.transRef ?? null };
  } catch (e) {
    console.error('[slip] auto verify failed:', e instanceof Error ? e.message : e);
    await admin
      .from('payment_slips')
      .update({ auto_check_status: 'error', auto_checked_at: uploadedAt.toISOString() })
      .eq('id', opts.slipId)
      .eq('shop_id', opts.shopId);
    return {
      evaluation: { status: 'error', autoApprove: false, checks: [], verifiedAmountTHB: null, providerId: null },
      transRef: null,
    };
  }
}
