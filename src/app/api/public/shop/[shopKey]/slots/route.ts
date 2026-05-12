import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveShopByKeyOrId } from '@/lib/line/shop-resolver';

export async function GET(req: Request, { params }: { params: Promise<{ shopKey: string }> }) {
  const { shopKey } = await params;
  const { searchParams } = new URL(req.url);
  const branchId = searchParams.get('branch_id');
  const serviceId = searchParams.get('service_id');
  const date = searchParams.get('date');
  const resourceType = searchParams.get('resource_type');
  const resourceId = searchParams.get('resource_id');
  const partySize = searchParams.get('party_size');

  if (!branchId || !serviceId || !date) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  const admin = createAdminClient();
  const shop = await resolveShopByKeyOrId(admin, shopKey);
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  const weekday = new Date(`${date}T00:00:00+07:00`).getDay();

  const [{ data: holidayRows }, { data: whRows }] = await Promise.all([
    admin
      .from('holidays')
      .select('id')
      .eq('shop_id', shop.id)
      .eq('holiday_date', date)
      .eq('is_deleted', false)
      .or(`branch_id.is.null,branch_id.eq.${branchId}`)
      .limit(1),
    admin
      .from('working_hours')
      .select('id')
      .eq('shop_id', shop.id)
      .eq('weekday', weekday)
      .eq('active', true)
      .eq('is_deleted', false)
      .or(`branch_id.eq.${branchId},branch_id.is.null`)
      .limit(1),
  ]);

  const { data, error } = await admin.rpc('get_available_slots', {
    p_shop_id: shop.id,
    p_branch_id: branchId,
    p_service_id: serviceId,
    p_date: date,
    p_resource_type: resourceType || null,
    p_party_size: partySize ? Number(partySize) : null,
    p_resource_id: resourceId || null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const slots = data ?? [];
  const isHoliday = Boolean(holidayRows && holidayRows.length > 0);
  const hasWorkingHours = Boolean(whRows && whRows.length > 0);

  let reason: 'ok' | 'holiday' | 'closed' | 'full' = 'ok';
  let hint = '';
  if (isHoliday) {
    reason = 'holiday';
    hint = 'วันดังกล่าวเป็นวันหยุดของสาขา';
  } else if (!hasWorkingHours) {
    reason = 'closed';
    hint = 'สาขานี้ปิดทำการในวันที่เลือก';
  } else if (slots.length === 0) {
    reason = 'full';
    hint = 'คิวเต็มหรือไม่มีช่วงเวลาว่างในวันที่เลือก';
  }

  return NextResponse.json({
    data: slots,
    meta: {
      reason,
      hint,
      has_working_hours: hasWorkingHours,
      is_holiday: isHoliday,
    },
  });
}
