import { describe, expect, it } from 'vitest';
import {
  bookableMonths,
  buildMonthGrid,
  calendarEndDate,
  firstBookableDay,
  isDayBookable,
  monthHasBookableDay,
  type BookableDayRules,
} from './bookable-days';

// 2026-09-29 is a Tuesday.
const rules: BookableDayRules = {
  today: '2026-09-29',
  maxDate: '2026-10-29',
  openWeekdays: [1, 2, 3, 4, 5],
  holidays: ['2026-10-13'],
};

describe('isDayBookable', () => {
  it('accepts an open weekday inside the window', () => {
    expect(isDayBookable('2026-09-29', rules)).toBe(true);
    expect(isDayBookable('2026-10-29', rules)).toBe(true);
  });

  it('rejects days before today', () => {
    expect(isDayBookable('2026-09-28', rules)).toBe(false);
  });

  it('rejects days beyond the booking window', () => {
    expect(isDayBookable('2026-10-30', rules)).toBe(false);
  });

  it('rejects weekdays without working hours', () => {
    expect(isDayBookable('2026-10-03', rules)).toBe(false); // Saturday
    expect(isDayBookable('2026-10-04', rules)).toBe(false); // Sunday
  });

  it('rejects holidays', () => {
    expect(isDayBookable('2026-10-13', rules)).toBe(false);
  });

  it('rejects malformed dates', () => {
    expect(isDayBookable('', rules)).toBe(false);
    expect(isDayBookable('2026-10', rules)).toBe(false);
  });

  it('has no upper bound when the branch is unlimited', () => {
    expect(isDayBookable('2028-03-01', { ...rules, maxDate: null })).toBe(true);
  });
});

describe('calendarEndDate', () => {
  it('is the branch limit when set', () => {
    expect(calendarEndDate(rules)).toBe('2026-10-29');
  });

  it('falls back to a 12-month horizon when unlimited', () => {
    expect(calendarEndDate({ today: '2026-09-29', maxDate: null })).toBe('2027-09-29');
  });
});

describe('firstBookableDay', () => {
  it('returns today when today is bookable', () => {
    expect(firstBookableDay(rules)).toBe('2026-09-29');
  });

  it('skips closed days and holidays', () => {
    // Saturday → weekend closed, Monday is a holiday → Tuesday.
    expect(firstBookableDay({ ...rules, today: '2026-10-10', holidays: ['2026-10-12'] })).toBe('2026-10-13');
  });

  it('returns null when the branch has no working hours', () => {
    expect(firstBookableDay({ ...rules, openWeekdays: [] })).toBeNull();
  });

  it('returns null when the booking window already closed', () => {
    expect(firstBookableDay({ ...rules, maxDate: '2026-09-01' })).toBeNull();
  });
});

describe('buildMonthGrid', () => {
  it('pads the first week so day 1 sits under its weekday', () => {
    const grid = buildMonthGrid('2026-10'); // 1 Oct 2026 is a Thursday
    expect(grid.slice(0, 4)).toEqual([null, null, null, null]);
    expect(grid[4]).toBe('2026-10-01');
    expect(grid[grid.length - 1]).toBe('2026-10-31');
    expect(grid.filter(Boolean)).toHaveLength(31);
  });

  it('handles February in a leap year', () => {
    expect(buildMonthGrid('2028-02').filter(Boolean)).toHaveLength(29);
  });

  it('returns nothing for a malformed month', () => {
    expect(buildMonthGrid('2026')).toEqual([]);
  });
});

describe('bookableMonths', () => {
  it('lists every month from today to the limit', () => {
    expect(bookableMonths(rules)).toEqual(['2026-09', '2026-10']);
  });

  it('stops at the month of the limit', () => {
    expect(bookableMonths({ ...rules, maxDate: '2026-12-29' })).toEqual(['2026-09', '2026-10', '2026-11', '2026-12']);
  });

  it('drops a month with no bookable day', () => {
    // Today is the last day of the month and a Saturday → nothing left in October.
    expect(bookableMonths({ ...rules, today: '2026-10-31', maxDate: '2026-11-30' })).toEqual(['2026-11']);
  });

  it('covers 13 month keys when unlimited', () => {
    expect(bookableMonths({ ...rules, maxDate: null })).toHaveLength(13);
  });

  it('is empty when nothing can be booked', () => {
    expect(bookableMonths({ ...rules, openWeekdays: [] })).toEqual([]);
  });
});

describe('monthHasBookableDay', () => {
  it('is false for a month past the window', () => {
    expect(monthHasBookableDay('2026-11', rules)).toBe(false);
  });
});
