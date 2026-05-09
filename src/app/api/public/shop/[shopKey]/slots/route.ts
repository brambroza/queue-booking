import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: Request, { params }: { params: Promise<{ shopKey: string }> }) {
  const { shopKey } = await params;
  const { searchParams } = new URL(req.url);
  const branchId = searchParams.get('branch_id');
  const serviceId = searchParams.get('service_id');
  const date = searchParams.get('date');

  if (!branchId || !serviceId || !date) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: shop } = await admin.from('shops').select('id').eq('shop_key', shopKey).single();
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  const { data, error } = await admin.rpc('get_available_slots', {
    p_shop_id: shop.id,
    p_branch_id: branchId,
    p_service_id: serviceId,
    p_date: date,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data: data ?? [] });
}
