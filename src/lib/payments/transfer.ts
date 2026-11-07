import { createAdminClient } from '@/lib/supabase/admin';
import { maskPromptPayId } from './promptpay';
import { signBookingToken } from './tokens';
import type { ShopPaymentConfig } from './settings';

export interface TransferPaymentResult {
  qrImageUrl: string;
  expiresAt: string;
  amountTHB: number;
  payeeName: string | null;
  promptpayMasked: string | null;
  bankName: string | null;
  bankAccountNo: string | null;
  bankAccountName: string | null;
}

/**
 * URL of the shop-generated PromptPay PNG for a booking.
 *
 * The PNG is rendered from `bookings.payment_amount`, so the amount goes in the
 * URL as `a=`: LINE and the LIFF browser cache images by URL, and a re-issued
 * invoice with a new amount must not show the old QR. The route ignores `a`.
 *
 * @param bookingId - Booking that owes the money.
 * @param amountTHB - Amount the QR encodes (cache key only).
 */
export function buildPromptPayQrUrl(bookingId: string, amountTHB?: number | null): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '');
  const token = signBookingToken(bookingId);
  const suffix = token ? `&t=${token}` : '';
  const amount = Number(amountTHB ?? 0) > 0 ? `&a=${Number(amountTHB).toFixed(2)}` : '';
  return `${base}/api/payments/promptpay-qr?booking_id=${bookingId}${suffix}${amount}`;
}

/**
 * Issue a bank-transfer invoice for a booking.
 *
 * No external API is involved — the QR is generated from the shop's own
 * PromptPay id, so this only records the intent and the deadline. The money is
 * confirmed later by a staff member approving the uploaded slip.
 */
export async function createBookingTransferPayment(opts: {
  bookingId: string;
  shopId: string;
  companyId: string;
  amountTHB: number;
  config: ShopPaymentConfig;
  /** Keep this deadline instead of starting a new window (re-issue after a partial cancel). Ignored when past. */
  keepExpiresAt?: string | null;
}): Promise<TransferPaymentResult | null> {
  const { config } = opts;
  if (!config.promptpayId) return null;

  const admin = createAdminClient();
  const kept = opts.keepExpiresAt ? new Date(opts.keepExpiresAt).getTime() : NaN;
  const expiresAt = Number.isFinite(kept) && kept > Date.now()
    ? new Date(kept).toISOString()
    : new Date(Date.now() + config.transferWindowMinutes * 60_000).toISOString();
  const promptpayMasked = maskPromptPayId(config.promptpayId);

  const { error } = await admin
    .from('bookings')
    .update({
      payment_status: 'pending_payment',
      payment_method: 'bank_transfer',
      payment_amount: opts.amountTHB,
      payment_expires_at: expiresAt,
      payment_reject_reason: null,
    })
    .eq('id', opts.bookingId)
    .eq('shop_id', opts.shopId);

  if (error) {
    console.error('[transfer] booking update error:', error.message);
    return null;
  }

  await admin.from('payment_transactions').insert({
    company_id: opts.companyId,
    shop_id: opts.shopId,
    booking_id: opts.bookingId,
    method: 'bank_transfer',
    amount: opts.amountTHB,
    currency: 'THB',
    status: 'pending',
    event_type: 'transfer.invoice_created',
    // Never the raw PromptPay id — this row is readable by shop staff.
    raw_event: { promptpay_masked: promptpayMasked, amount: opts.amountTHB, expires_at: expiresAt },
  });

  return {
    qrImageUrl: buildPromptPayQrUrl(opts.bookingId, opts.amountTHB),
    expiresAt,
    amountTHB: opts.amountTHB,
    payeeName: config.promptpayDisplayName,
    promptpayMasked,
    bankName: config.bankName,
    bankAccountNo: config.bankAccountNo,
    bankAccountName: config.bankAccountName,
  };
}
