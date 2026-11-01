import type { SupabaseClient } from '@supabase/supabase-js';
import { ASSIGNABLE_ROLES, canAttachExistingAccount, shouldDetachProfile, type AssignableRole } from './staff-access';

/** Message + status carried to the route's catch through `getErrorStatus`. */
export class StaffAccessError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type Tenant = { userId: string; shopId: string; actorId: string };

/** Ids of the roles the staff screen manages, so owner grants are never touched. */
async function assignableRoleIds(admin: SupabaseClient): Promise<string[]> {
  const { data, error } = await admin
    .from('roles')
    .select('id')
    .in('code', [...ASSIGNABLE_ROLES])
    .eq('is_deleted', false);
  if (error) throw error;
  return (data ?? []).map((r) => r.id as string);
}

/**
 * Throw unless this existing account may join the shop.
 *
 * @throws StaffAccessError 409 when it belongs to another shop or holds a global role.
 */
export async function assertAttachable(admin: SupabaseClient, userId: string, shopId: string): Promise<void> {
  const [{ data: profile, error: profileError }, { data: grants, error: grantsError }] = await Promise.all([
    admin.from('users_profile').select('shop_id').eq('id', userId).maybeSingle(),
    admin.from('user_roles').select('shop_id').eq('user_id', userId).eq('is_deleted', false),
  ]);
  if (profileError) throw profileError;
  if (grantsError) throw grantsError;
  if (!canAttachExistingAccount(shopId, (profile?.shop_id as string | null) ?? null, grants ?? [])) {
    throw new StaffAccessError('อีเมลนี้เพิ่มเป็นพนักงานร้านนี้ไม่ได้ กรุณาใช้อีเมลอื่น', 409);
  }
}

/**
 * Give the account this role in the shop, reviving a revoked grant when there is one.
 * `idx_user_roles_unique` ignores `is_deleted`, so a blind insert would fail on re-invite.
 */
export async function grantShopRole(
  admin: SupabaseClient,
  input: Tenant & { companyId: string; role: AssignableRole }
): Promise<void> {
  const { data: roleRow, error: roleError } = await admin
    .from('roles')
    .select('id')
    .eq('code', input.role)
    .eq('is_deleted', false)
    .single();
  if (roleError || !roleRow) throw new Error(`Role ${input.role} not found in seed data`);

  const { error } = await admin.from('user_roles').upsert(
    {
      user_id: input.userId,
      role_id: roleRow.id,
      company_id: input.companyId,
      shop_id: input.shopId,
      is_deleted: false,
      created_by: input.actorId,
      updated_by: input.actorId,
    },
    { onConflict: 'user_id,role_id,shop_id' }
  );
  if (error) throw error;
}

/**
 * Take the account out of the shop: staff grants go, and the profile link with them
 * unless it is still earned. Owner grants are left alone. Safe to run twice.
 */
export async function revokeStaffAccess(admin: SupabaseClient, input: Tenant): Promise<void> {
  const roleIds = await assignableRoleIds(admin);
  const { error: revokeError } = await admin
    .from('user_roles')
    .update({ is_deleted: true, updated_by: input.actorId, updated_at: new Date().toISOString() })
    .eq('user_id', input.userId)
    .eq('shop_id', input.shopId)
    .eq('is_deleted', false)
    .in('role_id', roleIds);
  if (revokeError) throw revokeError;

  const [{ count, error: countError }, { data: shop, error: shopError }] = await Promise.all([
    admin
      .from('user_roles')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', input.userId)
      .eq('shop_id', input.shopId)
      .eq('is_deleted', false),
    admin.from('shops').select('created_by').eq('id', input.shopId).maybeSingle(),
  ]);
  if (countError) throw countError;
  if (shopError) throw shopError;

  if (shouldDetachProfile(count ?? 0, shop?.created_by === input.userId)) {
    const { error } = await admin
      .from('users_profile')
      .update({ shop_id: null, company_id: null, updated_by: input.actorId })
      .eq('id', input.userId)
      .eq('shop_id', input.shopId);
    if (error) throw error;
  }
}

/**
 * Undo `revokeStaffAccess` when a member is switched back on. Only the most recently
 * revoked grant returns, so a role dropped by an earlier re-invite stays dropped.
 *
 * @throws StaffAccessError 409 when the account has since joined another shop.
 */
export async function restoreStaffAccess(
  admin: SupabaseClient,
  input: Tenant & { companyId: string }
): Promise<void> {
  await assertAttachable(admin, input.userId, input.shopId);

  const roleIds = await assignableRoleIds(admin);
  const { data: live, error: liveError } = await admin
    .from('user_roles')
    .select('id')
    .eq('user_id', input.userId)
    .eq('shop_id', input.shopId)
    .eq('is_deleted', false)
    .in('role_id', roleIds)
    .limit(1);
  if (liveError) throw liveError;

  if ((live ?? []).length === 0) {
    const { data: last, error: lastError } = await admin
      .from('user_roles')
      .select('id')
      .eq('user_id', input.userId)
      .eq('shop_id', input.shopId)
      .in('role_id', roleIds)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastError) throw lastError;
    if (last) {
      const { error } = await admin
        .from('user_roles')
        .update({ is_deleted: false, updated_by: input.actorId, updated_at: new Date().toISOString() })
        .eq('id', last.id);
      if (error) throw error;
    }
  }

  const { error } = await admin
    .from('users_profile')
    .update({ shop_id: input.shopId, company_id: input.companyId, updated_by: input.actorId })
    .eq('id', input.userId);
  if (error) throw error;
}
