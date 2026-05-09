import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { AppRole } from '@/types/db';

class AuthError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function ensureRole(userRoles: AppRole[], required: AppRole[]) {
  return required.some((r) => userRoles.includes(r));
}

export async function requireAuthContext(opts?: { roles?: AppRole[] }) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new AuthError('Unauthorized', 401);

  let { data: profile, error: profileError } = await supabase
    .from('users_profile')
    .select('company_id, shop_id')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    // Auto-heal missing profile for authenticated users.
    // Use service-role client to avoid RLS deadlock when the profile row does not exist yet.
    const admin = createAdminClient();
    const { error: insertProfileError } = await admin.from('users_profile').upsert({
      id: user.id,
      email: user.email ?? null,
      full_name: (user.user_metadata as { full_name?: string } | null)?.full_name ?? null,
      active: true,
      created_by: user.id,
      updated_by: user.id,
    });

    if (!insertProfileError) {
      const refetch = await supabase
        .from('users_profile')
        .select('company_id, shop_id')
        .eq('id', user.id)
        .single();
      profile = refetch.data;
      profileError = refetch.error;
    }

    if (profileError || !profile) {
      profile = {
        company_id: null,
        shop_id: null,
      };
    }
  }

  const { data: roleRows, error: roleError } = await supabase
    .from('user_roles')
    .select('role_id')
    .eq('user_id', user.id)
    .eq('is_deleted', false);

  if (roleError) throw new AuthError('Unable to read roles', 403);

  const roleIds = (roleRows ?? []).map((r) => r.role_id).filter(Boolean) as string[];
  let roles: AppRole[] = [];

  if (roleIds.length > 0) {
    const { data: roleDefs, error: roleDefsError } = await supabase
      .from('roles')
      .select('code')
      .in('id', roleIds)
      .eq('is_deleted', false);

    if (roleDefsError) throw new AuthError('Unable to read role definitions', 403);
    roles = (roleDefs ?? []).map((r) => r.code).filter(Boolean) as AppRole[];
  }

  if (opts?.roles?.length && !ensureRole(roles, opts.roles)) {
    // Fallback for legacy accounts: if profile is tied to a shop,
    // treat as shop_owner when user_roles is missing.
    if (profile.shop_id && !roles.includes('shop_owner')) {
      roles.push('shop_owner');
    }

    // Backward-compatible fallback: allow shop creator as shop_owner
    // even when user_roles data is missing/incomplete.
    if (opts.roles.includes('shop_owner') && profile.shop_id) {
      const { data: shop, error: shopError } = await supabase
        .from('shops')
        .select('created_by')
        .eq('id', profile.shop_id)
        .single();

      if (!shopError && shop?.created_by === user.id) {
        roles.push('shop_owner');
      }
    }

    // Final fallback: read roles through service-role client by user_id.
    // This bypasses RLS/policy edge-cases for legacy or partially-migrated users.
    if (!ensureRole(roles, opts.roles)) {
      const admin = createAdminClient();
      const { data: adminRoleRows, error: adminRoleRowsError } = await admin
        .from('user_roles')
        .select('role_id')
        .eq('user_id', user.id)
        .eq('is_deleted', false);

      if (!adminRoleRowsError && (adminRoleRows?.length ?? 0) > 0) {
        const adminRoleIds = (adminRoleRows ?? []).map((r) => r.role_id).filter(Boolean) as string[];
        const { data: adminRoleDefs, error: adminRoleDefsError } = await admin
          .from('roles')
          .select('code')
          .in('id', adminRoleIds)
          .eq('is_deleted', false);

        if (!adminRoleDefsError) {
          const recovered = (adminRoleDefs ?? []).map((r) => r.code).filter(Boolean) as AppRole[];
          recovered.forEach((r) => {
            if (!roles.includes(r)) roles.push(r);
          });
      }
    }
  }

  // If profile has no tenant context but user_roles has one, hydrate profile context.
  if (!profile.company_id || !profile.shop_id) {
    const { data: tenantRoleRows, error: tenantRoleError } = await supabase
      .from('user_roles')
      .select('company_id,shop_id')
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .not('shop_id', 'is', null)
      .order('created_at', { ascending: true })
      .limit(1);

    if (!tenantRoleError && (tenantRoleRows?.length ?? 0) > 0) {
      const tenant = tenantRoleRows![0];
      if (tenant.company_id && tenant.shop_id) {
        profile = {
          company_id: tenant.company_id,
          shop_id: tenant.shop_id,
        };

        // Best-effort profile sync to avoid repeating fallback every request.
        try {
          const admin = createAdminClient();
          await admin
            .from('users_profile')
            .update({ company_id: tenant.company_id, shop_id: tenant.shop_id, updated_by: user.id })
            .eq('id', user.id);
        } catch {
          // no-op
        }
      }
    }
  }

    if (!ensureRole(roles, opts.roles)) {
      throw new AuthError(`Forbidden (roles=${roles.join(',') || 'none'})`, 403);
    }
  }

  return { supabase, user, profile, roles };
}

export function getErrorStatus(e: unknown): number {
  if (e instanceof AuthError) return e.status;
  return 400;
}
