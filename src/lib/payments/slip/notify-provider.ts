/**
 * Tell staff once a day that the slip verification key has a problem.
 *
 * Deduped by querying the notification centre rather than a new column, so it
 * works the same whether the platform key or the shop's own key failed.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { safeCreateNotification } from '@/lib/notifications/createNotification';
import type { SlipProviderErrorCode, SlipProviderSource } from './providers/types';

export const SLIP_PROVIDER_PROBLEM_TYPE = 'slip_provider_problem';

const MESSAGE: Partial<Record<SlipProviderErrorCode, { title: string; message: string }>> = {
  quota_exceeded: {
    title: 'โควต้าตรวจสลิปอัตโนมัติหมด',
    message: 'สลิปใหม่จะเข้าคิวให้ตรวจด้วยตนเองจนกว่าจะเติมโควต้า ระบบจะลองตรวจซ้ำให้อัตโนมัติ',
  },
  invalid_api_key: {
    title: 'API key ตรวจสลิปใช้ไม่ได้',
    message: 'ระบบตรวจสลิปอัตโนมัติหยุดทำงาน กรุณาตรวจ API key ที่หน้า Payment Settings',
  },
};

/** Start of today in Asia/Bangkok, as an ISO string for the created_at filter. */
function bangkokDayStart(now: Date): string {
  const bangkok = new Date(now.getTime() + 7 * 3_600_000);
  const day = bangkok.toISOString().slice(0, 10);
  return `${day}T00:00:00+07:00`;
}

/**
 * Raise a staff notification for a provider problem, at most once per shop per
 * Bangkok day. Never throws.
 */
export async function notifySlipProviderProblemOnce(
  admin: SupabaseClient,
  opts: { companyId: string; shopId: string; source: SlipProviderSource; provider: string; code: SlipProviderErrorCode; now?: Date },
): Promise<boolean> {
  const text = MESSAGE[opts.code];
  if (!text) return false;
  try {
    const { count, error } = await admin
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', opts.shopId)
      .eq('type', SLIP_PROVIDER_PROBLEM_TYPE)
      .gte('created_at', bangkokDayStart(opts.now ?? new Date()));
    if (error) throw new Error(error.message);
    if ((count ?? 0) > 0) return false;

    const suffix = opts.source === 'platform' ? ' (key ของระบบกลาง — แจ้งผู้ดูแลระบบ)' : '';
    await safeCreateNotification(admin, {
      companyId: opts.companyId,
      shopId: opts.shopId,
      type: SLIP_PROVIDER_PROBLEM_TYPE,
      category: 'billing',
      priority: 'high',
      title: text.title,
      message: `${text.message}${suffix}`,
      actionUrl: '/portal/payment-settings#slip-verify',
      metadata: { provider: opts.provider, source: opts.source, code: opts.code },
    });
    return true;
  } catch (e) {
    console.error('[slip] provider problem notify failed:', e instanceof Error ? e.message : e);
    return false;
  }
}
