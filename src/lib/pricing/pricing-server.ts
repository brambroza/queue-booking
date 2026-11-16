import type { SupabaseClient } from '@supabase/supabase-js';
import { getSubscriptionState } from '@/lib/subscription/enforcement';
import { planAllowsPricing } from '@/lib/subscription/features';
import { isPricingEnabled } from '@/lib/booking/display-settings';
import type { ConsecutiveDiscount, PriceRule, ServicePricing } from './quote';

/**
 * Server-side loaders for the price engine. Every read is defensive: before
 * migration 202611160002 the table / columns are missing and the booking flow
 * must keep the old price instead of failing.
 */

export type LoadedServicePricing = {
  pricing: ServicePricing;
  /** Migration 202611160002 is in: `bookings.price_amount` may be written. */
  schemaReady: boolean;
};

const RULE_COLUMNS = 'id,service_id,resource_id,branch_id,weekday,time_from,time_to,price,active';

type RuleRow = PriceRule & { service_id: string };

/** Discount config of a services row, or null when off / malformed. */
export function parseDiscount(row: { consecutive_discount_type?: unknown; consecutive_discount_value?: unknown } | null | undefined): ConsecutiveDiscount | null {
  const type = row?.consecutive_discount_type;
  const value = Number(row?.consecutive_discount_value ?? 0);
  if ((type !== 'amount' && type !== 'percent') || !(value > 0)) return null;
  return { type, value };
}

function toRule(row: RuleRow): PriceRule {
  return {
    id: row.id,
    resource_id: row.resource_id ?? null,
    branch_id: row.branch_id ?? null,
    weekday: row.weekday ?? null,
    time_from: String(row.time_from),
    time_to: String(row.time_to),
    price: Number(row.price ?? 0),
    active: row.active !== false,
  };
}

/**
 * Pricing of one service.
 *
 * @param client - Client allowed to read the shop (session or service role).
 * @param opts.planCode - Effective plan; pass it when the caller already has it, else it is looked up.
 */
export async function loadServicePricing(
  client: SupabaseClient,
  opts: { shopId: string; serviceId: string; servicePrice: number; planCode?: string | null },
): Promise<LoadedServicePricing> {
  const planCode = opts.planCode !== undefined ? opts.planCode : await getSubscriptionState(opts.shopId).then((s) => (s.active ? s.planCode : null)).catch(() => null);
  const planOk = planAllowsPricing(planCode);

  const [rulesRes, discountRes, shopOn] = await Promise.all([
    client
      .from('service_price_rules')
      .select(RULE_COLUMNS)
      .eq('shop_id', opts.shopId)
      .eq('service_id', opts.serviceId)
      .eq('is_deleted', false)
      .eq('active', true),
    client
      .from('services')
      .select('consecutive_discount_type,consecutive_discount_value')
      .eq('id', opts.serviceId)
      .eq('shop_id', opts.shopId)
      .maybeSingle(),
    // Owner switch (default off); off = old price even with rules stored.
    planOk ? isPricingEnabled(client, opts.shopId) : Promise.resolve(false),
  ]);
  const enabled = planOk && shopOn;

  const schemaReady = !rulesRes.error && !discountRes.error;
  if (rulesRes.error) console.warn('[pricing] rules unavailable (migration 202611160002?):', rulesRes.error.message);

  return {
    schemaReady,
    pricing: {
      servicePrice: Number(opts.servicePrice ?? 0),
      rules: schemaReady ? ((rulesRes.data ?? []) as RuleRow[]).map(toRule) : [],
      discount: schemaReady ? parseDiscount(discountRes.data as Record<string, unknown> | null) : null,
      enabled: enabled && schemaReady,
    },
  };
}

/** Public pricing of one service for the LIFF (no ids the customer does not need besides resource/branch). */
export type PublicServicePricing = {
  rules: PriceRule[];
  discount: ConsecutiveDiscount | null;
};

/**
 * Pricing of every service of a shop for `/meta`, keyed by service id. Empty
 * when the plan does not allow it or the migration has not run — LIFF then
 * shows the plain price exactly as before.
 *
 * @param admin - Service-role client.
 * @param shopId - Shop.
 */
export async function loadShopPricingForMeta(admin: SupabaseClient, shopId: string): Promise<Record<string, PublicServicePricing>> {
  try {
    const sub = await getSubscriptionState(shopId);
    if (!sub.active || !planAllowsPricing(sub.planCode)) return {};
    if (!(await isPricingEnabled(admin, shopId))) return {};
    const [rulesRes, servicesRes] = await Promise.all([
      admin.from('service_price_rules').select(RULE_COLUMNS).eq('shop_id', shopId).eq('is_deleted', false).eq('active', true),
      admin
        .from('services')
        .select('id,consecutive_discount_type,consecutive_discount_value')
        .eq('shop_id', shopId)
        .eq('is_deleted', false),
    ]);
    if (rulesRes.error || servicesRes.error) return {};
    const out: Record<string, PublicServicePricing> = {};
    for (const row of (rulesRes.data ?? []) as RuleRow[]) {
      (out[row.service_id] ??= { rules: [], discount: null }).rules.push(toRule(row));
    }
    for (const row of (servicesRes.data ?? []) as Array<{ id: string; consecutive_discount_type?: unknown; consecutive_discount_value?: unknown }>) {
      const discount = parseDiscount(row);
      if (discount) (out[row.id] ??= { rules: [], discount: null }).discount = discount;
    }
    return out;
  } catch (error) {
    console.warn('[pricing] meta pricing failed:', error instanceof Error ? error.message : error);
    return {};
  }
}

/** Which pricing features the shop actually uses (drives portal-only UI). */
export type ShopPricingUsage = {
  /** At least one active time-range price rule. */
  rules: boolean;
  /** At least one service with a consecutive discount above 0. */
  discount: boolean;
};

/**
 * Whether the shop has time-range prices / a consecutive discount in force.
 * Used by /portal/resources to show the LIFF text switches only for features
 * that are on. Plan below Professional = nothing in force (LIFF shows nothing
 * either). Any error = false, so the portal simply hides the switches.
 *
 * @param client - Supabase client allowed to read this shop (RLS select).
 * @param shopId - Shop to check.
 */
export async function loadShopPricingUsage(client: SupabaseClient, shopId: string): Promise<ShopPricingUsage> {
  const none = { rules: false, discount: false };
  try {
    const sub = await getSubscriptionState(shopId);
    if (!sub.active || !planAllowsPricing(sub.planCode)) return none;
    if (!(await isPricingEnabled(client, shopId))) return none;
    const [rulesRes, discountRes] = await Promise.all([
      client.from('service_price_rules').select('id').eq('shop_id', shopId).eq('is_deleted', false).eq('active', true).limit(1),
      client
        .from('services')
        .select('id')
        .eq('shop_id', shopId)
        .eq('is_deleted', false)
        .not('consecutive_discount_type', 'is', null)
        .gt('consecutive_discount_value', 0)
        .limit(1),
    ]);
    return {
      rules: !rulesRes.error && (rulesRes.data ?? []).length > 0,
      discount: !discountRes.error && (discountRes.data ?? []).length > 0,
    };
  } catch {
    return none;
  }
}
