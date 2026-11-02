/**
 * Server side of the owner LINE link: push an alert to the owner and store the
 * link when a webhook receives a valid code. Service-role client only.
 *
 * Two independent links, because a LINE user id is per provider:
 * - platform: owner is a friend of the QueueBooking OA (env token), linked by a
 *   super_admin from /portal/shop-subscriptions → `/api/line/webhook/platform`
 * - shop: owner is a friend of the shop's own OA (shop token), linked by the
 *   owner from /portal/line-settings → `/api/line/webhook/[shopKey]`
 * Alerts go to the platform link first and fall back to the shop link.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { pushMessage } from '@/lib/line/client';
import { normalizeBasicId } from '@/lib/line/customer-guide';
import { hashOwnerLinkCode, isOwnerLinkCodeValid } from '@/lib/line/owner-line';

export type OwnerLineChannel = 'platform' | 'shop';

export type OwnerPushResult = {
  sent: boolean;
  channel?: OwnerLineChannel;
  reason?: 'not_linked' | 'no_token' | 'not_migrated' | 'push_failed';
};

type Deps = { push?: typeof pushMessage; platformToken?: string };

/** QueueBooking OA token from env, or '' when not configured. */
export function platformLineToken(): string {
  return process.env.LINE_CHANNEL_ACCESS_TOKEN ?? '';
}

type OwnerTargets = {
  platform_line_user_id?: string | null;
  owner_line_user_id?: string | null;
  line_channel_access_token?: string | null;
};

/** Read both links; each column set is optional so one missing migration does not hide the other. */
async function loadOwnerTargets(admin: SupabaseClient, shopId: string): Promise<OwnerTargets | null> {
  const [platform, shop] = await Promise.all([
    admin.from('shops').select('platform_line_user_id').eq('id', shopId).maybeSingle(),
    admin.from('shops').select('owner_line_user_id,line_channel_access_token').eq('id', shopId).maybeSingle(),
  ]);
  if (platform.error && shop.error) return null;
  return {
    ...(platform.error ? {} : (platform.data as OwnerTargets | null) ?? {}),
    ...(shop.error ? {} : (shop.data as OwnerTargets | null) ?? {}),
  };
}

/**
 * Push a plain text message to the shop owner's linked LINE. Never throws.
 * Platform OA first; the shop's OA when the platform link is missing or fails.
 *
 * @param admin - Service-role client.
 * @param shopId - Shop to alert.
 * @param text - Message (LINE caps text at 5,000 chars).
 * @param opts.only - Restrict to one channel (the test buttons).
 */
export async function safePushOwnerLine(
  admin: SupabaseClient,
  shopId: string,
  text: string,
  deps: Deps & { only?: OwnerLineChannel } = {},
): Promise<OwnerPushResult> {
  const push = deps.push ?? pushMessage;
  const message = [{ type: 'text', text: text.slice(0, 5000) }];
  try {
    const targets = await loadOwnerTargets(admin, shopId);
    if (!targets) return { sent: false, reason: 'not_migrated' };

    let last: OwnerPushResult = { sent: false, reason: 'not_linked' };
    if (deps.only !== 'shop' && targets.platform_line_user_id) {
      const token = deps.platformToken ?? platformLineToken();
      if (!token) {
        last = { sent: false, channel: 'platform', reason: 'no_token' };
      } else {
        try {
          await push(token, targets.platform_line_user_id, message);
          return { sent: true, channel: 'platform' };
        } catch (e) {
          console.error('[owner-line] platform push failed:', e instanceof Error ? e.message : e);
          last = { sent: false, channel: 'platform', reason: 'push_failed' };
        }
      }
    }
    if (deps.only !== 'platform' && targets.owner_line_user_id) {
      if (!targets.line_channel_access_token) return { sent: false, channel: 'shop', reason: 'no_token' };
      try {
        await push(targets.line_channel_access_token, targets.owner_line_user_id, message);
        return { sent: true, channel: 'shop' };
      } catch (e) {
        console.error('[owner-line] shop push failed:', e instanceof Error ? e.message : e);
        return { sent: false, channel: 'shop', reason: 'push_failed' };
      }
    }
    return last;
  } catch (e) {
    console.error('[owner-line] push failed:', e instanceof Error ? e.message : e);
    return { sent: false, reason: 'push_failed' };
  }
}

export type OwnerLinkOutcome = 'linked' | 'invalid' | 'error';

