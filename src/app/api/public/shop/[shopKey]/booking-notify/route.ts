import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveShopByKeyOrId } from '@/lib/line/shop-resolver';
import { resolveLiffCaller } from '@/lib/line/liff-identity';
import { pushMessage } from '@/lib/line/client';
import { needsDelivery } from '@/lib/line/booking-delivery';
import { buildBookingDeliveryMessages, claimBookingDelivery, releaseBookingDelivery } from '@/lib/line/booking-messages-server';
import { clientIp, hitRateLimit, tooManyRequests } from '@/lib/security/rate-limit';

const schema = z.object({
  line_user_id: z.string().min(1).max(64).optional(),
  /** LIFF ID token; the verified `sub` is the caller's identity. */
  id_token: z.string().max(4096).optional(),
  booking_id: z.string().uuid(),
});

/**
 * Fallback delivery of the booking cards. `/book` sends no push when the LIFF
 * client promised to echo "ยืนยันคิว …" into the chat (the webhook then replies
 * for free). When that echo cannot be sent — `liff.sendMessages` threw, scope
 * missing, user declined — the client calls this and the cards go out as one
 * push. Idempotent: a booking already delivered (echo reply, earlier push) is
 * a no-op, and only bookings younger than 10 minutes qualify.
 */
export async function POST(req: Request, { params }: { params: Promise<{ shopKey: string }> }) {
  const { shopKey } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const admin = createAdminClient();
  if (!(await hitRateLimit(admin, 'liffAction', clientIp(req)))) return tooManyRequests();

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
  if (!lineUser) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

  const { data: booking } = await admin
    .from('bookings')
    .select('id,created_at,last_line_notify_at')
    .eq('id', parsed.data.booking_id)
    .eq('shop_id', shop.id)
    .eq('line_user_id', lineUser.id)
    .eq('is_deleted', false)
    .maybeSingle();
  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

  if (!needsDelivery({ created_at: String(booking.created_at), last_line_notify_at: (booking.last_line_notify_at as string | null) ?? null }, new Date())) {
    return NextResponse.json({ data: { sent: false, reason: 'already_delivered' } });
  }

  const { data: shopRow } = await admin.from('shops').select('line_channel_access_token').eq('id', shop.id).maybeSingle();
  const token = (shopRow as { line_channel_access_token?: string | null } | null)?.line_channel_access_token || process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
  if (!token) return NextResponse.json({ data: { sent: false, reason: 'no_token' } });

  const delivery = await buildBookingDeliveryMessages(admin, { shopId: shop.id, bookingId: String(booking.id) });
  if (!delivery || delivery.messages.length === 0) return NextResponse.json({ data: { sent: false, reason: 'nothing_to_send' } });

  const claimed = await claimBookingDelivery(admin, shop.id, delivery.bookingIds);
  if (!claimed) return NextResponse.json({ data: { sent: false, reason: 'already_delivered' } });

  try {
    await pushMessage(token, caller.lineUserId, delivery.messages);
  } catch (e) {
    await releaseBookingDelivery(admin, shop.id, delivery.bookingIds);
    console.error('[booking-notify] push failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ data: { sent: false, reason: 'push_failed' } });
  }

  await admin.from('booking_logs').insert({
    company_id: shop.company_id,
    shop_id: shop.id,
    booking_id: delivery.payingBookingId,
    action: 'line_delivered_by_push',
    description: `Booking cards pushed (echo fallback) for ${delivery.bookingIds.length} queue(s)`,
  });
  return NextResponse.json({ data: { sent: true } });
}
