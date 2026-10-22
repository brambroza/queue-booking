import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cached, invalidateCache, resetCacheForTests } from './kv';

describe('cached (memory only)', () => {
  beforeEach(() => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
    resetCacheForTests();
  });
  afterEach(() => vi.unstubAllEnvs());

  it('calls the loader once while fresh', async () => {
    const loader = vi.fn(async () => ({ n: 1 }));
    expect(await cached('a', { ttlSeconds: 10 }, loader)).toEqual({ n: 1 });
    expect(await cached('a', { ttlSeconds: 10 }, loader)).toEqual({ n: 1 });
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('coalesces concurrent misses into one loader call', async () => {
    let resolve!: (v: number) => void;
    const loader = vi.fn(() => new Promise<number>((r) => (resolve = r)));
    const calls = Array.from({ length: 50 }, () => cached('b', { ttlSeconds: 10 }, loader));
    await vi.waitFor(() => expect(loader).toHaveBeenCalled());
    resolve(7);
    expect(await Promise.all(calls)).toEqual(Array(50).fill(7));
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('serves the stale value when the loader fails after expiry', async () => {
    vi.useFakeTimers();
    try {
      await cached('c', { ttlSeconds: 1, staleSeconds: 60 }, async () => 'old');
      vi.advanceTimersByTime(2000);
      vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(await cached('c', { ttlSeconds: 1, staleSeconds: 60 }, async () => { throw new Error('db down'); })).toBe('old');
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not cache a thrown error', async () => {
    await expect(cached('d', { ttlSeconds: 10 }, async () => { throw new Error('x'); })).rejects.toThrow('x');
    expect(await cached('d', { ttlSeconds: 10 }, async () => 'ok')).toBe('ok');
  });

  it('invalidates exact keys and prefixes', async () => {
    const loader = vi.fn(async () => 1);
    await cached('slots:s1:a', { ttlSeconds: 10 }, loader);
    await cached('meta:s1', { ttlSeconds: 10 }, loader);
    await invalidateCache(['slots:s1:*', 'meta:s1']);
    await cached('slots:s1:a', { ttlSeconds: 10 }, loader);
    await cached('meta:s1', { ttlSeconds: 10 }, loader);
    expect(loader).toHaveBeenCalledTimes(4);
  });
});

describe('cached with a failing Redis', () => {
  beforeEach(() => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.invalid');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'token');
    resetCacheForTests();
  });
  afterEach(() => vi.unstubAllEnvs());

  it('falls back to the loader and never throws', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('timeout'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await cached('e', { ttlSeconds: 10 }, async () => 'from-db')).toBe('from-db');
    expect(fetchMock).toHaveBeenCalled();
  });

  it('stops calling Redis after repeated failures (circuit breaker)', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    for (let i = 0; i < 10; i += 1) await cached(`f${i}`, { ttlSeconds: 10 }, async () => i);
    const before = fetchMock.mock.calls.length;
    await cached('g', { ttlSeconds: 10 }, async () => 0);
    expect(fetchMock.mock.calls.length).toBe(before);
  });

  it('uses a Redis hit without calling the loader', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify([{ result: JSON.stringify({ hit: true }) }])));
    const loader = vi.fn(async () => ({ hit: false }));
    expect(await cached('h', { ttlSeconds: 10 }, loader)).toEqual({ hit: true });
    expect(loader).not.toHaveBeenCalled();
  });
});
