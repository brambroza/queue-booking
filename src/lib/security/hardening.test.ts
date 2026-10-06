import crypto from 'crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { escapeLike, escapePostgrestSearch } from '@/lib/utils/postgrest';
import { verifyLineSignature } from '@/lib/line/signature';
import { isCronAuthorized } from '@/lib/cron/auth';
import { signBookingToken, verifyBookingToken } from '@/lib/payments/tokens';
import { isLiffTokenRequired, resolveLiffCaller } from '@/lib/line/liff-identity';
import { escapeHtml } from '@/lib/notifications/sales-email';
import { openOmiseSecretKey, sealOmiseSecretKey } from '@/lib/payments/omise';

const BOOKING = '11111111-2222-3333-4444-555555555555';
const LINE_ID = `U${'a'.repeat(32)}`;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('escapePostgrestSearch', () => {
  it('removes characters that would add PostgREST filter clauses', () => {
    expect(escapePostgrestSearch('a,id.eq.1)')).not.toMatch(/[,()]/);
  });
  it('escapes LIKE wildcards', () => {
    expect(escapePostgrestSearch('50%_off')).toBe('50\\%\\_off');
  });
  it('caps length and handles null', () => {
    expect(escapePostgrestSearch('x'.repeat(500)).length).toBe(100);
    expect(escapePostgrestSearch(null)).toBe('');
  });
  it('escapeLike makes % match literally', () => {
    expect(escapeLike('%')).toBe('\\%');
  });
});

describe('verifyLineSignature', () => {
  const secret = 'channel-secret';
  const body = '{"events":[]}';
  const good = crypto.createHmac('sha256', secret).update(body).digest('base64');

  it('accepts the correct signature', () => {
    expect(verifyLineSignature(secret, body, good)).toBe(true);
  });
  it('rejects a wrong, short or empty signature', () => {
    expect(verifyLineSignature(secret, body, `${good.slice(0, -2)}xx`)).toBe(false);
    expect(verifyLineSignature(secret, body, 'abc')).toBe(false);
    expect(verifyLineSignature(secret, body, '')).toBe(false);
  });
  it('rejects when no secret is configured', () => {
    expect(verifyLineSignature('', body, good)).toBe(false);
  });
});

describe('isCronAuthorized', () => {
  const req = (auth?: string) => new Request('https://x/api/cron', { headers: auth ? { authorization: auth } : {} });

  it('refuses everything when CRON_SECRET is unset', () => {
    vi.stubEnv('CRON_SECRET', '');
    expect(isCronAuthorized(req('Bearer '))).toBe(false);
  });
  it('accepts only the exact bearer', () => {
    vi.stubEnv('CRON_SECRET', 's3cret');
    expect(isCronAuthorized(req('Bearer s3cret'))).toBe(true);
    expect(isCronAuthorized(req('Bearer s3cre'))).toBe(false);
    expect(isCronAuthorized(req())).toBe(false);
  });
});

describe('payment link tokens', () => {
  it('fails closed in production without a secret', () => {
    vi.stubEnv('PAYMENT_LINK_SECRET', '');
    vi.stubEnv('NODE_ENV', 'production');
    expect(verifyBookingToken(BOOKING, '')).toBe(false);
  });
  it('tolerates a missing secret in development', () => {
    vi.stubEnv('PAYMENT_LINK_SECRET', '');
    vi.stubEnv('NODE_ENV', 'development');
    expect(verifyBookingToken(BOOKING, '')).toBe(true);
  });
  it('verifies a signed token and rejects others', () => {
    vi.stubEnv('PAYMENT_LINK_SECRET', 'k');
    const t = signBookingToken(BOOKING);
    expect(verifyBookingToken(BOOKING, t)).toBe(true);
    const tampered = `${t.slice(0, -1)}${t.endsWith('0') ? '1' : '0'}`;
    expect(verifyBookingToken(BOOKING, tampered)).toBe(false);
    expect(verifyBookingToken('99999999-2222-3333-4444-555555555555', t)).toBe(false);
  });
});

/** Minimal admin stub: `shops.line_login_channel_id` lookup only. */
function adminWithChannel(channelId: string | null) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => ({ data: { line_login_channel_id: channelId }, error: null }),
  };
  return { from: () => chain } as unknown as Parameters<typeof resolveLiffCaller>[0];
}

describe('resolveLiffCaller', () => {
  it('is required by default in production', () => {
    vi.stubEnv('LIFF_ID_TOKEN_REQUIRED', '');
    vi.stubEnv('NODE_ENV', 'production');
    expect(isLiffTokenRequired()).toBe(true);
  });

  it('uses the verified sub', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ sub: LINE_ID }), { status: 200 })));
    const r = await resolveLiffCaller(adminWithChannel('123'), 'shop', LINE_ID, 'token');
    expect(r).toEqual({ ok: true, lineUserId: LINE_ID, verified: true });
  });

  it('rejects a claimed id that differs from the token', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ sub: LINE_ID }), { status: 200 })));
    const r = await resolveLiffCaller(adminWithChannel('123'), 'shop', `U${'b'.repeat(32)}`, 'token');
    expect(r.ok).toBe(false);
  });

  it('rejects an invalid token', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 400 })));
    const r = await resolveLiffCaller(adminWithChannel('123'), 'shop', LINE_ID, 'bad');
    expect(r.ok).toBe(false);
  });

  it('refuses a body-only id when tokens are required', async () => {
    vi.stubEnv('LIFF_ID_TOKEN_REQUIRED', 'true');
    const r = await resolveLiffCaller(adminWithChannel('123'), 'shop', LINE_ID, undefined);
    expect(r).toMatchObject({ ok: false, status: 401 });
  });

  it('refuses when no channel is configured and tokens are required', async () => {
    vi.stubEnv('LIFF_ID_TOKEN_REQUIRED', 'true');
    vi.stubEnv('LINE_LOGIN_CHANNEL_ID', '');
    const r = await resolveLiffCaller(adminWithChannel(null), 'shop', LINE_ID, 'token');
    expect(r.ok).toBe(false);
  });

  it('accepts a well-formed claimed id only when tokens are explicitly off', async () => {
    vi.stubEnv('LIFF_ID_TOKEN_REQUIRED', 'false');
    vi.stubEnv('LINE_LOGIN_CHANNEL_ID', '');
    expect(await resolveLiffCaller(adminWithChannel(null), 'shop', LINE_ID, undefined)).toMatchObject({ ok: true, verified: false });
    expect((await resolveLiffCaller(adminWithChannel(null), 'shop', 'not-a-line-id', undefined)).ok).toBe(false);
  });
});

describe('escapeHtml', () => {
  it('neutralises markup in visitor input', () => {
    expect(escapeHtml('<a href="x">hi</a>')).toBe('&lt;a href=&quot;x&quot;&gt;hi&lt;/a&gt;');
  });
});

describe('Omise secret key at rest', () => {
  it('round-trips through the secret box and keeps legacy plain values', () => {
    vi.stubEnv('PAYMENT_CREDENTIALS_KEY', 'test-key');
    const sealed = sealOmiseSecretKey('skey_test_abc');
    expect(sealed.startsWith('v1.')).toBe(true);
    expect(sealed).not.toContain('skey_test_abc');
    expect(openOmiseSecretKey(sealed)).toBe('skey_test_abc');
    expect(openOmiseSecretKey('skey_test_legacy')).toBe('skey_test_legacy');
  });
});
