import type { SupabaseClient } from '@supabase/supabase-js';
import { decodeSlipQr } from './decode-image';
import { parseThaiSlipQr } from './slip-qr';
import { resolveSlipProvider } from './provider';
import { evaluateSlip, type SlipEvaluation, type SlipProviderOutcome } from './evaluate';
import { nextRecheckAt, shouldRecheck } from './recheck';
import { notifySlipProviderProblemOnce } from './notify-provider';
import { SlipProviderError } from './providers/types';

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

export interface VerifySlipPayloadOptions {
  slipId: string;
  bookingId: string;
  shopId: string;
  companyId: string | null;
  /** Text decoded from the slip image, or null when no QR was readable. */
  qrPayload: string | null;
  expectedAmountTHB: number;
  amountClaimedTHB: number | null;
  paymentExpiresAt: string | null;
  /** When the customer uploaded — the "late" rule is judged against this, not against a later recheck. */
  uploadedAt: Date;
  /** Attempts already made before this one. 0 on upload. */
  attempt: number;
}

export interface AutoVerifySlipResult {
  evaluation: SlipEvaluation;
  transRef: string | null;
}

const ERROR_EVALUATION: SlipEvaluation = {
  status: 'error',
  autoApprove: false,
  checks: [],
  verifiedAmountTHB: null,
  providerId: null,
  source: null,
  retryReason: null,
};

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
 * Everything after the image: duplicate check, bank-side lookup, evaluation,
 * persistence and recheck scheduling. Shared by the upload route (attempt 0)
 * and the recheck cron (attempt ≥ 1), which re-uses the stored `qr_payload`.
 *
 * Never throws: a crash leaves the slip in the manual queue with
 * `auto_check_status = 'error'`. Approval itself is the caller's job.
 */
export async function verifySlipPayload(admin: SupabaseClient, opts: VerifySlipPayloadOptions): Promise<AutoVerifySlipResult> {
  const now = new Date();
  try {
    const qrPayload = opts.qrPayload;
    const parsed = qrPayload ? parseThaiSlipQr(qrPayload) : null;
    const slip = parsed?.ok ? parsed.slip : null;

    const [duplicate, shopRow, bookingRow] = await Promise.all([
      slip
        ? isDuplicateTransRef(admin, { transRef: slip.transRef, sendingBankCode: slip.sendingBankCode, bookingId: opts.bookingId })
        : Promise.resolve(false),
      admin.from('shops').select('promptpay_id,bank_account_no').eq('id', opts.shopId).maybeSingle(),
      admin.from('bookings').select('created_at,is_demo').eq('id', opts.bookingId).eq('shop_id', opts.shopId).maybeSingle(),
    ]);
    const isDemo = bookingRow.data?.is_demo === true;

    // Only spend a bank lookup on a slip that survived the free checks, and
    // never on demo bookings — they would burn the platform's quota.
    let provider: SlipProviderOutcome | null = null;
    let hadProvider = false;
    if (slip && slip.crcValid && !duplicate && qrPayload && !isDemo) {
      const source = await resolveSlipProvider(admin, opts.shopId);
      if (source) {
        hadProvider = true;
        try {
          provider = { id: source.id, source: source.source, result: await source.verify({ payload: qrPayload, transRef: slip.transRef }) };
        } catch (e) {
          const code = e instanceof SlipProviderError ? e.code : undefined;
          console.error('[slip] provider error:', source.id, code ?? (e instanceof Error ? e.message : e));
          provider = { id: source.id, source: source.source, error: 'provider_unavailable', code };
          if ((code === 'quota_exceeded' || code === 'invalid_api_key') && opts.companyId) {
            await notifySlipProviderProblemOnce(admin, {
              companyId: opts.companyId,
              shopId: opts.shopId,
              source: source.source,
              provider: source.id,
              code,
              now,
            });
          }
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
      uploadedAt: opts.uploadedAt,
      paymentExpiresAt: opts.paymentExpiresAt ? new Date(opts.paymentExpiresAt) : null,
      bookingCreatedAt: createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt : null,
      receiverTargets: [shopRow.data?.promptpay_id, shopRow.data?.bank_account_no].filter(
        (v): v is string => typeof v === 'string' && v.length > 0,
      ),
      provider,
    });

    const bank = provider && 'result' in provider && provider.result.found
      ? {
          amountTHB: provider.result.amountTHB,
          senderName: provider.result.senderName,
          senderBank: provider.result.senderBank,
          receiverName: provider.result.receiverName,
          receiverAccount: provider.result.receiverAccount,
          receiverProxy: provider.result.receiverProxy,
          transferredAt: provider.result.transferredAt,
        }
      : null;

    const attemptsMade = opts.attempt + 1;
    const recheck = shouldRecheck({ evaluation, attempt: attemptsMade - 1, hadProvider }) ? nextRecheckAt(now, attemptsMade - 1) : null;

    const { error } = await admin
      .from('payment_slips')
      .update({
        qr_payload: slip ? qrPayload : null,
        sending_bank_code: slip?.sendingBankCode ?? null,
        trans_ref: slip?.transRef ?? null,
        auto_check_status: evaluation.status,
        auto_check_result: {
          checks: evaluation.checks,
          provider: evaluation.providerId,
          source: evaluation.source,
          bank,
          attempt: attemptsMade,
        },
        auto_checked_at: now.toISOString(),
        verified_amount: evaluation.verifiedAmountTHB,
        provider_recheck_count: attemptsMade,
        next_recheck_at: recheck ? recheck.toISOString() : null,
      })
      .eq('id', opts.slipId)
      .eq('shop_id', opts.shopId);
    if (error) throw new Error(error.message);

    return { evaluation, transRef: slip?.transRef ?? null };
  } catch (e) {
    console.error('[slip] auto verify failed:', e instanceof Error ? e.message : e);
    await admin
      .from('payment_slips')
      .update({ auto_check_status: 'error', auto_checked_at: now.toISOString(), next_recheck_at: null })
      .eq('id', opts.slipId)
      .eq('shop_id', opts.shopId);
    return { evaluation: ERROR_EVALUATION, transRef: null };
  }
}

/**
 * Run the automatic checks on a freshly stored slip and persist the outcome.
 *
 * Never throws: a crash here must not fail the customer's upload, it just
 * leaves the slip in the manual queue with `auto_check_status = 'error'`.
 * Approval itself is the caller's job — this only reports `autoApprove`.
 */
export async function autoVerifySlip(
  admin: SupabaseClient,
  opts: AutoVerifySlipOptions & { companyId?: string | null },
): Promise<AutoVerifySlipResult> {
  const uploadedAt = new Date();
  let qrPayload: string | null = null;
  try {
    qrPayload = await decodeSlipQr(opts.imageBytes);
  } catch (e) {
    console.error('[slip] qr decode failed:', e instanceof Error ? e.message : e);
  }
  return verifySlipPayload(admin, {
    slipId: opts.slipId,
    bookingId: opts.bookingId,
    shopId: opts.shopId,
    companyId: opts.companyId ?? null,
    qrPayload,
    expectedAmountTHB: opts.expectedAmountTHB,
    amountClaimedTHB: opts.amountClaimedTHB,
    paymentExpiresAt: opts.paymentExpiresAt,
    uploadedAt,
    attempt: 0,
  });
}
