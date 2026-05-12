import { NextResponse } from 'next/server';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const { profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager', 'staff'] });
    if (!profile.shop_id) return NextResponse.json({ data: null });

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('shop_subscriptions')
      .select('shop_id,plan_code,expires_at,is_active,note,max_branches_override,max_services_override,max_staff_override,max_resources_override,max_monthly_bookings_override,subscription_plans(code,name,max_branches,max_services,max_staff,max_resources,max_monthly_bookings)')
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false)
      .maybeSingle();

    if (error) throw error;
    return NextResponse.json({ data: data ?? null });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
