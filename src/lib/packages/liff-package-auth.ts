import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveShopByKeyOrId, type ResolvedShop } from '@/lib/line/shop-resolver';
import { resolveLiffCaller } from '@/lib/line/liff-identity';
import { signBookingToken, verifyBookingToken } from '@/lib/payments/tokens';
import { findLiffCustomer } from './packages-server';

/**
 * Shop → verified LINE user → customer, for the LIFF package routes. The
 * customer id always comes from the verified LIFF ID token, never the body.
 */
export async function resolveLiffPackageCaller(
  admin: SupabaseClient,
  shopKey: string,
  lineUserId: string | null | undefined,
  idToken: string | null | undefined,
): Promise<
  | { ok: true; shop: ResolvedShop; lineUserPk: string | null; customerId: string | null }
  | { ok: false; error: string; status: number }
> {
  const shop = await resolveShopByKeyOrId(admin, shopKey);
  if (!shop) return { ok: false, error: 'Shop not found', status: 404 };
  const caller = await resolveLiffCaller(admin, shop.id, lineUserId ?? undefined, idToken ?? undefined);
  if (!caller.ok) return { ok: false, error: caller.error, status: caller.status };
  const found = await findLiffCustomer(admin, shop.id, caller.lineUserId);
  return { ok: true, shop, lineUserPk: found?.lineUserPk ?? null, customerId: found?.customerId ?? null };
}

/** HMAC `t` for a package purchase QR (separate namespace from booking ids). */
export function signPackageToken(customerPackageId: string): string {
  return signBookingToken(`pkg:${customerPackageId}`);
}

/** Verify the `t` of a package purchase QR. */
export function verifyPackageToken(customerPackageId: string, token: string | null | undefined): boolean {
  return verifyBookingToken(`pkg:${customerPackageId}`, token);
}

/**
 * PromptPay QR PNG of a pending package purchase (amount in the URL as a cache key only).
 */
export function packageQrUrl(shopKey: string, customerPackageId: string, amountTHB: number): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '');
  const token = signPackageToken(customerPackageId);
  return `${base}/api/public/shop/${encodeURIComponent(shopKey)}/packages/qr?id=${customerPackageId}${token ? `&t=${token}` : ''}&a=${amountTHB.toFixed(2)}`;
}
