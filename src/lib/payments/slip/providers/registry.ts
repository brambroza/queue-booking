import { SLIP_PROVIDER_IDS, type SlipProviderAdapter, type SlipProviderId } from './types';
import { easyslipAdapter } from './easyslip';

const ADAPTERS: Record<SlipProviderId, SlipProviderAdapter> = {
  easyslip: easyslipAdapter,
};

/**
 * Deployment-level kill switch per vendor. Off stops both key sources (the
 * platform key and every shop's own key) without a redeploy.
 */
const AVAILABILITY_ENV: Record<SlipProviderId, { key: string; defaultValue: boolean }> = {
  easyslip: { key: 'SLIP_VERIFY_EASYSLIP_ENABLED', defaultValue: true },
};

function readFlag(key: string, defaultValue: boolean): boolean {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase());
}

export function getSlipProviderAdapter(provider: SlipProviderId): SlipProviderAdapter {
  return ADAPTERS[provider];
}

export function isSlipProviderAvailable(provider: SlipProviderId): boolean {
  const flag = AVAILABILITY_ENV[provider];
  return readFlag(flag.key, flag.defaultValue);
}

export function slipProviderDisplayName(provider: SlipProviderId): string {
  return ADAPTERS[provider].displayName;
}

/** Narrow an unknown value to a SlipProviderId, or null. */
export function parseSlipProviderId(value: unknown): SlipProviderId | null {
  return typeof value === 'string' && (SLIP_PROVIDER_IDS as readonly string[]).includes(value)
    ? (value as SlipProviderId)
    : null;
}

/** Every vendor, in picker order, with its current availability. */
export function listSlipProviders(): Array<{ provider: SlipProviderId; displayName: string; available: boolean }> {
  return SLIP_PROVIDER_IDS.map((provider) => ({
    provider,
    displayName: slipProviderDisplayName(provider),
    available: isSlipProviderAvailable(provider),
  }));
}

/** The platform-wide vendor from `SLIP_VERIFY_PROVIDER`; null when unset, unknown or switched off. */
export function platformSlipProviderId(): SlipProviderId | null {
  const id = parseSlipProviderId((process.env.SLIP_VERIFY_PROVIDER ?? '').trim().toLowerCase());
  return id && isSlipProviderAvailable(id) ? id : null;
}
