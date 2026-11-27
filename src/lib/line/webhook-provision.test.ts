import { describe, expect, it } from 'vitest';
import { describeWebhookTest, provisionWebhook, WebhookProvisionError, webhookUrl } from './webhook-provision';

const APP = 'https://queuebooking.com';
const URL_ = `${APP}/api/line/webhook/SHOP-1`;

type Call = { url: string; method: string; body?: unknown; auth?: string };

/** Fake Messaging API with a configurable webhook state and test result. */
function fakeLine(opts: { status?: number; active?: boolean; test?: Record<string, unknown>; current?: string } = {}) {
  const calls: Call[] = [];
  let endpoint = opts.current ?? '';
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    calls.push({ url, method, body, auth: (init?.headers as Record<string, string>)?.Authorization });
    const json = (status: number, data: unknown) => new Response(JSON.stringify(data), { status });
    if (opts.status) return json(opts.status, {});
    if (url.endsWith('/webhook/endpoint') && method === 'PUT') {
      endpoint = body.endpoint;
      return json(200, {});
    }
    if (url.endsWith('/webhook/endpoint')) return json(200, { endpoint, active: opts.active ?? true });
    if (url.endsWith('/webhook/test')) return json(200, opts.test ?? { success: true, statusCode: 200, reason: 'OK' });
    return json(404, {});
  }) as typeof fetch;
  return { impl, calls };
}

const base = { token: 'tok', appUrl: `${APP}/`, shopKey: 'SHOP-1' };

describe('provisionWebhook', () => {
  it('sets the endpoint, reads it back and runs the test', async () => {
    const line = fakeLine();
    const r = await provisionWebhook(base, line.impl);
    expect(r).toEqual({ endpoint: URL_, previousEndpoint: '', skipped: false, active: true, test: { success: true, statusCode: 200, message: expect.any(String) } });
    expect(line.calls.map((c) => c.method)).toEqual(['GET', 'PUT', 'GET', 'POST']);
    expect(line.calls[1].body).toEqual({ endpoint: URL_ });
    expect(line.calls.every((c) => c.auth === 'Bearer tok')).toBe(true);
  });

  it('leaves a webhook that points to another system alone unless told to overwrite', async () => {
    const other = 'https://chatbot.example.com/hook';
    const line = fakeLine({ current: other });
    const r = await provisionWebhook(base, line.impl);
    expect(r.skipped).toBe(true);
    expect(r.previousEndpoint).toBe(other);
    expect(line.calls.map((c) => c.method)).toEqual(['GET']);

    const forced = await provisionWebhook({ ...base, overwrite: true }, fakeLine({ current: other }).impl);
    expect(forced).toMatchObject({ skipped: false, endpoint: URL_, previousEndpoint: other });
  });

  it('re-runs freely when the webhook is already ours', async () => {
    const r = await provisionWebhook(base, fakeLine({ current: `${URL_}/` }).impl);
    expect(r.skipped).toBe(false);
  });

  it('reports "Use webhook" off', async () => {
    const r = await provisionWebhook(base, fakeLine({ active: false }).impl);
    expect(r.active).toBe(false);
  });

  it('flags a channel secret mismatch from the test delivery', async () => {
    const r = await provisionWebhook(base, fakeLine({ test: { success: false, statusCode: 401, reason: 'ERROR_STATUS_CODE' } }).impl);
    expect(r.test.success).toBe(false);
    expect(r.test.message).toContain('Channel Secret');
  });

  it('explains a bad token', async () => {
    await expect(provisionWebhook(base, fakeLine({ status: 401 }).impl)).rejects.toThrow('Channel Access Token');
  });

  it('refuses to run without a token', async () => {
    const line = fakeLine();
    await expect(provisionWebhook({ ...base, token: '' }, line.impl)).rejects.toBeInstanceOf(WebhookProvisionError);
    expect(line.calls).toHaveLength(0);
  });
});

describe('webhookUrl / describeWebhookTest', () => {
  it('refuses http', () => {
    expect(() => webhookUrl('http://localhost:3000', 'S')).toThrow(WebhookProvisionError);
  });

  it('reports an unreachable webhook with the reason', () => {
    expect(describeWebhookTest({ success: false, reason: 'COULD_NOT_CONNECT' }).message).toContain('COULD_NOT_CONNECT');
  });
});
