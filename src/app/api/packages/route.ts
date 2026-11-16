import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { createAdminClient } from '@/lib/supabase/admin';
import { writeAuditLog } from '@/lib/audit/activity-log';
import { getSubscriptionState } from '@/lib/subscription/enforcement';
import { planAllowsPackages, SubscriptionFeatureLockedError } from '@/lib/subscription/features';
import { subscriptionErrorResponse } from '@/lib/subscription/response';
import { creditPackagePatchSchema, creditPackageSchema } from '@/lib/packages/schemas';
import { PACKAGES_NOT_READY } from '@/lib/packages/packages-server';
import { invalidateCache } from '@/lib/cache/kv';

/**
 * Prepaid hour package templates (`credit_packages`) — what the shop sells.
 *
 * GET (staff may read) → `{ data, ready, plan_allowed }`.
 * POST / PATCH / DELETE (`?id=`) → shop_owner / branch_manager; creating or
 * editing needs Professional+ (402). Writes use the service role after the
 * role + shop check, because RLS is select-only.
 */

const COLUMNS = 'id,name,description,credit_minutes,price,valid_days,service_ids,usage_windows,sell_online,active,sort_order,created_at';
const WRITE_ROLES = ['super_admin', 'shop_owner', 'branch_manager'] as const;

async function planInfo(shopId: string) {
  const sub = await getSubscriptionState(shopId);
  return { allowed: sub.active && planAllowsPackages(sub.planCode), planCode: sub.planCode };
}

async function assertPlan(shopId: string) {
  const plan = await planInfo(shopId);
  if (!plan.allowed) throw new SubscriptionFeatureLockedError('แพ็กเกจชั่วโมงแบบจ่ายล่วงหน้า', plan.planCode, 'packages');
}

/** Every service id must be this shop's. */
async function servicesBelongToShop(admin: ReturnType<typeof createAdminClient>, shopId: string, ids: string[] | null | undefined) {
  if (!ids || ids.length === 0) return true;
  const { data, error } = await admin.from('services').select('id').eq('shop_id', shopId).eq('is_deleted', false).in('id', ids);
  if (error) throw error;
  return (data ?? []).length === new Set(ids).size;
}

function errorResponse(e: unknown) {
  const subscription = subscriptionErrorResponse(e);
  if (subscription) return subscription;
  return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
}

export async function GET() {
  try {
    const { profile } = await requireAuthContext({ roles: [...WRITE_ROLES, 'staff'] });
    const admin = createAdminClient();
    const [{ data, error }, plan] = await Promise.all([
      admin.from('credit_packages').select(COLUMNS).eq('shop_id', profile.shop_id).eq('is_deleted', false).order('sort_order').order('created_at'),
      planInfo(profile.shop_id),
    ]);
    if (error) return NextResponse.json({ data: [], ready: false, plan_allowed: plan.allowed });
    return NextResponse.json({ data: data ?? [], ready: true, plan_allowed: plan.allowed });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const { user, profile } = await requireAuthContext({ roles: [...WRITE_ROLES] });
    const parsed = creditPackageSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'ข้อมูลแพ็กเกจไม่ถูกต้อง' }, { status: 400 });
    await assertPlan(profile.shop_id);
    const admin = createAdminClient();
    if (!(await servicesBelongToShop(admin, profile.shop_id, parsed.data.service_ids))) {
      return NextResponse.json({ error: 'บริการไม่ถูกต้อง' }, { status: 400 });
    }
    const { data, error } = await admin
      .from('credit_packages')
      .insert({
        ...parsed.data,
        service_ids: parsed.data.service_ids && parsed.data.service_ids.length > 0 ? parsed.data.service_ids : null,
        company_id: profile.company_id,
        shop_id: profile.shop_id,
        created_by: user.id,
        updated_by: user.id,
      })
      .select(COLUMNS)
      .single();
    if (error) {
      console.error('[packages] create failed:', error.message);
      return NextResponse.json({ error: PACKAGES_NOT_READY }, { status: 503 });
    }
    await writeAuditLog({ companyId: profile.company_id, shopId: profile.shop_id, userId: user.id, action: 'data_created', targetTable: 'credit_packages', targetId: data.id, payload: { name: parsed.data.name } });
    await invalidateCache([`meta:${profile.shop_id}`, `packages-flag:${profile.shop_id}`]);
    return NextResponse.json({ data });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(req: Request) {
  try {
    const { user, profile } = await requireAuthContext({ roles: [...WRITE_ROLES] });
    const parsed = creditPackagePatchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'ข้อมูลแพ็กเกจไม่ถูกต้อง' }, { status: 400 });
    const { id, ...patch } = parsed.data;
    // Switching a package off for sale is always allowed; anything else needs the plan.
    const onlyDeactivate = Object.keys(patch).every((k) => k === 'active' || k === 'sell_online') && patch.active !== true && patch.sell_online !== true;
    if (!onlyDeactivate) await assertPlan(profile.shop_id);
    const admin = createAdminClient();
    if (!(await servicesBelongToShop(admin, profile.shop_id, patch.service_ids))) {
      return NextResponse.json({ error: 'บริการไม่ถูกต้อง' }, { status: 400 });
    }
    const update: Record<string, unknown> = { ...patch, updated_by: user.id, updated_at: new Date().toISOString() };
    if ('service_ids' in patch) update.service_ids = patch.service_ids && patch.service_ids.length > 0 ? patch.service_ids : null;
    const { data, error } = await admin
      .from('credit_packages')
      .update(update)
      .eq('id', id)
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false)
      .select(COLUMNS)
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'ไม่พบแพ็กเกจ' }, { status: 404 });
    await writeAuditLog({ companyId: profile.company_id, shopId: profile.shop_id, userId: user.id, action: 'data_updated', targetTable: 'credit_packages', targetId: id, payload: patch });
    await invalidateCache([`meta:${profile.shop_id}`, `packages-flag:${profile.shop_id}`]);
    return NextResponse.json({ data });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(req: Request) {
  try {
    const { user, profile } = await requireAuthContext({ roles: [...WRITE_ROLES] });
    const id = new URL(req.url).searchParams.get('id');
    if (!id || !z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    // Packages already sold keep their own snapshot, so removing the template is safe.
    const { data, error } = await createAdminClient()
      .from('credit_packages')
      .update({ is_deleted: true, active: false, updated_by: user.id, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('shop_id', profile.shop_id)
      .select('id,name')
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'ไม่พบแพ็กเกจ' }, { status: 404 });
    await writeAuditLog({ companyId: profile.company_id, shopId: profile.shop_id, userId: user.id, action: 'data_deleted', targetTable: 'credit_packages', targetId: id, payload: { name: data.name } });
    await invalidateCache([`meta:${profile.shop_id}`, `packages-flag:${profile.shop_id}`]);
    return NextResponse.json({ data: true });
  } catch (e) {
    return errorResponse(e);
  }
}
