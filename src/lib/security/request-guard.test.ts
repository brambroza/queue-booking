import { beforeEach, describe, expect, it, vi } from 'vitest';
import { acquireSeat, claimIdempotencyKey, resetRequestGuardsForTests, settleIdempotencyKey } from './request-guard';

describe('request guards (memory)', () => {
  beforeEach(() => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    resetRequestGuardsForTests();
  });

  it('hands out at most max seats and frees them on release', async () => {
    const a = await acquireSeat('book:s', 2);
    const b = await acquireSeat('book:s', 2);
    expect(a && b).toBeTruthy();
    expect(await acquireSeat('book:s', 2)).toBeNull();
    await a!.release();
    expect(await acquireSeat('book:s', 2)).not.toBeNull();
  });

  it('reports pending, then replays the stored response', async () => {
    expect(await claimIdempotencyKey('k1')).toEqual({ state: 'new' });
    expect(await claimIdempotencyKey('k1')).toEqual({ state: 'pending' });
    await settleIdempotencyKey('k1', { data: { queue_number: 'A001' } });
    expect(await claimIdempotencyKey('k1')).toEqual({ state: 'done', response: { data: { queue_number: 'A001' } } });
  });

  it('releases the key on failure so the customer can retry', async () => {
    await claimIdempotencyKey('k2');
    await settleIdempotencyKey('k2', null);
    expect(await claimIdempotencyKey('k2')).toEqual({ state: 'new' });
  });
});
