import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { createAdminClient } from '@/lib/supabase/admin';
import { writeAuditLog } from '@/lib/audit/activity-log';
import { hitRateLimit, tooManyRequests } from '@/lib/security/rate-limit';
import {
  OWNER_LINK_CODE_TTL_MINUTES,
  generateOwnerLinkCode,
  hashOwnerLinkCode,
  oaMessageUrl,
  ownerLinkMessage,
} from '@/lib/line/owner-line';
import { fetchOaBasicId, safePushOwnerLine } from '@/lib/line/owner-line-server';

/**
 * Owner LINE for shop alerts (quota near / at limit).
 * GET status · POST `create_code` | `test` · DELETE unlink.
 */

const PostSchema = z.object({ action: z.enum(['create_code', 'test']) });

type OwnerLineRow = {
  line_channel_access_token?: string | null;
  owner_line_user_id?: string | null;
  owner_line_display_name?: string | null;
  owner_line_linked_at?: string | null;
  owner_line_link_code_expires_at?: string | null;
};

const OWNER_COLUMNS = 'line_channel_access_token,owner_line_user_id,owner_line_display_name,owner_line_linked_at,owner_line_link_code_expires_at';

/** Load the owner columns; `null` when the migration has not run. */
async function loadOwnerRow(admin: ReturnType<typeof createAdminClient>, shopId: string): Promise<OwnerLineRow | null> {
  const { data, error } = await admin.from('shops').select(OWNER_COLUMNS).eq('id', shopId).maybeSingle();
  if (error) {
    console.error('[owner-line] load failed:', error.message);
    return null;
  }
  return (data as OwnerLineRow | null) ?? {};
}

export async function GET() {
  try {
    const { profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager'] });
    const admin = createAdminClient();
    const row = await loadOwnerRow(admin, profile.shop_id as string);
    if (!row) return NextResponse.json({ data: { available: false } });

    const pendingUntil = row.owner_line_link_code_expires_at && new Date(row.owner_line_link_code_expires_at).getTime() > Date.now()
      ? row.owner_line_link_code_expires_at
      : null;
    return NextResponse.json({
      data: {
        available: true,
        line_connected: Boolean(row.line_channel_access_token),
        linked: Boolean(row.owner_line_user_id),
        display_name: row.owner_line_display_name ?? null,
        linked_at: row.owner_line_linked_at ?? null,
        code_pending_until: pendingUntil,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function POST(req: Request) {
  try {
    const { user, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner'] });
    const parsed = PostSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });

    const shopId = profile.shop_id as string;
    const admin = createAdminClient();
    if (!(await hitRateLimit(admin, 'ownerLine', shopId))) return tooManyRequests();

    const row = await loadOwnerRow(admin, shopId);
    if (!row) return NextResponse.json({ error: 'ระบบยังไม่พร้อม (ยังไม่ได้รัน migration)' }, { status: 503 });
    if (!row.line_channel_access_token) {
      return NextResponse.json({ error: 'ร้านยังไม่ได้เชื่อม LINE OA — ตั้งค่า Channel Access Token ก่อน' }, { status: 400 });
    }

    if (parsed.data.action === 'test') {
      const result = await safePushOwnerLine(admin, shopId, 'ทดสอบการแจ้งเตือนเจ้าของร้าน ✅\nต่อไปนี้ระบบจะแจ้งเรื่องสำคัญของร้านมาที่แชทนี้', { only: 'shop' });
      if (!result.sent) {
        const message = result.reason === 'not_linked' ? 'ยังไม่ได้เชื่อม LINE เจ้าของร้าน' : 'ส่งข้อความไม่สำเร็จ — ตรวจว่ายังเป็นเพื่อนกับ LINE OA ของร้านอยู่';
        return NextResponse.json({ error: message }, { status: 400 });
      }
      return NextResponse.json({ data: { sent: true } });
    }

    const code = generateOwnerLinkCode();
    const expiresAt = new Date(Date.now() + OWNER_LINK_CODE_TTL_MINUTES * 60_000).toISOString();
    const { error } = await admin
      .from('shops')
      .update({ owner_line_link_code_hash: hashOwnerLinkCode(code), owner_line_link_code_expires_at: expiresAt, updated_by: user.id })
      .eq('id', shopId);
    if (error) throw error;

    const message = ownerLinkMessage(code);
    const basicId = await fetchOaBasicId(row.line_channel_access_token);
    await writeAuditLog({
      companyId: profile.company_id,
      shopId,
      userId: user.id,
      action: 'owner_line_code_created',
      targetTable: 'shops',
      targetId: shopId,
    });
    return NextResponse.json({
      data: { code, message, expires_at: expiresAt, basic_id: basicId, oa_message_url: oaMessageUrl(basicId, message) },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function DELETE() {
  try {
    const { user, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner'] });
    const shopId = profile.shop_id as string;
    const admin = createAdminClient();
    const { error } = await admin
      .from('shops')
      .update({
        owner_line_user_id: null,
        owner_line_display_name: null,
        owner_line_linked_at: null,
        owner_line_link_code_hash: null,
        owner_line_link_code_expires_at: null,
        updated_by: user.id,
      })
      .eq('id', shopId);
    if (error) throw error;
    await writeAuditLog({
      companyId: profile.company_id,
      shopId,
      userId: user.id,
      action: 'owner_line_unlinked',
      targetTable: 'shops',
      targetId: shopId,
    });
    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
