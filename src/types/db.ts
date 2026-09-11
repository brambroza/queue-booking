export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type AppRole = 'super_admin' | 'shop_owner' | 'branch_manager' | 'staff' | 'customer';
export type BookingStatus = 'pending' | 'confirmed' | 'waiting' | 'serving' | 'completed' | 'cancelled' | 'no_show';
/**
 * Payment lifecycle of a booking.
 *
 * `awaiting_verification` and `rejected` only occur on the bank-transfer path,
 * where a customer-uploaded slip must be reviewed by shop staff. The Omise
 * PromptPay path goes straight from `pending_payment` to `paid` via webhook.
 */
export type PaymentStatus =
  | 'unpaid'
  | 'pending_payment'
  | 'awaiting_verification'
  | 'paid'
  | 'rejected'
  | 'failed'
  | 'refunded';

/**
 * How a booking is being paid for. Null on bookings with no payment.
 *
 * `bank_deeplink` covers every bank-app deeplink flow (SCB Easy, K PLUS, …);
 * the bank itself lives in `bookings.bank_provider`, because all banks share
 * one flow: open app → bank confirms → auto `paid` → receipt.
 */
export type PaymentMethod = 'omise_promptpay' | 'bank_transfer' | 'bank_deeplink';

/** Source of truth for zod enums and method-picker ordering. */
export const PAYMENT_METHODS = ['omise_promptpay', 'bank_transfer', 'bank_deeplink'] as const satisfies readonly PaymentMethod[];

/** Bank whose app a deeplink payment opens. */
export type BankProvider = 'scb' | 'kbank';

/** Source of truth for zod enums and the per-bank button order in LIFF. */
export const BANK_PROVIDERS = ['scb', 'kbank'] as const satisfies readonly BankProvider[];

/** Review state of an uploaded transfer slip. */
export type SlipStatus = 'pending' | 'approved' | 'rejected' | 'superseded';

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}
