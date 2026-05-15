import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

type Row = {
  id: string;
  queue_number: string;
  status: string;
  start_time: string;
  resource_name: string | null;
  customers: { full_name?: string | null } | null;
  services: { service_name?: string | null } | null;
};

function maskName(name?: string | null) {
  if (!name) return 'ลูกค้า';
  const trimmed = name.trim();
  if (trimmed.length <= 1) return `${trimmed}*`;
  return `${trimmed.slice(0, 1)}${'*'.repeat(Math.max(trimmed.length - 1, 1))}`;
}

export async function GET(_: Request, { params }: { params: Promise<{ shopKey: string }> }) {
  const admin = createAdminClient();
  const { shopKey } = await params;
  const date = new Date().toISOString().slice(0, 10);

  const { data: shop, error: shopError } = await admin
    .from('shops')
    .select('id,name,demo_mode_enabled,demo_business_type')
    .eq('shop_key', shopKey)
    .eq('is_deleted', false)
    .maybeSingle();
  if (shopError) return NextResponse.json({ error: shopError.message }, { status: 400 });
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  const { data, error } = await admin
    .from('bookings')
    .select('id,queue_number,status,start_time,resource_name,customers(full_name),services(service_name)')
    .eq('shop_id', shop.id)
    .eq('booking_date', date)
    .eq('is_deleted', false)
    .in('status', ['waiting', 'called', 'seating', 'serving', 'in_service'])
    .order('start_time', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const rows = (data ?? []) as Row[];
  const nowCalling = rows.find((r) => r.status === 'called' || r.status === 'serving' || r.status === 'in_service') ?? rows[0] ?? null;
  const next = rows.filter((r) => !nowCalling || r.id !== nowCalling.id).slice(0, 5);
  const waiting = rows.filter((r) => r.status === 'waiting').slice(0, 10);

  return NextResponse.json({
    data: {
      date,
      shop: {
        name: shop.name,
        demo_mode_enabled: Boolean(shop.demo_mode_enabled),
        demo_business_type: shop.demo_business_type,
      },
      now_calling: nowCalling
        ? {
            queue_number: nowCalling.queue_number,
            service_name: nowCalling.services?.service_name ?? '-',
            resource_name: nowCalling.resource_name,
            customer_name: maskName(nowCalling.customers?.full_name),
            start_time: String(nowCalling.start_time).slice(0, 5),
          }
        : null,
      next_queue: next.map((r) => ({
        queue_number: r.queue_number,
        service_name: r.services?.service_name ?? '-',
        resource_name: r.resource_name,
        customer_name: maskName(r.customers?.full_name),
        start_time: String(r.start_time).slice(0, 5),
      })),
      waiting_queue: waiting.map((r) => ({
        queue_number: r.queue_number,
        resource_name: r.resource_name,
        customer_name: maskName(r.customers?.full_name),
      })),
    },
  });
}

