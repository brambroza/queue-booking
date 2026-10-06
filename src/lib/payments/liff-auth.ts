import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveShopByKeyOrId } from '@/lib/line/shop-resolver';
import { resolveLiffCaller } from '@/lib/line/liff-identity';

export interface ResolvedBookingOwner {
  shop: { id: string; company_id: string; name: string | null; shop_key: string };
  lineUserPk: string;
  booking: {
    id: string;
    queue_number: string;
    payment_status: string | null;
    payment_method: string | null;
    payment_amount: number | null;
    payment_expires_at: string | null;
    payment_reject_reason: string | null;
    bank_provider: string | null;
    bank_txn_id: string | null;
    bank_deeplink_url: string | null;
    omise_charge_id: string | null;
  };
}

export type OwnerLookupFailure = { error: string; status: number };

/**
 * Resolve shop → verified LINE user → booking, asserting that the caller owns the booking.
 *
 * Identity comes from `resolveLiffCaller` (verified LIFF ID token). Every lookup
 * is scoped by shop_id and line_user_id, and tenant ids are taken from the
 * resolved rows rather than from the request body.
 */
export async function resolveBookingForLineUser(
  admin: SupabaseClient,
  shopKey: string,
  lineUserId: string,
  bookingId: string,
  idToken?: string | null,
): Promise<ResolvedBookingOwner | OwnerLookupFailure> {
  const shop = await resolveShopByKeyOrId(admin, shopKey);
  if (!shop) return { error: 'Shop not found', status: 404 };

  // The caller's LINE identity comes from a verified LIFF ID token, never from
  // the body alone (see resolveLiffCaller for the rollout flag).
  const caller = await resolveLiffCaller(admin, shop.id, lineUserId, idToken);
  if (!caller.ok) return { error: caller.error, status: caller.status };

  const { data: lineUser } = await admin
    .from('line_users')
    .select('id')
    .eq('shop_id', shop.id)
    .eq('line_user_id', caller.lineUserId)
    .eq('is_deleted', false)
    .maybeSingle();
  if (!lineUser) return { error: 'Line user not found', status: 404 };

  const { data: booking } = await admin
    .from('bookings')
    .select('id,queue_number,payment_status,payment_method,payment_amount,payment_expires_at,payment_reject_reason,bank_provider,bank_txn_id,bank_deeplink_url,omise_charge_id')
    .eq('id', bookingId)
    .eq('shop_id', shop.id)
    .eq('line_user_id', lineUser.id)
    .eq('is_deleted', false)
    .maybeSingle();
  if (!booking) return { error: 'Booking not found', status: 404 };

  return {
    shop: { id: shop.id, company_id: shop.company_id, name: shop.name ?? null, shop_key: shop.shop_key },
    lineUserPk: lineUser.id,
    booking: booking as ResolvedBookingOwner['booking'],
  };
}

export function isOwnerLookupFailure(v: unknown): v is OwnerLookupFailure {
  return typeof v === 'object' && v !== null && 'status' in v && 'error' in v;
}
