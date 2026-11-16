import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { priceRulesPayloadSchema } from '@/lib/booking/schemas';
import { writeAuditLog } from '@/lib/audit/activity-log';
import { invalidateCache } from '@/lib/cache/kv';
import { getSubscriptionState } from '@/lib/subscription/enforcement';
import { planAllowsPricing, SubscriptionFeatureLockedError } from '@/lib/subscription/features';
import { findPriceRuleOverlap, PRICE_RULE_WEEKDAYS } from '@/lib/pricing/quote';
import { parseDiscount } from '@/lib/pricing/pricing-server';
import { subscriptionErrorResponse } from '@/lib/subscription/response';
import { isPricingEnabled } from '@/lib/booking/display-settings';

/**
 * Time-range prices + consecutive discount of one service.
 *
 * `GET` returns `{ rules, discount, plan_allowed, ready }` (staff may read).
 * `PUT` replaces the whole rule set and the discount (shop_owner /
 * branch_manager, Professional+ — 402 `feature_locked` below it). Clearing
 * everything (no rules, no discount) is always allowed, even on a lower plan.
 */

type RuleRow = {
  id: string;
  resource_id: string | null;
  branch_id: string | null;
  weekday: number | null;
  time_from: string;
  time_to: string;
  price: number;
  active: boolean;
};

const RULE_COLUMNS = 'id,resource_id,branch_id,weekday,time_from,time_to,price,active';
const NOT_READY = 'ระบบราคาตามช่วงเวลายังไม่พร้อม (รอเปิดใช้ฐานข้อมูล)';

type Supabase = Awaited<ReturnType<typeof requireAuthContext>>['supabase'];

/** `HH:MM:SS` → `HH:MM`. */
function shortTime(value: string): string {
  return value.slice(0, 5);
}

/** `HH:MM` → `HH:MM:00`. */
function fullTime(value: string): string {
  return value.length === 5 ? `${value}:00` : value;
}

async function findService(supabase: Supabase, shopId: string, serviceId: string) {
  const { data, error } = await supabase
    .from('services')
    .select('id,service_name')
    .eq('id', serviceId)
    .eq('shop_id', shopId)
    .eq('is_deleted', false)
    .maybeSingle();
  if (error) throw error;
  return data as { id: string; service_name: string } | null;
}

/** Rules + discount, or null when migration 202611160002 has not run. */
async function readState(supabase: Supabase, shopId: string, serviceId: string) {
  const [rules, discount] = await Promise.all([
    supabase
      .from('service_price_rules')
      .select(RULE_COLUMNS)
      .eq('shop_id', shopId)
      .eq('service_id', serviceId)
      .eq('is_deleted', false)
      .order('resource_id', { ascending: true, nullsFirst: true })
      .order('branch_id', { ascending: true, nullsFirst: true })
      .order('weekday', { ascending: true, nullsFirst: true })
      .order('time_from', { ascending: true }),
    supabase
      .from('services')
      .select('consecutive_discount_type,consecutive_discount_value')
      .eq('id', serviceId)
      .eq('shop_id', shopId)
      .maybeSingle(),
  ]);
  if (rules.error || discount.error) return null;
  return {
    rules: ((rules.data ?? []) as RuleRow[]).map((r) => ({ ...r, price: Number(r.price) })),
    discount: parseDiscount(discount.data as Record<string, unknown> | null),
  };
}

