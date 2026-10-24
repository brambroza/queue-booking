import { createAdminClient } from '@/lib/supabase/admin';
import { pushMessage } from '@/lib/line/client';
import { followupThanksFlex, winbackFlex } from '@/lib/line/messages-automation';
import { resolveCustomerLiffUrl } from '@/lib/line/liff-url';
import type { AutomationKind } from '@/lib/automation/attribution';

export type AutomationSendResult = {
  sent: boolean;
  reason?: 'not_found' | 'already_sent' | 'no_line_user' | 'no_token' | 'push_failed';
  error?: string;
};

/** Minimal client surface so tests can pass a stub instead of the real admin client. */
export type AutomationClient = ReturnType<typeof createAdminClient>;

type Deps = { admin?: AutomationClient; push?: typeof pushMessage; now?: () => Date };

type ShopForAutomation = {
  company_id: string;
  name: string | null;
  shop_key: string | null;
  line_channel_access_token: string | null;
  liff_id: string | null;
  liff_id_login_shop: string | null;
};

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? v[0] ?? null : v;
}

/** Shop row + channel token + booking link, or the reason we cannot push. */
async function loadShop(admin: AutomationClient, shopId: string) {
  const { data } = await admin
    .from('shops')
    .select('company_id,name,shop_key,line_channel_access_token,liff_id,liff_id_login_shop')
    .eq('id', shopId)
    .maybeSingle();
  const shop = data as ShopForAutomation | null;
  if (!shop) return null;
  const token = shop.line_channel_access_token || process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
  const bookUrl = resolveCustomerLiffUrl({
    shopKey: shop.shop_key,
    liffId: shop.liff_id,
    liffIdLoginShop: shop.liff_id_login_shop,
    tab: 'booking',
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
  });
  return { shop, token, bookUrl: bookUrl ?? null };
}

/** External LINE id for a `line_users` row of this shop. */
async function loadExternalLineId(admin: AutomationClient, shopId: string, lineUserPk: string): Promise<string | null> {
  const { data } = await admin.from('line_users').select('line_user_id').eq('id', lineUserPk).eq('shop_id', shopId).maybeSingle();
  return (data as { line_user_id?: string | null } | null)?.line_user_id ?? null;
}

/** Short name to greet the customer with: nickname, then full name. */
async function loadCustomerName(admin: AutomationClient, shopId: string, customerId: string | null): Promise<string | null> {
  if (!customerId) return null;
  const { data } = await admin.from('customers').select('nickname,full_name').eq('id', customerId).eq('shop_id', shopId).maybeSingle();
  const row = data as { nickname?: string | null; full_name?: string | null } | null;
  return row?.nickname?.trim() || row?.full_name?.trim() || null;
}

/** One `automation_sends` row per attempt; never throws. */
async function recordSend(
  admin: AutomationClient,
  row: {
    companyId: string;
    shopId: string;
    customerId: string | null;
    lineUserPk: string | null;
    kind: AutomationKind;
    sourceBookingId: string | null;
    status: 'sent' | 'failed';
    error?: string;
    at: Date;
  },
) {
  const { error } = await admin.from('automation_sends').insert({
    company_id: row.companyId,
    shop_id: row.shopId,
    customer_id: row.customerId,
    line_user_id: row.lineUserPk,
    kind: row.kind,
    source_booking_id: row.sourceBookingId,
    status: row.status,
    error: row.error ? row.error.slice(0, 300) : null,
    sent_at: row.at.toISOString(),
  });
  if (error) console.warn('[automation] record send failed:', row.kind, error.message);
}

/**
 * Thank-you push for one completed booking. Never throws.
 *
 * The booking is claimed first (`followup_sent_at` set only if still null), so
 * two overlapping cron ticks cannot both send. The claim stays on every
 * outcome — a failed push is recorded and not retried, because retrying a
 * blocked customer would burn the shop's LINE quota every 5 minutes.
 *
 * @param args.reviewUrl - Shop's review link, already validated.
 */
