import { after, NextResponse } from 'next/server';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { createAdminClient } from '@/lib/supabase/admin';
import { writeAuditLog } from '@/lib/audit/activity-log';
import { cached } from '@/lib/cache/kv';
import { FREE_PLAN_CODE, getSubscriptionState } from '@/lib/subscription/enforcement';
import { planAllowsWinback, SubscriptionFeatureLockedError } from '@/lib/subscription/features';
import { subscriptionErrorResponse } from '@/lib/subscription/response';
import { countShopUsage } from '@/lib/subscription/usage';
import { createUpgradeRequest } from '@/lib/subscription/upgrade-request';
import { AUTOMATION_CAP_DEFAULT, bangkokMonthStartIso, effectiveAutomationCap } from '@/lib/automation/cap';
import { FOLLOWUP_DELAY_DEFAULT, FOLLOWUP_DELAY_PRESETS, normalizeReviewUrl } from '@/lib/automation/followup-window';
import { summarizeAutomationRoi, type RoiRow } from '@/lib/automation/attribution';
import { loadCustomerVisitStats } from '@/lib/automation/customer-history';
import { summarizeWinbackPreview, WINBACK_DEFAULT_DAYS } from '@/lib/automation/visit-interval';
import { getTodayISOInBangkok } from '@/lib/utils/date-format';

/** Share of the monthly booking quota at which a Starter shop becomes a sales lead. */
const QUOTA_UPSELL_RATIO = 0.8;

const SETTINGS_COLUMNS = 'followup_enabled,followup_delay_minutes,google_review_url,winback_enabled,winback_default_days,automation_monthly_cap';

type Settings = {
  followup_enabled: boolean;
  followup_delay_minutes: number;
  google_review_url: string | null;
  winback_enabled: boolean;
  winback_default_days: number;
  automation_monthly_cap: number;
};

const DEFAULT_SETTINGS: Settings = {
  followup_enabled: false,
  followup_delay_minutes: FOLLOWUP_DELAY_DEFAULT,
  google_review_url: null,
  winback_enabled: false,
  winback_default_days: WINBACK_DEFAULT_DAYS,
  automation_monthly_cap: AUTOMATION_CAP_DEFAULT,
};

const PatchSchema = z.object({
  followup_enabled: z.boolean().optional(),
  followup_delay_minutes: z
    .number()
    .int()
    .refine((v) => (FOLLOWUP_DELAY_PRESETS as readonly number[]).includes(v), { message: 'followup_delay_minutes ต้องเป็นค่าที่ระบบกำหนดไว้' })
    .optional(),
  google_review_url: z.string().max(500).nullable().optional(),
  winback_enabled: z.boolean().optional(),
  winback_default_days: z.number().int().min(7).max(365).optional(),
  automation_monthly_cap: z.number().int().min(0).max(100000).optional(),
});

/**
 * Reads the automation columns defensively: they ship in migration
 * 202610230001, and a missing column must not break the settings page.
 */
async function readSettings(client: SupabaseClient, shopId: string): Promise<{ settings: Settings; migrated: boolean }> {
  const { data, error } = await client.from('shops').select(SETTINGS_COLUMNS).eq('id', shopId).maybeSingle();
  if (error || !data) return { settings: DEFAULT_SETTINGS, migrated: false };
  const row = data as Partial<Settings>;
  return {
    migrated: true,
    settings: {
      followup_enabled: row.followup_enabled === true,
      followup_delay_minutes: Number(row.followup_delay_minutes) || FOLLOWUP_DELAY_DEFAULT,
      google_review_url: row.google_review_url ?? null,
      winback_enabled: row.winback_enabled === true,
      winback_default_days: Number(row.winback_default_days) || WINBACK_DEFAULT_DAYS,
      automation_monthly_cap: typeof row.automation_monthly_cap === 'number' ? row.automation_monthly_cap : AUTOMATION_CAP_DEFAULT,
    },
  };
}

/**
 * Starter shop near its monthly booking quota → one `upgrade_requests` lead per
 * Bangkok month, so sales calls while the owner is feeling the limit.
 * Runs after the response; never throws.
 */
async function maybeCreateQuotaLead(shopId: string, companyId: string | null, limit: number | null) {
  try {
    if (!limit || limit <= 0) return;
    const usage = await countShopUsage(shopId);
    if (usage.bookings < limit * QUOTA_UPSELL_RATIO) return;

    const admin = createAdminClient();
    const { data: existing } = await admin
      .from('upgrade_requests')
      .select('id')
      .eq('shop_id', shopId)
      .eq('source', 'quota_80')
      .gte('created_at', bangkokMonthStartIso(new Date()))
      .limit(1)
      .maybeSingle();
    if (existing) return;

    const { data: shop } = await admin.from('shops').select('name,phone,email').eq('id', shopId).maybeSingle();
    await createUpgradeRequest(admin, {
      companyId,
      shopId,
      requestedPlanCode: 'professional',
      currentPlanCode: FREE_PLAN_CODE,
      phone: shop?.phone ?? null,
      email: shop?.email ?? null,
      shopName: shop?.name ?? null,
      note: `ใช้คิวไปแล้ว ${usage.bookings}/${limit} ของเดือนนี้ (ระบบสร้างอัตโนมัติ)`,
      source: 'quota_80',
    });
  } catch (e) {
    console.warn('[automation] quota lead failed:', e instanceof Error ? e.message : e);
  }
}

