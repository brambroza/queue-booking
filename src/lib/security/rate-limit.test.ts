import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { hitMemoryLimit, hitRateLimit, liffSubject, resetMemoryLimitsForTests } from './rate-limit';
import { resetCacheForTests } from '@/lib/cache/kv';

const rpc = vi.fn();
const admin = { rpc } as unknown as SupabaseClient;

describe('hitMemoryLimit', () => {
  beforeEach(() => resetMemoryLimitsForTests());

  it('allows up to max per window, then refuses, then resets next window', () => {
    const limit = { windowSeconds: 60, max: 2 };
    expect(hitMemoryLimit('k', limit, 0)).toBe(true);
    expect(hitMemoryLimit('k', limit, 1)).toBe(true);
    expect(hitMemoryLimit('k', limit, 2)).toBe(false);
    expect(hitMemoryLimit('k', limit, 60_000)).toBe(true);
  });
});

describe('hitRateLimit', () => {
  beforeEach(() => {
    resetMemoryLimitsForTests();
    resetCacheForTests();
    rpc.mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  it('never touches the database for noDb limits without Redis', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    expect(await hitRateLimit(admin, 'liffRead', '1.2.3.4')).toBe(true);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('keeps the database RPC for other limits until Redis is configured', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    rpc.mockResolvedValue({ data: true, error: null });
    expect(await hitRateLimit(admin, 'book', '1.2.3.4')).toBe(true);
    expect(rpc).toHaveBeenCalledOnce();
  });

  it('uses Redis when configured and falls back to memory (not the DB) when it fails', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.invalid');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 't');
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await hitRateLimit(admin, 'book', '1.2.3.4')).toBe(true);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('refuses over the limit from the Redis counter', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.example');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 't');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify([{ result: 21 }, { result: 1 }])));
    expect(await hitRateLimit(admin, 'book', '1.2.3.4')).toBe(false);
  });
});

describe('liffSubject', () => {
  const req = new Request('https://x.test', { headers: { 'x-forwarded-for': '9.9.9.9' } });

  it('keys on a token hash, so customers behind one IP do not share a bucket', () => {
    const a = liffSubject(req, 'token-a');
    const b = liffSubject(req, 'token-b');
    expect(a).not.toBe(b);
    expect(a.startsWith('t:')).toBe(true);
    expect(a).not.toContain('token-a');
  });

  it('falls back to the IP without a token', () => {
    expect(liffSubject(req, undefined)).toBe('9.9.9.9');
  });
});
