import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { channelIdFromLiffId, isValidLiffId, normalizeLiffId } from './liff-id';
import { resolveLoginChannelIds } from './verify-id-token';
import { resolveLiffCaller } from './liff-identity';
import { resetCacheForTests } from '@/lib/cache/kv';

// resolveLiffCaller caches a shop's channel ids; each test stubs its own shop.
beforeEach(() => resetCacheForTests());

describe('channelIdFromLiffId', () => {
  it('reads the owning channel from the LIFF id or a pasted LIFF url', () => {
    expect(channelIdFromLiffId('2001234567-AbCdEfGh')).toBe('2001234567');
    expect(channelIdFromLiffId('https://liff.line.me/2001234567-AbCdEfGh')).toBe('2001234567');
  });

  it('returns null for anything that is not a LIFF id', () => {
    for (const v of ['', null, undefined, 'abc', '123-x', '2001234567', 'U' + 'a'.repeat(32)]) expect(channelIdFromLiffId(v)).toBeNull();
  });

  it('keeps the existing helpers consistent', () => {
    expect(normalizeLiffId(' https://liff.line.me/2001234567-AbCdEfGh ')).toBe('2001234567-AbCdEfGh');
    expect(isValidLiffId('2001234567-AbCdEfGh')).toBe(true);
  });
});

describe('resolveLoginChannelIds', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('orders explicit, derived, then env, without duplicates', () => {
    vi.stubEnv('LINE_LOGIN_CHANNEL_ID', '999');
    expect(
      resolveLoginChannelIds({ line_login_channel_id: '111', liff_id_login_shop: '222222222-aaaa', liff_id: '222222222-bbbb' }),
    ).toEqual(['111', '222222222', '999']);
  });

  it('works from the shop\'s LIFF ids alone, with no env var', () => {
    vi.stubEnv('LINE_LOGIN_CHANNEL_ID', '');
    expect(resolveLoginChannelIds({ liff_id: '2001234567-AbCdEfGh' })).toEqual(['2001234567']);
    expect(resolveLoginChannelIds({})).toEqual([]);
    expect(resolveLoginChannelIds(null)).toEqual([]);
  });
});

/** Admin stub returning one shop row. */
function stubAdmin(shop: Record<string, unknown> | null) {
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'eq']) chain[m] = () => chain;
  chain.maybeSingle = async () => ({ data: shop, error: null });
  return { from: () => chain } as unknown as SupabaseClient;
}

describe('resolveLiffCaller with a derived channel id', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  const LINE_USER = 'U' + 'a'.repeat(32);

  it('verifies against the channel read from the shop\'s LIFF id and trusts the token\'s sub', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('LINE_LOGIN_CHANNEL_ID', '');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ sub: LINE_USER }), { status: 200 }));
    const r = await resolveLiffCaller(stubAdmin({ line_login_channel_id: null, liff_id: '2001234567-AbCdEfGh', liff_id_login_shop: null }), 'shop', undefined, 'tok');
    expect(r).toEqual({ ok: true, lineUserId: LINE_USER, verified: true });
    expect(String((fetchSpy.mock.calls[0]?.[1] as RequestInit).body)).toContain('client_id=2001234567');
  });

  it('refuses when LINE rejects the token for every candidate channel', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('LINE_LOGIN_CHANNEL_ID', '999999999');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 400 }));
    const r = await resolveLiffCaller(stubAdmin({ liff_id: '2001234567-AbCdEfGh' }), 'shop', undefined, 'tok');
    expect(r).toMatchObject({ ok: false, status: 401 });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('refuses a token whose sub differs from the claimed user', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ sub: LINE_USER }), { status: 200 }));
    const r = await resolveLiffCaller(stubAdmin({ liff_id: '2001234567-AbCdEfGh' }), 'shop', 'U' + 'b'.repeat(32), 'tok');
    expect(r).toMatchObject({ ok: false, status: 401 });
  });

  it('still refuses in production when the shop has no LIFF id and no env channel', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('LINE_LOGIN_CHANNEL_ID', '');
    vi.stubEnv('LIFF_ID_TOKEN_REQUIRED', '');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const r = await resolveLiffCaller(stubAdmin({}), 'shop', LINE_USER, 'tok');
    expect(r).toMatchObject({ ok: false, status: 401 });
  });
});
