import type { createAdminClient } from '@/lib/supabase/admin';
import { pushMessage } from '@/lib/line/client';
import { safeCreateNotification } from '@/lib/notifications/createNotification';
import { FNB_ORDERABLE_BOOKING_STATUSES, type FnbOrderCreateInput, type FnbOrderStatus } from '@/lib/fnb/schemas';

type AdminClient = ReturnType<typeof createAdminClient>;

export type PlaceOrderResult =
  | { ok: true; orderId: string; total: number }
  | {
      ok: false;
      reason: 'line_user_not_found' | 'booking_not_found' | 'booking_not_orderable' | 'item_unavailable' | 'insert_failed';
    };

type MenuRow = {
  id: string;
  item_name: string;
  price: number | string;
  branch_id: string | null;
  is_available: boolean;
};

/**
 * Places an order for a booking on behalf of the verified LINE user.
 *
 * The booking must belong to that user, be on site today (checked in or being
 * served) and every line must be a live, available item of this shop sold at
 * the booking's branch. Unit prices and the total always come from the
 * database, never from the request.
 *
 * supabase-js has no multi-statement transaction, so if the line insert fails
 * the just-created order is soft-deleted rather than left empty on the board.
 */
export async function placeFnbOrder(
  admin: AdminClient,
  args: { shopId: string; companyId: string; externalLineUserId: string; todayIso: string; input: FnbOrderCreateInput },
): Promise<PlaceOrderResult> {
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
    .eq('id', args.input.booking_id)
    .eq('shop_id', args.shopId)
    .eq('line_user_id', lineUser.id)
    .eq('is_deleted', false)
    .maybeSingle();
  if (!booking) return { ok: false, reason: 'booking_not_found' };
  if (String(booking.booking_date) !== args.todayIso || !FNB_ORDERABLE_BOOKING_STATUSES.includes(String(booking.status))) {
    return { ok: false, reason: 'booking_not_orderable' };
  }

  // Merge duplicate lines so one item appears once on the ticket.
  const wanted = new Map<string, { quantity: number; note: string | null }>();
  for (const line of args.input.items) {
    const prev = wanted.get(line.menu_item_id);
    wanted.set(line.menu_item_id, {
      quantity: Math.min(99, (prev?.quantity ?? 0) + line.quantity),
      note: line.note ?? prev?.note ?? null,
    });
  }

  const { data: menuRows } = await admin
    .from('fnb_menu_items')
    .select('id,item_name,price,branch_id,is_available')
    .eq('shop_id', args.shopId)
    .eq('active', true)
    .eq('is_deleted', false)
    .in('id', Array.from(wanted.keys()));
  const menu = new Map(((menuRows ?? []) as MenuRow[]).map((m) => [m.id, m]));
  const branchId = (booking.branch_id as string | null) ?? null;

  for (const id of wanted.keys()) {
    const item = menu.get(id);
    if (!item || !item.is_available || (item.branch_id && item.branch_id !== branchId)) {
      return { ok: false, reason: 'item_unavailable' };
    }
  }

  const lines = Array.from(wanted.entries()).map(([id, w]) => {
    const item = menu.get(id) as MenuRow;
    return { menu_item_id: id, item_name: item.item_name, unit_price: Number(item.price), quantity: w.quantity, note: w.note };
  });
  const total = Math.round(lines.reduce((sum, l) => sum + l.unit_price * l.quantity, 0) * 100) / 100;

  const { data: order, error: orderError } = await admin
    .from('fnb_orders')
    .insert({
      company_id: args.companyId,
      shop_id: args.shopId,
      branch_id: branchId,
      booking_id: booking.id,
      resource_id: booking.resource_id ?? null,
      line_user_id: lineUser.id,
      status: 'new',
      total_amount: total,
      note: args.input.note ?? null,
    })
    .select('id')
    .single();
  if (orderError || !order) return { ok: false, reason: 'insert_failed' };

  const { error: itemsError } = await admin.from('fnb_order_items').insert(
    lines.map((l) => ({ ...l, company_id: args.companyId, shop_id: args.shopId, order_id: order.id })),
  );
  if (itemsError) {
    await admin.from('fnb_orders').update({ is_deleted: true }).eq('id', order.id).eq('shop_id', args.shopId);
    return { ok: false, reason: 'insert_failed' };
  }

  const where = (booking.resource_name as string | null) || (booking.queue_number as string | null) || 'ลูกค้า';
  const count = lines.reduce((sum, l) => sum + l.quantity, 0);
  await safeCreateNotification(admin, {
    companyId: args.companyId,
    shopId: args.shopId,
    branchId,
    userId: null,
    type: 'booking_updated',
    category: 'bookings',
    priority: 'high',
    title: `ออเดอร์ใหม่ — ${where}`,
    message: `${count} รายการ รวม ${total.toLocaleString('th-TH')} บาท`,
    relatedType: 'booking',
    relatedId: String(booking.id),
    actionUrl: '/portal/fnb-orders',
    icon: 'Restaurant',
    color: '#ed6c02',
    metadata: { fnb_order_id: order.id },
    createdBy: null,
  });

  return { ok: true, orderId: String(order.id), total };
}

const STATUS_NOTICE: Partial<Record<FnbOrderStatus, string>> = {
  preparing: 'ร้านรับออเดอร์แล้ว กำลังเตรียมให้ค่ะ',
  served: 'เสิร์ฟออเดอร์เรียบร้อยแล้ว ขอให้อร่อยค่ะ',
  cancelled: 'ขออภัย ร้านยกเลิกออเดอร์ของคุณ หากมีข้อสงสัยกรุณาติดต่อพนักงาน',
};

/**
 * Tells the customer on LINE that their order moved. Never throws: a customer
 * without LINE, a shop without a token or a LINE API failure must not undo the
 * status change staff just made.
 */
export async function safeNotifyFnbOrderStatus(
  admin: AdminClient,
  args: { shopId: string; orderId: string; status: FnbOrderStatus },
): Promise<boolean> {
  try {
    const text = STATUS_NOTICE[args.status];
    if (!text) return false;
    const { data: order } = await admin
      .from('fnb_orders')
      .select('line_user_id,total_amount')
      .eq('id', args.orderId)
      .eq('shop_id', args.shopId)
      .maybeSingle();
    if (!order?.line_user_id) return false;
    const [{ data: lineUser }, { data: shop }] = await Promise.all([
      admin.from('line_users').select('line_user_id').eq('id', order.line_user_id).eq('shop_id', args.shopId).maybeSingle(),
      admin.from('shops').select('name,line_channel_access_token').eq('id', args.shopId).maybeSingle(),
    ]);
    const to = (lineUser as { line_user_id?: string | null } | null)?.line_user_id;
    const token = (shop as { line_channel_access_token?: string | null } | null)?.line_channel_access_token || process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
    if (!to || !token) return false;
    const shopName = (shop as { name?: string | null } | null)?.name ?? 'ร้าน';
    await pushMessage(token, to, [{ type: 'text', text: `${shopName}\n${text}` }]);
    return true;
  } catch (e) {
    console.error('[fnb_order_notify_failed]', e instanceof Error ? e.message : e);
    return false;
  }
}
