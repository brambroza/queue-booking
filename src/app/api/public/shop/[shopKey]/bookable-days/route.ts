import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveShopByKeyOrId } from '@/lib/line/shop-resolver';
import { toBangkokStamp } from '@/lib/line/booking-reminder';
import { getBranchBookingWindow, resolveMaxBookingDate } from '@/lib/booking/booking-window';
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
  const shop = await resolveShopByKeyOrId(admin, shopKey);
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  const today = toBangkokStamp(new Date()).date;
  const maxDate = resolveMaxBookingDate(today, await getBranchBookingWindow(admin, shop.id, branchId));
  const rangeEnd = calendarEndDate({ today, maxDate });

  // Same scoping as /slots: a row with no branch applies to every branch.
  const [{ data: whRows, error: whError }, { data: holidayRows, error: holidayError }] = await Promise.all([
    admin
      .from('working_hours')
      .select('weekday')
      .eq('shop_id', shop.id)
      .eq('active', true)
      .eq('is_deleted', false)
      .or(`branch_id.eq.${branchId},branch_id.is.null`),
    admin
      .from('holidays')
      .select('holiday_date')
      .eq('shop_id', shop.id)
      .eq('is_deleted', false)
      .gte('holiday_date', today)
      .lte('holiday_date', rangeEnd)
      .or(`branch_id.is.null,branch_id.eq.${branchId}`),
  ]);

  if (whError || holidayError) {
    console.error('[bookable-days] lookup failed', whError?.message ?? holidayError?.message);
    return NextResponse.json({ error: 'โหลดวันที่เปิดจองไม่สำเร็จ กรุณาลองใหม่' }, { status: 500 });
  }

  const openWeekdays = Array.from(new Set((whRows ?? []).map((r) => Number(r.weekday)))).sort((a, b) => a - b);
  const holidays = Array.from(new Set((holidayRows ?? []).map((r) => String(r.holiday_date).slice(0, 10)))).sort();

  return NextResponse.json({
    data: {
      today,
      max_date: maxDate,
      open_weekdays: openWeekdays,
      holidays,
    },
  });
}
