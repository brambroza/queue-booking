import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { cached } from '@/lib/cache/kv';
import { safeCreateNotification } from '@/lib/notifications/createNotification';
import { sendCustomerEmail } from '@/lib/notifications/customer-email';
import { resolveShopOwnerContact } from '@/lib/notifications/shop-owner-contact';
import { escapeHtml } from '@/lib/notifications/sales-email';
import { layout, p } from '@/lib/notifications/onboarding-emails';
import { safePushOwnerLine } from '@/lib/line/owner-line-server';
import {
  isLineDeliveryPaused,
  lineQuotaPeriod,
  lineQuotaThreshold,
  lineQuotaWarnText,
  parseLineQuota,
  type LineQuota,
  type LineQuotaWarnThreshold,
} from './quota';

/**
 * Server side of the LINE push quota (rules in `quota.ts`).
 *
 * Columns `shops.line_quota_*` come from migration 202611110001. Every read
 * and write here is defensive: before the migration the readout says
 * "ยังไม่พร้อม", nothing is stamped, and pushes behave as before.
 */

export const LINE_QUOTA_EXHAUSTED_TYPE = 'line_quota_exhausted';
export const LINE_QUOTA_NEAR_LIMIT_TYPE = 'line_quota_near_limit';

const QUOTA_COLUMNS = 'line_quota_exhausted_at,line_quota_checked_at,line_quota_used,line_quota_limit,line_quota_type';

export type LineQuotaState = {
  available: boolean;
  quota: LineQuota | null;
  checked_at: string | null;
  exhausted_at: string | null;
  /** True while the exhaustion stamp is from the current month. */
  paused: boolean;
};

type QuotaRow = {
  line_quota_exhausted_at: string | null;
  line_quota_checked_at: string | null;
  line_quota_used: number | null;
  line_quota_limit: number | null;
  line_quota_type: string | null;
};

/** Start of today in Asia/Bangkok as ISO, for once-a-day dedupe. */
function bangkokDayStart(now: Date): string {
  const bangkok = new Date(now.getTime() + 7 * 3_600_000);
  return `${bangkok.toISOString().slice(0, 10)}T00:00:00+07:00`;
}

/** Start of this month in Asia/Bangkok as ISO, for once-a-month dedupe. */
function bangkokMonthStart(now: Date): string {
  return `${lineQuotaPeriod(now)}-01T00:00:00+07:00`;
}

/** Read the stored quota columns; null when the migration has not run. */
async function readQuotaRow(admin: SupabaseClient, shopId: string): Promise<QuotaRow | null> {
  const { data, error } = await admin.from('shops').select(QUOTA_COLUMNS).eq('id', shopId).maybeSingle();
  if (error || !data) return null;
  return data as QuotaRow;
}

/**
 * Stored quota state for a shop (no LINE call). Used by `/meta` and the LIFF
 * banner; never throws.
 */
export async function getLineQuotaState(admin: SupabaseClient, shopId: string, now = new Date()): Promise<LineQuotaState> {
  try {
    const row = await readQuotaRow(admin, shopId);
    if (!row) return { available: false, quota: null, checked_at: null, exhausted_at: null, paused: false };
    const quota: LineQuota | null =
      row.line_quota_type === 'limited' || row.line_quota_type === 'none'
        ? { type: row.line_quota_type, limit: row.line_quota_limit, used: Number(row.line_quota_used ?? 0) }
        : null;
    return {
      available: true,
      quota,
      checked_at: row.line_quota_checked_at,
      exhausted_at: row.line_quota_exhausted_at,
      paused: isLineDeliveryPaused(row.line_quota_exhausted_at, now),
    };
  } catch {
    return { available: false, quota: null, checked_at: null, exhausted_at: null, paused: false };
  }
}

/**
 * Whether LINE delivery is known to be paused for this shop this month.
 * Cached 60 s (every LIFF open asks).
 */
export async function isLineDeliveryPausedCached(admin: SupabaseClient, shopId: string): Promise<boolean> {
  try {
    return await cached(`line-paused:${shopId}`, { ttlSeconds: 60 }, async () => (await getLineQuotaState(admin, shopId)).paused);
  } catch {
    return false;
  }
}

/**
 * Ask LINE for the channel's monthly cap and usage. Both calls are free (they
 * are not messages). Null when the token is bad or LINE is down.
 *
 * @param token - Shop channel access token.
 */
