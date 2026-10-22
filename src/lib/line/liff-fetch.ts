/**
 * fetch for LIFF calls at a booking rush: a 429 / 503 / network error waits
 * and retries by itself instead of making the customer press refresh (which
 * reloads the whole page and multiplies the load). Each wait grows and is
 * jittered so phones do not retry in lockstep.
 */

/** Statuses that mean "busy, try again shortly". */
const RETRY_STATUSES = new Set([429, 502, 503, 504]);

export type BusyRetryOptions = {
  /** Retries after the first attempt. */
  retries?: number;
  /** Called before each wait with the seconds about to be waited. */
  onWait?: (seconds: number, attempt: number) => void;
  /** Extra codes in a JSON body that also mean "retry" (e.g. a still-running duplicate submit). */
  retryCodes?: string[];
  /** Injected for tests. */
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
};

/**
 * Wait before retry `attempt` (0-based): the server's `retry_after` (or 2s)
 * doubled per attempt, capped at 15s, plus up to 50% jitter.
 *
 * @param attempt - 0 for the first retry.
 * @param retryAfterSeconds - Server hint, if any.
 * @param random - Injected for tests.
 */
export function busyRetryDelayMs(attempt: number, retryAfterSeconds: number | null, random: () => number = Math.random): number {
  const base = Math.max(1, retryAfterSeconds ?? 2) * 1000;
  const backoff = Math.min(15_000, base * 2 ** attempt);
  return Math.round(backoff * (1 + random() * 0.5));
}

function retryAfterOf(res: Response, body: unknown): number | null {
  const fromBody = (body as { retry_after?: unknown } | null)?.retry_after;
  if (typeof fromBody === 'number' && Number.isFinite(fromBody)) return fromBody;
  const header = Number(res.headers.get('Retry-After'));
  return Number.isFinite(header) && header > 0 ? header : null;
}

/**
 * fetch + JSON with automatic busy retries. Resolves with the last response and
 * its parsed body (`{}` when the body was not JSON). Rejects only when every
 * attempt failed at the network level.
 *
 * @param input - URL.
 * @param init - fetch options; the body must be re-sendable (a string).
 * @param options - Retry behaviour.
 */
export async function fetchJsonWithBusyRetry(
  input: string,
  init: RequestInit | undefined,
  options: BusyRetryOptions = {},
): Promise<{ res: Response; json: Record<string, unknown> }> {
  const retries = options.retries ?? 4;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const random = options.random ?? Math.random;

  for (let attempt = 0; ; attempt += 1) {
    let res: Response | null = null;
    let json: Record<string, unknown> = {};
    try {
      res = await fetch(input, init);
      json = ((await res.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
    } catch (error) {
      if (attempt >= retries) throw error;
    }

    const busy =
      !res ||
      RETRY_STATUSES.has(res.status) ||
      (typeof json.code === 'string' && (options.retryCodes ?? []).includes(json.code));
    if (!busy && res) return { res, json };
    if (attempt >= retries) {
      if (res) return { res, json };
    }

    const delay = busyRetryDelayMs(attempt, res ? retryAfterOf(res, json) : null, random);
    options.onWait?.(Math.ceil(delay / 1000), attempt);
    await sleep(delay);
  }
}
