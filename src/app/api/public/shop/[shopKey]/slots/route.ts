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
  return NextResponse.json({ data: data ?? [] });
}
