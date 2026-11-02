import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { createAdminClient } from '@/lib/supabase/admin';
import { writeAuditLog } from '@/lib/audit/activity-log';
import { hitRateLimit, tooManyRequests } from '@/lib/security/rate-limit';
import { lineAddFriendUrl } from '@/lib/line/customer-guide';
import {
  OWNER_LINK_CODE_TTL_MINUTES,
  generateOwnerLinkCode,
  hashOwnerLinkCode,
  oaMessageUrl,
  ownerLinkMessage,
} from '@/lib/line/owner-line';
import { fetchOaBasicId, platformLineToken, safePushOwnerLine } from '@/lib/line/owner-line-server';

/**
 * super_admin: link each shop owner's LINE to the platform OA (QueueBooking)
 * for owner alerts. GET status of every shop · POST `create_code` | `test` ·
 * DELETE unlink. The owner finishes the link by sending the code to the OA
 * (`/api/line/webhook/platform`).
 */

const ShopIdSchema = z.string().uuid();
const PostSchema = z.object({ shop_id: ShopIdSchema, action: z.enum(['create_code', 'test']) });
const DeleteSchema = z.object({ shop_id: ShopIdSchema });

type PlatformRow = {
  id: string;
  platform_line_user_id?: string | null;
  platform_line_display_name?: string | null;
  platform_line_linked_at?: string | null;
  platform_line_link_code_expires_at?: string | null;
};
type ShopOaRow = { id: string; owner_line_user_id?: string | null; owner_line_display_name?: string | null };

export type ShopLineStatus = {
  platform: { linked: boolean; display_name: string | null; linked_at: string | null; code_pending_until: string | null };
  shop_oa: { linked: boolean; display_name: string | null };
};

/** Webhook URL to paste into the QueueBooking channel in LINE Developers. */
function platformWebhookUrl(): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '');
  return `${base}/api/line/webhook/platform`;
}

