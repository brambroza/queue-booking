import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { writeAuditLog } from '@/lib/audit/activity-log';
import { BUSINESS_TYPES } from '@/lib/line/rich-menu/business-types';
import { configUsesFnbOrder, RichMenuConfigSchema } from '@/lib/line/rich-menu/schema';
import { loadRichMenuShop, toRichMenuState } from '@/lib/line/rich-menu/shop-state';
import { assertFnbPlan, getFnbAccess } from '@/lib/subscription/features';
import { subscriptionErrorResponse } from '@/lib/subscription/response';

const PatchSchema = z
  .object({
    business_type: z.enum(BUSINESS_TYPES).nullable().optional(),
    config: RichMenuConfigSchema.nullable().optional(),
  })
  .refine((b) => b.business_type !== undefined || b.config !== undefined, { message: 'ไม่มีข้อมูลให้บันทึก' });

/** Builder state for the current shop (token never returned). */
export async function GET() {
  try {
    const { supabase, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager'] });
    const shopId = profile.shop_id as string;
    const [shop, fnb] = await Promise.all([loadRichMenuShop(supabase, shopId), getFnbAccess(supabase, shopId)]);
    return NextResponse.json({ data: toRichMenuState(shop, fnb) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

/** Save business type and/or rich menu config. */
export async function PATCH(req: Request) {
  try {
    const { supabase, user, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner'] });
    const body = PatchSchema.parse(await req.json());
    const shopId = profile.shop_id as string;
    // A "สั่งอาหาร" button needs F&B ordering in the plan (Professional+).
    const fnb = body.config && configUsesFnbOrder(body.config) ? await assertFnbPlan(supabase, shopId) : await getFnbAccess(supabase, shopId);

    const patch: Record<string, unknown> = { updated_by: user.id };
    if (body.business_type !== undefined) patch.business_type = body.business_type;
    if (body.config !== undefined) patch.rich_menu_config = body.config;

    const { error } = await supabase.from('shops').update(patch).eq('id', profile.shop_id);
    if (error) throw error;

    await writeAuditLog({
      companyId: profile.company_id,
      shopId: profile.shop_id,
      userId: user.id,
      action: 'rich_menu_config_updated',
      targetTable: 'shops',
      targetId: profile.shop_id ?? null,
      payload: {
        business_type: body.business_type,
        layout: body.config?.layout ?? null,
        style: body.config?.style ?? null,
        buttons: body.config?.buttons.length ?? null,
      },
    });

    const shop = await loadRichMenuShop(supabase, shopId);
    return NextResponse.json({ data: toRichMenuState(shop, fnb) });
  } catch (e) {
    const paywall = subscriptionErrorResponse(e);
    if (paywall) return paywall;
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
