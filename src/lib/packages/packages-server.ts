import type { SupabaseClient } from '@supabase/supabase-js';
import { getTodayISOInBangkok } from '@/lib/utils/date-format';
import { getSubscriptionState } from '@/lib/subscription/enforcement';
import { planAllowsPackages } from '@/lib/subscription/features';
import { getShopPaymentConfig } from '@/lib/payments/settings';
import { maskPromptPayId } from '@/lib/payments/promptpay';
import type { LiffOwnedPackage, ShopPackagesPublic } from './liff-view';
import {
  PACKAGE_INSUFFICIENT_CODE,
  PACKAGE_NOT_COVERED_CODE,
  PACKAGE_UNAVAILABLE_CODE,
  isPackageUsable,
  packageChargeFor,
  packageCoversService,
  packageDbErrorCode,
  packageInsufficientMessage,
  packageNotCoveredMessage,
  parseUsageWindows,
  type PackageQueue,
  type PackageStatus,
  type UsageWindow,
} from './rules';

/**
 * Server side of prepaid hour packages (service-role client). Balance writes
 * go through the security-definer functions of migration 202611160003.
 */

export const CUSTOMER_PACKAGE_COLUMNS =
  'id,customer_id,package_id,name,total_minutes,remaining_minutes,price_paid,valid_days,service_ids,usage_windows,starts_on,expires_on,status,source,payment_method,payment_note,payment_expires_at,reject_reason,activated_at,created_at';

export type CustomerPackageRow = {
  id: string;
  customer_id: string;
  package_id: string | null;
  name: string;
  total_minutes: number;
  remaining_minutes: number;
  price_paid: number;
  valid_days: number | null;
  service_ids: string[] | null;
  usage_windows: unknown;
  starts_on: string | null;
  expires_on: string | null;
  status: string;
  source: string;
  payment_method: string | null;
  payment_note: string | null;
  payment_expires_at: string | null;
  reject_reason: string | null;
  activated_at: string | null;
  created_at: string;
};

export const PACKAGES_NOT_READY = 'ระบบแพ็กเกจยังไม่พร้อม (รอเปิดใช้ฐานข้อมูล)';

const UNAVAILABLE_MESSAGE = 'แพ็กเกจนี้ใช้ไม่ได้แล้ว (หมดอายุ / ยังไม่เปิดใช้ / ไม่ใช่ของคุณ) กรุณาเลือกวิธีชำระอื่น';

export type PackageFailure = { ok: false; code: string; message: string; status: number };

export type PackagePlan = {
  ok: true;
  pkg: CustomerPackageRow;
  windows: UsageWindow[];
  perQueue: number[];
  minutes: number;
};

/**
 * Check, before any booking is written, that a package can pay for an order.
 *
 * @param admin - Service-role client.
 * @param opts.customerId - Proven owner (verified LINE user, or staff-chosen customer).
 */
export async function planPackageCharge(
  admin: SupabaseClient,
  opts: { shopId: string; customerId: string; customerPackageId: string; serviceId: string; queues: PackageQueue[] },
): Promise<PackagePlan | PackageFailure> {
  const { data, error } = await admin
    .from('customer_packages')
    .select(CUSTOMER_PACKAGE_COLUMNS)
    .eq('id', opts.customerPackageId)
    .eq('shop_id', opts.shopId)
    .eq('customer_id', opts.customerId)
    .maybeSingle();
  if (error) {
    console.error('[packages] lookup failed:', error.message);
    return { ok: false, code: PACKAGE_UNAVAILABLE_CODE, message: UNAVAILABLE_MESSAGE, status: 409 };
  }
  const pkg = data as CustomerPackageRow | null;
  if (!pkg || !isPackageUsable(pkg, getTodayISOInBangkok())) {
    return { ok: false, code: PACKAGE_UNAVAILABLE_CODE, message: UNAVAILABLE_MESSAGE, status: 409 };
  }
  if (!packageCoversService(pkg.service_ids, opts.serviceId)) {
    return { ok: false, code: PACKAGE_NOT_COVERED_CODE, message: 'แพ็กเกจนี้ใช้กับบริการนี้ไม่ได้ กรุณาเลือกวิธีชำระอื่น', status: 409 };
  }
  const windows = parseUsageWindows(pkg.usage_windows);
  const charge = packageChargeFor(windows, opts.queues);
  if (!charge.ok) return { ok: false, code: charge.code, message: packageNotCoveredMessage(charge.time), status: 409 };
  if (charge.minutes > pkg.remaining_minutes) {
    return { ok: false, code: PACKAGE_INSUFFICIENT_CODE, message: packageInsufficientMessage(charge.minutes, pkg.remaining_minutes), status: 409 };
  }
  return { ok: true, pkg, windows, perQueue: charge.perQueue, minutes: charge.minutes };
}