export async function fetchLineQuota(token: string): Promise<LineQuota | null> {
  if (!token) return null;
  const headers = { Authorization: `Bearer ${token}` };
  try {
    const [q, c] = await Promise.all([
      fetch('https://api.line.me/v2/bot/message/quota', { headers, signal: AbortSignal.timeout(5_000) }),
      fetch('https://api.line.me/v2/bot/message/quota/consumption', { headers, signal: AbortSignal.timeout(5_000) }),
    ]);
    if (!q.ok || !c.ok) return null;
    return parseLineQuota(await q.json(), await c.json());
  } catch {
    return null;
  }
}

/**
 * Refresh the stored quota from LINE and raise the 80 % / 100 % bell once per
 * month each. Cached 10 min per shop so the booking flow can call it freely.
 * Never throws.
 *
 * @returns The fresh state (stored values when LINE could not be reached).
 */
export async function refreshLineQuota(
  admin: SupabaseClient,
  shopId: string,
  opts: { force?: boolean; now?: Date } = {},
): Promise<LineQuotaState> {
  const now = opts.now ?? new Date();
  const run = async (): Promise<LineQuotaState> => {
    const { data: shop } = await admin
      .from('shops')
      .select('company_id,line_channel_access_token')
      .eq('id', shopId)
      .maybeSingle();
    const token = (shop as { line_channel_access_token?: string | null } | null)?.line_channel_access_token ?? '';
    const companyId = (shop as { company_id?: string } | null)?.company_id ?? null;
    const quota = token ? await fetchLineQuota(token) : null;
    if (quota) {
      const exhausted = quota.type === 'limited' && quota.limit !== null && quota.used >= quota.limit;
      const patch: Record<string, unknown> = {
        line_quota_checked_at: now.toISOString(),
        line_quota_used: quota.used,
        line_quota_limit: quota.limit,
        line_quota_type: quota.type,
      };
      const current = await readQuotaRow(admin, shopId);
      if (exhausted && !isLineDeliveryPaused(current?.line_quota_exhausted_at, now)) patch.line_quota_exhausted_at = now.toISOString();
      // Usage below the cap again (new month / plan upgrade) lifts the pause.
      if (!exhausted && current?.line_quota_exhausted_at) patch.line_quota_exhausted_at = null;
      const { error } = await admin.from('shops').update(patch).eq('id', shopId);
      if (error) console.warn('[line-quota] store skipped:', error.message);
      const threshold = lineQuotaThreshold(quota);
      if (threshold && companyId) await notifyLineQuotaThresholdOnce(admin, { companyId, shopId, threshold, quota, now });
    }
    return getLineQuotaState(admin, shopId, now);
  };
  try {
    if (opts.force) return await run();
    return await cached(`line-quota:${shopId}`, { ttlSeconds: 600 }, run);
  } catch (e) {
    console.warn('[line-quota] refresh failed:', e instanceof Error ? e.message : e);
    return getLineQuotaState(admin, shopId, now);
  }
}

/** Bell for 80 % / 100 %, once per shop per threshold per Bangkok month. */
async function notifyLineQuotaThresholdOnce(
  admin: SupabaseClient,
  opts: { companyId: string; shopId: string; threshold: LineQuotaWarnThreshold; quota: LineQuota; now: Date },
): Promise<boolean> {
  try {
    const { count, error } = await admin
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', opts.shopId)
      .eq('type', LINE_QUOTA_NEAR_LIMIT_TYPE)
      .eq('metadata->>threshold', String(opts.threshold))
      .gte('created_at', bangkokMonthStart(opts.now));
    if (error) throw new Error(error.message);
    if ((count ?? 0) > 0) return false;
    const text = lineQuotaWarnText(opts.threshold, opts.quota);
    await safeCreateNotification(admin, {
      companyId: opts.companyId,
      shopId: opts.shopId,
      type: LINE_QUOTA_NEAR_LIMIT_TYPE,
      category: 'system',
      priority: opts.threshold >= 100 ? 'high' : 'medium',
      title: text.title,
      message: text.message,
      actionUrl: '/portal/line-settings#line-quota',
      metadata: { threshold: opts.threshold, used: opts.quota.used, limit: opts.quota.limit, period: lineQuotaPeriod(opts.now) },
    });
    return true;
  } catch (e) {
    console.warn('[line-quota] threshold notify failed:', e instanceof Error ? e.message : e);
    return false;
  }
}

