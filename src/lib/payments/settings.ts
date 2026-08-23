import type { SupabaseClient } from '@supabase/supabase-js';
import type { PaymentMethod } from '@/types/db';
import { resolveOmiseSecretKey } from './omise';
import { maskPromptPayId, normalizePromptPayTarget } from './promptpay';

/**
 * A shop's resolved payment configuration — the single place that decides which
 * methods are actually usable, so no caller has to re-derive it from raw columns.
 */
export interface ShopPaymentConfig {
  /** Methods this shop can actually charge with, in picker order. */
  enabledMethods: PaymentMethod[];
  omiseSecretKey: string;
  /** Raw PromptPay target. Server-only — never send this to a client. */
  promptpayId: string | null;
  promptpayDisplayName: string | null;
  bankName: string | null;
  bankAccountNo: string | null;
  bankAccountName: string | null;
  transferWindowMinutes: number;
}

/** Customer-safe subset of the config, suitable for /meta and LIFF responses. */
export interface PublicPaymentInfo {
  methods: PaymentMethod[];
  promptpay_display_name: string | null;
  promptpay_masked: string | null;
  bank_name: string | null;
  bank_account_no: string | null;
  bank_account_name: string | null;
}

const SHOP_PAYMENT_COLUMNS =
  'qr_payment_enabled, omise_secret_key, transfer_payment_enabled, promptpay_id, promptpay_display_name, bank_name, bank_account_no, bank_account_name, transfer_payment_window_minutes';

/**
 * Load a shop's payment configuration in one query.
 *
 * A method is only reported as enabled when it is both toggled on AND usable:
 * bank transfer needs a parseable PromptPay id, Omise needs a secret key.
 * Anything else would produce a booking stuck at pending_payment with no way to pay.
 */
export async function getShopPaymentConfig(
  admin: SupabaseClient,
  shopId: string,
): Promise<ShopPaymentConfig> {
  const { data, error } = await admin
    .from('shops')
    .select(SHOP_PAYMENT_COLUMNS)
    .eq('id', shopId)
    .maybeSingle();

  if (error) console.error('[payments] shop config fetch error:', error.message);

  const shop = (data ?? {}) as Record<string, unknown>;
  const omiseSecretKey = resolveOmiseSecretKey((shop.omise_secret_key as string | null) ?? null);
  const promptpayId = (shop.promptpay_id as string | null) ?? null;

  const enabledMethods: PaymentMethod[] = [];
  if (shop.transfer_payment_enabled && promptpayId && normalizePromptPayTarget(promptpayId)) {
    enabledMethods.push('bank_transfer');
  }
  if (shop.qr_payment_enabled && omiseSecretKey) {
    enabledMethods.push('omise_promptpay');
  }

  return {
    enabledMethods,
    omiseSecretKey,
    promptpayId,
    promptpayDisplayName: (shop.promptpay_display_name as string | null) ?? null,
    bankName: (shop.bank_name as string | null) ?? null,
    bankAccountNo: (shop.bank_account_no as string | null) ?? null,
    bankAccountName: (shop.bank_account_name as string | null) ?? null,
    transferWindowMinutes: Number(shop.transfer_payment_window_minutes ?? 1440) || 1440,
  };
}

/** Strip a config down to what a customer may see. */
export function toPublicPaymentInfo(config: ShopPaymentConfig): PublicPaymentInfo {
  const showTransfer = config.enabledMethods.includes('bank_transfer');
  return {
    methods: config.enabledMethods,
    promptpay_display_name: showTransfer ? config.promptpayDisplayName : null,
    promptpay_masked: showTransfer && config.promptpayId ? maskPromptPayId(config.promptpayId) : null,
    bank_name: showTransfer ? config.bankName : null,
    bank_account_no: showTransfer ? config.bankAccountNo : null,
    bank_account_name: showTransfer ? config.bankAccountName : null,
  };
}
