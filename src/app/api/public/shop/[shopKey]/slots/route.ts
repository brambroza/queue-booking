import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveShopCached } from '@/lib/line/shop-resolver';
import { cached } from '@/lib/cache/kv';
import { getShopReleaseTimes, isReleased, NOT_RELEASED_CODE, notReleasedMessage } from '@/lib/booking/booking-release';
import { PUBLIC_CACHE_HEADERS } from '@/lib/cache/http';
import { clientIp, hitRateLimit, tooManyRequests } from '@/lib/security/rate-limit';
import { toBangkokStamp } from '@/lib/line/booking-reminder';
import { DATE_PAST_HINT, DAY_OVER_HINT, isSlotPast } from '@/lib/booking/slot-time';
import { weekdayOf } from '@/lib/dashboard/date-range';
import {
  bookingWindowMessage,
  bookingWindowStartMessage,
  getBranchBookingWindow,
  isBeforeBookingWindow,
  isBeyondBookingWindow,
  resolveMaxBookingDate,
  resolveMinBookingDate,
} from '@/lib/booking/booking-window';

export async function GET(req: Request, { params }: { params: Promise<{ shopKey: string }> }) {
  const { shopKey } = await params;
  const { searchParams } = new URL(req.url);
  const branchId = searchParams.get('branch_id');
  const serviceId = searchParams.get('service_id');
  const date = searchParams.get('date');
  const resourceType = searchParams.get('resource_type');
  const resourceId = searchParams.get('resource_id');
  const partySize = searchParams.get('party_size');

  if (!branchId || !serviceId || !date) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (
    !UUID.test(branchId) ||
    !UUID.test(serviceId) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    (resourceId && !UUID.test(resourceId)) ||
    (partySize && !/^\d{1,3}$/.test(partySize)) ||
    (resourceType && resourceType.length > 40)
  ) {
    return NextResponse.json({ error: 'Invalid params' }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!(await hitRateLimit(admin, 'liffRead', clientIp(req)))) return tooManyRequests();
  const shop = await resolveShopCached(admin, shopKey);
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  // Before the branch's release nothing is looked up (and nothing cached).
  const releaseAt = (await cached(`release:${shop.id}`, { ttlSeconds: 15 }, () => getShopReleaseTimes(admin, shop.id)))[branchId];
  if (releaseAt && !isReleased(releaseAt, Date.now())) {
    return NextResponse.json(
      { error: notReleasedMessage(releaseAt), code: NOT_RELEASED_CODE, release_at: releaseAt },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  // A burst of customers on the same day/service shares one lookup: concurrent
  // misses are coalesced and the result is reused for a few seconds. Staleness
  // is safe because /book re-checks capacity before every insert.
  const key = ['slots', shop.id, branchId, serviceId, date, resourceType ?? '', resourceId ?? '', partySize ?? ''].join(':');
  try {
    const body = await cached(key, { ttlSeconds: SLOTS_TTL_SECONDS, staleSeconds: 30 }, () =>
      loadSlots(admin, shop.id, { branchId, serviceId, date, resourceType, resourceId, partySize }),
    );
    if ('status' in body) return NextResponse.json({ error: body.error }, { status: body.status });
    return NextResponse.json(body, { headers: PUBLIC_CACHE_HEADERS.slots });
  } catch (error) {
    console.error('[slots] lookup failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'โหลดช่วงเวลาไม่สำเร็จ กรุณาลองใหม่' }, { status: 503 });
  }
}

/** Seconds one slot grid is reused across customers. */
const SLOTS_TTL_SECONDS = 3;

type SlotQuery = {
  branchId: string;
  serviceId: string;
  date: string;
  resourceType: string | null;
  resourceId: string | null;
  partySize: string | null;
};

async function loadSlots(admin: ReturnType<typeof createAdminClient>, shopId: string, query: SlotQuery) {
  const { branchId, serviceId, date, resourceType, resourceId, partySize } = query;

  // Weekday must come from the date string itself, never from `Date#getDay()`:
  // that reads the process timezone, and on Vercel (UTC) Bangkok midnight is
  // still the previous day, so every working-hours lookup shifted by one day.
  let weekday: number;
  try {
    weekday = weekdayOf(date);
  } catch {
    return { error: 'Invalid date', status: 400 } as const;
  }

  // Server clock in Bangkok, never the customer's device: a slot that already
  // started is greyed out here and refused again by /book with the same rule.
  const now = toBangkokStamp(new Date());

  // Past the branch's advance-booking window nothing is offered at all, so the
  // slot lookup is skipped. /book refuses the same dates with the same helper.
  const bookingWindow = await getBranchBookingWindow(admin, shopId, branchId);
  const minDate = resolveMinBookingDate(now.date, bookingWindow);
  const maxDate = resolveMaxBookingDate(now.date, bookingWindow);
  // Before the branch's first bookable date nothing is offered either.
  if (minDate && isBeforeBookingWindow(date, minDate)) {
    return {
      data: [],
      meta: {
        reason: 'before_window',
        hint: bookingWindowStartMessage(minDate, maxDate),
        open_slots: 0,
        today: now.date,
        min_date: minDate,
        max_date: maxDate,
        has_working_hours: true,
        is_holiday: false,
      },
    };
  }
  if (maxDate && isBeyondBookingWindow(date, maxDate)) {
    return {
      data: [],
      meta: {
        reason: 'beyond_window',
        hint: bookingWindowMessage(maxDate),
        open_slots: 0,
        today: now.date,
        min_date: minDate,
        max_date: maxDate,
        has_working_hours: true,
        is_holiday: false,
      },
    };
  }

  const [{ data: holidayRows }, { data: whRows }, { data: anyWhRows }] = await Promise.all([
    admin
      .from('holidays')
      .select('id')
      .eq('shop_id', shopId)
      .eq('holiday_date', date)
      .eq('is_deleted', false)
      .or(`branch_id.is.null,branch_id.eq.${branchId}`)
      .limit(1),
    admin
      .from('working_hours')
      .select('id')
      .eq('shop_id', shopId)
      .eq('weekday', weekday)
      .eq('active', true)
      .eq('is_deleted', false)
      .or(`branch_id.eq.${branchId},branch_id.is.null`)
      .limit(1),
    // Any weekday at all — distinguishes "closed today" from "never configured".
    admin
      .from('working_hours')
      .select('id')
      .eq('shop_id', shopId)
      .eq('is_deleted', false)
      .limit(1),
  ]);

  // Returns full slots too (remaining_capacity = 0) so the LIFF grid can grey
  // them out with "เต็ม N/N" instead of dropping them from the timeline.
  const { data, error } = await admin.rpc('get_slot_availability', {
    p_shop_id: shopId,
    p_branch_id: branchId,
    p_service_id: serviceId,
    p_date: date,
    p_resource_type: resourceType || null,
    p_party_size: partySize ? Number(partySize) : null,
    p_resource_id: resourceId || null,
  });

  // Thrown so a failed lookup is never cached as an empty grid.
  if (error) throw new Error(error.message);

  const slots =((data ?? []) as Array<{ slot_time: string; capacity: number; booked_count: number; remaining_capacity: number }>).map(
    (s) => ({ ...s, is_past: isSlotPast({ date, time: s.slot_time }, now) })
  );
  const openSlots = slots.filter((s) => !s.is_past && s.remaining_capacity > 0).length;
  const allPast = slots.length > 0 && slots.every((s) => s.is_past);
  const isHoliday = Boolean(holidayRows && holidayRows.length > 0);
  const hasWorkingHours = Boolean(whRows && whRows.length > 0);

  const hasAnyWorkingHours = Boolean(anyWhRows && anyWhRows.length > 0);

  let reason: 'ok' | 'holiday' | 'closed' | 'not_configured' | 'full' = 'ok';
  let hint = '';
  if (isHoliday) {
    reason = 'holiday';
    hint = 'วันดังกล่าวเป็นวันหยุดของสาขา';
  } else if (!hasWorkingHours) {
    // A shop with no working hours anywhere is misconfigured, not closed. Saying
    // "ปิดทำการ" sends the owner hunting through the branch form, which does not
    // control this at all.
    reason = hasAnyWorkingHours ? 'closed' : 'not_configured';
    hint = hasAnyWorkingHours
      ? 'สาขานี้ปิดทำการในวันที่เลือก'
      : 'ร้านยังไม่ได้ตั้งเวลาทำการ กรุณาตั้งค่าที่เมนู "เวลาทำการ" ในระบบหลังบ้าน';
  } else if (slots.length === 0) {
    reason = 'full';
    hint = 'ไม่มีช่วงเวลาให้จองในวันที่เลือก';
  } else if (openSlots === 0) {
    reason = 'full';
    hint = date < now.date ? DATE_PAST_HINT : allPast ? DAY_OVER_HINT : 'คิวเต็มทุกช่วงเวลาในวันที่เลือก';
  }

  return {
    data: slots,
    meta: {
      reason,
      hint,
      open_slots: openSlots,
      /** Bangkok date, so the LIFF date picker's minimum agrees with the server. */
      today: now.date,
      /** First bookable date of this branch when later than today; null = from today. */
      min_date: minDate,
      /** Last bookable date of this branch (inclusive); null = unlimited. */
      max_date: maxDate,
      has_working_hours: hasWorkingHours,
      is_holiday: isHoliday,
    },
  };
}