export async function safeSendFollowup(
  args: { shopId: string; bookingId: string; reviewUrl: string | null },
  deps: Deps = {},
): Promise<AutomationSendResult> {
  try {
    const admin = deps.admin ?? createAdminClient();
    const push = deps.push ?? pushMessage;
    const now = (deps.now ?? (() => new Date()))();

    const { data: claimed } = await admin
      .from('bookings')
      .update({ followup_sent_at: now.toISOString() })
      .eq('id', args.bookingId)
      .eq('shop_id', args.shopId)
      .is('followup_sent_at', null)
      .select('id,customer_id,line_user_id,services(service_name)')
      .maybeSingle();
    const booking = claimed as {
      id: string;
      customer_id: string | null;
      line_user_id: string | null;
      services: { service_name?: string | null } | { service_name?: string | null }[] | null;
    } | null;
    if (!booking) return { sent: false, reason: 'already_sent' };
    if (!booking.line_user_id) return { sent: false, reason: 'no_line_user' };

    const loaded = await loadShop(admin, args.shopId);
    if (!loaded) return { sent: false, reason: 'not_found' };
    if (!loaded.token) return { sent: false, reason: 'no_token' };
    const externalId = await loadExternalLineId(admin, args.shopId, booking.line_user_id);
    if (!externalId) return { sent: false, reason: 'no_line_user' };

    const message = followupThanksFlex({
      shopName: loaded.shop.name ?? 'Queue Booking',
      service: one(booking.services)?.service_name ?? '-',
      customerName: await loadCustomerName(admin, args.shopId, booking.customer_id),
      reviewUrl: args.reviewUrl,
      bookUrl: loaded.bookUrl,
    });

    const base = {
      companyId: loaded.shop.company_id,
      shopId: args.shopId,
      customerId: booking.customer_id,
      lineUserPk: booking.line_user_id,
      kind: 'followup' as const,
      sourceBookingId: booking.id,
      at: now,
    };
    try {
      await push(loaded.token, externalId, [message]);
    } catch (e) {
      const error = e instanceof Error ? e.message : 'LINE push failed';
      await recordSend(admin, { ...base, status: 'failed', error });
      return { sent: false, reason: 'push_failed', error };
    }
    await recordSend(admin, { ...base, status: 'sent' });
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: 'push_failed', error: e instanceof Error ? e.message : 'follow-up failed' };
  }
}

/**
 * "We miss you" push to one overdue customer. Never throws. The cooldown is
 * enforced by the caller from `automation_sends`; this records every attempt
 * (sent or failed) so a failing customer is not retried before the cooldown.
 */
export async function safeSendWinback(
  args: { shopId: string; customerId: string; lineUserPk: string; lastService: string | null; daysSince: number },
  deps: Deps = {},
): Promise<AutomationSendResult> {
  try {
    const admin = deps.admin ?? createAdminClient();
    const push = deps.push ?? pushMessage;
    const now = (deps.now ?? (() => new Date()))();

    const loaded = await loadShop(admin, args.shopId);
    if (!loaded) return { sent: false, reason: 'not_found' };
    if (!loaded.token) return { sent: false, reason: 'no_token' };
    const externalId = await loadExternalLineId(admin, args.shopId, args.lineUserPk);
    if (!externalId) return { sent: false, reason: 'no_line_user' };

    const message = winbackFlex({
      shopName: loaded.shop.name ?? 'Queue Booking',
      customerName: await loadCustomerName(admin, args.shopId, args.customerId),
      lastService: args.lastService,
      daysSince: args.daysSince,
      bookUrl: loaded.bookUrl,
    });

    const base = {
      companyId: loaded.shop.company_id,
      shopId: args.shopId,
      customerId: args.customerId,
      lineUserPk: args.lineUserPk,
      kind: 'winback' as const,
      sourceBookingId: null,
      at: now,
    };
    try {
      await push(loaded.token, externalId, [message]);
    } catch (e) {
      const error = e instanceof Error ? e.message : 'LINE push failed';
      await recordSend(admin, { ...base, status: 'failed', error });
      return { sent: false, reason: 'push_failed', error };
    }
    await recordSend(admin, { ...base, status: 'sent' });
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: 'push_failed', error: e instanceof Error ? e.message : 'win-back failed' };
  }
}
