import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveShopByKeyOrId } from '@/lib/line/shop-resolver';
import { resolveLiffCaller } from '@/lib/line/liff-identity';
import { toBangkokStamp } from '@/lib/line/booking-reminder';
import { getFnbAccess } from '@/lib/subscription/features';
import { fnbOrderCreateSchema } from '@/lib/fnb/schemas';
import { placeFnbOrder } from '@/lib/fnb/orders';
import { clientIp, hitRateLimit, tooManyRequests } from '@/lib/security/rate-limit';

const DENIAL: Record<'line_user_not_found' | 'booking_not_found' | 'booking_not_orderable' | 'item_unavailable' | 'insert_failed', { status: number; error: string }> = {
  line_user_not_found: { status: 404, error: 'Booking not found' },
  booking_not_found: { status: 404, error: 'Booking not found' },
  booking_not_orderable: { status: 400, error: 'สั่งอาหารได้เมื่อเช็คอินแล้วและอยู่ในวันที่จองเท่านั้น' },
  item_unavailable: { status: 409, error: 'มีเมนูที่หมดหรือถูกปิดขาย กรุณารีเฟรชเมนูแล้วสั่งใหม่' },
  insert_failed: { status: 500, error: 'ส่งออเดอร์ไม่สำเร็จ กรุณาลองใหม่' },
};

/** LIFF: the checked-in customer sends an order for their booking. */
export async function POST(req: Request, { params }: { params: Promise<{ shopKey: string }> }) {
  const { shopKey } = await params;
  const parsed = fnbOrderCreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid payload' }, { status: 400 });
  }
  const payload = parsed.data;

  const admin = createAdminClient();
  if (!(await hitRateLimit(admin, 'liffAction', clientIp(req)))) return tooManyRequests();

  const shop = await resolveShopByKeyOrId(admin, shopKey);
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  const access = await getFnbAccess(admin, shop.id);
  if (!access.enabled) return NextResponse.json({ error: 'ร้านนี้ยังไม่เปิดให้สั่งอาหารผ่าน LINE' }, { status: 403 });

  const caller = await resolveLiffCaller(admin, shop.id, payload.line_user_id, payload.id_token);
  if (!caller.ok) return NextResponse.json({ error: caller.error }, { status: caller.status });

  const result = await placeFnbOrder(admin, {
    shopId: shop.id,
    companyId: shop.company_id,
    externalLineUserId: caller.lineUserId,
    todayIso: toBangkokStamp(new Date()).date,
    input: payload,
  });
  if (!result.ok) {
    const d = DENIAL[result.reason];
    return NextResponse.json({ error: d.error }, { status: d.status });
  }
  return NextResponse.json({ data: { order_id: result.orderId, total: result.total } });
}