/**
 * Deduct the planned minutes for the bookings just created (atomic in the DB).
 *
 * @returns Remaining minutes, or a failure (race: another device used the minutes first).
 */
export async function redeemPackage(
  admin: SupabaseClient,
  opts: { shopId: string; customerId: string; customerPackageId: string; items: Array<{ bookingId: string; minutes: number }>; actor?: string | null },
): Promise<{ ok: true; remaining: number } | PackageFailure> {
  const { data, error } = await admin.rpc('redeem_customer_package', {
    p_shop_id: opts.shopId,
    p_customer_package_id: opts.customerPackageId,
    p_customer_id: opts.customerId,
    p_items: opts.items.map((i) => ({ booking_id: i.bookingId, minutes: i.minutes })),
    p_actor: opts.actor ?? null,
  });
  if (error) {
    const code = packageDbErrorCode(error.message);
    if (!code) console.error('[packages] redeem failed:', error.message);
    return {
      ok: false,
      code: code ?? PACKAGE_UNAVAILABLE_CODE,
      message: code === 'package_insufficient' ? 'ชั่วโมงในแพ็กเกจไม่พอแล้ว กรุณาเลือกวิธีชำระอื่น' : UNAVAILABLE_MESSAGE,
      status: 409,
    };
  }
  return { ok: true, remaining: Number(data ?? 0) };
}

/**
 * Give back the minutes of a cancelled / deleted booking. Never throws; a
 * booking without a package (or refunded already) is a no-op.
 *
 * @returns New balance, or null when nothing was refunded.
 */
