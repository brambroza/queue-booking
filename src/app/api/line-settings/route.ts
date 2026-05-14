import { NextResponse } from 'next/server';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { writeAuditLog } from '@/lib/audit/activity-log';

export async function GET() {
  try {
    const { supabase, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager'] });
    const { data, error } = await supabase
      .from('shops')
      .select('id,name,shop_key,line_channel_access_token,line_channel_secret,liff_id,liff_id_login_shop,auto_reply_enabled')
      .eq('id', profile.shop_id)
      .single();
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function PATCH(req: Request) {
  try {
    const { supabase, user, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner'] });
    const body = await req.json();
    const { data: beforeShop } = await supabase
      .from('shops')
      .select('id,line_channel_access_token,line_channel_secret,liff_id,liff_id_login_shop,auto_reply_enabled')
      .eq('id', profile.shop_id)
      .maybeSingle();

    const { error } = await supabase
      .from('shops')
      .update({
        line_channel_access_token: body.line_channel_access_token ?? null,
        line_channel_secret: body.line_channel_secret ?? null,
        liff_id: body.liff_id ?? null,
        liff_id_login_shop: body.liff_id_login_shop ?? null,
        auto_reply_enabled: Boolean(body.auto_reply_enabled),
        updated_by: user.id,
      })
      .eq('id', profile.shop_id);
    if (error) throw error;

    await writeAuditLog({
      companyId: profile.company_id,
      shopId: profile.shop_id,
      userId: user.id,
      action: 'line_settings_token_changed',
      targetTable: 'shops',
      targetId: profile.shop_id ?? null,
      payload: {
        before: {
          liff_id: beforeShop?.liff_id ?? null,
          liff_id_login_shop: beforeShop?.liff_id_login_shop ?? null,
          auto_reply_enabled: beforeShop?.auto_reply_enabled ?? null,
          has_line_channel_access_token: Boolean(beforeShop?.line_channel_access_token),
          has_line_channel_secret: Boolean(beforeShop?.line_channel_secret),
        },
        after: {
          liff_id: body.liff_id ?? null,
          liff_id_login_shop: body.liff_id_login_shop ?? null,
          auto_reply_enabled: Boolean(body.auto_reply_enabled),
          has_line_channel_access_token: Boolean(body.line_channel_access_token),
          has_line_channel_secret: Boolean(body.line_channel_secret),
        },
      },
    });

    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
