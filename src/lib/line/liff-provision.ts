import { channelIdFromLiffId, isValidLiffId, normalizeLiffId } from '@/lib/line/liff-id';

/**
 * Creates (or repairs) the two LIFF apps a shop needs, on the shop's own LINE
 * Login channel, through the LIFF Server API.
 *
 * Owners used to create both apps by hand in LINE Developers, pick the scopes
 * and copy the IDs back. Missing `chat_message.write` or a wrong endpoint broke
 * booking with no visible cause. Here the owner pastes only the Login channel
 * ID and secret; the secret is used once to issue a token and is never stored.
 *
 * LINE docs: https://developers.line.biz/en/reference/liff-server/
 */

/** Scopes both LIFF apps need: ID token (identity), profile, and `liff.sendMessages` (booking echo). */
export const LIFF_SCOPES = ['openid', 'profile', 'chat_message.write'] as const;

export type LiffKind = 'booking' | 'member';

export type LiffAppSummary = { liffId: string; url: string; viewType: string; scope: string[] };

export type ProvisionResult = {
  liffId: string;
  liffIdLoginShop: string;
  created: LiffKind[];
  updated: LiffKind[];
};

/** Error with a Thai message safe to show the shop owner. */
export class LiffProvisionError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
  ) {
    super(message);
    this.name = 'LiffProvisionError';
  }
}

type FetchLike = typeof fetch;

const LINE_API = 'https://api.line.me';

/** LINE channel IDs are 10 digits today; accept a little either side. */
export function isValidChannelId(value: string): boolean {
  return /^\d{8,12}$/.test(value);
}

/** Channel secrets are 32 hex characters. */
export function isValidChannelSecret(value: string): boolean {
  return /^[a-f0-9]{32}$/i.test(value);
}

/**
 * Endpoint URLs the two LIFF apps must point to (same paths the setup guide shows).
 *
 * @param appUrl - Public app origin, must be https (LINE rejects http).
 * @param shopKey - `shops.shop_key`.
 * @returns Booking and member endpoint URLs.
 */
export function liffEndpoints(appUrl: string, shopKey: string): Record<LiffKind, string> {
  const base = appUrl.trim().replace(/\/+$/, '');
  if (!/^https:\/\//i.test(base)) {
    throw new LiffProvisionError('ตั้งค่า NEXT_PUBLIC_APP_URL เป็น https ก่อน (LINE ไม่รับ http)', 500);
  }
  const key = encodeURIComponent(shopKey);
  return { booking: `${base}/liff/${key}`, member: `${base}/liff/${key}/member` };
}

/** Compare URLs ignoring a trailing slash and case of the host. */
function sameUrl(a: string, b: string): boolean {
  const norm = (u: string) => u.trim().replace(/\/+$/, '').toLowerCase();
  return norm(a) === norm(b);
}

/**
 * Issue a channel access token for a LINE Login channel.
 *
 * Tries the stateless v3 token first (no per-channel limit), then the
 * short-lived v2 token, which some channels still require.
 *
 * @returns Bearer token for the LIFF Server API.
 */
export async function issueLoginChannelToken(channelId: string, channelSecret: string, fetchImpl: FetchLike = fetch): Promise<string> {
  const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: channelId, client_secret: channelSecret });
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
  let lastStatus = 0;
  for (const path of ['/oauth2/v3/token', '/v2/oauth/accessToken']) {
    let res: Response;
    try {
      res = await fetchImpl(`${LINE_API}${path}`, { method: 'POST', headers, body, cache: 'no-store' });
    } catch {
      throw new LiffProvisionError('เชื่อมต่อ LINE API ไม่ได้ ลองใหม่อีกครั้ง', 502);
    }
    if (res.ok) {
      const json = (await res.json().catch(() => ({}))) as { access_token?: string };
      if (json.access_token) return json.access_token;
    }
    lastStatus = res.status;
  }
  if (lastStatus === 400 || lastStatus === 401) {
    throw new LiffProvisionError('Channel ID หรือ Channel Secret ของ LINE Login ไม่ถูกต้อง');
  }
  throw new LiffProvisionError(`ขอ token จาก LINE ไม่สำเร็จ (สถานะ ${lastStatus})`, 502);
}

/** Map a LIFF Server API failure to an owner-readable message. */
function liffApiError(status: number, action: string): LiffProvisionError {
  if (status === 401 || status === 403) {
    return new LiffProvisionError(
      'channel นี้สร้าง LIFF ไม่ได้ — ต้องใช้ Channel ID/Secret ของ "LINE Login" channel (ไม่ใช่ Messaging API channel)',
    );
  }
  if (status === 400) {
    return new LiffProvisionError(`LINE ปฏิเสธการ${action} LIFF (400) — channel อาจมี LIFF ครบ 30 ตัวแล้ว หรือ endpoint ไม่ถูกต้อง`);
  }
  return new LiffProvisionError(`LINE ตอบกลับสถานะ ${status} ระหว่าง${action} LIFF`, 502);
}

