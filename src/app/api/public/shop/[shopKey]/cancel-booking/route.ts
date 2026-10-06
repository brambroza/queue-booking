import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveShopByKeyOrId } from '@/lib/line/shop-resolver';
import { safeSyncBookingToGoogleCalendar } from '@/lib/google-calendar/sync';
import { cancelBookingByCustomer } from '@/lib/booking/cancel-by-customer';
import { resolveLiffCaller } from '@/lib/line/liff-identity';
import { clientIp, hitRateLimit, tooManyRequests } from '@/lib/security/rate-limit';

const schema = z.object({
  line_user_id: z.string().min(1).max(64).optional(),
  /** LIFF ID token; the verified `sub` is the caller's identity. */
  id_token: z.string().max(4096).optional(),
  booking_id: z.string().uuid(),
});

/**
 * LIFF account tab "ยกเลิกคิว". Ownership, status guard, log and staff
 * notification live in `cancelBookingByCustomer`, shared with the LINE
 * Flex postback so both surfaces cancel identically.
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

  let result: Awaited<ReturnType<typeof cancelBookingByCustomer>>;
  try {
    result = await cancelBookingByCustomer(admin, {
      shopId: shop.id,
      companyId: shop.company_id,
      externalLineUserId: caller.lineUserId,
      bookingId: payload.booking_id,
      source: 'liff',
    });
  } catch (e) {
    console.error('[cancel_booking_failed]', e);
    return NextResponse.json({ error: 'Cancel failed' }, { status: 500 });
  }

  if (!result.ok) {
    // One 404 for "no such user" and "no such booking": no ownership oracle.
    if (result.reason === 'line_user_not_found' || result.reason === 'booking_not_found') {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'This booking cannot be cancelled' }, { status: 400 });
  }

  await safeSyncBookingToGoogleCalendar(shop.id, result.booking.id);

  return NextResponse.json({ data: true });
}
