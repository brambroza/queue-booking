/**
 * Server side of the owner LINE link: push an alert to the owner and store the
 * link when the webhook receives a valid code. Service-role client only.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { pushMessage } from '@/lib/line/client';
import { isOwnerLinkCodeValid } from '@/lib/line/owner-line';

export type OwnerPushResult = {
  sent: boolean;
  reason?: 'not_linked' | 'no_token' | 'not_migrated' | 'push_failed';
};

type Deps = { push?: typeof pushMessage };

/**
 * Push a plain text message to the shop owner's linked LINE. Never throws.
 * Uses the shop's own channel token only: the owner's user id belongs to that
 * OA's provider, so the platform token could not reach it.
 *
 * @param admin - Service-role client.
 * @param shopId - Shop to alert.
 * @param text - Message (LINE caps text at 5,000 chars).
 */
export async function safePushOwnerLine(admin: SupabaseClient, shopId: string, text: string, deps: Deps = {}): Promise<OwnerPushResult> {
  try {
    const { data, error } = await admin
      .from('shops')
      .select('owner_line_user_id,line_channel_access_token')
      .eq('id', shopId)
      .maybeSingle();
    if (error) return { sent: false, reason: 'not_migrated' };
    const row = data as { owner_line_user_id?: string | null; line_channel_access_token?: string | null } | null;
    if (!row?.owner_line_user_id) return { sent: false, reason: 'not_linked' };
    if (!row.line_channel_access_token) return { sent: false, reason: 'no_token' };
    await (deps.push ?? pushMessage)(row.line_channel_access_token, row.owner_line_user_id, [{ type: 'text', text: text.slice(0, 5000) }]);
    return { sent: true };
  } catch (e) {
    console.error('[owner-line] push failed:', e instanceof Error ? e.message : e);
    return { sent: false, reason: 'push_failed' };
  }
}

export type OwnerLinkOutcome = 'linked' | 'invalid' | 'error';

/**
 * Store the sender as the shop's owner LINE when the code matches. The code is
 * cleared on success so it works once.
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
