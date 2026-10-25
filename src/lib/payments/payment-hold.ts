/**
 * Payment hold rules (pure, no I/O).
 *
 * A LIFF booking that has to be paid online starts as `pending_approval` with
 * `bookings.payment_hold_booking_id` set, instead of `confirmed`. Paying turns
 * it `confirmed`; letting the deadline pass cancels it so the seat goes back
 * on sale. Shops without an online payment method never see a hold.
 */

/** Payment states that still owe money. `awaiting_verification` (slip in review) and `paid` are not here. */
export const PAYMENT_HOLD_UNPAID_STATUSES = ['pending_payment', 'failed', 'rejected'] as const;

/**
 * Minutes after `payment_expires_at` before the hold is cancelled — covers a
 * bank or Omise confirmation that lands a little after the countdown.
 */
export const PAYMENT_EXPIRY_GRACE_MINUTES = 5;

/** `booking_logs.action` written when the cron cancels an unpaid hold. */
export const PAYMENT_EXPIRED_LOG_ACTION = 'cancel_payment_expired';

const NOTE_MARKER = 'ยกเลิกอัตโนมัติ: เลยเวลาชำระเงิน';

/**
 * Whether a new LIFF booking should be held until it is paid.
 * Only a booking that would otherwise be confirmed straight away is held — a
 * service that already needs the shop's approval keeps its own flow.
 *
 * An invoice without a deadline is never held — nothing would ever release it.
 *
 * @param initialStatus - Status from `resolveInitialBookingStatus`.
 * @param paymentWithDeadline - True when an invoice / charge with `expiresAt` was created for the booking.
 */
export function shouldHoldForPayment(initialStatus: string, paymentWithDeadline: boolean): boolean {
  return paymentWithDeadline && initialStatus === 'confirmed';
}

export type PaymentHoldRow = {
  id: string;
  status: string | null;
  payment_status: string | null;
  payment_expires_at: string | null;
  payment_hold_booking_id: string | null;
};

/**
 * Whether the cron should cancel this order now. Only the paying booking of an
 * order (hold id = its own id) carries the deadline; the other queues follow it.
 *
 * @param row - Booking row (the paying one).
 * @param now - Current time.
 * @param graceMinutes - Extra minutes after the deadline.
 */
export function isPaymentHoldExpired(row: PaymentHoldRow, now: Date, graceMinutes = PAYMENT_EXPIRY_GRACE_MINUTES): boolean {
  if (!row.payment_hold_booking_id || row.payment_hold_booking_id !== row.id) return false;
  if (row.status !== 'pending_approval') return false;
  if (!(PAYMENT_HOLD_UNPAID_STATUSES as readonly string[]).includes(String(row.payment_status))) return false;
  if (!row.payment_expires_at) return false;
  const deadline = new Date(row.payment_expires_at).getTime();
  if (Number.isNaN(deadline)) return false;
  return now.getTime() > deadline + graceMinutes * 60_000;
}

/**
 * Whether the customer still has to pay before the queue counts (LIFF wording).
 * Inferred from the status pair because `/me` does not read the hold column.
 *
 * @param status - Booking status.
 * @param paymentStatus - Booking payment status.
 */
export function isAwaitingPayment(status: string | null | undefined, paymentStatus: string | null | undefined): boolean {
  return status === 'pending_approval' && (PAYMENT_HOLD_UNPAID_STATUSES as readonly string[]).includes(String(paymentStatus));
}

/**
 * Append the expiry marker to `bookings.note`, keeping what staff wrote.
 * Calling twice does not duplicate it.
 *
 * @param existing - Current note.
 */
export function appendPaymentExpiredNote(existing: string | null | undefined): string {
  const current = (existing ?? '').trim();
  if (!current) return NOTE_MARKER;
  if (current === NOTE_MARKER || current.endsWith(` | ${NOTE_MARKER}`)) return current;
  return `${current} | ${NOTE_MARKER}`;
}
