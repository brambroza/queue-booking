import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  SHOWCASE_AREA_MAX,
  SHOWCASE_QUOTE_MAX,
  ShowcaseRuleError,
  applyOwnerPatch,
  isShowcasePublished,
  shouldShowShowcasePrompt,
} from '@/lib/showcase/showcase-rules';
import {
  ShowcaseNotMigratedError,
  invalidatePublicShowcase,
  loadShowcaseRow,
  logShowcaseEvents,
  saveShowcaseRow,
} from '@/lib/showcase/showcase-server';

const PatchSchema = z
  .object({
    consent: z.boolean().optional(),
    show_logo: z.boolean().optional(),
    show_business_type: z.boolean().optional(),
    show_area: z.boolean().optional(),
    show_booking_link: z.boolean().optional(),
    area_label: z.string().max(SHOWCASE_AREA_MAX).nullable().optional(),
    quote: z.string().max(SHOWCASE_QUOTE_MAX).nullable().optional(),
    submit: z.boolean().optional(),
    /** Close the one-time portal banner; allowed without consent. */
    dismiss_prompt: z.literal(true).optional(),
  })
  .strict()
  .refine((b) => Object.values(b).some((v) => v !== undefined), { message: 'nothing to update' });

const NOT_MIGRATED = { error: 'ฟีเจอร์นี้ยังไม่พร้อมใช้งานบนระบบ กรุณาแจ้งผู้ดูแลระบบ', code: 'not_migrated' };

/** The shop's showcase settings + review state. Readable by every staff role. */
export async function GET() {
  try {
    const { profile, roles } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager', 'staff'] });
    // Service role: rows are written only server side (see migration); scoped to the caller's shop.
    const admin = createAdminClient();
    const row = await loadShowcaseRow(admin, profile.shop_id as string, profile.company_id as string);
    const { data: shopRow } = await admin
      .from('shops')
      .select('name,logo_url,business_type,demo_mode_enabled')
      .eq('id', profile.shop_id)
      .maybeSingle();
    const { demo_mode_enabled: demoMode, ...shop } = shopRow ?? { demo_mode_enabled: false };
    // The owner decides; a super_admin acting in the shop must not be nudged to consent for it.
    const prompt = shouldShowShowcasePrompt(row, {
      isOwner: roles.includes('shop_owner') && !roles.includes('super_admin'),
      demoMode: Boolean(demoMode),
    });
    return NextResponse.json({ data: { row, published: isShowcasePublished(row), shop: shopRow ? shop : null, prompt, migrated: true } });
  } catch (e) {
    if (e instanceof ShowcaseNotMigratedError) {
      return NextResponse.json({ data: { row: null, published: false, shop: null, prompt: false, migrated: false } });
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

/** Owner changes consent, display fields or quote; `submit: true` sends it for review. */
export async function PATCH(req: Request) {
  try {
    const { user, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner'] });
    const body = PatchSchema.parse(await req.json());
    const admin = createAdminClient();

    const loaded = await loadShowcaseRow(admin, profile.shop_id as string, profile.company_id as string);
    const { dismiss_prompt: dismissPrompt, ...patch } = body;
    const current = dismissPrompt && !loaded.prompt_dismissed_at ? { ...loaded, prompt_dismissed_at: new Date().toISOString() } : loaded;

    // Banner close only: no consent change, nothing to log.
    if (Object.values(patch).every((v) => v === undefined)) {
      if (current !== loaded) await saveShowcaseRow(admin, current);
      return NextResponse.json({ data: { dismissed: true } });
    }

    const wasPublished = isShowcasePublished(current);
    const { next, events } = applyOwnerPatch(current, patch);

    await saveShowcaseRow(admin, next);
    await logShowcaseEvents(admin, next, events, user.id, { source: 'portal' });

    // Revoke and display-flag changes alter the live card right away.
    if (wasPublished) await invalidatePublicShowcase();

    return NextResponse.json({ data: { row: next, published: isShowcasePublished(next) } });
  } catch (e) {
    if (e instanceof ShowcaseRuleError) return NextResponse.json({ error: e.message, code: e.code }, { status: 409 });
    if (e instanceof ShowcaseNotMigratedError) return NextResponse.json(NOT_MIGRATED, { status: 400 });
    if (e instanceof z.ZodError) return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
    console.error('[shop_showcase_update_failed]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'บันทึกไม่สำเร็จ' }, { status: getErrorStatus(e) });
  }
}
