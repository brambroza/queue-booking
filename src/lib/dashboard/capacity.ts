import { weekdayOf } from './date-range';

/**
 * Theoretical booking capacity derived from `working_hours`, `holidays` and the
 * services' slot capacity.
 *
 * Capacity for one branch on one weekday = number of slots × seats per slot,
 * where slots step through `open_time`–`close_time` by `slot_interval_minutes`,
 * skipping the break. A row with `branch_id = null` is a shop-wide default used by
 * any branch that has no row of its own for that weekday (same fallback as the
 * `get_available_slots` RPC). A holiday zeroes the day for its branch, or for every
 * branch when `branch_id` is null.
 *
 * Seats per slot come from `services.capacity_per_slot` — the value customers
 * book against — summed over the active services (see `seatsPerSlot`), because
 * each service holds its own seats in a slot. A `service_capacity_rules` row
 * overrides that value for its time range (see `seatsResolver`, same precedence
 * as the `resolve_slot_capacity` database function). `working_hours.capacity_per_slot`
 * is deprecated and not read.
 *
 * It stays an estimate: a service booked against resources (stylists, tables)
 * is really limited by how many of those are free.
 */

export type WorkingHoursRow = {
  branch_id: string | null;
  weekday: number;
  open_time: string;
  close_time: string;
  break_start?: string | null;
  break_end?: string | null;
  slot_interval_minutes: number;
  active?: boolean | null;
};

export type ServiceCapacityRow = {
  id?: string;
  capacity_per_slot: number | null;
  active?: boolean | null;
};

/** One `service_capacity_rules` row, as the dashboard reads it. */
export type CapacityRuleRow = {
  service_id: string;
  /** null = every branch. */
  branch_id: string | null;
  /** 0 = Sunday … 6 = Saturday; null = every weekday. */
  weekday: number | null;
  /** `HH:MM[:SS]`, inclusive. */
  time_from: string;
  /** `HH:MM[:SS]`, exclusive. */
  time_to: string;
  capacity: number;
  active?: boolean | null;
};

/** Seats one branch offers in the slot starting at `minutesOfDay` on `weekday`. */
export type SeatsResolver = (branchId: string, weekday: number, minutesOfDay: number) => number;

/**
 * Seats one branch offers in a single slot: the sum of `capacity_per_slot` over
 * the active services. A missing value reads as 1, the column default.
 *
 * @param services - Services of the shop (inactive ones are ignored).
 */
export function seatsPerSlot(services: ServiceCapacityRow[]): number {
  let total = 0;
  for (const s of services) {
    if (s.active === false) continue;
    const seats = Number(s.capacity_per_slot ?? 1);
    total += Number.isFinite(seats) && seats >= 1 ? Math.floor(seats) : 1;
  }
  return total;
}

/** A capacity value as the booking flow reads it: missing or invalid = 1. */
function normalizeSeats(value: number | null | undefined): number {
  const seats = Number(value ?? 1);
  return Number.isFinite(seats) && seats >= 1 ? Math.floor(seats) : 1;
}

/**
 * Seats one service offers in one slot, honouring its time-range rules.
 *
 * Mirrors `resolve_slot_capacity`: the most specific active rule covering the
 * slot wins (branch + weekday, then branch, then weekday, then shop-wide), and
 * with none the service default applies. `time_to` is exclusive.
 *
 * @param service - The service (its `id` is matched against `rules`).
 * @param rules - Rules of the shop; rows of other services are ignored.
 * @param branchId - Branch the slot belongs to.
 * @param weekday - 0 = Sunday … 6 = Saturday.
 * @param minutesOfDay - Slot start, minutes since midnight.
 */
