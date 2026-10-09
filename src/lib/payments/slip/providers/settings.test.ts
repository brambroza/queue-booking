import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

const getSubscriptionState = vi.fn();
vi.mock('@/lib/subscription/enforcement', () => ({ getSubscriptionState: (...args: unknown[]) => getSubscriptionState(...args) }));

process.env.PAYMENT_CREDENTIALS_KEY = 'test-seed-for-secret-box';

const { paymentSecretBox } = await import('@/lib/crypto/secret-box');
const { resolveSlipProviderSource, toShopConfig, platformSlipConfig } = await import('./settings');

type Row = { id: string; provider: string; enabled: boolean; credentials_enc: string | null; credentials_hint: string | null; last_test_at: null; last_test_ok: null };

/** Minimal chainable stub for `.from(table).select().eq().eq().order()`. */
function fakeAdmin(rows: Row[] | Error): SupabaseClient {
  const result = rows instanceof Error ? { data: null, error: { message: rows.message } } : { data: rows, error: null };
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'order']) chain[m] = () => chain;
  chain.then = (resolve: (v: unknown) => void) => resolve(result);
  return { from: () => chain } as unknown as SupabaseClient;
}

function sealed(apiKey: string): string {
  return paymentSecretBox().seal(JSON.stringify({ apiKey }));
}

const row = (overrides: Partial<Row> = {}): Row => ({
  id: 'row-1',
  provider: 'easyslip',
  enabled: true,
  credentials_enc: sealed('shop-key-1234567890abcd'),
  credentials_hint: 'abcd',
  last_test_at: null,
  last_test_ok: null,
  ...overrides,
});

beforeEach(() => {
  getSubscriptionState.mockReset();
  getSubscriptionState.mockResolvedValue({ active: true, downgraded: false, planCode: 'professional', limits: {} });
  process.env.SLIP_VERIFY_PROVIDER = 'easyslip';
  process.env.EASYSLIP_API_KEY = 'platform-key-1234567890';
  delete process.env.SLIP_VERIFY_EASYSLIP_ENABLED;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  delete process.env.SLIP_VERIFY_PROVIDER;
  delete process.env.EASYSLIP_API_KEY;
  delete process.env.SLIP_VERIFY_EASYSLIP_ENABLED;
});

describe('resolveSlipProviderSource', () => {
  it('prefers the shop key over the platform key, on any plan', async () => {
    getSubscriptionState.mockResolvedValue({ active: true, downgraded: false, planCode: 'starter', limits: {} });
    const resolved = await resolveSlipProviderSource(fakeAdmin([row()]), 'shop-1');
    expect(resolved.source).toBe('shop');
    if (resolved.source === 'shop') {
      expect(resolved.config.configId).toBe('row-1');
      expect((resolved.config.credentials as { apiKey: string }).apiKey).toBe('shop-key-1234567890abcd');
    }
  });

  it('falls back to the platform key for a paid plan', async () => {
    const resolved = await resolveSlipProviderSource(fakeAdmin([row({ enabled: false })]), 'shop-1');
    expect(resolved.source).toBe('platform');
    if (resolved.source === 'platform') expect((resolved.config.credentials as { apiKey: string }).apiKey).toBe('platform-key-1234567890');
  });

  it('locks the platform key behind the plan', async () => {
    getSubscriptionState.mockResolvedValue({ active: true, downgraded: true, planCode: 'starter', limits: {} });
    const resolved = await resolveSlipProviderSource(fakeAdmin([]), 'shop-1');
    expect(resolved).toEqual({ source: 'none', reason: 'plan_locked', planCode: 'starter' });
  });

  it('reports not_configured when there is no platform key either', async () => {
    delete process.env.EASYSLIP_API_KEY;
    const resolved = await resolveSlipProviderSource(fakeAdmin([]), 'shop-1');
    expect(resolved).toMatchObject({ source: 'none', reason: 'not_configured' });
  });

  it('skips a shop row that no longer decrypts and falls through', async () => {
    const resolved = await resolveSlipProviderSource(fakeAdmin([row({ credentials_enc: 'v1.garbage' })]), 'shop-1');
    expect(resolved.source).toBe('platform');
  });

  it('survives a missing table (migration not applied yet)', async () => {
    const resolved = await resolveSlipProviderSource(fakeAdmin(new Error('relation does not exist')), 'shop-1');
    expect(resolved.source).toBe('platform');
  });

  it('is fully off when the vendor kill switch is off', async () => {
    process.env.SLIP_VERIFY_EASYSLIP_ENABLED = 'false';
    const resolved = await resolveSlipProviderSource(fakeAdmin([row()]), 'shop-1');
    expect(resolved).toMatchObject({ source: 'none', reason: 'not_configured' });
  });
});

describe('toShopConfig / platformSlipConfig', () => {
  it('returns a disabled row only when asked', () => {
    const r = row({ enabled: false });
    expect(toShopConfig(r, { includeDisabled: false })).toBeNull();
    expect(toShopConfig(r, { includeDisabled: true })?.source).toBe('shop');
  });

  it('rejects a malformed platform key', () => {
    process.env.EASYSLIP_API_KEY = 'short';
    expect(platformSlipConfig()).toBeNull();
  });
});
