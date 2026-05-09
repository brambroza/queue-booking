import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveShopByKeyOrId } from '@/lib/line/shop-resolver';
import { pushMessage } from '@/lib/line/client';
import { bookingConfirmFlex, bookingConfirmMessage } from '@/lib/line/messages';

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
  const shop = await resolveShopByKeyOrId(admin, shopKey);
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  const payload = parsed.data;

  const [{ data: branch }, { data: service }] = await Promise.all([
    admin.from('branches').select('id,branch_name').eq('id', payload.branch_id).eq('shop_id', shop.id).eq('is_deleted', false).maybeSingle(),
    admin.from('services').select('id,service_name').eq('id', payload.service_id).eq('shop_id', shop.id).eq('is_deleted', false).maybeSingle(),
  ]);
  if (!branch || !service) {
    return NextResponse.json({ error: 'Invalid branch or service for this shop' }, { status: 400 });
  }

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

  let customerId: string | null = null;
  if (lineUserPk) {
    const { data: byLineUser } = await admin
      .from('customers')
      .select('id')
      .eq('shop_id', shop.id)
      .eq('line_user_id', lineUserPk)
      .eq('is_deleted', false)
      .order('updated_at', { ascending: false })
      .limit(1);
    customerId = byLineUser?.[0]?.id ?? null;
  }

  if (customerId) {
    await admin
      .from('customers')
      .update({
        full_name: payload.customer_name,
        phone: payload.customer_phone,
        updated_at: new Date().toISOString(),
      })
      .eq('id', customerId)
      .eq('shop_id', shop.id);
  } else {
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
    customerId = customer.id;
  }

  const { data: booking, error } = await admin.from('bookings').insert({
    company_id: shop.company_id,
    shop_id: shop.id,
    branch_id: payload.branch_id,
    service_id: payload.service_id,
    customer_id: customerId,
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

  // Non-blocking LINE confirmation message to customer.
  if (payload.line_user_id) {
    const { data: shopLine } = await admin
      .from('shops')
      .select('line_channel_access_token')
      .eq('id', shop.id)
      .maybeSingle();

    const token = shopLine?.line_channel_access_token || process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
    if (token) {
      const dateLabel = payload.booking_date;
      const timeLabel = payload.start_time.slice(0, 5);
      const branchName = branch?.branch_name ?? '-';
      const serviceName = service?.service_name ?? '-';

      try {
        await pushMessage(token, payload.line_user_id, [
          bookingConfirmFlex({
            shopName: shop.name ?? 'Queue Booking',
            queueNumber,
            branch: branchName,
            service: serviceName,
            date: dateLabel,
            time: timeLabel,
          }),
          bookingConfirmMessage({
            queueNumber,
            branch: branchName,
            service: serviceName,
            date: dateLabel,
            time: timeLabel,
          }),
        ]);
      } catch (e) {
        await admin.from('activity_logs').insert({
          company_id: shop.company_id,
          shop_id: shop.id,
          action: 'line_push_booking_failed',
          description: e instanceof Error ? e.message : 'unknown error',
        });
      }
    }
  }

  return NextResponse.json({ data: { booking_id: booking.id, queue_number: booking.queue_number } });
}
