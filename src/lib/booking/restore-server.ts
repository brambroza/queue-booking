import type { SupabaseClient } from '@supabase/supabase-js';
import { resourceBusyMessage } from '@/lib/booking/resource-types';
import { SLOT_FULL_CODE, countSlotBookings, fetchSlotCapacity, isSlotFull, slotFullStaffMessage } from '@/lib/booking/slot-capacity';
import { endTimeMinutes, timeToMinutes } from '@/lib/booking/multi-slot';
import { restoreGroup, restoredNote } from '@/lib/booking/restore';
import { LATE_SLIP_RESTORED_MARKER, LATE_SLIP_RESTORE_LOG_ACTION, NOTE_MARKER } from '@/lib/payments/payment-hold';
import { getTodayISOInBangkok } from '@/lib/utils/date-format';

/**
 * Server side of "bring a cancelled booking back": the seat checks shared by the
 * staff restore (`PATCH /api/bookings { restore: true }`) and the automatic
 * restore when a late slip arrives (`/payment/slip`).
 */

/** Minimal shape needed to call a Postgres function — works for both the session and admin clients. */
type RpcClient = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown }> };

export type RestoreRow = {
  id: string;
  queue_number: string | null;
  status: string;
  branch_id: string | null;
  service_id: string | null;
  booking_date: string;
  start_time: string;
  end_time: string | null;
  resource_id: string | null;
  resource_name: string | null;
  note: string | null;
  is_deleted: boolean | null;
  payment_hold_booking_id?: string | null;
};

export const RESTORE_COLUMNS =
  'id,queue_number,status,branch_id,service_id,booking_date,start_time,end_time,resource_id,resource_name,note,is_deleted';

/**
 * True when nothing else holds this resource during the window.
 * `excludeBookingId` lets a booking be rescheduled or reassigned without
 * colliding with its own current row.
 */
export async function isResourceFree(
  supabase: RpcClient,
  args: { shopId: string; resourceId: string; startAt: Date; endAt: Date; excludeBookingId?: string },
): Promise<boolean> {
  const { data } = await supabase.rpc('is_resource_available', {
    p_shop_id: args.shopId,
    p_resource_id: args.resourceId,
    p_start: args.startAt.toISOString(),
    p_end: args.endAt.toISOString(),
    p_exclude_booking_id: args.excludeBookingId ?? null,
  });
  return data !== false;
}

export type SeatCheck =
  | { ok: true }
  | { ok: false; kind: 'resource_busy' | 'slot_full'; row: RestoreRow; message: string; code?: string };

/**
 * Whether every queue of the group can take its seat back: its resource must be
 * free, and (without a resource) its slot must not be full unless overbooking
 * is allowed. Stops at the first queue that cannot.
 *
 * @param supabase - Session or admin client.
 * @param opts.shopId - Shop of the queues.
 * @param opts.rows - Queues to bring back.
 * @param opts.allowOverbook - Staff confirmed a full slot (never for automatic restores).
 */
export async function checkRestoreSeats(
  supabase: SupabaseClient,
  opts: { shopId: string; rows: RestoreRow[]; allowOverbook: boolean },
): Promise<SeatCheck> {
  const { shopId } = opts;
  for (const row of opts.rows) {
    const label = row.queue_number ?? row.id;
    if (row.resource_id) {
      const startMin = timeToMinutes(String(row.start_time)) ?? 0;
      const endMin = endTimeMinutes(row.end_time, startMin);
      const durationMin = endMin !== null && endMin > startMin ? endMin - startMin : 30;
      const startAt = new Date(`${row.booking_date}T${String(row.start_time).slice(0, 5)}:00+07:00`);
      const endAt = new Date(startAt.getTime() + durationMin * 60_000);
      const free = await isResourceFree(supabase, { shopId, resourceId: row.resource_id, startAt, endAt, excludeBookingId: row.id });
      if (!free) {
        const { data: res } = await supabase
          .from('booking_resources')
          .select('resource_type')
          .eq('id', row.resource_id)
          .eq('shop_id', shopId)
          .maybeSingle();
        return {
          ok: false,
          kind: 'resource_busy',
          row,
          message: `คิว ${label}: ${resourceBusyMessage((res as { resource_type?: string | null } | null)?.resource_type ?? null)} — ย้ายคิวที่ทับออกก่อน หรือสร้างคิวใหม่`,
        };
      }
    } else if (!opts.allowOverbook && row.service_id && row.branch_id) {
      const slotKey = { shopId, branchId: row.branch_id, serviceId: row.service_id, date: row.booking_date, startTime: String(row.start_time) };
      const { data: svc } = await supabase.from('services').select('capacity_per_slot').eq('id', row.service_id).eq('shop_id', shopId).maybeSingle();
      const [capacity, bookedCount] = await Promise.all([
        fetchSlotCapacity(supabase, slotKey, (svc as { capacity_per_slot?: number | null } | null)?.capacity_per_slot),
        countSlotBookings(supabase, { ...slotKey, excludeBookingId: row.id }),
      ]);
      if (isSlotFull(bookedCount, capacity)) {
        return {
          ok: false,
          kind: 'slot_full',
          row,
          message: `คิว ${label}: ${slotFullStaffMessage(String(row.start_time), bookedCount, capacity)}`,
          code: SLOT_FULL_CODE,
        };
      }
    }
  }
  return { ok: true };
}

