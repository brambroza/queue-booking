import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';

const bookSchema = z.object({
  branch_id: z.string().uuid(),
  service_id: z.string().uuid(),
  booking_date: z.string(),
  start_time: z.string(),
  customer_name: z.string().min(2),
  customer_phone: z.string().min(8),
  line_user_id: z.string().optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ shopKey: string }> }) {
  const { shopKey } = await params;
  const parsed = bookSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const admin = createAdminClient();
  const { data: shop } = await admin.from('shops').select('id,company_id').eq('shop_key', shopKey).single();
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  const payload = parsed.data;

  const { count } = await admin
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('shop_id', shop.id)
    .eq('branch_id', payload.branch_id)
    .eq('booking_date', payload.booking_date);

  const queueNumber = `A${String((count ?? 0) + 1).padStart(3, '0')}`;

  let lineUserPk: string | null = null;
  if (payload.line_user_id) {
    const { data: lineUser } = await admin
      .from('line_users')
      .upsert({
        company_id: shop.company_id,
        shop_id: shop.id,
        line_user_id: payload.line_user_id,
      }, { onConflict: 'shop_id,line_user_id' })
      .select('id')
      .single();
    lineUserPk = lineUser?.id ?? null;
  }

  const { data: customer, error: customerError } = await admin
    .from('customers')
    .upsert({
      company_id: shop.company_id,
      shop_id: shop.id,
      line_user_id: lineUserPk,
      full_name: payload.customer_name,
      phone: payload.customer_phone,
    }, { onConflict: 'shop_id,phone' })
    .select('id')
    .single();

  if (customerError || !customer) return NextResponse.json({ error: customerError?.message ?? 'Customer upsert failed' }, { status: 400 });

  const { data: booking, error } = await admin.from('bookings').insert({
    company_id: shop.company_id,
    shop_id: shop.id,
    branch_id: payload.branch_id,
    service_id: payload.service_id,
    customer_id: customer.id,
    line_user_id: lineUserPk,
    booking_date: payload.booking_date,
    start_time: payload.start_time,
    queue_number: queueNumber,
    status: 'confirmed',
  }).select('id,queue_number').single();

  if (error || !booking) return NextResponse.json({ error: error?.message ?? 'Create booking failed' }, { status: 400 });

  await admin.from('booking_logs').insert({
    company_id: shop.company_id,
    shop_id: shop.id,
    booking_id: booking.id,
    action: 'create_via_liff',
    description: `Created booking ${queueNumber}`,
  });

  return NextResponse.json({ data: { booking_id: booking.id, queue_number: booking.queue_number } });
}
