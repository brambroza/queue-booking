import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveShopByKeyOrId } from '@/lib/line/shop-resolver';
import { getShopPaymentConfig, toPublicPaymentInfo } from '@/lib/payments/settings';
import { isBookingEchoEnabled } from '@/lib/line/booking-echo';
import { isOneBookingPerDay, isServiceDurationVisible } from '@/lib/booking/display-settings';
import { getShopBookingWindows, resolveMaxBookingDate } from '@/lib/booking/booking-window';
import { toBangkokStamp } from '@/lib/line/booking-reminder';

export async function GET(_: Request, { params }: { params: Promise<{ shopKey: string }> }) {
  const { shopKey } = await params;
  const admin = createAdminClient();
  const shop = await resolveShopByKeyOrId(admin, shopKey);

  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  // Photos, floor/zone and the branch venue map let the customer recognise the
  // court / room they liked last time (columns from migration 202609210001).
  // `price` is needed so LIFF can tell whether a booking costs anything and
  // therefore whether to show the payment method picker at all.
  const [
    { data: branches },
    { data: services },
    { data: resources },
    paymentConfig,
    bookingEchoEnabled,
    showServiceDuration,
    oneBookingPerDay,
    bookingWindows,
  ] = await Promise.all([
    admin.from('branches').select('id,branch_name,layout_image_url').eq('shop_id', shop.id).eq('active', true).eq('is_deleted', false),
    admin.from('services').select('id,service_name,duration_minutes,price,image_url').eq('shop_id', shop.id).eq('active', true).eq('is_deleted', false),
    admin
      .from('booking_resources')
      .select('id,branch_id,resource_name,resource_code,resource_type,capacity,unit_price,service_ids,image_urls,floor,zone,description')
      .eq('shop_id', shop.id)
      .eq('active', true)
      .eq('is_deleted', false)
      .order('resource_name', { ascending: true }),
    getShopPaymentConfig(admin, shop.id),
    isBookingEchoEnabled(admin, shop.id),
    isServiceDurationVisible(admin, shop.id),
    isOneBookingPerDay(admin, shop.id),
    // Read apart from the branch select above so the page still loads on a
    // database where migration 202609290002 has not run.
    getShopBookingWindows(admin, shop.id),
  ]);

  // Resolved here with the server's Bangkok date, so the LIFF date picker's
  // maximum agrees with what /slots and /book will accept.
  const today = toBangkokStamp(new Date()).date;
  const branchesWithWindow = (branches ?? []).map((b) => ({
    ...b,
    max_booking_date: resolveMaxBookingDate(today, bookingWindows.get(String(b.id))),
  }));

  return NextResponse.json({
    data: {
      // `one_booking_per_day` lets the LIFF warn before the customer picks a
      // slot; the server still enforces it on /book.
      shop: {
        ...shop,
        booking_echo_enabled: bookingEchoEnabled,
        show_service_duration: showServiceDuration,
        one_booking_per_day: oneBookingPerDay,
      },
      branches: branchesWithWindow,
      services: services ?? [],
      resources: resources ?? [],
      payment: toPublicPaymentInfo(paymentConfig),
    },
  });
}
