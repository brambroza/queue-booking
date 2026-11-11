/**
 * Pure rules for delivering the booking cards (confirmation + payment) to a
 * customer in one LINE call — by free reply to the booking echo when possible,
 * by a single push otherwise.
 */

/** LINE accepts at most 5 message objects per reply / push request. */
export const LINE_MAX_MESSAGES_PER_CALL = 5;

/**
 * Order and cap the cards for one LINE call: every confirmation card first
 * (one per queue of the order), the payment card last. When there are more
 * confirmations than fit, the later ones are dropped rather than the payment
 * card — the customer must always see how to pay.
 *
 * @param confirmCards - One Flex per queue, in start-time order.
 * @param paymentCard - The QR / bank-app card, or null when nothing is owed.
 */
export function packBookingMessages(confirmCards: readonly object[], paymentCard: object | null): object[] {
  const room = LINE_MAX_MESSAGES_PER_CALL - (paymentCard ? 1 : 0);
  const confirms = confirmCards.slice(0, Math.max(0, room));
  return paymentCard ? [...confirms, paymentCard] : [...confirms];
}

/**
 * Whether two queues were created by the same LIFF submit (multi-pick order):
 * same customer, same day, written within a few seconds of each other.
 *
 * @param a - `created_at` of one queue (ISO).
 * @param b - `created_at` of another (ISO).
 * @param toleranceMs - How far apart two inserts of one order may land.
 */
export function createdTogether(a: string, b: string, toleranceMs = 5_000): boolean {
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  if (Number.isNaN(ta) || Number.isNaN(tb)) return false;
  return Math.abs(ta - tb) <= toleranceMs;
}

/**
 * Whether a booking still needs its cards delivered: nothing has been sent
 * yet and the booking is recent enough that a late card is still useful.
 *
 * @param booking - `created_at` + `last_line_notify_at` of the paying / first queue.
 * @param now - Current time.
 * @param maxAgeMs - Oldest booking the fallback push is still allowed for.
 */
export function needsDelivery(
  booking: { created_at: string; last_line_notify_at: string | null },
  now: Date,
  maxAgeMs = 10 * 60_000,
): boolean {
  if (booking.last_line_notify_at) return false;
  const t = new Date(booking.created_at).getTime();
  if (Number.isNaN(t)) return false;
  return now.getTime() - t <= maxAgeMs;
}
