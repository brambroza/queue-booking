import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

/** Per-route limits for unauthenticated endpoints: hits per window. */
export const RATE_LIMITS = {
  book: { windowSeconds: 600, max: 20 },
  liffProfile: { windowSeconds: 60, max: 60 },
  liffAction: { windowSeconds: 600, max: 30 },
  /** F&B sheet polls order status while open, so it needs headroom a one-off action does not. */
  fnbRead: { windowSeconds: 600, max: 120 },
  register: { windowSeconds: 3600, max: 5 },
  contactLead: { windowSeconds: 3600, max: 5 },
  /** Owner "test connection" for the slip verification key — each hit is a vendor call. */
  slipVerifyTest: { windowSeconds: 600, max: 5 },
} as const;

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
 * Count one hit and report whether the caller is still under the limit.
 *
 * Fails open when the limiter itself errors (e.g. migration not run yet):
 * a broken limiter must not take booking down. The error is logged.
 *
 * @param admin - Service-role client (the table has no session policies).
 * @param name - Which limit to apply.
 * @param subject - What to key on, usually the client IP plus a scope.
 */
export async function hitRateLimit(admin: SupabaseClient, name: RateLimitName, subject: string): Promise<boolean> {
  const limit = RATE_LIMITS[name];
  const { data, error } = await admin.rpc('hit_rate_limit', {
    p_key: `${name}:${subject}`.slice(0, 200),
    p_window_seconds: limit.windowSeconds,
    p_max: limit.max,
  });
  if (error) {
    console.error('[rate-limit] check failed:', error.message);
    return true;
  }
  return data !== false;
}

/** Standard 429 body in Thai, shown to the customer as-is. */
export function tooManyRequests(): NextResponse {
  return NextResponse.json({ error: 'มีการใช้งานถี่เกินไป กรุณารอสักครู่แล้วลองใหม่' }, { status: 429 });
}
