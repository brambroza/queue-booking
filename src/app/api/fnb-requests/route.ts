import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { applyNullableBranchScope, assertBranchAllowed } from '@/lib/auth/branch-scope';
import { createAdminClient } from '@/lib/supabase/admin';
import { FNB_REQUEST_STATUSES, canTransitionFnbRequest, type FnbRequestStatus } from '@/lib/fnb/schemas';
import { safeNotifyFnbRequestStatus } from '@/lib/fnb/requests';
import { writeAuditLog } from '@/lib/audit/activity-log';

const PatchSchema = z.object({ id: z.string().uuid(), status: z.enum(FNB_REQUEST_STATUSES) });

/** Customer requests still needing staff: `open` and `acknowledged`. */
export async function GET(req: Request) {
  try {
    const { supabase, profile, branchScope } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager', 'staff'] });
    let query = supabase
      .from('fnb_service_requests')
      .select('*, bookings(queue_number,resource_name,customers(full_name,nickname)), booking_resources(resource_name,resource_code)')
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false)
      .in('status', ['open', 'acknowledged'])
      .order('created_at', { ascending: true });
    query = applyNullableBranchScope(query, branchScope, new URL(req.url).searchParams.get('branch_id'));
    const { data, error } = await query.limit(200);
    if (error) throw error;
    return NextResponse.json({ data: data ?? [] });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

/** Staff acknowledges (customer gets a LINE message) or closes a request. */
export async function PATCH(req: Request) {
  try {
    const { supabase, user, profile, branchScope } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager', 'staff'] });
    const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    const { id, status } = parsed.data;
    const shopId = profile.shop_id as string;

    const { data: current } = await supabase
      .from('fnb_service_requests')
      .select('id,status,branch_id')
      .eq('id', id)
      .eq('shop_id', shopId)
      .eq('is_deleted', false)
      .maybeSingle();
    if (!current) return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    if (current.branch_id) assertBranchAllowed(branchScope, current.branch_id as string);

    const from = current.status as FnbRequestStatus;
    if (from === status) return NextResponse.json({ data: { status, unchanged: true } });
    if (!canTransitionFnbRequest(from, status)) return NextResponse.json({ error: 'เปลี่ยนสถานะคำขอนี้ไม่ได้' }, { status: 409 });

    const now = new Date().toISOString();
    // Conditional on the status we read, so two staff tapping at once cannot both win.
    const { data: updated, error } = await supabase
      .from('fnb_service_requests')
      .update({
        status,
        updated_by: user.id,
        ...(status === 'acknowledged' ? { acknowledged_at: now } : {}),
        ...(status === 'closed' ? { closed_at: now } : {}),
      })
      .eq('id', id)
      .eq('shop_id', shopId)
      .eq('status', from)
      .select('id');
    if (error) throw error;
    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: 'คำขอถูกอัปเดตโดยคนอื่นแล้ว กรุณารีเฟรช' }, { status: 409 });
    }

    const notified = await safeNotifyFnbRequestStatus(createAdminClient(), { shopId, requestId: id, status });
    await writeAuditLog({
      companyId: profile.company_id,
      shopId,
      userId: user.id,
      action: 'data_updated',
      targetTable: 'fnb_service_requests',
      targetId: id,
      payload: { from, to: status },
    });
    return NextResponse.json({ data: { status, notified } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
