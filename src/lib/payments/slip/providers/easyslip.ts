/**
 * EasySlip adapter (https://document.easyslip.com, API v2).
 *
 * The only file that knows EasySlip's field names. Every literal below was
 * read off the public docs on 2026-10-09; lines marked `VERIFY` are the ones a
 * real key should confirm first (the PromptPay proxy shape in particular has no
 * example in the docs).
 *
 * Only the decoded QR payload is sent — never the image — so no customer photo
 * leaves our storage and the cheapest vendor path is used.
 */
import { z } from 'zod';
import type { SlipProviderResult } from '../provider';
import {
  SlipProviderError,
  fetchWithTimeout,
  pickAmount,
  pickString,
  sanitizeRaw,
  type SlipProviderAdapter,
  type SlipProviderConfig,
} from './types';

const DEFAULT_BASE_URL = 'https://api.easyslip.com/v2';

/** Endpoint paths — VERIFY: docs show `POST /verify/bank` for the payload method and `GET /info` for quota. */
const PATH = { verifyBank: '/verify/bank', info: '/info' } as const;

const credentialsSchema = z.object({ apiKey: z.string().trim().min(16).max(200) });
type EasySlipCredentials = z.infer<typeof credentialsSchema>;

/** Keys stripped from the stored echo: anything that names a person. */
const RAW_DROP_KEYS = ['name', 'th', 'en', 'remark', 'ref1', 'ref2', 'ref3', 'payload'] as const;

