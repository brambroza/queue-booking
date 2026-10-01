/**
 * Slot capacity rule, shared by the public `/book` route, the portal
 * `/api/bookings` route and the clients that react to a refusal.
 *
 * Capacity defaults to `services.capacity_per_slot` and may be overridden per
 * time range by `service_capacity_rules` (migration 202610010001). The database
 * function `resolve_slot_capacity` is the one place that precedence lives, and
 * `fetchSlotCapacity` below reads it. Bookings are counted per shop + branch +
 * service + date + start time, the same reading as the `get_slot_availability`
 * RPC the LIFF grid is drawn from. Cancelled / no-show bookings free their
 * seat; completed ones do not.
 *
 * A booking tied to a resource (stylist, table, court) is governed by the
 * resource overlap guard instead and never goes through this rule.
 *
 * The authoritative check runs server-side (app count + DB trigger
 * `enforce_slot_capacity`, migrations 202609290001 / 202610010001). Staff may
 * overbook from the portal after confirming; customers may not.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeSlotTime } from '@/lib/booking/slot-time';

/** `code` sent with the 409 so clients can react (refresh the grid, ask staff to confirm). */
export const SLOT_FULL_CODE = 'slot_full';

/** Statuses that do NOT occupy a seat. Everything else counts, incl. completed. */
export const SLOT_CAPACITY_FREE_STATUSES = ['cancelled', 'no_show'] as const;

/** Identifies one slot of one service at one branch. */
export type SlotKey = {
  shopId: string;
  branchId: string;
  serviceId: string;
  /** `YYYY-MM-DD` */
  date: string;
  /** `HH:MM` or `HH:MM:SS` */
  startTime: string;
  /** Booking being moved, so its own current row never counts against it. */
  excludeBookingId?: string;
};

/**
 * Whether a booking in this status still holds its seat.
 *
 * @param status - Booking status as stored in the database.
 */
export function occupiesSlot(status: string | null | undefined): boolean {
  return !(SLOT_CAPACITY_FREE_STATUSES as readonly string[]).includes(String(status ?? ''));
}

/**
 * Whether a slot has no seat left.
 *
 * A missing or invalid capacity reads as 1, the column default — never as
 * "unlimited".
 *
 * @param bookedCount - Bookings already holding a seat in the slot.
 * @param capacity - `services.capacity_per_slot`.
 */
export function isSlotFull(bookedCount: number, capacity: number | null | undefined): boolean {
  const seats = Number(capacity);
  const limit = Number.isFinite(seats) && seats >= 1 ? Math.floor(seats) : 1;
  return bookedCount >= limit;
}

/**
 * Thai message shown to a customer when the slot filled up.
 *
 * @param time - Slot start, for "รอบ 10:30".
 */
export function slotFullMessage(time?: string | null): string {
  const label = time ? normalizeSlotTime(time).slice(0, 5) : '';
  return label ? `รอบ ${label} เต็มแล้ว กรุณาเลือกเวลาอื่นค่ะ` : 'รอบนี้เต็มแล้ว กรุณาเลือกเวลาอื่นค่ะ';
}

/**
 * Thai message shown to staff, who may still confirm the booking.
 *
 * @param time - Slot start.
 * @param bookedCount - Bookings already in the slot.
 * @param capacity - `services.capacity_per_slot`.
 */
export function slotFullStaffMessage(time: string | null | undefined, bookedCount: number, capacity: number): string {
  const label = time ? normalizeSlotTime(time).slice(0, 5) : '';
  return `รอบ ${label || 'นี้'} เต็มแล้ว (${bookedCount}/${capacity})`;
}

/**
 * Whether a database insert error came from the `enforce_slot_capacity`
 * trigger (the race the app-side count cannot close).
 *
 * @param message - `error.message` from the failed insert.
 */
export function isSlotFullDbError(message: string | null | undefined): boolean {
  return typeof message === 'string' && message.includes(SLOT_FULL_CODE);
}

/**
 * Capacity of one slot, honouring time-range rules.
 *
 * Calls the `resolve_slot_capacity` database function. When that call fails —
 * most likely because migration 202610010001 has not been applied yet — the
 * service default is used instead, so a booking never fails only because the
 * rules feature is missing. A failure is logged once per process.
 *
 * @param client - Supabase client already allowed to read this shop's data.
 * @param slot - Slot to resolve (`excludeBookingId` is ignored).
 * @param serviceDefault - `services.capacity_per_slot` of the slot's service.
 */
export async function fetchSlotCapacity(
  client: SupabaseClient,
  slot: Omit<SlotKey, 'excludeBookingId'>,
  serviceDefault: number | null | undefined,
): Promise<number> {
  const fallback = normalizeCapacity(serviceDefault);
  try {
    const { data, error } = await client.rpc('resolve_slot_capacity', {
      p_shop_id: slot.shopId,
      p_service_id: slot.serviceId,
      p_branch_id: slot.branchId,
      p_date: slot.date,
      p_slot_time: normalizeSlotTime(slot.startTime),
    });
    if (error) throw new Error(error.message);
    const resolved = Number(data);
    return Number.isFinite(resolved) && resolved >= 1 ? Math.floor(resolved) : fallback;
  } catch (err) {
    if (!resolverWarned) {
      resolverWarned = true;
      console.warn('[slot-capacity] resolve_slot_capacity unavailable, using services.capacity_per_slot:', err instanceof Error ? err.message : err);
    }
    return fallback;
  }
}

let resolverWarned = false;

/** Same reading as `isSlotFull`: a missing or invalid value is 1, never unlimited. */
function normalizeCapacity(capacity: number | null | undefined): number {
  const seats = Number(capacity);
  return Number.isFinite(seats) && seats >= 1 ? Math.floor(seats) : 1;
}

/**
 * Number of bookings holding a seat in the slot.
 *
 * Throws when the count fails: a failed count must not read as "0 booked",
 * that would silently disable the rule.
 *
 * @param client - Supabase client already allowed to read this shop's bookings.
 * @param slot - Slot to count.
 */
export async function countSlotBookings(client: SupabaseClient, slot: SlotKey): Promise<number> {
  const startTime = normalizeSlotTime(slot.startTime);
  let query = client
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('shop_id', slot.shopId)
    .eq('branch_id', slot.branchId)
    .eq('service_id', slot.serviceId)
    .eq('booking_date', slot.date)
    .eq('start_time', startTime)
    .eq('is_deleted', false)
    .not('status', 'in', `(${SLOT_CAPACITY_FREE_STATUSES.join(',')})`);
  if (slot.excludeBookingId) query = query.neq('id', slot.excludeBookingId);

  const { count, error } = await query;
  if (error) throw new Error(`slot capacity count failed: ${error.message}`);
  return count ?? 0;
}
