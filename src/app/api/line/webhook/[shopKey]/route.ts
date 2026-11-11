import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseIntent } from '@/lib/intent/rule-based';
import { verifyLineSignature } from '@/lib/line/signature';
import { replyMessage } from '@/lib/line/client';
import {
  CANCEL_BOOKING_ACTION,
  bookingCancelPromptFlex,
  bookingSelfCancelledFlex,
  fallbackMessage,
  liffEntryMessage,
  myBookingStatusMessage,
  slotMessage,
} from '@/lib/line/messages';
import { slipReceivedFlex } from '@/lib/line/messages-payment';
import { resolveCustomerLiffUrl } from '@/lib/line/liff-url';
import { isBookingEcho, isEchoFresh, isSlipEcho, parseBookingEcho, parseSlipEcho } from '@/lib/line/booking-echo';
import { buildBookingDeliveryMessages, claimBookingDelivery, releaseBookingDelivery } from '@/lib/line/booking-messages-server';
import { looksLikeOwnerLinkMessage, parseOwnerLinkMessage } from '@/lib/line/owner-line';
import { linkOwnerLineFromCode } from '@/lib/line/owner-line-server';
import { isFallbackReplyEnabled } from '@/lib/line/fallback-reply';
import { toBangkokStamp } from '@/lib/line/booking-reminder';
import type { LineWebhookBody, LineWebhookEvent } from '@/lib/line/types';
import { env } from '@/lib/utils/env';
import { acknowledgeBookingChange } from '@/lib/booking/acknowledge-change';
import { cancelBookingByCustomer } from '@/lib/booking/cancel-by-customer';
import { CUSTOMER_CANCELLABLE_STATUSES } from '@/lib/booking/status-flow';
import { safeSyncBookingToGoogleCalendar } from '@/lib/google-calendar/sync';
import { rebalanceOrderAfterCustomerCancel } from '@/lib/payments/order-rebalance-server';
import { customerPaymentState } from '@/lib/payments/payment-hold';
import { formatThaiDateLabel } from '@/lib/utils/date-format';
import {
  bookingWindowMessage,
  bookingWindowStartMessage,
  getBranchBookingWindow,
  isBeforeBookingWindow,
  isBeyondBookingWindow,
  resolveMaxBookingDate,
  resolveMinBookingDate,
} from '@/lib/booking/booking-window';

/** Shop columns the event handlers need (subset of `getShopAndConfig`). */
type WebhookShop = {
  id: string;
  company_id: string;
  shop_key: string;
  name: string;
  liff_id?: string | null;
  liff_id_login_shop?: string | null;
};

const UUID_RE = /^[0-9a-f-]{36}$/i;

/** Statuses "เช็คคิวของฉัน" reports: the queue is still ahead of the customer. */
const MY_BOOKING_ACTIVE_STATUSES = ['pending', 'pending_approval', 'confirmed', 'checked_in', 'waiting', 'called', 'serving'] as const;

/** "7 พ.ย. 2569 10:10" in Bangkok time. */
function formatBangkokDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
}

