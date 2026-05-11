import { NextResponse } from 'next/server';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { bookingResourceBulkSchema } from '@/lib/booking/schemas';

function padNumber(n: number, length: number) {
  if (length <= 0) return String(n);
  return String(n).padStart(length, '0');
}

export async function POST(req: Request) {
  try {
    const { supabase, user, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager'] });
    const parsed = bookingResourceBulkSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

    const payload = parsed.data;
    const namePrefix = payload.name_prefix?.trim() || (payload.resource_type === 'meeting_room' ? 'Room' : 'โต๊ะ');
    const codes: string[] = [];

    if (payload.mode === 'range') {
      const start = payload.start_number ?? 1;
      const end = payload.end_number ?? start;
      const prefix = payload.prefix?.trim();
      if (!prefix || end < start) return NextResponse.json({ error: 'Invalid range setup' }, { status: 400 });
      for (let i = start; i <= end; i += 1) {
        codes.push(`${prefix}${padNumber(i, payload.pad_length ?? 2)}`);
      }
    } else {
      const fromList = payload.code_list ?? [];
      if (fromList.length === 0) return NextResponse.json({ error: 'code_list is required for list mode' }, { status: 400 });
      fromList.forEach((c) => codes.push(c.trim()));
    }

    const rows = codes.map((code, idx) => ({
      company_id: profile.company_id,
      shop_id: profile.shop_id,
      branch_id: payload.branch_id ?? null,
      resource_type: payload.resource_type,
      resource_code: code,
      resource_name: `${namePrefix} ${idx + 1}`,
      capacity: payload.capacity,
      floor: payload.floor ?? null,
      zone: payload.zone ?? null,
      active: payload.active,
      created_by: user.id,
      updated_by: user.id,
    }));

    const { error } = await supabase.from('booking_resources').insert(rows);
    if (error) throw error;
    return NextResponse.json({ data: { created: rows.length } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