async function planAllowed(shopId: string): Promise<{ allowed: boolean; planCode: string | null }> {
  const sub = await getSubscriptionState(shopId);
  return { allowed: sub.active && planAllowsPricing(sub.planCode), planCode: sub.planCode };
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager', 'staff'] });
    const { id } = await ctx.params;
    if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Invalid service id' }, { status: 400 });

    const service = await findService(supabase, profile.shop_id, id);
    if (!service) return NextResponse.json({ error: 'ไม่พบบริการ' }, { status: 404 });

    const [state, plan, shopEnabled] = await Promise.all([
      readState(supabase, profile.shop_id, id),
      planAllowed(profile.shop_id),
      isPricingEnabled(supabase, profile.shop_id),
    ]);
    return NextResponse.json({
      data: {
        ready: Boolean(state),
        plan_allowed: plan.allowed,
        // Owner switch on /portal/resources (default off); off = rules are stored but not used.
        shop_enabled: shopEnabled,
        rules: state?.rules ?? [],
        discount: state?.discount ?? null,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager'] });
    const { id } = await ctx.params;
    if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Invalid service id' }, { status: 400 });

    const parsed = priceRulesPayloadSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'ข้อมูลราคาไม่ถูกต้อง' }, { status: 400 });
    const { rules } = parsed.data;
    const discount = parsed.data.discount && parsed.data.discount.value > 0 ? parsed.data.discount : null;

    const service = await findService(supabase, profile.shop_id, id);
    if (!service) return NextResponse.json({ error: 'ไม่พบบริการ' }, { status: 404 });

    // Turning pricing off is always allowed; setting it up needs Professional+.
    const plan = await planAllowed(profile.shop_id);
    if (!plan.allowed && (rules.some((r) => r.active) || discount)) {
      throw new SubscriptionFeatureLockedError('ราคาตามช่วงเวลา / ส่วนลดชั่วโมงต่อเนื่อง', plan.planCode, 'pricing');
    }

    if (!(await readState(supabase, profile.shop_id, id))) return NextResponse.json({ error: NOT_READY, code: 'not_ready' }, { status: 503 });

    const overlap = findPriceRuleOverlap(rules);
    if (overlap) {
      const [a, b] = overlap;
      const day = a.weekday === null ? 'ทุกวัน' : `วัน${PRICE_RULE_WEEKDAYS[a.weekday]}`;
      return NextResponse.json(
        {
          error: `ช่วงราคา ${shortTime(a.time_from)}-${shortTime(a.time_to)} ซ้อนกับ ${shortTime(b.time_from)}-${shortTime(b.time_to)} (${day}) กรุณาแก้ให้ไม่ซ้อนกัน`,
          code: 'rule_overlap',
        },
        { status: 400 },
      );
    }

    // Every named branch / resource must belong to this shop.
    const branchIds = Array.from(new Set(rules.map((r) => r.branch_id).filter((b): b is string => Boolean(b))));
    if (branchIds.length > 0) {
      const { data, error } = await supabase.from('branches').select('id').eq('shop_id', profile.shop_id).eq('is_deleted', false).in('id', branchIds);
      if (error) throw error;
      if ((data ?? []).length !== branchIds.length) return NextResponse.json({ error: 'สาขาไม่ถูกต้อง' }, { status: 400 });
    }
    const resourceIds = Array.from(new Set(rules.map((r) => r.resource_id).filter((b): b is string => Boolean(b))));
    if (resourceIds.length > 0) {
      const { data, error } = await supabase.from('booking_resources').select('id').eq('shop_id', profile.shop_id).eq('is_deleted', false).in('id', resourceIds);
      if (error) throw error;
      if ((data ?? []).length !== resourceIds.length) return NextResponse.json({ error: 'สนาม/ห้องไม่ถูกต้อง' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { error: delErr } = await supabase
      .from('service_price_rules')
      .update({ is_deleted: true, updated_by: user.id, updated_at: now })
      .eq('shop_id', profile.shop_id)
      .eq('service_id', id)
      .eq('is_deleted', false);
    if (delErr) throw delErr;

    if (rules.length > 0) {
      const { error: insErr } = await supabase.from('service_price_rules').insert(
        rules.map((r) => ({
          company_id: profile.company_id,
          shop_id: profile.shop_id,
          service_id: id,
          resource_id: r.resource_id,
          branch_id: r.branch_id,
          weekday: r.weekday,
          time_from: fullTime(r.time_from),
          time_to: fullTime(r.time_to),
          price: r.price,
          active: r.active,
          created_by: user.id,
          updated_by: user.id,
        })),
      );
      if (insErr) throw insErr;
    }

    const { error: discErr } = await supabase
      .from('services')
      .update({
        consecutive_discount_type: discount?.type ?? null,
        consecutive_discount_value: discount?.value ?? 0,
      })
      .eq('id', id)
      .eq('shop_id', profile.shop_id);
    if (discErr) throw discErr;

    await writeAuditLog({
      companyId: profile.company_id,
      shopId: profile.shop_id,
      userId: user.id,
      action: 'data_updated',
      targetTable: 'service_price_rules',
      targetId: id,
      payload: { service_name: service.service_name, rule_count: rules.length, discount },
    });

    // LIFF reads prices from /meta; drop the cached copy so it shows within the CDN window.
    await invalidateCache([`meta:${profile.shop_id}`]);

    const state = await readState(supabase, profile.shop_id, id);
    return NextResponse.json({ data: { ready: Boolean(state), plan_allowed: plan.allowed, rules: state?.rules ?? [], discount: state?.discount ?? null } });
  } catch (e) {
    const subscription = subscriptionErrorResponse(e);
    if (subscription) return subscription;
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
