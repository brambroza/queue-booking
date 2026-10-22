import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveShopCached } from '@/lib/line/shop-resolver';
import { cached } from '@/lib/cache/kv';
import { PUBLIC_CACHE_HEADERS } from '@/lib/cache/http';
import { clientIp, hitRateLimit, tooManyRequests } from '@/lib/security/rate-limit';
import { toBangkokStamp } from '@/lib/line/booking-reminder';
import { getBranchBookingWindow, resolveMaxBookingDate, resolveMinBookingDate } from '@/lib/booking/booking-window';
import { calendarEndDate } from '@/lib/booking/bookable-days';

const querySchema = z.object({ branch_id: z.string().uuid() });

/**
 * Rules the LIFF date calendar needs to show only bookable days of a branch:
 * today (Bangkok), the last bookable date, the weekdays with working hours
 * and the holidays in range. `/slots` and `/book` still enforce every rule.
 */
export async function GET(req: Request, { params }: { params: Promise<{ shopKey: string }> }) {
  const { shopKey } = await params;
  const parsed = querySchema.safeParse({ branch_id: new URL(req.url).searchParams.get('branch_id') });
  if (!parsed.success) return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  const branchId = parsed.data.branch_id;

  const admin = createAdminClient();
  if (!(await hitRateLimit(admin, 'liffRead', clientIp(req)))) return tooManyRequests();
  const shop = await resolveShopCached(admin, shopKey);
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  try {
    const data = await cached(`bookable-days:${shop.id}:${branchId}`, { ttlSeconds: 60 }, () => loadBookableDays(admin, shop.id, branchId));
    return NextResponse.json({ data }, { headers: PUBLIC_CACHE_HEADERS.bookableDays });
  } catch (error) {
    console.error('[bookable-days] lookup failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'โหลดวันที่เปิดจองไม่สำเร็จ กรุณาลองใหม่' }, { status: 500 });
  }
}

async function loadBookableDays(admin: ReturnType<typeof createAdminClient>, shopId: string, branchId: string) {
  const today = toBangkokStamp(new Date()).date;
  const bookingWindow = await getBranchBookingWindow(admin, shopId, branchId);
  const maxDate = resolveMaxBookingDate(today, bookingWindow);
  const minDate = resolveMinBookingDate(today, bookingWindow);
  const rangeStart = minDate ?? today;
  const rangeEnd = calendarEndDate({ today, maxDate });

  // Same scoping as /slots: a row with no branch applies to every branch.
  const [{ data: whRows, error: whError }, { data: holidayRows, error: holidayError }] = await Promise.all([
    admin
      .from('working_hours')
      .select('weekday')
      .eq('shop_id', shopId)
      .eq('active', true)
      .eq('is_deleted', false)
      .or(`branch_id.eq.${branchId},branch_id.is.null`),
    admin
      .from('holidays')
      .select('holiday_date')
      .eq('shop_id', shopId)
      .eq('is_deleted', false)
      .gte('holiday_date', rangeStart)
      .lte('holiday_date', rangeEnd)
      .or(`branch_id.is.null,branch_id.eq.${branchId}`),
  ]);

  if (whError || holidayError) throw new Error(whError?.message ?? holidayError?.message);

  const openWeekdays = Array.from(new Set((whRows ?? []).map((r) => Number(r.weekday)))).sort((a, b) => a - b);
  const holidays = Array.from(new Set((holidayRows ?? []).map((r) => String(r.holiday_date).slice(0, 10)))).sort();

  return {
    today,
    min_date: minDate,
    max_date: maxDate,
    open_weekdays: openWeekdays,
    holidays,
  };
}
