import { describe, expect, it } from 'vitest';
import {
  countsTowardDailyLimit,
  dailyLimitMessage,
  findSameDayBooking,
  isDailyLimitDbError,
} from './daily-limit';

describe('countsTowardDailyLimit', () => {
  it('frees the day for cancelled and no_show', () => {
    expect(countsTowardDailyLimit('cancelled')).toBe(false);
    expect(countsTowardDailyLimit('no_show')).toBe(false);
  });

  it('counts every live status and completed', () => {
    for (const s of ['pending', 'pending_approval', 'confirmed', 'checked_in', 'waiting', 'called', 'serving', 'completed']) {
      expect(countsTowardDailyLimit(s)).toBe(true);
    }
  });

  it('treats unknown / missing status as counting (fail closed)', () => {
    expect(countsTowardDailyLimit(undefined)).toBe(true);
    expect(countsTowardDailyLimit('')).toBe(true);
  });
});

describe('findSameDayBooking', () => {
  const bookings = [
    { id: 'a', booking_date: '2026-09-22', status: 'cancelled' },
    { id: 'b', booking_date: '2026-09-23', status: 'confirmed' },
    { id: 'c', booking_date: '2026-09-22T00:00:00+07:00', status: 'completed' },
  ];

  it('ignores cancelled bookings on that day', () => {
    expect(findSameDayBooking(bookings.slice(0, 2), '2026-09-22')).toBeNull();
  });

  it('finds a completed booking and compares only the date part', () => {
    expect(findSameDayBooking(bookings, '2026-09-22')?.id).toBe('c');
  });

  it('returns null for another day or a blank date', () => {
    expect(findSameDayBooking(bookings, '2026-09-24')).toBeNull();
    expect(findSameDayBooking(bookings, '')).toBeNull();
  });
});

describe('dailyLimitMessage', () => {
  it('names the day when given one', () => {
    expect(dailyLimitMessage('2026-09-25')).toContain('วันที่ 25 ก.ย.');
  });

  it('falls back to "วันนี้" without a date', () => {
    expect(dailyLimitMessage()).toContain('คิวของวันนี้');
  });
});

describe('isDailyLimitDbError', () => {
  it('recognises the trigger message and nothing else', () => {
    expect(isDailyLimitDbError('daily_limit')).toBe(true);
    expect(isDailyLimitDbError('P0001: daily_limit')).toBe(true);
    expect(isDailyLimitDbError('duplicate key value')).toBe(false);
    expect(isDailyLimitDbError(null)).toBe(false);
  });
});
