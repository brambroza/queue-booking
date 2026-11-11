import type { SupabaseClient } from '@supabase/supabase-js';
import { bookingConfirmFlex } from '@/lib/line/messages';
import { deeplinkPaymentFlex, qrPaymentFlex, transferPaymentFlex } from '@/lib/line/messages-payment';
import { resolveCustomerLiffUrl } from '@/lib/line/liff-url';
import { getShopPaymentConfig } from '@/lib/payments/settings';
import { buildPromptPayQrUrl } from '@/lib/payments/transfer';
import { buildDeeplinkReturnUrl } from '@/lib/payments/deeplink';
import { maskPromptPayId } from '@/lib/payments/promptpay';
import { bankDisplayName, parseBankCode } from '@/lib/payments/mobile-banking/banks';
import { parseBankProvider, providerDisplayName } from '@/lib/payments/deeplink/registry';
import { isAwaitingPayment } from '@/lib/payments/payment-hold';
import { resourceTypeLabel } from '@/lib/booking/resource-types';
import { bookingTimeLabel } from '@/lib/booking/multi-slot';
import { formatThaiDateLabel } from '@/lib/utils/date-format';
import { createdTogether, packBookingMessages } from './booking-delivery';

/**
 * The cards a customer gets right after booking — confirmation per queue plus
 * the payment card — rebuilt from the database rows, so the same set can be
 * sent from `/book` (push) and from the webhook (free reply to the booking
 * echo) without `/book` having to hand the Flex JSON across.
 */

type BookingRow = {
  id: string;
  queue_number: string | null;
  booking_date: string;
  start_time: string;
  end_time: string | null;
  status: string;
  created_at: string;
  last_line_notify_at: string | null;
  line_user_id: string | null;
  branch_id: string | null;
  service_id: string | null;
  resource_id: string | null;
  resource_name: string | null;
  payment_status: string | null;
  payment_method: string | null;
  payment_amount: number | null;
  payment_expires_at: string | null;
  omise_qr_image_url: string | null;
  bank_provider: string | null;
  bank_deeplink_url: string | null;
  payment_hold_booking_id: string | null;
};

const BOOKING_COLUMNS =
  'id,queue_number,booking_date,start_time,end_time,status,created_at,last_line_notify_at,line_user_id,branch_id,service_id,resource_id,resource_name,payment_status,payment_method,payment_amount,payment_expires_at,omise_qr_image_url,bank_provider,bank_deeplink_url,payment_hold_booking_id';

export type BookingDelivery = {
  /** Messages for one LINE call (≤ 5). */
  messages: object[];
  /** Every queue the cards cover, so the caller can stamp them all. */
  bookingIds: string[];
  /** The queue that carries the invoice (first of the order). */
  payingBookingId: string;
};

/**
 * Every queue of the order `bookingId` belongs to: the hold group when there
 * is one, else queues of the same customer and day inserted together.
 */
async function loadOrder(admin: SupabaseClient, shopId: string, seed: BookingRow): Promise<BookingRow[]> {
  if (seed.payment_hold_booking_id) {
    const { data } = await admin
      .from('bookings')
      .select(BOOKING_COLUMNS)
      .eq('shop_id', shopId)
      .eq('payment_hold_booking_id', seed.payment_hold_booking_id)
      .eq('is_deleted', false);
    const rows = (data ?? []) as BookingRow[];
    if (rows.length > 0) return rows;
  }
  if (!seed.line_user_id) return [seed];
  const { data } = await admin
    .from('bookings')
    .select(BOOKING_COLUMNS)
    .eq('shop_id', shopId)
    .eq('line_user_id', seed.line_user_id)
    .eq('booking_date', seed.booking_date)
    .eq('is_deleted', false)
    .gte('created_at', new Date(new Date(seed.created_at).getTime() - 10_000).toISOString())
    .lte('created_at', new Date(new Date(seed.created_at).getTime() + 10_000).toISOString());
  const rows = ((data ?? []) as BookingRow[]).filter((r) => createdTogether(r.created_at, seed.created_at));
  return rows.length > 0 ? rows : [seed];
}

