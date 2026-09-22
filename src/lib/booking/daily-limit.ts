/**
 * "One booking per customer per day" rule, shared by the public `/book` route
 * and the LIFF pre-warn. Pure functions only — the authoritative check runs
 * server-side (app count + DB trigger `enforce_daily_booking_limit`, migration
 * 202609220002); the client uses the same helpers to grey the button early.
 *
 * Scope decided 2026-09-22: shop-wide (any service), opt-in per shop via
 * `shops.one_booking_per_day`, customers only (staff may override from the
 * portal). Cancelled / no-show bookings free the day; completed ones do not.
 */

import { formatThaiDateLabel } from '@/lib/utils/date-format';

/** `code` sent with the 409 so the LIFF can react (refresh "my bookings"). */
export const DAILY_LIMIT_CODE = 'daily_limit';

/** Statuses that do NOT occupy the day. Everything else counts, incl. completed. */
export const DAILY_LIMIT_FREE_STATUSES = ['cancelled', 'no_show'] as const;

/** Minimal booking shape both `/me` payloads and the server query satisfy. */
export type DailyLimitBooking = {
  booking_date: string;
  status: string;
};

/**
 * Whether a booking in this status still counts toward the daily limit.
 *
 * @param status - Booking status as stored in the database.
 */
export function countsTowardDailyLimit(status: string | null | undefined): boolean {
  return !(DAILY_LIMIT_FREE_STATUSES as readonly string[]).includes(String(status ?? ''));
}

/**
 * First booking the customer already holds on `dateIso`, or `null`.
 *
 * `booking_date` may arrive as `YYYY-MM-DD` or a full timestamp; only the date
 * part is compared.
 *
 * @param bookings - Customer's bookings (any status; filtered here).
 * @param dateIso - Day being booked, `YYYY-MM-DD` (Bangkok).
 */
export function findSameDayBooking<T extends DailyLimitBooking>(bookings: readonly T[], dateIso: string): T | null {
  if (!dateIso) return null;
  for (const b of bookings) {
    if (String(b.booking_date).slice(0, 10) === dateIso && countsTowardDailyLimit(b.status)) return b;
  }
  return null;
}

/**
 * Thai message shown when the limit blocks a booking.
 *
 * @param dateIso - Day the customer tried to book, for "วันที่ 25 ก.ย. 2569".
 */
export function dailyLimitMessage(dateIso?: string | null): string {
  const day = dateIso ? formatThaiDateLabel(dateIso) : '';
  const when = day && day !== '-' ? `วันที่ ${day}` : 'วันนี้';
  return `คุณมีคิวของ${when}อยู่แล้ว ร้านนี้จองได้วันละ 1 คิวค่ะ ดูคิวได้ที่แท็บ "คิวของฉัน"`;
}

/**
 * Whether a database insert error came from the `enforce_daily_booking_limit`
 * trigger (the race the app-side count cannot close).
 *
 * @param message - `error.message` from the failed insert.
 */
export function isDailyLimitDbError(message: string | null | undefined): boolean {
  return typeof message === 'string' && message.includes(DAILY_LIMIT_CODE);
}
