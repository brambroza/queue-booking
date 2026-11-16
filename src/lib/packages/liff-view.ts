/**
 * What the LIFF package section shows — one pure rule for the client (which
 * builds it from the cached `/meta` + the `/me` it already loads) and for
 * `/packages` (refresh after a purchase). No DB here.
 */

import type { PackageStatus, UsageWindow } from './rules';

/** Shop-level package data (same for every customer); `/meta` field `packages`. */
export type ShopPackagesPublic = {
  plan_allowed: boolean;
  always_shown: boolean;
  catalog: Array<{
    id: string;
    name: string;
    description: string | null;
    credit_minutes: number;
    price: number;
    valid_days: number | null;
    service_ids: string[];
    usage_windows: UsageWindow[];
  }>;
  payee: { name: string | null; promptpay_masked: string | null; bank_name: string | null; bank_account_no: string | null; bank_account_name: string | null } | null;
};

/** One package the customer holds, as `/me` and `/packages` send it. */
export type LiffOwnedPackage = {
  id: string;
  name: string;
  total_minutes: number;
  remaining_minutes: number;
  price_paid: number;
  expires_on: string | null;
  status: PackageStatus;
  service_ids: string[];
  usage_windows: UsageWindow[];
  payment_expires_at: string | null;
  reject_reason: string | null;
  usable: boolean;
  qr_image_url: string | null;
};

export type LiffPackagesView = {
  /** Render the section at all. */
  enabled: boolean;
  catalog: ShopPackagesPublic['catalog'];
  mine: LiffOwnedPackage[];
  /** Online purchase possible (plan + PromptPay + a customer record). */
  can_buy: boolean;
  /** No customer record yet — buying needs one. */
  needs_member: boolean;
  payee: ShopPackagesPublic['payee'];
};

/**
 * Combine shop-level and per-customer package data into what LIFF shows.
 * Nothing to show (no package held, nothing sold online, switch off) = the
 * section is not rendered, so shops that do not use packages look as before.
 *
 * @param shop - `/meta` `packages` (null = shop does not use packages).
 * @param mine - Customer's packages (null = not loaded / none).
 * @param hasCustomer - A customer record exists for this LINE user.
 */
export function composeLiffPackages(
  shop: ShopPackagesPublic | null,
  mine: readonly LiffOwnedPackage[] | null,
  hasCustomer: boolean,
): LiffPackagesView {
  const owned = (mine ?? []).filter((p) => p.status !== 'cancelled');
  const planAllowed = Boolean(shop?.plan_allowed);
  const catalog = planAllowed ? shop?.catalog ?? [] : [];
  return {
    enabled: owned.length > 0 || (planAllowed && (catalog.length > 0 || Boolean(shop?.always_shown))),
    catalog,
    mine: owned,
    can_buy: planAllowed && Boolean(shop?.payee) && hasCustomer,
    needs_member: !hasCustomer,
    payee: shop?.payee ?? null,
  };
}
