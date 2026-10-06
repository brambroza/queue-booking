import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveLoginChannelIds, verifyLiffIdToken } from './verify-id-token';

export type LiffIdentityResult =
  | { ok: true; lineUserId: string; verified: boolean }
  | { ok: false; status: number; error: string };

const AUTH_FAILED = 'ยืนยันตัวตนไม่สำเร็จ กรุณาเปิดหน้านี้ผ่าน LINE อีกครั้ง';

/** LINE user ids are "U" + 32 hex characters. */
const LINE_USER_ID_RE = /^U[0-9a-f]{32}$/i;

/**
 * Whether a missing or unverifiable ID token must be refused.
 *
 * On by default in production. `LIFF_ID_TOKEN_REQUIRED=false` is an explicit,
 * temporary escape hatch for a staged rollout; development defaults to off so
 * local flows without LINE keep working.
 */
export function isLiffTokenRequired(): boolean {
  const flag = (process.env.LIFF_ID_TOKEN_REQUIRED ?? '').trim().toLowerCase();
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  return process.env.NODE_ENV === 'production';
}

/**
 * Establish which LINE user is calling a public LIFF route.
 *
 * The LIFF ID token (`liff.getIDToken()`) is verified with LINE against the
 * shop's LINE Login channel (or the platform `LINE_LOGIN_CHANNEL_ID`). Its `sub`
 * is the only identity trusted; a `line_user_id` in the body must match it.
 *
 * When tokens are not required (dev / explicit rollout flag) and none can be
 * verified, the claimed id is accepted but flagged `verified: false`.
 *
 * @param admin - Service-role client.
 * @param shopId - Shop the route is acting for.
 * @param claimedLineUserId - `line_user_id` from the request body, if any.
 * @param idToken - LIFF ID token from the request body, if any.
 */
export async function resolveLiffCaller(
  admin: SupabaseClient,
  shopId: string,
  claimedLineUserId: string | null | undefined,
  idToken: string | null | undefined,
): Promise<LiffIdentityResult> {
  const claimed = (claimedLineUserId ?? '').trim();
  const required = isLiffTokenRequired();

  const full = await admin
    .from('shops')
    .select('line_login_channel_id,liff_id,liff_id_login_shop')
    .eq('id', shopId)
    .maybeSingle();
  // `line_login_channel_id` ships in migration 202608230001; without it the LIFF ids are still enough.
  const shopAuth = full.error
    ? (await admin.from('shops').select('liff_id,liff_id_login_shop').eq('id', shopId).maybeSingle()).data
    : full.data;
  const channelIds = resolveLoginChannelIds(shopAuth as Parameters<typeof resolveLoginChannelIds>[0]);

  if (channelIds.length > 0 && idToken) {
    let sub: string | null = null;
    for (const channelId of channelIds) {
      sub = await verifyLiffIdToken(idToken, channelId);
      if (sub) break;
    }
    if (sub && (!claimed || claimed === sub)) return { ok: true, lineUserId: sub, verified: true };
    // Distinguishes "LINE rejected the token" (usually a wrong LINE Login channel id)
    // from "token is fine but belongs to another user" in the server log.
    console.error(
      sub
        ? `[liff-identity] token sub does not match the claimed line_user_id for shop ${shopId}`
        : `[liff-identity] LINE rejected the ID token for shop ${shopId} (tried channels ${channelIds.join(', ')}) — check that one of them owns the LIFF app`,
    );
    return { ok: false, status: 401, error: AUTH_FAILED };
  }

  if (required) {
    if (channelIds.length === 0) console.error('[liff-identity] no LINE Login channel id for shop', shopId, '— refusing (save the shop\'s LIFF ID in LINE settings, or set LINE_LOGIN_CHANNEL_ID)');
    return { ok: false, status: 401, error: AUTH_FAILED };
  }

  if (!LINE_USER_ID_RE.test(claimed)) return { ok: false, status: 400, error: 'Invalid payload' };
  return { ok: true, lineUserId: claimed, verified: false };
}
