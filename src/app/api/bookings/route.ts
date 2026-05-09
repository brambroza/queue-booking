import { NextResponse } from 'next/server';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { bookingSchema } from '@/lib/booking/schemas';
import { createAdminClient } from '@/lib/supabase/admin';
import { pushMessage } from '@/lib/line/client';
import { bookingConfirmFlex, bookingConfirmMessage } from '@/lib/line/messages';

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

    const { count, error: countError } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', profile.shop_id)
      .eq('branch_id', payload.branch_id)
      .eq('booking_date', payload.booking_date);

    if (countError) throw countError;
    const queueNumber = `A${String((count ?? 0) + 1).padStart(3, '0')}`;
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
        queue_number: queueNumber,
        status: payload.status,
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

    let linePushSent = false;
    let linePushError: string | null = null;
    if (payload.line_user_external_id) {
      const admin = createAdminClient();
      const [{ data: shop }, { data: branch }, { data: service }] = await Promise.all([
        admin.from('shops').select('name,shop_key,line_channel_access_token').eq('id', profile.shop_id).maybeSingle(),
        admin.from('branches').select('branch_name').eq('id', payload.branch_id).maybeSingle(),
        admin.from('services').select('service_name').eq('id', payload.service_id).maybeSingle(),
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

    return NextResponse.json({ data: { ok: true, queue_number: queueNumber, line_push_sent: linePushSent, line_push_error: linePushError } });
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

    const { error } = await supabase.from('bookings').update({ status, updated_by: user.id }).eq('id', id).eq('shop_id', profile.shop_id);

    if (error) throw error;
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

    const { error } = await supabase
      .from('bookings')
      .update({ is_deleted: true, status: 'cancelled', updated_by: user.id })
      .eq('id', id)
      .eq('shop_id', profile.shop_id);

    if (error) throw error;
    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
