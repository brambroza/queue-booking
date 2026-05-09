import { NextResponse } from 'next/server';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';

function csvEscape(v: unknown): string {
  const s = String(v ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: Request) {
  try {
    const { supabase, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager'] });
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('mode') ?? 'json';
    const from = searchParams.get('from') ?? new Date().toISOString().slice(0, 10);
    const to = searchParams.get('to') ?? from;
    const branchId = searchParams.get('branch_id');
    const serviceId = searchParams.get('service_id');

    let query = supabase
      .from('bookings')
      .select('id,booking_date,status,service_id,branch_id,customers(id),services(service_name),branches(branch_name)')
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false)
      .gte('booking_date', from)
      .lte('booking_date', to);

    if (branchId) query = query.eq('branch_id', branchId);
    if (serviceId) query = query.eq('service_id', serviceId);

    const { data: bookings, error } = await query;
    if (error) throw error;

    const rows = bookings ?? [];
    const total = rows.length;
    const cancelled = rows.filter((r) => r.status === 'cancelled').length;
    const noShow = rows.filter((r) => r.status === 'no_show').length;
    const completed = rows.filter((r) => r.status === 'completed').length;

    const byDay = new Map<string, number>();
    const byService = new Map<string, number>();
    const byBranch = new Map<string, number>();
    for (const r of rows) {
      byDay.set(r.booking_date, (byDay.get(r.booking_date) ?? 0) + 1);
      byService.set((r.services as { service_name?: string } | null)?.service_name ?? '-', (byService.get((r.services as { service_name?: string } | null)?.service_name ?? '-') ?? 0) + 1);
      byBranch.set((r.branches as { branch_name?: string } | null)?.branch_name ?? '-', (byBranch.get((r.branches as { branch_name?: string } | null)?.branch_name ?? '-') ?? 0) + 1);
    }

    const repeatCustomerCount = new Map<string, number>();
    rows.forEach((r) => {
      const cid = (r.customers as { id?: string } | null)?.id;
      if (cid) repeatCustomerCount.set(cid, (repeatCustomerCount.get(cid) ?? 0) + 1);
    });
    const returning = Array.from(repeatCustomerCount.values()).filter((n) => n > 1).length;
    const unique = repeatCustomerCount.size;
    const newCustomers = Math.max(unique - returning, 0);

    if (mode === 'csv') {
      const header = ['date', 'total_bookings', 'cancelled', 'no_show', 'completed'];
      const lines = [header.join(',')];
      Array.from(byDay.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .forEach(([d, c]) => {
          lines.push([
            d,
            c,
            rows.filter((x) => x.booking_date === d && x.status === 'cancelled').length,
            rows.filter((x) => x.booking_date === d && x.status === 'no_show').length,
            rows.filter((x) => x.booking_date === d && x.status === 'completed').length,
          ].map(csvEscape).join(','));
        });
      return new NextResponse(lines.join('\n'), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename=report-${from}-to-${to}.csv`,
        },
      });
    }

    return NextResponse.json({
      data: {
        range: { from, to },
        total,
        today: rows.filter((r) => r.booking_date === new Date().toISOString().slice(0, 10)).length,
        cancelled,
        no_show: noShow,
        completed,
        cancel_rate: total ? Number(((cancelled / total) * 100).toFixed(2)) : 0,
        by_day: Array.from(byDay.entries()).map(([date, count]) => ({ date, count })),
        popular_services: Array.from(byService.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
        by_branch: Array.from(byBranch.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
        customers: { new: newCustomers, returning },
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
