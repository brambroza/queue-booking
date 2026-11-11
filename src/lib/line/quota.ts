/**
 * LINE Messaging API quota rules (pure, no I/O).
 *
 * A shop's LINE OA plan caps how many *push* messages it may send per month;
 * replies to a customer's own message are free and unlimited. When the cap is
 * hit LINE answers every push with HTTP 429 and the customer hears nothing,
 * so the app has to notice, tell the shop, and keep the LIFF screen as the
 * fallback.
 */

/** Body LINE returns with 429 once the monthly plan is used up. */
const MONTHLY_LIMIT_RE = /monthly limit|quota/i;

/**
 * Whether a failed LINE API call means "monthly push quota used up" rather
 * than a transient rate limit (both are 429).
 *
 * @param status - HTTP status of the LINE response.
 * @param body - Response body text.
 */
export function isLineQuotaExceeded(status: number, body: string): boolean {
  return status === 429 && MONTHLY_LIMIT_RE.test(body ?? '');
}

/** What LINE's quota endpoints say about a channel this month. */
export type LineQuota = {
  /** `limited` = a monthly cap applies; `none` = unlimited plan. */
  type: 'limited' | 'none';
  limit: number | null;
  used: number;
};

/**
 * Parse the two LINE responses (`GET /v2/bot/message/quota` and
 * `/quota/consumption`) into one shape.
 *
 * @param quota - Body of `/message/quota`, e.g. `{ type: 'limited', value: 200 }`.
 * @param consumption - Body of `/message/quota/consumption`, e.g. `{ totalUsage: 123 }`.
 */
export function parseLineQuota(quota: unknown, consumption: unknown): LineQuota | null {
  const q = quota as { type?: unknown; value?: unknown } | null;
  const c = consumption as { totalUsage?: unknown } | null;
  if (!q || (q.type !== 'limited' && q.type !== 'none')) return null;
  const used = Number(c?.totalUsage ?? 0);
  const limit = q.type === 'limited' && Number.isFinite(Number(q.value)) ? Number(q.value) : null;
  return { type: q.type, limit, used: Number.isFinite(used) && used >= 0 ? Math.floor(used) : 0 };
}

/** Thresholds (percent of the plan) at which the shop is warned, once per month each. */
export const LINE_QUOTA_WARN_THRESHOLDS = [80, 100] as const;
export type LineQuotaWarnThreshold = (typeof LINE_QUOTA_WARN_THRESHOLDS)[number];

/**
 * Highest warning threshold the usage has reached, or null when under 80 % or
 * on an unlimited plan.
 *
 * @param quota - Parsed quota.
 */
export function lineQuotaThreshold(quota: LineQuota | null): LineQuotaWarnThreshold | null {
  if (!quota || quota.type !== 'limited' || !quota.limit || quota.limit <= 0) return null;
  const pct = (quota.used / quota.limit) * 100;
  let hit: LineQuotaWarnThreshold | null = null;
  for (const t of LINE_QUOTA_WARN_THRESHOLDS) if (pct >= t) hit = t;
  return hit;
}

/** `YYYY-MM` in Asia/Bangkok — LINE resets the counter on the 1st (JST, close enough). */
export function lineQuotaPeriod(now: Date): string {
  const bangkok = new Date(now.getTime() + 7 * 3_600_000);
  return bangkok.toISOString().slice(0, 7);
}

/**
 * Whether an exhaustion stamp still applies: LINE resets the cap monthly, so a
 * stamp from a previous period is stale.
 *
 * @param exhaustedAt - `shops.line_quota_exhausted_at`.
 * @param now - Current time.
 */
export function isLineDeliveryPaused(exhaustedAt: string | null | undefined, now: Date): boolean {
  if (!exhaustedAt) return false;
  const t = new Date(exhaustedAt);
  if (Number.isNaN(t.getTime())) return false;
  return lineQuotaPeriod(t) === lineQuotaPeriod(now);
}

/** Staff bell / email wording for a threshold. */
export function lineQuotaWarnText(threshold: LineQuotaWarnThreshold, quota: LineQuota): { title: string; message: string } {
  const used = quota.used.toLocaleString('th-TH');
  const limit = (quota.limit ?? 0).toLocaleString('th-TH');
  if (threshold >= 100) {
    return {
      title: 'ข้อความ LINE ของร้านหมดโควตาเดือนนี้',
      message: `ใช้ไป ${used}/${limit} ข้อความ — ลูกค้าจะไม่ได้รับการ์ดยืนยัน/QR/ใบเสร็จทาง LINE จนกว่าจะขึ้นเดือนใหม่หรือเพิ่มแพ็กเกจ LINE OA ลูกค้ายังดูคิวและชำระเงินได้ในหน้า LIFF`,
    };
  }
  return {
    title: `ข้อความ LINE ของร้านใช้ไปแล้ว ${threshold}%`,
    message: `ใช้ไป ${used}/${limit} ข้อความของเดือนนี้ — ถ้าหมด ลูกค้าจะไม่ได้รับข้อความจากร้านทาง LINE พิจารณาเพิ่มแพ็กเกจ LINE OA`,
  };
}
