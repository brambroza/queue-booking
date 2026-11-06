/**
 * Small pure time helpers for the public sandbox. Everything is Bangkok-local
 * `HH:MM` / `YYYY-MM-DD` strings, the same shape the real booking flow uses,
 * and the clock is always passed in so tests never depend on the wall time.
 */

/** Minutes in a day; `00:00` as a close time means "end of day". */
export const DAY_MINUTES = 1440;

/**
 * `HH:MM` (or `HH:MM:SS`) to minutes since midnight.
 *
 * @param time - Time string such as "08:30".
 * @returns Minutes, or 0 when the string is not a time.
 */
export function toMinutes(time: string): number {
  const m = /^(\d{1,2}):(\d{2})/.exec(time.trim());
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * Minutes since midnight to `HH:MM`, clamped to 23:59 so a booking that runs
 * to midnight still has a valid same-day end time.
 *
 * @param minutes - Minutes since midnight.
 */
export function fromMinutes(minutes: number): string {
  const clamped = Math.min(Math.max(Math.trunc(minutes), 0), DAY_MINUTES - 1);
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`;
}

/**
 * Add whole days to an ISO date without touching the device time zone.
 *
 * @param iso - `YYYY-MM-DD`.
 * @param days - Days to add (may be negative).
 */
export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Bangkok-local date and time of an instant (no zone suffix), like the DB.
 *
 * @param at - Instant to convert.
 * @returns `{ date: 'YYYY-MM-DD', time: 'HH:MM:SS' }`.
 */
export function bangkokStamp(at: Date): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(at);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const hour = map.hour === '24' ? '00' : map.hour;
  return { date: `${map.year}-${map.month}-${map.day}`, time: `${hour}:${map.minute}:${map.second}` };
}
