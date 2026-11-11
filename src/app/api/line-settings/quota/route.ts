import { NextResponse } from 'next/server';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { createAdminClient } from '@/lib/supabase/admin';
import { refreshLineQuota } from '@/lib/line/quota-server';

/**
 * LINE push quota of this shop's OA: monthly cap, usage, and whether delivery
 * is paused because the cap was hit. Read from LINE (free calls) at most every
 * 10 minutes; `?refresh=1` forces a fresh read for the card's button.
 * Staff may read it — it explains why a customer got no chat card.
 */
export async function GET(req: Request) {
  try {
    const { profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager', 'staff'] });
    const force = new URL(req.url).searchParams.get('refresh') === '1';
    // Service role: the stored quota columns are written here (RLS allows select only).
    const state = await refreshLineQuota(createAdminClient(), profile.shop_id as string, { force });
    return NextResponse.json({ data: state });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
