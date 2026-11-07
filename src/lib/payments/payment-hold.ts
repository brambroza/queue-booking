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

/** Shared with the restore rules so a restore can strip it. */
export const NOTE_MARKER = 'ยกเลิกอัตโนมัติ: เลยเวลาชำระเงิน';

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

// ── Order rebalance (customer cancels one queue of a multi-pick order) ──

/** Payment states where money (or a slip) already reached the shop — the amount is never changed then. */
export const PAYMENT_SETTLED_STATUSES = ['awaiting_verification', 'paid'] as const;

/** Booking statuses that no longer hold a seat (and no longer owe money). */
const INACTIVE_ORDER_STATUSES = new Set(['cancelled', 'no_show']);

/**
 * Whether a queue of an order still counts toward what the order owes.
 *
 * @param status - Booking status.
 */
export function isActiveOrderQueue(status: string | null | undefined): boolean {
  return !INACTIVE_ORDER_STATUSES.has(String(status));
}

/**
 * New amount for an order after some of its queues were cancelled.
 * Every queue of a multi-pick order costs the same (one price × slots, see `/book`),
 * so the amount scales with the number of queues still active. Rounded to satang.
 *
 * @param amount - Current amount owed by the order.
 * @param activeBefore - Queues the current amount was charged for.
 * @param activeAfter - Queues still active now.
 * @returns The new amount; 0 when nothing is left; the old amount when the inputs make no sense.
 */
export function rebalancedOrderAmount(amount: number, activeBefore: number, activeAfter: number): number {
  if (!(amount > 0) || !(activeBefore > 0) || activeAfter < 0 || activeAfter > activeBefore) return amount;
  if (activeAfter === 0) return 0;
  return Math.round((amount * activeAfter * 100) / activeBefore) / 100;
}

/**
 * Queue that pays for the order: the current payer while it is active, else the
 * earliest active queue (by start time) so the order stays payable.
 *
 * @param rows - Every queue of the order.
 * @param currentPayerId - `payment_hold_booking_id` of the order.
 * @returns The payer, or null when no queue is active.
 */
export function pickOrderPayer<T extends { id: string; start_time: string; status: string | null }>(
  rows: readonly T[],
  currentPayerId: string,
): T | null {
  const active = rows.filter((r) => isActiveOrderQueue(r.status));
  const current = active.find((r) => r.id === currentPayerId);
  if (current) return current;
  return [...active].sort((a, b) => a.start_time.localeCompare(b.start_time))[0] ?? null;
}

/** Note the `/book` route writes on the extra queues of a multi-pick order. */
export function orderSiblingNote(payerQueue: string): string {
  return `จองพร้อมคิว ${payerQueue} (ชำระรวมที่คิวนั้น)`;
}

/**
 * Point the "paid through queue X" note at the new payer, or drop it on the queue
 * that now pays itself. Other note content is kept.
 *
 * @param note - Current note.
 * @param oldPayerQueue - Queue number the note names now.
 * @param newPayerQueue - New payer's queue number, or null when this queue is the new payer.
 * @returns The new note (null when nothing is left).
 */
export function retargetOrderNote(
  note: string | null | undefined,
  oldPayerQueue: string,
  newPayerQueue: string | null,
): string | null {
  const current = (note ?? '').trim();
  const marker = orderSiblingNote(oldPayerQueue);
  if (!current.includes(marker)) return current || null;
  if (newPayerQueue) return current.replace(marker, orderSiblingNote(newPayerQueue));
  const rest = current
    .split(' | ')
    .map((part) => part.trim())
    .filter((part) => part && part !== marker);
  return rest.length > 0 ? rest.join(' | ') : null;
}

/**
 * What staff should be told before pressing "อนุมัติ" on a queue that has an
 * invoice: approving confirms the queue only — it never marks the money paid.
 *
 * @param paymentStatus - Booking payment status.
 * @param amount - Booking payment amount.
 * @returns `slip_pending` (slip waiting in the inbox), `unpaid` (nothing paid yet) or null.
 */
export function approvalPaymentWarning(
  paymentStatus: string | null | undefined,
  amount: number | null | undefined,
): 'slip_pending' | 'unpaid' | null {
  if (!(Number(amount ?? 0) > 0)) return null;
  if (paymentStatus === 'awaiting_verification') return 'slip_pending';
  if ((PAYMENT_HOLD_UNPAID_STATUSES as readonly string[]).includes(String(paymentStatus))) return 'unpaid';
  return null;
}

/**
 * Payment state as the customer should hear it (LINE "เช็คคิวของฉัน").
 *
 * @param paymentStatus - Payment status of the queue carrying the invoice.
 * @param amount - Its payment amount.
 * @returns `owed` / `in_review` / `paid`, or null when the queue has no invoice.
 */
export function customerPaymentState(
  paymentStatus: string | null | undefined,
  amount: number | null | undefined,
): 'owed' | 'in_review' | 'paid' | null {
  if (!(Number(amount ?? 0) > 0)) return null;
  if (paymentStatus === 'paid') return 'paid';
  if (paymentStatus === 'awaiting_verification') return 'in_review';
  if ((PAYMENT_HOLD_UNPAID_STATUSES as readonly string[]).includes(String(paymentStatus))) return 'owed';
  return null;
}
