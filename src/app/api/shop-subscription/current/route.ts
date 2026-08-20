import { NextResponse } from 'next/server';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSubscriptionState } from '@/lib/subscription/enforcement';

type UsageCounts = {
  branches: number;
  services: number;
  staff: number;
  resources: number;
  bookings: number;
};

/**
 * Counts what the shop is currently consuming, so the portal can show
 * "3 / 3 บริการ" instead of only telling the owner after they hit the wall.
 *
 * @param shopId - Tenant scope for every count.
 */
async function countUsage(shopId: string): Promise<UsageCounts> {
  const admin = createAdminClient();
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const countTable = async (table: string) => {
    const { count } = await admin
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', shopId)
      .eq('is_deleted', false);
    return count ?? 0;
  };

  const { count: bookingCount } = await admin
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('shop_id', shopId)
    .eq('is_deleted', false)
    .gte('booking_date', `${month}-01`)
    .lte('booking_date', `${month}-31`);

  const [branches, services, staff, resources] = await Promise.all([
    countTable('branches'),
    countTable('services'),
    countTable('staff'),
    countTable('resources'),
  ]);

  return { branches, services, staff, resources, bookings: bookingCount ?? 0 };
}

export async function GET() {
  try {
    const { profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager', 'staff'] });
    if (!profile.shop_id) return NextResponse.json({ data: null });

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('shop_subscriptions')
      .select('shop_id,plan_code,expires_at,is_active,note,max_branches_override,max_services_override,max_staff_override,max_resources_override,max_monthly_bookings_override,subscription_plans(code,name,max_branches,max_services,max_staff,max_resources,max_monthly_bookings,price_monthly,currency)')
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false)
      .maybeSingle();

    if (error) throw error;

    const [state, usage] = await Promise.all([getSubscriptionState(profile.shop_id), countUsage(profile.shop_id)]);

    const expiresAt = data?.expires_at ? new Date(String(data.expires_at)) : null;
    const daysRemaining =
      expiresAt && !Number.isNaN(expiresAt.getTime())
        ? Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null;

    return NextResponse.json({
      data: data ?? null,
      effective: {
        plan_code: state.planCode,
        limits: state.limits,
        active: state.active,
        // True when a paid plan lapsed and the shop is running on free limits.
        downgraded: state.downgraded,
        days_remaining: daysRemaining,
      },
      usage,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
