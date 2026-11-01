import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { acceptInviteUrl } from '@/lib/auth/invite-link';
import { createAdminClient } from '@/lib/supabase/admin';
import { hitRateLimit, tooManyRequests } from '@/lib/security/rate-limit';
import { ASSIGNABLE_ROLES } from '@/lib/staff/staff-access';

const bodySchema = z.object({ id: z.string().uuid() });

/**
 * Email a staff member a fresh link to set their password: an invite if they never
 * confirmed, a password reset otherwise. The email address is read from the account,
 * never from the request, and only live staff grants of this shop qualify.
 */
export async function POST(req: Request) {
  try {
    const { supabase, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner'] });
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload', issues: parsed.error.issues }, { status: 400 });

    const admin = createAdminClient();
    if (!(await hitRateLimit(admin, 'staffInvite', profile.shop_id ?? 'none'))) return tooManyRequests();

    const { data: row, error: rowError } = await supabase
      .from('staff')
      .select('user_id')
      .eq('id', parsed.data.id)
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false)
      .maybeSingle();
    if (rowError) throw rowError;
    if (!row) return NextResponse.json({ error: 'ไม่พบพนักงาน' }, { status: 404 });

    const { data: grants, error: grantsError } = await admin
      .from('user_roles')
      .select('roles!inner(code)')
      .eq('user_id', row.user_id)
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false)
      .in('roles.code', [...ASSIGNABLE_ROLES]);
    if (grantsError) throw grantsError;
    if ((grants ?? []).length === 0) {
      return NextResponse.json({ error: 'พนักงานคนนี้ปิดใช้งานอยู่ หรือไม่ใช่บัญชีพนักงาน' }, { status: 400 });
    }

    const { data: account, error: accountError } = await admin.auth.admin.getUserById(row.user_id);
    if (accountError) throw accountError;
    const email = account.user?.email;
    if (!email) return NextResponse.json({ error: 'บัญชีนี้ไม่มีอีเมล' }, { status: 400 });

    const redirectTo = acceptInviteUrl(process.env.NEXT_PUBLIC_APP_URL, new URL(req.url).origin);
    const { error: sendError } = account.user.email_confirmed_at
      ? await admin.auth.resetPasswordForEmail(email, { redirectTo })
      : await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
    if (sendError) {
      console.error('[staff] resend invite failed:', sendError.message);
      return NextResponse.json({ error: 'ส่งอีเมลไม่สำเร็จ กรุณารอสักครู่แล้วลองใหม่' }, { status: 502 });
    }

    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
