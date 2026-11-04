import 'server-only';

import { createSign } from 'crypto';

/**
 * Read-only Google Sheets access with the platform service account.
 * The shop shares its sheet with `GOOGLE_SHEETS_SA_EMAIL` as a viewer; no OAuth,
 * no per-shop secret. JWT signing uses node `crypto`, no googleapis dependency.
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';
const TIMEOUT_MS = 8000;

export type SheetReadErrorCode = 'not_configured' | 'not_shared' | 'not_found' | 'bad_tab' | 'google_error';

const MESSAGES: Record<SheetReadErrorCode, string> = {
  not_configured: 'ระบบยังไม่ได้ตั้งค่าการเชื่อมต่อ Google Sheet กรุณาแจ้งผู้ดูแลระบบ',
  not_shared: 'ระบบยังเข้าถึง Sheet นี้ไม่ได้ — กดแชร์ให้อีเมลของระบบเป็น "ผู้มีสิทธิ์อ่าน"',
  not_found: 'ไม่พบ Sheet นี้ ตรวจสอบลิงก์อีกครั้ง',
  bad_tab: 'ไม่พบแท็บที่ระบุใน Sheet นี้',
  google_error: 'Google Sheet ไม่ตอบสนอง ลองใหม่อีกครั้ง',
};

/** Failure with a code the portal can show; `message` is safe for the shop to read. */
export class SheetReadError extends Error {
  constructor(readonly code: SheetReadErrorCode) {
    super(MESSAGES[code]);
    this.name = 'SheetReadError';
  }
}

/** Service account email shops must share their sheet with; '' when not configured. */
export function sheetServiceAccountEmail(): string {
  return process.env.GOOGLE_SHEETS_SA_EMAIL?.trim() ?? '';
}

function serviceAccountKey(): string {
  // Vercel env stores the PEM on one line with literal "\n".
  return (process.env.GOOGLE_SHEETS_SA_PRIVATE_KEY ?? '').replace(/\\n/g, '\n').trim();
}

let token: { value: string; expiresAt: number } | null = null;

function base64url(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url');
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' });
  } catch {
    throw new SheetReadError('google_error');
  } finally {
    clearTimeout(timer);
  }
}

/** Access token for the service account, reused until a minute before it expires. */
async function accessToken(): Promise<string> {
  const now = Date.now();
  if (token && token.expiresAt - 60_000 > now) return token.value;

  const email = sheetServiceAccountEmail();
  const key = serviceAccountKey();
  if (!email || !key) throw new SheetReadError('not_configured');

  const iat = Math.floor(now / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(JSON.stringify({ iss: email, scope: SCOPE, aud: TOKEN_URL, iat, exp: iat + 3600 }));
  let signature: string;
  try {
    signature = createSign('RSA-SHA256').update(`${header}.${claims}`).sign(key, 'base64url');
  } catch {
    console.error('[sheet] service account private key is not a valid PEM');
    throw new SheetReadError('not_configured');
  }

  const res = await fetchWithTimeout(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claims}.${signature}`,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !json.access_token) {
    console.error('[sheet] token request failed', res.status, json.error ?? '');
    throw new SheetReadError(res.status === 400 || res.status === 401 ? 'not_configured' : 'google_error');
  }
  token = { value: json.access_token, expiresAt: now + (json.expires_in ?? 3600) * 1000 };
  return token.value;
}

/**
 * Cell values of one range as displayed in the sheet (FORMATTED_VALUE), first row first.
 *
 * @param spreadsheetId - Id from the sheet link.
 * @param range - A1 range, e.g. `'คิววันนี้'!A1:Z2000`.
 * @throws SheetReadError
 */
export async function readSheetValues(spreadsheetId: string, range: string): Promise<string[][]> {
  const bearer = await accessToken();
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}` +
    `/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE&majorDimension=ROWS`;
  const res = await fetchWithTimeout(url, { headers: { Authorization: `Bearer ${bearer}` } });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string; status?: string } };
    const message = body.error?.message ?? '';
    if (res.status === 401) token = null;
    if (res.status === 403) throw new SheetReadError('not_shared');
    if (res.status === 404) throw new SheetReadError('not_found');
    if (res.status === 400 && /parse range/i.test(message)) throw new SheetReadError('bad_tab');
    console.error('[sheet] values.get failed', res.status, body.error?.status ?? '');
    throw new SheetReadError('google_error');
  }
  const json = (await res.json().catch(() => ({}))) as { values?: unknown[][] };
  return (json.values ?? []).map((row) => row.map((v) => String(v ?? '')));
}
