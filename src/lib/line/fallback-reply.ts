/**
 * Shop switch for the chatbot's fallback reply — the menu the webhook sends
 * when a customer's text matches no intent (`fallbackMessage` in messages.ts).
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Read a shop's fallback-reply toggle without letting a missing column break the caller.
 *
 * `shops.fallback_reply_enabled` ships in migration 202610020001. Until that has
 * run the query errors, and this path is on the webhook — so a failure resolves
 * to the column default (on), which is the behaviour before the switch existed.
 *
 * @param client - Supabase client already scoped to read this shop.
 * @param shopId - Shop to read the flag for.
 * @returns true unless the shop explicitly turned the fallback reply off.
 */
export async function isFallbackReplyEnabled(client: SupabaseClient, shopId: string): Promise<boolean> {
  const { data, error } = await client
    .from('shops')
    .select('fallback_reply_enabled')
    .eq('id', shopId)
    .maybeSingle();
  if (error) return true;
  return (data as { fallback_reply_enabled?: boolean | null } | null)?.fallback_reply_enabled !== false;
}
