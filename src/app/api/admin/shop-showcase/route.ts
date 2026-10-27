import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { createAdminClient } from '@/lib/supabase/admin';
import { writeAuditLog } from '@/lib/audit/activity-log';
import { safeCreateNotification } from '@/lib/notifications/createNotification';
import { isLineConnected } from '@/lib/onboarding/status';
import { ShowcaseRuleError, applyAdminAction, isShowcasePublished, showcaseEligibility, type ShowcaseRow } from '@/lib/showcase/showcase-rules';
import {
  SHOWCASE_COLUMNS,
  ShowcaseNotMigratedError,
  invalidatePublicShowcase,
  isMissingTableError,
  loadShowcaseRow,
  logShowcaseEvents,
  saveShowcaseRow,
} from '@/lib/showcase/showcase-server';

const PatchSchema = z.object({
  shop_id: z.string().uuid(),
  action: z.enum(['approve', 'reject', 'unpublish', 'feature', 'unfeature']),
  reason: z.string().trim().max(300).optional().nullable(),
});

type ShopJoin = {
  id: string;
  name: string;
  shop_key: string | null;
  logo_url: string | null;
  business_type: string | null;
  demo_mode_enabled: boolean | null;
  line_channel_access_token: string | null;
  line_channel_secret: string | null;
  liff_id: string | null;
};

/** Non-demo, non-cancelled bookings — the "real usage" hint shown to the reviewer. */
async function countRealBookings(admin: ReturnType<typeof createAdminClient>, shopId: string): Promise<number> {
  const { count } = await admin
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('shop_id', shopId)
    .eq('is_demo', false)
    .eq('is_deleted', false)
    .not('status', 'in', '(cancelled,no_show)');
  return count ?? 0;
}

/** Every shop that has given consent or has a review history, pending first. */
export async function GET() {
  try {
    await requireAuthContext({ roles: ['super_admin'] });
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('shop_showcase')
      .select(
        `${SHOWCASE_COLUMNS},shops!inner(id,name,shop_key,logo_url,business_type,demo_mode_enabled,line_channel_access_token,line_channel_secret,liff_id)`
      )
      .or('consent.eq.true,status.neq.draft')
      .eq('shops.is_deleted', false)
      .order('submitted_at', { ascending: false, nullsFirst: false })
      .limit(500);
    if (error) {
      if (isMissingTableError(error)) return NextResponse.json({ data: { items: [], migrated: false } });
      throw error;
    }

    const rows = (data ?? []) as unknown as Array<ShowcaseRow & { shops: ShopJoin }>;
    const items = await Promise.all(
      rows.map(async ({ shops: shop, ...row }) => {
        const realBookings = await countRealBookings(admin, row.shop_id);
        const lineConnected = isLineConnected(shop);
        return {
          row,
          // Never send LINE secrets to the browser; only the derived flag.
          shop: { id: shop.id, name: shop.name, shop_key: shop.shop_key, logo_url: shop.logo_url, business_type: shop.business_type },
          published: isShowcasePublished(row),
          real_bookings: realBookings,
          line_connected: lineConnected,
          eligibility: showcaseEligibility({ lineConnected, realBookings, demoMode: Boolean(shop.demo_mode_enabled) }),
        };
      })
    );
    const order = { pending: 0, approved: 1, draft: 2, rejected: 3, revoked: 4 } as const;
    items.sort((a, b) => order[a.row.status] - order[b.row.status]);

    return NextResponse.json({ data: { items, migrated: true } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

const NOTICE: Partial<Record<z.infer<typeof PatchSchema>['action'], { title: string; message: (reason: string | null) => string; priority: 'medium' | 'high' }>> = {
  approve: { title: 'ร้านของคุณขึ้นหน้าแรกแล้ว', message: () => 'ทีมงานอนุมัติให้แสดงร้านบนเว็บ GoAlong Queue แล้ว ปิดได้ทุกเมื่อในหน้าตั้งค่า', priority: 'medium' },
  reject: {
    title: 'ยังไม่อนุมัติการแสดงร้านบนเว็บ',
    message: (r) => (r ? `เหตุผล: ${r} แก้ไขแล้วส่งตรวจใหม่ได้ในหน้าตั้งค่า` : 'แก้ไขข้อมูลแล้วส่งตรวจใหม่ได้ในหน้าตั้งค่า'),
    priority: 'high',
  },
  unpublish: {
    title: 'ร้านของคุณถูกนำออกจากหน้าแรก',
    message: (r) => (r ? `เหตุผล: ${r}` : 'ติดต่อทีมงานเพื่อสอบถามรายละเอียด'),
    priority: 'high',
  },
};

/** Review decision on one shop. */
export async function PATCH(req: Request) {
  try {
    const { user } = await requireAuthContext({ roles: ['super_admin'] });
    const body = PatchSchema.parse(await req.json());
    const admin = createAdminClient();

    const { data: shop, error: shopError } = await admin
      .from('shops')
      .select('id,company_id')
      .eq('id', body.shop_id)
      .eq('is_deleted', false)
      .maybeSingle();
    if (shopError) throw shopError;
    if (!shop) return NextResponse.json({ error: 'ไม่พบร้าน' }, { status: 404 });

    const current = await loadShowcaseRow(admin, shop.id, shop.company_id);
    const next = applyAdminAction(current, body.action, { actorId: user.id, reason: body.reason ?? null });

    await saveShowcaseRow(admin, next);
    await logShowcaseEvents(admin, next, [body.action], user.id, body.reason ? { reason: body.reason } : {});
    await invalidatePublicShowcase();
    await writeAuditLog({
      companyId: shop.company_id,
      shopId: shop.id,
      userId: user.id,
      action: `showcase_${body.action}`,
      targetTable: 'shop_showcase',
      targetId: shop.id,
      payload: { reason: body.reason ?? null },
    });

    const notice = NOTICE[body.action];
    if (notice) {
      await safeCreateNotification(admin, {
        companyId: shop.company_id,
        shopId: shop.id,
        type: `showcase_${body.action}`,
        priority: notice.priority,
        title: notice.title,
        message: notice.message(next.reject_reason),
        actionUrl: '/portal/settings#showcase',
        relatedType: 'shop_showcase',
        relatedId: shop.id,
        createdBy: user.id,
      });
    }

    return NextResponse.json({ data: { row: next, published: isShowcasePublished(next) } });
  } catch (e) {
    if (e instanceof ShowcaseRuleError) return NextResponse.json({ error: e.message, code: e.code }, { status: 409 });
    if (e instanceof ShowcaseNotMigratedError) return NextResponse.json({ error: 'ยังไม่ได้รัน migration 202610270001', code: 'not_migrated' }, { status: 400 });
    if (e instanceof z.ZodError) return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
