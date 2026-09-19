import { describe, expect, it } from 'vitest';
import { evaluateSlip, maskedAccountMatches, type SlipEvaluationInput } from './evaluate';
import type { SlipQrParseResult } from './slip-qr';
import type { SlipProviderResult } from './provider';

const goodQr: SlipQrParseResult = {
  ok: true,
  slip: { sendingBankCode: '004', sendingBankName: 'ธนาคารกสิกรไทย', transRef: '013071152533APM07736', countryCode: 'TH', crcValid: true },
};

const bankOk: SlipProviderResult = {
  found: true,
  amountTHB: 500,
  receiverAccount: 'xxx-x-x5678-x',
  receiverName: 'ร้านทดสอบ',
  transferredAt: '2026-09-19T03:05:00.000Z',
};

function input(overrides: Partial<SlipEvaluationInput> = {}): SlipEvaluationInput {
  return {
    qrPayload: 'payload',
    parsed: goodQr,
    duplicate: false,
    expectedAmountTHB: 500,
    amountClaimedTHB: null,
    uploadedAt: new Date('2026-09-19T03:10:00.000Z'),
    paymentExpiresAt: new Date('2026-09-20T03:00:00.000Z'),
    bookingCreatedAt: new Date('2026-09-19T03:00:00.000Z'),
    receiverTargets: ['0812345678', '1234556780'],
    provider: null,
    ...overrides,
  };
}

const statusOf = (result: ReturnType<typeof evaluateSlip>, key: string) => result.checks.find((c) => c.key === key)?.status;

describe('evaluateSlip — local evidence only', () => {
  it('never auto-approves without bank-side evidence, however clean the QR', () => {
    const result = evaluateSlip(input({ amountClaimedTHB: 500 }));
    expect(result.status).toBe('plausible');
    expect(result.autoApprove).toBe(false);
    expect(statusOf(result, 'bank_found')).toBe('skip');
  });

  it('is unreadable when no QR was decoded', () => {
    const result = evaluateSlip(input({ qrPayload: null, parsed: null }));
    expect(result.status).toBe('unreadable');
    expect(result.autoApprove).toBe(false);
  });

  it('is unreadable, not suspicious, for a non-slip QR', () => {
    const result = evaluateSlip(input({ parsed: { ok: false, reason: 'not_slip_qr' } }));
    expect(result.status).toBe('unreadable');
  });

  it('is suspicious on a bad CRC', () => {
    const parsed: SlipQrParseResult = { ok: true, slip: { ...goodQr.slip, crcValid: false } };
    const result = evaluateSlip(input({ parsed }));
    expect(result.status).toBe('suspicious');
    expect(statusOf(result, 'qr_crc')).toBe('fail');
  });

  it('is suspicious on a reused transaction reference', () => {
    const result = evaluateSlip(input({ duplicate: true }));
    expect(result.status).toBe('suspicious');
    expect(statusOf(result, 'not_duplicate')).toBe('fail');
  });

  it('only warns when the customer-typed amount differs', () => {
    const result = evaluateSlip(input({ amountClaimedTHB: 450 }));
    expect(statusOf(result, 'amount_claimed')).toBe('warn');
    expect(result.status).toBe('plausible');
  });

  it('compares amounts in satang, not floats', () => {
    const result = evaluateSlip(input({ expectedAmountTHB: 0.1 + 0.2, amountClaimedTHB: 0.3 }));
    expect(statusOf(result, 'amount_claimed')).toBe('pass');
  });
});

describe('evaluateSlip — with a bank-side provider', () => {
  const provider = (result: Partial<SlipProviderResult> = {}) => ({ id: 'test', result: { ...bankOk, ...result } });

  it('auto-approves when amount, receiver and time all match', () => {
    const result = evaluateSlip(input({ provider: provider() }));
    expect(result.status).toBe('verified');
    expect(result.autoApprove).toBe(true);
    expect(result.verifiedAmountTHB).toBe(500);
    expect(result.providerId).toBe('test');
  });

  it('flags a transaction the bank does not know', () => {
    const result = evaluateSlip(input({ provider: provider({ found: false }) }));
    expect(result.status).toBe('suspicious');
    expect(result.autoApprove).toBe(false);
  });

  it('flags an underpayment', () => {
    const result = evaluateSlip(input({ provider: provider({ amountTHB: 499.99 }) }));
    expect(statusOf(result, 'bank_amount')).toBe('fail');
    expect(result.autoApprove).toBe(false);
  });

  it('flags a transfer to someone else', () => {
    const result = evaluateSlip(input({ provider: provider({ receiverAccount: 'xxx-x-x9999-x' }) }));
    expect(statusOf(result, 'bank_receiver')).toBe('fail');
    expect(result.status).toBe('suspicious');
  });

  it('flags an old slip made before the booking existed', () => {
    const result = evaluateSlip(input({ provider: provider({ transferredAt: '2026-09-18T03:05:00.000Z' }) }));
    expect(statusOf(result, 'bank_time')).toBe('fail');
  });

  it('flags a missing transfer time rather than assuming it is fine', () => {
    const result = evaluateSlip(input({ provider: provider({ transferredAt: null }) }));
    expect(statusOf(result, 'bank_time')).toBe('fail');
  });

  it('falls back to manual review when the provider is down', () => {
    const result = evaluateSlip(input({ provider: { id: 'test', error: 'provider_unavailable' } }));
    expect(result.status).toBe('plausible');
    expect(result.autoApprove).toBe(false);
  });

  it('holds a verified but late upload for a human', () => {
    const result = evaluateSlip(input({ provider: provider(), paymentExpiresAt: new Date('2026-09-19T03:06:00.000Z') }));
    expect(result.status).toBe('verified');
    expect(result.autoApprove).toBe(false);
  });

  it('still refuses a duplicate even if the bank confirms it', () => {
    const result = evaluateSlip(input({ duplicate: true, provider: provider() }));
    expect(result.autoApprove).toBe(false);
  });
});

describe('maskedAccountMatches', () => {
  it('matches position-wise when lengths agree', () => {
    expect(maskedAccountMatches('xxx-x-x5678-x', '1234556780')).toBe(true);
    expect(maskedAccountMatches('xxx-x-x5678-x', '1234556790')).toBe(false);
  });

  it('falls back to the visible tail across encodings', () => {
    expect(maskedAccountMatches('xxxxxxxxx5678', '0812345678')).toBe(true);
  });

  it('refuses fewer than four visible digits', () => {
    expect(maskedAccountMatches('xxx-x-xxx78-x', '1234567878')).toBe(false);
  });

  it('refuses an empty target', () => {
    expect(maskedAccountMatches('xxx-x-x5678-x', '')).toBe(false);
  });
});
