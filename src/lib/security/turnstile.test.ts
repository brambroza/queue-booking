import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { verifyTurnstile } from './turnstile';

function fakeFetch(body: unknown, status = 200) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
}

describe('verifyTurnstile', () => {
  beforeEach(() => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'secret');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://queue.example.co.th');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('passes a successful token for the right action and host', async () => {
    const fetchImpl = fakeFetch({ success: true, action: 'register', hostname: 'queue.example.co.th' });
    expect(await verifyTurnstile({ token: 'tok', ip: '1.2.3.4', expectedAction: 'register', fetchImpl })).toEqual({ ok: true });
    const [, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const sent = init.body as URLSearchParams;
    expect(sent.get('response')).toBe('tok');
    expect(sent.get('remoteip')).toBe('1.2.3.4');
  });

  it('refuses a missing token without calling Cloudflare', async () => {
    const fetchImpl = fakeFetch({ success: true });
    expect(await verifyTurnstile({ token: '', expectedAction: 'register', fetchImpl })).toEqual({ ok: false, reason: 'missing_token' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('refuses a rejected token', async () => {
    const fetchImpl = fakeFetch({ success: false, 'error-codes': ['invalid-input-response'] });
    expect(await verifyTurnstile({ token: 'tok', expectedAction: 'register', fetchImpl })).toEqual({ ok: false, reason: 'rejected' });
  });

  it('refuses a token minted for another action', async () => {
    const fetchImpl = fakeFetch({ success: true, action: 'login', hostname: 'queue.example.co.th' });
    expect(await verifyTurnstile({ token: 'tok', expectedAction: 'register', fetchImpl })).toEqual({ ok: false, reason: 'wrong_action' });
  });

  it('refuses a token from another hostname', async () => {
    const fetchImpl = fakeFetch({ success: true, action: 'register', hostname: 'evil.test' });
    expect(await verifyTurnstile({ token: 'tok', expectedAction: 'register', fetchImpl })).toEqual({ ok: false, reason: 'wrong_hostname' });
  });

  it('reports unavailable on network error or non-2xx', async () => {
    const throwing = vi.fn(async () => {
      throw new Error('timeout');
    }) as unknown as typeof fetch;
    expect(await verifyTurnstile({ token: 'tok', expectedAction: 'register', fetchImpl: throwing })).toEqual({ ok: false, reason: 'unavailable' });
    expect(await verifyTurnstile({ token: 'tok', expectedAction: 'register', fetchImpl: fakeFetch({}, 500) })).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('without a secret: skipped in development, refused in production', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', '');
    vi.stubEnv('NODE_ENV', 'development');
    expect(await verifyTurnstile({ token: '', expectedAction: 'register' })).toEqual({ ok: true, skipped: true });
    vi.stubEnv('NODE_ENV', 'production');
    expect(await verifyTurnstile({ token: 'tok', expectedAction: 'register' })).toEqual({ ok: false, reason: 'no_secret' });
  });
});
