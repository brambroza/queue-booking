import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { createAdminClient } from '@/lib/supabase/admin';

const updateSchema = z.object({
  shop_id: z.string().uuid(),
  plan_id: z.string().uuid().nullable().optional(),
  plan_code: z.string().trim().min(1).max(40).optional().nullable(),
  max_branches_override: z.coerce.number().int().min(1).optional().nullable(),
  max_services_override: z.coerce.number().int().min(1).optional().nullable(),
  max_staff_override: z.coerce.number().int().min(1).optional().nullable(),
  max_resources_override: z.coerce.number().int().min(1).optional().nullable(),
  max_monthly_bookings_override: z.coerce.number().int().min(1).optional().nullable(),
  expires_at: z.string().optional().nullable(),
  is_active: z.coerce.boolean().default(true),
  note: z.string().trim().max(500).optional().nullable(),
});

export async function GET() {
  try {
    await requireAuthContext({ roles: ['super_admin'] });
    const admin = createAdminClient();

    const [{ data: plans, error: plansError }, { data: shops, error: shopsError }, { data: subs, error: subsError }] = await Promise.all([
      admin.from('subscription_plans').select('*').eq('active', true).order('name'),
      admin.from('shops').select('id,name,shop_key,company_id,companies(name)').eq('is_deleted', false).order('created_at', { ascending: true }),
      admin
        .from('shop_subscriptions')
        .select('*, subscription_plans(name,code,max_branches,max_services,max_staff,max_resources,max_monthly_bookings)')
        .eq('is_deleted', false),
    ]);

    if (plansError) throw plansError;
    if (shopsError) throw shopsError;
    if (subsError) throw subsError;

    return NextResponse.json({ data: { plans: plans ?? [], shops: shops ?? [], subscriptions: subs ?? [] } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function PATCH(req: Request) {
  try {
    const { user } = await requireAuthContext({ roles: ['super_admin'] });
    const parsed = updateSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

    const admin = createAdminClient();
    const payload = parsed.data;

    const { data: shop, error: shopError } = await admin.from('shops').select('id,company_id').eq('id', payload.shop_id).eq('is_deleted', false).single();
    if (shopError || !shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

    const { error } = await admin.from('shop_subscriptions').upsert(
      {
        shop_id: payload.shop_id,
        company_id: shop.company_id,
        plan_id: payload.plan_id ?? null,
        plan_code: payload.plan_code ?? null,
        max_branches_override: payload.max_branches_override ?? null,
        max_services_override: payload.max_services_override ?? null,
        max_staff_override: payload.max_staff_override ?? null,
        max_resources_override: payload.max_resources_override ?? null,
        max_monthly_bookings_override: payload.max_monthly_bookings_override ?? null,
        expires_at: payload.expires_at ?? null,
        is_active: payload.is_active,
        note: payload.note ?? null,
        updated_by: user.id,
        created_by: user.id,
      },
      { onConflict: 'shop_id' },
    );

    if (error) throw error;
    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
