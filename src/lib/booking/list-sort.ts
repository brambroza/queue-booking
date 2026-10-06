/**
 * Sort options for the portal bookings list (`GET /api/bookings`).
 *
 * `datetime` = booking_date, start_time, queue_number (the default, the day's order of service).
 * `queue`    = queue_number first, then booking_date / start_time — queue numbers reset daily
 *              per branch, so this is meaningful mainly with a single-day filter.
 */

export const BOOKING_SORT_KEYS = ['datetime', 'queue'] as const;
export type BookingSortKey = (typeof BOOKING_SORT_KEYS)[number];

export const BOOKING_SORT_DIRS = ['asc', 'desc'] as const;
export type BookingSortDir = (typeof BOOKING_SORT_DIRS)[number];

export type BookingSort = { key: BookingSortKey; dir: BookingSortDir };

export const DEFAULT_BOOKING_SORT: BookingSort = { key: 'datetime', dir: 'asc' };

/** Column names sent to PostgREST `.order()`; whitelisted here so query params never reach the DB raw. */
export type BookingOrderColumn = 'booking_date' | 'start_time' | 'queue_number';

/**
 * Parse `sort` / `dir` query params, falling back to the default for anything unknown.
 */
export function parseBookingSort(sort: string | null | undefined, dir: string | null | undefined): BookingSort {
  const key = (BOOKING_SORT_KEYS as readonly string[]).includes(sort ?? '') ? (sort as BookingSortKey) : DEFAULT_BOOKING_SORT.key;
  const direction = (BOOKING_SORT_DIRS as readonly string[]).includes(dir ?? '') ? (dir as BookingSortDir) : DEFAULT_BOOKING_SORT.dir;
  return { key, dir: direction };
}

/**
 * Ordered list of `{ column, ascending }` to apply in sequence. The tie-breakers follow
 * the primary direction so a descending list reads top-down as "latest first".
 */
export function bookingOrderColumns(sort: BookingSort): Array<{ column: BookingOrderColumn; ascending: boolean }> {
  const ascending = sort.dir === 'asc';
  const columns: BookingOrderColumn[] =
    sort.key === 'queue' ? ['queue_number', 'booking_date', 'start_time'] : ['booking_date', 'start_time', 'queue_number'];
  return columns.map((column) => ({ column, ascending }));
}

/**
 * Flip the direction when the same key is clicked again; a new key starts ascending.
 */
export function toggleBookingSort(current: BookingSort, key: BookingSortKey): BookingSort {
  if (current.key !== key) return { key, dir: 'asc' };
  return { key, dir: current.dir === 'asc' ? 'desc' : 'asc' };
}

/** Compact `key_dir` form used by the phone select. */
export type BookingSortValue = `${BookingSortKey}_${BookingSortDir}`;

export function bookingSortToValue(sort: BookingSort): BookingSortValue {
  return `${sort.key}_${sort.dir}`;
}

export function bookingSortFromValue(value: string): BookingSort {
  const [key, dir] = value.split('_');
  return parseBookingSort(key, dir);
}
