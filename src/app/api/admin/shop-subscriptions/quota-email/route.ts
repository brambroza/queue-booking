import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { createAdminClient } from '@/lib/supabase/admin';
import { writeAuditLog } from '@/lib/audit/activity-log';
import { hitRateLimit, tooManyRequests } from '@/lib/security/rate-limit';
import { getSubscriptionState } from '@/lib/subscription/enforcement';
import { countShopUsage } from '@/lib/subscription/usage';
import { thresholdCount } from '@/lib/subscription/quota-alerts';
import { getTodayISOInBangkok } from '@/lib/utils/date-format';
import { buildAdminQuotaEmail, buildOwnerQuotaEmail } from '@/lib/notifications/quota-emails';
import { resolveShopOwnerContact } from '@/lib/notifications/shop-owner-contact';
import { sendCustomerEmail } from '@/lib/notifications/customer-email';
import { resolveSalesRecipient, sendSalesEmail } from '@/lib/notifications/sales-email';

/**
 * super_admin: preview or send one booking-quota email for a shop, from the
 * package page. The numbers are set to the chosen threshold of the shop's real
 * limit so every variant can be checked; the real usage is returned beside it.
 *
 * Recipients: `me` (the admin's own login email, subject marked [ทดสอบ]),
 * `owner` (owner audience only — a real notice), `team` (team audience only,
 * SALES_NOTIFY_EMAIL).
 */

/** Limit used for the preview when the shop has no booking cap. */
const SAMPLE_LIMIT = 100;

const BodySchema = z
  .object({
    shop_id: z.string().uuid(),
    threshold: z.union([z.literal(80), z.literal(90), z.literal(100)]),
    audience: z.enum(['owner', 'team']),
    mode: z.enum(['preview', 'send']),
    recipient: z.enum(['me', 'owner', 'team']).optional(),
  })
  .refine((b) => b.mode === 'preview' || Boolean(b.recipient), { message: 'recipient required' })
  .refine((b) => !(b.recipient === 'owner' && b.audience !== 'owner'), { message: 'owner gets the owner email only' })
  .refine((b) => !(b.recipient === 'team' && b.audience !== 'team'), { message: 'team gets the team email only' });

/** Partly hide an address for the UI, e.g. "so***@gmail.com". */
function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const [name, domain] = email.split('@');
  return `${name.slice(0, 2)}***@${domain ?? ''}`;
}

export async function POST(req: Request) {
  try {
    const { user, profile } = await requireAuthContext({ roles: ['super_admin'] });
    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
    const body = parsed.data;

    const admin = createAdminClient();
    const { data: shop, error: shopError } = await admin
      .from('shops')
      .select('id,name,shop_key,phone,company_id')
      .eq('id', body.shop_id)
      .eq('is_deleted', false)
      .maybeSingle();
    if (shopError) throw shopError;
    if (!shop) return NextResponse.json({ error: 'ไม่พบร้านนี้' }, { status: 404 });

    const [state, usage, owner] = await Promise.all([
      getSubscriptionState(shop.id),
      countShopUsage(shop.id),
      resolveShopOwnerContact(admin, shop.id),
    ]);
    const realLimit = state.limits.max_monthly_bookings;
    const limit = realLimit ?? SAMPLE_LIMIT;
    const used = thresholdCount(limit, body.threshold);
    const period = getTodayISOInBangkok().slice(0, 7);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? null;
    const teamTo = resolveSalesRecipient();
    const adminEmail = user.email ?? (profile as { email?: string | null }).email ?? null;

    const common = {
      ownerName: owner.name,
      shopName: shop.name,
      shopKey: shop.shop_key,
      threshold: body.threshold,
      used,
      limit,
      period,
      planCode: state.planCode,
      appUrl,
    };
    const built = body.audience === 'owner'
      ? buildOwnerQuotaEmail(common)
      : buildAdminQuotaEmail({
          ...common,
          ownerEmail: owner.email,
          ownerPhone: shop.phone ?? null,
          ownerEmailStatus: owner.email ? 'sent' : 'no_email',
          ownerLineStatus: 'not_linked',
        });

    const meta = {
      real_usage: usage.bookings,
      real_limit: realLimit,
      plan_code: state.planCode,
      sample_numbers: { used, limit },
      recipients: {
        me: maskEmail(adminEmail),
        owner: maskEmail(owner.email),
        team: maskEmail(teamTo || null),
      },
    };

    if (body.mode === 'preview') {
      return NextResponse.json({ data: { subject: built.subject, html: built.html, ...meta } });
    }

    if (!(await hitRateLimit(admin, 'quotaEmailTest', user.id))) return tooManyRequests();

    const recipient = body.recipient!;
    const to = recipient === 'me' ? adminEmail : recipient === 'owner' ? owner.email : teamTo;
    if (!to) {
      const why = recipient === 'me' ? 'บัญชีของคุณไม่มีอีเมล' : recipient === 'owner' ? 'ร้านนี้ไม่มีอีเมลเจ้าของในระบบ' : 'ยังไม่ได้ตั้งค่า SALES_NOTIFY_EMAIL';
      return NextResponse.json({ error: why }, { status: 400 });
    }
    const subject = recipient === 'me' ? `[ทดสอบ] ${built.subject}` : built.subject;

    let ok: boolean;
    if (recipient === 'team') {
      ok = await sendSalesEmail({ subject, html: built.html });
    } else {
      const result = await sendCustomerEmail({ to, subject, html: built.html, text: built.text });
      ok = result.ok;
      if (!result.ok && result.reason === 'not_configured') {
        return NextResponse.json({ error: 'ยังไม่ได้ตั้งค่า SMTP (SMTP_USER / SMTP_PASS / SMTP_FROM_EMAIL)' }, { status: 503 });
      }
    }
    if (!ok) return NextResponse.json({ error: 'ส่งอีเมลไม่สำเร็จ ลองใหม่อีกครั้ง หรือตรวจค่า SMTP' }, { status: 502 });

    await writeAuditLog({
      companyId: shop.company_id,
      shopId: shop.id,
      userId: user.id,
      action: 'quota_email_sent_manually',
      targetTable: 'shops',
      targetId: shop.id,
      payload: { threshold: body.threshold, audience: body.audience, recipient },
    });
    return NextResponse.json({ data: { sent: true, to: maskEmail(to), subject } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
