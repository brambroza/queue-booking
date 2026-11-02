import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyLineSignature } from '@/lib/line/signature';
import { replyMessage } from '@/lib/line/client';
import { looksLikeOwnerLinkMessage, parseOwnerLinkMessage } from '@/lib/line/owner-line';
import { fetchLineDisplayName, linkPlatformLineFromCode, platformLineToken } from '@/lib/line/owner-line-server';
import type { LineWebhookBody, LineWebhookEvent } from '@/lib/line/types';

/**
 * Webhook of the platform OA (QueueBooking), signed with the platform channel
 * secret from env — the only webhook that uses env credentials; shop webhooks
 * (`/api/line/webhook/[shopKey]`) never fall back to them.
 *
 * Handles one thing: a shop owner sending the `OWNER-XXXXXXXX` code a
 * super_admin created on /portal/shop-subscriptions. Everything else is left
 * for the admin team to answer in LINE OA Manager (no auto reply).
 */

async function handleLinkEvent(admin: ReturnType<typeof createAdminClient>, event: LineWebhookEvent, token: string) {
  const userId = event.source?.userId;
  const replyToken = event.replyToken;
  if (!userId || !replyToken) return;

  const code = parseOwnerLinkMessage(event.message?.text);
  const displayName = code ? await fetchLineDisplayName(token, userId) : null;
  const result = code ? await linkPlatformLineFromCode(admin, { userId, code, displayName }) : { outcome: 'invalid' as const };

  const text = result.outcome === 'linked'
    ? `เชื่อม LINE นี้กับร้าน "${result.shopName ?? 'ของคุณ'}" แล้ว ✅\nระบบจะแจ้งเรื่องสำคัญของร้าน เช่น โควต้าการจองใกล้เต็ม มาที่แชทนี้`
    : result.outcome === 'error'
      ? 'เชื่อมไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'
      : 'รหัสไม่ถูกต้องหรือหมดอายุ กรุณาขอรหัสใหม่จากทีมงาน';
  try {
    await replyMessage(token, replyToken, [{ type: 'text', text }]);
  } catch (e) {
    console.error('[platform-webhook] reply failed:', e instanceof Error ? e.message : e);
  }
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-line-signature') ?? '';

  const secret = process.env.LINE_CHANNEL_SECRET ?? '';
  const token = platformLineToken();
  if (!secret || !token) {
    console.error('[platform-webhook] LINE_CHANNEL_SECRET / LINE_CHANNEL_ACCESS_TOKEN not set');
    return NextResponse.json({ error: 'LINE channel config missing' }, { status: 400 });
  }
  if (!verifyLineSignature(secret, rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let body: LineWebhookBody;
  try {
    body = JSON.parse(rawBody) as LineWebhookBody;
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  // LINE's "Verify" button sends an empty events array: answer 200.
  const links = (body.events ?? []).filter(
    (e) => e.type === 'message' && e.message?.type === 'text' && looksLikeOwnerLinkMessage(e.message.text),
  );
  if (links.length > 0) {
    const admin = createAdminClient();
    await Promise.all(links.map((event) => handleLinkEvent(admin, event, token)));
  }
  return NextResponse.json({ ok: true, linked_attempts: links.length });
}
