/**
 * Seam for a bank-side slip verification source.
 *
 * The slip QR only names a transaction; confirming its amount and receiver
 * needs someone who can see the bank's ledger (a bank slip-verification API or
 * an aggregator). Adapters live in ./providers; this file holds the
 * vendor-neutral result shape that evaluate.ts reasons about and the resolver
 * that picks the key to use for a shop (shop's own → platform → none).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SlipProviderSource } from './providers/types';
import { getSlipProviderAdapter } from './providers/registry';
import { resolveSlipProviderConfig } from './providers/settings';

/** What the bank says about a transaction reference. */
export interface SlipProviderResult {
  /** False when the bank has no such transaction — the slip is fabricated (unless `pending`). */
  found: boolean;
  /** The bank has not posted the transaction yet (e.g. Bangkok Bank shortly after transfer). Never treated as fake. */
  pending: boolean;
  amountTHB: number | null;
  /** Receiver bank account as the provider returns it, usually masked (e.g. "xxx-x-x1234-x"). */
  receiverAccount: string | null;
  /** Receiver PromptPay proxy (phone / national id / e-wallet), masked. Set when the transfer went to a PromptPay id. */
  receiverProxy: string | null;
  receiverName: string | null;
  senderName: string | null;
  /** Sending bank short code as the provider names it, e.g. "KBANK". */
  senderBank: string | null;
  /** ISO timestamp of the transfer. */
  transferredAt: string | null;
  /** Vendor-side duplicate flag. Null when the adapter did not ask. */
  duplicate: boolean | null;
  /** Sanitized vendor echo for the audit JSON — codes, masked ids and amounts only, never personal names. */
  raw: Record<string, unknown> | null;
}

export interface SlipVerificationProvider {
  /** Stable id recorded in the audit trail, e.g. "easyslip". */
  id: string;
  /** Whose key answered. */
  source: SlipProviderSource;
  /** Look a slip up by its decoded QR payload. Throws on transport/auth errors. */
  verify(input: { payload: string; transRef: string }): Promise<SlipProviderResult>;
}

/** The verification source configured for a shop, or null when there is none. */
export async function resolveSlipProvider(
  admin: SupabaseClient,
  shopId: string,
): Promise<SlipVerificationProvider | null> {
  const config = await resolveSlipProviderConfig(admin, shopId);
  if (!config) return null;
  const adapter = getSlipProviderAdapter(config.provider);
  return {
    id: adapter.id,
    source: config.source,
    verify: (input) => adapter.verify(config, input),
  };
}
