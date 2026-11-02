/**
 * Send booking-quota alerts to the shop: notification centre + the owner's
 * linked LINE. Deduped by querying `notifications`, like the slip provider
 * alert, so no extra state is needed. Never throws — a booking must not fail
 * because an alert did.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { safeCreateNotification } from '@/lib/notifications/createNotification';
import { safePushOwnerLine } from '@/lib/line/owner-line-server';
import {
  QUOTA_EXCEEDED_TYPE,
  QUOTA_NEAR_LIMIT_TYPE,
  bangkokDayStartIso,
  crossedQuotaThreshold,
  ownerQuotaLineText,
  quotaExceededText,
  quotaThresholdText,
  type QuotaRefusalSource,
} from './quota-alerts';

type ShopRef = { companyId: string; shopId: string };

async function shopName(admin: SupabaseClient, shopId: string): Promise<string> {
  const { data } = await admin.from('shops').select('name').eq('id', shopId).maybeSingle();
  return (data as { name?: string | null } | null)?.name ?? 'ร้านของคุณ';
}

/**
 * Alert once per threshold (80 / 90 / 100 %) per quota month when a new
 * booking pushes usage across it.
 *
 * Two bookings landing at the same instant can both pass the dedup query and
 * alert twice; rare and harmless, so no lock.
 *
 * @param admin - Service-role client.
 * @param args.before - Month bookings before this order.
 * @param args.after - Month bookings after this order.
 * @param args.limit - Monthly limit (null = unlimited).
 * @param args.period - `yyyy-mm` of the booking month.
 * @returns The threshold alerted, or null.
 */
export async function safeNotifyQuotaThreshold(
  admin: SupabaseClient,
  args: ShopRef & { before: number; after: number; limit: number | null; period: string },
): Promise<number | null> {
  try {
    const threshold = crossedQuotaThreshold(args.before, args.after, args.limit);
    if (threshold === null || args.limit === null) return null;

    const { count, error } = await admin
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', args.shopId)
      .eq('type', QUOTA_NEAR_LIMIT_TYPE)
      .eq('metadata->>period', args.period)
      .eq('metadata->>threshold', String(threshold));
    if (error) throw new Error(error.message);
    if ((count ?? 0) > 0) return null;

    const text = quotaThresholdText({ threshold, used: args.after, limit: args.limit, period: args.period });
    await safeCreateNotification(admin, {
      companyId: args.companyId,
      shopId: args.shopId,
      type: QUOTA_NEAR_LIMIT_TYPE,
      category: 'billing',
      priority: threshold >= 90 ? 'high' : 'medium',
      title: text.title,
      message: text.message,
      actionUrl: '/portal/settings',
      metadata: { feature: 'bookings', period: args.period, threshold: String(threshold), used: args.after, limit: args.limit },
    });
    await safePushOwnerLine(admin, args.shopId, ownerQuotaLineText(text, await shopName(admin, args.shopId), process.env.NEXT_PUBLIC_APP_URL));
    return threshold;
  } catch (e) {
    console.error('[quota-alert] threshold notify failed:', e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Alert that a booking was refused for quota (or a suspended plan), at most
 * once per shop per Bangkok day — a busy LIFF would otherwise raise one per tap.
 *
 * @param admin - Service-role client.
 * @param args.source - `liff` (customer) or `staff` (portal).
 * @param args.inactive - Plan suspended rather than out of quota.
 * @param args.metadata - Extra detail kept on the notification.
 * @returns True when an alert was raised.
 */
export async function safeNotifyQuotaExceeded(
  admin: SupabaseClient,
  args: ShopRef & { source: QuotaRefusalSource; inactive?: boolean; metadata?: Record<string, unknown>; now?: Date },
): Promise<boolean> {
  try {
    const { count, error } = await admin
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', args.shopId)
      .eq('type', QUOTA_EXCEEDED_TYPE)
      .gte('created_at', bangkokDayStartIso(args.now ?? new Date()));
    if (error) throw new Error(error.message);
    if ((count ?? 0) > 0) return false;

    const text = quotaExceededText(args.source, args.inactive);
    await safeCreateNotification(admin, {
      companyId: args.companyId,
      shopId: args.shopId,
      type: QUOTA_EXCEEDED_TYPE,
      category: 'system',
      priority: 'high',
      title: text.title,
      message: text.message,
      actionUrl: '/portal/settings',
      metadata: { feature: 'bookings', source: args.source, ...args.metadata },
    });
    await safePushOwnerLine(admin, args.shopId, ownerQuotaLineText(text, await shopName(admin, args.shopId), process.env.NEXT_PUBLIC_APP_URL));
    return true;
  } catch (e) {
    console.error('[quota-alert] exceeded notify failed:', e instanceof Error ? e.message : e);
    return false;
  }
}
