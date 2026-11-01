import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { applyBranchScope } from '@/lib/auth/branch-scope';
import { createAdminClient } from '@/lib/supabase/admin';
import { assertFeatureQuota } from '@/lib/subscription/enforcement';
import { subscriptionErrorResponse } from '@/lib/subscription/response';
import { writeAuditLog } from '@/lib/audit/activity-log';
import { escapePostgrestSearch } from '@/lib/utils/postgrest';
import { acceptInviteUrl } from '@/lib/auth/invite-link';
import { hitRateLimit, tooManyRequests } from '@/lib/security/rate-limit';
import { ASSIGNABLE_ROLES } from '@/lib/staff/staff-access';
import {
  StaffAccessError,
  assertAttachable,
  grantShopRole,
  restoreStaffAccess,
  revokeStaffAccess,
} from '@/lib/staff/staff-access-server';

/**
 * Managing staff and their branch assignments is owner-level: a branch_manager who
 * could edit staff_branches would be able to widen their own branch scope.
 */
const STAFF_ADMIN_ROLES = ['super_admin', 'shop_owner'] as const;

const staffSchema = z
  .object({
    /** Existing auth user to attach. Omit and pass `email` to invite a new one. */
    user_id: z.string().uuid().optional(),
    email: z.string().email().optional(),
    role: z.enum(ASSIGNABLE_ROLES).optional(),
    display_name: z.string().min(2),
    active: z.boolean().default(true),
    branch_ids: z.array(z.string().uuid()).default([]),
  })
  .refine((v) => Boolean(v.user_id) || Boolean(v.email), {
    message: 'Either user_id or email is required',
    path: ['user_id'],
  });

/**
 * Create (or reuse) the auth user, profile and role grant for a new staff member.
 *
 * Registration only ever produced shop_owner accounts, so before this there was no
 * way to bring a branch_manager or staff login into existence.
 *
 * @returns The auth user id, and whether an invite email went out. An account that
 *          already has a confirmed email is attached without one.
 * @throws StaffAccessError when the account belongs elsewhere or is already staff here.
 */
async function provisionStaffUser(input: {
  email: string;
  displayName: string;
  role: (typeof ASSIGNABLE_ROLES)[number];
  companyId: string;
  shopId: string;
  actorId: string;
  redirectTo: string;
}): Promise<{ userId: string; invited: boolean }> {
  const admin = createAdminClient();

  // Check before the invite call: nothing may be sent or written for a refused account.
  let userId = await findAuthUserByEmail(admin, input.email);
  let needsInvite = true;
  if (userId) {
    await assertAttachable(admin, userId, input.shopId);

    const { data: existed } = await admin
      .from('staff')
      .select('id')
      .eq('shop_id', input.shopId)
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .maybeSingle();
    if (existed) throw new StaffAccessError('This user is already staff in this shop', 400);

    const { data: account, error: accountError } = await admin.auth.admin.getUserById(userId);
    if (accountError) throw accountError;
    needsInvite = !account.user?.email_confirmed_at;
  }

  if (needsInvite) {
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(input.email, {
      redirectTo: input.redirectTo,
    });
    if (inviteError || !invited?.user?.id) {
      console.error('[staff] invite failed:', inviteError?.message);
      throw new StaffAccessError('ส่งอีเมลเชิญไม่สำเร็จ กรุณารอสักครู่แล้วลองใหม่', 502);
    }
    userId = invited.user.id;
  }
  if (!userId) throw new Error('Unable to invite user');

  const { data: existingProfile } = await admin.from('users_profile').select('id').eq('id', userId).maybeSingle();
  const { error: profileError } = await admin.from('users_profile').upsert({
    id: userId,
    company_id: input.companyId,
    shop_id: input.shopId,
    email: input.email,
    active: true,
    updated_by: input.actorId,
    ...(existingProfile ? {} : { full_name: input.displayName, created_by: input.actorId }),
  });
  if (profileError) throw profileError;

  await grantShopRole(admin, {
    userId,
    shopId: input.shopId,
    companyId: input.companyId,
    actorId: input.actorId,
    role: input.role,
  });

  return { userId, invited: needsInvite };
}

