import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveShopCached, type ResolvedShop } from '@/lib/line/shop-resolver';
import { cached } from '@/lib/cache/kv';
import { clientIp, hitRateLimit, tooManyRequests } from '@/lib/security/rate-limit';
import { PUBLIC_CACHE_HEADERS } from '@/lib/cache/http';
import { getShopPaymentConfig, toPublicPaymentInfo } from '@/lib/payments/settings';
import { isBookingEchoEnabled } from '@/lib/line/booking-echo';
import { isMultiSlotEnabled, isOneBookingPerDay, isServiceDurationVisible } from '@/lib/booking/display-settings';
import { getShopBookingWindows, resolveMaxBookingDate, resolveMinBookingDate } from '@/lib/booking/booking-window';
import { toBangkokStamp } from '@/lib/line/booking-reminder';
import { getFnbAccess } from '@/lib/subscription/features';
import { getShopReleaseTimes } from '@/lib/booking/booking-release';

/** Seconds the assembled payload is reused. Owner edits show up within this (plus the CDN window). */
const META_TTL_SECONDS = 30;

export async function GET(req: Request, { params }: { params: Promise<{ shopKey: string }> }) {
  const { shopKey } = await params;
  const admin = createAdminClient();
  if (!(await hitRateLimit(admin, 'liffRead', clientIp(req)))) return tooManyRequests();
  const shop = await resolveShopCached(admin, shopKey);

  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  // Every LIFF open and refresh lands here; without the cache one page load was
  // about 13 queries. The payload holds no per-customer data.
  const data = await cached(`meta:${shop.id}`, { ttlSeconds: META_TTL_SECONDS }, () => loadMeta(admin, shop));
  return NextResponse.json({ data }, { headers: PUBLIC_CACHE_HEADERS.meta });
}

async function loadMeta(admin: ReturnType<typeof createAdminClient>, shop: ResolvedShop) {
  // Photos, floor/zone and the branch venue map let the customer recognise the
  // court / room they liked last time (columns from migration 202609210001).
  // `price` is needed so LIFF can tell whether a booking costs anything and
  // therefore whether to show the payment method picker at all.
  const [
    { data: branches, error: branchesError },
    { data: services, error: servicesError },
    { data: resources, error: resourcesError },
    paymentConfig,
    bookingEchoEnabled,
    showServiceDuration,
    oneBookingPerDay,
    multiSlotEnabled,
    bookingWindows,
    fnbAccess,
    releaseTimes,
  ] = await Promise.all([
    admin.from('branches').select('id,branch_name,layout_image_url').eq('shop_id', shop.id).eq('active', true).eq('is_deleted', false),
    admin.from('services').select('id,service_name,duration_minutes,price,image_url,booking_mode,min_duration_minutes,max_duration_minutes').eq('shop_id', shop.id).eq('active', true).eq('is_deleted', false),
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
    isMultiSlotEnabled(admin, shop.id),
    // Read apart from the branch select above so the page still loads on a
    // database where migration 202609290002 has not run.
    getShopBookingWindows(admin, shop.id),
    // Plan AND owner switch; false on any failure so the booking page never breaks.
    getFnbAccess(admin, shop.id).catch(() => ({ enabled: false })),
    // Defensive read: {} before migration 202610220001.
    getShopReleaseTimes(admin, shop.id),
  ]);

  // Thrown, not returned empty: a failed read must not be cached as "no branches".
  const loadError = branchesError ?? servicesError ?? resourcesError;
  if (loadError) throw new Error(`meta lookup failed: ${loadError.message}`);

  // Resolved here with the server's Bangkok date, so the LIFF date picker's
  // maximum agrees with what /slots and /book will accept.
  const today = toBangkokStamp(new Date()).date;
  const branchesWithWindow = (branches ?? []).map((b) => ({
    ...b,
    max_booking_date: resolveMaxBookingDate(today, bookingWindows.get(String(b.id))),
    // First bookable date when later than today; null = from today.
    min_booking_date: resolveMinBookingDate(today, bookingWindows.get(String(b.id))),
    // Waiting room: LIFF counts down to this and calls nothing before it.
    booking_release_at: releaseTimes[String(b.id)] ?? null,
  }));

  return {
    // `one_booking_per_day` lets the LIFF warn before the customer picks a
    // slot; the server still enforces it on /book.
    shop: {
      ...shop,
      booking_echo_enabled: bookingEchoEnabled,
      show_service_duration: showServiceDuration,
      one_booking_per_day: oneBookingPerDay,
      multi_slot_enabled: multiSlotEnabled,
      fnb_enabled: fnbAccess.enabled,
    },
    branches: branchesWithWindow,
    services: services ?? [],
    resources: resources ?? [],
    payment: toPublicPaymentInfo(paymentConfig),
  };
}
