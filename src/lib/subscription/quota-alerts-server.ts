/**
 * Send booking-quota alerts: notification centre, the owner's linked LINE and
 * email, and the GoAlong team (email + Sales Inbox lead). Deduped by querying `notifications`, like the slip provider
 * alert, so no extra state is needed. Never throws — a booking must not fail
 * because an alert did.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { safeCreateNotification } from '@/lib/notifications/createNotification';
import { safePushOwnerLine } from '@/lib/line/owner-line-server';
import { sendCustomerEmail } from '@/lib/notifications/customer-email';
import { sendSalesEmail } from '@/lib/notifications/sales-email';
import { FALLBACK_OWNER_NAME, resolveShopOwnerContact } from '@/lib/notifications/shop-owner-contact';
import { buildAdminQuotaEmail, buildOwnerQuotaEmail, nextPlanCode } from '@/lib/notifications/quota-emails';
import { createUpgradeRequest } from '@/lib/subscription/upgrade-request';
import { bangkokMonthStartIso } from '@/lib/automation/cap';
import {
  QUOTA_EXCEEDED_TYPE,
  QUOTA_NEAR_LIMIT_TYPE,
  bangkokDayStartIso,
  crossedQuotaThreshold,
  ownerQuotaLineText,
  quotaExceededText,
  quotaThresholdText,
  type QuotaAlertThreshold,
  type QuotaRefusalSource,
} from './quota-alerts';

type ShopRef = { companyId: string; shopId: string };

async function shopName(admin: SupabaseClient, shopId: string): Promise<string> {
  const { data } = await admin.from('shops').select('name').eq('id', shopId).maybeSingle();
  return (data as { name?: string | null } | null)?.name ?? 'ร้านของคุณ';
}

type ThresholdArgs = ShopRef & {
  before: number;
  after: number;
  limit: number | null;
  /** `yyyy-mm` of the booking month. */
  period: string;
  /** Effective plan code, for the emails. */
  planCode?: string | null;
};

/**
 * Alert once per threshold (80 / 90 / 100 %) per quota month when a new
 * booking pushes usage across it: bell + owner LINE + owner email, then the
 * GoAlong team (email + one Sales Inbox lead per month).
 *
 * Two bookings landing together can both pass the dedup query; only the
 * earliest notification row goes on to LINE and email, so the owner never gets
 * the same email twice.
 *
 * @param admin - Service-role client.
 * @returns The threshold alerted, or null.
 */
export async function safeNotifyQuotaThreshold(admin: SupabaseClient, args: ThresholdArgs): Promise<number | null> {
  try {
    const threshold = crossedQuotaThreshold(args.before, args.after, args.limit);
    if (threshold === null || args.limit === null) return null;

    const sameAlert = () =>
      admin
        .from('notifications')
        .select('id', { count: 'exact' })
        .eq('shop_id', args.shopId)
        .eq('type', QUOTA_NEAR_LIMIT_TYPE)
        .eq('metadata->>period', args.period)
        .eq('metadata->>threshold', String(threshold))
        .order('created_at', { ascending: true })
        .limit(1);

    const { count, error } = await sameAlert();
    if (error) throw new Error(error.message);
    if ((count ?? 0) > 0) return null;

    const text = quotaThresholdText({ threshold, used: args.after, limit: args.limit, period: args.period });
    const created = await safeCreateNotification(admin, {
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
    if (!created) return null;
    const { data: first } = await sameAlert();
    if (first?.[0] && (first[0] as { id: string }).id !== created.id) return null;

    await sendThresholdMessages(admin, { ...args, limit: args.limit, threshold, text });
    return threshold;
  } catch (e) {
    console.error('[quota-alert] threshold notify failed:', e instanceof Error ? e.message : e);
    return null;
  }
}

/** LINE + owner email in parallel, then the team email + lead. Never throws. */
async function sendThresholdMessages(
  admin: SupabaseClient,
  args: ThresholdArgs & { limit: number; threshold: QuotaAlertThreshold; text: { title: string; message: string } },
): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? null;
  const [{ data: shopRow }, owner] = await Promise.all([
    admin.from('shops').select('name,shop_key,phone').eq('id', args.shopId).maybeSingle(),
    resolveShopOwnerContact(admin, args.shopId).catch(() => ({ name: FALLBACK_OWNER_NAME, email: null })),
  ]);
  const shop = (shopRow as { name?: string | null; shop_key?: string | null; phone?: string | null } | null) ?? {};
  const name = shop.name ?? 'ร้านของคุณ';
  const emailInput = {
    ownerName: owner.name,
    shopName: name,
    shopKey: shop.shop_key ?? null,
    threshold: args.threshold,
    used: args.after,
    limit: args.limit,
    period: args.period,
    planCode: args.planCode ?? null,
    appUrl,
  };

  const [line, ownerEmail] = await Promise.all([
    safePushOwnerLine(admin, args.shopId, ownerQuotaLineText(args.text, name, appUrl)),
    owner.email
      ? sendCustomerEmail({ to: owner.email, ...buildOwnerQuotaEmail(emailInput) })
      : Promise.resolve(null),
  ]);
  if (ownerEmail && !ownerEmail.ok) console.warn('[quota-alert] owner email failed:', ownerEmail.reason);

  await createQuotaLeadOnce(admin, args, { shopName: name, phone: shop.phone ?? null, email: owner.email, contactName: owner.name });

  const team = buildAdminQuotaEmail({
    ...emailInput,
    ownerEmail: owner.email,
    ownerPhone: shop.phone ?? null,
    ownerEmailStatus: !owner.email ? 'no_email' : ownerEmail?.ok ? 'sent' : 'failed',
    ownerLineStatus: line.sent ? 'sent' : line.reason === 'push_failed' ? 'failed' : 'not_linked',
  });
  const teamSent = await sendSalesEmail({ subject: team.subject, html: team.html });
  if (!teamSent) console.warn('[quota-alert] team email not sent (SALES_NOTIFY_EMAIL / SMTP?)');
}

/** One Sales Inbox lead per shop per Bangkok month (shared with the automation page's quota_80 lead). */
async function createQuotaLeadOnce(
  admin: SupabaseClient,
  args: ThresholdArgs & { limit: number; threshold: QuotaAlertThreshold },
  contact: { shopName: string; phone: string | null; email: string | null; contactName: string },
): Promise<void> {
  try {
    const { data: existing } = await admin
      .from('upgrade_requests')
      .select('id')
      .eq('shop_id', args.shopId)
      .eq('source', 'quota_80')
      .gte('created_at', bangkokMonthStartIso(new Date()))
      .limit(1)
      .maybeSingle();
    if (existing) return;
    await createUpgradeRequest(admin, {
      companyId: args.companyId,
      shopId: args.shopId,
      requestedPlanCode: nextPlanCode(args.planCode) ?? 'enterprise',
      currentPlanCode: args.planCode ?? null,
      contactName: contact.contactName,
      phone: contact.phone,
      email: contact.email,
      shopName: contact.shopName,
      note: `ใช้คิวไปแล้ว ${args.after}/${args.limit} (${args.threshold}%) ของเดือน ${args.period} (ระบบสร้างอัตโนมัติ)`,
      source: 'quota_80',
      notifySales: false,
    });
  } catch (e) {
    console.warn('[quota-alert] lead failed:', e instanceof Error ? e.message : e);
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
