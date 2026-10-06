import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { applyNullableBranchScope, assertBranchAllowed } from '@/lib/auth/branch-scope';
import { createAdminClient } from '@/lib/supabase/admin';
import { FNB_ORDER_STATUSES, canTransitionFnbOrder, type FnbOrderStatus } from '@/lib/fnb/schemas';
import { safeNotifyFnbOrderStatus } from '@/lib/fnb/orders';
import { writeAuditLog } from '@/lib/audit/activity-log';

const PatchSchema = z.object({ id: z.string().uuid(), status: z.enum(FNB_ORDER_STATUSES) });

/**
 * Order board. Default = open orders (new, preparing); `status=all` adds the
 * last day of served/cancelled so staff can still look back at a closed ticket.
 */
export async function GET(req: Request) {
  try {
    const { supabase, profile, branchScope } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager', 'staff'] });
    const sp = new URL(req.url).searchParams;
    const status = sp.get('status');
    const bookingId = sp.get('booking_id');

    let query = supabase
      .from('fnb_orders')
      .select('*, fnb_order_items(id,item_name,unit_price,quantity,note), bookings(queue_number,resource_name,customers(full_name,nickname)), booking_resources(resource_name,resource_code)')
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true });
    query = applyNullableBranchScope(query, branchScope, sp.get('branch_id'));
    if (bookingId) query = query.eq('booking_id', bookingId);
    if (status && (FNB_ORDER_STATUSES as readonly string[]).includes(status)) {
      query = query.eq('status', status);
    } else if (status !== 'all') {
      query = query.in('status', ['new', 'preparing']);
    } else {
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      query = query.or(`status.in.(new,preparing),created_at.gte.${since}`);
    }
    const { data, error } = await query.limit(300);
    if (error) throw error;
    return NextResponse.json({ data: data ?? [] });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

/** Staff moves an order along (new → preparing → served, or cancelled) and the customer is told on LINE. */
export async function PATCH(req: Request) {
  try {
    const { supabase, user, profile, branchScope } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager', 'staff'] });
    const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    const { id, status } = parsed.data;
    const shopId = profile.shop_id as string;

    const { data: order } = await supabase
      .from('fnb_orders')
      .select('id,status,branch_id')
      .eq('id', id)
      .eq('shop_id', shopId)
      .eq('is_deleted', false)
      .maybeSingle();
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    if (order.branch_id) assertBranchAllowed(branchScope, order.branch_id as string);

    const from = order.status as FnbOrderStatus;
    if (from === status) return NextResponse.json({ data: { status, unchanged: true } });
    if (!canTransitionFnbOrder(from, status)) {
      return NextResponse.json({ error: 'เปลี่ยนสถานะออเดอร์นี้ไม่ได้' }, { status: 409 });
    }

    // Conditional on the status we read, so two staff tapping at once cannot both win.
    const { data: updated, error } = await supabase
      .from('fnb_orders')
      .update({ status, updated_by: user.id, served_at: status === 'served' ? new Date().toISOString() : null })
      .eq('id', id)
      .eq('shop_id', shopId)
      .eq('status', from)
      .select('id');
    if (error) throw error;
    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: 'ออเดอร์ถูกอัปเดตโดยคนอื่นแล้ว กรุณารีเฟรช' }, { status: 409 });
    }

    const notified = await safeNotifyFnbOrderStatus(createAdminClient(), { shopId, orderId: id, status });
    await writeAuditLog({
      companyId: profile.company_id,
      shopId,
      userId: user.id,
      action: 'data_updated',
      targetTable: 'fnb_orders',
      targetId: id,
      payload: { from, to: status },
    });
    return NextResponse.json({ data: { status, notified } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