/** auth.users is not queryable directly, so page through the admin listing. */
async function findAuthUserByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string
): Promise<string | null> {
  const target = email.toLowerCase();
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return null;
    const match = data.users.find((u) => (u.email ?? '').toLowerCase() === target);
    if (match) return match.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

function toInt(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export async function GET(req: Request) {
  try {
    const { supabase, profile, branchScope } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager', 'staff'] });
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q');
    const page = toInt(searchParams.get('page'), 1);
    const pageSize = Math.min(toInt(searchParams.get('page_size'), 20), 100);

    // A branch-bound caller only sees colleagues assigned to one of their branches.
    let visibleStaffIds: string[] | null = null;
    if (branchScope !== null) {
      const { data: peers, error: peersError } = await applyBranchScope(
        supabase
          .from('staff_branches')
          .select('staff_id')
          .eq('shop_id', profile.shop_id)
          .eq('is_deleted', false),
        branchScope
      );
      if (peersError) throw peersError;
      visibleStaffIds = Array.from(new Set((peers ?? []).map((r) => r.staff_id as string)));
    }

    let query = supabase
      .from('staff')
      .select('id,user_id,display_name,active,created_at', { count: 'exact' })
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (visibleStaffIds) query = query.in('id', visibleStaffIds);
    const safeQ = escapePostgrestSearch(q);
    if (safeQ) query = query.ilike('display_name', `%${safeQ}%`);

    const from = (page - 1) * pageSize;
    const { data: staffs, error, count } = await query.range(from, from + pageSize - 1);
    if (error) throw error;

    const staffIds = (staffs ?? []).map((s) => s.id);

    const [branchMapRes, usersRes, branchesRes] = await Promise.all([
      staffIds.length
        ? supabase
            .from('staff_branches')
            .select('staff_id,branch_id,branches(id,branch_name)')
            .eq('shop_id', profile.shop_id)
            .eq('is_deleted', false)
            .in('staff_id', staffIds)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from('users_profile')
        .select('id,full_name,email,phone')
        .eq('shop_id', profile.shop_id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false }),
      applyBranchScope(
        supabase
          .from('branches')
          .select('id,branch_name')
          .eq('shop_id', profile.shop_id)
          .eq('is_deleted', false),
        branchScope,
        null,
        'id',
      ).order('created_at', { ascending: false }),
    ]);

    if (branchMapRes.error) throw branchMapRes.error;
    if (usersRes.error) throw usersRes.error;
    if (branchesRes.error) throw branchesRes.error;

    const grouped = new Map<string, Array<{ id: string; branch_name: string }>>();
    (branchMapRes.data ?? []).forEach((r) => {
      const arr = grouped.get(r.staff_id) ?? [];
      const b = r.branches as { id?: string; branch_name?: string } | null;
      if (b?.id) arr.push({ id: b.id, branch_name: b.branch_name ?? '-' });
      grouped.set(r.staff_id, arr);
    });

    const rows = (staffs ?? []).map((s) => ({ ...s, branches: grouped.get(s.id) ?? [] }));

    return NextResponse.json({
      data: rows,
      refs: {
        users: usersRes.data ?? [],
        branches: branchesRes.data ?? [],
      },
      pagination: { page, page_size: pageSize, total: count ?? 0 },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function POST(req: Request) {
  try {
    const { supabase, user, profile } = await requireAuthContext({ roles: [...STAFF_ADMIN_ROLES] });
    const parsed = staffSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload', issues: parsed.error.issues }, { status: 400 });
    if (!profile.company_id || !profile.shop_id) {
      return NextResponse.json({ error: 'Profile is missing company/shop context' }, { status: 400 });
    }

    const payload = parsed.data;
    const { count: staffCount } = await supabase
      .from('staff')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false);
    await assertFeatureQuota(profile.shop_id, 'staff', staffCount ?? 0);

    if (!payload.user_id) {
      if (payload.branch_ids.length === 0) {
        return NextResponse.json({ error: 'กรุณาเลือกสาขาอย่างน้อย 1 สาขา' }, { status: 400 });
      }
      if (!(await hitRateLimit(createAdminClient(), 'staffInvite', profile.shop_id))) return tooManyRequests();
    } else {
      const { data: member, error: memberError } = await supabase
        .from('users_profile')
        .select('id')
        .eq('id', payload.user_id)
        .eq('shop_id', profile.shop_id)
        .maybeSingle();
      if (memberError) throw memberError;
      if (!member) return NextResponse.json({ error: 'ไม่พบผู้ใช้นี้ในร้าน' }, { status: 400 });
    }

    const provisioned = payload.user_id
      ? null
      : await provisionStaffUser({
          email: payload.email!,
          displayName: payload.display_name,
          role: payload.role ?? 'staff',
          companyId: profile.company_id,
          shopId: profile.shop_id,
          actorId: user.id,
          redirectTo: acceptInviteUrl(process.env.NEXT_PUBLIC_APP_URL, new URL(req.url).origin),
        });
    const staffUserId = provisioned?.userId ?? payload.user_id!;

    const { data: existed } = await supabase
      .from('staff')
      .select('id')
      .eq('shop_id', profile.shop_id)
      .eq('user_id', staffUserId)
      .eq('is_deleted', false)
      .maybeSingle();
    if (existed) return NextResponse.json({ error: 'This user is already staff in this shop' }, { status: 400 });

    const { data: inserted, error } = await supabase
      .from('staff')
      .insert({
        user_id: staffUserId,
        company_id: profile.company_id,
        shop_id: profile.shop_id,
        display_name: payload.display_name,
        active: payload.active,
        created_by: user.id,
        updated_by: user.id,
      })
      .select('id')
      .single();

    if (error || !inserted) throw error ?? new Error('Create staff failed');

    const { error: mapError } = await supabase.rpc('set_staff_branches', {
      p_staff_id: inserted.id,
      p_shop_id: profile.shop_id,
      p_branch_ids: payload.branch_ids,
      p_actor: user.id,
    });
    if (mapError) throw mapError;

    if (!payload.active) {
      await revokeStaffAccess(createAdminClient(), { userId: staffUserId, shopId: profile.shop_id, actorId: user.id });
    }

    return NextResponse.json({ data: true, invited: provisioned?.invited ?? false });
  } catch (e) {
    const quota = subscriptionErrorResponse(e);
    if (quota) return quota;
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function PATCH(req: Request) {
  try {
    const { supabase, user, profile } = await requireAuthContext({ roles: [...STAFF_ADMIN_ROLES] });
    const body = await req.json();
    const id = typeof body?.id === 'string' ? body.id : '';
    if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const parsed = staffSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload', issues: parsed.error.issues }, { status: 400 });

    const payload = parsed.data;

    const { data: current, error: currentError } = await supabase
      .from('staff')
      .select('user_id,active')
      .eq('id', id)
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false)
      .maybeSingle();
    if (currentError) throw currentError;
    if (!current) return NextResponse.json({ error: 'ไม่พบพนักงาน' }, { status: 404 });

    const access = { userId: current.user_id as string, shopId: profile.shop_id as string, actorId: user.id };
    if (payload.active && !current.active) {
      await restoreStaffAccess(createAdminClient(), { ...access, companyId: profile.company_id as string });
    }

    // `user_id` is fixed at creation: re-pointing a staff row at another auth
    // account would hand that account this staff member's branch access.
    const { error } = await supabase
      .from('staff')
      .update({
        display_name: payload.display_name,
        active: payload.active,
        updated_by: user.id,
      })
      .eq('id', id)
      .eq('shop_id', profile.shop_id);

    if (error) throw error;

    // One transaction: never leaves the member with zero branches if the write fails.
    const { error: mapError } = await supabase.rpc('set_staff_branches', {
      p_staff_id: id,
      p_shop_id: profile.shop_id,
      p_branch_ids: payload.branch_ids,
      p_actor: user.id,
    });
    if (mapError) throw mapError;

    if (!payload.active) await revokeStaffAccess(createAdminClient(), access);

    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function DELETE(req: Request) {
  try {
    const { supabase, user, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner'] });
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const { data: target, error: targetError } = await supabase
      .from('staff')
      .select('user_id')
      .eq('id', id)
      .eq('shop_id', profile.shop_id)
      .maybeSingle();
    if (targetError) throw targetError;
    if (!target) return NextResponse.json({ error: 'ไม่พบพนักงาน' }, { status: 404 });

    const { error } = await supabase
      .from('staff')
      .update({ is_deleted: true, active: false, updated_by: user.id })
      .eq('id', id)
      .eq('shop_id', profile.shop_id);
    if (error) throw error;

    await supabase
      .from('staff_branches')
      .update({ is_deleted: true, updated_by: user.id })
      .eq('staff_id', id)
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false);

    await revokeStaffAccess(createAdminClient(), {
      userId: target.user_id as string,
      shopId: profile.shop_id as string,
      actorId: user.id,
    });

    await writeAuditLog({
      companyId: profile.company_id,
      shopId: profile.shop_id,
      userId: user.id,
      action: 'data_deleted',
      targetTable: 'staff',
      targetId: id,
      payload: { soft_delete: true, cascade_soft_delete: ['staff_branches'] },
    });

    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
