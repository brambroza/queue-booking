import { NextResponse } from 'next/server';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';

type QueueRow = {
  id: string;
  queue_number: string;
  booking_date: string;
  start_time: string;
  status: string;
  customer_id: string | null;
  line_user_id: string | null;
  customers: { full_name?: string | null; phone?: string | null } | null;
  line_users: { display_name?: string | null; picture_url?: string | null } | null;
  resource_name?: string | null;
  services?: { service_name?: string | null } | null;
};

export async function GET(req: Request) {
  try {
    const { supabase, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager', 'staff'] });
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get('branch_id');
    const date = searchParams.get('date') ?? new Date().toISOString().slice(0, 10);

    const [{ data: branches, error: branchesError }, { data: shopMeta, error: shopError }] = await Promise.all([
      supabase
      .from('branches')
      .select('id,branch_name,active')
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false)
      .order('branch_name', { ascending: true }),
      supabase.from('shops').select('demo_mode_enabled,demo_business_type,name').eq('id', profile.shop_id).maybeSingle(),
    ]);
    if (branchesError) throw branchesError;
    if (shopError) throw shopError;

    let query = supabase
      .from('bookings')
      .select('id,queue_number,booking_date,start_time,status,customer_id,line_user_id,resource_name,customers(full_name,phone),line_users(display_name,picture_url),services(service_name)')
      .eq('shop_id', profile.shop_id)
      .eq('booking_date', date)
      .eq('is_deleted', false)
      .order('start_time', { ascending: true });

    if (branchId) query = query.eq('branch_id', branchId);

    const { data, error } = await query;
    if (error) throw error;
    const rows = (data ?? []) as QueueRow[];

    const activeStatuses = new Set(['pending', 'confirmed', 'waiting', 'called', 'seating', 'serving', 'in_service']);
    const remaining = rows.filter((r) => activeStatuses.has(r.status));
    const serving = remaining.find((r) => r.status === 'serving') ?? null;
    const waitingQueue = remaining.filter((r) => r.status !== 'serving');
    const current = serving ?? waitingQueue[0] ?? null;
    const nextTwo = current
      ? waitingQueue.filter((r) => r.id !== current.id).slice(0, 2)
      : waitingQueue.slice(0, 2);

    function mapPerson(r: QueueRow | null) {
      if (!r) return null;
      return {
        booking_id: r.id,
        queue_number: r.queue_number,
        status: r.status,
        start_time: String(r.start_time).slice(0, 5),
        display_name: r.line_users?.display_name ?? r.customers?.full_name ?? 'ลูกค้า',
        avatar_url: r.line_users?.picture_url ?? null,
        service_name: r.services?.service_name ?? null,
        resource_name: r.resource_name ?? null,
      };
    }

    return NextResponse.json({
      data: {
        date,
        branches: branches ?? [],
        totals: {
          all_today: rows.length,
          remaining_today: remaining.length,
        },
        shop: {
          demo_mode_enabled: Boolean((shopMeta as { demo_mode_enabled?: boolean } | null)?.demo_mode_enabled),
          demo_business_type: (shopMeta as { demo_business_type?: string | null } | null)?.demo_business_type ?? null,
          name: (shopMeta as { name?: string | null } | null)?.name ?? null,
        },
        now_serving: mapPerson(current),
        next_two: nextTwo.map((x) => mapPerson(x)),
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