/**
 * Called by `pushMessage` when LINE answered "monthly limit reached". Finds the
 * shop by its channel token (the platform OA token matches no shop and is
 * ignored), stamps `line_quota_exhausted_at`, and tells the owner once per
 * Bangkok day: bell, email, and the platform OA (whose pushes do not spend the
 * shop's plan). Never throws.
 *
 * @param token - Channel access token the failed push used.
 */
export async function reportLineQuotaExhausted(token: string, now = new Date()): Promise<void> {
  if (!token || token === (process.env.LINE_CHANNEL_ACCESS_TOKEN ?? '')) return;
  const admin = createAdminClient();
  const { data: shop } = await admin
    .from('shops')
    .select('id,company_id,name')
    .eq('line_channel_access_token', token)
    .eq('is_deleted', false)
    .maybeSingle();
  if (!shop) return;
  const shopId = String(shop.id);
  const companyId = String(shop.company_id);

  const current = await readQuotaRow(admin, shopId);
  if (current && !isLineDeliveryPaused(current.line_quota_exhausted_at, now)) {
    const { error } = await admin.from('shops').update({ line_quota_exhausted_at: now.toISOString() }).eq('id', shopId);
    if (error) console.warn('[line-quota] stamp skipped:', error.message);
  }

  // Once a day is enough — every failed push lands here.
  const { count } = await admin
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('shop_id', shopId)
    .eq('type', LINE_QUOTA_EXHAUSTED_TYPE)
    .gte('created_at', bangkokDayStart(now));
  if ((count ?? 0) > 0) return;

  const shopName = String(shop.name ?? 'ร้านของคุณ');
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '');
  const title = 'ข้อความ LINE ของร้านหมดโควตาเดือนนี้';
  const message =
    'LINE OA ของร้านส่งข้อความถึงลูกค้าไม่ได้แล้วในเดือนนี้ (ครบจำนวนตามแพ็กเกจ) — ลูกค้าที่จองใหม่จะไม่ได้รับการ์ดยืนยัน/QR/ใบเสร็จทาง LINE แต่ยังจองและชำระเงินได้ในหน้า LIFF ตามปกติ เพิ่มแพ็กเกจ LINE OA หรือรอต้นเดือนหน้า';

  await safeCreateNotification(admin, {
    companyId,
    shopId,
    type: LINE_QUOTA_EXHAUSTED_TYPE,
    category: 'system',
    priority: 'critical',
    title,
    message,
    actionUrl: '/portal/line-settings#line-quota',
    metadata: { period: lineQuotaPeriod(now) },
  });

  await safePushOwnerLine(
    admin,
    shopId,
    `[${shopName}] ${title}\n${message}${appUrl ? `\n\nดูรายละเอียด: ${appUrl}/portal/line-settings#line-quota` : ''}`,
    { only: 'platform' },
  );

  try {
    const contact = await resolveShopOwnerContact(admin, shopId);
    if (contact.email) {
      const html = layout(
        [
          p(`เรียนคุณ ${escapeHtml(contact.name)}`),
          p(`<strong>${escapeHtml(title)}</strong> (ร้าน ${escapeHtml(shopName)})`),
          p(escapeHtml(message)),
          p('สิ่งที่ยังทำงานปกติ: ลูกค้ายังจองคิว ดู QR และอัปโหลดสลิปในหน้า LIFF ได้ และข้อความที่ระบบ<u>ตอบกลับ</u>ลูกค้า (เช่น หลังลูกค้าพิมพ์ "เช็คคิวของฉัน") ยังส่งได้ไม่จำกัด'),
          appUrl ? p(`<a href="${appUrl}/portal/line-settings#line-quota">ดูโควตาและวิธีเพิ่มแพ็กเกจ</a>`) : '',
        ].join(''),
      );
      const text = `${title}\nร้าน ${shopName}\n\n${message}\n\n${appUrl ? `${appUrl}/portal/line-settings#line-quota` : ''}`;
      await sendCustomerEmail({ to: contact.email, subject: `[QueueBooking] ${title} — ${shopName}`, html, text });
    }
  } catch (e) {
    console.warn('[line-quota] owner email failed:', e instanceof Error ? e.message : e);
  }
}
