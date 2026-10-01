import { describe, expect, it } from 'vitest';
import { CapacityModel, hourlyCapacityForRow, resolveServiceSeats, seatsPerSlot, seatsResolver, timeToMinutes, type CapacityRuleRow, type WorkingHoursRow } from './capacity';

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

describe('resolveServiceSeats / seatsResolver (service_capacity_rules)', () => {
  const SVC = 'cccccccc-0000-0000-0000-000000000003';
  const service = { id: SVC, capacity_per_slot: 2, active: true };
  const afternoon: CapacityRuleRow = { service_id: SVC, branch_id: null, weekday: null, time_from: '13:00:00', time_to: '18:00:00', capacity: 3 };

  it('uses the service default when no rule covers the slot', () => {
    expect(resolveServiceSeats(service, [afternoon], A, 1, 9 * 60)).toBe(2);
    expect(resolveServiceSeats(service, [], A, 1, 14 * 60)).toBe(2);
  });

  it('applies the rule inside its range, time_to exclusive', () => {
    expect(resolveServiceSeats(service, [afternoon], A, 1, 13 * 60)).toBe(3);
    expect(resolveServiceSeats(service, [afternoon], A, 1, 17 * 60 + 30)).toBe(3);
    expect(resolveServiceSeats(service, [afternoon], A, 1, 18 * 60)).toBe(2);
  });

  it('prefers branch + weekday over branch over weekday over shop-wide', () => {
    const rules: CapacityRuleRow[] = [
      afternoon,
      { ...afternoon, weekday: 6, capacity: 4 },
      { ...afternoon, branch_id: A, capacity: 5 },
      { ...afternoon, branch_id: A, weekday: 6, capacity: 6 },
    ];
    expect(resolveServiceSeats(service, rules, A, 6, 14 * 60)).toBe(6);
    expect(resolveServiceSeats(service, rules, A, 1, 14 * 60)).toBe(5);
    expect(resolveServiceSeats(service, rules, B, 6, 14 * 60)).toBe(4);
    expect(resolveServiceSeats(service, rules, B, 1, 14 * 60)).toBe(3);
  });

  it('ignores rules of other services and inactive rules', () => {
    expect(resolveServiceSeats(service, [{ ...afternoon, service_id: 'other' }], A, 1, 14 * 60)).toBe(2);
    expect(resolveServiceSeats(service, [{ ...afternoon, active: false }], A, 1, 14 * 60)).toBe(2);
  });

  it('seatsResolver equals seatsPerSlot everywhere when there are no rules', () => {
    const services = [service, { id: 'x', capacity_per_slot: 1 }];
    const at = seatsResolver(services, []);
    expect(at(A, 1, 9 * 60)).toBe(seatsPerSlot(services));
    expect(at(B, 6, 17 * 60)).toBe(seatsPerSlot(services));
  });

  it('CapacityModel sums the per-slot resolver over the day', () => {
    // 09:00-18:00, break 12-13, 30-min slots → 16 slots: 6 morning, 10 afternoon.
    const at = seatsResolver([service], [afternoon]);
    const model = new CapacityModel([A], fullWeek(A), [], at);
    expect(model.dailyCapacity('2026-10-05')).toBe(6 * 2 + 10 * 3);
    const flat = new CapacityModel([A], fullWeek(A), [], 2);
    expect(flat.dailyCapacity('2026-10-05')).toBe(16 * 2);
  });
});
