/**
 * Cloudflare Turnstile server-side verification.
 *
 * Fails closed in production: no secret or Cloudflare unreachable = not ok.
 * Outside production an unset secret skips the check so local signup works.
 */

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TIMEOUT_MS = 5_000;

export type TurnstileResult =
  | { ok: true; skipped?: boolean }
  | { ok: false; reason: 'missing_token' | 'rejected' | 'wrong_action' | 'wrong_hostname' | 'unavailable' | 'no_secret' };

type SiteverifyResponse = {
  success?: boolean;
  action?: string;
  hostname?: string;
  'error-codes'?: string[];
};

/** Hostname of NEXT_PUBLIC_APP_URL, or null when unset / unparsable. */
function expectedHostname(): string | null {
  try {
    const url = process.env.NEXT_PUBLIC_APP_URL;
    return url ? new URL(url).hostname : null;
  } catch {
    return null;
  }
}

/**
 * Verify a Turnstile token with Cloudflare.
 *
 * @param input.token - `cf-turnstile-response` from the widget.
 * @param input.ip - Caller IP (from `clientIp`), sent as a hint.
 * @param input.expectedAction - Widget `data-action`; a token minted for another form is refused.
 * @param input.fetchImpl - Injectable fetch for tests.
 */
export async function verifyTurnstile(input: {
  token: string | null | undefined;
  ip?: string;
  expectedAction: string;
  fetchImpl?: typeof fetch;
}): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY ?? '';
  if (!secret) {
    return process.env.NODE_ENV === 'production' ? { ok: false, reason: 'no_secret' } : { ok: true, skipped: true };
  }

  const token = input.token?.trim();
  if (!token || token.length > 2048) return { ok: false, reason: 'missing_token' };

  const body = new URLSearchParams({ secret, response: token });
  if (input.ip && input.ip !== 'unknown') body.set('remoteip', input.ip);

  let data: SiteverifyResponse;
  try {
    const res = await (input.fetchImpl ?? fetch)(SITEVERIFY_URL, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return { ok: false, reason: 'unavailable' };
    data = (await res.json()) as SiteverifyResponse;
  } catch {
    return { ok: false, reason: 'unavailable' };
  }

  if (!data.success) return { ok: false, reason: 'rejected' };
  if (data.action !== input.expectedAction) return { ok: false, reason: 'wrong_action' };

  // Cloudflare's test keys report "example.com"; only enforce against a real app host.
  const host = expectedHostname();
  if (host && host !== 'localhost' && data.hostname && data.hostname !== host && data.hostname !== 'example.com') {
    return { ok: false, reason: 'wrong_hostname' };
  }
  return { ok: true };
}
