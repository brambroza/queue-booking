/**
 * Seam for a bank-side slip verification source.
 *
 * The slip QR only names a transaction; confirming its amount and receiver
 * needs someone who can see the bank's ledger (a bank slip-verification API or
 * an aggregator). No such source is wired up yet, so `resolveSlipProvider`
 * returns null and every slip stops at "plausible" — see evaluate.ts.
 *
 * TODO(slip-provider): implement an adapter against the chosen vendor's
 * published contract and return it here. Credentials are per shop and must be
 * stored through src/lib/crypto/secret-box.ts, the way bank deeplink
 * credentials are. Do not guess endpoint or field names.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

/** What the bank says about a transaction reference. */
export interface SlipProviderResult {
  /** False when the bank has no such transaction — the slip is fabricated. */
  found: boolean;
  amountTHB: number | null;
  /** Receiver account or PromptPay id as the provider returns it, usually masked (e.g. "xxx-x-x1234-x"). */
  receiverAccount: string | null;
  receiverName: string | null;
  /** ISO timestamp of the transfer. */
  transferredAt: string | null;
}

export interface SlipVerificationProvider {
  /** Stable id recorded in the audit trail, e.g. "easyslip". */
  id: string;
  /** Look a slip up by its decoded QR payload. Throws on transport/auth errors. */
  verify(input: { payload: string; transRef: string }): Promise<SlipProviderResult>;
}

/** The verification source configured for a shop, or null when there is none. */
export async function resolveSlipProvider(
  admin: SupabaseClient,
  shopId: string,
): Promise<SlipVerificationProvider | null> {
  // Parameters are the contract the adapter will need (load + decrypt the shop's key).
  void admin;
  void shopId;
  return null;
}
