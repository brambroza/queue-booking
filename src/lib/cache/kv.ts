/**
 * Shared cache for hot public reads (LIFF meta / slots / bookable days) and the
 * rate limiter, so a burst of refreshes does not reach Supabase.
 *
 * Layers, in order: per-instance memory → Upstash Redis (REST, optional) → loader.
 * Redis is never allowed to become the next thing that takes booking down:
 * - every call has a short timeout and errors are swallowed (treated as a miss),
 * - after a few errors in a row Redis is skipped for a while (circuit breaker),
 * - without `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` only memory is used.
 *
 * Concurrent misses for the same key share one loader call (coalescing), and a
 * loader failure serves the last good value while it is within its stale window.
 */

type MemoryEntry = { value: unknown; freshUntil: number; staleUntil: number };

const MEMORY_MAX_ENTRIES = 5000;
const REDIS_TIMEOUT_MS = 150;
const BREAKER_THRESHOLD = 5;
const BREAKER_OPEN_MS = 30_000;

const memory = new Map<string, MemoryEntry>();
const inflight = new Map<string, Promise<unknown>>();
let redisFailures = 0;
let redisOpenUntil = 0;

type RedisConfig = { url: string; token: string };

function redisConfig(): RedisConfig | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  return url && token ? { url: url.replace(/\/+$/, ''), token } : null;
}

/** Whether a shared Redis is configured (memory-only otherwise). */
export function isRedisConfigured(): boolean {
  return redisConfig() !== null;
}

function redisAvailable(): RedisConfig | null {
  const config = redisConfig();
  if (!config) return null;
  if (Date.now() < redisOpenUntil) return null;
  return config;
}

function noteRedisResult(ok: boolean) {
  if (ok) {
    redisFailures = 0;
    return;
  }
  redisFailures += 1;
  if (redisFailures >= BREAKER_THRESHOLD) {
    redisOpenUntil = Date.now() + BREAKER_OPEN_MS;
    redisFailures = 0;
    console.error(`[kv] redis failing, skipped for ${BREAKER_OPEN_MS / 1000}s`);
  }
}

/**
 * Run Redis commands as one pipeline. Returns null on any failure (timeout,
 * network, auth, a command error) — callers fall back, they never throw.
 *
 * @param commands - Redis commands, e.g. `[['GET', 'k'], ['EXPIRE', 'k', 60]]`.
 */
export async function redisPipeline(commands: Array<Array<string | number>>): Promise<unknown[] | null> {
  const config = redisAvailable();
  if (!config) return null;
  try {
    const res = await fetch(`${config.url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(commands),
      signal: AbortSignal.timeout(REDIS_TIMEOUT_MS),
      cache: 'no-store',
    });
    if (!res.ok) {
      noteRedisResult(false);
      return null;
    }
    const json = (await res.json()) as Array<{ result?: unknown; error?: string }>;
    if (!Array.isArray(json) || json.some((r) => r?.error)) {
      noteRedisResult(false);
      return null;
    }
    noteRedisResult(true);
    return json.map((r) => r.result ?? null);
  } catch {
    noteRedisResult(false);
    return null;
  }
}

function memoryGet(key: string, now: number): MemoryEntry | null {
  const entry = memory.get(key);
  if (!entry) return null;
  if (entry.staleUntil <= now) {
    memory.delete(key);
    return null;
  }
  return entry;
}

function memorySet(key: string, value: unknown, ttlMs: number, staleMs: number) {
  if (memory.size >= MEMORY_MAX_ENTRIES && !memory.has(key)) {
    // Map keeps insertion order: drop the oldest entry.
    const oldest = memory.keys().next().value;
    if (oldest !== undefined) memory.delete(oldest);
  }
  const now = Date.now();
  memory.set(key, { value, freshUntil: now + ttlMs, staleUntil: now + ttlMs + staleMs });
}

export type CacheOptions = {
  /** Seconds a value is served without asking Redis or the loader again. */
  ttlSeconds: number;
  /** Extra seconds the last good value may be served when the loader fails. Default 5 × ttl. */
  staleSeconds?: number;
  /** Seconds the in-process copy lives (≤ ttl). Default min(ttl, 5). */
  memorySeconds?: number;
};

/**
 * Read-through cache. The loader must return JSON-serialisable data and should
 * throw on failure (a thrown error is never cached).
 *
 * @param key - Cache key; include every input that changes the result.
 * @param options - TTLs.
 * @param loader - Produces the value on a miss (usually the Supabase read).
 */
export async function cached<T>(key: string, options: CacheOptions, loader: () => Promise<T>): Promise<T> {
  const ttlMs = options.ttlSeconds * 1000;
  const staleMs = (options.staleSeconds ?? options.ttlSeconds * 5) * 1000;
  const memoryMs = Math.min(ttlMs, (options.memorySeconds ?? Math.min(options.ttlSeconds, 5)) * 1000);
  const now = Date.now();

  const local = memoryGet(key, now);
  if (local && local.freshUntil > now) return local.value as T;

  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const work = (async () => {
    const remote = await redisPipeline([['GET', `c:${key}`]]);
    const raw = remote?.[0];
    if (typeof raw === 'string') {
      try {
        const value = JSON.parse(raw) as T;
        memorySet(key, value, memoryMs, staleMs);
        return value;
      } catch {
        // Corrupt entry: fall through to the loader, which overwrites it.
      }
    }

    try {
      const value = await loader();
      memorySet(key, value, memoryMs, staleMs);
      // Fire and forget: a slow Redis write must not delay the response.
      void redisPipeline([['SET', `c:${key}`, JSON.stringify(value), 'EX', Math.max(1, options.ttlSeconds)]]);
      return value;
    } catch (error) {
      if (local) {
        console.error(`[kv] loader failed for ${key}, serving stale value`);
        return local.value as T;
      }
      throw error;
    }
  })();

  inflight.set(key, work);
  try {
    return await work;
  } finally {
    inflight.delete(key);
  }
}

/**
 * Drop cached values so the next read goes to the loader. Memory is cleared
 * synchronously; Redis best-effort.
 *
 * @param keys - Exact keys, or prefixes ending with `*` (memory only — Redis
 *   entries under a prefix simply expire with their TTL).
 */
export async function invalidateCache(keys: string[]): Promise<void> {
  const exact: string[] = [];
  for (const key of keys) {
    if (key.endsWith('*')) {
      const prefix = key.slice(0, -1);
      for (const k of Array.from(memory.keys())) if (k.startsWith(prefix)) memory.delete(k);
    } else {
      memory.delete(key);
      exact.push(`c:${key}`);
    }
  }
  if (exact.length > 0) await redisPipeline([['DEL', ...exact]]);
}

/** Test hook: forget every in-process entry and reset the breaker. */
export function resetCacheForTests() {
  memory.clear();
  inflight.clear();
  redisFailures = 0;
  redisOpenUntil = 0;
}