export function resolveServiceSeats(
  service: ServiceCapacityRow,
  rules: CapacityRuleRow[],
  branchId: string,
  weekday: number,
  minutesOfDay: number,
): number {
  let best: CapacityRuleRow | null = null;
  let bestRank = -1;
  for (const r of rules) {
    if (service.id === undefined || r.service_id !== service.id || r.active === false) continue;
    if (r.branch_id !== null && r.branch_id !== branchId) continue;
    if (r.weekday !== null && r.weekday !== weekday) continue;
    if (minutesOfDay < timeToMinutes(r.time_from) || minutesOfDay >= timeToMinutes(r.time_to)) continue;
    const rank = (r.branch_id !== null ? 2 : 0) + (r.weekday !== null ? 1 : 0);
    if (rank > bestRank || (rank === bestRank && best && timeToMinutes(r.time_from) < timeToMinutes(best.time_from))) {
      best = r;
      bestRank = rank;
    }
  }
  return normalizeSeats(best ? best.capacity : service.capacity_per_slot);
}

/**
 * Build the per-slot seats function the `CapacityModel` uses: the sum over the
 * active services of `resolveServiceSeats`. With no rules it equals
 * `seatsPerSlot(services)` at every time.
 *
 * @param services - Services of the shop (inactive ones are ignored).
 * @param rules - Active `service_capacity_rules` rows of the shop.
 */
export function seatsResolver(services: ServiceCapacityRow[], rules: CapacityRuleRow[]): SeatsResolver {
  const active = services.filter((s) => s.active !== false);
  if (rules.length === 0) {
    const constant = seatsPerSlot(active);
    return () => constant;
  }
  return (branchId, weekday, minutesOfDay) => {
    let total = 0;
    for (const s of active) total += resolveServiceSeats(s, rules, branchId, weekday, minutesOfDay);
    return total;
  };
}

export type HolidayRow = {
  branch_id: string | null;
  holiday_date: string;
};

