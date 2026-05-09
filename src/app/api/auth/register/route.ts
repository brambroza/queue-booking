import { NextResponse } from 'next/server';
import { registerSchema } from '@/lib/auth/schemas';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateShopKey } from '@/lib/auth/shop-key';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { company_name, shop_name, owner_name, phone, email, password } = parsed.data;

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { owner_name, phone },
  });

  if (authError || !authData.user) {
    return NextResponse.json({ error: authError?.message ?? 'Auth create user failed' }, { status: 400 });
  }

  const userId = authData.user.id;

  const { data: company, error: companyError } = await admin
    .from('companies')
    .insert({ name: company_name, phone, email, owner_name, created_by: userId, updated_by: userId })
    .select('id')
    .single();

  if (companyError || !company) {
    return NextResponse.json({ error: companyError?.message ?? 'Create company failed' }, { status: 400 });
  }

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
      created_by: userId,
      updated_by: userId,
    })
    .select('id')
    .single();

  if (shopError || !shop) {
    return NextResponse.json({ error: shopError?.message ?? 'Create shop failed' }, { status: 400 });
  }

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

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  const { data: roleRow, error: roleError } = await admin.from('roles').select('id').eq('code', 'shop_owner').single();
  if (roleError || !roleRow) {
    return NextResponse.json({ error: 'Role shop_owner not found in seed data' }, { status: 500 });
  }

  const { error: userRoleError } = await admin.from('user_roles').insert({
    user_id: userId,
    role_id: roleRow.id,
    company_id: company.id,
    shop_id: shop.id,
    created_by: userId,
    updated_by: userId,
  });

  if (userRoleError) {
    return NextResponse.json({ error: userRoleError.message }, { status: 400 });
  }

    return NextResponse.json({ data: { user_id: userId, company_id: company.id, shop_id: shop.id, shop_key: shopKey } });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unexpected server error';
    const status = message.includes('SUPABASE_SERVICE_ROLE_KEY') || message.includes('NEXT_PUBLIC_SUPABASE_URL') ? 500 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
