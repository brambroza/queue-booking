import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveShopByKeyOrId } from '@/lib/line/shop-resolver';
import { resolveLiffCaller } from '@/lib/line/liff-identity';
import { getFnbAccess } from '@/lib/subscription/features';
import { loadBill } from '@/lib/fnb/bill';
import { clientIp, hitRateLimit, tooManyRequests } from '@/lib/security/rate-limit';

const schema = z.object({
  line_user_id: z.string().min(1).max(64).optional(),
  id_token: z.string().max(4096).optional(),
  booking_id: z.string().uuid(),
});

/**
 * LIFF: bill summary (bay fee + food) for one of the caller's own bookings.
 * Read-only and an estimate: staff confirm the final amount at the table.
 */
export async function POST(req: Request, { params }: { params: Promise<{ shopKey: string }> }) {
  const { shopKey } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const admin = createAdminClient();
  if (!(await hitRateLimit(admin, 'fnbRead', clientIp(req)))) return tooManyRequests();

  const shop = await resolveShopByKeyOrId(admin, shopKey);
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
  const access = await getFnbAccess(admin, shop.id);
  if (!access.enabled) return NextResponse.json({ error: 'ร้านนี้ยังไม่เปิดบริการสั่งอาหารผ่าน LINE' }, { status: 403 });

  const caller = await resolveLiffCaller(admin, shop.id, parsed.data.line_user_id, parsed.data.id_token);
  if (!caller.ok) return NextResponse.json({ error: caller.error }, { status: caller.status });

  const { data: lineUser } = await admin
    .from('line_users')
    .select('id')
    .eq('shop_id', shop.id)
    .eq('line_user_id', caller.lineUserId)
    .eq('is_deleted', false)
    .maybeSingle();
  if (!lineUser) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

  // Ownership first: only the booking's own LINE user may read its bill.
  const { data: own } = await admin
    .from('bookings')
    .select('id')
    .eq('id', parsed.data.booking_id)
    .eq('shop_id', shop.id)
    .eq('line_user_id', lineUser.id)
    .eq('is_deleted', false)
    .maybeSingle();
  if (!own) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

  const bill = await loadBill(admin, { shopId: shop.id, bookingId: parsed.data.booking_id });
  if (!bill) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  return NextResponse.json({ data: bill });
}
