import { NextResponse } from 'next/server';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { bookingSchema } from '@/lib/booking/schemas';
import { createAdminClient } from '@/lib/supabase/admin';
import { pushMessage } from '@/lib/line/client';
import { bookingConfirmFlex } from '@/lib/line/messages';
import { qrPaymentFlex } from '@/lib/line/messages-payment';
import { assertFeatureQuota } from '@/lib/subscription/enforcement';
import { writeAuditLog } from '@/lib/audit/activity-log';
import { safeCreateNotification } from '@/lib/notifications/createNotification';
import { createBookingQrPayment } from '@/lib/payments/qr';

function toInt(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export async function GET(req: Request) {
  try {
    const { supabase, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager', 'staff'] });
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');
    const status = searchParams.get('status');
    const branchId = searchParams.get('branch_id');
    const serviceId = searchParams.get('service_id');
    const q = searchParams.get('q');
    const page = toInt(searchParams.get('page'), 1);
    const pageSize = Math.min(toInt(searchParams.get('page_size'), 20), 100);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('bookings')
      .select('*, branches(branch_name), services(service_name), customers(full_name,phone)', { count: 'exact' })
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false)
      .order('booking_date', { ascending: true })
      .order('start_time', { ascending: true });

    if (date) query = query.eq('booking_date', date);
    if (status) query = query.eq('status', status);
    if (branchId) query = query.eq('branch_id', branchId);
    if (serviceId) query = query.eq('service_id', serviceId);
    if (q) query = query.or(`queue_number.ilike.%${q}%,note.ilike.%${q}%`);

    const { data, error, count } = await query.range(from, to);
    if (error) throw error;
    return NextResponse.json({ data, pagination: { page, page_size: pageSize, total: count ?? 0 } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function POST(req: Request) {
  try {
    const { supabase, user, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager', 'staff'] });
    const parsed = bookingSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

    const payload = parsed.data;
    const monthStart = `${payload.booking_date.slice(0, 7)}-01`;
    const monthEnd = `${payload.booking_date.slice(0, 7)}-31`;
    const { count: monthlyCount } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false)
      .gte('booking_date', monthStart)
      .lte('booking_date', monthEnd);
    await assertFeatureQuota(profile.shop_id, 'bookings', monthlyCount ?? 0);

    const { count, error: countError } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', profile.shop_id)
      .eq('branch_id', payload.branch_id)
      .eq('booking_date', payload.booking_date);

    if (countError) throw countError;
    const queueNumber = `A${String((count ?? 0) + 1).padStart(3, '0')}`;
    const partySize = payload.party_size ?? null;
    const lineUserPk = payload.line_user_pk ?? null;

    let customerId: string | null = null;
    if (lineUserPk) {
      const { data: existingByLine } = await supabase
        .from('customers')
        .select('id')
        .eq('shop_id', profile.shop_id)
        .eq('line_user_id', lineUserPk)
        .eq('is_deleted', false)
        .order('updated_at', { ascending: false })
        .limit(1);
      customerId = existingByLine?.[0]?.id ?? null;
    }

    if (!customerId) {
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .upsert(
          {
            company_id: profile.company_id,
            shop_id: profile.shop_id,
            line_user_id: lineUserPk,
            full_name: payload.customer_name,
            phone: payload.customer_phone,
            created_by: user.id,
            updated_by: user.id,
          },
          { onConflict: 'shop_id,phone' },
        )
        .select('id')
        .single();
      if (customerError || !customer) throw customerError ?? new Error('Customer upsert failed');
      customerId = customer.id;
    } else {
      await supabase
        .from('customers')
        .update({ full_name: payload.customer_name, phone: payload.customer_phone, updated_by: user.id })
        .eq('id', customerId)
        .eq('shop_id', profile.shop_id);
    }

    const { data: service } = await supabase
      .from('services')
      .select('duration_minutes')
      .eq('id', payload.service_id)
      .eq('shop_id', profile.shop_id)
      .maybeSingle();

    const startLabel = payload.start_time.length === 5 ? `${payload.start_time}:00` : payload.start_time;
    const startAt = new Date(`${payload.booking_date}T${startLabel}+07:00`);
    const endAt = new Date(startAt.getTime() + Math.max(service?.duration_minutes ?? 30, 5) * 60000);
    const endTime = `${String(endAt.getHours()).padStart(2, '0')}:${String(endAt.getMinutes()).padStart(2, '0')}:00`;

    let assignedResource: { resource_id: string; resource_name: string; capacity: number } | null = null;
    if (payload.resource_id) {
      const { data: selectedResource } = await supabase
        .from('booking_resources')
        .select('id,resource_name,capacity')
        .eq('id', payload.resource_id)
        .eq('shop_id', profile.shop_id)
        .eq('is_deleted', false)
        .eq('active', true)
        .maybeSingle();
      if (selectedResource) {
        assignedResource = {
          resource_id: selectedResource.id as string,
          resource_name: String(selectedResource.resource_name ?? '-'),
          capacity: Number(selectedResource.capacity ?? 1),
        };
      }
    } else if (partySize && partySize > 0) {
      const { data: candidates } = await supabase.rpc('find_available_resources', {
        p_shop_id: profile.shop_id,
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

    const { data: inserted, error } = await supabase
      .from('bookings')
      .insert({
        company_id: profile.company_id,
        shop_id: profile.shop_id,
        branch_id: payload.branch_id,
        service_id: payload.service_id,
        customer_id: customerId,
        line_user_id: lineUserPk,
        booking_date: payload.booking_date,
        start_time: payload.start_time,
        end_time: endTime,
        queue_number: queueNumber,
        status: payload.status,
        party_size: partySize,
        resource_id: assignedResource?.resource_id ?? null,
        resource_name: assignedResource?.resource_name ?? null,
        resource_capacity: assignedResource?.capacity ?? null,
        note: payload.note,
        created_by: user.id,
        updated_by: user.id,
      })
      .select('id')
      .single();

    if (error || !inserted) throw error ?? new Error('Create booking failed');

    await supabase.from('booking_logs').insert({
      company_id: profile.company_id,
      shop_id: profile.shop_id,
      booking_id: inserted.id,
      action: 'create',
      description: `Created booking ${queueNumber}`,
      created_by: user.id,
      updated_by: user.id,
    });

    if (assignedResource?.resource_id) {
      await supabase.from('booking_resource_assignments').insert({
        company_id: profile.company_id,
        shop_id: profile.shop_id,
        branch_id: payload.branch_id,
        booking_id: inserted.id,
        resource_id: assignedResource.resource_id,
        assigned_by: user.id,
        note: payload.resource_id ? 'manual_assign' : 'auto_assign_by_party_size',
      });
    }

    await safeCreateNotification(supabase, {
      companyId: profile.company_id,
      shopId: profile.shop_id,
      branchId: payload.branch_id,
      userId: user.id,
      type: 'booking_created',
      category: 'bookings',
      priority: 'medium',
      title: `New booking ${queueNumber}`,
      message: `Booking created for ${payload.booking_date} ${payload.start_time.slice(0, 5)}`,
      relatedType: 'booking',
      relatedId: inserted.id,
      actionUrl: '/portal/bookings',
      icon: 'EventAvailable',
      color: '#2e7d32',
      metadata: { queue_number: queueNumber, status: payload.status },
      createdBy: user.id,
    });

    let linePushSent = false;
    let linePushError: string | null = null;
    if (payload.line_user_external_id) {
      const admin = createAdminClient();
      const [{ data: shop }, { data: branch }, { data: service }] = await Promise.all([
        admin.from('shops').select('name,shop_key,line_channel_access_token').eq('id', profile.shop_id).maybeSingle(),
        admin.from('branches').select('branch_name').eq('id', payload.branch_id).maybeSingle(),
        admin.from('services').select('service_name,price').eq('id', payload.service_id).maybeSingle(),
      ]);

      const token = shop?.line_channel_access_token || process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
      if (token) {
        const dateLabel = new Date(`${payload.booking_date}T00:00:00+07:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
        const timeLabel = payload.start_time.slice(0, 5);
        const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '');
        const liffUrl = shop?.shop_key && appUrl ? `${appUrl}/liff/${encodeURIComponent(shop.shop_key)}` : undefined;
        try {
          await pushMessage(token, payload.line_user_external_id, [
            bookingConfirmFlex({
              shopName: shop?.name ?? 'Queue Booking',
              queueNumber,
              branch: branch?.branch_name ?? '-',
              service: service?.service_name ?? '-',
              date: dateLabel,
              time: timeLabel,
              liffUrl,
            }),
           /*  bookingConfirmMessage({
              queueNumber,
              branch: branch?.branch_name ?? '-',
              service: service?.service_name ?? '-',
              date: dateLabel,
              time: timeLabel,
            }), */
          ]);
          linePushSent = true;
        } catch (e) {
          linePushError = e instanceof Error ? e.message : 'LINE push failed';
        }
      } else {
        linePushError = 'LINE token not configured';
      }
    }

    // QR Payment — non-blocking, only if shop has qr_payment_enabled
    let qrPaymentCreated = false;
    if (payload.line_user_external_id) {
      try {
        const servicePrice = Number((service as unknown as { price?: number } | null)?.price ?? 0);
        const shopName = (await createAdminClient().from('shops').select('name').eq('id', profile.shop_id).maybeSingle()).data?.name ?? 'Queue Booking';
        const qrResult = await createBookingQrPayment({
          bookingId: inserted.id,
          shopId: profile.shop_id,
          companyId: profile.company_id,
          servicePrice,
          shopName,
          queueNumber,
        });
        if (qrResult?.qrImageUrl) {
          const admin2 = createAdminClient();
          const { data: shopLine } = await admin2.from('shops').select('line_channel_access_token').eq('id', profile.shop_id).maybeSingle();
          const qrToken = shopLine?.line_channel_access_token || process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
          if (qrToken) {
            const dateLabel = new Date(`${payload.booking_date}T00:00:00+07:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
            await pushMessage(qrToken, payload.line_user_external_id, [
              qrPaymentFlex({
                shopName,
                queueNumber,
                service: (service as unknown as { service_name?: string } | null)?.service_name ?? '-',
                branch: '-',
                date: dateLabel,
                time: payload.start_time.slice(0, 5),
                amountTHB: qrResult.amountTHB,
                qrImageUrl: qrResult.qrImageUrl,
                expiresAt: qrResult.expiresAt,
                isTest: qrResult.isTest,
              }),
            ]);
            qrPaymentCreated = true;
          }
        }
      } catch {
        // Non-critical — booking already created
      }
    }

    return NextResponse.json({ data: { ok: true, queue_number: queueNumber, line_push_sent: linePushSent, line_push_error: linePushError, qr_payment_created: qrPaymentCreated } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function PATCH(req: Request) {
  try {
    const { supabase, user, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager', 'staff'] });
    const body = await req.json();
    const id = body.id as string;
    const status = body.status as string;
    if (!id || !status) return NextResponse.json({ error: 'Missing id or status' }, { status: 400 });

    const { data: before } = await supabase
      .from('bookings')
      .select('id,queue_number,status,branch_id,booking_date,start_time')
      .eq('id', id)
      .eq('shop_id', profile.shop_id)
      .maybeSingle();

    const { error } = await supabase.from('bookings').update({ status, updated_by: user.id }).eq('id', id).eq('shop_id', profile.shop_id);

    if (error) throw error;
    if (before) {
      const isCalled = status === 'called';
      const isCancelled = status === 'cancelled';
      const isRescheduled = before.status !== status && (status === 'confirmed' || status === 'waiting');
      await safeCreateNotification(supabase, {
        companyId: profile.company_id,
        shopId: profile.shop_id,
        branchId: before.branch_id,
        userId: user.id,
        type: isCalled ? 'queue_called' : isCancelled ? 'booking_cancelled' : isRescheduled ? 'booking_rescheduled' : 'booking_confirmed',
        category: 'bookings',
        priority: isCancelled ? 'high' : 'medium',
        title: `${before.queue_number ?? 'Queue'} status updated`,
        message: `Status changed to ${status}`,
        relatedType: 'booking',
        relatedId: id,
        actionUrl: '/portal/bookings',
        icon: isCancelled ? 'Cancel' : isCalled ? 'Notifications' : 'EventAvailable',
        color: isCancelled ? '#c62828' : isCalled ? '#ef6c00' : '#1565c0',
        metadata: { prev_status: before.status, next_status: status },
        createdBy: user.id,
      });
    }
    await writeAuditLog({
      companyId: profile.company_id,
      shopId: profile.shop_id,
      userId: user.id,
      action: 'data_deleted',
      targetTable: 'bookings',
      targetId: id,
      payload: { soft_delete: true, status: 'cancelled' },
    });
    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function DELETE(req: Request) {
  try {
    const { supabase, user, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager'] });
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const { data: before } = await supabase
      .from('bookings')
      .select('id,queue_number,branch_id')
      .eq('id', id)
      .eq('shop_id', profile.shop_id)
      .maybeSingle();

    const { error } = await supabase
      .from('bookings')
      .update({ is_deleted: true, status: 'cancelled', updated_by: user.id })
      .eq('id', id)
      .eq('shop_id', profile.shop_id);

    if (error) throw error;
    if (before) {
      await safeCreateNotification(supabase, {
        companyId: profile.company_id,
        shopId: profile.shop_id,
        branchId: before.branch_id,
        userId: user.id,
        type: 'booking_cancelled',
        category: 'bookings',
        priority: 'high',
        title: `${before.queue_number ?? 'Queue'} cancelled`,
        message: 'Booking was cancelled by staff',
        relatedType: 'booking',
        relatedId: before.id,
        actionUrl: '/portal/bookings',
        icon: 'Cancel',
        color: '#c62828',
        metadata: { deleted: true },
        createdBy: user.id,
      });
    }
    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
