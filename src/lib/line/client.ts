import { isLineQuotaExceeded } from './quota';

/** A failed LINE Messaging API call, keeping the status so callers can tell a quota 429 from the rest. */
export class LineApiError extends Error {
  readonly status: number;
  readonly body: string;
  readonly quotaExceeded: boolean;

  constructor(kind: 'push' | 'reply', status: number, body: string) {
    super(`LINE ${kind} failed: ${body}`);
    this.name = 'LineApiError';
    this.status = status;
    this.body = body;
    this.quotaExceeded = isLineQuotaExceeded(status, body);
  }
}

/**
 * Reply to a webhook event. Free: replies never count against the shop's
 * monthly plan, so prefer this whenever a replyToken exists. Up to 5 messages.
 *
 * @throws LineApiError when LINE rejects the call.
 */
export async function replyMessage(channelAccessToken: string, replyToken: string, messages: object[]) {
  const res = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${channelAccessToken}`,
    },
    body: JSON.stringify({ replyToken, messages }),
  });
  if (!res.ok) throw new LineApiError('reply', res.status, await res.text());
}

/**
 * Push to a user. One request = one message against the shop's monthly plan
 * however many message objects (max 5) it carries, so batch cards.
 *
 * When LINE answers "monthly limit reached" the shop is told once a day and the
 * LIFF screen is marked as the fallback (`reportLineQuotaExhausted`); the error
 * is still thrown so every caller keeps its own failure handling.
 *
 * @throws LineApiError when LINE rejects the call.
 */
export async function pushMessage(channelAccessToken: string, to: string, messages: object[]) {
  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${channelAccessToken}`,
    },
    body: JSON.stringify({ to, messages }),
  });
  if (!res.ok) {
    const err = new LineApiError('push', res.status, await res.text());
    if (err.quotaExceeded) {
      try {
        // Lazy: keeps this module free of Supabase for the pure tests that inject a fake push.
        const { reportLineQuotaExhausted } = await import('./quota-server');
        await reportLineQuotaExhausted(channelAccessToken);
      } catch (e) {
        console.warn('[line] quota report failed:', e instanceof Error ? e.message : e);
      }
    }
    throw err;
  }
}
