/**
 * What a shop allows the automatic slip check to do (`shops.slip_auto_mode`).
 *
 * Local QR checks always run: they are free and catch duplicates. The mode only
 * governs the bank-side lookup and whether its answer may mark a booking paid.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export const SLIP_AUTO_MODES = ['off', 'check_only', 'auto_approve'] as const;
export type SlipAutoMode = (typeof SLIP_AUTO_MODES)[number];

/** Column default, and the answer whenever the stored value cannot be read. */
export const DEFAULT_SLIP_AUTO_MODE: SlipAutoMode = 'check_only';

/**
 * Narrow a stored value to a known mode.
 *
 * @param value - Raw column value.
 * @returns The mode, or the default for anything unrecognised — never `auto_approve` by accident.
 */
export function parseSlipAutoMode(value: unknown): SlipAutoMode {
  return SLIP_AUTO_MODES.find((mode) => mode === value) ?? DEFAULT_SLIP_AUTO_MODE;
}

/**
 * Read a shop's mode. Migration 202611020001 may not have run, so a failed read
 * resolves to the default: staff keep approving and nothing is paid unattended.
 *
 * @param client - Supabase client already allowed to read this shop.
 * @param shopId - Shop to read the mode for.
 * @returns The shop's mode.
 */
export async function getSlipAutoMode(client: SupabaseClient, shopId: string): Promise<SlipAutoMode> {
  const { data, error } = await client.from('shops').select('slip_auto_mode').eq('id', shopId).maybeSingle();
  if (error) return DEFAULT_SLIP_AUTO_MODE;
  return parseSlipAutoMode((data as { slip_auto_mode?: unknown } | null)?.slip_auto_mode);
}
