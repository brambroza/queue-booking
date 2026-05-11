import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveShopByKeyOrId } from '@/lib/line/shop-resolver';
import { pushMessage } from '@/lib/line/client';
import { bookingConfirmFlex, bookingConfirmMessage } from '@/lib/line/messages';

function formatThaiDate(isoDate: string) {
  const d = new Date(`${isoDate}T00:00:00+07:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
}

const bookSchema = z.object({
  branch_id: z.string().uuid(),
  service_id: z.string().uuid(),
  booking_date: z.string(),
  start_time: z.string(),
  customer_name: z.string().min(2),
  customer_phone: z.string().min(8),
  line_user_id: z.string().optional(),
  party_size: z.coerce.number().int().min(1).max(200).optional(),
  resource_id: z.string().uuid().optional(),
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
    admin.from('services').select('id,service_name,duration_minutes').eq('id', payload.service_id).eq('shop_id', shop.id).eq('is_deleted', false).maybeSingle(),
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

  const partySize = payload.party_size ?? null;
  const startLabel = payload.start_time.length === 5 ? `${payload.start_time}:00` : payload.start_time;
  const startAt = new Date(`${payload.booking_date}T${startLabel}+07:00`);
  const durationMin = Math.max(Number(service.duration_minutes ?? 30), 5);
  const endAt = new Date(startAt.getTime() + durationMin * 60000);
  const endTime = `${String(endAt.getHours()).padStart(2, '0')}:${String(endAt.getMinutes()).padStart(2, '0')}:00`;

  let assignedResource: { resource_id: string; resource_name: string; capacity: number } | null = null;
  if (payload.resource_id) {
    const { data: selectedResource } = await admin
      .from('booking_resources')
      .select('id,resource_name,capacity')
      .eq('id', payload.resource_id)
      .eq('shop_id', shop.id)
      .eq('active', true)
      .eq('is_deleted', false)
      .maybeSingle();
    if (selectedResource?.id) {
      assignedResource = {
        resource_id: selectedResource.id as string,
        resource_name: String(selectedResource.resource_name ?? '-'),
        capacity: Number(selectedResource.capacity ?? 1),
      };
    }
  } else if (partySize && partySize > 0) {
    const { data: candidates } = await admin.rpc('find_available_resources', {
      p_shop_id: shop.id,
      p_branch_id: payload.branch_id,
      p_resource_type: 'table',
      p_party_size: partySize,
      p_start_time: startAt.toISOString(),
      p_end_time: endAt.toISOString(),
    });
    const top = candidates?.[0] as { resource_id?: string; resource_name?: string; capacity?: number } | undefined;
    if (top?.resource_id) {
      assignedResource = {
        resource_id: top.resource_id,
        resource_name: top.resource_name ?? '-',
        capacity: Number(top.capacity ?? 1),
      };
    }
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
    end_time: endTime,
    queue_number: queueNumber,
    status: 'confirmed',
    party_size: partySize,
    resource_id: assignedResource?.resource_id ?? null,
    resource_name: assignedResource?.resource_name ?? null,
    resource_capacity: assignedResource?.capacity ?? null,
  }).select('id,queue_number').single();

  if (error || !booking) return NextResponse.json({ error: error?.message ?? 'Create booking failed' }, { status: 400 });

  await admin.from('booking_logs').insert({
    company_id: shop.company_id,
    shop_id: shop.id,
    booking_id: booking.id,
    action: 'create_via_liff',
    description: `Created booking ${queueNumber}`,
  });

  if (assignedResource?.resource_id) {
    await admin.from('booking_resource_assignments').insert({
      company_id: shop.company_id,
      shop_id: shop.id,
      branch_id: payload.branch_id,
      booking_id: booking.id,
      resource_id: assignedResource.resource_id,
      note: payload.resource_id ? 'manual_assign' : 'auto_assign_by_party_size',
    });
  }

  let linePushSent = false;
  let linePushError: string | null = null;

  // Non-blocking LINE confirmation message to customer.
  if (payload.line_user_id) {
    const { data: shopLine } = await admin
      .from('shops')
      .select('line_channel_access_token')
      .eq('id', shop.id)
      .maybeSingle();

    const token = shopLine?.line_channel_access_token || process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
    if (token) {
      const dateLabel = formatThaiDate(payload.booking_date);
      const timeLabel = payload.start_time.slice(0, 5);
      const branchName = branch?.branch_name ?? '-';
      const serviceName = service?.service_name ?? '-';
      const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '');
      const liffUrl = appUrl ? `${appUrl}/liff/${encodeURIComponent(shop.shop_key)}` : undefined;

      try {
        await pushMessage(token, payload.line_user_id, [
          bookingConfirmFlex({
            shopName: shop.name ?? 'Queue Booking',
            queueNumber,
            branch: branchName,
            service: serviceName,
            date: dateLabel,
            time: timeLabel,
            liffUrl,
          }),
        /*   bookingConfirmMessage({
            queueNumber,
            branch: branchName,
            service: serviceName,
            date: dateLabel,
            time: timeLabel,
          }), */
        ]);
        linePushSent = true;
      } catch (e) {
        linePushError = e instanceof Error ? e.message : 'unknown error';
        await admin.from('activity_logs').insert({
          company_id: shop.company_id,
          shop_id: shop.id,
          action: 'line_push_booking_failed',
          description: linePushError,
        });
      }
    } else {
      linePushError = 'LINE channel access token is missing';
    }
  }

  return NextResponse.json({
    data: {
      booking_id: booking.id,
      queue_number: booking.queue_number,
      booking_date: payload.booking_date,
      booking_time: payload.start_time.slice(0, 5),
      branch_name: branch.branch_name,
      service_name: service.service_name,
      line_push_sent: linePushSent,
      line_push_error: linePushError,
    },
  });
}
