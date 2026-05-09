import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveShopByKeyOrId } from '@/lib/line/shop-resolver';

export async function GET(_: Request, { params }: { params: Promise<{ shopKey: string }> }) {
  const { shopKey } = await params;
  const admin = createAdminClient();
  const shop = await resolveShopByKeyOrId(admin, shopKey);

  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  const [{ data: branches }, { data: services }] = await Promise.all([
    admin.from('branches').select('id,branch_name').eq('shop_id', shop.id).eq('active', true).eq('is_deleted', false),
    admin.from('services').select('id,service_name,duration_minutes').eq('shop_id', shop.id).eq('active', true).eq('is_deleted', false),
  ]);

  return NextResponse.json({ data: { shop, branches: branches ?? [], services: services ?? [] } });
}
