import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { writeAuditLog } from '@/lib/audit/activity-log';
import { LiffProvisionError, provisionShopLiffApps } from '@/lib/line/liff-provision';

const BodySchema = z.object({
  login_channel_id: z.string().trim().min(1, 'กรอก Channel ID').max(20),
  login_channel_secret: z.string().trim().min(1, 'กรอก Channel Secret').max(64),
});

/**
 * Create or repair the shop's booking + member LIFF apps on its LINE Login
 * channel and save both IDs. The channel secret is used for this call only
 * and is not stored.
 */
export async function POST(req: Request) {
  try {
    const { supabase, user, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner'] });
    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
    }

    const { data: shop, error } = await supabase
      .from('shops')
      .select('id,name,shop_key,liff_id,liff_id_login_shop')
      .eq('id', profile.shop_id)
      .single();
    if (error) throw error;
    if (!shop?.shop_key) return NextResponse.json({ error: 'ร้านนี้ยังไม่มี shop_key' }, { status: 400 });

    const result = await provisionShopLiffApps({
      channelId: parsed.data.login_channel_id,
      channelSecret: parsed.data.login_channel_secret,
      shopKey: shop.shop_key,
      shopName: shop.name ?? '',
      appUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://queuebooking.com',
      currentLiffId: shop.liff_id,
      currentLiffIdLoginShop: shop.liff_id_login_shop,
    });

    const { error: updateError } = await supabase
      .from('shops')
      .update({ liff_id: result.liffId, liff_id_login_shop: result.liffIdLoginShop, updated_by: user.id })
      .eq('id', profile.shop_id);
    if (updateError) throw updateError;

    await writeAuditLog({
      companyId: profile.company_id,
      shopId: profile.shop_id,
      userId: user.id,
      action: 'line_settings_liff_auto_provisioned',
      targetTable: 'shops',
      targetId: profile.shop_id ?? null,
      payload: {
        login_channel_id: parsed.data.login_channel_id,
        before: { liff_id: shop.liff_id ?? null, liff_id_login_shop: shop.liff_id_login_shop ?? null },
        after: { liff_id: result.liffId, liff_id_login_shop: result.liffIdLoginShop },
        created: result.created,
        updated: result.updated,
      },
    });

    return NextResponse.json({ data: result });
  } catch (e) {
    if (e instanceof LiffProvisionError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
