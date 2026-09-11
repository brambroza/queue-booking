import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShopPaymentConfig } from './settings';
import type { DeeplinkProviderConfig } from './deeplink/types';

const getConfig = vi.fn<() => Promise<ShopPaymentConfig>>();
const createDeeplink = vi.fn();
const createTransfer = vi.fn();
const createQr = vi.fn();
let currentStatus: string | null = 'unpaid';

vi.mock('./settings', () => ({ getShopPaymentConfig: () => getConfig() }));
vi.mock('./deeplink', () => ({ createBookingDeeplinkPayment: (...a: unknown[]) => createDeeplink(...a) }));
vi.mock('./transfer', () => ({ createBookingTransferPayment: (...a: unknown[]) => createTransfer(...a) }));
vi.mock('./qr', () => ({ createBookingQrPayment: (...a: unknown[]) => createQr(...a) }));
vi.mock('@/lib/line/messages-payment', () => ({
  deeplinkPaymentFlex: (p: unknown) => ({ kind: 'deeplink', p }),
  transferPaymentFlex: (p: unknown) => ({ kind: 'transfer', p }),
  qrPaymentFlex: (p: unknown) => ({ kind: 'qr', p }),
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { payment_status: currentStatus } }) }),
      }),
    }),
  }),
}));

import { resolvePaymentForBooking } from './resolve';

function provider(p: 'scb' | 'kbank'): DeeplinkProviderConfig {
  return { id: `row-${p}`, provider: p, environment: 'sandbox', billerId: '1', merchantName: null, sessionMinutes: 15, webhookSecret: 's', credentials: {} };
}

function config(overrides: Partial<ShopPaymentConfig> = {}): ShopPaymentConfig {
  return {
    enabledMethods: ['bank_deeplink', 'bank_transfer', 'omise_promptpay'],
    omiseSecretKey: 'skey_test_x',
    promptpayId: '0812345678',
    promptpayDisplayName: 'ร้าน',
    bankName: null,
    bankAccountNo: null,
    bankAccountName: null,
    transferWindowMinutes: 1440,
    deeplinkProviders: [provider('scb'), provider('kbank')],
    ...overrides,
  };
}

const base = {
  bookingId: 'b1', shopId: 's1', companyId: 'c1', shopKey: 'shop', amountTHB: 120,
  shopName: 'ร้าน', queueNumber: 'A1', serviceName: 'svc', branchName: 'br', dateLabel: '10 ก.ย.', timeLabel: '10:00',
};

beforeEach(() => {
  currentStatus = 'unpaid';
  getConfig.mockReset();
  createDeeplink.mockReset();
  createTransfer.mockReset();
  createQr.mockReset();
  createDeeplink.mockResolvedValue({
    provider: 'kbank', providerName: 'K PLUS', transactionId: 'T', deeplinkUrl: 'https://k', expiresAt: '2026-09-10T00:15:00Z', amountTHB: 120, returnUrl: 'https://r',
  });
});

describe('resolvePaymentForBooking — bank_deeplink', () => {
  it('uses the bank the customer picked', async () => {
    getConfig.mockResolvedValue(config());
    const r = await resolvePaymentForBooking({ ...base, requestedMethod: 'bank_deeplink', requestedBankProvider: 'kbank' });
    expect(createDeeplink).toHaveBeenCalledWith(expect.objectContaining({ providerConfig: expect.objectContaining({ provider: 'kbank' }) }));
    expect(r).toMatchObject({ method: 'bank_deeplink', qrImageUrl: '', deeplink: { provider: 'kbank', deeplink_url: 'https://k' }, isTest: true });
    expect(r?.flex).toMatchObject({ kind: 'deeplink' });
  });

  it('falls back to the first configured bank when the requested one is not offered', async () => {
    getConfig.mockResolvedValue(config({ deeplinkProviders: [provider('scb')] }));
    await resolvePaymentForBooking({ ...base, requestedMethod: 'bank_deeplink', requestedBankProvider: 'kbank' });
    expect(createDeeplink).toHaveBeenCalledWith(expect.objectContaining({ providerConfig: expect.objectContaining({ provider: 'scb' }) }));
  });

  it('is the default when it is the shop’s first enabled method and nothing was requested', async () => {
    getConfig.mockResolvedValue(config());
    await resolvePaymentForBooking(base);
    expect(createDeeplink).toHaveBeenCalledTimes(1);
    expect(createTransfer).not.toHaveBeenCalled();
  });

  it('falls back to another method when deeplink is requested but not enabled', async () => {
    getConfig.mockResolvedValue(config({ enabledMethods: ['bank_transfer'], deeplinkProviders: [] }));
    createTransfer.mockResolvedValue({ qrImageUrl: 'q', expiresAt: 'e', amountTHB: 120, payeeName: null, promptpayMasked: null, bankName: null, bankAccountNo: null, bankAccountName: null });
    const r = await resolvePaymentForBooking({ ...base, requestedMethod: 'bank_deeplink', requestedBankProvider: 'scb' });
    expect(createDeeplink).not.toHaveBeenCalled();
    expect(r?.method).toBe('bank_transfer');
    expect(r?.deeplink).toBeNull();
  });

  it('needs a shop key for the return URL', async () => {
    getConfig.mockResolvedValue(config());
    expect(await resolvePaymentForBooking({ ...base, shopKey: null, requestedMethod: 'bank_deeplink' })).toBeNull();
    expect(createDeeplink).not.toHaveBeenCalled();
  });

  it('never re-issues on a paid or slip-submitted booking', async () => {
    getConfig.mockResolvedValue(config());
    currentStatus = 'paid';
    expect(await resolvePaymentForBooking({ ...base, requestedMethod: 'bank_deeplink', requestedBankProvider: 'scb' })).toBeNull();
    currentStatus = 'awaiting_verification';
    expect(await resolvePaymentForBooking({ ...base, requestedMethod: 'bank_deeplink', requestedBankProvider: 'scb' })).toBeNull();
    expect(createDeeplink).not.toHaveBeenCalled();
  });

  it('returns null for free bookings and shops with no methods', async () => {
    getConfig.mockResolvedValue(config({ enabledMethods: [] }));
    expect(await resolvePaymentForBooking({ ...base, amountTHB: 0 })).toBeNull();
    expect(await resolvePaymentForBooking(base)).toBeNull();
  });
});
