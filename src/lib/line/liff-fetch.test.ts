import { afterEach, describe, expect, it, vi } from 'vitest';
import { busyRetryDelayMs, fetchJsonWithBusyRetry } from './liff-fetch';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const noSleep = () => Promise.resolve();

describe('busyRetryDelayMs', () => {
  it('doubles per attempt from the server hint and caps at 15s before jitter', () => {
    expect(busyRetryDelayMs(0, 2, () => 0)).toBe(2000);
    expect(busyRetryDelayMs(1, 2, () => 0)).toBe(4000);
    expect(busyRetryDelayMs(10, 2, () => 0)).toBe(15000);
    expect(busyRetryDelayMs(0, 2, () => 1)).toBe(3000);
  });
});

describe('fetchJsonWithBusyRetry', () => {
  afterEach(() => vi.restoreAllMocks());

  it('retries 503 / 429 then returns the success', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json(503, { code: 'busy', retry_after: 1 }))
      .mockResolvedValueOnce(json(429, {}))
      .mockResolvedValueOnce(json(200, { data: 1 }));
    const waits: number[] = [];
    const { res, json: body } = await fetchJsonWithBusyRetry('/x', undefined, { sleep: noSleep, onWait: (s) => waits.push(s) });
    expect(res.status).toBe(200);
    expect(body).toEqual({ data: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(waits).toHaveLength(2);
  });

  it('returns a normal error without retrying', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(409, { code: 'slot_full' }));
    const { res } = await fetchJsonWithBusyRetry('/x', undefined, { sleep: noSleep });
    expect(res.status).toBe(409);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('retries a listed body code', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json(409, { code: 'busy' })).mockResolvedValueOnce(json(200, {}));
    const { res } = await fetchJsonWithBusyRetry('/x', undefined, { sleep: noSleep, retryCodes: ['busy'] });
    expect(res.status).toBe(200);
  });

  it('gives up after the retries with the last response', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => json(503, {}));
    const { res } = await fetchJsonWithBusyRetry('/x', undefined, { sleep: noSleep, retries: 2 });
    expect(res.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('throws when the network never answers', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'));
    await expect(fetchJsonWithBusyRetry('/x', undefined, { sleep: noSleep, retries: 1 })).rejects.toThrow('offline');
  });
});
