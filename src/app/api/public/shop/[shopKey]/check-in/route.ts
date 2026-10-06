import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveShopByKeyOrId } from '@/lib/line/shop-resolver';
import { checkInBookingByCustomer } from '@/lib/booking/check-in';
import { checkInDenialMessage } from '@/lib/booking/status-flow';
import { toBangkokStamp } from '@/lib/line/booking-reminder';
import { resolveLiffCaller } from '@/lib/line/liff-identity';
import { clientIp, hitRateLimit, tooManyRequests } from '@/lib/security/rate-limit';

const schema = z.object({
  line_user_id: z.string().min(1).max(64).optional(),
  /** LIFF ID token; the verified `sub` is the caller's identity. */
  id_token: z.string().max(4096).optional(),
  booking_id: z.string().uuid(),
});

/**
 * LIFF "ฉันมาถึงแล้ว": the customer declares arrival on the booking day.
 * Ownership and eligibility are enforced inside `checkInBookingByCustomer`.
 */
export async function POST(req: Request, { params }: { params: Promise<{ shopKey: string }> }) {
  const { shopKey } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  const payload = parsed.data;

  const admin = createAdminClient();
  if (!(await hitRateLimit(admin, 'liffAction', clientIp(req)))) return tooManyRequests();

  const shop = await resolveShopByKeyOrId(admin, shopKey);
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  const caller = await resolveLiffCaller(admin, shop.id, payload.line_user_id, payload.id_token);
  if (!caller.ok) return NextResponse.json({ error: caller.error }, { status: caller.status });

  const result = await checkInBookingByCustomer(admin, {
    shopId: shop.id,
    companyId: shop.company_id,
    externalLineUserId: caller.lineUserId,
    bookingId: payload.booking_id,
    todayIso: toBangkokStamp(new Date()).date,
  });
  if (!result.ok) {
    if (result.reason === 'line_user_not_found' || result.reason === 'booking_not_found') {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }
    return NextResponse.json({ error: checkInDenialMessage(result.reason) }, { status: 400 });
  }
  return NextResponse.json({ data: { ok: true, already: result.already } });
}