/**
 * Build the confirmation + payment cards for the order that contains
 * `bookingId`. Null when the booking is not found.
 *
 * @param admin - Service-role client.
 * @param opts.shopId - Tenant scope.
 * @param opts.bookingId - Any queue of the order.
 */
export async function buildBookingDeliveryMessages(
  admin: SupabaseClient,
  opts: { shopId: string; bookingId: string },
): Promise<BookingDelivery | null> {
  const { data: seedRow } = await admin
    .from('bookings')
    .select(BOOKING_COLUMNS)
    .eq('id', opts.bookingId)
    .eq('shop_id', opts.shopId)
    .eq('is_deleted', false)
    .maybeSingle();
  if (!seedRow) return null;
  const seed = seedRow as BookingRow;

  const order = (await loadOrder(admin, opts.shopId, seed)).sort((a, b) => a.start_time.localeCompare(b.start_time));
  const first = order[0];
  // The invoice sits on the hold payer, else on the earliest queue.
  const payer = order.find((r) => r.id === r.payment_hold_booking_id) ?? order.find((r) => Number(r.payment_amount ?? 0) > 0) ?? first;

  const [{ data: shop }, { data: branch }, { data: service }, { data: resource }, config] = await Promise.all([
    admin.from('shops').select('name,shop_key,liff_id,liff_id_login_shop').eq('id', opts.shopId).maybeSingle(),
    first.branch_id
      ? admin.from('branches').select('branch_name').eq('id', first.branch_id).eq('shop_id', opts.shopId).maybeSingle()
      : Promise.resolve({ data: null }),
    first.service_id
      ? admin.from('services').select('service_name,duration_minutes,requires_approval,booking_mode').eq('id', first.service_id).eq('shop_id', opts.shopId).maybeSingle()
      : Promise.resolve({ data: null }),
    first.resource_id
      ? admin.from('booking_resources').select('resource_type').eq('id', first.resource_id).eq('shop_id', opts.shopId).maybeSingle()
      : Promise.resolve({ data: null }),
    getShopPaymentConfig(admin, opts.shopId),
  ]);

  const shopRow = (shop ?? {}) as { name?: string | null; shop_key?: string | null; liff_id?: string | null; liff_id_login_shop?: string | null };
  const shopName = shopRow.name ?? 'Queue Booking';
  const branchName = (branch as { branch_name?: string | null } | null)?.branch_name ?? '-';
  const serviceRow = service as { service_name?: string | null; duration_minutes?: number | null } | null;
  const serviceName = serviceRow?.service_name ?? '-';
  const resourceType = (resource as { resource_type?: string | null } | null)?.resource_type ?? null;
  const dateLabel = formatThaiDateLabel(first.booking_date);
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '');
  const shopKey = shopRow.shop_key ?? null;
  // Same link `/book` has always put on the confirmation card.
  const liffUrl = appUrl && shopKey ? `${appUrl}/liff/${encodeURIComponent(shopKey)}` : undefined;

  const multi = order.length > 1;
  const awaitingPayment = isAwaitingPayment(payer.status, payer.payment_status);
  const slotCount = (row: BookingRow): number => {
    const dur = Number(serviceRow?.duration_minutes ?? 0);
    if (!dur || !row.end_time) return 1;
    const [sh, sm] = row.start_time.split(':').map(Number);
    const [eh, em] = row.end_time.split(':').map(Number);
    let minutes = eh * 60 + em - (sh * 60 + sm);
    if (minutes <= 0) minutes += 24 * 60;
    return Math.max(1, Math.round(minutes / dur));
  };

  const confirmCards = order.map((row) =>
    bookingConfirmFlex({
      shopName,
      queueNumber: row.queue_number ?? '-',
      branch: branchName,
      service: serviceName,
      date: dateLabel,
      time: multi ? row.start_time.slice(0, 5) : bookingTimeLabel(row.start_time, row.end_time, slotCount(row)),
      assignedTo: row.resource_name ?? null,
      assignedLabel: row.resource_name ? resourceTypeLabel(resourceType) : null,
      liffUrl,
      pendingApproval: row.status === 'pending_approval' && !awaitingPayment,
      awaitingPayment,
      bookingId: row.id,
    }),
  );

  const amount = Number(payer.payment_amount ?? 0);
  const owes = amount > 0 && payer.payment_status === 'pending_payment' && Boolean(payer.payment_method);
  let paymentCard: object | null = null;
  if (owes) {
    const common = {
      shopName,
      queueNumber: payer.queue_number ?? '-',
      service: serviceName,
      branch: branchName,
      date: dateLabel,
      time: order.map((r) => r.start_time.slice(0, 5)).join(', '),
      amountTHB: amount,
      expiresAt: payer.payment_expires_at,
    };
    const accountUrl = shopKey
      ? resolveCustomerLiffUrl({
          shopKey,
          liffId: shopRow.liff_id ?? null,
          liffIdLoginShop: shopRow.liff_id_login_shop ?? null,
          tab: 'account',
          bookingId: payer.id,
          appUrl: appUrl || null,
        }) ?? null
      : null;
    if (payer.payment_method === 'bank_transfer' && config.promptpayId) {
      paymentCard = transferPaymentFlex({
        ...common,
        qrImageUrl: buildPromptPayQrUrl(payer.id, amount),
        payeeName: config.promptpayDisplayName,
        promptpayMasked: maskPromptPayId(config.promptpayId),
        bankName: config.bankName,
        bankAccountNo: config.bankAccountNo,
        uploadUrl: accountUrl,
      });
    } else if (payer.payment_method === 'omise_promptpay' && payer.omise_qr_image_url) {
      paymentCard = qrPaymentFlex({ ...common, qrImageUrl: payer.omise_qr_image_url, isTest: config.omiseSecretKey.startsWith('skey_test') });
    } else if ((payer.payment_method === 'bank_deeplink' || payer.payment_method === 'omise_mobile_banking') && payer.bank_deeplink_url && shopKey) {
      const bankName =
        payer.payment_method === 'bank_deeplink'
          ? (() => { const p = parseBankProvider(payer.bank_provider); return p ? providerDisplayName(p) : 'แอปธนาคาร'; })()
          : parseBankCode(payer.bank_provider) ? bankDisplayName(payer.bank_provider) : 'แอปธนาคาร';
      paymentCard = deeplinkPaymentFlex({
        ...common,
        bankName,
        deeplinkUrl: payer.bank_deeplink_url,
        fallbackUrl: buildDeeplinkReturnUrl(shopKey, payer.id),
        accountUrl,
      });
    }
  }

  return {
    messages: packBookingMessages(confirmCards, paymentCard),
    bookingIds: order.map((r) => r.id),
    payingBookingId: payer.id,
  };
}

/**
 * Claim the order for delivery: stamps `last_line_notify_at` on every queue
 * that has none yet. Returns false when another path (push, reply, fallback)
 * already delivered, so cards are never sent twice.
 */
export async function claimBookingDelivery(admin: SupabaseClient, shopId: string, bookingIds: string[], now = new Date()): Promise<boolean> {
  if (bookingIds.length === 0) return false;
  const { data, error } = await admin
    .from('bookings')
    .update({ last_line_notify_at: now.toISOString() })
    .in('id', bookingIds)
    .eq('shop_id', shopId)
    .is('last_line_notify_at', null)
    .select('id');
  if (error) return false;
  return (data ?? []).length > 0;
}

/** Undo `claimBookingDelivery` after a failed send so a later path may retry. */
export async function releaseBookingDelivery(admin: SupabaseClient, shopId: string, bookingIds: string[]): Promise<void> {
  if (bookingIds.length === 0) return;
  await admin.from('bookings').update({ last_line_notify_at: null }).in('id', bookingIds).eq('shop_id', shopId);
}
