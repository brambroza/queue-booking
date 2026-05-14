import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { writeAuditLog } from '@/lib/audit/activity-log';

const customerSchema = z.object({
  full_name: z.string().min(2),
  phone: z.string().min(8),
  note: z.string().optional().nullable(),
  line_user_id: z.string().uuid().optional().nullable(),
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
      .from('customers')
      .select('id,full_name,phone,note,line_user_id,created_at', { count: 'exact' })
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (q) {
      query = query.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,note.ilike.%${q}%`);
    }

    const from = (page - 1) * pageSize;
    const { data, error, count } = await query.range(from, from + pageSize - 1);
    if (error) throw error;

    const lineUserIds = (data ?? []).map((r) => r.line_user_id).filter(Boolean) as string[];
    const { data: lineUsers } = lineUserIds.length
      ? await supabase.from('line_users').select('id,line_user_id,display_name').in('id', lineUserIds)
      : { data: [] as Array<{ id: string; line_user_id: string; display_name: string | null }> };

    const lineMap = new Map((lineUsers ?? []).map((x) => [x.id, x]));

    const rows = (data ?? []).map((r) => ({
      ...r,
      line_user: r.line_user_id ? lineMap.get(r.line_user_id) ?? null : null,
    }));

    return NextResponse.json({ data: rows, pagination: { page, page_size: pageSize, total: count ?? 0 } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function POST(req: Request) {
  try {
    const { supabase, user, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager', 'staff'] });
    const parsed = customerSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload', issues: parsed.error.issues }, { status: 400 });

    const payload = parsed.data;
    const { error } = await supabase.from('customers').insert({
      company_id: profile.company_id,
      shop_id: profile.shop_id,
      line_user_id: payload.line_user_id ?? null,
      full_name: payload.full_name,
      phone: payload.phone,
      note: payload.note ?? null,
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
    const { supabase, user, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager', 'staff'] });
    const body = await req.json();
    const id = body.id as string;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const parsed = customerSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload', issues: parsed.error.issues }, { status: 400 });

    const payload = parsed.data;
    const { error } = await supabase
      .from('customers')
      .update({
        line_user_id: payload.line_user_id ?? null,
        full_name: payload.full_name,
        phone: payload.phone,
        note: payload.note ?? null,
        updated_by: user.id,
      })
      .eq('id', id)
      .eq('shop_id', profile.shop_id);

    if (error) throw error;
    await writeAuditLog({
      companyId: profile.company_id,
      shopId: profile.shop_id,
      userId: user.id,
      action: 'data_deleted',
      targetTable: 'customers',
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
      .from('customers')
      .update({ is_deleted: true, updated_by: user.id })
      .eq('id', id)
      .eq('shop_id', profile.shop_id);

    if (error) throw error;
    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