/** List the LIFF apps on the channel the token belongs to. A channel with none answers 404. */
export async function listLiffApps(token: string, fetchImpl: FetchLike = fetch): Promise<LiffAppSummary[]> {
  const res = await fetchImpl(`${LINE_API}/liff/v1/apps`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
  if (res.status === 404) return [];
  if (!res.ok) throw liffApiError(res.status, 'อ่านรายการ');
  const json = (await res.json().catch(() => ({}))) as {
    apps?: Array<{ liffId?: string; view?: { url?: string; type?: string }; scope?: string[] }>;
  };
  return (json.apps ?? [])
    .filter((a): a is { liffId: string; view?: { url?: string; type?: string }; scope?: string[] } => typeof a.liffId === 'string')
    .map((a) => ({ liffId: a.liffId, url: a.view?.url ?? '', viewType: a.view?.type ?? 'full', scope: a.scope ?? [] }));
}

/** Request body for a new app. */
function liffBody(kind: LiffKind, url: string, shopName: string) {
  const label = kind === 'booking' ? 'จองคิว' : 'คิวของฉัน';
  return {
    view: { type: 'full', url },
    // LINE caps the description; keep it short.
    description: `${label} ${shopName}`.trim().slice(0, 50),
    features: { qrCode: false },
    permanentLinkPattern: 'concat',
    scope: [...LIFF_SCOPES],
    botPrompt: 'normal',
  };
}

async function createLiffApp(token: string, kind: LiffKind, url: string, shopName: string, fetchImpl: FetchLike): Promise<string> {
  const res = await fetchImpl(`${LINE_API}/liff/v1/apps`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(liffBody(kind, url, shopName)),
    cache: 'no-store',
  });
  if (!res.ok) throw liffApiError(res.status, 'สร้าง');
  const json = (await res.json().catch(() => ({}))) as { liffId?: string };
  if (!json.liffId || !isValidLiffId(json.liffId)) throw new LiffProvisionError('LINE ไม่ส่ง LIFF ID กลับมา', 502);
  return json.liffId;
}

/**
 * Partial update of an app the shop already uses: only the endpoint and the
 * missing scopes. Size, description, bot prompt and link pattern stay as the
 * owner set them, so a live shop's LIFF does not change look or behavior.
 */
async function updateLiffApp(token: string, app: LiffAppSummary, url: string, fetchImpl: FetchLike): Promise<void> {
  const scope = [...new Set([...app.scope, ...LIFF_SCOPES])];
  const res = await fetchImpl(`${LINE_API}/liff/v1/apps/${encodeURIComponent(app.liffId)}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ view: { type: app.viewType, url }, scope }),
    cache: 'no-store',
  });
  if (!res.ok) throw liffApiError(res.status, 'แก้ไข');
}

/**
 * Endpoint to keep for an app the shop already uses. Any `/liff/...` page on
 * our own origin works (older shops registered `/liff/booking-client` or used
 * one endpoint for both apps), so it is left alone; only an endpoint pointing
 * somewhere else is replaced with ours.
 */
export function endpointToKeep(currentUrl: string, wantedUrl: string): string {
  try {
    const cur = new URL(currentUrl);
    const want = new URL(wantedUrl);
    if (cur.host.toLowerCase() === want.host.toLowerCase() && cur.pathname.startsWith('/liff/')) return currentUrl;
  } catch {
    /* unparsable endpoint: replace it */
  }
  return wantedUrl;
}

export type ProvisionInput = {
  channelId: string;
  channelSecret: string;
  shopKey: string;
  shopName: string;
  appUrl: string;
  /** Currently stored `shops.liff_id`, reused when it lives on this channel. */
  currentLiffId?: string | null;
  /** Currently stored `shops.liff_id_login_shop`. */
  currentLiffIdLoginShop?: string | null;
};

/**
 * Ensure the booking and member LIFF apps exist on the Login channel.
 *
 * Reuse order per app: the ID the shop already stores (if it is on this
 * channel), then any app whose endpoint already matches, else create one.
 * Reused apps are updated only when the endpoint or scopes are off, so
 * running this twice is safe and never piles up duplicate apps.
 */
export async function provisionShopLiffApps(input: ProvisionInput, fetchImpl: FetchLike = fetch): Promise<ProvisionResult> {
  const channelId = input.channelId.trim();
  const channelSecret = input.channelSecret.trim();
  if (!isValidChannelId(channelId)) throw new LiffProvisionError('Channel ID ต้องเป็นตัวเลข 10 หลัก');
  if (!isValidChannelSecret(channelSecret)) throw new LiffProvisionError('Channel Secret ต้องเป็นตัวอักษร 32 ตัว (0-9, a-f)');

  const endpoints = liffEndpoints(input.appUrl, input.shopKey);
  const token = await issueLoginChannelToken(channelId, channelSecret, fetchImpl);
  const apps = await listLiffApps(token, fetchImpl);

  const stored: Record<LiffKind, string> = {
    booking: normalizeLiffId(input.currentLiffId),
    member: normalizeLiffId(input.currentLiffIdLoginShop),
  };
  const result: Record<LiffKind, string> = { booking: '', member: '' };
  const created: LiffKind[] = [];
  const updated: LiffKind[] = [];
  const taken = new Set<string>();

  for (const kind of ['booking', 'member'] as const) {
    const url = endpoints[kind];
    const own = stored[kind] && channelIdFromLiffId(stored[kind]) === channelId
      ? apps.find((a) => a.liffId === stored[kind] && !taken.has(a.liffId))
      : undefined;
    const existing = own ?? apps.find((a) => sameUrl(a.url, url) && !taken.has(a.liffId));

    if (existing) {
      const keepUrl = endpointToKeep(existing.url, url);
      const missingScope = LIFF_SCOPES.some((s) => !existing.scope.includes(s));
      if (keepUrl !== existing.url || missingScope) {
        await updateLiffApp(token, existing, keepUrl, fetchImpl);
        updated.push(kind);
      }
      result[kind] = existing.liffId;
    } else {
      result[kind] = await createLiffApp(token, kind, url, input.shopName, fetchImpl);
      created.push(kind);
    }
    taken.add(result[kind]);
  }

  return { liffId: result.booking, liffIdLoginShop: result.member, created, updated };
}
