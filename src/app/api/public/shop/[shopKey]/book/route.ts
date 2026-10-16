import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveShopByKeyOrId } from '@/lib/line/shop-resolver';
import { pushMessage } from '@/lib/line/client';
import { bookingConfirmFlex } from '@/lib/line/messages';
import { assertFeatureQuota, SubscriptionInactiveError, SubscriptionQuotaError } from '@/lib/subscription/enforcement';
import { monthBounds } from '@/lib/subscription/usage';
import { createNotification, safeCreateNotification } from '@/lib/notifications/createNotification';
import { resolvePaymentForBooking, type PaymentBankInfo, type PaymentDeeplinkInfo } from '@/lib/payments/resolve';
import { formatThaiDateLabel } from '@/lib/utils/date-format';
import { safeSyncBookingToGoogleCalendar } from '@/lib/google-calendar/sync';
import { resourceBusyMessage, resourceTypeLabel } from '@/lib/booking/resource-types';
import { resourceServesService, resourceServiceMismatchMessage } from '@/lib/booking/resource-service-link';
import { NICKNAME_MAX, normalizeNicknameInput } from '@/lib/booking/customer-label';
import { BANK_CODES, BANK_PROVIDERS, PAYMENT_METHODS } from '@/types/db';
import { detectOmisePlatform, isBankAppMethod } from '@/lib/payments/mobile-banking/banks';
import { resolveInitialBookingStatus } from '@/lib/booking/status-flow';
import { isSlotPast, SLOT_PAST_CODE, SLOT_PAST_MESSAGE } from '@/lib/booking/slot-time';
import { toBangkokStamp } from '@/lib/line/booking-reminder';
import {
  BOOKING_NOT_OPEN_CODE,
  BOOKING_WINDOW_CODE,
  bookingNotOpenMessage,
  bookingWindowMessage,
  getBranchBookingWindow,
  isBeyondBookingWindow,
  resolveBookingOpensOn,
  resolveMaxBookingDate,
} from '@/lib/booking/booking-window';
import { isMultiSlotEnabled, isOneBookingPerDay } from '@/lib/booking/display-settings';
import { DAILY_LIMIT_CODE, DAILY_LIMIT_FREE_STATUSES, dailyLimitMessage, isDailyLimitDbError } from '@/lib/booking/daily-limit';
import { SLOT_FULL_CODE, countSlotBookings, fetchSlotCapacity, isSlotFull, isSlotFullDbError, slotFullMessage } from '@/lib/booking/slot-capacity';
import {
  MULTI_SLOT_NEEDS_RESOURCE_CODE,
  MULTI_SLOT_NEEDS_RESOURCE_MESSAGE,
  MULTI_SLOT_UNAVAILABLE_CODE,
  MAX_SLOTS_PER_BOOKING,
  MAX_SLOTS_PER_ORDER,
  MULTI_PICK_INVALID_CODE,
  normalizePickedTimes,
  picksOverlap,
  bookingEndTime,
  bookingTimeLabel,
  consecutiveSlotsOpen,
  isSlotCountAllowed,
  multiSlotUnavailableMessage,
  slotUnitMinutes,
  type GridSlot,
} from '@/lib/booking/multi-slot';
import { resolveLiffCaller } from '@/lib/line/liff-identity';
import { clientIp, hitRateLimit, tooManyRequests } from '@/lib/security/rate-limit';

const bookSchema = z
  .object({
    branch_id: z.string().uuid(),
    service_id: z.string().uuid(),
    booking_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/),
    // A LINE display name can legitimately be a single character, so length is
    // only there to reject blank names.
    customer_name: z.string().trim().min(1).max(120),
    customer_phone: z.string().trim().min(8).max(20).regex(/^[0-9+\-\s()]+$/),
    /** Optional ชื่อเล่น saved on the customer profile; omitted = keep the stored one. */
    nickname: z.string().max(NICKNAME_MAX).optional(),
    line_user_id: z.string().max(64).optional(),
    /** LIFF ID token; required with `line_user_id` when tokens are enforced. */
    id_token: z.string().max(4096).optional(),
    party_size: z.coerce.number().int().min(1).max(200).optional(),
    resource_id: z.string().uuid().optional(),
    /** Consecutive slots in one booking; >1 only for `flexible_duration` services with a resource. */
    slot_count: z.coerce.number().int().min(1).max(MAX_SLOTS_PER_BOOKING).optional(),
    /**
     * Every start time the customer picked (incl. `start_time`); one queue is
     * created per time. Needs `shops.multi_slot_enabled`.
     */
    start_times: z
      .array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/))
      .min(1)
      .max(MAX_SLOTS_PER_ORDER)
      .optional(),
    payment_method: z.enum(PAYMENT_METHODS).optional(),
    /** Which bank app to open; required with `bank_deeplink` / `omise_mobile_banking`, ignored otherwise. */
    bank_provider: z.enum(BANK_CODES).optional(),
  })
  .superRefine((value, ctx) => {
    if (isBankAppMethod(value.payment_method) && !value.bank_provider) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['bank_provider'], message: 'bank_provider is required' });
    }
    // Direct bank APIs exist for two banks only.
    if (value.payment_method === 'bank_deeplink' && value.bank_provider && !(BANK_PROVIDERS as readonly string[]).includes(value.bank_provider)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['bank_provider'], message: 'bank not supported for bank_deeplink' });
    }
  });