/**
 * Automation settings + this month's numbers for the portal:
 * cap usage, ROI (bookings credited to pushes) and the win-back preview that
 * Starter shops see as a locked card.
 */
export async function GET() {
  try {
    const { supabase, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager'] });
    const shopId = profile.shop_id as string;
    const today = getTodayISOInBangkok();
    const monthStart = bangkokMonthStartIso(new Date());

    const [{ settings, migrated }, sub] = await Promise.all([readSettings(supabase, shopId), getSubscriptionState(shopId)]);
    const isStarter = !sub.planCode || sub.planCode === FREE_PLAN_CODE;
    const cap = effectiveAutomationCap(sub.planCode, settings.automation_monthly_cap);

    let roi = summarizeAutomationRoi([]);
    let preview = { overdue: 0, reachable: 0, estimatedBaht: 0 };
    if (migrated) {
      const { data: rows } = await supabase
        .from('automation_sends')
        .select('kind,status,converted_booking_id,revenue_estimate')
        .eq('shop_id', shopId)
        .gte('sent_at', monthStart)
        .limit(10000);
      roi = summarizeAutomationRoi((rows ?? []) as RoiRow[]);

      // History scan is the heavy part; the numbers only move once a day anyway.
      try {
        preview = await cached(`automation-preview:${shopId}:${today}:${settings.winback_default_days}`, { ttlSeconds: 600 }, async () => {
          const stats = await loadCustomerVisitStats(supabase, shopId, today);
          return summarizeWinbackPreview(today, stats, settings.winback_default_days);
        });
      } catch (e) {
        console.warn('[automation] preview failed:', e instanceof Error ? e.message : e);
      }
    }

    if (isStarter) after(() => maybeCreateQuotaLead(shopId, profile.company_id ?? null, sub.limits.max_monthly_bookings));

    return NextResponse.json({
      data: {
        migrated,
        settings,
        plan: { code: sub.planCode, winback_allowed: sub.active && planAllowsWinback(sub.planCode) },
        cap: { limit: cap, used: roi.total.sent, starter_ceiling: isStarter },
        roi,
        preview,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

/**
 * Save automation settings. Every key is optional. Turning win-back ON needs
 * Professional+ (402 paywall); turning anything OFF is always allowed.
 */
export async function PATCH(req: Request) {
  try {
    const { supabase, user, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner'] });
    const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid payload' }, { status: 400 });
    const body = parsed.data;
    const shopId = profile.shop_id as string;

    const patch: Record<string, unknown> = {};
    if (body.google_review_url !== undefined) {
      const url = normalizeReviewUrl(body.google_review_url);
      if (url === undefined) return NextResponse.json({ error: 'ลิงก์รีวิวต้องขึ้นต้นด้วย https://' }, { status: 400 });
      patch.google_review_url = url;
    }
    if (body.winback_enabled === true) {
      const sub = await getSubscriptionState(shopId);
      if (!sub.active || !planAllowsWinback(sub.planCode)) {
        throw new SubscriptionFeatureLockedError('ส่งข้อความดึงลูกค้ากลับอัตโนมัติ', sub.planCode, 'winback');
      }
    }
    for (const key of ['followup_enabled', 'followup_delay_minutes', 'winback_enabled', 'winback_default_days', 'automation_monthly_cap'] as const) {
      if (body[key] !== undefined) patch[key] = body[key];
    }
    if (Object.keys(patch).length === 0) return NextResponse.json({ data: true });

    const { error } = await supabase
      .from('shops')
      .update({ ...patch, updated_by: user.id })
      .eq('id', shopId);
    if (error) {
      console.error('[automation_settings_update_failed]', error.message);
      return NextResponse.json({ error: 'บันทึกไม่สำเร็จ — ระบบยังไม่พร้อม กรุณาแจ้งผู้ดูแลระบบ' }, { status: 400 });
    }

    await writeAuditLog({
      companyId: profile.company_id,
      shopId,
      userId: user.id,
      action: 'data_updated',
      targetTable: 'shops',
      targetId: shopId,
      payload: { automation: patch },
    });
    return NextResponse.json({ data: true });
  } catch (e) {
    const paywall = subscriptionErrorResponse(e);
    if (paywall) return paywall;
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
