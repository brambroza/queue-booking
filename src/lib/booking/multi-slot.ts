/**
 * Multi-slot bookings ("จองต่อเนื่องหลายรอบ") and staff "ต่อเวลา".
 *
 * A booking's length is `end_time - start_time`; nothing else stores it. A
 * service opts in with `booking_mode = 'flexible_duration'`: one slot is
 * `duration_minutes`, and a customer may book up to `max_duration_minutes`
 * worth of consecutive slots (at least `min_duration_minutes` when booking
 * more than one).
 *
 * Only bookings tied to a resource (court, room, bay, trainer) may span more
 * than one slot: the resource guards (`is_resource_available`, the resource
 * path of `get_slot_availability`) compare time ranges, so a longer
 * `end_time` blocks the later slots by itself. Plain slot capacity counts by
 * exact start time and would not.
 *
 * Shared by the LIFF client (stepper limits), `/api/public/shop/[shopKey]/book`
 * and `/api/bookings` so they never disagree.
 */

/** `code` on the 400 when more than one slot is asked for without a resource. */
export const MULTI_SLOT_NEEDS_RESOURCE_CODE = 'multi_slot_needs_resource';

/** `code` on the 400/409 when the requested run of slots is not allowed or not free. */
export const MULTI_SLOT_UNAVAILABLE_CODE = 'multi_slot_unavailable';

/** Hard ceiling on slots per booking, whatever the service says. */
export const MAX_SLOTS_PER_BOOKING = 24;

/** Statuses whose length staff may still extend. */
export const EXTENDABLE_STATUSES = [
  'pending',
  'pending_approval',
  'confirmed',
  'checked_in',
  'waiting',
  'called',
  'serving',
] as const;

/** Customer-facing message when slot_count > 1 is sent for a booking without a resource. */
export const MULTI_SLOT_NEEDS_RESOURCE_MESSAGE = 'จองหลายรอบต่อเนื่องได้เฉพาะเมื่อเลือกสนาม/ห้อง/ผู้ให้บริการ';

/** Service fields the multi-slot rules read. */
export type MultiSlotService = {
  booking_mode?: string | null;
  duration_minutes?: number | null;
  min_duration_minutes?: number | null;
  max_duration_minutes?: number | null;
};

/** One row of the slot grid as returned by `/slots`. */
export type GridSlot = {
  slot_time: string;
  remaining_capacity: number;
  is_past?: boolean;
};

/**
 * Length of one slot of this service in minutes (same fallback as the book routes).
 *
 * @param service - Service row.
 */
export function slotUnitMinutes(service: MultiSlotService): number {
  return Math.max(Number(service.duration_minutes ?? 30), 5);
}

/**
 * Most consecutive slots one booking of this service may take. 1 for any
 * service that is not `flexible_duration`.
 *
 * @param service - Service row.
 */
export function maxSlotCount(service: MultiSlotService): number {
  if (service.booking_mode !== 'flexible_duration') return 1;
  const unit = slotUnitMinutes(service);
  const max = Number(service.max_duration_minutes ?? 0);
  if (!Number.isFinite(max) || max <= unit) return 1;
  return Math.min(Math.floor(max / unit), MAX_SLOTS_PER_BOOKING);
}

/**
 * Fewest slots a multi-slot booking must take, from `min_duration_minutes`.
 * A single slot is always allowed — that is the normal booking.
 *
 * @param service - Service row.
 */
export function minSlotCount(service: MultiSlotService): number {
  const unit = slotUnitMinutes(service);
  const min = Number(service.min_duration_minutes ?? 0);
  if (!Number.isFinite(min) || min <= unit) return 1;
  return Math.ceil(min / unit);
}

/**
 * Whether a booking of `count` consecutive slots is allowed for this service.
 *
 * @param service - Service row.
 * @param count - Requested slot count.
 */
export function isSlotCountAllowed(service: MultiSlotService, count: number): boolean {
  if (!Number.isInteger(count) || count < 1) return false;
  if (count === 1) return true;
  return count <= maxSlotCount(service) && count >= minSlotCount(service);
}

/**
 * Minutes since midnight of an `HH:MM` / `HH:MM:SS` string, or null if malformed.
 *
 * @param time - Time string.
 */
