import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveShopCached } from '@/lib/line/shop-resolver';
import { NICKNAME_MAX, normalizeNicknameInput } from '@/lib/booking/customer-label';
import { CUSTOMER_ACTIVE_STATUSES } from '@/lib/booking/status-flow';
import { toBangkokStamp } from '@/lib/line/booking-reminder';
import { resolveLiffCaller } from '@/lib/line/liff-identity';
import { clientIp, hitRateLimit, liffSubject, tooManyRequests } from '@/lib/security/rate-limit';

const bodySchema = z.object({
  line_user_id: z.string().min(1).max(64).optional(),
  /** LIFF ID token; the verified `sub` is the caller's identity. */
  id_token: z.string().max(4096).optional(),
  display_name: z.string().max(120).nullish(),
  picture_url: z.string().max(500).nullish().transform((v) => (v && /^https:\/\//i.test(v) ? v : null)),
  full_name: z.string().max(120).optional(),
  phone: z.string().max(30).optional(),
  /** Omitted = keep the stored nickname; '' = clear it. */
  nickname: z.string().max(NICKNAME_MAX).optional(),
  mode: z.enum(['view', 'update']).default('view'),
});

const CUSTOMER_SELECT = 'id,full_name,nickname,phone,line_user_id';

export async function POST(req: Request, { params }: { params: Promise<{ shopKey: string }> }) {
  const { shopKey } = await params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const admin = createAdminClient();
  // Keyed per LINE session, plus a loose per-IP ceiling: customers behind one
  // carrier IP (CGNAT) must not share a 60/min bucket at a booking rush.
  if (!(await hitRateLimit(admin, 'liffIp', clientIp(req)))) return tooManyRequests();
  if (!(await hitRateLimit(admin, 'liffProfile', liffSubject(req, parsed.data.id_token)))) return tooManyRequests();

  const shop = await resolveShopCached(admin, shopKey);
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  const payload = parsed.data;
  // This route returns the customer's phone and booking history, so the
  // caller must prove the LINE identity with a verified LIFF ID token.
  const caller = await resolveLiffCaller(admin, shop.id, payload.line_user_id, payload.id_token);
  if (!caller.ok) return NextResponse.json({ error: caller.error }, { status: caller.status });

  const lineUserRow = {
    company_id: shop.company_id,
    shop_id: shop.id,
    line_user_id: caller.lineUserId,
    display_name: payload.display_name ?? null,
    picture_url: payload.picture_url || null,
  };
  // A plain view reads first and only writes when the LINE profile changed:
  // the old unconditional upsert made every refresh a database write.
  let lineUser: { id: string; line_user_id: string; display_name: string | null; picture_url: string | null } | null = null;
  if (payload.mode === 'view') {
    const { data: existing } = await admin
      .from('line_users')
      .select('id,line_user_id,display_name,picture_url')
      .eq('shop_id', shop.id)
      .eq('line_user_id', caller.lineUserId)
      .maybeSingle();
    if (existing && existing.display_name === lineUserRow.display_name && existing.picture_url === lineUserRow.picture_url) {
      lineUser = existing;
    }
  }
  if (!lineUser) {
    const { data: upserted, error: lineUserError } = await admin
      .from('line_users')
      .upsert(lineUserRow, { onConflict: 'shop_id,line_user_id' })
      .select('id,line_user_id,display_name,picture_url')
      .single();
    if (lineUserError || !upserted) {
      console.error('[public/me] line user upsert failed', lineUserError?.message);
      return NextResponse.json({ error: 'โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่' }, { status: 500 });
    }
    lineUser = upserted;
  }

  let customerId: string | null = null;
  const { data: existingCustomers } = await admin
    .from('customers')
    .select(CUSTOMER_SELECT)
    .eq('shop_id', shop.id)
    .eq('line_user_id', lineUser.id)
    .eq('is_deleted', false)
    .order('updated_at', { ascending: false })
    .limit(3);

  let customer = (existingCustomers ?? [])[0] ?? null;
  // True when this call created the shop's customer record for the LINE user,
  // so the LIFF page can greet a first-time member.
  let wasRegistered = false;

  if (customer) {
    customerId = customer.id;
    const nickname = normalizeNicknameInput(payload.nickname);
    if (payload.mode === 'update' && (payload.full_name || payload.phone || nickname !== undefined)) {
      const { data: updated, error: updateError } = await admin
        .from('customers')
        .update({
          full_name: payload.full_name?.trim() || customer.full_name,
          phone: payload.phone?.trim() || customer.phone,
          // Unlike name/phone, an empty nickname is a deliberate "remove it".
          ...(nickname !== undefined ? { nickname } : {}),
        })
        .eq('id', customer.id)
        .select(CUSTOMER_SELECT)
        .single();
      // Swallowing this let a phone that collides with unique(shop_id, phone)
      // look saved while the old value stayed in the row.
      if (updateError) {
        const duplicate = updateError.code === '23505';
        return NextResponse.json(
          { error: duplicate ? 'เบอร์นี้ถูกใช้กับลูกค้ารายอื่นในร้านแล้ว' : 'บันทึกข้อมูลไม่สำเร็จ' },
          { status: 400 },
        );
      }
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
        nickname: normalizeNicknameInput(payload.nickname) ?? null,
      })
      .select(CUSTOMER_SELECT)
      .single();
    if (customerCreateError || !created) {
      console.error('[public/me] customer create failed', customerCreateError?.message);
      return NextResponse.json({ error: 'บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่' }, { status: 400 });
    }
    customer = created;
    customerId = created.id;
    wasRegistered = true;
  }

  const { data: bookings } = await admin
    .from('bookings')
    // Payment fields let the account tab surface an "upload slip" action, which
    // is the durable way back into payment after localStorage is cleared or the
    // customer switches device.
    .select('id,queue_number,booking_date,start_time,status,note,created_at,resource_id,resource_name,payment_status,payment_method,payment_amount,payment_expires_at,bank_provider,change_notified_at,change_acknowledged_at,checked_in_at,called_at,branches(branch_name),services(service_name)')
    .eq('shop_id', shop.id)
    .eq('line_user_id', lineUser.id)
    .eq('is_deleted', false)
    .order('booking_date', { ascending: false })
    .order('start_time', { ascending: false })
    .limit(50);

  // Booking dates are Bangkok-local; a UTC "today" would hide tonight's queue
  // after 07:00 UTC and let the check-in button show up a day early.
  const nowDate = toBangkokStamp(new Date()).date;
  const activeStatuses = new Set<string>(CUSTOMER_ACTIVE_STATUSES);
  const upcoming = (bookings ?? []).filter((b) => activeStatuses.has(String(b.status)) && String(b.booking_date) >= nowDate);
  const history = (bookings ?? []).filter((b) => !upcoming.find((u) => u.id === b.id));

  return NextResponse.json({
    data: {
      shop: { id: shop.id, name: shop.name, shop_key: shop.shop_key },
      line_user: lineUser,
      customer,
      customer_id: customerId,
      was_registered: wasRegistered,
      /** Bangkok date, so the LIFF check-in button and the API agree on "today". */
      today: nowDate,
      upcoming,
      history,
    },
  });
}
