import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { capacityRulesPayloadSchema } from '@/lib/booking/schemas';
import { writeAuditLog } from '@/lib/audit/activity-log';
import { CAPACITY_RULE_WEEKDAYS, findOverlap } from '@/lib/booking/capacity-rules';

/**
 * Time-range capacity rules of one service (`service_capacity_rules`).
 *
 * `GET` lists them; `PUT` replaces the whole set. Replace-all keeps the editor
 * simple (the portal sends what the table shows) and makes overlap validation a
 * pure function of the payload. Rows are soft-deleted, never removed.
 */

type RuleRow = {
  id: string;
  branch_id: string | null;
  weekday: number | null;
  time_from: string;
  time_to: string;
  capacity: number;
  active: boolean;
};

/** `HH:MM:SS` → `HH:MM`, for messages. */
function shortTime(value: string): string {
  return value.slice(0, 5);
}

/**
 * Service of this shop, or null.
 */
async function findService(
  supabase: Awaited<ReturnType<typeof requireAuthContext>>['supabase'],
  shopId: string,
  serviceId: string,
) {
  const { data, error } = await supabase
    .from('services')
    .select('id,service_name')
    .eq('id', serviceId)
    .eq('shop_id', shopId)
    .eq('is_deleted', false)
    .maybeSingle();
  if (error) throw error;
  return data as { id: string; service_name: string } | null;
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager', 'staff'] });
    const { id } = await ctx.params;
    if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Invalid service id' }, { status: 400 });

    const service = await findService(supabase, profile.shop_id, id);
    if (!service) return NextResponse.json({ error: 'ไม่พบบริการ' }, { status: 404 });

    const { data, error } = await supabase
      .from('service_capacity_rules')
      .select('id,branch_id,weekday,time_from,time_to,capacity,active')
      .eq('shop_id', profile.shop_id)
      .eq('service_id', id)
      .eq('is_deleted', false)
      .order('branch_id', { ascending: true, nullsFirst: true })
      .order('weekday', { ascending: true, nullsFirst: true })
      .order('time_from', { ascending: true });
    if (error) throw error;
    return NextResponse.json({ data: (data ?? []) as RuleRow[] });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager'] });
    const { id } = await ctx.params;
    if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Invalid service id' }, { status: 400 });

    const parsed = capacityRulesPayloadSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    const rules = parsed.data.rules;

    const service = await findService(supabase, profile.shop_id, id);
    if (!service) return NextResponse.json({ error: 'ไม่พบบริการ' }, { status: 404 });

    const overlap = findOverlap(rules);
    if (overlap) {
      const [a, b] = overlap;
      const day = a.weekday === null ? 'ทุกวัน' : `วัน${CAPACITY_RULE_WEEKDAYS[a.weekday]}`;
      return NextResponse.json(
        {
          error: `ช่วงเวลา ${shortTime(a.time_from)}-${shortTime(a.time_to)} ซ้อนกับ ${shortTime(b.time_from)}-${shortTime(b.time_to)} (${day}) กรุณาแก้ให้ไม่ซ้อนกัน`,
          code: 'rule_overlap',
        },
        { status: 400 },
      );
    }

    // Every named branch must belong to this shop.
    const branchIds = Array.from(new Set(rules.map((r) => r.branch_id).filter((b): b is string => Boolean(b))));
    if (branchIds.length > 0) {
      const { data: branches, error: brErr } = await supabase
        .from('branches')
        .select('id')
        .eq('shop_id', profile.shop_id)
        .eq('is_deleted', false)
        .in('id', branchIds);
      if (brErr) throw brErr;
      const known = new Set((branches ?? []).map((b) => String((b as { id: string }).id)));
      if (branchIds.some((b) => !known.has(b))) return NextResponse.json({ error: 'สาขาไม่ถูกต้อง' }, { status: 400 });
    }

    // Replace-all: retire the current set, then insert the new one.
    const { error: delErr } = await supabase
      .from('service_capacity_rules')
      .update({ is_deleted: true, updated_by: user.id, updated_at: new Date().toISOString() })
      .eq('shop_id', profile.shop_id)
      .eq('service_id', id)
      .eq('is_deleted', false);
    if (delErr) throw delErr;

    if (rules.length > 0) {
      const { error: insErr } = await supabase.from('service_capacity_rules').insert(
        rules.map((r) => ({
          company_id: profile.company_id,
          shop_id: profile.shop_id,
          service_id: id,
          branch_id: r.branch_id,
          weekday: r.weekday,
          time_from: r.time_from.length === 5 ? `${r.time_from}:00` : r.time_from,
          time_to: r.time_to.length === 5 ? `${r.time_to}:00` : r.time_to,
          capacity: r.capacity,
          active: r.active,
          created_by: user.id,
          updated_by: user.id,
        })),
      );
      if (insErr) throw insErr;
    }

    await writeAuditLog({
      companyId: profile.company_id,
      shopId: profile.shop_id,
      userId: user.id,
      action: 'data_updated',
      targetTable: 'service_capacity_rules',
      targetId: id,
      payload: { service_name: service.service_name, rule_count: rules.length },
    });

    const { data, error } = await supabase
      .from('service_capacity_rules')
      .select('id,branch_id,weekday,time_from,time_to,capacity,active')
      .eq('shop_id', profile.shop_id)
      .eq('service_id', id)
      .eq('is_deleted', false)
      .order('time_from', { ascending: true });
    if (error) throw error;
    return NextResponse.json({ data: (data ?? []) as RuleRow[] });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