/**
 * Thai label for the first field a customer got wrong. A bare "Invalid payload"
 * leaves them (and support) with no idea which box to fix, but the raw Zod
 * message must not reach the response body either.
 */
function invalidFieldMessage(path: PropertyKey | undefined) {
  const labels: Record<string, string> = {
    customer_name: 'ชื่อผู้จอง',
    customer_phone: 'เบอร์โทร',
    nickname: 'ชื่อเล่น',
    booking_date: 'วันที่จอง',
    start_time: 'เวลาที่จอง',
    branch_id: 'สาขา',
    service_id: 'บริการ',
    resource_id: 'ผู้ให้บริการ',
    payment_method: 'วิธีชำระเงิน',
    bank_provider: 'ธนาคารที่เลือก',
    slot_count: 'จำนวนรอบ',
    start_times: 'เวลาที่เลือก',
  };
  const label = typeof path === 'string' ? labels[path] : undefined;
  return label ? `ข้อมูลไม่ถูกต้อง: ${label}` : 'ข้อมูลการจองไม่ครบถ้วน';
}

export async function POST(req: Request, { params }: { params: Promise<{ shopKey: string }> }) {
  const { shopKey } = await params;
  const parsed = bookSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: invalidFieldMessage(parsed.error.issues[0]?.path[0]) }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!(await hitRateLimit(admin, 'book', clientIp(req)))) return tooManyRequests();

  const shop = await resolveShopByKeyOrId(admin, shopKey);
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  // A LINE identity ties the booking to a customer's history and receives
  // LINE pushes, so it must be proven. A booking without one is still allowed.
  let verifiedLineUserId: string | null = null;
  if (parsed.data.line_user_id || parsed.data.id_token) {
    const caller = await resolveLiffCaller(admin, shop.id, parsed.data.line_user_id, parsed.data.id_token);
    if (!caller.ok) return NextResponse.json({ error: caller.error }, { status: caller.status });
    verifiedLineUserId = caller.lineUserId;
  }
  const payload = { ...parsed.data, line_user_id: verifiedLineUserId ?? undefined };

  // The LIFF greys these out, but a grid left open past the hour (or a forged
  // request) still reaches here. Same rule as /slots, same Bangkok clock.
  const now = toBangkokStamp(new Date());
  // One queue per picked time; the earliest is the "main" queue that carries
  // the payment for all of them.
  const pickedTimes = normalizePickedTimes([payload.start_time, ...(payload.start_times ?? [])]);
  if (pickedTimes.length === 0) return NextResponse.json({ error: invalidFieldMessage('start_time') }, { status: 400 });
  if (pickedTimes.length > MAX_SLOTS_PER_ORDER) {
    return NextResponse.json({ error: `เลือกได้สูงสุด ${MAX_SLOTS_PER_ORDER} ช่องต่อการจอง`, code: MULTI_PICK_INVALID_CODE }, { status: 400 });
  }
  const multiPick = pickedTimes.length > 1;
  if (pickedTimes.some((time) => isSlotPast({ date: payload.booking_date, time }, now))) {
    return NextResponse.json({ error: SLOT_PAST_MESSAGE, code: SLOT_PAST_CODE }, { status: 400 });
  }

  // The LIFF date picker stops at the branch's last bookable date, but a
  // forged request does not. Same helper as /slots.
  const bookingWindow = await getBranchBookingWindow(admin, shop.id, payload.branch_id);
  // A branch that has not started taking bookings refuses every day.
  const opensOn = resolveBookingOpensOn(now.date, bookingWindow);
  if (opensOn) {
    return NextResponse.json({ error: bookingNotOpenMessage(opensOn), code: BOOKING_NOT_OPEN_CODE }, { status: 400 });
  }
  const maxDate = resolveMaxBookingDate(now.date, bookingWindow);
  if (maxDate && isBeyondBookingWindow(payload.booking_date, maxDate)) {
    return NextResponse.json({ error: bookingWindowMessage(maxDate), code: BOOKING_WINDOW_CODE }, { status: 400 });
  }

  const bounds = monthBounds(payload.booking_date);
  if (!bounds) return NextResponse.json({ error: invalidFieldMessage('booking_date') }, { status: 400 });
  const { count: monthlyCount, error: monthlyError } = await admin
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('shop_id', shop.id)
    .eq('is_deleted', false)
    .gte('booking_date', bounds.from)
    .lte('booking_date', bounds.to);
  // A failed count must not read as "0 used" — that silently disables the quota.
  if (monthlyError) {
    console.error('[public/book] monthly quota count failed', monthlyError.message);
    return NextResponse.json({ error: 'ขออภัย ระบบไม่สามารถรับการจองได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง' }, { status: 500 });
  }

  // The quota belongs to the shop, not to the person booking. Never surface a
  // plan error (or an unhandled 500) to an end customer on the LIFF screen —
  // tell them politely and alert the shop owner, who is the one who can act.
  try {
    // Each picked slot is its own booking, so the quota must have room for all.
    await assertFeatureQuota(shop.id, 'bookings', (monthlyCount ?? 0) + pickedTimes.length - 1);
  } catch (quotaErr) {
    if (quotaErr instanceof SubscriptionQuotaError || quotaErr instanceof SubscriptionInactiveError) {
      await safeCreateNotification(admin, {
        companyId: shop.company_id,
        shopId: shop.id,
        type: 'quota_exceeded',
        category: 'system',
        priority: 'high',
        title: 'ลูกค้าจองไม่ได้ — โควต้าแพ็กเกจเต็ม',
        message: 'มีลูกค้าพยายามจองคิวแต่ระบบปฏิเสธเพราะโควต้าการจองของแพ็กเกจเต็มแล้ว อัปเกรดแพ็กเกจเพื่อเปิดรับการจองต่อ',
        actionUrl: '/portal/settings',
        metadata: { feature: 'bookings', shop_key: shopKey },
      });
      return NextResponse.json(
        { error: 'ขออภัย ขณะนี้ร้านยังไม่สามารถรับการจองเพิ่มได้ กรุณาติดต่อร้านโดยตรง' },
        { status: 409 }
      );
    }
    throw quotaErr;
  }

  const [{ data: branch }, { data: service }] = await Promise.all([
    admin.from('branches').select('id,branch_name').eq('id', payload.branch_id).eq('shop_id', shop.id).eq('is_deleted', false).maybeSingle(),
    admin.from('services').select('id,service_name,duration_minutes,capacity_per_slot,price,requires_approval,booking_mode,min_duration_minutes,max_duration_minutes').eq('id', payload.service_id).eq('shop_id', shop.id).eq('is_deleted', false).maybeSingle(),
  ]);
  if (!branch || !service) {
    return NextResponse.json({ error: 'Invalid branch or service for this shop' }, { status: 400 });
  }

  const slotCount = payload.slot_count ?? 1;
  if ((slotCount > 1 || multiPick) && !(await isMultiSlotEnabled(admin, shop.id))) {
    return NextResponse.json({ error: 'ร้านนี้ยังไม่เปิดให้จองหลายช่องเวลา', code: MULTI_SLOT_UNAVAILABLE_CODE }, { status: 400 });
  }
  if (slotCount > 1 && multiPick) {
    return NextResponse.json({ error: invalidFieldMessage('slot_count'), code: MULTI_PICK_INVALID_CODE }, { status: 400 });
  }
  if (!isSlotCountAllowed(service, slotCount)) {
    return NextResponse.json({ error: invalidFieldMessage('slot_count'), code: MULTI_SLOT_UNAVAILABLE_CODE }, { status: 400 });
  }

  let lineUserPk: string | null = null;
  if (payload.line_user_id) {
    const { data: lineUser } = await admin
      .from('line_users')
      .upsert({
        company_id: shop.company_id,
        shop_id: shop.id,
        line_user_id: payload.line_user_id,
      }, { onConflict: 'shop_id,line_user_id' })
      .select('id')
      .single();
    lineUserPk = lineUser?.id ?? null;
  }

  let customerId: string | null = null;
  if (lineUserPk) {
    const { data: byLineUser } = await admin
      .from('customers')
      .select('id')
      .eq('shop_id', shop.id)
      .eq('line_user_id', lineUserPk)
      .eq('is_deleted', false)
      .order('updated_at', { ascending: false })
      .limit(1);
    customerId = byLineUser?.[0]?.id ?? null;
  }

  // `undefined` keeps whatever nickname the profile already has; only a value
  // (or an explicit '' → null) sent by the customer changes it.
  const nickname = normalizeNicknameInput(payload.nickname);
  const nicknamePatch = nickname !== undefined ? { nickname } : {};

  if (customerId) {
    await admin
      .from('customers')
      .update({
        full_name: payload.customer_name,
        phone: payload.customer_phone,
        ...nicknamePatch,
        updated_at: new Date().toISOString(),
      })
      .eq('id', customerId)
      .eq('shop_id', shop.id);
  } else {
    // A phone number is not proof of identity. An existing customer row with
    // this phone is reused, but its name and LINE link are never overwritten
    // from an unauthenticated booking — only an unlinked row may gain the
    // caller's (verified) LINE id.
    const { data: byPhone } = await admin
      .from('customers')
      .select('id,line_user_id')
      .eq('shop_id', shop.id)
      .eq('phone', payload.customer_phone)
      .eq('is_deleted', false)
      .maybeSingle();

    let customer: { id: string } | null = null;
    let customerError: { message: string } | null = null;
    if (byPhone) {
      customer = { id: byPhone.id as string };
      if (lineUserPk && !byPhone.line_user_id) {
        await admin.from('customers').update({ line_user_id: lineUserPk }).eq('id', byPhone.id).eq('shop_id', shop.id);
      }
    } else {
      const inserted = await admin
        .from('customers')
        .insert({
          company_id: shop.company_id,
          shop_id: shop.id,
          line_user_id: lineUserPk,
          full_name: payload.customer_name,
          phone: payload.customer_phone,
          ...nicknamePatch,
        })
        .select('id')
        .single();
      customer = inserted.data as { id: string } | null;
      customerError = inserted.error;
    }
    if (customerError || !customer) {
      console.error('[public/book] customer upsert failed', customerError?.message);
      return NextResponse.json({ error: 'ขออภัย ระบบไม่สามารถรับการจองได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง' }, { status: 400 });
    }
    customerId = customer.id;
  }

  // Shop-wide "one booking per customer per day" (opt-in). Checked here with a
  // clear message; the DB trigger from 202609220002 closes the race two taps
  // could open between this count and the insert below.
  if (await isOneBookingPerDay(admin, shop.id)) {
    // Several picks are several queues on the same day — never allowed here.
    if (multiPick) {
      return NextResponse.json({ error: dailyLimitMessage(payload.booking_date), code: DAILY_LIMIT_CODE }, { status: 409 });
    }
    const { count: sameDayCount, error: sameDayError } = await admin
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', shop.id)
      .eq('customer_id', customerId)
      .eq('booking_date', payload.booking_date)
      .eq('is_deleted', false)
      .eq('is_demo', false)
      .not('status', 'in', `(${DAILY_LIMIT_FREE_STATUSES.join(',')})`);
    // A failed count must not read as "0 today" — that silently disables the rule.
    if (sameDayError) {
      console.error('[public/book] daily limit count failed', sameDayError.message);
      return NextResponse.json({ error: 'ขออภัย ระบบไม่สามารถรับการจองได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง' }, { status: 500 });
    }
    if ((sameDayCount ?? 0) > 0) {
      return NextResponse.json({ error: dailyLimitMessage(payload.booking_date), code: DAILY_LIMIT_CODE }, { status: 409 });
    }
  }

  const partySize = payload.party_size ?? null;
  const unitMin = slotUnitMinutes(service);

  type AssignedResource = {
    resource_id: string;
    resource_name: string;
    resource_type: string | null;
    capacity: number;
    unit_price: number;
  };
  type SlotPlan = { startTime: string; startAt: Date; endAt: Date; endTime: string; resource: AssignedResource | null };

  /**
   * Validate one start time the way a single booking always was: resource
   * free (or a table found for the party), otherwise slot capacity left.
   * `count` > 1 is the consecutive-slot booking of a flexible service.
   */
  async function planSlot(startTime: string, count: number): Promise<{ plan: SlotPlan } | { response: NextResponse }> {
    const startLabel = startTime.length === 5 ? `${startTime}:00` : startTime;
    const startAt = new Date(`${payload.booking_date}T${startLabel}+07:00`);
    const endAt = new Date(startAt.getTime() + unitMin * count * 60000);
    // Same-day end as a Bangkok wall-clock time. A single slot keeps the old
    // behaviour; a multi-slot run must not cross midnight.
    const endTime = bookingEndTime(startTime, unitMin, count)
      ?? (count === 1 ? `${String(endAt.getHours()).padStart(2, '0')}:${String(endAt.getMinutes()).padStart(2, '0')}:00` : null);
    if (!endTime) {
      return { response: NextResponse.json({ error: invalidFieldMessage('slot_count'), code: MULTI_SLOT_UNAVAILABLE_CODE }, { status: 400 }) };
    }

    let resource: AssignedResource | null = null;
    if (payload.resource_id) {
      const { data: selectedResource } = await admin
        .from('booking_resources')
        .select('id,resource_name,resource_type,capacity,unit_price,service_ids')
        .eq('id', payload.resource_id)
        .eq('shop_id', shop!.id)
        .eq('active', true)
        .eq('is_deleted', false)
        .maybeSingle();
      if (selectedResource?.id) {
        // A resource linked to specific services can only be booked for those.
        if (!resourceServesService(selectedResource, payload.service_id)) {
          return {
            response: NextResponse.json(
              { error: resourceServiceMismatchMessage(resourceTypeLabel(selectedResource.resource_type)) },
              { status: 400 },
            ),
          };
        }
        // The customer named a specific resource, so slot capacity is not enough —
        // two people can pick the same trainer at the same time between renders.
        const { data: isFree } = await admin.rpc('is_resource_available', {
          p_shop_id: shop!.id,
          p_resource_id: selectedResource.id,
          p_start: startAt.toISOString(),
          p_end: endAt.toISOString(),
        });
        if (isFree === false) {
          const busy = resourceBusyMessage(selectedResource.resource_type);
          return { response: NextResponse.json({ error: multiPick ? `${startTime.slice(0, 5)} — ${busy}` : busy }, { status: 409 }) };
        }
        resource = {
          resource_id: selectedResource.id as string,
          resource_name: String(selectedResource.resource_name ?? '-'),
          resource_type: (selectedResource.resource_type as string | null) ?? null,
          capacity: Number(selectedResource.capacity ?? 1),
          unit_price: Number(selectedResource.unit_price ?? 0),
        };
      }
    } else if (partySize && partySize > 0) {
      const { data: candidates } = await admin.rpc('find_available_resources', {
        p_shop_id: shop!.id,
        p_branch_id: payload.branch_id,
        p_resource_type: 'table',
        p_party_size: partySize,
        p_start_time: startAt.toISOString(),
        p_end_time: endAt.toISOString(),
      });
      const top = candidates?.[0] as { resource_id?: string; resource_name?: string; capacity?: number } | undefined;
      if (top?.resource_id) {
        const { data: resourcePrice } = await admin
          .from('booking_resources')
          .select('unit_price')
          .eq('id', top.resource_id)
          .eq('shop_id', shop!.id)
          .maybeSingle();
        resource = {
          resource_id: top.resource_id,
          resource_name: top.resource_name ?? '-',
          resource_type: 'table',
          capacity: Number(top.capacity ?? 1),
          unit_price: Number(resourcePrice?.unit_price ?? 0),
        };
      }
    }

    // More than one consecutive slot is only safe when a resource holds the
    // booking: the resource guard compares time ranges, slot capacity does not.
    if (count > 1) {
      if (!resource) {
        return { response: NextResponse.json({ error: MULTI_SLOT_NEEDS_RESOURCE_MESSAGE, code: MULTI_SLOT_NEEDS_RESOURCE_CODE }, { status: 400 }) };
      }
      const { data: grid, error: gridError } = await admin.rpc('get_slot_availability', {
        p_shop_id: shop!.id,
        p_branch_id: payload.branch_id,
        p_service_id: payload.service_id,
        p_date: payload.booking_date,
        p_resource_type: resource.resource_type,
        p_party_size: partySize,
        p_resource_id: resource.resource_id,
      });
      if (gridError) {
        console.error('[public/book] multi-slot grid failed', gridError.message);
        return { response: NextResponse.json({ error: 'ขออภัย ระบบไม่สามารถรับการจองได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง' }, { status: 500 }) };
      }
      const gridSlots: GridSlot[] = ((grid ?? []) as Array<{ slot_time: string; remaining_capacity: number }>).map((g) => ({
        ...g,
        is_past: isSlotPast({ date: payload.booking_date, time: g.slot_time }, now),
      }));
      if (!consecutiveSlotsOpen(gridSlots, startTime, unitMin, count)) {
        return {
          response: NextResponse.json(
            { error: multiSlotUnavailableMessage(startTime, endTime), code: MULTI_SLOT_UNAVAILABLE_CODE },
            { status: 409 },
          ),
        };
      }
    }

    // Slot capacity (services.capacity_per_slot, overridden per time range by
    // service_capacity_rules). A booking tied to a resource is governed by the
    // resource check above instead. The DB trigger from 202609290001 /
    // 202610010001 closes the race between this count and the insert below.
    if (!resource) {
      let bookedCount: number;
      let capacity: number;
      try {
        const slotKey = {
          shopId: shop!.id,
          branchId: payload.branch_id,
          serviceId: payload.service_id,
          date: payload.booking_date,
          startTime,
        };
        [capacity, bookedCount] = await Promise.all([
          fetchSlotCapacity(admin, slotKey, service!.capacity_per_slot),
          countSlotBookings(admin, slotKey),
        ]);
      } catch (countErr) {
        console.error('[public/book]', countErr instanceof Error ? countErr.message : countErr);
        return { response: NextResponse.json({ error: 'ขออภัย ระบบไม่สามารถรับการจองได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง' }, { status: 500 }) };
      }
      if (isSlotFull(bookedCount, capacity)) {
        return { response: NextResponse.json({ error: slotFullMessage(startTime), code: SLOT_FULL_CODE }, { status: 409 }) };
      }
    }

    return { plan: { startTime, startAt, endAt, endTime, resource } };
  }

  // Check every picked time before writing anything, so a full later slot
  // never leaves the customer with half an order.
  const plans: SlotPlan[] = [];
  for (const time of pickedTimes) {
    const result = await planSlot(time, multiPick ? 1 : slotCount);
    if ('response' in result) return result.response;
    plans.push(result.plan);
  }
  // Two of the customer's own picks on one resource must not overlap (a 60-min
  // service picked at 09:00 and 09:30) — the checks above cannot see each other.
  if (multiPick && plans.some((p) => p.resource) && picksOverlap(pickedTimes, unitMin)) {
    return NextResponse.json(
      { error: `ช่วงเวลาที่เลือกซ้อนกัน (บริการนี้ใช้เวลา ${unitMin} นาที) กรุณาเลือกเวลาที่ห่างกันอย่างน้อย ${unitMin} นาที`, code: MULTI_PICK_INVALID_CODE },
      { status: 400 },
    );
  }

  // A service that needs approval holds its slot as `pending_approval` until
  // staff confirm it from the portal (which pushes the customer an approval Flex).
  const initialStatus = resolveInitialBookingStatus(service);
  const pendingApproval = initialStatus === 'pending_approval';

  const created: Array<{ id: string; queue_number: string; plan: SlotPlan }> = [];
  for (const plan of plans) {
    const { data: row, error } = await admin.from('bookings').insert({
      company_id: shop.company_id,
      shop_id: shop.id,
      branch_id: payload.branch_id,
      service_id: payload.service_id,
      customer_id: customerId,
      line_user_id: lineUserPk,
      booking_date: payload.booking_date,
      start_time: plan.startTime,
      end_time: plan.endTime,
      // queue_number is issued by the assign_queue_number trigger (202609220001).
      status: initialStatus,
      party_size: partySize,
      resource_id: plan.resource?.resource_id ?? null,
      resource_name: plan.resource?.resource_name ?? null,
      resource_capacity: plan.resource?.capacity ?? null,
      // The extra queues of a multi-pick are paid through the main (first) one.
      ...(created.length > 0 ? { note: `จองพร้อมคิว ${created[0].queue_number} (ชำระรวมที่คิวนั้น)` } : {}),
    }).select('id,queue_number').single();

    if (error || !row) {
      // All or nothing: withdraw the queues of this order already written.
      if (created.length > 0) {
        await admin
          .from('bookings')
          .update({ status: 'cancelled', is_deleted: true })
          .in('id', created.map((c) => c.id))
          .eq('shop_id', shop.id);
      }
      // The trigger caught a concurrent booking the count above missed.
      if (error && isDailyLimitDbError(error.message)) {
        return NextResponse.json({ error: dailyLimitMessage(payload.booking_date), code: DAILY_LIMIT_CODE }, { status: 409 });
      }
      if (error && isSlotFullDbError(error.message)) {
        return NextResponse.json({ error: slotFullMessage(plan.startTime), code: SLOT_FULL_CODE }, { status: 409 });
      }
      console.error('[public/book] insert failed', error?.message);
      return NextResponse.json({ error: 'ขออภัย ระบบไม่สามารถรับการจองได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง' }, { status: 400 });
    }
    created.push({ id: row.id as string, queue_number: String(row.queue_number), plan });
  }

  const booking = { id: created[0].id, queue_number: created[0].queue_number };
  const assignedResource = plans[0].resource;
  const endTime = plans[0].endTime;
  /** Time shown in messages: the range of a consecutive booking, or every picked time. */
  const orderTimeLabel = multiPick
    ? pickedTimes.join(', ')
    : bookingTimeLabel(payload.start_time, endTime, slotCount);
  const queueNumber = String(booking.queue_number);
  /** Every queue number of this order, for staff messages. */
  const orderQueueLabel = created.map((c) => c.queue_number).join(', ');

  await admin.from('booking_logs').insert(
    created.map((c) => ({
      company_id: shop.company_id,
      shop_id: shop.id,
      booking_id: c.id,
      action: 'create_via_liff',
      description: multiPick ? `Created booking ${c.queue_number} (order ${orderQueueLabel})` : `Created booking ${c.queue_number}`,
    })),
  );

  const assignments = created
    .filter((c) => c.plan.resource?.resource_id)
    .map((c) => ({
      company_id: shop.company_id,
      shop_id: shop.id,
      branch_id: payload.branch_id,
      booking_id: c.id,
      resource_id: c.plan.resource!.resource_id,
      note: payload.resource_id ? 'manual_assign' : 'auto_assign_by_party_size',
    }));
  if (assignments.length > 0) {
    await admin.from('booking_resource_assignments').insert(assignments);
  }

  try {
    await createNotification(admin, {
      companyId: shop.company_id,
      shopId: shop.id,
      branchId: payload.branch_id,
      userId: null,
      type: 'booking_created',
      category: 'bookings',
      priority: pendingApproval ? 'high' : 'medium',
      title: pendingApproval ? `${orderQueueLabel} — คำขอจองใหม่ รออนุมัติ` : `New booking ${orderQueueLabel}`,
      message: pendingApproval
        ? `ลูกค้าขอจอง ${payload.booking_date} ${orderTimeLabel} (${service.service_name}) กรุณากด "อนุมัติ" ในหน้าคิว`
        : `Customer booked ${payload.booking_date} ${orderTimeLabel}`,
      relatedType: 'booking',
      relatedId: booking.id,
      actionUrl: '/portal/bookings',
      icon: pendingApproval ? 'PendingActions' : 'EventAvailable',
      color: pendingApproval ? '#d97706' : '#2e7d32',
      metadata: { source: 'liff', queue_number: queueNumber, queue_numbers: created.map((c) => c.queue_number), status: initialStatus },
      createdBy: null,
    });
  } catch (e) {
    await admin.from('activity_logs').insert({
      company_id: shop.company_id,
      shop_id: shop.id,
      action: 'notification_create_failed_liff_booking',
      description: e instanceof Error ? e.message : 'unknown error',
      payload: {
        queue_number: queueNumber,
        booking_id: booking.id,
      },
    });
  }

  for (const c of created) await safeSyncBookingToGoogleCalendar(shop.id, c.id);

  let linePushSent = false;
  let linePushError: string | null = null;

  // Non-blocking LINE confirmation message to customer.
  if (payload.line_user_id) {
    const { data: shopLine } = await admin
      .from('shops')
      .select('line_channel_access_token')
      .eq('id', shop.id)
      .maybeSingle();

    const token = shopLine?.line_channel_access_token || process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
    if (token) {
      const dateLabel = formatThaiDateLabel(payload.booking_date);
      const branchName = branch?.branch_name ?? '-';
      const serviceName = service?.service_name ?? '-';
      const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '');
      const liffUrl = appUrl ? `${appUrl}/liff/${encodeURIComponent(shop.shop_key)}` : undefined;

      try {
        // One card per queue (max 4, LINE allows 5 per push) so each keeps its own cancel button.
        await pushMessage(
          token,
          payload.line_user_id,
          created.map((c) =>
            bookingConfirmFlex({
              shopName: shop.name ?? 'Queue Booking',
              queueNumber: c.queue_number,
              branch: branchName,
              service: serviceName,
              date: dateLabel,
              time: multiPick ? c.plan.startTime.slice(0, 5) : bookingTimeLabel(payload.start_time, endTime, slotCount),
              assignedTo: c.plan.resource?.resource_name ?? null,
              assignedLabel: c.plan.resource ? resourceTypeLabel(c.plan.resource.resource_type) : null,
              liffUrl,
              pendingApproval,
              bookingId: c.id,
            }),
          ),
        );
        linePushSent = true;
      } catch (e) {
        linePushError = e instanceof Error ? e.message : 'unknown error';
        await admin.from('activity_logs').insert({
          company_id: shop.company_id,
          shop_id: shop.id,
          action: 'line_push_booking_failed',
          description: linePushError,
        });
      }
    } else {
      linePushError = 'LINE channel access token is missing';
    }
  }

  // Payment setup — non-blocking, never fails the booking.
  // Runs regardless of line_user_id: the QR and slip upload live on-screen in
  // LIFF now, so a customer without a LINE push still needs a payable invoice.
  let qrPaymentCreated = false;
  let paymentInfo: {
    method: string;
    amount: number;
    qr_image_url: string;
    expires_at: string | null;
    bank: PaymentBankInfo | null;
    deeplink: PaymentDeeplinkInfo | null;
  } | null = null;

  try {
    const resourcePrice = Number(assignedResource?.unit_price ?? 0);
    const servicePrice = Number((service as unknown as { price?: number } | null)?.price ?? 0);
    // Price is per slot: a consecutive booking pays for every slot, and a
    // multi-pick order pays for all its queues through the main one.
    const paymentPrice = (resourcePrice > 0 ? resourcePrice : servicePrice) * slotCount * created.length;
    const dateLabel = formatThaiDateLabel(payload.booking_date);
    const payment = await resolvePaymentForBooking({
      bookingId: booking.id,
      shopId: shop.id,
      companyId: shop.company_id,
      shopKey: shop.shop_key,
      amountTHB: paymentPrice,
      shopName: shop.name ?? 'Queue Booking',
      queueNumber,
      serviceName: service.service_name ?? '-',
      branchName: branch.branch_name ?? '-',
      dateLabel,
      timeLabel: orderTimeLabel,
      requestedMethod: payload.payment_method ?? null,
      requestedBankProvider: payload.bank_provider ?? null,
      platformType: detectOmisePlatform(req.headers.get('user-agent')),
    });

    if (payment) {
      paymentInfo = {
        method: payment.method,
        amount: payment.amountTHB,
        qr_image_url: payment.qrImageUrl,
        expires_at: payment.expiresAt,
        bank: payment.bank,
        deeplink: payment.deeplink,
      };

      if (payload.line_user_id) {
        const { data: shopLine } = await admin
          .from('shops')
          .select('line_channel_access_token')
          .eq('id', shop.id)
          .maybeSingle();
        const qrToken = shopLine?.line_channel_access_token || process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
        if (qrToken) {
          await pushMessage(qrToken, payload.line_user_id, [payment.flex]);
          qrPaymentCreated = true;
        }
      }
    }
  } catch (payErr) {
    console.error('[payments] setup error (booking still created):', payErr instanceof Error ? payErr.message : payErr);
  }

  return NextResponse.json({
    data: {
      booking_id: booking.id,
      queue_number: booking.queue_number,
      status: initialStatus,
      booking_date: payload.booking_date,
      booking_time: payload.start_time.slice(0, 5),
      end_time: endTime.slice(0, 5),
      slot_count: slotCount,
      /** Every queue of a multi-pick order; the first carries the payment. */
      bookings: created.map((c) => ({ booking_id: c.id, queue_number: c.queue_number, start_time: c.plan.startTime.slice(0, 5) })),
      branch_name: branch.branch_name,
      service_name: service.service_name,
      line_push_sent: linePushSent,
      line_push_error: linePushError,
      qr_payment_created: qrPaymentCreated,
      payment: paymentInfo,
    },
  });
}