export async function GET() {
  try {
    await requireAuthContext({ roles: ['super_admin'] });
    const admin = createAdminClient();
    const token = platformLineToken();

    // Each link has its own migration; read them apart so one missing column set does not blank the other.
    const [platform, shopOa, basicId] = await Promise.all([
      admin
        .from('shops')
        .select('id,platform_line_user_id,platform_line_display_name,platform_line_linked_at,platform_line_link_code_expires_at')
        .eq('is_deleted', false),
      admin.from('shops').select('id,owner_line_user_id,owner_line_display_name').eq('is_deleted', false),
      fetchOaBasicId(token),
    ]);
    if (platform.error) console.error('[admin/shop-line] platform columns:', platform.error.message);

    const now = Date.now();
    const statuses: Record<string, ShopLineStatus> = {};
    const empty = (): ShopLineStatus => ({
      platform: { linked: false, display_name: null, linked_at: null, code_pending_until: null },
      shop_oa: { linked: false, display_name: null },
    });
    for (const row of (platform.error ? [] : platform.data ?? []) as PlatformRow[]) {
      const s = (statuses[row.id] ??= empty());
      const pending = row.platform_line_link_code_expires_at;
      s.platform = {
        linked: Boolean(row.platform_line_user_id),
        display_name: row.platform_line_display_name ?? null,
        linked_at: row.platform_line_linked_at ?? null,
        code_pending_until: pending && new Date(pending).getTime() > now ? pending : null,
      };
    }
    for (const row of (shopOa.error ? [] : shopOa.data ?? []) as ShopOaRow[]) {
      const s = (statuses[row.id] ??= empty());
      s.shop_oa = { linked: Boolean(row.owner_line_user_id), display_name: row.owner_line_display_name ?? null };
    }

    return NextResponse.json({
      data: {
        available: !platform.error,
        platform_oa: {
          configured: Boolean(token && process.env.LINE_CHANNEL_SECRET),
          basic_id: basicId,
          add_friend_url: lineAddFriendUrl(basicId),
          webhook_url: platformWebhookUrl(),
        },
        shops: statuses,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function POST(req: Request) {
  try {
    const { user } = await requireAuthContext({ roles: ['super_admin'] });
    const parsed = PostSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
    const { shop_id: shopId, action } = parsed.data;

    const admin = createAdminClient();
    if (!(await hitRateLimit(admin, 'ownerLine', `admin:${shopId}`))) return tooManyRequests();

    const token = platformLineToken();
    if (!token) return NextResponse.json({ error: 'ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN ของ OA QueueBooking' }, { status: 400 });

    const { data: shop, error: shopError } = await admin
      .from('shops')
      .select('id,name,company_id')
      .eq('id', shopId)
      .eq('is_deleted', false)
      .maybeSingle();
    if (shopError) throw shopError;
    if (!shop) return NextResponse.json({ error: 'ไม่พบร้านนี้' }, { status: 404 });

    if (action === 'test') {
      const result = await safePushOwnerLine(
        admin,
        shopId,
        `ทดสอบการแจ้งเตือนร้าน "${shop.name}" จาก QueueBooking ✅\nต่อไปนี้ระบบจะแจ้งเรื่องสำคัญของร้านมาที่แชทนี้`,
        { only: 'platform' },
      );
      if (!result.sent) {
        const message = result.reason === 'not_linked'
          ? 'ร้านนี้ยังไม่ได้เชื่อม LINE กับ OA QueueBooking'
          : result.reason === 'not_migrated'
            ? 'ระบบยังไม่พร้อม (ยังไม่ได้รัน migration)'
            : 'ส่งข้อความไม่สำเร็จ — เจ้าของร้านอาจบล็อกหรือลบเพื่อน OA QueueBooking';
        return NextResponse.json({ error: message }, { status: 400 });
      }
      return NextResponse.json({ data: { sent: true } });
    }

    const code = generateOwnerLinkCode();
    const expiresAt = new Date(Date.now() + OWNER_LINK_CODE_TTL_MINUTES * 60_000).toISOString();
    const { error } = await admin
      .from('shops')
      .update({ platform_line_link_code_hash: hashOwnerLinkCode(code), platform_line_link_code_expires_at: expiresAt })
      .eq('id', shopId);
    if (error) {
      console.error('[admin/shop-line] create code failed:', error.message);
      return NextResponse.json({ error: 'สร้างรหัสไม่สำเร็จ (ยังไม่ได้รัน migration?)' }, { status: 503 });
    }

    const message = ownerLinkMessage(code);
    const basicId = await fetchOaBasicId(token);
    await writeAuditLog({
      companyId: shop.company_id,
      shopId,
      userId: user.id,
      action: 'platform_line_code_created',
      targetTable: 'shops',
      targetId: shopId,
    });
    return NextResponse.json({
      data: {
        code,
        message,
        expires_at: expiresAt,
        basic_id: basicId,
        add_friend_url: lineAddFriendUrl(basicId),
        oa_message_url: oaMessageUrl(basicId, message),
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function DELETE(req: Request) {
  try {
    const { user } = await requireAuthContext({ roles: ['super_admin'] });
    const parsed = DeleteSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
    const shopId = parsed.data.shop_id;

    const admin = createAdminClient();
    const { data: shop, error } = await admin
      .from('shops')
      .update({
        platform_line_user_id: null,
        platform_line_display_name: null,
        platform_line_linked_at: null,
        platform_line_link_code_hash: null,
        platform_line_link_code_expires_at: null,
      })
      .eq('id', shopId)
      .select('id,company_id')
      .maybeSingle();
    if (error) throw error;
    if (!shop) return NextResponse.json({ error: 'ไม่พบร้านนี้' }, { status: 404 });

    await writeAuditLog({
      companyId: shop.company_id,
      shopId,
      userId: user.id,
      action: 'platform_line_unlinked',
      targetTable: 'shops',
      targetId: shopId,
    });
    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
