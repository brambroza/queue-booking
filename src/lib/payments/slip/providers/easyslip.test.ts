import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { easyslipAdapter } from './easyslip';
import { SlipProviderError, type SlipProviderConfig } from './types';

const config: SlipProviderConfig = {
  provider: 'easyslip',
  source: 'shop',
  configId: 'row-1',
  credentials: { apiKey: 'easyslip-test-key-1234abcd' },
};

const PAYLOAD = '0046000600000101030040220013071152533APM0773651020TH91049C73';
const TRANS_REF = '013071152533APM07736';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function successBody(overrides: Record<string, unknown> = {}) {
  return {
    success: true,
    data: {
      isDuplicate: false,
      rawSlip: {
        payload: PAYLOAD,
        transRef: TRANS_REF,
        date: '2026-10-09T14:30:00+07:00',
        countryCode: 'TH',
        amount: { amount: 500, local: { amount: 500, currency: 'THB' } },
        fee: 0,
        sender: {
          bank: { id: '004', name: 'กสิกรไทย', short: 'KBANK' },
          account: { name: { th: 'นาย ผู้โอน ทดสอบ', en: 'MR. SENDER TEST' }, bank: { type: 'BANKAC', account: '123-4-xxxxx-5' } },
        },
        receiver: {
          bank: { id: '014', name: 'ไทยพาณิชย์', short: 'SCB' },
          account: { name: { th: 'ร้านทดสอบ' }, bank: { type: 'BANKAC', account: 'xxx-x-x5678-x' }, proxy: { type: 'MSISDN', account: 'xxx-xxx-5678' } },
        },
        ...overrides,
      },
    },
    message: 'Bank slip verified successfully',
  };
}

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.EASYSLIP_API_BASE_URL;
});

async function verifyWith(body: unknown, status = 200) {
  fetchMock.mockResolvedValueOnce(jsonResponse(body, status));
  return easyslipAdapter.verify(config, { payload: PAYLOAD, transRef: TRANS_REF });
}

describe('easyslipAdapter.verify', () => {
  it('posts only the payload with a bearer key and checkDuplicate off', async () => {
    await verifyWith(successBody());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.easyslip.com/v2/verify/bank');
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer easyslip-test-key-1234abcd');
    expect(JSON.parse(String(init?.body))).toEqual({ payload: PAYLOAD, checkDuplicate: false });
  });

  it('honours EASYSLIP_API_BASE_URL', async () => {
    process.env.EASYSLIP_API_BASE_URL = 'http://localhost:9999/v2/';
    await verifyWith(successBody());
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:9999/v2/verify/bank');
  });

  it('maps a confirmed slip: amount, time, masked receiver account and proxy, names', async () => {
    const result = await verifyWith(successBody());
    expect(result).toMatchObject({
      found: true,
      pending: false,
      amountTHB: 500,
      transferredAt: '2026-10-09T14:30:00+07:00',
      receiverAccount: 'xxx-x-x5678-x',
      receiverProxy: 'xxx-xxx-5678',
      receiverName: 'ร้านทดสอบ',
      senderName: 'นาย ผู้โอน ทดสอบ',
      senderBank: 'KBANK',
      duplicate: false,
    });
  });

  it('keeps no personal names in the stored echo', async () => {
    const result = await verifyWith(successBody());
    const json = JSON.stringify(result.raw);
    expect(json).not.toContain('ผู้โอน');
    expect(json).not.toContain('SENDER');
    expect(json).toContain('xxx-x-x5678-x');
    expect(json).toContain('KBANK');
  });

  it('refuses an answer about a different transaction reference', async () => {
    await expect(verifyWith(successBody({ transRef: 'OTHER123456' }))).rejects.toMatchObject({ code: 'bad_response' });
  });

  it('treats SLIP_NOT_FOUND as "not found", not as an error', async () => {
    const result = await verifyWith({ success: false, error: { code: 'SLIP_NOT_FOUND', message: 'Slip not found or invalid' } }, 404);
    expect(result).toMatchObject({ found: false, pending: false, amountTHB: null });
  });

  it('treats SLIP_PENDING as pending, never as fake', async () => {
    const result = await verifyWith({ success: false, error: { code: 'SLIP_PENDING', message: 'processing' } }, 404);
    expect(result).toMatchObject({ found: false, pending: true });
  });

  it.each([
    [401, 'INVALID_API_KEY', 'invalid_api_key'],
    [403, 'QUOTA_EXCEEDED', 'quota_exceeded'],
    [403, 'IP_NOT_ALLOWED', 'invalid_api_key'],
    [429, 'RATE_LIMIT_EXCEEDED', 'rate_limited'],
    [400, 'VALIDATION_ERROR', 'bad_response'],
    [500, 'API_SERVER_ERROR', 'http_error'],
  ])('maps HTTP %s %s to %s', async (status, code, expected) => {
    await expect(verifyWith({ success: false, error: { code, message: 'x' } }, status)).rejects.toMatchObject({ code: expected, httpStatus: status });
  });

  it('never leaks the vendor body into the error message', async () => {
    const err = await verifyWith({ success: false, error: { code: 'QUOTA_EXCEEDED', message: 'SECRET-DETAIL' } }, 403).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SlipProviderError);
    expect((err as Error).message).not.toContain('SECRET-DETAIL');
  });

  it('turns an aborted request into a timeout error', async () => {
    fetchMock.mockRejectedValueOnce(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    await expect(easyslipAdapter.verify(config, { payload: PAYLOAD, transRef: TRANS_REF })).rejects.toMatchObject({ code: 'timeout' });
  });

  it('rejects a 200 without rawSlip', async () => {
    await expect(verifyWith({ success: true, data: {} })).rejects.toMatchObject({ code: 'bad_response' });
  });
});

describe('easyslipAdapter.testConnection', () => {
  it('calls /info and reports the remaining quota', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, data: { application: { name: 'Queue', quota: { used: 10, max: 1000, remaining: 990 } } } }));
    const result = await easyslipAdapter.testConnection(config);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.easyslip.com/v2/info');
    expect(fetchMock.mock.calls[0][1]?.method).toBe('GET');
    expect(result.ok).toBe(true);
    expect(result.detail).toContain('990');
  });

  it('reports a bad key', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: false, error: { code: 'INVALID_API_KEY', message: 'x' } }, 401));
    await expect(easyslipAdapter.testConnection(config)).rejects.toMatchObject({ code: 'invalid_api_key' });
  });
});

describe('easyslipAdapter credentials', () => {
  it('rejects short or missing keys', () => {
    expect(() => easyslipAdapter.parseCredentials({ apiKey: 'short' })).toThrow();
    expect(() => easyslipAdapter.parseCredentials({})).toThrow();
  });

  it('hints with the last four characters', () => {
    expect(easyslipAdapter.credentialsHint({ apiKey: 'easyslip-test-key-1234abcd' })).toBe('abcd');
  });
});
