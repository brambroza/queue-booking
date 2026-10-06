import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveShopByKeyOrId } from '@/lib/line/shop-resolver';
import { getFnbAccess } from '@/lib/subscription/features';
import { clientIp, hitRateLimit, tooManyRequests } from '@/lib/security/rate-limit';

/**
 * Public menu for the LIFF order page. Returns `enabled: false` with an empty
 * list when the owner switch is off or the plan is below Professional, so the
 * page can simply hide the feature. Optional `?branch_id=` narrows to items
 * sold at that branch (plus shop-wide items).
 */
export async function GET(req: Request, { params }: { params: Promise<{ shopKey: string }> }) {
  const { shopKey } = await params;
  const admin = createAdminClient();
  if (!(await hitRateLimit(admin, 'fnbRead', clientIp(req)))) return tooManyRequests();

  const shop = await resolveShopByKeyOrId(admin, shopKey);
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  const access = await getFnbAccess(admin, shop.id);
  if (!access.enabled) return NextResponse.json({ data: { enabled: false, items: [] } });

  const branchId = new URL(req.url).searchParams.get('branch_id');
  let query = admin
    .from('fnb_menu_items')
    .select('id,category,item_name,description,price,image_url,is_available,branch_id,sort_order')
    .eq('shop_id', shop.id)
    .eq('active', true)
    .eq('is_deleted', false)
    .order('category', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('item_name', { ascending: true });
  if (branchId && /^[0-9a-f-]{36}$/i.test(branchId)) query = query.or(`branch_id.is.null,branch_id.eq.${branchId}`);

  const { data, error } = await query.limit(300);
  if (error) {
    console.error('[fnb_public_menu_failed]', error.message);
    return NextResponse.json({ data: { enabled: false, items: [] } });
  }
  return NextResponse.json({ data: { enabled: true, items: data ?? [] } });
}
