import type { SupabaseClient } from '@supabase/supabase-js';
import { getSubscriptionState } from '@/lib/subscription/enforcement';

/** Plans that include F&B ordering. Starter does not; a lapsed paid plan falls back to starter. */
const FNB_PLAN_CODES: ReadonlySet<string> = new Set(['professional', 'business', 'enterprise']);

/**
 * Whether a plan code includes F&B ordering (Professional and above).
 *
 * @param planCode - Effective plan code from `getSubscriptionState`.
 */
export function planAllowsFnb(planCode: string | null | undefined): boolean {
  return Boolean(planCode && FNB_PLAN_CODES.has(planCode));
}

/**
 * Raised when a shop on a lower plan tries to use a plan-gated feature.
 * Shaped like the quota error so the portal's paywall dialog can render it.
 */
export class SubscriptionFeatureLockedError extends Error {
  readonly kind = 'feature_locked';
  readonly status = 402;

  constructor(readonly featureLabel: string, readonly planCode: string | null) {
    super(`${featureLabel}ใช้ได้ตั้งแต่แพ็กเกจ Professional ขึ้นไป`);
    this.name = 'SubscriptionFeatureLockedError';
  }

  /** Serializable payload for the paywall modal. */
  toJSON() {
    return {
      kind: this.kind,
      feature: 'fnb',
      feature_label: this.featureLabel,
      plan_code: this.planCode,
      message: this.message,
    };
  }
}

export type FnbAccess = {
  /** The shop's plan includes F&B ordering. */
  planAllowed: boolean;
  /** The owner switch, as stored (kept even when the plan lapses). */
  switchOn: boolean;
  /** What customers and staff actually see: plan allows AND switch is on. */
  enabled: boolean;
  planCode: string | null;
};

/**
 * Reads the owner switch defensively: the column ships in migration
 * 202610060001, and this runs on the customer flow, so a failing read resolves
 * to "off" instead of breaking the booking page.
 */
async function readFnbSwitch(client: SupabaseClient, shopId: string): Promise<boolean> {
  const { data, error } = await client.from('shops').select('fnb_enabled').eq('id', shopId).maybeSingle();
  if (error) return false;
  return (data as { fnb_enabled?: boolean } | null)?.fnb_enabled === true;
}

/**
 * Resolves whether F&B ordering is available for a shop.
 *
 * @param client - Client allowed to read this shop (session or service-role).
 * @param shopId - Shop to check.
 */
export async function getFnbAccess(client: SupabaseClient, shopId: string): Promise<FnbAccess> {
  const [sub, switchOn] = await Promise.all([getSubscriptionState(shopId), readFnbSwitch(client, shopId)]);
  const planAllowed = sub.active && planAllowsFnb(sub.planCode);
  return { planAllowed, switchOn, enabled: planAllowed && switchOn, planCode: sub.planCode };
}

/**
 * Guard for portal writes that only make sense on a plan with F&B.
 *
 * @throws SubscriptionFeatureLockedError when the plan is below Professional.
 */
export async function assertFnbPlan(client: SupabaseClient, shopId: string): Promise<FnbAccess> {
  const access = await getFnbAccess(client, shopId);
  if (!access.planAllowed) throw new SubscriptionFeatureLockedError('สั่งอาหารเครื่องดื่มผ่าน LINE', access.planCode);
  return access;
}
