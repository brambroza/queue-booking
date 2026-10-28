import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { isRedisConfigured, redisPipeline } from '@/lib/cache/kv';

type RateLimit = {
  windowSeconds: number;
  max: number;
  /**
   * Never counted in the database, even when Redis is not configured (falls
   * back to per-instance memory). For limits on burst read paths, where a DB
   * write per hit is exactly the load the limit is there to stop.
   */
  noDb?: boolean;
};

/** Per-route limits for unauthenticated endpoints: hits per window. */
export const RATE_LIMITS = {
  book: { windowSeconds: 600, max: 20 },
  liffProfile: { windowSeconds: 60, max: 60 },
  liffAction: { windowSeconds: 600, max: 30 },
  /** F&B sheet polls order status while open, so it needs headroom a one-off action does not. */
  fnbRead: { windowSeconds: 600, max: 120 },
  /**
   * Loose per-IP ceiling for LIFF routes keyed on the caller's token. Mobile
   * carriers put many customers behind one IP (CGNAT), so the real per-person
   * limit is the token one; this only stops a single host flooding.
   */
  liffIp: { windowSeconds: 60, max: 600, noDb: true },
  /** Public reads that are served from cache (meta, slots, bookable days, payment status). */
  liffRead: { windowSeconds: 60, max: 120, noDb: true },
  register: { windowSeconds: 3600, max: 5 },
  /** Per normalized email (gmail aliases folded) — stops one inbox retrying from rotating IPs. */
  registerEmail: { windowSeconds: 86400, max: 3 },
  contactLead: { windowSeconds: 3600, max: 5 },
  /** Owner "test connection" for the slip verification key — each hit is a vendor call. */
  slipVerifyTest: { windowSeconds: 600, max: 5 },
} as const satisfies Record<string, RateLimit>;

export type RateLimitName = keyof typeof RATE_LIMITS;

/**
 * Best-effort client IP from proxy headers (Vercel sets x-forwarded-for).
 *
 * @param req - Incoming request.
 * @returns The first forwarded address, or 'unknown'.
 */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  return (req.headers.get('x-real-ip') ?? 'unknown').slice(0, 64);
}

/**
 * Rate-limit subject for a LIFF call: a hash of the ID token when one is sent
 * (one per LINE user session, so customers behind the same carrier IP do not
 * share a bucket), otherwise the IP.
 *
 * @param req - Incoming request.
 * @param idToken - LIFF ID token from the body, if any.
 */
export function liffSubject(req: Request, idToken: string | null | undefined): string {
  const token = idToken?.trim();
  if (!token) return clientIp(req);
  return `t:${createHash('sha256').update(token).digest('hex').slice(0, 32)}`;
}

const memoryHits = new Map<string, { windowStart: number; hits: number }>();
const MEMORY_MAX_KEYS = 20_000;

/**
 * Fixed-window counter in process memory. Per serverless instance only, so it
 * is looser than a shared store — used when Redis is missing or failing.
 */
export function hitMemoryLimit(key: string, limit: RateLimit, now = Date.now()): boolean {
  const windowMs = limit.windowSeconds * 1000;
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const entry = memoryHits.get(key);
  if (!entry || entry.windowStart !== windowStart) {
    if (memoryHits.size >= MEMORY_MAX_KEYS) memoryHits.clear();
    memoryHits.set(key, { windowStart, hits: 1 });
    return true;
  }
  entry.hits += 1;
  return entry.hits <= limit.max;
}

async function hitRedisLimit(key: string, limit: RateLimit): Promise<boolean | null> {
  const windowIndex = Math.floor(Date.now() / (limit.windowSeconds * 1000));
  const redisKey = `rl:${key}:${windowIndex}`;
  const result = await redisPipeline([
    ['INCR', redisKey],
    ['EXPIRE', redisKey, limit.windowSeconds + 1],
  ]);
  if (!result) return null;
  const hits = Number(result[0]);
  return Number.isFinite(hits) ? hits <= limit.max : null;
}

async function hitDbLimit(admin: SupabaseClient, key: string, limit: RateLimit): Promise<boolean> {
  const { data, error } = await admin.rpc('hit_rate_limit', {
    p_key: key,
    p_window_seconds: limit.windowSeconds,
    p_max: limit.max,
  });
  if (error) {
    console.error('[rate-limit] check failed:', error.message);
    return true;
  }
  return data !== false;
}

/**
 * Count one hit and report whether the caller is still under the limit.
 *
 * Store, in order: Upstash Redis when configured; per-instance memory when
 * Redis errors or times out (never the database — under a burst the database
 * is what must be protected). Without Redis configured, limits not marked
 * `noDb` keep using the `hit_rate_limit` RPC as before.
 *
 * @param admin - Service-role client (only used for the database store).
 * @param name - Which limit to apply.
 * @param subject - What to key on, usually the client IP plus a scope.
 */
export async function hitRateLimit(admin: SupabaseClient, name: RateLimitName, subject: string): Promise<boolean> {
  const limit: RateLimit = RATE_LIMITS[name];
  const key = `${name}:${subject}`.slice(0, 200);

  if (isRedisConfigured()) {
    const ok = await hitRedisLimit(key, limit);
    return ok ?? hitMemoryLimit(key, limit);
  }
  if (limit.noDb) return hitMemoryLimit(key, limit);
  return hitDbLimit(admin, key, limit);
}

/** Standard 429 body in Thai, shown to the customer as-is. */
export function tooManyRequests(): NextResponse {
  return NextResponse.json(
    { error: 'มีการใช้งานถี่เกินไป กรุณารอสักครู่แล้วลองใหม่', code: 'rate_limited', retry_after: 10 },
    { status: 429, headers: { 'Retry-After': '10' } },
  );
}

/** Test hook. */
export function resetMemoryLimitsForTests() {
  memoryHits.clear();
}