export function timeToMinutes(time: string | null | undefined): number | null {
  const m = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(String(time ?? ''));
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/**
 * `HH:MM:SS` for minutes since midnight.
 *
 * @param minutes - 0..1439.
 */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

/** Minutes of midnight at the end of the day (`00:00` stored as an end / close time). */
export const END_OF_DAY_MINUTES = 24 * 60;

/**
 * Minutes since midnight of an end or closing time. `00:00` after a later
 * start means midnight at the END of that day (1440), so a shop open
 * 08:00–00:00 or a 23:00–00:00 booking reads the way the owner meant it —
 * the SQL slot / overlap functions apply the same rule (202610250003).
 *
 * @param end - End / close time (`HH:MM[:SS]`).
 * @param startMinutes - Start / open time in minutes since midnight.
 */
export function endTimeMinutes(end: string | null | undefined, startMinutes: number): number | null {
  const e = timeToMinutes(end);
  if (e === null) return null;
  return e === 0 && startMinutes > 0 ? END_OF_DAY_MINUTES : e;
}

/**
 * End time of a booking of `count` slots starting at `start`. Ending exactly
 * at midnight gives `00:00:00` (read as end of day, see `endTimeMinutes`);
 * null when the booking would run past midnight (end_time is a plain `time`,
 * same day only).
 *
 * @param start - `HH:MM` or `HH:MM:SS`.
 * @param unitMinutes - Length of one slot.
 * @param count - Number of slots.
 */
export function bookingEndTime(start: string, unitMinutes: number, count: number): string | null {
  const s = timeToMinutes(start);
  if (s === null) return null;
  const end = s + unitMinutes * count;
  if (end > END_OF_DAY_MINUTES) return null;
  return minutesToTime(end % END_OF_DAY_MINUTES);
}

/**
 * Whether every slot of the run `start, start+unit, …` (count slots) is offered
 * in the grid, still open and not past. The grid only offers a slot that fits
 * inside working hours and outside the break, so this also keeps the run in
 * opening hours.
 *
 * @param slots - Slot grid for the resource and date.
 * @param start - First slot start.
 * @param unitMinutes - Length of one slot.
 * @param count - Number of slots.
 */
export function consecutiveSlotsOpen(slots: readonly GridSlot[], start: string, unitMinutes: number, count: number): boolean {
  const s = timeToMinutes(start);
  if (s === null || count < 1) return false;
  const open = new Set(
    slots
      .filter((slot) => !slot.is_past && Number(slot.remaining_capacity) > 0)
      .map((slot) => timeToMinutes(slot.slot_time))
      .filter((m): m is number => m !== null),
  );
  for (let i = 0; i < count; i += 1) {
    if (!open.has(s + unitMinutes * i)) return false;
  }
  return true;
}

/**
 * Largest slot count the customer can pick at `start`, within the service
 * limits and the run of open slots in the grid. 1 when nothing longer fits
 * (and the stepper is hidden).
 *
 * @param service - Service row.
 * @param slots - Slot grid for the resource and date.
 * @param start - Selected start time.
 */
export function maxOpenSlotCount(service: MultiSlotService, slots: readonly GridSlot[], start: string): number {
  const unit = slotUnitMinutes(service);
  const limit = maxSlotCount(service);
  let best = 1;
  for (let n = 2; n <= limit; n += 1) {
    if (!consecutiveSlotsOpen(slots, start, unit, n) || !bookingEndTime(start, unit, n)) break;
    best = n;
  }
  return best;
}

/**
 * Length of an existing booking in minutes, so moving it keeps its length.
 * An `end_time` of `00:00` counts as midnight at the end of the day. Falls
 * back to the service duration when `end_time` is missing or not after the
 * start.
 *
 * @param start - Booking start time.
 * @param end - Booking end time (nullable).
 * @param fallbackMinutes - Service duration.
 */
export function bookingDurationMinutes(start: string, end: string | null | undefined, fallbackMinutes: number): number {
  const s = timeToMinutes(start);
  const e = s === null ? null : endTimeMinutes(end, s);
  if (s === null || e === null || e <= s) return fallbackMinutes;
  return e - s;
}

/**
 * Whether staff may still extend a booking in this status.
 *
 * @param status - Booking status.
 */
export function isExtendableStatus(status: string | null | undefined): boolean {
  return (EXTENDABLE_STATUSES as readonly string[]).includes(String(status ?? ''));
}

/**
 * Message when the run of slots is not free any more.
 *
 * @param start - First slot.
 * @param end - End of the run.
 */
export function multiSlotUnavailableMessage(start: string, end: string): string {
  return `ช่วง ${start.slice(0, 5)}–${end.slice(0, 5)} ไม่ว่างครบทุกรอบแล้ว กรุณาเลือกเวลาหรือจำนวนรอบใหม่`;
}

/**
 * `HH:MM` or `HH:MM–HH:MM` label for messages and payment descriptions.
 *
 * @param start - Start time.
 * @param end - End time (shown only for multi-slot bookings).
 * @param count - Slot count.
 */
export function bookingTimeLabel(start: string, end: string | null, count: number): string {
  if (count > 1 && end) return `${start.slice(0, 5)}–${end.slice(0, 5)}`;
  return start.slice(0, 5);
}

/** Current pick in the LIFF grid: first slot + how many consecutive slots. */
export type SlotSelection = { start: string; count: number };

/**
 * What a tap on a grid slot does to the current pick, so the customer can
 * select several consecutive slots straight in the grid:
 * - no pick yet, or a slot before / off the run step → start over there (1 slot)
 * - a later slot in step with the start, within `maxRun` → the pick now ends
 *   at that slot (extends, or shrinks when tapped inside the run)
 * - the start slot again → back to one slot
 * A run shorter than the service minimum is stretched to the minimum when it fits.
 *
 * @param current - Current pick, or null.
 * @param tapped - Tapped slot time (`HH:MM`).
 * @param unitMinutes - Length of one slot.
 * @param maxRun - Most slots bookable from `current.start` (`maxOpenSlotCount`).
 * @param minRun - Fewest slots of a multi-slot booking (`minSlotCount`).
 */
export function nextSlotSelection(
  current: SlotSelection | null,
  tapped: string,
  unitMinutes: number,
  maxRun: number,
  minRun: number,
): SlotSelection {
  const fresh = { start: tapped.slice(0, 5), count: 1 };
  if (!current?.start || maxRun <= 1) return fresh;
  const s = timeToMinutes(current.start);
  const t = timeToMinutes(tapped);
  if (s === null || t === null || unitMinutes <= 0) return fresh;
  const offset = t - s;
  if (offset < 0 || offset % unitMinutes !== 0) return fresh;
  const n = offset / unitMinutes + 1;
  if (n === 1) return { start: current.start, count: 1 };
  if (n > maxRun) return fresh;
  if (n < minRun) return minRun <= maxRun ? { start: current.start, count: minRun } : fresh;
  return { start: current.start, count: n };
}

/**
 * `HH:MM` of every slot in the pick, for highlighting the grid.
 *
 * @param selection - Current pick.
 * @param unitMinutes - Length of one slot.
 */
export function selectedSlotTimes(selection: SlotSelection | null, unitMinutes: number): Set<string> {
  const out = new Set<string>();
  const s = timeToMinutes(selection?.start);
  if (!selection || s === null) return out;
  for (let i = 0; i < Math.max(selection.count, 1); i += 1) {
    const m = s + unitMinutes * i;
    if (m >= 24 * 60) break;
    out.add(minutesToTime(m).slice(0, 5));
  }
  return out;
}

/** Most separate slots a customer may pick in one LIFF booking (one queue per slot). */
export const MAX_SLOTS_PER_ORDER = 4;

/** `code` when the picked slots break a multi-pick rule (too many, same-day limit, overlap). */
export const MULTI_PICK_INVALID_CODE = 'multi_pick_invalid';

/**
 * Normalise, de-duplicate and sort picked start times (`HH:MM`).
 *
 * @param times - Start times as sent by the client (`HH:MM` or `HH:MM:SS`).
 */
export function normalizePickedTimes(times: readonly string[]): string[] {
  const out = new Set<string>();
  for (const t of times) {
    const m = timeToMinutes(t);
    if (m !== null) out.add(minutesToTime(m).slice(0, 5));
  }
  return [...out].sort();
}

/**
 * Tap on a grid slot when the shop lets customers pick several slots (one
 * queue each, not necessarily next to each other): a picked slot is removed,
 * a new one is added until `max`.
 *
 * @param picks - Currently picked start times.
 * @param tapped - Tapped slot (`HH:MM`).
 * @param max - Most slots allowed.
 * @returns Sorted picks and whether the tap was refused because of `max`.
 */
export function toggleSlotPick(picks: readonly string[], tapped: string, max: number): { picks: string[]; limitHit: boolean } {
  const current = normalizePickedTimes(picks);
  const t = normalizePickedTimes([tapped])[0];
  if (!t) return { picks: current, limitHit: false };
  if (current.includes(t)) return { picks: current.filter((x) => x !== t), limitHit: false };
  if (current.length >= max) return { picks: current, limitHit: true };
  return { picks: normalizePickedTimes([...current, t]), limitHit: false };
}

/**
 * Whether two of the customer's own picks would hold the same resource at the
 * same time (slot length longer than the gap between them).
 *
 * @param times - Sorted picked start times.
 * @param unitMinutes - Length of one booking.
 */
export function picksOverlap(times: readonly string[], unitMinutes: number): boolean {
  const mins = normalizePickedTimes(times).map((t) => timeToMinutes(t) as number);
  for (let i = 1; i < mins.length; i += 1) {
    if (mins[i] - mins[i - 1] < unitMinutes) return true;
  }
  return false;
}

/**
 * Effective end of an existing booking in minutes since midnight. Bookings
 * created before 2026-10-14 may store an `end_time` 7 hours early (the old
 * code read the server's UTC clock), which lands before the start — then the
 * service duration is used instead.
 *
 * @param start - Booking start time.
 * @param end - Stored end time (nullable).
 * @param fallbackMinutes - Service duration.
 */
export function effectiveEndMinutes(start: string, end: string | null | undefined, fallbackMinutes: number): number | null {
  const s = timeToMinutes(start);
  if (s === null) return null;
  return s + bookingDurationMinutes(start, end, fallbackMinutes);
}