function baseUrl(): string {
  return (process.env.EASYSLIP_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

function apiKey(config: SlipProviderConfig): string {
  return (config.credentials as EasySlipCredentials).apiKey;
}

function headers(config: SlipProviderConfig): Record<string, string> {
  return { Authorization: `Bearer ${apiKey(config)}`, 'Content-Type': 'application/json', Accept: 'application/json' };
}

async function readJson(res: Response): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await res.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** VERIFY: errors arrive as `{ success: false, error: { code, message } }`. */
function errorCode(body: Record<string, unknown> | null): string | null {
  const err = body?.error;
  return pickString(err, ['code']);
}

/**
 * Map a non-2xx answer to either a benign result (not found / pending) or a
 * thrown `SlipProviderError`. Codes from docs/en/reference/error-codes.
 */
function mapFailure(status: number, code: string | null): SlipProviderResult | never {
  if (status === 404 && code === 'SLIP_NOT_FOUND') return emptyResult({ found: false, pending: false });
  if (status === 404 && code === 'SLIP_PENDING') return emptyResult({ found: false, pending: true });
  if (status === 401) throw new SlipProviderError('invalid_api_key', status);
  if (status === 403 && code === 'QUOTA_EXCEEDED') throw new SlipProviderError('quota_exceeded', status);
  if (status === 403) throw new SlipProviderError('invalid_api_key', status); // BRANCH_INACTIVE, IP_NOT_ALLOWED, SERVICE_* — all need the owner, not a retry
  if (status === 429) throw new SlipProviderError('rate_limited', status);
  if (status === 400) throw new SlipProviderError('bad_response', status);
  throw new SlipProviderError('http_error', status);
}

function emptyResult(flags: { found: boolean; pending: boolean }): SlipProviderResult {
  return {
    ...flags,
    amountTHB: null,
    receiverAccount: null,
    receiverProxy: null,
    receiverName: null,
    senderName: null,
    senderBank: null,
    transferredAt: null,
    duplicate: null,
    raw: null,
  };
}

type Party = Record<string, unknown> | null;

function party(raw: Record<string, unknown>, key: 'sender' | 'receiver'): Party {
  const value = raw[key];
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function partyAccount(p: Party): Record<string, unknown> | null {
  const account = p?.account;
  return account && typeof account === 'object' ? (account as Record<string, unknown>) : null;
}

/** `account.name.th ?? account.name.en`. */
function partyName(p: Party): string | null {
  const name = partyAccount(p)?.name;
  return pickString(name, ['th', 'en']);
}

/** `account.bank.account` — masked bank account number, e.g. "xxx-x-x5678-x". */
function partyBankAccount(p: Party): string | null {
  return pickString(partyAccount(p)?.bank, ['account']);
}

/** `account.proxy.account` — masked PromptPay proxy. VERIFY: shape assumed to mirror `bank` ({ type, account }). */
function partyProxy(p: Party): string | null {
  return pickString(partyAccount(p)?.proxy, ['account', 'value']);
}

function partyBankShort(p: Party): string | null {
  return pickString(p?.bank, ['short', 'id']);
}

/**
 * Turn a 200 body into our result. Throws `bad_response` when the body is not
 * about the slip we asked for — the one check that protects against a vendor
 * answering from the wrong record.
 */
function mapSuccess(body: Record<string, unknown>, expectedTransRef: string): SlipProviderResult {
  const data = body.data && typeof body.data === 'object' ? (body.data as Record<string, unknown>) : null;
  const slip = data?.rawSlip && typeof data.rawSlip === 'object' ? (data.rawSlip as Record<string, unknown>) : null;
  if (!slip) throw new SlipProviderError('bad_response', 200);

  const transRef = pickString(slip, ['transRef']);
  if (transRef && transRef.toUpperCase() !== expectedTransRef.toUpperCase()) throw new SlipProviderError('bad_response', 200);

  const amount = slip.amount && typeof slip.amount === 'object' ? (slip.amount as Record<string, unknown>) : null;
  const amountTHB = pickAmount(amount, ['amount']) ?? pickAmount(data, ['amountInSlip']);

  const sender = party(slip, 'sender');
  const receiver = party(slip, 'receiver');
  const duplicate = typeof data?.isDuplicate === 'boolean' ? data.isDuplicate : null;

  return {
    found: true,
    pending: false,
    amountTHB,
    receiverAccount: partyBankAccount(receiver),
    receiverProxy: partyProxy(receiver),
    receiverName: partyName(receiver),
    senderName: partyName(sender),
    senderBank: partyBankShort(sender),
    transferredAt: pickString(slip, ['date']),
    duplicate,
    raw: sanitizeRaw({ transRef, date: slip.date, amount: slip.amount, sender, receiver, isDuplicate: duplicate }, RAW_DROP_KEYS),
  };
}

export const easyslipAdapter: SlipProviderAdapter = {
  id: 'easyslip',
  displayName: 'EasySlip',

  parseCredentials(input: unknown): EasySlipCredentials {
    return credentialsSchema.parse(input);
  },

  credentialsHint(credentials: unknown): string {
    return credentialsSchema.parse(credentials).apiKey.slice(-4);
  },

  async verify(config, input) {
    const res = await fetchWithTimeout(`${baseUrl()}${PATH.verifyBank}`, {
      method: 'POST',
      headers: headers(config),
      // checkDuplicate stays off: our cross-tenant DB check is the authority, and
      // asking the vendor would false-positive on every scheduled recheck.
      body: JSON.stringify({ payload: input.payload, checkDuplicate: false }),
    });
    const body = await readJson(res);
    if (!res.ok) {
      const code = errorCode(body);
      console.error('[slip] easyslip', code ?? 'no_code', res.status);
      return mapFailure(res.status, code);
    }
    if (!body || body.success === false) throw new SlipProviderError('bad_response', res.status);
    return mapSuccess(body, input.transRef);
  },

  /** `GET /info` does not spend quota — the docs say so explicitly. */
  async testConnection(config) {
    const res = await fetchWithTimeout(`${baseUrl()}${PATH.info}`, { method: 'GET', headers: headers(config) });
    const body = await readJson(res);
    if (!res.ok) {
      const code = errorCode(body);
      console.error('[slip] easyslip info', code ?? 'no_code', res.status);
      if (res.status === 401 || res.status === 403) throw new SlipProviderError('invalid_api_key', res.status);
      if (res.status === 429) throw new SlipProviderError('rate_limited', res.status);
      throw new SlipProviderError('http_error', res.status);
    }
    const data = body?.data && typeof body.data === 'object' ? (body.data as Record<string, unknown>) : null;
    const application = data?.application && typeof data.application === 'object' ? (data.application as Record<string, unknown>) : null;
    const remaining = pickAmount(application?.quota, ['remaining']);
    return { ok: true, detail: remaining === null ? undefined : `เหลือโควต้า ${remaining.toLocaleString('th-TH')} ครั้ง` };
  },
};
