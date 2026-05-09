import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseIntent } from '@/lib/intent/rule-based';
import { verifyLineSignature } from '@/lib/line/signature';
import { replyMessage } from '@/lib/line/client';
import { bookingConfirmMessage, fallbackMessage, liffEntryMessage, slotMessage } from '@/lib/line/messages';
import type { LineWebhookBody, LineWebhookEvent } from '@/lib/line/types';
import { env } from '@/lib/utils/env';

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
    .select('id,company_id,name,shop_key,line_channel_access_token,line_channel_secret,auto_reply_enabled')
    .eq('shop_key', shopKey)
    .single();
  return { admin, shop };
}

async function handleTextEvent(admin: ReturnType<typeof createAdminClient>, shop: { id: string; company_id: string; shop_key: string; name: string }, event: LineWebhookEvent, token: string) {
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
    const liffUrl = `${env.appUrl}/liff/${shop.shop_key}`;
    await replyMessage(token, replyToken, [liffEntryMessage(liffUrl)]);
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

  if (!shop.auto_reply_enabled) {
    return NextResponse.json({ ok: true, skipped: 'auto_reply_disabled' });
  }

  await Promise.all(
    (body.events ?? []).map(async (event) => {
      if (event.type === 'message' && event.message?.type === 'text') {
        await handleTextEvent(admin, { id: shop.id, company_id: shop.company_id, shop_key: shop.shop_key, name: shop.name }, event, channelToken);
      } else if (event.type === 'message') {
        await handleNonTextMessageEvent(admin, { id: shop.id, company_id: shop.company_id }, event, channelToken);
      }
    }),
  );

  return NextResponse.json({ ok: true });
}
