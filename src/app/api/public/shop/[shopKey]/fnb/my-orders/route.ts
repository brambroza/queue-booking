import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveShopByKeyOrId } from '@/lib/line/shop-resolver';
import { resolveLiffCaller } from '@/lib/line/liff-identity';
import { clientIp, hitRateLimit, tooManyRequests } from '@/lib/security/rate-limit';

const schema = z.object({
  line_user_id: z.string().min(1).max(64).optional(),
  id_token: z.string().max(4096).optional(),
  booking_id: z.string().uuid(),
});

/**
 * LIFF: orders (and still-open call/bill requests) the caller placed for one of their own
 * bookings, so the page can show "รับออเดอร์แล้ว / เสิร์ฟแล้ว / พนักงานรับทราบ". POST because
 * the identity token is in the body.
 */
export async function POST(req: Request, { params }: { params: Promise<{ shopKey: string }> }) {
  const { shopKey } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const admin = createAdminClient();
  if (!(await hitRateLimit(admin, 'fnbRead', clientIp(req)))) return tooManyRequests();

  const shop = await resolveShopByKeyOrId(admin, shopKey);
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  const caller = await resolveLiffCaller(admin, shop.id, parsed.data.line_user_id, parsed.data.id_token);
  if (!caller.ok) return NextResponse.json({ error: caller.error }, { status: caller.status });

  const { data: lineUser } = await admin
    .from('line_users')
    .select('id')
    .eq('shop_id', shop.id)
    .eq('line_user_id', caller.lineUserId)
    .eq('is_deleted', false)
    .maybeSingle();
  if (!lineUser) return NextResponse.json({ data: [], requests: [] });

  const [{ data, error }, { data: requests }] = await Promise.all([
    admin
      .from('fnb_orders')
      .select('id,status,total_amount,note,created_at,fnb_order_items(item_name,unit_price,quantity)')
      .eq('shop_id', shop.id)
      .eq('booking_id', parsed.data.booking_id)
      .eq('line_user_id', lineUser.id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(50),
    // Requests the customer can still see the state of: staff have not closed them yet.
    admin
      .from('fnb_service_requests')
      .select('id,request_type,status,total_amount,created_at')
      .eq('shop_id', shop.id)
      .eq('booking_id', parsed.data.booking_id)
      .eq('line_user_id', lineUser.id)
      .eq('is_deleted', false)
      .in('status', ['open', 'acknowledged']),
  ]);
  if (error) {
    console.error('[fnb_my_orders_failed]', error.message);
    return NextResponse.json({ data: [], requests: [] });
  }
  return NextResponse.json({ data: data ?? [], requests: requests ?? [] });
}
