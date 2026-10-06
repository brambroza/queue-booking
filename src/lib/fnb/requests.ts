import type { createAdminClient } from '@/lib/supabase/admin';
import { pushMessage } from '@/lib/line/client';
import { safeCreateNotification } from '@/lib/notifications/createNotification';
import { loadBill } from '@/lib/fnb/bill';
import { FNB_ORDERABLE_BOOKING_STATUSES, type FnbRequestStatus, type FnbRequestType } from '@/lib/fnb/schemas';

type AdminClient = ReturnType<typeof createAdminClient>;

export type CreateRequestResult =
  | { ok: true; requestId: string | null; already: boolean }
  | { ok: false; reason: 'line_user_not_found' | 'booking_not_found' | 'booking_not_orderable' | 'insert_failed' };

/**
 * Records a "call staff" or "check bill" request for the verified LINE user.
 *
 * Same eligibility as ordering (booking is the caller's, on site, today). A
 * second tap while a request of that type is still `open` is not an error: the
 * unique index rejects the insert (23505) and the caller gets `already: true`,
 * so a double tap never creates two tickets or two staff notifications.
 *
 * A bill request snapshots the estimate the customer saw.
 */
export async function createFnbRequest(
  admin: AdminClient,
  args: { shopId: string; companyId: string; externalLineUserId: string; todayIso: string; bookingId: string; type: FnbRequestType },
): Promise<CreateRequestResult> {
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
    .select('id,queue_number,booking_date,status,branch_id,resource_id,resource_name')
    .eq('id', args.bookingId)
    .eq('shop_id', args.shopId)
    .eq('line_user_id', lineUser.id)
    .eq('is_deleted', false)
    .maybeSingle();
  if (!booking) return { ok: false, reason: 'booking_not_found' };
  if (String(booking.booking_date) !== args.todayIso || !FNB_ORDERABLE_BOOKING_STATUSES.includes(String(booking.status))) {
    return { ok: false, reason: 'booking_not_orderable' };
  }

  const bill = args.type === 'bill' ? await loadBill(admin, { shopId: args.shopId, bookingId: args.bookingId }) : null;

  const { data: created, error } = await admin
    .from('fnb_service_requests')
    .insert({
      company_id: args.companyId,
      shop_id: args.shopId,
      branch_id: booking.branch_id ?? null,
      booking_id: booking.id,
      resource_id: booking.resource_id ?? null,
      line_user_id: lineUser.id,
      request_type: args.type,
      status: 'open',
      booking_amount: bill ? (bill.booking_paid ? 0 : bill.booking_amount) : null,
      fnb_amount: bill ? bill.fnb_total : null,
      total_amount: bill ? bill.due_total : null,
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') return { ok: true, requestId: null, already: true };
    return { ok: false, reason: 'insert_failed' };
  }

  const where = (booking.resource_name as string | null) || (booking.queue_number as string | null) || 'ลูกค้า';
  await safeCreateNotification(admin, {
    companyId: args.companyId,
    shopId: args.shopId,
    branchId: (booking.branch_id as string | null) ?? null,
    userId: null,
    type: 'booking_updated',
    category: 'bookings',
    priority: 'high',
    title: args.type === 'bill' ? `ขอเช็คบิล — ${where}` : `เรียกพนักงาน — ${where}`,
    message:
      args.type === 'bill' && bill
        ? `ยอดโดยประมาณ ${bill.due_total.toLocaleString('th-TH')} บาท`
        : 'ลูกค้ากดเรียกพนักงานจากบูท',
    relatedType: 'booking',
    relatedId: String(booking.id),
    actionUrl: '/portal/fnb-orders',
    icon: args.type === 'bill' ? 'Receipt' : 'NotificationsActive',
    color: '#d32f2f',
    metadata: { fnb_request_id: created?.id, request_type: args.type },
    createdBy: null,
  });

  return { ok: true, requestId: created ? String(created.id) : null, already: false };
}

const ACK_TEXT: Record<FnbRequestType, string> = {
  call_staff: 'พนักงานรับทราบแล้ว กำลังไปที่บูทของคุณค่ะ',
  bill: 'ร้านรับเรื่องเช็คบิลแล้ว พนักงานจะนำบิลไปให้ที่บูทค่ะ',
};

/**
 * Tells the customer on LINE that staff acknowledged their request. Never
 * throws; a missing LINE user, token or a LINE failure must not undo staff's tap.
 */
export async function safeNotifyFnbRequestStatus(
  admin: AdminClient,
  args: { shopId: string; requestId: string; status: FnbRequestStatus },
): Promise<boolean> {
  try {
    if (args.status !== 'acknowledged') return false;
    const { data: req } = await admin
      .from('fnb_service_requests')
      .select('line_user_id,request_type')
      .eq('id', args.requestId)
      .eq('shop_id', args.shopId)
      .maybeSingle();
    if (!req?.line_user_id) return false;
    const [{ data: lineUser }, { data: shop }] = await Promise.all([
      admin.from('line_users').select('line_user_id').eq('id', req.line_user_id).eq('shop_id', args.shopId).maybeSingle(),
      admin.from('shops').select('name,line_channel_access_token').eq('id', args.shopId).maybeSingle(),
    ]);
    const to = (lineUser as { line_user_id?: string | null } | null)?.line_user_id;
    const token = (shop as { line_channel_access_token?: string | null } | null)?.line_channel_access_token || process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
    if (!to || !token) return false;
    const shopName = (shop as { name?: string | null } | null)?.name ?? 'ร้าน';
    await pushMessage(token, to, [{ type: 'text', text: `${shopName}\n${ACK_TEXT[req.request_type as FnbRequestType]}` }]);
    return true;
  } catch (e) {
    console.error('[fnb_request_notify_failed]', e instanceof Error ? e.message : e);
    return false;
  }
}
