/** Page that turns an emailed invite / password link into a password. */
export const ACCEPT_INVITE_PATH = '/auth/accept-invite';

export type InviteLink =
  | { kind: 'session'; accessToken: string; refreshToken: string }
  | { kind: 'error'; code: string }
  | { kind: 'none' };

/**
 * Read what Supabase left in the URL hash after verifying an emailed link.
 *
 * Admin-issued links always come back as implicit-flow tokens, which the PKCE
 * browser client refuses, so the page has to read them itself.
 *
 * @param hash `window.location.hash`, with or without the leading `#`.
 * @returns Tokens for a usable invite / recovery link, the error code of a dead
 *          one, or `none` when the hash is not an auth link at all.
 */
export function parseInviteLink(hash: string): InviteLink {
  const params = new URLSearchParams(hash.replace(/^#/, ''));

  const errorCode = params.get('error_code') ?? params.get('error');
  if (errorCode) return { kind: 'error', code: errorCode };

  const type = params.get('type');
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if ((type === 'invite' || type === 'recovery') && accessToken && refreshToken) {
    return { kind: 'session', accessToken, refreshToken };
  }
  return { kind: 'none' };
}

/**
 * Build the URL Supabase should send people back to from an emailed link.
 *
 * @param appUrl `NEXT_PUBLIC_APP_URL`, used first so a forged Host cannot steer the link.
 * @param requestOrigin Origin of the current request, the fallback when unset.
 */
export function acceptInviteUrl(appUrl: string | undefined, requestOrigin: string): string {
  const base = (appUrl?.trim() || requestOrigin).replace(/\/+$/, '');
  return `${base}${ACCEPT_INVITE_PATH}`;
}
