import { describe, expect, it } from 'vitest';
import { CapacityModel, hourlyCapacityForRow, seatsPerSlot, timeToMinutes, type WorkingHoursRow } from './capacity';

const A = 'aaaaaaaa-0000-0000-0000-000000000001';
const B = 'bbbbbbbb-0000-0000-0000-000000000002';

/** Seats per slot used by most cases below. */
const SEATS = 2;

/** Mon–Sun 09:00–18:00 with a 12:00–13:00 break, 30-min slots. */
function fullWeek(branchId: string | null): WorkingHoursRow[] {
  return Array.from({ length: 7 }, (_, weekday) => ({
    branch_id: branchId,
    weekday,
    open_time: '09:00:00',
    close_time: '18:00:00',
    break_start: '12:00:00',
    break_end: '13:00:00',
    slot_interval_minutes: 30,
  }));
}

describe('timeToMinutes', () => {
  it('parses HH:MM and HH:MM:SS', () => {
    expect(timeToMinutes('09:30')).toBe(570);
    expect(timeToMinutes('18:00:00')).toBe(1080);
  });
});

describe('seatsPerSlot', () => {
  it('sums the active services', () => {
    expect(seatsPerSlot([{ capacity_per_slot: 2 }, { capacity_per_slot: 3, active: true }, { capacity_per_slot: 50, active: false }])).toBe(5);
  });

  it('reads a missing or invalid value as 1 and no services as 0', () => {
    expect(seatsPerSlot([{ capacity_per_slot: null }, { capacity_per_slot: 0 }])).toBe(2);
    expect(seatsPerSlot([])).toBe(0);
  });
});

describe('hourlyCapacityForRow', () => {
  it('skips the break and multiplies slots by seats per slot', () => {
    const map = hourlyCapacityForRow(fullWeek(A)[0], SEATS);
    expect(map.get(9)).toBe(4); // 09:00 + 09:30 × 2 seats
    expect(map.get(12)).toBeUndefined(); // break
    expect(map.get(17)).toBe(4);
    expect(Array.from(map.values()).reduce((s, v) => s + v, 0)).toBe(32); // 16 slots × 2
  });

  it('returns nothing when close <= open', () => {
    expect(hourlyCapacityForRow({ ...fullWeek(A)[0], close_time: '09:00' }, SEATS).size).toBe(0);
  });

  it('returns nothing when there are no seats', () => {
    expect(hourlyCapacityForRow(fullWeek(A)[0], 0).size).toBe(0);
  });
});

describe('CapacityModel', () => {
  it('computes daily capacity for one branch', () => {
    const m = new CapacityModel([A], fullWeek(A), [], SEATS);
    expect(m.dailyCapacity('2026-09-12')).toBe(32);
    expect(m.hourlyCapacity('2026-09-12', 12)).toBe(0);
  });

  it('sums across two branches', () => {
    const m = new CapacityModel([A, B], [...fullWeek(A), ...fullWeek(B)], [], SEATS);
    expect(m.dailyCapacity('2026-09-12')).toBe(64);
    expect(m.hourlyCapacity('2026-09-12', 9)).toBe(8);
  });

  it('is zero on a shop-wide holiday and only for that branch on a branch holiday', () => {
    const m = new CapacityModel(
      [A, B],
      [...fullWeek(A), ...fullWeek(B)],
      [
        { branch_id: null, holiday_date: '2026-09-21' },
        { branch_id: A, holiday_date: '2026-09-22' },
      ],
      SEATS,
    );
    expect(m.dailyCapacity('2026-09-21')).toBe(0);
    expect(m.isFullHoliday('2026-09-21')).toBe(true);
    expect(m.dailyCapacity('2026-09-22')).toBe(32);
    expect(m.isFullHoliday('2026-09-22')).toBe(false);
  });

  it('falls back to shop-wide rows when a branch has none for that weekday', () => {
    const m = new CapacityModel([A], fullWeek(null), [], 3);
    expect(m.dailyCapacity('2026-09-12')).toBe(48);
  });

  it('prefers the branch row over the shop-wide row', () => {
    const shopWide = fullWeek(null).map((r) => ({ ...r, close_time: '13:00:00', break_start: null, break_end: null }));
    const m = new CapacityModel([A], [...shopWide, ...fullWeek(A)], [], 1);
    expect(m.dailyCapacity('2026-09-12')).toBe(16);
  });

  it('is zero when there are no working hours at all', () => {
    const m = new CapacityModel([A], [], [], SEATS);
    expect(m.dailyCapacity('2026-09-12')).toBe(0);
    expect(m.openHours()).toEqual([]);
  });

  it('ignores inactive rows and lists open hours without the break', () => {
    const rows = fullWeek(A).map((r, i) => (i === 0 ? { ...r, active: false } : r));
    const m = new CapacityModel([A], rows, [], SEATS);
    expect(m.dailyCapacity('2026-09-13')).toBe(0); // Sunday row inactive
    expect(m.openHours()).toEqual([9, 10, 11, 13, 14, 15, 16, 17]);
  });
});
