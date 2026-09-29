/**
 * "How far ahead may this branch be booked?" — shared by the public `/slots`
 * and `/book` routes, the portal bookings route and the LIFF date picker, so
 * the picker's maximum and the server's refusal never disagree.
 *
 * Scope decided 2026-09-29: per branch, opt-in, and the SAME rule for staff
 * booking from the portal as for customers on LIFF. Two independent limits,
 * both on `branches` (migration 202609290002):
 *   * `booking_advance_window` — rolling, e.g. `1w`, `1m`, `3m`. Months are
 *     calendar months (29 Sep + 1 month = 29 Oct), not 30 days.
 *   * `booking_open_until`     — fixed last bookable date.
 * When both are set the earlier one wins. Neither set = unlimited.
 *
 * All dates are Bangkok-local ISO `YYYY-MM-DD` strings and the arithmetic is
 * done in UTC on those strings, so nothing depends on the process timezone.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { formatThaiDateLabel } from '@/lib/utils/date-format';

/** `code` sent with the 400 so the LIFF can tell this apart from a past slot. */
export const BOOKING_WINDOW_CODE = 'beyond_booking_window';

/** Stored format of `branches.booking_advance_window`: count + d/w/m. */
export const ADVANCE_WINDOW_RE = /^([1-9]\d?)([dwm])$/;

/** Presets offered in the portal branch form; '' = unlimited. */
export const ADVANCE_WINDOW_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '', label: 'ไม่จำกัด' },
  { value: '1w', label: '1 สัปดาห์' },
  { value: '2w', label: '2 สัปดาห์' },
  { value: '1m', label: '1 เดือน' },
  { value: '2m', label: '2 เดือน' },
  { value: '3m', label: '3 เดือน' },
  { value: '6m', label: '6 เดือน' },
];

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

/** The two branch columns that bound how far ahead a booking may be made. */
export type BookingWindowSettings = {
  booking_advance_window?: string | null;
  booking_open_until?: string | null;
};

/**
 * Add calendar months to an ISO date, clamping to the last day of the target
 * month (31 Jan + 1 month = 28/29 Feb) instead of spilling into the next one.
 *
 * @param iso - Start date `YYYY-MM-DD`.
 * @param months - Whole months to add (>= 0).
 * @returns Resulting date `YYYY-MM-DD`.
 */
export function addCalendarMonths(iso: string, months: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

/**
 * Last bookable date implied by a rolling window, counted from `todayIso`.
 *
 * @param todayIso - Bangkok "today" `YYYY-MM-DD`, from the server clock.
 * @param window - Stored window code (`7d`, `1w`, `3m`); anything else = no limit.
 * @returns Last bookable date (inclusive), or `null` when the code is empty/invalid.
 */
export function advanceWindowEnd(todayIso: string, window: string | null | undefined): string | null {
  if (!ISO_RE.test(todayIso)) return null;
  const match = ADVANCE_WINDOW_RE.exec(String(window ?? '').trim());
  if (!match) return null;
  const count = Number(match[1]);
  const unit = match[2];
  if (unit === 'm') return addCalendarMonths(todayIso, count);
  const days = unit === 'w' ? count * 7 : count;
  const d = new Date(`${todayIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Last date (inclusive) this branch accepts bookings for, or `null` = unlimited.
 * The earlier of the rolling window and the fixed end date wins.
 *
 * @param todayIso - Bangkok "today" `YYYY-MM-DD`, from the server clock.
 * @param settings - The branch's two window columns.
 */
export function resolveMaxBookingDate(todayIso: string, settings: BookingWindowSettings | null | undefined): string | null {
  if (!settings) return null;
  const rolling = advanceWindowEnd(todayIso, settings.booking_advance_window);
  const rawFixed = String(settings.booking_open_until ?? '').slice(0, 10);
  const fixed = ISO_RE.test(rawFixed) ? rawFixed : null;
  if (rolling && fixed) return rolling < fixed ? rolling : fixed;
  return rolling ?? fixed;
}

/**
 * Whether `dateIso` lies past the branch's last bookable date.
 *
 * @param dateIso - Day being booked, `YYYY-MM-DD`.
 * @param maxDate - Result of `resolveMaxBookingDate`; `null` never blocks.
 */
export function isBeyondBookingWindow(dateIso: string, maxDate: string | null | undefined): boolean {
  if (!maxDate) return false;
  return String(dateIso).slice(0, 10) > maxDate;
}

/**
 * Thai message shown when the chosen day is past the branch's booking window.
 *
 * @param maxDate - Last bookable date, for "จองได้ถึงวันที่ 29 ต.ค. 2569".
 */
export function bookingWindowMessage(maxDate: string): string {
  return `สาขานี้เปิดจองล่วงหน้าได้ถึงวันที่ ${formatThaiDateLabel(maxDate)} กรุณาเลือกวันใหม่`;
}

/**
 * Read a branch's booking-window columns.
 *
 * The columns ship in migration 202609290002. Until that has run the query
 * errors, and this sits on the booking flow — so a failure resolves to "no
 * limit" rather than blocking bookings the shop never asked to block.
 *
 * @param client - Supabase client already allowed to read this shop.
 * @param shopId - Tenant scope; the branch must belong to this shop.
 * @param branchId - Branch being booked.
 * @returns The two columns, or `null` when unset / unreadable.
 */
export async function getBranchBookingWindow(
  client: SupabaseClient,
  shopId: string,
  branchId: string,
): Promise<BookingWindowSettings | null> {
  const { data, error } = await client
    .from('branches')
    .select('booking_advance_window,booking_open_until')
    .eq('id', branchId)
    .eq('shop_id', shopId)
    .maybeSingle();
  if (error || !data) return null;
  return data as BookingWindowSettings;
}

/**
 * Booking-window columns for every branch of a shop, keyed by branch id.
 * Same defensive read as `getBranchBookingWindow`: an error yields an empty map.
 *
 * @param client - Supabase client already allowed to read this shop.
 * @param shopId - Shop whose branches to read.
 */
export async function getShopBookingWindows(
  client: SupabaseClient,
  shopId: string,
): Promise<Map<string, BookingWindowSettings>> {
  const out = new Map<string, BookingWindowSettings>();
  const { data, error } = await client
    .from('branches')
    .select('id,booking_advance_window,booking_open_until')
    .eq('shop_id', shopId)
    .eq('is_deleted', false);
  if (error || !data) return out;
  for (const row of data as Array<BookingWindowSettings & { id: string }>) {
    out.set(row.id, { booking_advance_window: row.booking_advance_window, booking_open_until: row.booking_open_until });
  }
  return out;
}