/**
 * Store the sender as the shop's owner LINE (shop OA) when the code matches.
 * The code is cleared on success so it works once.
 *
 * @param admin - Service-role client.
 * @param shopId - Shop whose webhook received the message.
 * @param args.userId - LINE user id of the sender.
 * @param args.code - Code parsed from the message.
 * @param args.displayName - Sender's LINE display name, if known.
 */
export async function linkOwnerLineFromCode(
  admin: SupabaseClient,
  shopId: string,
  args: { userId: string; code: string; displayName: string | null; now?: Date },
): Promise<OwnerLinkOutcome> {
  const now = args.now ?? new Date();
  try {
    const { data, error } = await admin
      .from('shops')
      .select('owner_line_link_code_hash,owner_line_link_code_expires_at')
      .eq('id', shopId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const row = data as { owner_line_link_code_hash?: string | null; owner_line_link_code_expires_at?: string | null } | null;
    if (!isOwnerLinkCodeValid(args.code, row?.owner_line_link_code_hash, row?.owner_line_link_code_expires_at, now)) return 'invalid';

    const { error: updateError } = await admin
      .from('shops')
      .update({
        owner_line_user_id: args.userId,
        owner_line_display_name: args.displayName,
        owner_line_linked_at: now.toISOString(),
        owner_line_link_code_hash: null,
        owner_line_link_code_expires_at: null,
      })
      .eq('id', shopId)
      // Only the row that still holds this code: two sends of the same code link once.
      .eq('owner_line_link_code_hash', row!.owner_line_link_code_hash!);
    if (updateError) throw new Error(updateError.message);
    return 'linked';
  } catch (e) {
    console.error('[owner-line] link failed:', e instanceof Error ? e.message : e);
    return 'error';
  }
}

/**
 * Platform OA: find the shop by code hash (no shop in the URL) and store the
 * sender as its owner LINE. Expired or unknown codes are `invalid`.
 *
 * @param admin - Service-role client.
 * @param args.userId - LINE user id of the sender (platform provider).
 * @param args.code - Code parsed from the message.
 * @param args.displayName - Sender's LINE display name, if known.
 * @returns Outcome plus the linked shop's name for the reply.
 */
export async function linkPlatformLineFromCode(
  admin: SupabaseClient,
  args: { userId: string; code: string; displayName: string | null; now?: Date },
): Promise<{ outcome: OwnerLinkOutcome; shopName?: string }> {
  const now = args.now ?? new Date();
  try {
    const hash = hashOwnerLinkCode(args.code);
    const { data, error } = await admin
      .from('shops')
      .select('id,name,platform_line_link_code_hash,platform_line_link_code_expires_at')
      .eq('platform_line_link_code_hash', hash)
      .eq('is_deleted', false)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const row = data as {
      id: string;
      name?: string | null;
      platform_line_link_code_hash?: string | null;
      platform_line_link_code_expires_at?: string | null;
    } | null;
    if (!row || !isOwnerLinkCodeValid(args.code, row.platform_line_link_code_hash, row.platform_line_link_code_expires_at, now)) {
      return { outcome: 'invalid' };
    }

    const { error: updateError } = await admin
      .from('shops')
      .update({
        platform_line_user_id: args.userId,
        platform_line_display_name: args.displayName,
        platform_line_linked_at: now.toISOString(),
        platform_line_link_code_hash: null,
        platform_line_link_code_expires_at: null,
      })
      .eq('id', row.id)
      .eq('platform_line_link_code_hash', hash);
    if (updateError) throw new Error(updateError.message);
    return { outcome: 'linked', shopName: row.name ?? undefined };
  } catch (e) {
    console.error('[owner-line] platform link failed:', e instanceof Error ? e.message : e);
    return { outcome: 'error' };
  }
}

/**
 * Basic id (e.g. "@queuebooking") of an OA, or null on any failure.
 *
 * @param token - Channel access token of that OA.
 */
export async function fetchOaBasicId(token: string | null | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const res = await fetch('https://api.line.me/v2/bot/info', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const info = (await res.json()) as { basicId?: string };
    return normalizeBasicId(info.basicId);
  } catch {
    return null;
  }
}

/**
 * LINE display name of a user as seen by an OA, or null.
 *
 * @param token - Channel access token of that OA.
 * @param userId - LINE user id.
 */
export async function fetchLineDisplayName(token: string, userId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.line.me/v2/bot/profile/${encodeURIComponent(userId)}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    return ((await res.json()) as { displayName?: string }).displayName ?? null;
  } catch {
    return null;
  }
}
