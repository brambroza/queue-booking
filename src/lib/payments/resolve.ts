import { createAdminClient } from '@/lib/supabase/admin';
import { qrPaymentFlex, transferPaymentFlex } from '@/lib/line/messages-payment';
import type { PaymentMethod } from '@/types/db';
import { getShopPaymentConfig } from './settings';
import { createBookingQrPayment } from './qr';
import { createBookingTransferPayment } from './transfer';

export interface PaymentBankInfo {
  payeeName: string | null;
  promptpayMasked: string | null;
  bankName: string | null;
  bankAccountNo: string | null;
  bankAccountName: string | null;
}

export interface PaymentSetupResult {
  method: PaymentMethod;
  amountTHB: number;
  qrImageUrl: string;
  expiresAt: string | null;
  isTest: boolean;
  /** Ready-to-push LINE Flex message for this method. */
  flex: object;
  /** Payee details — only present on the bank-transfer path. */
  bank: PaymentBankInfo | null;
}

/** Statuses where re-issuing an invoice would destroy state the customer already advanced. */
const LOCKED_STATUSES = new Set(['awaiting_verification', 'paid']);

function liffUrl(shopKey: string | null | undefined) {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '');
  if (!base || !shopKey) return null;
  return `${base}/liff/${encodeURIComponent(shopKey)}?tab=account`;
}

/**
 * Decide how a booking gets paid for, set it up, and return everything the
 * caller needs to tell the customer.
 *
 * Both booking routes call this instead of reaching into a specific provider,
 * so the enable/price/idempotency rules live in exactly one place.
 * Returns null when no payment is due or possible — that is not an error.
 */
export async function resolvePaymentForBooking(opts: {
  bookingId: string;
  shopId: string;
  companyId: string;
  shopKey?: string | null;
  amountTHB: number;
  shopName: string;
  queueNumber: string;
  serviceName: string;
  branchName: string;
  dateLabel: string;
  timeLabel: string;
  requestedMethod?: PaymentMethod | null;
}): Promise<PaymentSetupResult | null> {
  if (!(opts.amountTHB > 0)) return null;

  const admin = createAdminClient();
  const config = await getShopPaymentConfig(admin, opts.shopId);
  if (config.enabledMethods.length === 0) return null;

  // Never clobber a booking the customer has already paid or submitted a slip for.
  const { data: current } = await admin
    .from('bookings')
    .select('payment_status')
    .eq('id', opts.bookingId)
    .maybeSingle();
  if (current && LOCKED_STATUSES.has(String(current.payment_status))) return null;

  const method: PaymentMethod =
    opts.requestedMethod && config.enabledMethods.includes(opts.requestedMethod)
      ? opts.requestedMethod
      : config.enabledMethods[0];

  if (method === 'bank_transfer') {
    const result = await createBookingTransferPayment({
      bookingId: opts.bookingId,
      shopId: opts.shopId,
      companyId: opts.companyId,
      amountTHB: opts.amountTHB,
      config,
    });
    if (!result) return null;

    return {
      method,
      amountTHB: result.amountTHB,
      qrImageUrl: result.qrImageUrl,
      expiresAt: result.expiresAt,
      isTest: false,
      bank: {
        payeeName: result.payeeName,
        promptpayMasked: result.promptpayMasked,
        bankName: result.bankName,
        bankAccountNo: result.bankAccountNo,
        bankAccountName: result.bankAccountName,
      },
      flex: transferPaymentFlex({
        shopName: opts.shopName,
        queueNumber: opts.queueNumber,
        service: opts.serviceName,
        branch: opts.branchName,
        date: opts.dateLabel,
        time: opts.timeLabel,
        amountTHB: result.amountTHB,
        qrImageUrl: result.qrImageUrl,
        payeeName: result.payeeName,
        promptpayMasked: result.promptpayMasked,
        bankName: result.bankName,
        bankAccountNo: result.bankAccountNo,
        expiresAt: result.expiresAt,
        uploadUrl: liffUrl(opts.shopKey),
      }),
    };
  }

  const result = await createBookingQrPayment({
    bookingId: opts.bookingId,
    shopId: opts.shopId,
    companyId: opts.companyId,
    amountTHB: opts.amountTHB,
    shopName: opts.shopName,
    queueNumber: opts.queueNumber,
    config,
  });
  if (!result) return null;

  return {
    method: 'omise_promptpay',
    amountTHB: result.amountTHB,
    qrImageUrl: result.qrImageUrl,
    expiresAt: result.expiresAt,
    isTest: result.isTest,
    bank: null,
    flex: qrPaymentFlex({
      shopName: opts.shopName,
      queueNumber: opts.queueNumber,
      service: opts.serviceName,
      branch: opts.branchName,
      date: opts.dateLabel,
      time: opts.timeLabel,
      amountTHB: result.amountTHB,
      qrImageUrl: result.qrImageUrl,
      expiresAt: result.expiresAt,
      isTest: result.isTest,
    }),
  };
}
