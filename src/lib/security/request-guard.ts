import { isRedisConfigured, redisPipeline } from '@/lib/cache/kv';

/**
 * Load shedding and duplicate-submit protection for write routes under a
 * booking rush. Both use Redis when configured and per-instance memory when it
 * is missing or failing — never the database they are protecting.
 */

const memoryCounters = new Map<string, number>();

/** Seconds a held seat lives if the request dies without releasing it. */
const SEAT_TTL_SECONDS = 30;

export type Seat = { release: () => Promise<void> } | null;

/**
 * Take one of `max` concurrent seats under `key`. Returns null when all are
 * taken — the caller answers 503 `busy` and the client retries after a pause,
 * so the database never sees more than `max` bookings in flight for a shop.
 *
 * @param key - Scope, e.g. `book:<shopId>`.
 * @param max - Seats available.
 */
export async function acquireSeat(key: string, max: number): Promise<Seat> {
  const redisKey = `seat:${key}`;
  if (isRedisConfigured()) {
    const result = await redisPipeline([
      ['INCR', redisKey],
      ['EXPIRE', redisKey, SEAT_TTL_SECONDS],
    ]);
    const held = Number(result?.[0]);
    if (result && Number.isFinite(held)) {
      const release = async () => {
        await redisPipeline([['DECR', redisKey]]);
      };
      if (held > max) {
        await release();
        return null;
      }
      return { release };
    }
    // Redis failed: fall through to the instance-local counter.
  }

  const held = (memoryCounters.get(redisKey) ?? 0) + 1;
  if (held > max) return null;
  memoryCounters.set(redisKey, held);
  return {
    release: async () => {
      const left = (memoryCounters.get(redisKey) ?? 1) - 1;
      if (left <= 0) memoryCounters.delete(redisKey);
      else memoryCounters.set(redisKey, left);
    },
  };
}

const memoryIdempotency = new Map<string, { value: string; expiresAt: number }>();
const IDEMPOTENCY_TTL_SECONDS = 600;
const PENDING = 'pending';

export type IdempotencyClaim =
  | { state: 'new' }
  | { state: 'pending' }
  | { state: 'done'; response: unknown };

/**
 * Claim an idempotency key for one submit. `new` = go ahead; `pending` = the
 * same submit is still running (double tap / client retry); `done` = it already
 * finished, replay `response` instead of booking again.
 *
 * @param key - Scoped key, e.g. `book:<shopId>:<client key>`.
 */
export async function claimIdempotencyKey(key: string): Promise<IdempotencyClaim> {
  const redisKey = `idem:${key}`;
  if (isRedisConfigured()) {
    const result = await redisPipeline([
      ['SET', redisKey, PENDING, 'NX', 'EX', IDEMPOTENCY_TTL_SECONDS],
      ['GET', redisKey],
    ]);
    if (result) {
      if (result[0] === 'OK') return { state: 'new' };
      return parseClaim(result[1]);
    }
  }

  const now = Date.now();
  const existing = memoryIdempotency.get(redisKey);
  if (existing && existing.expiresAt > now) return parseClaim(existing.value);
  if (memoryIdempotency.size > 10_000) memoryIdempotency.clear();
  memoryIdempotency.set(redisKey, { value: PENDING, expiresAt: now + IDEMPOTENCY_TTL_SECONDS * 1000 });
  return { state: 'new' };
}

function parseClaim(value: unknown): IdempotencyClaim {
  if (typeof value !== 'string' || value === PENDING) return { state: 'pending' };
  try {
    return { state: 'done', response: JSON.parse(value) };
  } catch {
    return { state: 'pending' };
  }
}

/**
 * Finish a claimed key: store the success body for replay, or drop the claim on
 * failure so the customer can try again.
 *
 * @param key - Same key passed to `claimIdempotencyKey`.
 * @param response - Success body, or null to release the key.
 */
export async function settleIdempotencyKey(key: string, response: unknown | null): Promise<void> {
  const redisKey = `idem:${key}`;
  if (response === null) {
    memoryIdempotency.delete(redisKey);
    if (isRedisConfigured()) await redisPipeline([['DEL', redisKey]]);
    return;
  }
  const value = JSON.stringify(response);
  memoryIdempotency.set(redisKey, { value, expiresAt: Date.now() + IDEMPOTENCY_TTL_SECONDS * 1000 });
  if (isRedisConfigured()) await redisPipeline([['SET', redisKey, value, 'EX', IDEMPOTENCY_TTL_SECONDS]]);
}

/** Test hook. */
export function resetRequestGuardsForTests() {
  memoryCounters.clear();
  memoryIdempotency.clear();
}
