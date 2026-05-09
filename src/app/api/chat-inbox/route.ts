import { NextResponse } from 'next/server';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { createAdminClient } from '@/lib/supabase/admin';

function toInt(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
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
      .select('id,line_user_id,display_name,picture_url,updated_at', { count: 'exact' })
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false)
      .order('updated_at', { ascending: false });

    if (q) usersQuery = usersQuery.or(`display_name.ilike.%${q}%,line_user_id.ilike.%${q}%`);

    const from = (page - 1) * pageSize;
    const { data: users, error: usersError, count } = await usersQuery.range(from, from + pageSize - 1);
    if (usersError) throw usersError;

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

    return NextResponse.json({ data: { users: users ?? [], messages }, pagination: { page, page_size: pageSize, total: count ?? 0 } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function POST(req: Request) {
  try {
    const { profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager', 'staff'] });
    const body = await req.json();
    const lineUserId = body.line_user_id as string;
    const messageType = (body.message_type as string | undefined) ?? 'text';
    const message = body.message as string | undefined;
    const stickerPackageId = body.sticker_package_id as string | undefined;
    const stickerId = body.sticker_id as string | undefined;
    if (!lineUserId) return NextResponse.json({ error: 'Missing line_user_id' }, { status: 400 });
    if (messageType === 'text' && !message?.trim()) return NextResponse.json({ error: 'Missing message' }, { status: 400 });
    if (messageType === 'sticker' && (!stickerPackageId || !stickerId)) {
      return NextResponse.json({ error: 'Missing sticker_package_id or sticker_id' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: shop, error: shopError } = await admin.from('shops').select('line_channel_access_token').eq('id', profile.shop_id).single();

    if (shopError || !shop?.line_channel_access_token) {
      return NextResponse.json({ error: 'LINE token not configured' }, { status: 400 });
    }

    const linePayloadMessage = messageType === 'sticker'
      ? [{ type: 'sticker', packageId: stickerPackageId, stickerId }]
      : [{ type: 'text', text: message!.trim() }];

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
      payload: messageType === 'sticker' ? { sticker_package_id: stickerPackageId, sticker_id: stickerId } : null,
    });

    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
