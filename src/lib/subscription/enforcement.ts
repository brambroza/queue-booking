import { createAdminClient } from '@/lib/supabase/admin';

type FeatureKey = 'branches' | 'services' | 'staff' | 'resources' | 'bookings';

type Limits = {
  max_branches: number | null;
  max_services: number | null;
  max_staff: number | null;
  max_resources: number | null;
  max_monthly_bookings: number | null;
};

function toNullableInt(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function getShopSubscriptionLimits(shopId: string): Promise<{ active: boolean; expired: boolean; planCode: string | null; limits: Limits }> {
  const admin = createAdminClient();

  const { data: sub } = await admin
    .from('shop_subscriptions')
    .select('*, subscription_plans(max_branches,max_services,max_staff,max_resources,max_monthly_bookings,code)')
    .eq('shop_id', shopId)
    .eq('is_deleted', false)
    .maybeSingle();

  if (!sub) {
    return {
      active: true,
      expired: false,
      planCode: null,
      limits: {
        max_branches: null,
        max_services: null,
        max_staff: null,
        max_resources: null,
        max_monthly_bookings: null,
      },
    };
  }

  const plan = (sub.subscription_plans as {
    max_branches?: number | null;
    max_services?: number | null;
    max_staff?: number | null;
    max_resources?: number | null;
    max_monthly_bookings?: number | null;
    code?: string | null;
  } | null) ?? null;

  const expiresAt = sub.expires_at ? new Date(String(sub.expires_at)) : null;
  const expired = Boolean(expiresAt && !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() < Date.now());

  return {
    active: Boolean(sub.is_active),
    expired,
    planCode: (sub.plan_code as string | null) ?? (plan?.code ?? null),
    limits: {
      max_branches: toNullableInt(sub.max_branches_override) ?? toNullableInt(plan?.max_branches),
      max_services: toNullableInt(sub.max_services_override) ?? toNullableInt(plan?.max_services),
      max_staff: toNullableInt(sub.max_staff_override) ?? toNullableInt(plan?.max_staff),
      max_resources: toNullableInt(sub.max_resources_override) ?? toNullableInt(plan?.max_resources),
      max_monthly_bookings: toNullableInt(sub.max_monthly_bookings_override) ?? toNullableInt(plan?.max_monthly_bookings),
    },
  };
}

function getLimitForFeature(limits: Limits, feature: FeatureKey): number | null {
  if (feature === 'branches') return limits.max_branches;
  if (feature === 'services') return limits.max_services;
  if (feature === 'staff') return limits.max_staff;
  if (feature === 'resources') return limits.max_resources;
  return limits.max_monthly_bookings;
}

export async function assertShopSubscriptionActive(shopId: string) {
  const sub = await getShopSubscriptionLimits(shopId);
  if (!sub.active) {
    throw new Error('แพ็กเกจร้านถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ');
  }
  if (sub.expired) {
    throw new Error('แพ็กเกจร้านหมดอายุแล้ว กรุณาต่ออายุแพ็กเกจ');
  }
  return sub;
}

export async function assertFeatureQuota(shopId: string, feature: FeatureKey, currentCount: number) {
  const sub = await assertShopSubscriptionActive(shopId);
  const limit = getLimitForFeature(sub.limits, feature);
  if (limit === null) return sub;
  if (currentCount >= limit) {
    const planLabel = sub.planCode ? ` (${sub.planCode})` : '';
    throw new Error(`เกินสิทธิ์แพ็กเกจ${planLabel}: ${feature} สูงสุด ${limit}`);
  }
  return sub;
}
