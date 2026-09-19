import type { SupabaseClient } from '@supabase/supabase-js';
import { pushPaymentReceipt } from '@/lib/payments/receipt';
import { safeCreateNotification } from '@/lib/notifications/createNotification';

/** Postgres unique_violation — here, the approved-transRef index. */
const UNIQUE_VIOLATION = '23505';

export type ApproveSlipFailure = 'not_pending' | 'duplicate_trans_ref' | 'booking_not_found' | 'db_error';

export type ApproveSlipResult = { ok: true; paidAt: string } | { ok: false; reason: ApproveSlipFailure };

export interface ApproveSlipOptions {
  slipId: string;
  bookingId: string;
  shopId: string;
  companyId: string;
  /** Portal user who approved, or null when the system approved on bank evidence. */
  reviewerId: string | null;
  amountClaimed: number | null;
  /** Present only for system approvals: what the bank confirmed. */
  auto?: { providerId: string; verifiedAmountTHB: number | null; transRef: string };
}

/** Receipt reference printed on the LINE receipt. */
export function slipReceiptRef(queueNumber: string): string {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `RCP-${queueNumber}-${today}`;
}

/**
 * Mark a pending slip approved and its booking paid.
 *
 * One code path for staff approval and bank-verified auto approval, so both
 * leave the same audit trail. The slip update is conditional on `pending` and
 * checked for an affected row: two reviewers (or a reviewer racing the auto
 * check) cannot both record a payment.
 *
 * The caller owns authorization — `shopId` must already be the caller's tenant.
 */
export async function approveSlip(admin: SupabaseClient, opts: ApproveSlipOptions): Promise<ApproveSlipResult> {
  const { data: booking } = await admin
    .from('bookings')
    .select('id,queue_number,payment_amount')
    .eq('id', opts.bookingId)
    .eq('shop_id', opts.shopId)
    .maybeSingle();
  if (!booking) return { ok: false, reason: 'booking_not_found' };

  const now = new Date().toISOString();
  const amount = Number(booking.payment_amount ?? 0);
  const isAuto = Boolean(opts.auto);

  const { data: updated, error: slipError } = await admin
    .from('payment_slips')
    .update({
      status: 'approved',
      reviewed_by: opts.reviewerId,
      reviewed_at: now,
      updated_by: opts.reviewerId,
      ...(isAuto ? { auto_approved: true } : {}),
    })
    .eq('id', opts.slipId)
    .eq('shop_id', opts.shopId)
    .eq('status', 'pending')
    .select('id');
  if (slipError) {
    if (slipError.code === UNIQUE_VIOLATION) return { ok: false, reason: 'duplicate_trans_ref' };
    console.error('[slip] approve error:', slipError.message);
    return { ok: false, reason: 'db_error' };
  }
  if (!updated || updated.length === 0) return { ok: false, reason: 'not_pending' };

  await admin
    .from('bookings')
    .update({
      payment_status: 'paid',
      paid_at: now,
      payment_verified_at: now,
      payment_verified_by: opts.reviewerId,
      payment_reject_reason: null,
    })
    .eq('id', booking.id)
    .eq('shop_id', opts.shopId);

  await admin.from('payment_transactions').insert({
    company_id: opts.companyId,
    shop_id: opts.shopId,
    booking_id: booking.id,
    slip_id: opts.slipId,
    method: 'bank_transfer',
    amount,
    currency: 'THB',
    status: 'successful',
    event_type: isAuto ? 'slip.auto_approved' : 'slip.approved',
    raw_event: isAuto
      ? { provider: opts.auto?.providerId, verified_amount: opts.auto?.verifiedAmountTHB, trans_ref: opts.auto?.transRef }
      : { reviewed_by: opts.reviewerId, amount_claimed: opts.amountClaimed },
    created_by: opts.reviewerId,
  });

  await admin.from('booking_logs').insert({
    company_id: opts.companyId,
    shop_id: opts.shopId,
    booking_id: booking.id,
    action: isAuto ? 'payment_slip_auto_approved' : 'payment_slip_approved',
    description: `Slip ${isAuto ? 'auto-approved' : 'approved'} for ${booking.queue_number} (${amount} THB)`,
    created_by: opts.reviewerId,
  });

  await safeCreateNotification(admin, {
    companyId: opts.companyId,
    shopId: opts.shopId,
    type: 'payment_verified',
    category: 'billing',
    title: isAuto ? 'ระบบยืนยันการชำระเงินอัตโนมัติ' : 'ยืนยันการชำระเงินแล้ว',
    message: `คิว ${booking.queue_number} ชำระ ${amount.toLocaleString('th-TH')} บาท เรียบร้อย`,
    relatedType: 'booking',
    relatedId: booking.id,
    ...(opts.reviewerId ? { createdBy: opts.reviewerId } : {}),
  });

  await pushPaymentReceipt(admin, {
    bookingId: booking.id,
    shopId: opts.shopId,
    receiptRef: slipReceiptRef(String(booking.queue_number)),
    paidAt: now,
  });

  return { ok: true, paidAt: now };
}
