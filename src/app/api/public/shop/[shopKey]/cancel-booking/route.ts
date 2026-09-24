import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveShopByKeyOrId } from '@/lib/line/shop-resolver';
import { safeSyncBookingToGoogleCalendar } from '@/lib/google-calendar/sync';
import { cancelBookingByCustomer } from '@/lib/booking/cancel-by-customer';

const schema = z.object({
  line_user_id: z.string().min(1),
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
  const shop = await resolveShopByKeyOrId(admin, shopKey);
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  let result: Awaited<ReturnType<typeof cancelBookingByCustomer>>;
  try {
    result = await cancelBookingByCustomer(admin, {
      shopId: shop.id,
      companyId: shop.company_id,
      externalLineUserId: payload.line_user_id,
      bookingId: payload.booking_id,
      source: 'liff',
    });
  } catch (e) {
    console.error('[cancel_booking_failed]', e);
    return NextResponse.json({ error: 'Cancel failed' }, { status: 500 });
  }

  if (!result.ok) {
    if (result.reason === 'line_user_not_found') return NextResponse.json({ error: 'Line user not found' }, { status: 404 });
    if (result.reason === 'booking_not_found') return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    return NextResponse.json({ error: 'This booking cannot be cancelled' }, { status: 400 });
  }

  await safeSyncBookingToGoogleCalendar(shop.id, result.booking.id);

  return NextResponse.json({ data: true });
}
