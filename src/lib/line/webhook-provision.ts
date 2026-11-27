/**
 * Points a shop's Messaging API channel at our webhook and checks that LINE can
 * reach it, so the owner no longer copies the URL into LINE Developers by hand.
 *
 * LINE docs: https://developers.line.biz/en/reference/messaging-api/#set-webhook-endpoint-url
 *
 * The "Use webhook" switch has no API; LINE reports it as `active` and the
 * caller tells the owner to turn it on when it is off.
 */

const LINE_API = 'https://api.line.me';

type FetchLike = typeof fetch;

/** Error with a Thai message safe to show the shop owner. */
export class WebhookProvisionError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
  ) {
    super(message);
    this.name = 'WebhookProvisionError';
  }
}

export type WebhookTest = { success: boolean; statusCode: number | null; message: string };

export type WebhookProvisionResult = {
  endpoint: string;
  /** Webhook URL that was set before this call (empty when none). */
  previousEndpoint: string;
  /**
   * True when the channel already pointed somewhere else and `overwrite` was
   * false: nothing was changed and no test ran.
   */
  skipped: boolean;
  /** LINE's "Use webhook" switch; false means LINE will not deliver events yet. */
  active: boolean;
  test: WebhookTest;
};

/**
 * Webhook URL for a shop.
 *
 * @param appUrl - Public app origin; LINE accepts https only.
 * @param shopKey - `shops.shop_key`.
 */
export function webhookUrl(appUrl: string, shopKey: string): string {
  const base = appUrl.trim().replace(/\/+$/, '');
  if (!/^https:\/\//i.test(base)) {
    throw new WebhookProvisionError('ตั้งค่า NEXT_PUBLIC_APP_URL เป็น https ก่อน (LINE ไม่รับ http)', 500);
  }
  return `${base}/api/line/webhook/${encodeURIComponent(shopKey)}`;
}

/** Map a Messaging API failure to an owner-readable message. */
function apiError(status: number, action: string): WebhookProvisionError {
  if (status === 401) return new WebhookProvisionError('Channel Access Token ไม่ถูกต้องหรือหมดอายุ (401) — แก้ token แล้วบันทึกก่อน');
  if (status === 400) return new WebhookProvisionError(`LINE ปฏิเสธการ${action} webhook (400)`);
  return new WebhookProvisionError(`LINE ตอบกลับสถานะ ${status} ระหว่าง${action} webhook`, 502);
}

async function call(fetchImpl: FetchLike, path: string, token: string, init: RequestInit, action: string): Promise<Response> {
  let res: Response;
  try {
    res = await fetchImpl(`${LINE_API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      cache: 'no-store',
    });
  } catch {
    throw new WebhookProvisionError('เชื่อมต่อ LINE API ไม่ได้ ลองใหม่อีกครั้ง', 502);
  }
  if (!res.ok) throw apiError(res.status, action);
  return res;
}

/**
 * Explain LINE's test result. LINE posts a signed empty event to our webhook,
 * so a 401 from us means the stored Channel Secret does not match this channel.
 */
export function describeWebhookTest(r: { success?: boolean; statusCode?: number; reason?: string }): WebhookTest {
  const statusCode = typeof r.statusCode === 'number' ? r.statusCode : null;
  if (r.success) return { success: true, statusCode, message: 'LINE ส่งข้อความทดสอบถึงระบบสำเร็จ' };
  if (statusCode === 401) {
    return { success: false, statusCode, message: 'Channel Secret ไม่ตรงกับ channel นี้ — ระบบตรวจลายเซ็นไม่ผ่าน (401)' };
  }
  if (statusCode === 400) {
    return { success: false, statusCode, message: 'ยังไม่ได้ใส่ Channel Secret — ระบบตรวจลายเซ็นไม่ได้ (400)' };
  }
  if (statusCode) return { success: false, statusCode, message: `webhook ตอบกลับสถานะ ${statusCode}` };
  return { success: false, statusCode, message: `LINE เรียก webhook ไม่ถึง${r.reason ? ` (${r.reason})` : ''}` };
}

/**
 * Set the webhook URL, read back the "Use webhook" state, and run LINE's test.
 *
 * @param token - The shop's Messaging API channel access token.
 */
export async function provisionWebhook(
  input: { token: string; appUrl: string; shopKey: string; overwrite?: boolean },
  fetchImpl: FetchLike = fetch,
): Promise<WebhookProvisionResult> {
  if (!input.token) throw new WebhookProvisionError('ยังไม่ได้ใส่ Channel Access Token — กรอกแล้วบันทึกก่อน');
  const endpoint = webhookUrl(input.appUrl, input.shopKey);

  // A channel can already feed another system (a chatbot, an older domain).
  // Without an explicit overwrite, leave that URL alone.
  const beforeRes = await call(fetchImpl, '/v2/bot/channel/webhook/endpoint', input.token, { method: 'GET' }, 'อ่าน');
  const before = (await beforeRes.json().catch(() => ({}))) as { endpoint?: string; active?: boolean };
  const previousEndpoint = before.endpoint ?? '';
  const pointsElsewhere = previousEndpoint !== '' && previousEndpoint.replace(/\/+$/, '') !== endpoint;
  if (pointsElsewhere && !input.overwrite) {
    return {
      endpoint: previousEndpoint,
      previousEndpoint,
      skipped: true,
      active: before.active === true,
      test: { success: false, statusCode: null, message: 'ไม่ได้เปลี่ยน — webhook ของ channel นี้ชี้ไปที่ระบบอื่นอยู่' },
    };
  }

  await call(fetchImpl, '/v2/bot/channel/webhook/endpoint', input.token, { method: 'PUT', body: JSON.stringify({ endpoint }) }, 'ตั้งค่า');

  const infoRes = await call(fetchImpl, '/v2/bot/channel/webhook/endpoint', input.token, { method: 'GET' }, 'อ่าน');
  const info = (await infoRes.json().catch(() => ({}))) as { endpoint?: string; active?: boolean };

  const testRes = await call(fetchImpl, '/v2/bot/channel/webhook/test', input.token, { method: 'POST', body: JSON.stringify({ endpoint }) }, 'ทดสอบ');
  const test = describeWebhookTest((await testRes.json().catch(() => ({}))) as { success?: boolean; statusCode?: number; reason?: string });

  return { endpoint: info.endpoint ?? endpoint, previousEndpoint, skipped: false, active: info.active === true, test };
}
