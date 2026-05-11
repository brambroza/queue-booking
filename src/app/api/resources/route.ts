import { NextResponse } from 'next/server';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { bookingResourceSchema } from '@/lib/booking/schemas';

function toInt(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export async function GET(req: Request) {
  try {
    const { supabase, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager', 'staff'] });
    const { searchParams } = new URL(req.url);
    const resourceType = searchParams.get('resource_type');
    const branchId = searchParams.get('branch_id');
    const active = searchParams.get('active');
    const zone = searchParams.get('zone');
    const q = searchParams.get('q');
    const page = toInt(searchParams.get('page'), 1);
    const pageSize = Math.min(toInt(searchParams.get('page_size'), 20), 100);

    let query = supabase
      .from('booking_resources')
      .select('*, branches(branch_name)', { count: 'exact' })
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false)
      .order('resource_type', { ascending: true })
      .order('resource_code', { ascending: true });

    if (resourceType) query = query.eq('resource_type', resourceType);
    if (branchId) query = query.eq('branch_id', branchId);
    if (active === 'true' || active === 'false') query = query.eq('active', active === 'true');
    if (zone) query = query.ilike('zone', `%${zone}%`);
    if (q) query = query.or(`resource_name.ilike.%${q}%,resource_code.ilike.%${q}%,description.ilike.%${q}%`);

    const from = (page - 1) * pageSize;
    const { data, error, count } = await query.range(from, from + pageSize - 1);
    if (error) throw error;
    return NextResponse.json({ data: data ?? [], pagination: { page, page_size: pageSize, total: count ?? 0 } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function POST(req: Request) {
  try {
    const { supabase, user, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager'] });
    const body = await req.json();
    const parsed = bookingResourceSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

    const { error } = await supabase.from('booking_resources').insert({
      company_id: profile.company_id,
      shop_id: profile.shop_id,
      branch_id: body.branch_id || null,
      resource_type: parsed.data.resource_type,
      resource_code: parsed.data.resource_code || null,
      resource_name: parsed.data.resource_name,
      capacity: parsed.data.capacity,
      floor: parsed.data.floor || null,
      zone: parsed.data.zone || null,
      description: parsed.data.description || null,
      active: parsed.data.active,
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
    const id = String(body.id ?? '');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const parsed = bookingResourceSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

    const { error } = await supabase
      .from('booking_resources')
      .update({
        branch_id: body.branch_id || null,
        resource_type: parsed.data.resource_type,
        resource_code: parsed.data.resource_code || null,
        resource_name: parsed.data.resource_name,
        capacity: parsed.data.capacity,
        floor: parsed.data.floor || null,
        zone: parsed.data.zone || null,
        description: parsed.data.description || null,
        active: parsed.data.active,
        updated_by: user.id,
      })
      .eq('id', id)
      .eq('shop_id', profile.shop_id);

    if (error) throw error;
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
      .from('booking_resources')
      .update({ is_deleted: true, active: false, updated_by: user.id })
      .eq('id', id)
      .eq('shop_id', profile.shop_id);

    if (error) throw error;
    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

