/**
 * Which slip verification key serves a shop.
 *
 * Precedence: the shop's own key (any plan) → the platform key from env
 * (Professional and above) → none. The shop row lives in
 * `shop_slip_verify_providers`, sealed like bank deeplink credentials.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { paymentSecretBox } from '@/lib/crypto/secret-box';
import { getSlipVerifyAccess } from '@/lib/subscription/features';
import { getSlipProviderAdapter, isSlipProviderAvailable, parseSlipProviderId, platformSlipProviderId } from './registry';
import type { SlipProviderConfig, SlipProviderId } from './types';

export const SLIP_PROVIDER_TABLE = 'shop_slip_verify_providers';
const COLUMNS = 'id, provider, enabled, credentials_enc, credentials_hint, last_test_at, last_test_ok';

export interface SlipProviderRow {
  id: string;
  provider: string;
  enabled: boolean;
  credentials_enc: string | null;
  credentials_hint: string | null;
  last_test_at: string | null;
  last_test_ok: boolean | null;
}

/** Env var holding the platform key, per vendor. */
const PLATFORM_KEY_ENV: Record<SlipProviderId, string> = {
  easyslip: 'EASYSLIP_API_KEY',
};

export type SlipProviderResolution =
  | { source: 'shop' | 'platform'; provider: SlipProviderId; config: SlipProviderConfig }
  | { source: 'none'; reason: 'plan_locked' | 'not_configured'; planCode: string | null };

/** Every non-deleted row of a shop (one per vendor), newest first. Missing table → empty, never throws. */
export async function loadShopSlipProviderRows(admin: SupabaseClient, shopId: string): Promise<SlipProviderRow[]> {
  const { data, error } = await admin
    .from(SLIP_PROVIDER_TABLE)
    .select(COLUMNS)
    .eq('shop_id', shopId)
    .eq('is_deleted', false)
    .order('updated_at', { ascending: false });
  if (error) {
    console.error('[slip] provider rows fetch error:', error.message);
    return [];
  }
  return (data ?? []) as SlipProviderRow[];
}

/** One vendor's row for a shop, or null. */
export async function loadShopSlipProviderRow(
  admin: SupabaseClient,
  shopId: string,
  provider: SlipProviderId,
): Promise<SlipProviderRow | null> {
  const { data, error } = await admin
    .from(SLIP_PROVIDER_TABLE)
    .select(COLUMNS)
    .eq('shop_id', shopId)
    .eq('provider', provider)
    .eq('is_deleted', false)
    .maybeSingle();
  if (error || !data) return null;
  return data as SlipProviderRow;
}

/**
 * Turn a stored row into a usable config, or null: vendor switched off at
 * deployment level, row disabled (unless `includeDisabled`), no credentials,
 * or credentials that no longer decrypt (rotated key).
 */
export function toShopConfig(row: SlipProviderRow, opts: { includeDisabled: boolean }): SlipProviderConfig | null {
  const provider = parseSlipProviderId(row.provider);
  if (!provider) return null;
  if (!isSlipProviderAvailable(provider)) return null;
  if (!opts.includeDisabled && !row.enabled) return null;
  if (!row.credentials_enc) return null;

  let credentials: unknown;
  try {
    credentials = getSlipProviderAdapter(provider).parseCredentials(JSON.parse(paymentSecretBox().open(row.credentials_enc)));
  } catch {
    // Never log the row — it would carry the ciphertext next to the failure reason.
    console.error(`[slip] credentials for provider ${provider} (row ${row.id}) are unreadable`);
    return null;
  }
  return { provider, source: 'shop', configId: row.id, credentials };
}

/** The platform key as a config, or null when `SLIP_VERIFY_PROVIDER` / its key is unset or switched off. */
export function platformSlipConfig(): SlipProviderConfig | null {
  const provider = platformSlipProviderId();
  if (!provider) return null;
  const raw = (process.env[PLATFORM_KEY_ENV[provider]] ?? '').trim();
  if (!raw) return null;
  let credentials: unknown;
  try {
    credentials = getSlipProviderAdapter(provider).parseCredentials({ apiKey: raw });
  } catch {
    console.error(`[slip] platform key for ${provider} is malformed`);
    return null;
  }
  return { provider, source: 'platform', configId: 'platform', credentials };
}

/** True when a platform key exists and its vendor is switched on. */
export function isPlatformSlipKeyAvailable(): boolean {
  return platformSlipConfig() !== null;
}

/**
 * Decide which key serves a shop and why there is none when there is none.
 * One table read plus the subscription state.
 */
export async function resolveSlipProviderSource(admin: SupabaseClient, shopId: string): Promise<SlipProviderResolution> {
  const rows = await loadShopSlipProviderRows(admin, shopId);
  for (const row of rows) {
    const config = toShopConfig(row, { includeDisabled: false });
    if (config) return { source: 'shop', provider: config.provider, config };
  }

  const platform = platformSlipConfig();
  const access = await getSlipVerifyAccess(shopId);
  if (platform && access.planAllowed) return { source: 'platform', provider: platform.provider, config: platform };
  if (platform) return { source: 'none', reason: 'plan_locked', planCode: access.planCode };
  return { source: 'none', reason: 'not_configured', planCode: access.planCode };
}

/** Convenience for the verification path: the config to call, or null. */
export async function resolveSlipProviderConfig(admin: SupabaseClient, shopId: string): Promise<SlipProviderConfig | null> {
  const resolved = await resolveSlipProviderSource(admin, shopId);
  return resolved.source === 'none' ? null : resolved.config;
}