export async function safeRefundPackageForBooking(
  admin: SupabaseClient,
  opts: { shopId: string; bookingId: string; note?: string; actor?: string | null },
): Promise<number | null> {
  try {
    const { data, error } = await admin.rpc('refund_customer_package_booking', {
      p_shop_id: opts.shopId,
      p_booking_id: opts.bookingId,
      p_note: opts.note ?? null,
      p_actor: opts.actor ?? null,
    });
    if (error) {
      // Before migration 202611160003 the function does not exist: nothing to refund.
      if (!/function .* does not exist|Could not find the function/i.test(error.message)) {
        console.error('[packages] refund failed:', error.message);
      }
      return null;
    }
    return data === null || data === undefined ? null : Number(data);
  } catch (e) {
    console.error('[packages] refund error:', e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Deduct again the minutes of a booking restored after a cancel refunded them.
 *
 * @returns `{ ok: true }` (also when the booking has no package) or a failure.
 */
export async function reredeemPackageForBooking(
  admin: SupabaseClient,
  opts: { shopId: string; bookingId: string; actor?: string | null },
): Promise<{ ok: true } | PackageFailure> {
  const { error } = await admin.rpc('reredeem_customer_package_booking', {
    p_shop_id: opts.shopId,
    p_booking_id: opts.bookingId,
    p_actor: opts.actor ?? null,
  });
  if (!error) return { ok: true };
  if (/function .* does not exist|Could not find the function/i.test(error.message)) return { ok: true };
  const code = packageDbErrorCode(error.message) ?? PACKAGE_UNAVAILABLE_CODE;
  return {
    ok: false,
    code,
    message:
      code === 'package_insufficient'
        ? 'กู้คิวไม่ได้: ชั่วโมงในแพ็กเกจของลูกค้าไม่พอแล้ว'
        : 'กู้คิวไม่ได้: แพ็กเกจที่ใช้จ่ายคิวนี้หมดอายุหรือถูกยกเลิกแล้ว',
    status: 409,
  };
}

/**
 * Customer row of a verified LINE user in a shop, or null.
 *
 * @param lineUserId - Verified LINE `sub`.
 */
export async function findLiffCustomer(
  admin: SupabaseClient,
  shopId: string,
  lineUserId: string,
): Promise<{ lineUserPk: string; customerId: string | null } | null> {
  const { data: lineUser } = await admin
    .from('line_users')
    .select('id')
    .eq('shop_id', shopId)
    .eq('line_user_id', lineUserId)
    .eq('is_deleted', false)
    .maybeSingle();
  if (!lineUser) return null;
  const { data: customers } = await admin
    .from('customers')
    .select('id')
    .eq('shop_id', shopId)
    .eq('line_user_id', lineUser.id)
    .eq('is_deleted', false)
    .order('updated_at', { ascending: false })
    .limit(1);
  return { lineUserPk: String(lineUser.id), customerId: (customers?.[0]?.id as string | undefined) ?? null };
}

/**
 * Packages of one customer (newest first), or null when the tables are missing.
 */
export async function loadCustomerPackages(admin: SupabaseClient, shopId: string, customerId: string): Promise<CustomerPackageRow[] | null> {
  const { data, error } = await admin
    .from('customer_packages')
    .select(CUSTOMER_PACKAGE_COLUMNS)
    .eq('shop_id', shopId)
    .eq('customer_id', customerId)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return null;
  return (data ?? []) as CustomerPackageRow[];
}

/**
 * Public shape of a package for LIFF (no internal notes / staff ids).
 * `qr_image_url` is filled by the caller (needs the shop key).
 */
export function toPublicCustomerPackage(row: CustomerPackageRow, today: string): Omit<LiffOwnedPackage, 'qr_image_url'> {
  const windows = parseUsageWindows(row.usage_windows);
  return {
    id: row.id,
    name: row.name,
    total_minutes: row.total_minutes,
    remaining_minutes: row.remaining_minutes,
    price_paid: Number(row.price_paid ?? 0),
    expires_on: row.expires_on,
    status: row.status as PackageStatus,
    service_ids: row.service_ids ?? [],
    usage_windows: windows,
    payment_expires_at: row.payment_expires_at,
    reject_reason: row.reject_reason,
    usable: isPackageUsable(row, today),
  };
}

/**
 * Whether LIFF should load packages at all: the shop sells one (active
 * template) or a customer still holds one. False on any error / before
 * migration 202611160003, so shops that never set packages up add no load to
 * the LIFF page (it is hit hard at a booking rush). Read through the `/meta` cache.
 */
export async function shopUsesPackages(admin: SupabaseClient, shopId: string): Promise<boolean> {
  try {
    const [templates, sold] = await Promise.all([
      admin.from('credit_packages').select('id', { count: 'exact', head: true }).eq('shop_id', shopId).eq('is_deleted', false).eq('active', true),
      admin
        .from('customer_packages')
        .select('id', { count: 'exact', head: true })
        .eq('shop_id', shopId)
        .in('status', ['active', 'pending_payment', 'awaiting_verification', 'rejected']),
    ]);
    if (templates.error || sold.error) return false;
    return (templates.count ?? 0) > 0 || (sold.count ?? 0) > 0;
  } catch {
    return false;
  }
}

/**
 * Catalog + payee + plan of a shop, built once for `/meta` (cached 30 s + CDN)
 * so a LIFF open costs no package query per customer. Throws on a read error
 * so a failure is never cached as "no packages".
 *
 * @param alwaysShown - Owner switch, already read by the caller.
 */
export async function loadShopPackagesPublic(admin: SupabaseClient, shopId: string, alwaysShown: boolean): Promise<ShopPackagesPublic> {
  const sub = await getSubscriptionState(shopId).catch(() => null);
  const planAllowed = Boolean(sub?.active && planAllowsPackages(sub.planCode));
  if (!planAllowed) return { plan_allowed: false, always_shown: alwaysShown, catalog: [], payee: null };

  const [{ data: templates, error }, config] = await Promise.all([
    admin
      .from('credit_packages')
      .select('id,name,description,credit_minutes,price,valid_days,service_ids,usage_windows')
      .eq('shop_id', shopId)
      .eq('is_deleted', false)
      .eq('active', true)
      .eq('sell_online', true)
      .order('sort_order')
      .order('created_at'),
    getShopPaymentConfig(admin, shopId),
  ]);
  if (error) throw new Error(`packages catalog lookup failed: ${error.message}`);
  return {
    plan_allowed: true,
    always_shown: alwaysShown,
    catalog: ((templates ?? []) as Array<Record<string, unknown>>).map((t) => ({
      id: String(t.id),
      name: String(t.name),
      description: (t.description as string | null) ?? null,
      credit_minutes: Number(t.credit_minutes),
      price: Number(t.price ?? 0),
      valid_days: (t.valid_days as number | null) ?? null,
      service_ids: (t.service_ids as string[] | null) ?? [],
      usage_windows: parseUsageWindows(t.usage_windows),
    })),
    payee: config.promptpayId
      ? {
          name: config.promptpayDisplayName,
          promptpay_masked: maskPromptPayId(config.promptpayId),
          bank_name: config.bankName,
          bank_account_no: config.bankAccountNo,
          bank_account_name: config.bankAccountName,
        }
      : null,
  };
}
