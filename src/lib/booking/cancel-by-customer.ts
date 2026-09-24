import type { createAdminClient } from '@/lib/supabase/admin';
import { safeCreateNotification } from '@/lib/notifications/createNotification';
import { CUSTOMER_CANCELLABLE_STATUSES } from '@/lib/booking/status-flow';

type AdminClient = ReturnType<typeof createAdminClient>;

/** Where the customer pressed "ยกเลิกคิว": the LIFF account tab or a LINE Flex button. */
export type CancelSource = 'liff' | 'line';

export type CancelledBooking = {
  id: string;
  queue_number: string | null;
  booking_date: string;
  start_time: string;
  branch_id: string | null;
  /** Status the booking had before this call (for reply wording + notification metadata). */
  status: string;
};

export type CancelByCustomerResult =
  | { ok: true; booking: CancelledBooking }
  | { ok: false; reason: 'line_user_not_found' | 'booking_not_found' }
  | { ok: false; reason: 'already_cancelled' | 'not_cancellable'; booking: CancelledBooking };

const SOURCE_LABEL: Record<CancelSource, string> = { liff: 'LIFF', line: 'LINE' };

/**
 * Marker appended to `bookings.note` on a customer cancel.
 *
 * `note` is shared with staff (assignment markers, free text, portal search),
 * so the existing content is kept and the marker is appended after ` | `.
 * Calling twice with the same source does not duplicate the marker.
 *
 * @param existing - Current note on the booking, if any.
 * @param source - Which surface the customer cancelled from.
 */
export function appendCancelNote(existing: string | null | undefined, source: CancelSource): string {
  const marker = `Cancelled by customer via ${SOURCE_LABEL[source]}`;
  const current = (existing ?? '').trim();
  if (!current) return marker;
  if (current === marker || current.endsWith(` | ${marker}`)) return current;
  return `${current} | ${marker}`;
}

/**
 * Customer cancels their own booking. Shared by the LIFF account tab and the
 * LINE Flex "ยกเลิกคิว" postback so both surfaces behave identically:
 * status → `cancelled`, note marker appended, `booking_logs` row, and a
 * high-priority entry in the staff notification center.
 *
 * The booking must belong to the LINE user making the call — a forged booking
 * id from another customer resolves to `booking_not_found`. Only statuses in
 * `CUSTOMER_CANCELLABLE_STATUSES` may be cancelled; nothing is written otherwise.
 *
 * Google Calendar sync is left to the caller (it is server-only and needs env).
 * No LINE push goes to the customer here — they are the actor; the caller replies.
 *
 * @throws When the `bookings` update itself fails.
 */
export async function cancelBookingByCustomer(
  admin: AdminClient,
  args: { shopId: string; companyId: string; externalLineUserId: string; bookingId: string; source: CancelSource },
): Promise<CancelByCustomerResult> {
  const { data: lineUser } = await admin
    .from('line_users')
    .select('id')
    .eq('shop_id', args.shopId)
    .eq('line_user_id', args.externalLineUserId)
    .eq('is_deleted', false)
    .maybeSingle();
  if (!lineUser) return { ok: false, reason: 'line_user_not_found' };

  const { data: booking } = await admin
    .from('bookings')
    .select('id,queue_number,booking_date,start_time,branch_id,status,note')
    .eq('id', args.bookingId)
    .eq('shop_id', args.shopId)
    .eq('line_user_id', lineUser.id)
    .eq('is_deleted', false)
    .maybeSingle();
  if (!booking) return { ok: false, reason: 'booking_not_found' };

  const result: CancelledBooking = {
    id: String(booking.id),
    queue_number: (booking.queue_number as string | null) ?? null,
    booking_date: String(booking.booking_date),
    start_time: String(booking.start_time),
    branch_id: (booking.branch_id as string | null) ?? null,
    status: String(booking.status),
  };

  if (result.status === 'cancelled') return { ok: false, reason: 'already_cancelled', booking: result };
  if (!(CUSTOMER_CANCELLABLE_STATUSES as readonly string[]).includes(result.status)) {
    return { ok: false, reason: 'not_cancellable', booking: result };
  }

  const { error } = await admin
    .from('bookings')
    .update({ status: 'cancelled', note: appendCancelNote(booking.note as string | null, args.source) })
    .eq('id', booking.id)
    .eq('shop_id', args.shopId);
  if (error) throw error;

  const label = result.queue_number ?? result.id;
  await admin.from('booking_logs').insert({
    company_id: args.companyId,
    shop_id: args.shopId,
    booking_id: booking.id,
    action: args.source === 'liff' ? 'cancel_by_customer_liff' : 'cancel_by_customer_line',
    description: `Customer cancelled booking ${label} via ${SOURCE_LABEL[args.source]}`,
  });

  await safeCreateNotification(admin, {
    companyId: args.companyId,
    shopId: args.shopId,
    branchId: result.branch_id,
    userId: null,
    type: 'booking_cancelled',
    category: 'bookings',
    priority: 'high',
    title: `${result.queue_number ?? 'Queue'} — ลูกค้ายกเลิกคิว`,
    message: `ลูกค้ายกเลิกคิว ${result.queue_number ?? ''} (${result.booking_date} ${result.start_time.slice(0, 5)}) ผ่าน ${SOURCE_LABEL[args.source]}`,
    relatedType: 'booking',
    relatedId: result.id,
    actionUrl: '/portal/bookings',
    icon: 'Cancel',
    color: '#c62828',
    metadata: { source: args.source, prev_status: result.status, next_status: 'cancelled', cancelled_by: 'customer' },
    createdBy: null,
  });

  return { ok: true, booking: result };
}
