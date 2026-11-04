import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { createAdminClient } from '@/lib/supabase/admin';
import { writeAuditLog } from '@/lib/audit/activity-log';
import { invalidateCache } from '@/lib/cache/kv';
import { isMissingTableError } from '@/lib/signage/sheet/sheet-feed-server';
import { SHEET_SIGNAGE_ADDON } from '@/lib/signage/sheet/sheet-source';

/**
 * super_admin: paid add-ons of one shop (sold outside the plans).
 * GET `?shop_id=` · PATCH `{ shop_id, addon_key, active, expires_on, note }`.
 * Only this route turns an add-on on; the shop can never write `shop_addons`.
 */

const ADDON_KEYS = [SHEET_SIGNAGE_ADDON] as const;
const ShopIdSchema = z.string().uuid();
const PatchSchema = z
  .object({
    shop_id: ShopIdSchema,
    addon_key: z.enum(ADDON_KEYS),
    active: z.boolean(),
    expires_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    note: z.string().trim().max(300).nullable().optional(),
  })
  .strict();

const NOT_MIGRATED = { error: 'ยังไม่ได้รัน migration 202611040001_signage_sheet_addon.sql', code: 'not_migrated' };

export async function GET(req: Request) {
  try {
    await requireAuthContext({ roles: ['super_admin'] });
    const shopId = ShopIdSchema.parse(new URL(req.url).searchParams.get('shop_id'));
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('shop_addons')
      .select('addon_key,active,expires_on,note,updated_at')
      .eq('shop_id', shopId);
    if (error) {
      if (isMissingTableError(error)) return NextResponse.json({ data: { migrated: false, addons: [] } });
      throw error;
    }
    return NextResponse.json({ data: { migrated: true, addons: data ?? [] } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function PATCH(req: Request) {
  try {
    const { user } = await requireAuthContext({ roles: ['super_admin'] });
    const body = PatchSchema.parse(await req.json());
    const admin = createAdminClient();

    const { data: shop } = await admin.from('shops').select('id,company_id').eq('id', body.shop_id).maybeSingle<{ id: string; company_id: string | null }>();
    if (!shop) return NextResponse.json({ error: 'ไม่พบร้านนี้' }, { status: 404 });

    const { data, error } = await admin
      .from('shop_addons')
      .upsert(
        {
          shop_id: body.shop_id,
          addon_key: body.addon_key,
          active: body.active,
          expires_on: body.expires_on,
          note: body.note ?? null,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'shop_id,addon_key' },
      )
      .select('addon_key,active,expires_on,note,updated_at')
      .single();
    if (error) {
      if (isMissingTableError(error)) return NextResponse.json(NOT_MIGRATED, { status: 400 });
      throw error;
    }

    // TVs pick the change up on their next poll; drop cached sheet reads so an
    // add-on switched off stops reading Google straight away.
    await invalidateCache(['sheet-signage:*', `sheet-source:${shop.id}:*`]);
    await writeAuditLog({
      companyId: shop.company_id,
      shopId: shop.id,
      userId: user.id,
      action: 'shop_addon_updated',
      targetTable: 'shop_addons',
      targetId: shop.id,
      payload: { addon_key: body.addon_key, active: body.active, expires_on: body.expires_on, note: body.note ?? null },
    });
    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
