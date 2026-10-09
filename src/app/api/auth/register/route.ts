import { NextResponse } from 'next/server';
import { registerSchema } from '@/lib/auth/schemas';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateShopKey } from '@/lib/auth/shop-key';
import { notifySignupByEmail } from '@/lib/notifications/signup-notify';
import { seedNewShop } from '@/lib/shop/seed-new-shop';
import { FREE_PLAN_CODE } from '@/lib/subscription/enforcement';
import { createUpgradeRequest } from '@/lib/subscription/upgrade-request';
import { env } from '@/lib/utils/env';
import { normalizeBusinessType } from '@/lib/line/rich-menu/business-types';
import { clientIp, hitRateLimit, tooManyRequests } from '@/lib/security/rate-limit';
import { EXISTING_EMAIL_MESSAGE, isExistingEmailSignUp } from '@/lib/auth/signup-result';

/** Generic failure for every later step: DB messages stay in the server log. */
function registerFailed(step: string, detail?: string) {
  console.error(`[register] ${step} failed`, detail);
  return NextResponse.json({ error: 'สมัครไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' }, { status: 500 });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const admin = createAdminClient();
    if (!(await hitRateLimit(admin, 'register', clientIp(req)))) return tooManyRequests();

    const { company_name, shop_name, owner_name, phone, email, password, plan_name, business_category, utm } = parsed.data;

  const { data: authData, error: authError } = await admin.auth.signUp({
    email,
    password,
    options: {
      data: { owner_name, phone },
      emailRedirectTo: `${env.appUrl}/login`,
    },
  });

  if (authError || !authData.user) {
    console.error('[register] signUp failed', authError?.message);
    // Supabase's own messages (weak password, rate limit) are safe and useful;
    // anything else becomes a generic message.
    const safe = authError?.message && /password|already|rate limit|invalid email/i.test(authError.message);
    return NextResponse.json({ error: safe ? authError!.message : 'สมัครไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' }, { status: 400 });
  }

  // A known email gets a fake user back (random id, no identities, nothing stored).
  // Stop here: creating a company and a shop for that id leaves an owner-less
  // tenant behind and then fails on users_profile's FK to auth.users.
  if (isExistingEmailSignUp(authData.user)) {
    console.warn('[register] email already registered');
    return NextResponse.json({ error: EXISTING_EMAIL_MESSAGE }, { status: 400 });
  }

  const userId = authData.user.id;

  const { data: company, error: companyError } = await admin
    .from('companies')
    .insert({ name: company_name, phone, email, owner_name, created_by: userId, updated_by: userId })
    .select('id')
    .single();

  if (companyError || !company) return registerFailed('company', companyError?.message);

  let shopKey = generateShopKey();
  for (let i = 0; i < 4; i++) {
    const { data: exists } = await admin.from('shops').select('id').eq('shop_key', shopKey).maybeSingle();
    if (!exists) break;
    shopKey = generateShopKey();
  }

  const { data: shop, error: shopError } = await admin
    .from('shops')
    .insert({
      company_id: company.id,
      name: shop_name,
      phone,
      email,
      shop_key: shopKey,
      // Drives the default rich menu template (migration 202609140001).
      business_type: normalizeBusinessType(business_category),
      created_by: userId,
      updated_by: userId,
    })
    .select('id')
    .single();

  if (shopError || !shop) return registerFailed('shop', shopError?.message);

  const { error: profileError } = await admin.from('users_profile').insert({
    id: userId,
    company_id: company.id,
    shop_id: shop.id,
    full_name: owner_name,
    phone,
    email,
    active: true,
    created_by: userId,
    updated_by: userId,
  });

  if (profileError) return registerFailed('profile', profileError.message);

  const { data: roleRow, error: roleError } = await admin.from('roles').select('id').eq('code', 'shop_owner').single();
  if (roleError || !roleRow) return registerFailed('role lookup', roleError?.message ?? 'shop_owner role missing');

  const { error: userRoleError } = await admin.from('user_roles').insert({
    user_id: userId,
    role_id: roleRow.id,
    company_id: company.id,
    shop_id: shop.id,
    created_by: userId,
    updated_by: userId,
  });

  if (userRoleError) return registerFailed('user role', userRoleError.message);

  // Everyone starts on the free-forever plan. The plan picked on the pricing
  // page is interest, not entitlement — granting it here handed away paid tiers
  // for free. It is recorded as an upgrade lead below instead.
  const { data: planRow } = await admin
    .from('subscription_plans')
    .select('id, code')
    .eq('code', FREE_PLAN_CODE)
    .maybeSingle();

  const { error: subscriptionError } = await admin.from('shop_subscriptions').upsert(
    {
      company_id: company.id,
      shop_id: shop.id,
      plan_id: planRow?.id ?? null,
      plan_code: planRow?.code ?? FREE_PLAN_CODE,
      starts_at: new Date().toISOString(),
      expires_at: null,
      is_active: true,
      created_by: userId,
      updated_by: userId,
    },
    { onConflict: 'shop_id' }
  );

  // A shop with no subscription row is a shop nobody can bill and nobody can
  // support, so this is a hard failure rather than a console warning.
  if (subscriptionError) return registerFailed('subscription', subscriptionError.message);

  // A shop with no branch, no service and no working hours cannot take a single
  // booking, which is where every previous signup stalled. Seed it now so the
  // owner's LIFF link works before they touch a settings page.
  const seeded = await seedNewShop(admin, {
    companyId: company.id,
    shopId: shop.id,
    userId,
    businessCategory: business_category || null,
  });

  // Someone who picked a paid tier on the pricing page is the warmest lead the
  // funnel produces. Capture it so sales can follow up.
  const utmNote = utm
    ? Object.entries(utm)
        .map(([k, v]) => `${k}=${v}`)
        .join(' ')
    : '';
  const requestedPlan = (plan_name ?? '').trim().toLowerCase();
  if (requestedPlan && requestedPlan !== FREE_PLAN_CODE) {
    await createUpgradeRequest(admin, {
      companyId: company.id,
      shopId: shop.id,
      requestedPlanCode: requestedPlan,
      currentPlanCode: FREE_PLAN_CODE,
      contactName: owner_name,
      phone,
      email,
      shopName: shop_name,
      source: 'register',
      createdBy: userId,
      note: utmNote ? `เลือกแพ็กเกจนี้ตอนสมัครใช้งาน • ${utmNote}` : 'เลือกแพ็กเกจนี้ตอนสมัครใช้งาน',
    });
  }

  // Best-effort notification for new signup lead.
  // Do not block successful registration when mail provider is unavailable.
  try {
    await notifySignupByEmail({
      companyName: company_name,
      shopName: shop_name,
      ownerName: owner_name,
      phone,
      email,
      shopKey,
      createdAt: new Date().toISOString(),
    });
  } catch (mailErr) {
    console.error('[register] signup notification failed:', mailErr);
  }

    return NextResponse.json({
      data: { user_id: userId, company_id: company.id, shop_id: shop.id, shop_key: shopKey, seeded },
      message: 'สมัครสำเร็จ กรุณาตรวจสอบอีเมลและยืนยันบัญชีก่อนเข้าสู่ระบบ',
    });
  } catch (e) {
    // Never echo internal errors (env names, SQL) to an anonymous caller.
    console.error('[register] unexpected error:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'สมัครไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' }, { status: 500 });
  }
}
