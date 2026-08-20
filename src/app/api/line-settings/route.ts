import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { writeAuditLog } from '@/lib/audit/activity-log';
import { isValidLiffId, normalizeLiffId } from '@/lib/line/liff-id';

const PatchSchema = z.object({
  line_channel_access_token: z.string().trim().max(500).optional().nullable(),
  line_channel_secret: z.string().trim().max(200).optional().nullable(),
  liff_id: z.string().trim().max(200).optional().nullable(),
  liff_id_login_shop: z.string().trim().max(200).optional().nullable(),
  auto_reply_enabled: z.boolean().optional(),
});

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
    const body = PatchSchema.parse(await req.json());

    // Accept a pasted LIFF URL and store the bare ID. Saving the URL verbatim
    // used to succeed and then break booking with no visible cause.
    const liffId = normalizeLiffId(body.liff_id);
    const liffIdLoginShop = normalizeLiffId(body.liff_id_login_shop);

    for (const [label, value] of [
      ['LIFF ID (จองคิว)', liffId],
      ['LIFF ID (สมาชิก)', liffIdLoginShop],
    ] as const) {
      if (value && !isValidLiffId(value)) {
        return NextResponse.json(
          { error: `${label} ไม่ถูกต้อง — ต้องอยู่ในรูปแบบ 1234567890-abcdefgh` },
          { status: 400 }
        );
      }
    }

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
        liff_id: liffId || null,
        liff_id_login_shop: liffIdLoginShop || null,
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
          liff_id: liffId || null,
          liff_id_login_shop: liffIdLoginShop || null,
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
