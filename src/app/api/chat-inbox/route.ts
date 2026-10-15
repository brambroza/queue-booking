import { NextResponse } from 'next/server';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { createAdminClient } from '@/lib/supabase/admin';
import { escapePostgrestSearch } from '@/lib/utils/postgrest';
import { sniffImageMime } from '@/lib/utils/image-sniff';

const MEDIA_BUCKET = 'chat-media';
/** Public bucket: keep uploads small and limited to inert media types. */
const MEDIA_MAX_BYTES = 20 * 1024 * 1024;
const VIDEO_MIME = new Set(['video/mp4', 'video/quicktime']);
const FILE_MIME = new Set(['application/pdf']);

/**
 * Decide the content type to store for an upload, trusting bytes over the
 * client-declared type. Anything that could render as active content in a
 * browser (HTML, SVG, JS) is refused.
 *
 * @returns The safe MIME type, or null when the upload is not allowed.
 */
function safeMediaMime(bytes: Uint8Array, declared: string): string | null {
  const image = sniffImageMime(bytes);
  if (image) return image;
  const head = Buffer.from(bytes.subarray(0, 12));
  if (FILE_MIME.has(declared) && head.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  if (VIDEO_MIME.has(declared) && head.subarray(4, 8).toString('latin1') === 'ftyp') return declared;
  return null;
}

function toInt(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function ensureBucket(admin: ReturnType<typeof createAdminClient>) {
  const { data: bucket } = await admin.storage.getBucket(MEDIA_BUCKET);
  if (bucket) return;
  const { error } = await admin.storage.createBucket(MEDIA_BUCKET, {
    public: true,
    fileSizeLimit: 50 * 1024 * 1024,
  });
  if (error) throw error;
}

export async function GET(req: Request) {
  try {
    const { profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager', 'staff'] });
    const { searchParams } = new URL(req.url);
    const lineUserPk = searchParams.get('line_user_id');
    const q = searchParams.get('q');
    const page = toInt(searchParams.get('page'), 1);
    const pageSize = Math.min(toInt(searchParams.get('page_size'), 30), 100);

    const admin = createAdminClient();

    let usersQuery = admin
      .from('line_users')
      .select('id,line_user_id,display_name,picture_url,status_message,updated_at', { count: 'exact' })
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false)
      .order('updated_at', { ascending: false });

    const safeQ = escapePostgrestSearch(q);
    if (safeQ) {
      // Search also hits the customer nickname the shop knows them by.
      const { data: nickMatches } = await admin
        .from('customers')
        .select('line_user_id')
        .eq('shop_id', profile.shop_id)
        .eq('is_deleted', false)
        .not('line_user_id', 'is', null)
        .ilike('nickname', `%${safeQ}%`)
        .limit(100);
      const nickIds = [...new Set((nickMatches ?? []).map((c) => c.line_user_id as string))];
      const filters = [`display_name.ilike.%${safeQ}%`, `line_user_id.ilike.%${safeQ}%`];
      if (nickIds.length) filters.push(`id.in.(${nickIds.join(',')})`);
      usersQuery = usersQuery.or(filters.join(','));
    }

    const from = (page - 1) * pageSize;
    const { data: usersRaw, error: usersError, count } = await usersQuery.range(from, from + pageSize - 1);
    if (usersError) throw usersError;

    // Attach the customer nickname (customers.nickname) so pickers can show
    // "นัท (LINE display name)". A LINE user may map to several customer rows;
    // the most recently updated one wins.
    const userIds = (usersRaw ?? []).map((u) => u.id);
    const nicknameByLineUser = new Map<string, string>();
    if (userIds.length) {
      const { data: customers } = await admin
        .from('customers')
        .select('line_user_id,nickname,updated_at')
        .eq('shop_id', profile.shop_id)
        .eq('is_deleted', false)
        .in('line_user_id', userIds)
        .not('nickname', 'is', null)
        .order('updated_at', { ascending: false });
      for (const c of customers ?? []) {
        const nick = (c.nickname ?? '').trim();
        if (c.line_user_id && nick && !nicknameByLineUser.has(c.line_user_id)) nicknameByLineUser.set(c.line_user_id, nick);
      }
    }
    // Latest message per conversation for the list preview (one small query per row, page ≤ 100).
    const lastMessages = await Promise.all(
      userIds.map(async (id) => {
        const { data } = await admin
          .from('line_messages')
          .select('direction,message_type,message_text,created_at')
          .eq('shop_id', profile.shop_id)
          .eq('line_user_id', id)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        return [id, data] as const;
      }),
    );
    const lastMessageByUser = new Map(lastMessages);
    const users = (usersRaw ?? [])
      .map((u) => ({ ...u, nickname: nicknameByLineUser.get(u.id) ?? null, last_message: lastMessageByUser.get(u.id) ?? null }))
      // Most recent conversation first within the page, like LINE.
      .sort((a, b) => (b.last_message?.created_at ?? '').localeCompare(a.last_message?.created_at ?? ''));

    const msgPage = toInt(searchParams.get('msg_page'), 1);
    const msgPageSize = Math.min(toInt(searchParams.get('msg_page_size'), 100), 200);

    let messages: unknown[] = [];
    if (lineUserPk) {
      const msgFrom = (msgPage - 1) * msgPageSize;
      const { data: msg, error: msgError } = await admin
        .from('line_messages')
        .select('id,direction,message_type,message_text,payload,created_at')
        .eq('shop_id', profile.shop_id)
        .eq('line_user_id', lineUserPk)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .range(msgFrom, msgFrom + msgPageSize - 1);
      if (msgError) throw msgError;
      messages = (msg ?? []).reverse();
    }

    return NextResponse.json({ data: { users, messages }, pagination: { page, page_size: pageSize, total: count ?? 0 } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function POST(req: Request) {
  try {
    const { profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager', 'staff'] });
    const contentType = req.headers.get('content-type') ?? '';

    let lineUserId = '';
    let messageType: string = 'text';
    let message: string | undefined;
    let stickerPackageId: string | undefined;
    let stickerId: string | undefined;
    let mediaFile: File | null = null;

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      lineUserId = String(form.get('line_user_id') ?? '');
      message = String(form.get('message') ?? '').trim() || undefined;
      messageType = String(form.get('message_type') ?? 'text');
      stickerPackageId = String(form.get('sticker_package_id') ?? '') || undefined;
      stickerId = String(form.get('sticker_id') ?? '') || undefined;
      const file = form.get('file');
      mediaFile = file instanceof File && file.size > 0 ? file : null;
    } else {
      const body = await req.json();
      lineUserId = String(body.line_user_id ?? '');
      messageType = (body.message_type as string | undefined) ?? 'text';
      message = body.message as string | undefined;
      stickerPackageId = body.sticker_package_id as string | undefined;
      stickerId = body.sticker_id as string | undefined;
    }

    if (!lineUserId) return NextResponse.json({ error: 'Missing line_user_id' }, { status: 400 });
    if (messageType === 'text' && !message?.trim()) return NextResponse.json({ error: 'Missing message' }, { status: 400 });
    if (messageType === 'sticker' && (!stickerPackageId || !stickerId)) {
      return NextResponse.json({ error: 'Missing sticker_package_id or sticker_id' }, { status: 400 });
    }

    if (lineUserId.length > 64 || (message?.length ?? 0) > 5000) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: shop, error: shopError } = await admin.from('shops').select('line_channel_access_token').eq('id', profile.shop_id).single();

    if (shopError || !shop?.line_channel_access_token) {
      return NextResponse.json({ error: 'LINE token not configured' }, { status: 400 });
    }

    // Only message people who have actually talked to this shop's OA.
    const { data: recipient } = await admin
      .from('line_users')
      .select('id')
      .eq('shop_id', profile.shop_id)
      .eq('line_user_id', lineUserId)
      .eq('is_deleted', false)
      .maybeSingle();
    if (!recipient) return NextResponse.json({ error: 'Recipient not found' }, { status: 404 });

    let payloadForDb: Record<string, unknown> | null = null;
    let linePayloadMessage: Array<Record<string, unknown>>;

    if (mediaFile) {
      if (mediaFile.size > MEDIA_MAX_BYTES) {
        return NextResponse.json({ error: 'ไฟล์ใหญ่เกิน 20MB' }, { status: 400 });
      }
      const bytes = Buffer.from(await mediaFile.arrayBuffer());
      const mime = safeMediaMime(new Uint8Array(bytes), mediaFile.type);
      if (!mime) {
        return NextResponse.json({ error: 'รองรับเฉพาะรูป วิดีโอ MP4/MOV หรือ PDF' }, { status: 400 });
      }

      await ensureBucket(admin);
      const kind = mime.startsWith('image/') ? 'image' : mime.startsWith('video/') ? 'video' : 'file';

      const path = `${profile.shop_id}/${Date.now()}-${safeFileName(mediaFile.name || 'file').slice(0, 80)}`;
      const { error: uploadError } = await admin.storage.from(MEDIA_BUCKET).upload(path, bytes, {
        upsert: false,
        contentType: mime,
      });
      if (uploadError) throw uploadError;

      const { data: publicData } = admin.storage.from(MEDIA_BUCKET).getPublicUrl(path);
      const mediaUrl = publicData.publicUrl;

      if (kind === 'image') {
        messageType = 'image';
        linePayloadMessage = [{ type: 'image', originalContentUrl: mediaUrl, previewImageUrl: mediaUrl }];
      } else {
        messageType = kind;
        linePayloadMessage = [{
          type: 'text',
          text: kind === 'video'
            ? `วิดีโอจากร้าน: ${mediaFile.name}\n${mediaUrl}`
            : `ไฟล์จากร้าน: ${mediaFile.name}\n${mediaUrl}`,
        }];
      }

      payloadForDb = {
        media_url: mediaUrl,
        media_name: mediaFile.name,
        media_size: mediaFile.size,
        media_type: mediaFile.type,
        storage_path: path,
      };
    } else if (messageType === 'sticker') {
      linePayloadMessage = [{ type: 'sticker', packageId: stickerPackageId, stickerId }];
      payloadForDb = { sticker_package_id: stickerPackageId, sticker_id: stickerId };
    } else {
      linePayloadMessage = [{ type: 'text', text: message!.trim() }];
    }

    const pushRes = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${shop.line_channel_access_token}`,
      },
      body: JSON.stringify({ to: lineUserId, messages: linePayloadMessage }),
    });

    if (!pushRes.ok) {
      const text = await pushRes.text();
      return NextResponse.json({ error: `LINE push failed: ${text}` }, { status: 400 });
    }

    const { data: lineUserRow } = await admin.from('line_users').select('id,company_id').eq('shop_id', profile.shop_id).eq('line_user_id', lineUserId).maybeSingle();

    await admin.from('line_messages').insert({
      company_id: lineUserRow?.company_id ?? profile.company_id,
      shop_id: profile.shop_id,
      line_user_id: lineUserRow?.id ?? null,
      direction: 'outbound',
      message_type: messageType,
      message_text: messageType === 'text' ? message!.trim() : null,
      payload: payloadForDb,
    });

    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
