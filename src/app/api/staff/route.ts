import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { assertFeatureQuota } from '@/lib/subscription/enforcement';
import { writeAuditLog } from '@/lib/audit/activity-log';

const staffSchema = z.object({
  user_id: z.string().uuid(),
  display_name: z.string().min(2),
  active: z.boolean().default(true),
  branch_ids: z.array(z.string().uuid()).default([]),
});

function toInt(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export async function GET(req: Request) {
  try {
    const { supabase, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager', 'staff'] });
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q');
    const page = toInt(searchParams.get('page'), 1);
    const pageSize = Math.min(toInt(searchParams.get('page_size'), 20), 100);

    let query = supabase
      .from('staff')
      .select('id,user_id,display_name,active,created_at', { count: 'exact' })
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (q) query = query.ilike('display_name', `%${q}%`);

    const from = (page - 1) * pageSize;
    const { data: staffs, error, count } = await query.range(from, from + pageSize - 1);
    if (error) throw error;

    const staffIds = (staffs ?? []).map((s) => s.id);

    const [branchMapRes, usersRes, branchesRes] = await Promise.all([
      staffIds.length
        ? supabase
            .from('staff_branches')
            .select('staff_id,branch_id,branches(id,branch_name)')
            .eq('shop_id', profile.shop_id)
            .eq('is_deleted', false)
            .in('staff_id', staffIds)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from('users_profile')
        .select('id,full_name,email,phone')
        .eq('shop_id', profile.shop_id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false }),
      supabase
        .from('branches')
        .select('id,branch_name')
        .eq('shop_id', profile.shop_id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false }),
    ]);

    if (branchMapRes.error) throw branchMapRes.error;
    if (usersRes.error) throw usersRes.error;
    if (branchesRes.error) throw branchesRes.error;

    const grouped = new Map<string, Array<{ id: string; branch_name: string }>>();
    (branchMapRes.data ?? []).forEach((r) => {
      const arr = grouped.get(r.staff_id) ?? [];
      const b = r.branches as { id?: string; branch_name?: string } | null;
      if (b?.id) arr.push({ id: b.id, branch_name: b.branch_name ?? '-' });
      grouped.set(r.staff_id, arr);
    });

    const rows = (staffs ?? []).map((s) => ({ ...s, branches: grouped.get(s.id) ?? [] }));

    return NextResponse.json({
      data: rows,
      refs: {
        users: usersRes.data ?? [],
        branches: branchesRes.data ?? [],
      },
      pagination: { page, page_size: pageSize, total: count ?? 0 },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function POST(req: Request) {
  try {
    const { supabase, user, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager'] });
    const parsed = staffSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload', issues: parsed.error.issues }, { status: 400 });

    const payload = parsed.data;
    const { count: staffCount } = await supabase
      .from('staff')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false);
    await assertFeatureQuota(profile.shop_id, 'staff', staffCount ?? 0);

    const { data: existed } = await supabase
      .from('staff')
      .select('id')
      .eq('shop_id', profile.shop_id)
      .eq('user_id', payload.user_id)
      .eq('is_deleted', false)
      .maybeSingle();
    if (existed) return NextResponse.json({ error: 'This user is already staff in this shop' }, { status: 400 });

    const { data: inserted, error } = await supabase
      .from('staff')
      .insert({
        user_id: payload.user_id,
        company_id: profile.company_id,
        shop_id: profile.shop_id,
        display_name: payload.display_name,
        active: payload.active,
        created_by: user.id,
        updated_by: user.id,
      })
      .select('id')
      .single();

    if (error || !inserted) throw error ?? new Error('Create staff failed');

    if (payload.branch_ids.length > 0) {
      const rows = payload.branch_ids.map((branchId) => ({
        company_id: profile.company_id,
        shop_id: profile.shop_id,
        staff_id: inserted.id,
        branch_id: branchId,
        created_by: user.id,
        updated_by: user.id,
      }));
      const { error: mapError } = await supabase.from('staff_branches').insert(rows);
      if (mapError) throw mapError;
    }

    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function PATCH(req: Request) {
  try {
    const { supabase, user, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager'] });
    const body = await req.json();
    const id = body.id as string;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const parsed = staffSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload', issues: parsed.error.issues }, { status: 400 });

    const payload = parsed.data;

    const { error } = await supabase
      .from('staff')
      .update({
        user_id: payload.user_id,
        display_name: payload.display_name,
        active: payload.active,
        updated_by: user.id,
      })
      .eq('id', id)
      .eq('shop_id', profile.shop_id);

    if (error) throw error;

    await supabase
      .from('staff_branches')
      .update({ is_deleted: true, updated_by: user.id })
      .eq('staff_id', id)
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false);

    if (payload.branch_ids.length > 0) {
      const rows = payload.branch_ids.map((branchId) => ({
        company_id: profile.company_id,
        shop_id: profile.shop_id,
        staff_id: id,
        branch_id: branchId,
        created_by: user.id,
        updated_by: user.id,
      }));
      const { error: mapError } = await supabase.from('staff_branches').insert(rows);
      if (mapError) throw mapError;
    }

    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function DELETE(req: Request) {
  try {
    const { supabase, user, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner'] });
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const { error } = await supabase
      .from('staff')
      .update({ is_deleted: true, active: false, updated_by: user.id })
      .eq('id', id)
      .eq('shop_id', profile.shop_id);
    if (error) throw error;

    await supabase
      .from('staff_branches')
      .update({ is_deleted: true, updated_by: user.id })
      .eq('staff_id', id)
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false);

    await writeAuditLog({
      companyId: profile.company_id,
      shopId: profile.shop_id,
      userId: user.id,
      action: 'data_deleted',
      targetTable: 'staff',
      targetId: id,
      payload: { soft_delete: true, cascade_soft_delete: ['staff_branches'] },
    });

    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
