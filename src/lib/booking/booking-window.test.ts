import { describe, expect, it } from 'vitest';
import {
  addCalendarMonths,
  advanceWindowEnd,
  bookingWindowMessage,
  bookingWindowStartMessage,
  isBeforeBookingWindow,
  isBeyondBookingWindow,
  resolveMaxBookingDate,
  resolveMinBookingDate,
} from './booking-window';

const today = '2026-09-29';

describe('addCalendarMonths', () => {
  it('keeps the day of month', () => {
    expect(addCalendarMonths('2026-09-29', 1)).toBe('2026-10-29');
    expect(addCalendarMonths('2026-09-29', 3)).toBe('2026-12-29');
  });

  it('crosses the year boundary', () => {
    expect(addCalendarMonths('2026-11-15', 3)).toBe('2027-02-15');
  });

  it('clamps to the last day of a shorter month', () => {
    expect(addCalendarMonths('2027-01-31', 1)).toBe('2027-02-28');
    expect(addCalendarMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addCalendarMonths('2026-08-31', 1)).toBe('2026-09-30');
  });
});

describe('advanceWindowEnd', () => {
  it('counts days and weeks as fixed lengths', () => {
    expect(advanceWindowEnd(today, '7d')).toBe('2026-10-06');
    expect(advanceWindowEnd(today, '1w')).toBe('2026-10-06');
    expect(advanceWindowEnd(today, '2w')).toBe('2026-10-13');
  });

  it('counts months by the calendar, not 30 days', () => {
    expect(advanceWindowEnd(today, '1m')).toBe('2026-10-29');
    expect(advanceWindowEnd(today, '2m')).toBe('2026-11-29');
    expect(advanceWindowEnd(today, '3m')).toBe('2026-12-29');
  });

  it('returns null for empty or malformed codes', () => {
    expect(advanceWindowEnd(today, '')).toBeNull();
    expect(advanceWindowEnd(today, null)).toBeNull();
    expect(advanceWindowEnd(today, undefined)).toBeNull();
    expect(advanceWindowEnd(today, '0m')).toBeNull();
    expect(advanceWindowEnd(today, '1y')).toBeNull();
    expect(advanceWindowEnd(today, 'abc')).toBeNull();
    expect(advanceWindowEnd('not-a-date', '1m')).toBeNull();
  });
});

describe('resolveMaxBookingDate', () => {
  it('is unlimited when nothing is set', () => {
    expect(resolveMaxBookingDate(today, null)).toBeNull();
    expect(resolveMaxBookingDate(today, {})).toBeNull();
    expect(resolveMaxBookingDate(today, { booking_advance_window: null, booking_open_until: null })).toBeNull();
  });

  it('uses the rolling window alone', () => {
    expect(resolveMaxBookingDate(today, { booking_advance_window: '1m' })).toBe('2026-10-29');
  });

  it('uses the fixed end date alone', () => {
    expect(resolveMaxBookingDate(today, { booking_open_until: '2026-12-31' })).toBe('2026-12-31');
  });

  it('picks the earlier of the two', () => {
    expect(resolveMaxBookingDate(today, { booking_advance_window: '3m', booking_open_until: '2026-10-15' })).toBe('2026-10-15');
    expect(resolveMaxBookingDate(today, { booking_advance_window: '1w', booking_open_until: '2026-12-31' })).toBe('2026-10-06');
  });

  it('accepts a timestamp in the fixed end date and ignores garbage', () => {
    expect(resolveMaxBookingDate(today, { booking_open_until: '2026-12-31T00:00:00+07:00' })).toBe('2026-12-31');
    expect(resolveMaxBookingDate(today, { booking_open_until: 'soon' })).toBeNull();
  });

  it('keeps a fixed end date that already passed, so every day is refused', () => {
    expect(resolveMaxBookingDate(today, { booking_open_until: '2026-09-01' })).toBe('2026-09-01');
  });
});

describe('isBeyondBookingWindow', () => {
  it('never blocks without a limit', () => {
    expect(isBeyondBookingWindow('2030-01-01', null)).toBe(false);
    expect(isBeyondBookingWindow('2030-01-01', undefined)).toBe(false);
  });

  it('allows the last bookable date itself', () => {
    expect(isBeyondBookingWindow('2026-10-29', '2026-10-29')).toBe(false);
    expect(isBeyondBookingWindow('2026-10-28', '2026-10-29')).toBe(false);
  });

  it('blocks the day after', () => {
    expect(isBeyondBookingWindow('2026-10-30', '2026-10-29')).toBe(true);
  });
});

describe('bookingWindowMessage', () => {
  it('names the last bookable date', () => {
    expect(bookingWindowMessage('2026-10-29')).toContain('29');
  });
});

describe('resolveMinBookingDate', () => {
  it('has no lower bound when nothing is set', () => {
    expect(resolveMinBookingDate(today, null)).toBeNull();
    expect(resolveMinBookingDate(today, {})).toBeNull();
    expect(resolveMinBookingDate(today, { booking_open_from: null })).toBeNull();
  });

  it('returns the first bookable date while it is still ahead', () => {
    expect(resolveMinBookingDate(today, { booking_open_from: '2026-10-23' })).toBe('2026-10-23');
    expect(resolveMinBookingDate(today, { booking_open_from: '2026-10-23T00:00:00+07:00' })).toBe('2026-10-23');
  });

  it('is null once the date is today or past (the past check covers it)', () => {
    expect(resolveMinBookingDate(today, { booking_open_from: today })).toBeNull();
    expect(resolveMinBookingDate(today, { booking_open_from: '2026-09-01' })).toBeNull();
  });

  it('ignores garbage and a bad today', () => {
    expect(resolveMinBookingDate(today, { booking_open_from: 'soon' })).toBeNull();
    expect(resolveMinBookingDate('not-a-date', { booking_open_from: '2030-01-01' })).toBeNull();
  });

  it('does not affect the last bookable date', () => {
    expect(resolveMaxBookingDate(today, { booking_open_from: '2026-10-23', booking_open_until: '2026-10-25' })).toBe('2026-10-25');
  });
});

describe('isBeforeBookingWindow', () => {
  it('never blocks without a lower bound', () => {
    expect(isBeforeBookingWindow('2020-01-01', null)).toBe(false);
    expect(isBeforeBookingWindow('2020-01-01', undefined)).toBe(false);
  });

  it('allows the first date and later', () => {
    expect(isBeforeBookingWindow('2026-10-23', '2026-10-23')).toBe(false);
    expect(isBeforeBookingWindow('2026-10-24', '2026-10-23')).toBe(false);
  });

  it('blocks the day before', () => {
    expect(isBeforeBookingWindow('2026-10-22', '2026-10-23')).toBe(true);
  });
});

describe('bookingWindowStartMessage', () => {
  it('names the whole range when both ends are set', () => {
    const msg = bookingWindowStartMessage('2026-10-23', '2026-10-25');
    expect(msg).toContain('23');
    expect(msg).toContain('25');
    expect(msg).toContain('เฉพาะ');
  });

  it('names only the start when open-ended', () => {
    expect(bookingWindowStartMessage('2026-10-23', null)).toContain('ตั้งแต่');
  });
});
