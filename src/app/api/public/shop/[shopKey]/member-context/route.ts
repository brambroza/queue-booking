import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveShopByKeyOrId } from '@/lib/line/shop-resolver';
import { resolveLiffCaller } from '@/lib/line/liff-identity';
import { clientIp, hitRateLimit, tooManyRequests } from '@/lib/security/rate-limit';

const schema = z.object({
  line_user_id: z.string().min(1).max(64).optional(),
  /** LIFF ID token; the verified `sub` is the caller's identity. */
  id_token: z.string().max(4096).optional(),
  display_name: z.string().max(120).nullish(),
  picture_url: z.string().max(500).nullish().transform((v) => (v && /^https:\/\//i.test(v) ? v : null)),
});

const LOAD_FAILED = 'โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่';

/**
 * LIFF member entry: registers the verified LINE user as a shop customer on
 * first visit and returns the customer record.
 */
export async function POST(req: Request, { params }: { params: Promise<{ shopKey: string }> }) {
  const { shopKey } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const admin = createAdminClient();
  if (!(await hitRateLimit(admin, 'liffProfile', clientIp(req)))) return tooManyRequests();

  const shop = await resolveShopByKeyOrId(admin, shopKey);
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  const payload = parsed.data;
  const caller = await resolveLiffCaller(admin, shop.id, payload.line_user_id, payload.id_token);
  if (!caller.ok) return NextResponse.json({ error: caller.error }, { status: caller.status });

  const { data: lineUser, error: lineUserError } = await admin
    .from('line_users')
    .upsert(
      {
        company_id: shop.company_id,
        shop_id: shop.id,
        line_user_id: caller.lineUserId,
        display_name: payload.display_name ?? null,
        picture_url: payload.picture_url || null,
      },
      { onConflict: 'shop_id,line_user_id' },
    )
    .select('id,line_user_id,display_name')
    .single();

  if (lineUserError || !lineUser) {
    console.error('[member-context] line user upsert failed', lineUserError?.message);
    return NextResponse.json({ error: LOAD_FAILED }, { status: 500 });
  }

  const { data: existingCustomers, error: customerFindError } = await admin
    .from('customers')
    .select('id,full_name,nickname,phone,line_user_id')
    .eq('shop_id', shop.id)
    .eq('line_user_id', lineUser.id)
    .eq('is_deleted', false)
    .order('updated_at', { ascending: false })
    .limit(5);

  if (customerFindError) {
    console.error('[member-context] customer lookup failed', customerFindError.message);
    return NextResponse.json({ error: LOAD_FAILED }, { status: 500 });
  }

  const existingCustomer = (existingCustomers ?? [])[0] ?? null;
  if (existingCustomer) {
    return NextResponse.json({
      data: {
        is_member: true,
        was_registered: false,
        customer: existingCustomer,
      },
    });
  }

  const { data: newCustomer, error: createCustomerError } = await admin
    .from('customers')
    .insert({
      company_id: shop.company_id,
      shop_id: shop.id,
      line_user_id: lineUser.id,
      full_name: payload.display_name ?? 'LINE Customer',
      phone: null,
    })
    .select('id,full_name,nickname,phone,line_user_id')
    .single();

  if (createCustomerError || !newCustomer) {
    console.error('[member-context] customer create failed', createCustomerError?.message);
    return NextResponse.json({ error: LOAD_FAILED }, { status: 500 });
  }

  return NextResponse.json({
    data: {
      is_member: true,
      was_registered: true,
      customer: newCustomer,
    },
  });
}
