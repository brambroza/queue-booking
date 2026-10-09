/**
 * Shared contract for bank-side slip verification adapters.
 *
 * One adapter per vendor (an aggregator today, a bank's own API later). The
 * evaluation rules in ../evaluate.ts never import an adapter — they only see
 * the vendor-neutral `SlipProviderResult` from ../provider.ts.
 */
import type { SlipProviderResult } from '../provider';

export { pickAmount, pickString, sanitizeRaw } from '@/lib/payments/deeplink/types';

export const SLIP_PROVIDER_IDS = ['easyslip'] as const;
export type SlipProviderId = (typeof SLIP_PROVIDER_IDS)[number];

/** Whose API key answered: the shop's own, or the platform-wide one. */
export type SlipProviderSource = 'shop' | 'platform';

/**
 * A resolved, decrypted configuration. Server-only: `credentials` holds the raw
 * vendor key and must never reach a response or a log line.
 */
export interface SlipProviderConfig {
  provider: SlipProviderId;
  source: SlipProviderSource;
  /** Row id for a shop key, the literal 'platform' for the env key. Logs and cache keys only. */
  configId: string;
  /** Adapter-owned shape, already validated by `adapter.parseCredentials`. */
  credentials: unknown;
}

export interface SlipProviderAdapter {
  readonly id: SlipProviderId;
  /** Vendor name shown to shop owners, e.g. "EasySlip". */
  readonly displayName: string;
  /** Validate the credential JSON entered in the portal. Throws on invalid input. */
  parseCredentials(input: unknown): unknown;
  /** Last characters of the key, for a masked "configured (…abcd)" hint. */
  credentialsHint(credentials: unknown): string;
  /** Ask the vendor about one slip, by its decoded QR payload. Throws `SlipProviderError` on transport/auth failures. */
  verify(config: SlipProviderConfig, input: { payload: string; transRef: string }): Promise<SlipProviderResult>;
  /** Portal "test connection" — must use a call that does not spend verification quota where the vendor offers one. */
  testConnection(config: SlipProviderConfig): Promise<{ ok: true; detail?: string }>;
}

export type SlipProviderErrorCode =
  | 'invalid_api_key'
  | 'quota_exceeded'
  | 'rate_limited'
  | 'timeout'
  | 'bad_response'
  | 'http_error';

/**
 * Raised for any upstream failure. Carries a code and HTTP status only — never
 * the vendor's response body — so it is safe to log and to show an owner.
 */
export class SlipProviderError extends Error {
  readonly code: SlipProviderErrorCode;
  readonly httpStatus: number | null;

  constructor(code: SlipProviderErrorCode, httpStatus: number | null = null) {
    super(`slip provider ${code}${httpStatus ? ` (HTTP ${httpStatus})` : ''}`);
    this.name = 'SlipProviderError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

/** Failures worth a later retry: the vendor may recover, quota may be topped up. */
export function isRetryableProviderError(code: SlipProviderErrorCode): boolean {
  return code !== 'invalid_api_key';
}

export const SLIP_PROVIDER_TIMEOUT_MS = 8_000;

/**
 * `fetch` with a hard deadline. An aborted call surfaces as
 * `SlipProviderError('timeout')`; any other network failure as `http_error`.
 */
export async function fetchWithTimeout(url: string, init: RequestInit, ms = SLIP_PROVIDER_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw new SlipProviderError('timeout');
    throw new SlipProviderError('http_error');
  } finally {
    clearTimeout(timer);
  }
}
