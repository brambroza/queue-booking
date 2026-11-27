import { describe, expect, it } from 'vitest';
import { LIFF_SCOPES, LiffProvisionError, liffEndpoints, provisionShopLiffApps } from './liff-provision';

const CHANNEL = '2001234567';
const SECRET = 'a'.repeat(32);
const APP = 'https://queuebooking.com';
const BOOKING_URL = `${APP}/liff/SHOP-1`;
const MEMBER_URL = `${APP}/liff/SHOP-1/member`;

type Call = { url: string; method: string; body?: unknown };

/** Fake LINE API: tokens, an in-memory LIFF app list, and recorded calls. */
function fakeLine(opts: { apps?: Array<{ liffId: string; view: { url: string; type?: string }; scope: string[] }>; tokenStatus?: number; liffStatus?: number } = {}) {
  const apps = [...(opts.apps ?? [])];
  const calls: Call[] = [];
  let next = 0;
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    calls.push({ url, method, body });
    const json = (status: number, data: unknown) => new Response(JSON.stringify(data), { status });
    if (url.includes('/token') || url.includes('/accessToken')) {
      const status = opts.tokenStatus ?? 200;
      return status === 200 ? json(200, { access_token: 'tok' }) : json(status, { error: 'invalid_client' });
    }
    if (opts.liffStatus) return json(opts.liffStatus, {});
    if (method === 'GET') return apps.length ? json(200, { apps }) : json(404, {});
    if (method === 'POST') {
      const liffId = `${CHANNEL}-new${next++}`;
      apps.push({ liffId, view: body.view, scope: body.scope });
      return json(200, { liffId });
    }
    return json(200, {});
  }) as typeof fetch;
  return { impl, calls };
}

const base = { channelId: CHANNEL, channelSecret: SECRET, shopKey: 'SHOP-1', shopName: 'ร้านทดสอบ', appUrl: APP };

describe('provisionShopLiffApps', () => {
  it('creates both apps with the right endpoints and scopes on an empty channel', async () => {
    const line = fakeLine();
    const r = await provisionShopLiffApps(base, line.impl);
    expect(r).toEqual({ liffId: `${CHANNEL}-new0`, liffIdLoginShop: `${CHANNEL}-new1`, created: ['booking', 'member'], updated: [] });
    const posts = line.calls.filter((c) => c.method === 'POST' && c.url.endsWith('/liff/v1/apps'));
    expect(posts.map((p) => (p.body as { view: { url: string } }).view.url)).toEqual([BOOKING_URL, MEMBER_URL]);
    for (const p of posts) expect((p.body as { scope: string[] }).scope).toEqual([...LIFF_SCOPES]);
  });

  it('is idempotent: a second run reuses the apps and changes nothing', async () => {
    const line = fakeLine();
    await provisionShopLiffApps(base, line.impl);
    const r = await provisionShopLiffApps(base, line.impl);
    expect(r.created).toEqual([]);
    expect(r.updated).toEqual([]);
    expect(r.liffId).toBe(`${CHANNEL}-new0`);
  });

  it('fixes an existing app that lacks chat_message.write', async () => {
    const line = fakeLine({ apps: [{ liffId: `${CHANNEL}-old`, view: { url: `${BOOKING_URL}/` }, scope: ['openid', 'profile'] }] });
    const r = await provisionShopLiffApps({ ...base, currentLiffId: `${CHANNEL}-old` }, line.impl);
    expect(r.liffId).toBe(`${CHANNEL}-old`);
    expect(r.updated).toEqual(['booking']);
    expect(r.created).toEqual(['member']);
    const put = line.calls.find((c) => c.method === 'PUT' && c.url.endsWith(`/liff/v1/apps/${CHANNEL}-old`));
    expect(put?.body).toEqual({ view: { type: 'full', url: `${BOOKING_URL}/` }, scope: ['openid', 'profile', 'chat_message.write'] });
  });

  it('keeps a live shop app as it is: our older endpoint, size and bot prompt are not touched', async () => {
    const shared = `${APP}/liff/booking-client`;
    const line = fakeLine({
      apps: [
        { liffId: `${CHANNEL}-book`, view: { url: shared, type: 'tall' }, scope: ['openid', 'profile', 'chat_message.write'] },
        { liffId: `${CHANNEL}-memb`, view: { url: shared, type: 'full' }, scope: ['openid', 'profile', 'chat_message.write'] },
      ],
    });
    const r = await provisionShopLiffApps({ ...base, currentLiffId: `${CHANNEL}-book`, currentLiffIdLoginShop: `${CHANNEL}-memb` }, line.impl);
    expect(r).toEqual({ liffId: `${CHANNEL}-book`, liffIdLoginShop: `${CHANNEL}-memb`, created: [], updated: [] });
    expect(line.calls.filter((c) => c.method !== 'GET' && !c.url.includes('token'))).toHaveLength(0);
  });

  it('points an app at us when its endpoint is on another host, keeping its size', async () => {
    const line = fakeLine({ apps: [{ liffId: `${CHANNEL}-oldapp`, view: { url: 'https://old.example.com/x', type: 'tall' }, scope: [...LIFF_SCOPES] }] });
    await provisionShopLiffApps({ ...base, currentLiffId: `${CHANNEL}-oldapp` }, line.impl);
    const put = line.calls.find((c) => c.method === 'PUT');
    expect(put?.body).toMatchObject({ view: { type: 'tall', url: BOOKING_URL } });
  });

  it('ignores a stored LIFF id from another channel', async () => {
    const line = fakeLine();
    const r = await provisionShopLiffApps({ ...base, currentLiffId: '1999999999-other' }, line.impl);
    expect(r.created).toEqual(['booking', 'member']);
  });

  it('rejects bad input before calling LINE', async () => {
    const line = fakeLine();
    await expect(provisionShopLiffApps({ ...base, channelId: 'abc' }, line.impl)).rejects.toBeInstanceOf(LiffProvisionError);
    await expect(provisionShopLiffApps({ ...base, channelSecret: 'short' }, line.impl)).rejects.toBeInstanceOf(LiffProvisionError);
    expect(line.calls).toHaveLength(0);
  });

  it('explains a wrong secret', async () => {
    const line = fakeLine({ tokenStatus: 400 });
    await expect(provisionShopLiffApps(base, line.impl)).rejects.toThrow('ไม่ถูกต้อง');
  });

  it('explains a Messaging API channel used by mistake', async () => {
    const line = fakeLine({ liffStatus: 403 });
    await expect(provisionShopLiffApps(base, line.impl)).rejects.toThrow('LINE Login');
  });
});

describe('liffEndpoints', () => {
  it('refuses http origins', () => {
    expect(() => liffEndpoints('http://localhost:3000', 'S')).toThrow(LiffProvisionError);
  });
});