/** LIFF deep link for Flex buttons; falls back to the app URL for shops without a LIFF ID. */
function customerLiffUrl(shop: WebhookShop, tab: 'account' | 'booking') {
  return resolveCustomerLiffUrl({
    shopKey: shop.shop_key,
    liffId: shop.liff_id,
    liffIdLoginShop: shop.liff_id_login_shop,
    tab,
    appUrl: env.appUrl,
  }) ?? `${env.appUrl}/liff/${shop.shop_key}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

async function fetchLineProfile(token: string, userId: string) {
  const res = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const json = await res.json() as { displayName?: string; pictureUrl?: string; statusMessage?: string };
  return {
    display_name: json.displayName ?? null,
    picture_url: json.pictureUrl ?? null,
    status_message: json.statusMessage ?? null,
  };
}

async function getShopAndConfig(shopKey: string) {
  const admin = createAdminClient();
  const { data: shop } = await admin
    .from('shops')
    .select('id,company_id,name,shop_key,line_channel_access_token,line_channel_secret,auto_reply_enabled,liff_id,liff_id_login_shop')
    .eq('shop_key', shopKey)
    .single();
  return { admin, shop };
}

/** Upsert the sender into `line_users` and log the text to the chat inbox. Returns the `line_users` pk. */
async function upsertLineUserAndLogText(
  admin: ReturnType<typeof createAdminClient>,
  shop: WebhookShop,
  event: LineWebhookEvent,
  token: string,
): Promise<string | null> {
  const userId = event.source?.userId;
  if (!userId) return null;
  const profile = await fetchLineProfile(token, userId);
  const { data: lineUser } = await admin
    .from('line_users')
    .upsert({
      company_id: shop.company_id,
      shop_id: shop.id,
      line_user_id: userId,
      display_name: profile?.display_name ?? undefined,
      picture_url: profile?.picture_url ?? undefined,
      status_message: profile?.status_message ?? undefined,
    }, { onConflict: 'shop_id,line_user_id' })
    .select('id')
    .single();

  await admin.from('line_messages').insert({
    company_id: shop.company_id,
    shop_id: shop.id,
    line_user_id: lineUser?.id,
    direction: 'inbound',
    message_type: 'text',
    message_text: event.message?.text ?? '',
    payload: event as unknown as Record<string, unknown>,
  });
  return (lineUser?.id as string | undefined) ?? null;
}

/**
 * The booking echo ("ยืนยันคิว A002 · …") the LIFF client sends on the
 * customer's behalf right after `/book`. Its replyToken is the one free way to
 * put the confirmation + payment cards in the chat — a push would spend the
 * shop's monthly LINE plan — so `/book` leaves delivery to this handler when
 * the client promised to echo. Runs before the auto-reply gate: it is the
 * shop's own flow, not a chatbot answer. An echo that names no fresh,
 * undelivered booking is logged and ignored (older client whose `/book`
 * already pushed; a customer forwarding their own old message).
 */
async function handleBookingEcho(
  admin: ReturnType<typeof createAdminClient>,
  shop: WebhookShop,
  event: LineWebhookEvent,
  token: string,
) {
  const userId = event.source?.userId;
  const replyToken = event.replyToken;
  const text = event.message?.text ?? '';
  const lineUserPk = await upsertLineUserAndLogText(admin, shop, event, token);
  const echo = parseBookingEcho(text);
  if (!userId || !replyToken || !lineUserPk || !echo) return;

  const { data: booking } = await admin
    .from('bookings')
    .select('id,created_at,last_line_notify_at')
    .eq('shop_id', shop.id)
    .eq('line_user_id', lineUserPk)
    .eq('queue_number', echo.queueNumber)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!booking || booking.last_line_notify_at || !isEchoFresh(String(booking.created_at), new Date())) return;

  const delivery = await buildBookingDeliveryMessages(admin, { shopId: shop.id, bookingId: String(booking.id) });
  if (!delivery || delivery.messages.length === 0) return;
  if (!(await claimBookingDelivery(admin, shop.id, delivery.bookingIds))) return;

  try {
    await replyMessage(token, replyToken, delivery.messages);
  } catch (e) {
    // Token expired / LINE down: free the claim so /booking-notify (or a retry) can push.
    await releaseBookingDelivery(admin, shop.id, delivery.bookingIds);
    console.error('[line_echo_reply_failed]', e instanceof Error ? e.message : e);
    return;
  }
  await admin.from('booking_logs').insert({
    company_id: shop.company_id,
    shop_id: shop.id,
    booking_id: delivery.payingBookingId,
    action: 'line_delivered_by_reply',
    description: `Booking cards sent as a free reply to the echo (${delivery.bookingIds.length} queue(s))`,
  });
}

/**
 * The slip echo ("ส่งสลิปคิว A002 · แล้ว") the LIFF payment panel sends after a
 * successful upload, answered with "ได้รับสลิปแล้ว" for free instead of the
 * push `/payment/slip` used to send. Only a slip stored in the last two
 * minutes for that queue counts.
 */
async function handleSlipEcho(
  admin: ReturnType<typeof createAdminClient>,
  shop: WebhookShop,
  event: LineWebhookEvent,
  token: string,
) {
  const replyToken = event.replyToken;
  const text = event.message?.text ?? '';
  const lineUserPk = await upsertLineUserAndLogText(admin, shop, event, token);
  const echo = parseSlipEcho(text);
  if (!replyToken || !lineUserPk || !echo) return;

  const { data: booking } = await admin
    .from('bookings')
    .select('id,queue_number,payment_amount')
    .eq('shop_id', shop.id)
    .eq('line_user_id', lineUserPk)
    .eq('queue_number', echo.queueNumber)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!booking) return;
  const { data: slip } = await admin
    .from('payment_slips')
    .select('created_at')
    .eq('booking_id', booking.id)
    .eq('shop_id', shop.id)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!slip || !isEchoFresh(String(slip.created_at), new Date())) return;

  await replyMessage(token, replyToken, [
    slipReceivedFlex({ shopName: shop.name, queueNumber: String(booking.queue_number ?? '-'), amountTHB: Number(booking.payment_amount ?? 0) }),
  ]);
}

async function handleTextEvent(
  admin: ReturnType<typeof createAdminClient>,
  shop: WebhookShop,
  event: LineWebhookEvent,
  token: string,
) {
  const userId = event.source?.userId;
  const replyToken = event.replyToken;
  const text = event.message?.text ?? '';
  if (!userId || !replyToken) return;

  const lineUserPk = await upsertLineUserAndLogText(admin, shop, event, token);
  const lineUser = lineUserPk ? { id: lineUserPk } : null;

  const parsed = parseIntent(text);

  if (parsed.intent === 'ask_available_slots') {
    const bookingDate = parsed.date ?? todayISO();
    const { data: branch } = await admin.from('branches').select('id,branch_name').eq('shop_id', shop.id).eq('active', true).limit(1).maybeSingle();
    const { data: service } = await admin.from('services').select('id,service_name').eq('shop_id', shop.id).eq('active', true).limit(1).maybeSingle();

    if (!branch || !service) {
      await replyMessage(token, replyToken, [{ type: 'text', text: 'ร้านยังไม่ได้ตั้งค่าสาขาหรือบริการค่ะ' }]);
      return;
    }

    // Never list times for a day the branch does not take bookings for yet —
    // the customer would tap through to LIFF and find the day missing.
    const todayIso = toBangkokStamp(new Date()).date;
    const bookingWindow = await getBranchBookingWindow(admin, shop.id, String(branch.id));
    const minDate = resolveMinBookingDate(todayIso, bookingWindow);
    const maxDate = resolveMaxBookingDate(todayIso, bookingWindow);
    if (minDate && isBeforeBookingWindow(bookingDate, minDate)) {
      await replyMessage(token, replyToken, [{ type: 'text', text: bookingWindowStartMessage(minDate, maxDate) }]);
      return;
    }
    if (maxDate && isBeyondBookingWindow(bookingDate, maxDate)) {
      await replyMessage(token, replyToken, [{ type: 'text', text: bookingWindowMessage(maxDate) }]);
      return;
    }

    const { data: slots } = await admin.rpc('get_available_slots', {
      p_shop_id: shop.id,
      p_branch_id: branch.id,
      p_service_id: service.id,
      p_date: bookingDate,
    });

    const times = (slots ?? []).slice(0, 4).map((s: { slot_time: string }) => s.slot_time.slice(0, 5));
    await replyMessage(token, replyToken, [slotMessage(bookingDate, times)]);
    return;
  }

  if (parsed.intent === 'book_queue') {
    // A plain app URL opens outside the LIFF context; prefer the liff.line.me link.
    await replyMessage(token, replyToken, [liffEntryMessage(customerLiffUrl(shop, 'booking'))]);
    return;
  }

  if (parsed.intent === 'cancel_booking') {
    // Typed text carries no booking id (and the regex is loose), so never cancel
    // here: show the soonest cancellable booking with a one-tap postback instead.
    if (!lineUser?.id) {
      await replyMessage(token, replyToken, [{ type: 'text', text: 'ไม่พบคิวที่ยกเลิกได้ค่ะ' }]);
      return;
    }
    const { data: booking } = await admin
      .from('bookings')
      .select('id,queue_number,booking_date,start_time,branches(branch_name),services(service_name)')
      .eq('shop_id', shop.id)
      .eq('line_user_id', lineUser.id)
      .eq('is_deleted', false)
      .in('status', [...CUSTOMER_CANCELLABLE_STATUSES])
      .gte('booking_date', toBangkokStamp(new Date()).date)
      .order('booking_date', { ascending: true })
      .order('start_time', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!booking) {
      await replyMessage(token, replyToken, [{ type: 'text', text: 'ไม่พบคิวที่ยกเลิกได้ค่ะ' }]);
      return;
    }

    await replyMessage(token, replyToken, [bookingCancelPromptFlex({
      shopName: shop.name,
      bookingId: String(booking.id),
      queueNumber: booking.queue_number ?? '-',
      branch: (booking.branches as { branch_name?: string } | null)?.branch_name ?? '-',
      service: (booking.services as { service_name?: string } | null)?.service_name ?? '-',
      date: formatThaiDateLabel(String(booking.booking_date)),
      time: String(booking.start_time).slice(0, 5),
      liffUrl: customerLiffUrl(shop, 'account'),
    })]);
    return;
  }

  if (parsed.intent === 'check_my_booking') {
    const { data: lineUserRow } = await admin.from('line_users').select('id').eq('shop_id', shop.id).eq('line_user_id', userId).maybeSingle();
    if (!lineUserRow) {
      await replyMessage(token, replyToken, [{ type: 'text', text: 'ยังไม่พบประวัติการจองของคุณค่ะ' }]);
      return;
    }

    // Nearest upcoming queue that is still running — not the latest created
    // (that could be a past or finished one).
    const { data: booking } = await admin
      .from('bookings')
      .select('id,queue_number,booking_date,start_time,status,resource_name,payment_status,payment_method,payment_amount,payment_expires_at,payment_hold_booking_id,branches(branch_name),services(service_name)')
      .eq('shop_id', shop.id)
      .eq('line_user_id', lineUserRow.id)
      .eq('is_deleted', false)
      .in('status', [...MY_BOOKING_ACTIVE_STATUSES])
      .gte('booking_date', toBangkokStamp(new Date()).date)
      .order('booking_date', { ascending: true })
      .order('start_time', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!booking) {
      await replyMessage(token, replyToken, [{ type: 'text', text: 'ยังไม่พบคิวที่กำลังใช้งานค่ะ' }]);
      return;
    }

    // A multi-pick queue pays through another queue of the same order.
    const holdId = (booking.payment_hold_booking_id as string | null) ?? null;
    let payRow: { id: string; queue_number: string | null; payment_status: string | null; payment_method: string | null; payment_amount: number | null; payment_expires_at: string | null } = {
      id: String(booking.id),
      queue_number: booking.queue_number as string | null,
      payment_status: booking.payment_status as string | null,
      payment_method: booking.payment_method as string | null,
      payment_amount: booking.payment_amount as number | null,
      payment_expires_at: booking.payment_expires_at as string | null,
    };
    if (holdId && holdId !== booking.id) {
      const { data: payer } = await admin
        .from('bookings')
        .select('id,queue_number,payment_status,payment_method,payment_amount,payment_expires_at')
        .eq('id', holdId)
        .eq('shop_id', shop.id)
        .eq('line_user_id', lineUserRow.id)
        .maybeSingle();
      if (payer) payRow = payer as typeof payRow;
    }
    const payState = customerPaymentState(payRow.payment_status, payRow.payment_amount);
    const payUrl = payState === 'owed'
      ? resolveCustomerLiffUrl({
          shopKey: shop.shop_key,
          liffId: shop.liff_id,
          liffIdLoginShop: shop.liff_id_login_shop,
          tab: 'account',
          bookingId: payRow.id,
          appUrl: env.appUrl,
        })
      : null;

    await replyMessage(token, replyToken, [myBookingStatusMessage({
      queueNumber: String(booking.queue_number ?? '-'),
      branch: (booking.branches as { branch_name?: string } | null)?.branch_name ?? '-',
      service: (booking.services as { service_name?: string } | null)?.service_name ?? '-',
      date: formatThaiDateLabel(String(booking.booking_date)),
      time: String(booking.start_time).slice(0, 5),
      status: String(booking.status),
      assignedTo: (booking.resource_name as string | null) ?? null,
      payment: payState
        ? {
            state: payState,
            amountTHB: Number(payRow.payment_amount ?? 0),
            payQueue: payRow.queue_number ?? '-',
            expiresLabel: payRow.payment_expires_at ? formatBangkokDateTime(payRow.payment_expires_at) : null,
            payUrl,
            slip: payRow.payment_method === 'bank_transfer',
          }
        : null,
    })]);
    return;
  }

  if (parsed.intent === 'contact_staff') {
    await replyMessage(token, replyToken, [{ type: 'text', text: 'รับเรื่องแล้วค่ะ เจ้าหน้าที่จะติดต่อกลับโดยเร็วที่สุด' }]);
    return;
  }

  // Unrecognised text: the shop may prefer to answer by hand in LINE OA Chat.
  // The message is already logged above, so the chat inbox still shows it.
  if (!(await isFallbackReplyEnabled(admin, shop.id))) return;

  await replyMessage(token, replyToken, [fallbackMessage()]);
}

async function handleNonTextMessageEvent(
  admin: ReturnType<typeof createAdminClient>,
  shop: { id: string; company_id: string },
  event: LineWebhookEvent,
  token: string,
) {
  const userId = event.source?.userId;
  if (!userId || event.type !== 'message') return;
  const profile = await fetchLineProfile(token, userId);
  const { data: lineUser } = await admin
    .from('line_users')
    .upsert({
      company_id: shop.company_id,
      shop_id: shop.id,
      line_user_id: userId,
      display_name: profile?.display_name ?? undefined,
      picture_url: profile?.picture_url ?? undefined,
      status_message: profile?.status_message ?? undefined,
    }, { onConflict: 'shop_id,line_user_id' })
    .select('id')
    .single();

  await admin.from('line_messages').insert({
    company_id: shop.company_id,
    shop_id: shop.id,
    line_user_id: lineUser?.id,
    direction: 'inbound',
    message_type: event.message?.type ?? 'unknown',
    message_text: event.message?.type === 'text' ? event.message.text : null,
    payload: event as unknown as Record<string, unknown>,
  });
}

/**
 * One-tap "ยกเลิกคิว" from a Flex card. Same helper as the LIFF account tab.
 * The customer is the actor, so the reply is their confirmation — no extra push.
 */
async function handleCancelPostback(
  admin: ReturnType<typeof createAdminClient>,
  shop: WebhookShop,
  args: { userId: string; replyToken: string; bookingId: string },
  token: string,
) {
  let result: Awaited<ReturnType<typeof cancelBookingByCustomer>>;
  try {
    result = await cancelBookingByCustomer(admin, {
      shopId: shop.id,
      companyId: shop.company_id,
      externalLineUserId: args.userId,
      bookingId: args.bookingId,
      source: 'line',
    });
  } catch (e) {
    console.error('[line_cancel_postback_failed]', e);
    await replyMessage(token, args.replyToken, [{ type: 'text', text: 'ยกเลิกคิวไม่สำเร็จ กรุณาลองใหม่หรือติดต่อเจ้าหน้าที่ค่ะ' }]);
    return;
  }

  if (!result.ok) {
    if (!('booking' in result)) {
      await replyMessage(token, args.replyToken, [{ type: 'text', text: 'ไม่พบคิวนี้แล้วค่ะ หากมีข้อสงสัยกรุณาติดต่อเจ้าหน้าที่' }]);
      return;
    }
    const q = result.booking.queue_number ?? '-';
    await replyMessage(token, args.replyToken, [{
      type: 'text',
      text: result.reason === 'already_cancelled'
        ? `คิว ${q} ถูกยกเลิกไปแล้วค่ะ`
        : `คิว ${q} ไม่สามารถยกเลิกผ่านระบบได้แล้วค่ะ (กำลังเรียก/ให้บริการ) กรุณาติดต่อเจ้าหน้าที่`,
    }]);
    return;
  }

  const { booking } = result;
  // Log the tap so the portal chat inbox shows the customer's action.
  const { data: lineUser } = await admin
    .from('line_users')
    .select('id')
    .eq('shop_id', shop.id)
    .eq('line_user_id', args.userId)
    .maybeSingle();
  await admin.from('line_messages').insert({
    company_id: shop.company_id,
    shop_id: shop.id,
    line_user_id: lineUser?.id,
    direction: 'inbound',
    message_type: 'postback',
    message_text: `ยกเลิกคิว ${booking.queue_number ?? ''}`.trim(),
    payload: { action: CANCEL_BOOKING_ACTION, booking_id: booking.id },
  });

  await safeSyncBookingToGoogleCalendar(shop.id, booking.id);

  // A queue of a multi-pick order: the rest of the order now owes less, so the
  // reply carries the re-issued QR with the new amount.
  const rebalance = await rebalanceOrderAfterCustomerCancel(admin, {
    shopId: shop.id,
    companyId: shop.company_id,
    cancelledBookingId: booking.id,
  });
  const followUp: object[] = [];
  if (rebalance.kind === 'reissued') {
    followUp.push({
      type: 'text',
      text: `ยอดที่ต้องชำระสำหรับคิว ${rebalance.payerQueue} เปลี่ยนเป็น ${rebalance.amountTHB.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาทค่ะ${rebalance.flex ? ' กรุณาใช้ QR ใหม่ด้านล่าง (QR เดิมใช้ไม่ได้แล้ว)' : ' ร้านจะติดต่อเรื่องการชำระเงินค่ะ'}`,
    });
    if (rebalance.flex) followUp.push(rebalance.flex);
  } else if (rebalance.kind === 'staff_check') {
    followUp.push({ type: 'text', text: `ร้านได้รับแจ้งแล้วค่ะ จะตรวจสอบยอดที่ชำระสำหรับคิว ${rebalance.payerQueue} และติดต่อกลับ` });
  }

  await replyMessage(token, args.replyToken, [bookingSelfCancelledFlex({
    shopName: shop.name,
    queueNumber: booking.queue_number ?? '-',
    date: formatThaiDateLabel(booking.booking_date),
    time: booking.start_time.slice(0, 5),
    liffUrl: customerLiffUrl(shop, 'booking'),
  }), ...followUp]);
}

/**
 * Postback buttons come from Flex messages the shop itself pushed (e.g. "รับทราบ"
 * on a change notice, "ยกเลิกคิว" on a confirmation), so they are handled even
 * when auto-reply is switched off.
 */
async function handlePostbackEvent(
  admin: ReturnType<typeof createAdminClient>,
  shop: WebhookShop,
  event: LineWebhookEvent,
  token: string,
) {
  const userId = event.source?.userId;
  const replyToken = event.replyToken;
  const data = new URLSearchParams(event.postback?.data ?? '');
  if (!userId || !replyToken) return;

  if (data.get('action') === CANCEL_BOOKING_ACTION) {
    const bookingId = data.get('booking_id') ?? '';
    if (!UUID_RE.test(bookingId)) return;
    await handleCancelPostback(admin, shop, { userId, replyToken, bookingId }, token);
    return;
  }

  if (data.get('action') === 'ack_change') {
    const bookingId = data.get('booking_id') ?? '';
    if (!UUID_RE.test(bookingId)) return;
    const result = await acknowledgeBookingChange(admin, {
      shopId: shop.id,
      companyId: shop.company_id,
      externalLineUserId: userId,
      bookingId,
    });
    if (!result.ok) {
      await replyMessage(token, replyToken, [{ type: 'text', text: 'ไม่พบคิวนี้แล้วค่ะ หากมีข้อสงสัยกรุณาติดต่อเจ้าหน้าที่' }]);
      return;
    }
    const when = `${formatThaiDateLabel(result.booking.booking_date)} เวลา ${result.booking.start_time.slice(0, 5)}`;
    await replyMessage(token, replyToken, [{
      type: 'text',
      text: result.already
        ? `รับทราบไว้แล้วค่ะ แล้วพบกัน ${when} นะคะ`
        : `รับทราบแล้ว ขอบคุณค่ะ 🙏 แล้วพบกัน ${when} นะคะ`,
    }]);
  }
}

/**
 * Owner sends the one-time code from /portal/line-settings: store the sender as
 * the shop's owner LINE for alerts.
 */
async function handleOwnerLinkEvent(
  admin: ReturnType<typeof createAdminClient>,
  shop: WebhookShop,
  event: LineWebhookEvent,
  token: string,
) {
  const userId = event.source?.userId;
  const replyToken = event.replyToken;
  if (!userId || !replyToken) return;

  const code = parseOwnerLinkMessage(event.message?.text);
  const profile = code ? await fetchLineProfile(token, userId) : null;
  const outcome = code
    ? await linkOwnerLineFromCode(admin, shop.id, { userId, code, displayName: profile?.display_name ?? null })
    : 'invalid';

  const text = outcome === 'linked'
    ? `เชื่อม LINE นี้เป็นเจ้าของร้าน "${shop.name}" แล้ว ✅\nระบบจะแจ้งเรื่องสำคัญ เช่น โควต้าการจองใกล้เต็ม มาที่แชทนี้`
    : outcome === 'error'
      ? 'เชื่อมไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'
      : 'รหัสไม่ถูกต้องหรือหมดอายุ กรุณาสร้างรหัสใหม่ที่หน้า LINE Settings ในระบบหลังร้าน';
  await replyMessage(token, replyToken, [{ type: 'text', text }]);
}

export async function POST(req: Request, { params }: { params: Promise<{ shopKey: string }> }) {
  const { shopKey } = await params;
  const rawBody = await req.text();
  const signature = req.headers.get('x-line-signature') ?? '';

  const { admin, shop } = await getShopAndConfig(shopKey);
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  // Multi-tenant: each shop's webhook must be signed with that shop's own
  // channel secret. A platform-wide fallback would let one channel's secret
  // sign events for every shop that has not configured its own.
  const channelSecret = shop.line_channel_secret || '';
  const channelToken = shop.line_channel_access_token || '';

  if (!channelSecret || !channelToken) {
    return NextResponse.json({ error: 'LINE channel config missing' }, { status: 400 });
  }

  if (!verifyLineSignature(channelSecret, rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let body: LineWebhookBody;
  try {
    body = JSON.parse(rawBody) as LineWebhookBody;
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const events = body.events ?? [];
  const webhookShop: WebhookShop = {
    id: shop.id,
    company_id: shop.company_id,
    shop_key: shop.shop_key,
    name: shop.name,
    liff_id: shop.liff_id,
    liff_id_login_shop: shop.liff_id_login_shop,
  };
  const postbacks = events.filter((e) => e.type === 'postback');
  await Promise.all(postbacks.map((event) => handlePostbackEvent(admin, webhookShop, event, channelToken)));

  // "OWNER-XXXXXXXX" comes from the owner, not a customer: answered even with
  // auto-reply off, and kept out of the customer chat inbox.
  const ownerLinks = events.filter((e) => e.type === 'message' && e.message?.type === 'text' && looksLikeOwnerLinkMessage(e.message.text));
  await Promise.all(ownerLinks.map((event) => handleOwnerLinkEvent(admin, webhookShop, event, channelToken)));

  // Echoes the LIFF client sent on the customer's behalf: answered with the
  // booking / slip cards as free replies, whatever the auto-reply setting.
  const isText = (e: LineWebhookEvent) => e.type === 'message' && e.message?.type === 'text';
  const bookingEchoes = events.filter((e) => isText(e) && isBookingEcho(e.message?.text ?? ''));
  const slipEchoes = events.filter((e) => isText(e) && isSlipEcho(e.message?.text ?? ''));
  await Promise.all([
    ...bookingEchoes.map((event) => handleBookingEcho(admin, webhookShop, event, channelToken).catch((e) => console.error('[line_echo_failed]', e))),
    ...slipEchoes.map((event) => handleSlipEcho(admin, webhookShop, event, channelToken).catch((e) => console.error('[line_slip_echo_failed]', e))),
  ]);

  if (!shop.auto_reply_enabled) {
    return NextResponse.json({ ok: true, skipped: 'auto_reply_disabled', postbacks: postbacks.length, echoes: bookingEchoes.length + slipEchoes.length });
  }

  await Promise.all(
    events.map(async (event) => {
      if (ownerLinks.includes(event) || bookingEchoes.includes(event) || slipEchoes.includes(event)) return;
      if (event.type === 'message' && event.message?.type === 'text') {
        await handleTextEvent(admin, webhookShop, event, channelToken);
      } else if (event.type === 'message') {
        await handleNonTextMessageEvent(admin, { id: shop.id, company_id: shop.company_id }, event, channelToken);
      }
    }),
  );

  return NextResponse.json({ ok: true });
}