/** Parse `HH:MM[:SS]` into minutes since midnight. */
export function timeToMinutes(value: string): number {
  const [h, m] = value.split(':').map((x) => Number.parseInt(x, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

/**
 * Per-hour capacity for one working-hours row (hour → seats).
 *
 * @param row - Working-hours row.
 * @param perSlotSeats - Seats in one slot: a constant from `seatsPerSlot`, or a
 *   function of the slot start (minutes since midnight) when time-range rules apply.
 */
export function hourlyCapacityForRow(row: WorkingHoursRow, perSlotSeats: number | ((minutesOfDay: number) => number)): Map<number, number> {
  const out = new Map<number, number>();
  const interval = Math.max(5, row.slot_interval_minutes || 30);
  const seatsAt = typeof perSlotSeats === 'function' ? perSlotSeats : () => perSlotSeats;
  const open = timeToMinutes(row.open_time);
  const close = timeToMinutes(row.close_time);
  const breakStart = row.break_start ? timeToMinutes(row.break_start) : null;
  const breakEnd = row.break_end ? timeToMinutes(row.break_end) : null;
  if (close <= open) return out;

  for (let t = open; t + interval <= close; t += interval) {
    const inBreak = breakStart !== null && breakEnd !== null && t < breakEnd && t + interval > breakStart;
    if (inBreak) continue;
    const perSlot = Math.max(0, Math.floor(seatsAt(t)) || 0);
    if (perSlot === 0) continue;
    const hour = Math.floor(t / 60);
    out.set(hour, (out.get(hour) ?? 0) + perSlot);
  }
  return out;
}

export class CapacityModel {
  private readonly branchIds: string[];
  private readonly seatsAt: SeatsResolver;
  private readonly byBranchWeekday = new Map<string, WorkingHoursRow[]>();
  private readonly shopWideByWeekday = new Map<number, WorkingHoursRow[]>();
  private readonly holidayAll = new Set<string>();
  private readonly holidayByBranch = new Map<string, Set<string>>();
  private readonly hourCache = new Map<string, Map<number, number>>();

  /**
   * @param branchIds Branches in scope; capacity is summed across them.
   * @param workingHours Active working-hours rows for the shop (any branch).
   * @param holidays Holiday rows for the shop covering the dates that will be queried.
   * @param perSlotSeats Seats one branch offers in a single slot: a constant from
   *   `seatsPerSlot`, or a `SeatsResolver` from `seatsResolver` when time-range rules apply.
   */
  constructor(branchIds: string[], workingHours: WorkingHoursRow[], holidays: HolidayRow[], perSlotSeats: number | SeatsResolver) {
    this.branchIds = Array.from(new Set(branchIds));
    this.seatsAt = typeof perSlotSeats === 'function' ? perSlotSeats : () => perSlotSeats;
    for (const row of workingHours) {
      if (row.active === false) continue;
      if (row.branch_id) {
        const key = `${row.branch_id}:${row.weekday}`;
        this.byBranchWeekday.set(key, [...(this.byBranchWeekday.get(key) ?? []), row]);
      } else {
        this.shopWideByWeekday.set(row.weekday, [...(this.shopWideByWeekday.get(row.weekday) ?? []), row]);
      }
    }
    for (const h of holidays) {
      if (h.branch_id) {
        const set = this.holidayByBranch.get(h.branch_id) ?? new Set<string>();
        set.add(h.holiday_date);
        this.holidayByBranch.set(h.branch_id, set);
      } else {
        this.holidayAll.add(h.holiday_date);
      }
    }
  }

  /** Whether the branch is closed for a holiday on that date. */
  isHoliday(date: string, branchId: string): boolean {
    return this.holidayAll.has(date) || (this.holidayByBranch.get(branchId)?.has(date) ?? false);
  }

  /** Whether every branch in scope is closed for a holiday on that date. */
  isFullHoliday(date: string): boolean {
    if (this.branchIds.length === 0) return this.holidayAll.has(date);
    return this.branchIds.every((b) => this.isHoliday(date, b));
  }

  private rowsFor(branchId: string, weekday: number): WorkingHoursRow[] {
    return this.byBranchWeekday.get(`${branchId}:${weekday}`) ?? this.shopWideByWeekday.get(weekday) ?? [];
  }

  private hoursFor(branchId: string, weekday: number): Map<number, number> {
    const key = `${branchId}:${weekday}`;
    const cached = this.hourCache.get(key);
    if (cached) return cached;
    const merged = new Map<number, number>();
    for (const row of this.rowsFor(branchId, weekday)) {
      for (const [hour, seats] of hourlyCapacityForRow(row, (minutes) => this.seatsAt(branchId, weekday, minutes))) {
        merged.set(hour, (merged.get(hour) ?? 0) + seats);
      }
    }
    this.hourCache.set(key, merged);
    return merged;
  }

  /** Capacity (seats) across all branches in scope for one hour of one date. */
  hourlyCapacity(date: string, hour: number): number {
    const weekday = weekdayOf(date);
    let total = 0;
    for (const b of this.branchIds) {
      if (this.isHoliday(date, b)) continue;
      total += this.hoursFor(b, weekday).get(hour) ?? 0;
    }
    return total;
  }

  /** Hour → capacity for one date, only hours with capacity > 0. */
  hourlyProfile(date: string): Map<number, number> {
    const weekday = weekdayOf(date);
    const out = new Map<number, number>();
    for (const b of this.branchIds) {
      if (this.isHoliday(date, b)) continue;
      for (const [hour, seats] of this.hoursFor(b, weekday)) out.set(hour, (out.get(hour) ?? 0) + seats);
    }
    return out;
  }

  /** Total seats for one date across all branches in scope. */
  dailyCapacity(date: string): number {
    let total = 0;
    for (const seats of this.hourlyProfile(date).values()) total += seats;
    return total;
  }

  /**
   * Hours the shop is open on at least one weekday (sorted). Used as the shared
   * column axis of the heatmap so every row lines up.
   */
  openHours(): number[] {
    const hours = new Set<number>();
    for (const b of this.branchIds) {
      for (let w = 0; w < 7; w++) for (const h of this.hoursFor(b, w).keys()) hours.add(h);
    }
    return Array.from(hours).sort((a, c) => a - c);
  }
}
