/**
 * "Which days may the customer pick?" — rules behind the LIFF date calendar.
 *
 * The calendar shows only days that can actually be booked; everything else
 * is left blank so the customer never taps a day and gets told "closed"
 * (decided 2026-09-29). A day is bookable when it is
 *   * today or later,
 *   * within the branch's advance-booking window (see booking-window.ts),
 *   * a weekday the branch has working hours for, and
 *   * not a holiday of the shop / branch.
 *
 * This only decides what is SHOWN. The server stays the authority: `/slots`
 * and `/book` re-check every rule. A fully booked day is still shown — the
 * calendar does not know slot occupancy.
 *
 * Dates are Bangkok-local ISO `YYYY-MM-DD` strings; arithmetic is done in UTC
 * on those strings so nothing depends on the device timezone.
 */

import { addCalendarMonths } from '@/lib/booking/booking-window';

/** How many months ahead the calendar pages when the branch has no limit. */
export const UNLIMITED_HORIZON_MONTHS = 12;

/** Weekday header, Sunday first (matches `weekday` 0-6 in `working_hours`). */
export const WEEKDAY_LABELS_TH = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'] as const;

/** Everything the calendar needs to decide whether a day is shown. */
export type BookableDayRules = {
  /** Bangkok "today" from the server. */
  today: string;
  /** Last bookable date (inclusive); null = unlimited. */
  maxDate: string | null;
  /** Weekdays (0 = Sunday … 6 = Saturday) with active working hours. */
  openWeekdays: readonly number[];
  /** Holiday dates `YYYY-MM-DD` that apply to this branch. */
  holidays: readonly string[];
};

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Weekday of an ISO date, 0 = Sunday … 6 = Saturday. */
function weekdayOfIso(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getUTCDay();
}

/** Add whole days to an ISO date. */
function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Whether the customer may pick this day.
 *
 * @param iso - Day to test, `YYYY-MM-DD`.
 * @param rules - Branch rules from `/bookable-days`.
 */
export function isDayBookable(iso: string, rules: BookableDayRules): boolean {
  if (!ISO_RE.test(iso)) return false;
  if (iso < rules.today) return false;
  if (rules.maxDate && iso > rules.maxDate) return false;
  if (!rules.openWeekdays.includes(weekdayOfIso(iso))) return false;
  return !rules.holidays.includes(iso);
}

/**
 * Last date the calendar reaches: the branch's limit, or a fixed horizon when
 * the branch is unlimited (a calendar cannot page forever).
 *
 * @param rules - Branch rules from `/bookable-days`.
 */
export function calendarEndDate(rules: Pick<BookableDayRules, 'today' | 'maxDate'>): string {
  return rules.maxDate ?? addCalendarMonths(rules.today, UNLIMITED_HORIZON_MONTHS);
}

/**
 * First day the customer may pick, or `null` when the branch has none
 * (no working hours, or the booking window already closed).
 *
 * @param rules - Branch rules from `/bookable-days`.
 */
export function firstBookableDay(rules: BookableDayRules): string | null {
  const end = calendarEndDate(rules);
  for (let day = rules.today; day <= end; day = addDaysIso(day, 1)) {
    if (isDayBookable(day, rules)) return day;
  }
  return null;
}

/**
 * Whether a month holds at least one bookable day.
 *
 * @param month - Month key `YYYY-MM`.
 * @param rules - Branch rules from `/bookable-days`.
 */
export function monthHasBookableDay(month: string, rules: BookableDayRules): boolean {
  return buildMonthGrid(month).some((iso) => iso !== null && isDayBookable(iso, rules));
}

/**
 * Months the calendar can page through: from today's month to the month of
 * `calendarEndDate`, skipping months with no bookable day at all.
 *
 * @param rules - Branch rules from `/bookable-days`.
 * @returns Month keys `YYYY-MM`, ascending.
 */
export function bookableMonths(rules: BookableDayRules): string[] {
  const out: string[] = [];
  const endMonth = calendarEndDate(rules).slice(0, 7);
  for (let first = `${rules.today.slice(0, 7)}-01`; first.slice(0, 7) <= endMonth; first = addCalendarMonths(first, 1)) {
    const month = first.slice(0, 7);
    if (monthHasBookableDay(month, rules)) out.push(month);
  }
  return out;
}

/**
 * Cells of a month laid out Sunday-first: leading `null`s pad the first week,
 * then one ISO date per day.
 *
 * @param month - Month key `YYYY-MM`.
 * @returns Flat list of cells; length is not padded at the end.
 */
export function buildMonthGrid(month: string): Array<string | null> {
  if (!/^\d{4}-\d{2}$/.test(month)) return [];
  const [year, monthNo] = month.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(year, monthNo, 0)).getUTCDate();
  const cells: Array<string | null> = Array.from({ length: weekdayOfIso(`${month}-01`) }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(`${month}-${String(day).padStart(2, '0')}`);
  }
  return cells;
}

/**
 * Thai month title in the Buddhist era, e.g. "ตุลาคม 2569".
 *
 * @param month - Month key `YYYY-MM`.
 */
export function formatThaiMonthTitle(month: string): string {
  if (!/^\d{4}-\d{2}$/.test(month)) return month;
  const [year, monthNo] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNo - 1, 1, 12)).toLocaleDateString('th-TH', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
