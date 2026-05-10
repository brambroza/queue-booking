import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveShopByKeyOrId } from '@/lib/line/shop-resolver';

const bodySchema = z.object({
  line_user_id: z.string().min(1),
  display_name: z.string().optional(),
  picture_url: z.string().optional(),
  full_name: z.string().optional(),
  phone: z.string().optional(),
  mode: z.enum(['view', 'update']).default('view'),
});

export async function POST(req: Request, { params }: { params: Promise<{ shopKey: string }> }) {
  const { shopKey } = await params;
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const admin = createAdminClient();
  const shop = await resolveShopByKeyOrId(admin, shopKey);
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  const payload = parsed.data;
  const { data: lineUser, error: lineUserError } = await admin
    .from('line_users')
    .upsert(
      {
        company_id: shop.company_id,
        shop_id: shop.id,
        line_user_id: payload.line_user_id,
        display_name: payload.display_name ?? null,
        picture_url: payload.picture_url ?? null,
      },
      { onConflict: 'shop_id,line_user_id' },
    )
    .select('id,line_user_id,display_name,picture_url')
    .single();
  if (lineUserError || !lineUser) return NextResponse.json({ error: lineUserError?.message ?? 'Line user upsert failed' }, { status: 400 });

  let customerId: string | null = null;
  const { data: existingCustomers } = await admin
    .from('customers')
    .select('id,full_name,phone,line_user_id')
    .eq('shop_id', shop.id)
    .eq('line_user_id', lineUser.id)
    .eq('is_deleted', false)
    .order('updated_at', { ascending: false })
    .limit(3);

  let customer = (existingCustomers ?? [])[0] ?? null;

  if (customer) {
    customerId = customer.id;
    if (payload.mode === 'update' && (payload.full_name || payload.phone)) {
      const { data: updated } = await admin
        .from('customers')
        .update({
          full_name: payload.full_name?.trim() || customer.full_name,
          phone: payload.phone?.trim() || customer.phone,
        })
        .eq('id', customer.id)
        .select('id,full_name,phone,line_user_id')
        .single();
      customer = updated ?? customer;
    }
  } else {
    const { data: created, error: customerCreateError } = await admin
      .from('customers')
      .insert({
        company_id: shop.company_id,
        shop_id: shop.id,
        line_user_id: lineUser.id,
        full_name: payload.full_name?.trim() || payload.display_name || 'LINE Customer',
        phone: payload.phone?.trim() || null,
      })
      .select('id,full_name,phone,line_user_id')
      .single();
    if (customerCreateError || !created) {
      return NextResponse.json({ error: customerCreateError?.message ?? 'Customer create failed' }, { status: 400 });
    }
    customer = created;
    customerId = created.id;
  }

  const { data: bookings } = await admin
    .from('bookings')
    .select('id,queue_number,booking_date,start_time,status,note,created_at,branches(branch_name),services(service_name)')
    .eq('shop_id', shop.id)
    .eq('line_user_id', lineUser.id)
    .eq('is_deleted', false)
    .order('booking_date', { ascending: false })
    .order('start_time', { ascending: false })
    .limit(50);

  const nowDate = new Date().toISOString().slice(0, 10);
  const activeStatuses = new Set(['pending', 'confirmed', 'waiting', 'serving']);
  const upcoming = (bookings ?? []).filter((b) => activeStatuses.has(String(b.status)) && String(b.booking_date) >= nowDate);
  const history = (bookings ?? []).filter((b) => !upcoming.find((u) => u.id === b.id));

  return NextResponse.json({
    data: {
      shop: { id: shop.id, name: shop.name, shop_key: shop.shop_key },
      line_user: lineUser,
      customer,
      customer_id: customerId,
      upcoming,
      history,
    },
  });
}
