import type { SupabaseClient } from '@supabase/supabase-js';

export type OwnerContact = { name: string; email: string | null };

/** Greeting used when no owner name is on file anywhere. */
export const FALLBACK_OWNER_NAME = 'เจ้าของร้าน';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const clean = (v: string | null | undefined): string | null => {
  const t = (v ?? '').trim();
  return t.length > 0 ? t : null;
};

/**
 * Who to write to for a shop. The owner's own login email wins (it is the
 * address they registered with and read), then the shop's email, then the
 * company's. The name follows the same order. An address that is not shaped
 * like an email is treated as missing, so a typo in a profile never reaches the
 * mail server.
 */
export function pickOwnerContact(input: {
  ownerProfile?: { full_name?: string | null; email?: string | null } | null;
  shop?: { email?: string | null } | null;
  company?: { owner_name?: string | null; email?: string | null } | null;
}): OwnerContact {
  const emails = [input.ownerProfile?.email, input.shop?.email, input.company?.email].map(clean);
  const email = emails.find((e): e is string => Boolean(e) && EMAIL_RE.test(e as string)) ?? null;
  const name = clean(input.ownerProfile?.full_name) ?? clean(input.company?.owner_name) ?? FALLBACK_OWNER_NAME;
  return { name, email };
}

/**
 * Loads the contact for one shop. Service-role client: super_admin routes only.
 *
 * @param admin - Service-role client.
 * @param shopId - Shop to write to.
 */
export async function resolveShopOwnerContact(admin: SupabaseClient, shopId: string): Promise<OwnerContact> {
  const [{ data: shop }, { data: ownerRoles }] = await Promise.all([
    admin.from('shops').select('email,companies(owner_name,email)').eq('id', shopId).maybeSingle(),
    admin.from('user_roles').select('user_id,roles!inner(code)').eq('shop_id', shopId).eq('roles.code', 'shop_owner').eq('is_deleted', false).limit(1),
  ]);

  const ownerId = (ownerRoles?.[0]?.user_id as string | undefined) ?? null;
  const { data: ownerProfile } = ownerId
    ? await admin.from('users_profile').select('full_name,email').eq('id', ownerId).eq('is_deleted', false).maybeSingle()
    : { data: null };

  const companyRaw = (shop as { companies?: unknown } | null)?.companies;
  const company = (Array.isArray(companyRaw) ? companyRaw[0] : companyRaw) as { owner_name?: string | null; email?: string | null } | null | undefined;

  return pickOwnerContact({
    ownerProfile: ownerProfile as { full_name?: string | null; email?: string | null } | null,
    shop: shop as { email?: string | null } | null,
    company: company ?? null,
  });
}
