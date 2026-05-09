import { NextResponse } from 'next/server';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';

export async function GET() {
  try {
    const { supabase, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager'] });
    const { data, error } = await supabase
      .from('shops')
      .select('id,name,shop_key,line_channel_access_token,line_channel_secret,liff_id,auto_reply_enabled')
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
    const { error } = await supabase
      .from('shops')
      .update({
        line_channel_access_token: body.line_channel_access_token ?? null,
        line_channel_secret: body.line_channel_secret ?? null,
        liff_id: body.liff_id ?? null,
        auto_reply_enabled: Boolean(body.auto_reply_enabled),
        updated_by: user.id,
      })
      .eq('id', profile.shop_id);
    if (error) throw error;
    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
