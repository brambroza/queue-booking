import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Signed "form opened at" tokens for public forms (signup).
 *
 * The issue time is rendered into the page by the server and signed, so a bot
 * cannot claim it opened the form minutes ago. Too fast = script, too old =
 * replayed token. Stateless: nothing is stored.
 */

export const FORM_TOKEN_MIN_FILL_MS = 3_000;
export const FORM_TOKEN_MAX_AGE_MS = 2 * 60 * 60 * 1000;

export type FormTokenCheck = 'ok' | 'too_fast' | 'expired' | 'bad' | 'no_secret';

function secret(): string {
  return process.env.FORM_TOKEN_SECRET || process.env.PAYMENT_LINK_SECRET || '';
}

function sign(key: string, ts: string): string {
  return createHmac('sha256', key).update(`form:${ts}`).digest('hex').slice(0, 32);
}

/**
 * Mint a token for a form rendered now.
 *
 * @param now - Issue time in ms (injectable for tests).
 * @returns `<ts>.<hmac>`, or '' when no secret is configured.
 */
export function issueFormToken(now = Date.now()): string {
  const key = secret();
  if (!key) return '';
  const ts = String(Math.floor(now));
  return `${ts}.${sign(key, ts)}`;
}

/**
 * Check a submitted token.
 *
 * Without a secret, development accepts anything (`ok`) and production
 * reports `no_secret` so the caller can fail closed.
 *
 * @param token - Value of the hidden `form_token` field.
 * @param now - Submit time in ms (injectable for tests).
 */
export function checkFormToken(token: string | null | undefined, now = Date.now()): FormTokenCheck {
  const key = secret();
  if (!key) return process.env.NODE_ENV === 'production' ? 'no_secret' : 'ok';

  const [ts, mac, extra] = (token ?? '').split('.');
  if (!ts || !mac || extra !== undefined || !/^\d{1,16}$/.test(ts)) return 'bad';

  const expected = Buffer.from(sign(key, ts));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return 'bad';

  const elapsed = now - Number(ts);
  if (elapsed < FORM_TOKEN_MIN_FILL_MS) return 'too_fast';
  if (elapsed > FORM_TOKEN_MAX_AGE_MS) return 'expired';
  return 'ok';
}
