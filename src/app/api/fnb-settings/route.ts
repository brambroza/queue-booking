import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { assertFnbPlan, getFnbAccess } from '@/lib/subscription/features';
import { subscriptionErrorResponse } from '@/lib/subscription/response';
import { writeAuditLog } from '@/lib/audit/activity-log';

const PatchSchema = z.object({ fnb_enabled: z.boolean() });

/** F&B availability for this shop: plan gate, owner switch and the effective result. */
export async function GET() {
  try {
    const { supabase, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager', 'staff'] });
    const access = await getFnbAccess(supabase, profile.shop_id as string);
    return NextResponse.json({
      data: {
        fnb_enabled: access.switchOn,
        plan_allowed: access.planAllowed,
        enabled: access.enabled,
        plan_code: access.planCode,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

/**
 * Turn F&B ordering on or off. Turning it off is always allowed (a shop whose
 * plan lapsed must still be able to stop it); turning it on needs Professional+.
 */
export async function PATCH(req: Request) {
  try {
    const { supabase, user, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner'] });
    const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    const shopId = profile.shop_id as string;

    if (parsed.data.fnb_enabled) await assertFnbPlan(supabase, shopId);

    const { error } = await supabase
      .from('shops')
      .update({ fnb_enabled: parsed.data.fnb_enabled, updated_by: user.id })
      .eq('id', shopId);
    if (error) {
      console.error('[fnb_settings_update_failed]', error.message);
      return NextResponse.json({ error: 'บันทึกการตั้งค่าไม่สำเร็จ' }, { status: 400 });
    }
    await writeAuditLog({
      companyId: profile.company_id,
      shopId,
      userId: user.id,
      action: 'data_updated',
      targetTable: 'shops',
      targetId: shopId,
      payload: { fnb_enabled: parsed.data.fnb_enabled },
    });
    return NextResponse.json({ data: { fnb_enabled: parsed.data.fnb_enabled } });
  } catch (e) {
    const paywall = subscriptionErrorResponse(e);
    if (paywall) return paywall;
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