export type LateSlipRestoreResult =
  | { ok: true; restored: Array<{ id: string; queue_number: string | null }> }
  | { ok: false; reason: 'slot_taken' | 'changed' | 'error'; message?: string };

/**
 * A slip arrived for an order the payment cron cancelled: bring every cancelled
 * queue of that order back as `pending_approval` (slip in review), keeping the
 * hold id so approving the slip confirms them through `releasePaymentHold`, and
 * rejecting it lets the cron cancel them again. All or nothing, never
 * overbooked. Never throws.
 *
 * Package-paid queues are never held for payment, so no package minutes are touched.
 *
 * @param admin - Service-role client (the caller is a LIFF customer).
 * @param opts.bookingId - The paying booking the slip was uploaded for.
 */
export async function restoreOrderForLateSlip(
  admin: SupabaseClient,
  opts: { shopId: string; companyId: string; bookingId: string },
): Promise<LateSlipRestoreResult> {
  try {
    const { shopId } = opts;
    const { data: targetRaw, error } = await admin
      .from('bookings')
      .select(`${RESTORE_COLUMNS},payment_hold_booking_id`)
      .eq('id', opts.bookingId)
      .eq('shop_id', shopId)
      .maybeSingle();
    if (error || !targetRaw) return { ok: false, reason: 'error', message: error?.message };
    const target = targetRaw as RestoreRow;
    if (target.status !== 'cancelled' || target.is_deleted) return { ok: false, reason: 'changed' };

    let siblings: RestoreRow[] = [];
    if (target.payment_hold_booking_id) {
      const { data } = await admin
        .from('bookings')
        .select(`${RESTORE_COLUMNS},payment_hold_booking_id`)
        .eq('shop_id', shopId)
        .eq('payment_hold_booking_id', target.payment_hold_booking_id)
        .eq('status', 'cancelled')
        .eq('is_deleted', false);
      // Only the queues the cron cancelled with this order — not one the customer cancelled earlier.
      siblings = ((data ?? []) as RestoreRow[]).filter((r) => String(r.note ?? '').includes(NOTE_MARKER));
    }
    const group = restoreGroup(target, siblings, getTodayISOInBangkok());

    const seats = await checkRestoreSeats(admin, { shopId, rows: group, allowOverbook: false });
    if (!seats.ok) return { ok: false, reason: 'slot_taken', message: seats.message };

    const restored: RestoreRow[] = [];
    for (const row of group) {
      const { data: updated, error: updateError } = await admin
        .from('bookings')
        .update({ status: 'pending_approval', note: restoredNote(row.note, LATE_SLIP_RESTORED_MARKER) })
        .eq('id', row.id)
        .eq('shop_id', shopId)
        .eq('status', 'cancelled')
        .select('id');
      if (updateError) throw updateError;
      if (updated && updated.length > 0) restored.push(row);
    }
    if (restored.length === 0) return { ok: false, reason: 'changed' };

    await admin.from('booking_logs').insert(
      restored.map((r) => ({
        company_id: opts.companyId,
        shop_id: shopId,
        booking_id: r.id,
        action: LATE_SLIP_RESTORE_LOG_ACTION,
        description: `Late slip — booking ${r.queue_number ?? r.id} restored to pending_approval for slip review`,
      })),
    );
    return { ok: true, restored: restored.map((r) => ({ id: r.id, queue_number: r.queue_number })) };
  } catch (e) {
    console.error('[late-slip] restore failed:', e instanceof Error ? e.message : e);
    return { ok: false, reason: 'error', message: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * True when a late slip already brought this queue back once (one chance per queue).
 * A failed read counts as "already", so the automatic restore stays off on doubt.
 */
export async function wasRestoredByLateSlip(admin: SupabaseClient, opts: { shopId: string; bookingId: string }): Promise<boolean> {
  const { count, error } = await admin
    .from('booking_logs')
    .select('id', { count: 'exact', head: true })
    .eq('shop_id', opts.shopId)
    .eq('booking_id', opts.bookingId)
    .eq('action', LATE_SLIP_RESTORE_LOG_ACTION);
  if (error) return true;
  return (count ?? 0) > 0;
}
