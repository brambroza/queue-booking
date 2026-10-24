import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isCronAuthorized } from '@/lib/cron/auth';
import { getSubscriptionState } from '@/lib/subscription/enforcement';
import { planAllowsWinback } from '@/lib/subscription/features';
import { bangkokMonthStartIso, effectiveAutomationCap, remainingAutomationQuota } from '@/lib/automation/cap';
import { followupSelectionRange, normalizeReviewUrl } from '@/lib/automation/followup-window';
import { decideWinback } from '@/lib/automation/visit-interval';
import { loadCustomerVisitStats } from '@/lib/automation/customer-history';
import { safeSendFollowup, safeSendWinback } from '@/lib/line/notify-automation';
import { getTodayISOInBangkok } from '@/lib/utils/date-format';

/** Vercel Hobby caps a function at 60 s; the batch cap below keeps well inside it. */
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/** Pushes per run across all shops. Follow-ups left over go 5 minutes later, win-backs tomorrow. */
const MAX_PER_TICK = 150;

type Job = 'followup' | 'winback';

type ShopRow = {
  id: string;
  followup_delay_minutes?: number | null;
  google_review_url?: string | null;
  winback_default_days?: number | null;
  automation_monthly_cap?: number | null;
};

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Pushes the shop may still send this month, after plan and owner cap.
 * Both automations share one budget because both spend the same LINE quota.
 */
async function remainingForShop(admin: Admin, shop: ShopRow, planCode: string | null, now: Date): Promise<number> {
  const cap = effectiveAutomationCap(planCode, shop.automation_monthly_cap);
  if (cap <= 0) return 0;
  const { count, error } = await admin
    .from('automation_sends')
    .select('id', { count: 'exact', head: true })
    .eq('shop_id', shop.id)
    .eq('status', 'sent')
    .gte('sent_at', bangkokMonthStartIso(now));
  // Unknown usage = do not send; over-sending spends money that is not ours.
  if (error) return 0;
  return remainingAutomationQuota(cap, count ?? 0);
}

async function runFollowups(admin: Admin, shops: ShopRow[], now: Date) {
  const tally = { sent: 0, skipped: 0, failed: 0 };
  let budget = MAX_PER_TICK;
  for (const shop of shops) {
    if (budget <= 0) break;
    const sub = await getSubscriptionState(shop.id);
    if (!sub.active) continue;
    const remaining = Math.min(budget, await remainingForShop(admin, shop, sub.planCode, now));
    if (remaining <= 0) continue;

    const range = followupSelectionRange(Number(shop.followup_delay_minutes), now);
    const { data, error } = await admin
      .from('bookings')
      .select('id')
      .eq('shop_id', shop.id)
      .eq('status', 'completed')
      .eq('is_deleted', false)
      .eq('is_demo', false)
      .is('followup_sent_at', null)
      .not('line_user_id', 'is', null)
      .gte('completed_at', range.from)
      .lte('completed_at', range.to)
      .order('completed_at', { ascending: true })
      .limit(remaining);
    if (error) {
      console.warn('[customer-automations] follow-up query failed:', shop.id, error.message);
      continue;
    }

    const reviewUrl = normalizeReviewUrl(shop.google_review_url) ?? null;
    for (const row of (data ?? []) as Array<{ id: string }>) {
      budget -= 1;
      const r = await safeSendFollowup({ shopId: shop.id, bookingId: row.id, reviewUrl }, { admin, now: () => now });
      if (r.sent) tally.sent += 1;
      else if (r.reason === 'push_failed') {
        tally.failed += 1;
        console.warn('[customer-automations] follow-up push failed:', row.id, r.error);
      } else tally.skipped += 1;
    }
  }
  return tally;
}

async function runWinbacks(admin: Admin, shops: ShopRow[], now: Date) {
  const tally = { sent: 0, skipped: 0, failed: 0 };
  const today = getTodayISOInBangkok();
  let budget = MAX_PER_TICK;
  for (const shop of shops) {
    if (budget <= 0) break;
    const sub = await getSubscriptionState(shop.id);
    // A lapsed paid plan falls back to Starter: the switch stays on but nothing is sent.
    if (!sub.active || !planAllowsWinback(sub.planCode)) continue;
    let remaining = Math.min(budget, await remainingForShop(admin, shop, sub.planCode, now));
    if (remaining <= 0) continue;

    let stats;
    try {
      stats = await loadCustomerVisitStats(admin, shop.id, today);
    } catch (e) {
      console.warn('[customer-automations] history load failed:', shop.id, e instanceof Error ? e.message : e);
      continue;
    }

    // Longest overdue first: they are the closest to being lost.
    const due = stats
      .map((c) => ({ c, d: decideWinback(today, c, Number(shop.winback_default_days)) }))
      .filter((x): x is { c: typeof x.c; d: Extract<typeof x.d, { send: true }> } => x.d.send)
      .sort((a, b) => b.d.daysSince - a.d.daysSince);

    for (const { c, d } of due) {
      if (remaining <= 0 || budget <= 0) break;
      remaining -= 1;
      budget -= 1;
      const r = await safeSendWinback(
        { shopId: shop.id, customerId: c.customerId, lineUserPk: c.lineUserPk as string, lastService: c.lastService, daysSince: d.daysSince },
        { admin, now: () => now },
      );
      if (r.sent) tally.sent += 1;
      else if (r.reason === 'push_failed') {
        tally.failed += 1;
        console.warn('[customer-automations] win-back push failed:', c.customerId, r.error);
      } else tally.skipped += 1;
    }
  }
  return tally;
}

/**
 * Customer automations, called by Supabase pg_cron (migration 202610230002):
 * `?job=followup` every 5 minutes, `?job=winback` once a day at 10:00 Bangkok.
 *
 * Every push spends the shop's LINE OA quota, so each shop is held to its
 * monthly cap (`effectiveAutomationCap`) counted from `automation_sends`.
 */
export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const job = new URL(req.url).searchParams.get('job') as Job | null;
  if (job !== 'followup' && job !== 'winback') {
    return NextResponse.json({ error: 'job must be followup or winback' }, { status: 400 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const flag = job === 'followup' ? 'followup_enabled' : 'winback_enabled';

  const { data: shopsRaw, error } = await admin
    .from('shops')
    .select('id,followup_delay_minutes,google_review_url,winback_default_days,automation_monthly_cap')
    .eq(flag, true)
    .eq('is_deleted', false);
  if (error) {
    // Most likely migration 202610230001 has not run: nothing is switched on yet.
    console.warn('[customer-automations] shops query failed:', error.message);
    return NextResponse.json({ data: { job, shops: 0, sent: 0, skipped: 0, failed: 0 } });
  }

  const shops = (shopsRaw ?? []) as ShopRow[];
  const tally = job === 'followup' ? await runFollowups(admin, shops, now) : await runWinbacks(admin, shops, now);
  return NextResponse.json({ data: { job, shops: shops.length, ...tally } });
}
