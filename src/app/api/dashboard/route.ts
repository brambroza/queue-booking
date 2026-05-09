import { NextResponse } from 'next/server';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const { supabase, profile, user, roles } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager', 'staff'] });

    let targetShopId = profile.shop_id;
    if (!targetShopId) {
      const { data: roleContext } = await supabase
        .from('user_roles')
        .select('shop_id')
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .not('shop_id', 'is', null)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      targetShopId = roleContext?.shop_id ?? null;
    }

    if (!targetShopId && roles.includes('super_admin')) {
      const admin = createAdminClient();
      const { data: firstShop } = await admin
        .from('shops')
        .select('id')
        .eq('is_deleted', false)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      targetShopId = firstShop?.id ?? null;
    }

    if (!targetShopId) {
      return NextResponse.json(
        {
          error: 'Missing shop context for dashboard',
          debug: { profile_shop_id: profile.shop_id, roles },
        },
        { status: 400 },
      );
    }

    const end = new Date();
    const start = new Date(end);
    start.setDate(end.getDate() - 13);

    const from = start.toISOString().slice(0, 10);
    const to = end.toISOString().slice(0, 10);

    const [{ count: branchCount }, { count: serviceCount }, { count: bookingCount }, { data: bookings, error }] = await Promise.all([
      supabase.from('branches').select('*', { count: 'exact', head: true }).eq('shop_id', targetShopId).eq('is_deleted', false),
      supabase.from('services').select('*', { count: 'exact', head: true }).eq('shop_id', targetShopId).eq('is_deleted', false),
      supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('shop_id', targetShopId).eq('is_deleted', false),
      supabase
        .from('bookings')
        .select('booking_date,status')
        .eq('shop_id', targetShopId)
        .eq('is_deleted', false)
        .gte('booking_date', from)
        .lte('booking_date', to),
    ]);

    if (error) throw error;

    const byDayMap = new Map<string, number>();
    const statusMap = new Map<string, number>();
    const days: string[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      days.push(key);
      byDayMap.set(key, 0);
    }

    (bookings ?? []).forEach((b) => {
      byDayMap.set(b.booking_date, (byDayMap.get(b.booking_date) ?? 0) + 1);
      statusMap.set(b.status, (statusMap.get(b.status) ?? 0) + 1);
    });

    return NextResponse.json({
      data: {
        totals: {
          branches: branchCount ?? 0,
          services: serviceCount ?? 0,
          bookings: bookingCount ?? 0,
        },
        by_day: days.map((d) => ({ date: d, count: byDayMap.get(d) ?? 0 })),
        by_status: Array.from(statusMap.entries()).map(([status, count]) => ({ status, count })),
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
