/** Roles a shop owner may hand out from the staff screen. Never shop_owner or super_admin. */
export const ASSIGNABLE_ROLES = ['branch_manager', 'staff'] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

/** A user_roles grant reduced to what the tenant check needs. */
export type RoleGrant = { shop_id: string | null };

/**
 * May this existing account be attached to `shopId`?
 *
 * The invite form takes any email, so an account that already belongs to another
 * shop must never be pulled across: rewriting its `users_profile.shop_id` would
 * lock its owner out of their own shop. Global grants (null shop_id) are refused
 * for the same reason.
 *
 * @param shopId Shop doing the inviting.
 * @param profileShopId `users_profile.shop_id` of the account, if any.
 * @param grants Live role grants of the account.
 */
export function canAttachExistingAccount(
  shopId: string,
  profileShopId: string | null,
  grants: RoleGrant[]
): boolean {
  if (profileShopId && profileShopId !== shopId) return false;
  return grants.every((g) => g.shop_id === shopId);
}

/**
 * Should the account lose its link to the shop after a staff role was revoked?
 *
 * `users_profile.shop_id` alone passes `can_access_shop` in RLS, so it has to go
 * too. The shop creator keeps it, since that link is how they recover ownership.
 *
 * @param remainingGrants Live role grants the account still holds in the shop.
 * @param isShopCreator True when `shops.created_by` is this account.
 */
export function shouldDetachProfile(remainingGrants: number, isShopCreator: boolean): boolean {
  return remainingGrants === 0 && !isShopCreator;
}
