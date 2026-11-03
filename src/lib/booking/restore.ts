/**
 * Restore a cancelled booking ("กู้คิวกลับ") — pure rules, no I/O.
 *
 * Main case: the payment-expiry cron cancelled a LIFF order, then the customer
 * paid late (or paid at the counter). Staff bring the queue back as
 * `confirmed`. Works for any cancelled booking that is not deleted, so a
 * cancellation pressed by mistake can be undone the same way.
 */

import { NOTE_MARKER as PAYMENT_EXPIRED_NOTE_MARKER } from '@/lib/payments/payment-hold';

export { PAYMENT_EXPIRED_NOTE_MARKER };

/** Marker appended when staff restore a booking. */
export const RESTORED_NOTE_MARKER = 'กู้คิวกลับโดยร้าน';

/** `booking_logs.action` written on restore. */
export const RESTORE_LOG_ACTION = 'restore_booking';

/** Error code when the booking day is already over. */
export const RESTORE_PAST_CODE = 'restore_past';

/** Status a restored booking gets. */
export const RESTORED_STATUS = 'confirmed';

export type RestoreCandidate = {
  status: string | null | undefined;
  booking_date: string;
  is_deleted?: boolean | null;
};

export type RestoreCheck = { ok: true } | { ok: false; reason: 'not_cancelled' | 'deleted' | 'past' };

/**
 * Whether staff may restore this booking now.
 *
 * @param row - Booking row.
 * @param today - Today `YYYY-MM-DD` in Asia/Bangkok. A booking for today can still be restored.
 */
export function checkRestorable(row: RestoreCandidate, today: string): RestoreCheck {
  if (row.is_deleted) return { ok: false, reason: 'deleted' };
  if (row.status !== 'cancelled') return { ok: false, reason: 'not_cancelled' };
  if (String(row.booking_date) < today) return { ok: false, reason: 'past' };
  return { ok: true };
}

/** Thai message for a refused restore. */
export function restoreRefusedMessage(reason: Exclude<RestoreCheck, { ok: true }>['reason']): string {
  switch (reason) {
    case 'deleted':
      return 'คิวนี้ถูกลบแล้ว กู้กลับไม่ได้';
    case 'past':
      return 'วันที่ของคิวนี้ผ่านไปแล้ว กู้กลับไม่ได้ กรุณาสร้างคิวใหม่';
    default:
      return 'กู้กลับได้เฉพาะคิวที่ถูกยกเลิก';
  }
}

/** True when the cron cancelled this booking because the payment deadline passed. */
export function isPaymentExpiredCancel(note: string | null | undefined): boolean {
  return String(note ?? '').includes(PAYMENT_EXPIRED_NOTE_MARKER);
}

/**
 * Note after a restore: drop the expiry marker (the queue is no longer
 * cancelled) and append the restore marker once. Staff text is kept.
 *
 * @param existing - Current `bookings.note`.
 */
export function restoredNote(existing: string | null | undefined): string {
  const parts = String(existing ?? '')
    .split(' | ')
    .map((p) => p.trim())
    .filter((p) => p && p !== PAYMENT_EXPIRED_NOTE_MARKER && p !== RESTORED_NOTE_MARKER);
  parts.push(RESTORED_NOTE_MARKER);
  return parts.join(' | ');
}

/**
 * Ids to restore together. A booking from a held LIFF order brings back every
 * cancelled queue of that order (same `payment_hold_booking_id`), because the
 * cron cancelled them as one; otherwise only the booking itself.
 *
 * @param target - The booking staff pressed restore on.
 * @param siblings - Rows sharing its hold id (may include the target).
 * @param today - Today in Asia/Bangkok; siblings already past are left out.
 */
export function restoreGroup<T extends RestoreCandidate & { id: string }>(target: T, siblings: T[], today: string): T[] {
  return [target, ...siblings.filter((s) => s.id !== target.id && checkRestorable(s, today).ok)];
}
