import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { createAdminClient } from '@/lib/supabase/admin';
import { writeAuditLog } from '@/lib/audit/activity-log';
import { disableDemoMode } from '@/lib/demo/sandbox';
import { isLineConnected, loadSetupStatuses, SETUP_STEP_LABEL_TH } from '@/lib/onboarding/status';
import { sendCustomerEmail } from '@/lib/notifications/customer-email';
import { resolveShopOwnerContact } from '@/lib/notifications/shop-owner-contact';
import { ONBOARDING_EMAIL_KINDS, buildGoLiveEmail, buildSetupGuideEmail } from '@/lib/notifications/onboarding-emails';

const bodySchema = z.object({
  shop_id: z.string().uuid(),
  kind: z.enum(ONBOARDING_EMAIL_KINDS),
  /** Send anyway after the server warned (LINE already connected, or sent a moment ago). */
  force: z.boolean().optional(),
});

/** Same guide the portal links to; attached to the setup email. */
const GUIDE_FILE = path.join(process.cwd(), 'public', 'docs', 'line-setup-guide.pdf');
const GUIDE_ATTACHMENT_NAME = 'QueueBooking-LINE-OA-Setup-Guide.pdf';

/** A second send of the same email inside this window needs an explicit `force`. */
const RECENT_SEND_MINUTES = 10;

const fail = (status: number, error: string, code?: string) => NextResponse.json({ error, code }, { status });

/**
 * super_admin: sends one of the two onboarding emails to a shop's owner.
 *
 * - `setup_guide`: the "connect your LINE OA" nudge with the setup guide PDF
 *   attached. Warns (409 `line_already_connected`) when LINE is already set up.
 * - `go_live`: "your shop is ready for real customers". Requires all five setup
 *   steps (409 `setup_incomplete`) and leaves trial mode first, because the
 *   email tells the customer it has been closed. If the mail then fails, the
 *   shop stays closed and the response says so, so the operator can resend.
 *
 * Every successful send is written to the audit log; the shop list reads it
 * back to show "sent on".
 */
export async function POST(req: Request) {
  try {
    const { user } = await requireAuthContext({ roles: ['super_admin'] });
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail(400, 'Invalid payload');
    const { shop_id: shopId, kind, force } = parsed.data;

    const admin = createAdminClient();
    const { data: shop } = await admin
      .from('shops')
      .select('id,name,company_id,demo_mode_enabled,line_channel_access_token,line_channel_secret,liff_id')
      .eq('id', shopId)
      .eq('is_deleted', false)
      .maybeSingle();
    if (!shop) return fail(404, 'ไม่พบร้านค้า');

    const owner = await resolveShopOwnerContact(admin, shopId);
    if (!owner.email) return fail(400, 'ร้านนี้ยังไม่มีอีเมลเจ้าของร้านที่ใช้งานได้ กรุณาเพิ่มอีเมลก่อนส่ง', 'no_recipient');

    const lineConnected = isLineConnected(shop);

    if (!force) {
      const since = new Date(Date.now() - RECENT_SEND_MINUTES * 60_000).toISOString();
      const { data: recent } = await admin
        .from('activity_logs')
        .select('id')
        .eq('shop_id', shopId)
        .eq('action', 'onboarding_email_sent')
        .gte('created_at', since)
        .contains('payload', { kind })
        .limit(1);
      if (recent && recent.length > 0) {
        return fail(409, `เพิ่งส่งอีเมลนี้ไปเมื่อไม่ถึง ${RECENT_SEND_MINUTES} นาที ต้องการส่งซ้ำหรือไม่`, 'recently_sent');
      }
    }

    let demoClosed = false;
    let built;
    let attachments;

    if (kind === 'setup_guide') {
      if (lineConnected && !force) {
        return fail(409, 'ร้านนี้เชื่อมต่อ LINE OA แล้ว อีเมลนี้เขียนว่า "ยังไม่ได้ตั้งค่า" ต้องการส่งอยู่หรือไม่', 'line_already_connected');
      }
      let pdf: Buffer;
      try {
        pdf = await readFile(GUIDE_FILE);
      } catch (e) {
        console.error('[send-onboarding-email] guide pdf missing', e instanceof Error ? e.message : e);
        return fail(500, 'ไม่พบไฟล์คู่มือแนบ (public/docs/line-setup-guide.pdf)');
      }
      built = buildSetupGuideEmail({ ownerName: owner.name });
      attachments = [{ filename: GUIDE_ATTACHMENT_NAME, content: pdf, contentType: 'application/pdf' }];
    } else {
      const statuses = await loadSetupStatuses(admin, [{ id: shopId, lineConnected }]);
      const setup = statuses.get(shopId);
      const missing = setup ? setup.steps.filter((s) => !s.done).map((s) => SETUP_STEP_LABEL_TH[s.key]) : [];
      if (!setup || missing.length > 0) {
        return fail(409, `ตั้งค่ายังไม่ครบ 5 ขั้นตอน ยังขาด: ${missing.join(', ') || 'ไม่ทราบสถานะ'}`, 'setup_incomplete');
      }
      if (shop.demo_mode_enabled) {
        await disableDemoMode({ companyId: String(shop.company_id), shopId, userId: user.id });
        demoClosed = true;
      }
      built = buildGoLiveEmail({ ownerName: owner.name, shopName: String(shop.name) });
    }

    const result = await sendCustomerEmail({ to: owner.email, subject: built.subject, html: built.html, text: built.text, attachments });
    if (!result.ok) {
      const message = result.reason === 'not_configured' ? 'ยังไม่ได้ตั้งค่าอีเมลของระบบ (SMTP_USER / SMTP_PASS)' : 'ส่งอีเมลไม่สำเร็จ กรุณาลองใหม่';
      return NextResponse.json(
        { error: demoClosed ? `ปิดโหมดทดลองให้ร้านแล้ว แต่${message}` : message, code: result.reason, demo_closed: demoClosed },
        { status: 502 },
      );
    }

    await writeAuditLog({
      companyId: String(shop.company_id),
      shopId,
      userId: user.id,
      action: 'onboarding_email_sent',
      targetTable: 'shops',
      targetId: shopId,
      payload: { kind, to: owner.email, via: result.via, demo_closed: demoClosed },
    });

    return NextResponse.json({ data: { sent: true, to: owner.email, kind, demo_closed: demoClosed } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
