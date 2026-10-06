/**
 * Verify a LIFF ID token with LINE and return the LINE user id it proves.
 *
 * The public LIFF routes historically trust a `line_user_id` string sent in the
 * request body, which anyone who knows a shop key and a Uxxxx id can forge. This
 * closes that for the payment routes: only LINE can mint a token whose `sub`
 * matches a real user.
 *
 * Returns null on any failure — callers decide whether that is fatal.
 */
export async function verifyLiffIdToken(idToken: string, channelId: string): Promise<string | null> {
  if (!idToken || !channelId) return null;
  try {
    const res = await fetch('https://api.line.me/oauth2/v2.1/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ id_token: idToken, client_id: channelId }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { sub?: string };
    return json.sub ?? null;
  } catch (e) {
    console.error('[line] id token verify failed:', e instanceof Error ? e.message : e);
    return null;
  }
}

import { channelIdFromLiffId } from './liff-id';

/**
 * Every LINE Login channel id worth trying when verifying a token for a shop,
 * most specific first, without duplicates:
 * 1. the id saved on the shop (`shops.line_login_channel_id`),
 * 2. the channels that own the shop's own LIFF apps (read from the LIFF IDs),
 * 3. the platform-wide `LINE_LOGIN_CHANNEL_ID` for single-channel deployments.
 *
 * Deriving from the LIFF IDs means a shop that has finished LINE setup verifies
 * out of the box. A token is only accepted when LINE confirms it was issued to
 * one of these channels, so another shop's or an attacker's channel never matches.
 */
export function resolveLoginChannelIds(shop?: {
  line_login_channel_id?: string | null;
  liff_id?: string | null;
  liff_id_login_shop?: string | null;
} | null): string[] {
  const ids = [
    shop?.line_login_channel_id?.trim(),
    channelIdFromLiffId(shop?.liff_id_login_shop),
    channelIdFromLiffId(shop?.liff_id),
    process.env.LINE_LOGIN_CHANNEL_ID?.trim(),
  ];
  return Array.from(new Set(ids.filter((v): v is string => Boolean(v))));
}

/**
 * Resolve the LINE Login channel id used to verify tokens for a shop.
 * Falls back to the platform-wide env var so single-channel deployments work.
 */
export function resolveLoginChannelId(shopChannelId?: string | null): string {
  return shopChannelId || process.env.LINE_LOGIN_CHANNEL_ID || '';
}
