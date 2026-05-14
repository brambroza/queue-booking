import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { writeAuditLog } from '@/lib/audit/activity-log';

const holidaySchema = z.object({
  branch_id: z.string().uuid().optional().nullable(),
  holiday_date: z.string().min(10),
  reason: z.string().trim().max(250).optional().nullable(),
});

export async function GET(req: Request) {
  try {
    const { supabase, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager', 'staff'] });
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get('branch_id');

    let query = supabase
      .from('holidays')
      .select('*, branches(branch_name)')
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false)
      .order('holiday_date', { ascending: true });

    if (branchId) query = query.eq('branch_id', branchId);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function POST(req: Request) {
  try {
    const { supabase, user, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager'] });
    const parsed = holidaySchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

    const { error } = await supabase.from('holidays').insert({
      ...parsed.data,
      company_id: profile.company_id,
      shop_id: profile.shop_id,
      created_by: user.id,
      updated_by: user.id,
    });

    if (error) throw error;
    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function PATCH(req: Request) {
  try {
    const { supabase, user, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager'] });
    const body = await req.json();
    const id = String(body?.id ?? '');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const parsed = holidaySchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

    const { error } = await supabase
      .from('holidays')
      .update({ ...parsed.data, updated_by: user.id })
      .eq('id', id)
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false);

    if (error) throw error;
    await writeAuditLog({
      companyId: profile.company_id,
      shopId: profile.shop_id,
      userId: user.id,
      action: 'data_deleted',
      targetTable: 'holidays',
      targetId: id,
      payload: { soft_delete: true },
    });
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
      .from('holidays')
      .update({ is_deleted: true, updated_by: user.id })
      .eq('id', id)
      .eq('shop_id', profile.shop_id);

    if (error) throw error;
    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
