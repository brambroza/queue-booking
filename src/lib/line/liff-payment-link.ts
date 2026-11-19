import { isBankAppMethod } from '@/lib/payments/mobile-banking/banks';
import { lateSlipEligibility } from '@/lib/payments/payment-hold';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The fields of a customer's queue that decide whether payment can be resumed. */
export type PayableBooking = {
  id: string;
  queue_number: string;
  payment_method?: string | null;
  payment_status?: string | null;
};

/** What the LIFF payment panel needs to resume a payment. */
export type PaymentResumeTarget = {
  booking_id: string;
  queue_number: string;
  payment_method: string;
};

/**
 * Which resume action a queue still offers.
 * `slip` = bank transfer waiting for a (new) slip; `bank_app` = bank-app payment not completed.
 *
 * @param b - Queue from `/me`.
 * @returns The action, or null when nothing is left to pay.
 */
export function paymentResumeKind(b: PayableBooking): 'slip' | 'bank_app' | null {
  if (b.payment_method === 'bank_transfer' && (b.payment_status === 'pending_payment' || b.payment_status === 'rejected')) {
    return 'slip';
  }
  if (isBankAppMethod(b.payment_method) && (b.payment_status === 'pending_payment' || b.payment_status === 'failed')) {
    return 'bank_app';
  }
  return null;
}

/**
 * Panel target for a queue, or null when it no longer owes anything.
 *
 * @param b - Queue from `/me`.
 */
export function paymentResumeTarget(b: PayableBooking): PaymentResumeTarget | null {
  const kind = paymentResumeKind(b);
  if (!kind) return null;
  return {
    booking_id: b.id,
    queue_number: b.queue_number,
    payment_method: kind === 'slip' ? 'bank_transfer' : (b.payment_method ?? 'bank_deeplink'),
  };
}

/**
 * `booking_id` from a payment Flex link (`?booking_id=` on the LIFF page).
 * Only a UUID is accepted; it is never trusted on its own — callers match it
 * against the customer's own queues from `/me`.
 *
 * @param search - `window.location.search`.
 * @returns The id, or null when absent or malformed.
 */
export function readLinkedBookingId(search: string): string | null {
  const id = new URLSearchParams(search).get('booking_id')?.trim() ?? '';
  return UUID_RE.test(id) ? id.toLowerCase() : null;
}

/**
 * Queue to open the payment panel for, when the customer arrived from a payment Flex button.
 *
 * @param linkedId - From `readLinkedBookingId`.
 * @param bookings - The customer's own upcoming queues (`/me`).
 * @returns The target, or null when the queue is not theirs or is already paid / cancelled.
 */
export function pickLinkedPaymentTarget(linkedId: string | null, bookings: readonly PayableBooking[]): PaymentResumeTarget | null {
  if (!linkedId) return null;
  const match = bookings.find((b) => b.id.toLowerCase() === linkedId);
  return match ? paymentResumeTarget(match) : null;
}

/**
 * Whether a queue the payment cron cancelled still offers "โอนแล้ว ส่งสลิป":
 * a bank transfer that was never paid, for today or later. The slip route then
 * brings the queue back when the seat is still free.
 *
 * @param b - Queue from `/me` (history).
 * @param today - Today `YYYY-MM-DD` in Asia/Bangkok (from `/me`); empty = unknown, no button.
 */
export function canSendLateSlip(
  b: PayableBooking & { status?: string | null; note?: string | null; booking_date?: string | null },
  today: string,
): boolean {
  if (!today || !b.booking_date || String(b.booking_date) < today) return false;
  if (b.payment_method !== 'bank_transfer') return false;
  if (b.payment_status !== 'pending_payment' && b.payment_status !== 'rejected') return false;
  return lateSlipEligibility(b.status, b.note) === 'late';
}
