import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseIntent } from '@/lib/intent/rule-based';
import { verifyLineSignature } from '@/lib/line/signature';
import { replyMessage } from '@/lib/line/client';
import {
  CANCEL_BOOKING_ACTION,
  bookingCancelPromptFlex,
  bookingConfirmMessage,
  bookingSelfCancelledFlex,
  fallbackMessage,
  liffEntryMessage,
  slotMessage,
} from '@/lib/line/messages';
import { resolveCustomerLiffUrl } from '@/lib/line/liff-url';
import { isBookingEcho } from '@/lib/line/booking-echo';
import { toBangkokStamp } from '@/lib/line/booking-reminder';
import type { LineWebhookBody, LineWebhookEvent } from '@/lib/line/types';
import { env } from '@/lib/utils/env';
import { acknowledgeBookingChange } from '@/lib/booking/acknowledge-change';
import { cancelBookingByCustomer } from '@/lib/booking/cancel-by-customer';
import { CUSTOMER_CANCELLABLE_STATUSES } from '@/lib/booking/status-flow';
import { safeSyncBookingToGoogleCalendar } from '@/lib/google-calendar/sync';
import { formatThaiDateLabel } from '@/lib/utils/date-format';

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
    message_text: text,
    payload: event as unknown as Record<string, unknown>,
  });

  // The booking echo exists only to raise an unread badge in LINE OA Chat. It is
  // already logged above so the portal chat inbox sees it — replying would stack
  // an intent menu on top of the Flex confirmation the customer just received.
  if (isBookingEcho(text)) return;

  const parsed = parseIntent(text);

  if (parsed.intent === 'ask_available_slots') {
    const bookingDate = parsed.date ?? todayISO();
    const { data: branch } = await admin.from('branches').select('id,branch_name').eq('shop_id', shop.id).eq('active', true).limit(1).maybeSingle();
    const { data: service } = await admin.from('services').select('id,service_name').eq('shop_id', shop.id).eq('active', true).limit(1).maybeSingle();

    if (!branch || !service) {
      await replyMessage(token, replyToken, [{ type: 'text', text: 'ร้านยังไม่ได้ตั้งค่าสาขาหรือบริการค่ะ' }]);
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

    const { data: booking } = await admin
      .from('bookings')
      .select('queue_number,booking_date,start_time,status,branches(branch_name),services(service_name)')
      .eq('shop_id', shop.id)
      .eq('line_user_id', lineUserRow.id)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!booking) {
      await replyMessage(token, replyToken, [{ type: 'text', text: 'ยังไม่พบคิวที่กำลังใช้งานค่ะ' }]);
      return;
    }

    await replyMessage(token, replyToken, [bookingConfirmMessage({
      queueNumber: booking.queue_number,
      branch: (booking.branches as { branch_name?: string } | null)?.branch_name ?? '-',
      service: (booking.services as { service_name?: string } | null)?.service_name ?? '-',
      date: booking.booking_date,
      time: String(booking.start_time).slice(0, 5),
    })]);
    return;
  }

  if (parsed.intent === 'contact_staff') {
    await replyMessage(token, replyToken, [{ type: 'text', text: 'รับเรื่องแล้วค่ะ เจ้าหน้าที่จะติดต่อกลับโดยเร็วที่สุด' }]);
    return;
  }

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

  await replyMessage(token, args.replyToken, [bookingSelfCancelledFlex({
    shopName: shop.name,
    queueNumber: booking.queue_number ?? '-',
    date: formatThaiDateLabel(booking.booking_date),
    time: booking.start_time.slice(0, 5),
    liffUrl: customerLiffUrl(shop, 'booking'),
  })]);
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

export async function POST(req: Request, { params }: { params: Promise<{ shopKey: string }> }) {
  const { shopKey } = await params;
  const rawBody = await req.text();
  const signature = req.headers.get('x-line-signature') ?? '';

  const { admin, shop } = await getShopAndConfig(shopKey);
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  const channelSecret = shop.line_channel_secret || process.env.LINE_CHANNEL_SECRET || '';
  const channelToken = shop.line_channel_access_token || process.env.LINE_CHANNEL_ACCESS_TOKEN || '';

  if (!channelSecret || !channelToken) {
    return NextResponse.json({ error: 'LINE channel config missing' }, { status: 400 });
  }

  if (!verifyLineSignature(channelSecret, rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const body = JSON.parse(rawBody) as LineWebhookBody;

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

  if (!shop.auto_reply_enabled) {
    return NextResponse.json({ ok: true, skipped: 'auto_reply_disabled', postbacks: postbacks.length });
  }

  await Promise.all(
    events.map(async (event) => {
      if (event.type === 'message' && event.message?.type === 'text') {
        await handleTextEvent(admin, webhookShop, event, channelToken);
      } else if (event.type === 'message') {
        await handleNonTextMessageEvent(admin, { id: shop.id, company_id: shop.company_id }, event, channelToken);
      }
    }),
  );

  return NextResponse.json({ ok: true });
}
