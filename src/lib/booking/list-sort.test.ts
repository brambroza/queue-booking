import { describe, expect, it } from 'vitest';
import {
  bookingOrderColumns,
  bookingSortFromValue,
  bookingSortToValue,
  DEFAULT_BOOKING_SORT,
  parseBookingSort,
  toggleBookingSort,
} from './list-sort';

describe('parseBookingSort', () => {
  it('defaults to datetime asc', () => {
    expect(parseBookingSort(null, null)).toEqual(DEFAULT_BOOKING_SORT);
    expect(parseBookingSort(undefined, undefined)).toEqual({ key: 'datetime', dir: 'asc' });
  });

  it('accepts the whitelisted keys and directions', () => {
    expect(parseBookingSort('queue', 'desc')).toEqual({ key: 'queue', dir: 'desc' });
    expect(parseBookingSort('datetime', 'desc')).toEqual({ key: 'datetime', dir: 'desc' });
  });

  it('ignores unknown values (never reaches the DB)', () => {
    expect(parseBookingSort('created_at; drop table', 'random')).toEqual(DEFAULT_BOOKING_SORT);
    expect(parseBookingSort('queue', 'DESC')).toEqual({ key: 'queue', dir: 'asc' });
  });
});

describe('bookingOrderColumns', () => {
  it('orders by date, time, queue for datetime', () => {
    expect(bookingOrderColumns({ key: 'datetime', dir: 'asc' })).toEqual([
      { column: 'booking_date', ascending: true },
      { column: 'start_time', ascending: true },
      { column: 'queue_number', ascending: true },
    ]);
  });

  it('puts queue_number first and follows the direction for tie-breakers', () => {
    expect(bookingOrderColumns({ key: 'queue', dir: 'desc' })).toEqual([
      { column: 'queue_number', ascending: false },
      { column: 'booking_date', ascending: false },
      { column: 'start_time', ascending: false },
    ]);
  });
});

describe('toggleBookingSort', () => {
  it('flips direction on the same key', () => {
    expect(toggleBookingSort({ key: 'datetime', dir: 'asc' }, 'datetime')).toEqual({ key: 'datetime', dir: 'desc' });
    expect(toggleBookingSort({ key: 'datetime', dir: 'desc' }, 'datetime')).toEqual({ key: 'datetime', dir: 'asc' });
  });

  it('starts ascending on a new key', () => {
    expect(toggleBookingSort({ key: 'datetime', dir: 'desc' }, 'queue')).toEqual({ key: 'queue', dir: 'asc' });
  });
});

describe('select value round-trip', () => {
  it('encodes and decodes every combination', () => {
    for (const key of ['datetime', 'queue'] as const) {
      for (const dir of ['asc', 'desc'] as const) {
        expect(bookingSortFromValue(bookingSortToValue({ key, dir }))).toEqual({ key, dir });
      }
    }
  });

  it('falls back to the default for garbage', () => {
    expect(bookingSortFromValue('nope')).toEqual(DEFAULT_BOOKING_SORT);
  });
});
