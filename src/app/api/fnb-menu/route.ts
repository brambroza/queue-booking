import { NextResponse } from 'next/server';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { applyNullableBranchScope, assertBranchWritable } from '@/lib/auth/branch-scope';
import { fnbMenuItemSchema } from '@/lib/fnb/schemas';
import { assertFnbPlan } from '@/lib/subscription/features';
import { subscriptionErrorResponse } from '@/lib/subscription/response';
import { writeAuditLog } from '@/lib/audit/activity-log';
import { findForeignAssetUrl } from '@/lib/storage/shop-assets-server';

const WRITE_ROLES = ['super_admin', 'shop_owner', 'branch_manager'] as const;

/** Menu items of this shop, grouped order (category, sort_order, name). */
export async function GET(req: Request) {
  try {
    const { supabase, profile, branchScope } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager', 'staff'] });
    const branchId = new URL(req.url).searchParams.get('branch_id');
    let query = supabase
      .from('fnb_menu_items')
      .select('*')
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false)
      .order('category', { ascending: true })
      .order('sort_order', { ascending: true })
      .order('item_name', { ascending: true });
    query = applyNullableBranchScope(query, branchScope, branchId);
    const { data, error } = await query.limit(500);
    if (error) throw error;
    return NextResponse.json({ data: data ?? [] });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

/** Confirms the branch (if any) is a live branch of this shop. */
async function branchBelongsToShop(
  supabase: Awaited<ReturnType<typeof requireAuthContext>>['supabase'],
  shopId: string,
  branchId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('branches')
    .select('id')
    .eq('id', branchId)
    .eq('shop_id', shopId)
    .eq('is_deleted', false)
    .maybeSingle();
  return Boolean(data);
}

export async function POST(req: Request) {
  try {
    const { supabase, user, profile, branchScope } = await requireAuthContext({ roles: [...WRITE_ROLES] });
    const shopId = profile.shop_id as string;
    await assertFnbPlan(supabase, shopId);

    const parsed = fnbMenuItemSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid payload' }, { status: 400 });
    }
    const d = parsed.data;
    if (d.image_url && findForeignAssetUrl([d.image_url], shopId)) {
      return NextResponse.json({ error: 'รูปภาพไม่ถูกต้อง กรุณาอัปโหลดใหม่' }, { status: 400 });
    }
    const branchId = d.branch_id ?? null;
    assertBranchWritable(branchScope, branchId);
    if (branchId && !(await branchBelongsToShop(supabase, shopId, branchId))) {
      return NextResponse.json({ error: 'branch_id ไม่ถูกต้องหรือไม่อยู่ในร้านนี้' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('fnb_menu_items')
      .insert({
        company_id: profile.company_id,
        shop_id: shopId,
        branch_id: branchId,
        category: d.category,
        item_name: d.item_name,
        description: d.description ?? null,
        price: d.price,
        image_url: d.image_url ?? null,
        is_available: d.is_available,
        active: d.active,
        sort_order: d.sort_order,
        created_by: user.id,
        updated_by: user.id,
      })
      .select('id')
      .single();
    if (error) throw error;
    await writeAuditLog({
      companyId: profile.company_id,
      shopId,
      userId: user.id,
      action: 'data_created',
      targetTable: 'fnb_menu_items',
      targetId: data.id as string,
      payload: { item_name: d.item_name, price: d.price },
    });
    return NextResponse.json({ data: { id: data.id } });
  } catch (e) {
    const paywall = subscriptionErrorResponse(e);
    if (paywall) return paywall;
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function PATCH(req: Request) {
  try {
    const { supabase, user, profile, branchScope } = await requireAuthContext({ roles: [...WRITE_ROLES] });
    const shopId = profile.shop_id as string;
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const id = typeof body?.id === 'string' ? body.id : '';
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    // Flipping "sold out" is a day-to-day action and stays allowed on a lapsed plan.
    const soldOutOnly = Object.keys(body ?? {}).every((k) => k === 'id' || k === 'is_available');
    if (!soldOutOnly) await assertFnbPlan(supabase, shopId);

    const { data: current } = await supabase
      .from('fnb_menu_items')
      .select('branch_id')
      .eq('id', id)
      .eq('shop_id', shopId)
      .eq('is_deleted', false)
      .maybeSingle();
    if (!current) return NextResponse.json({ error: 'Menu item not found' }, { status: 404 });
    assertBranchWritable(branchScope, current.branch_id as string | null);

    if (soldOutOnly) {
      if (typeof body?.is_available !== 'boolean') return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
      const { error } = await supabase
        .from('fnb_menu_items')
        .update({ is_available: body.is_available, updated_by: user.id })
        .eq('id', id)
        .eq('shop_id', shopId);
      if (error) throw error;
      return NextResponse.json({ data: true });
    }

    const parsed = fnbMenuItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid payload' }, { status: 400 });
    }
    const d = parsed.data;
    if (d.image_url && findForeignAssetUrl([d.image_url], shopId)) {
      return NextResponse.json({ error: 'รูปภาพไม่ถูกต้อง กรุณาอัปโหลดใหม่' }, { status: 400 });
    }
    const branchId = d.branch_id ?? null;
    assertBranchWritable(branchScope, branchId);
    if (branchId && !(await branchBelongsToShop(supabase, shopId, branchId))) {
      return NextResponse.json({ error: 'branch_id ไม่ถูกต้องหรือไม่อยู่ในร้านนี้' }, { status: 400 });
    }

    const { error } = await supabase
      .from('fnb_menu_items')
      .update({
        branch_id: branchId,
        category: d.category,
        item_name: d.item_name,
        description: d.description ?? null,
        price: d.price,
        image_url: d.image_url ?? null,
        is_available: d.is_available,
        active: d.active,
        sort_order: d.sort_order,
        updated_by: user.id,
      })
      .eq('id', id)
      .eq('shop_id', shopId);
    if (error) throw error;
    await writeAuditLog({
      companyId: profile.company_id,
      shopId,
      userId: user.id,
      action: 'data_updated',
      targetTable: 'fnb_menu_items',
      targetId: id,
      payload: { item_name: d.item_name, price: d.price },
    });
    return NextResponse.json({ data: true });
  } catch (e) {
    const paywall = subscriptionErrorResponse(e);
    if (paywall) return paywall;
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

/** Soft delete. Past orders keep their own name/price snapshot. */
export async function DELETE(req: Request) {
  try {
    const { supabase, user, profile, branchScope } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager'] });
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const { data: current } = await supabase
      .from('fnb_menu_items')
      .select('branch_id')
      .eq('id', id)
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false)
      .maybeSingle();
    if (!current) return NextResponse.json({ error: 'Menu item not found' }, { status: 404 });
    assertBranchWritable(branchScope, current.branch_id as string | null);

    const { error } = await supabase
      .from('fnb_menu_items')
      .update({ is_deleted: true, active: false, updated_by: user.id })
      .eq('id', id)
      .eq('shop_id', profile.shop_id);
    if (error) throw error;
    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
