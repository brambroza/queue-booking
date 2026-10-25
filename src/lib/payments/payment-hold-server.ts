import type { SupabaseClient } from '@supabase/supabase-js';
import { pushMessage } from '@/lib/line/client';
import { bookingPaymentExpiredFlex } from '@/lib/line/messages';
import { resolveCustomerLiffUrl } from '@/lib/line/liff-url';
import { safeCreateNotification } from '@/lib/notifications/createNotification';
import { formatThaiDateLabel } from '@/lib/utils/date-format';
import { PAYMENT_EXPIRED_LOG_ACTION, appendPaymentExpiredNote } from './payment-hold';

/**
 * Server side of the payment hold (see `payment-hold.ts` for the rules).
 * Every function here reads `bookings.payment_hold_booking_id`, which exists
 * only after migration 202610250002 — before that they fail soft and the
 * booking keeps the old behaviour.
 */

type HoldRow = {
  id: string;
  company_id: string;
  branch_id: string | null;
  queue_number: string | null;
  booking_date: string;
  start_time: string;
  status: string;
  note: string | null;
};

const HOLD_ROW_COLUMNS = 'id,company_id,branch_id,queue_number,booking_date,start_time,status,note';

/**
 * Put the queues of a freshly created LIFF order on hold until the paying
 * booking is paid: `confirmed` → `pending_approval`. Never throws.
 *
 * @returns true when the hold was written (false = migration not run or DB error; the booking stays confirmed).
 */
export async function holdBookingsForPayment(
  admin: SupabaseClient,
  opts: { shopId: string; payingBookingId: string; bookingIds: string[] },
): Promise<boolean> {
  try {
    const { data, error } = await admin
      .from('bookings')
      .update({ status: 'pending_approval', payment_hold_booking_id: opts.payingBookingId })
      .in('id', opts.bookingIds)
      .eq('shop_id', opts.shopId)
      .eq('status', 'confirmed')
      .select('id');
    if (error) {
      console.warn('[payment-hold] hold skipped:', error.message);
      return false;
    }
    return (data ?? []).length > 0;
  } catch (e) {
    console.warn('[payment-hold] hold skipped:', e instanceof Error ? e.message : e);
    return false;
  }
}

/**
 * The paying booking was just marked paid: confirm every queue of its order
 * still on hold. A queue the cron already cancelled is not revived — staff get
 * a high-priority notice to refund or rebook by hand. Never throws.
 *
 * Call it from every path that sets `payment_status = 'paid'`, before the receipt push.
 */
export async function releasePaymentHold(
  admin: SupabaseClient,
  opts: { shopId: string; bookingId: string },
): Promise<void> {
  try {
    const { data, error } = await admin
      .from('bookings')
      .select(HOLD_ROW_COLUMNS)
      .eq('shop_id', opts.shopId)
      .eq('payment_hold_booking_id', opts.bookingId)
      .eq('is_deleted', false);
    if (error) return;
    const rows = (data ?? []) as HoldRow[];
    if (rows.length === 0) return;

    const held = rows.filter((r) => r.status === 'pending_approval');
    if (held.length > 0) {
      await admin
        .from('bookings')
        .update({ status: 'confirmed', payment_hold_booking_id: null })
        .in('id', held.map((r) => r.id))
        .eq('shop_id', opts.shopId)
        .eq('status', 'pending_approval');
      await admin.from('booking_logs').insert(
        held.map((r) => ({
          company_id: r.company_id,
          shop_id: opts.shopId,
          booking_id: r.id,
          action: 'payment_hold_released',
          description: `Paid — booking ${r.queue_number ?? r.id} confirmed`,
        })),
      );
    }

    const lapsed = rows.filter((r) => r.status === 'cancelled');
    if (lapsed.length > 0) {
      const first = lapsed[0];
      const queues = lapsed.map((r) => r.queue_number ?? '-').join(', ');
      await safeCreateNotification(admin, {
        companyId: first.company_id,
        shopId: opts.shopId,
        branchId: first.branch_id,
        userId: null,
        type: 'payment_after_expiry',
        category: 'billing',
        priority: 'high',
        title: `${queues} — ชำระเงินหลังคิวถูกยกเลิก`,
        message: `ลูกค้าชำระเงินคิว ${queues} (${first.booking_date} ${first.start_time.slice(0, 5)}) หลังระบบยกเลิกเพราะเลยเวลาชำระ กรุณาติดต่อลูกค้าเพื่อคืนเงินหรือจองคิวให้ใหม่`,
        relatedType: 'booking',
        relatedId: opts.bookingId,
        actionUrl: `/portal/bookings?booking_id=${opts.bookingId}`,
        icon: 'alert',
        color: 'amber',
        createdBy: null,
      });
    }
  } catch (e) {
    console.warn('[payment-hold] release failed:', e instanceof Error ? e.message : e);
  }
}

export type ExpiredHoldResult = { cancelled: Array<{ id: string; queue_number: string | null }>; customerNotified: boolean };

/**
 * Cancel an order whose payment deadline passed (cron). Only queues still on
 * hold are touched (conditional on `pending_approval`), so a payment or a staff
 * approval that won the race is kept. The hold id stays on the rows so a late
 * payment reaches `releasePaymentHold` and alerts staff.
 *
 * Google Calendar sync and cache are left to the caller.
 *
 * @throws When the `bookings` read or update fails (the cron counts it and retries next tick).
 */
export async function cancelExpiredPaymentHold(
  admin: SupabaseClient,
  opts: { shopId: string; companyId: string; payingBookingId: string },
): Promise<ExpiredHoldResult> {
  const { data, error } = await admin
    .from('bookings')
    .select(HOLD_ROW_COLUMNS)
    .eq('shop_id', opts.shopId)
    .eq('payment_hold_booking_id', opts.payingBookingId)
    .eq('status', 'pending_approval')
    .eq('is_deleted', false);
  if (error) throw error;
  const rows = (data ?? []) as HoldRow[];

  const cancelled: HoldRow[] = [];
  for (const row of rows) {
    const { data: updated, error: updateError } = await admin
      .from('bookings')
      .update({ status: 'cancelled', note: appendPaymentExpiredNote(row.note) })
      .eq('id', row.id)
      .eq('shop_id', opts.shopId)
      .eq('status', 'pending_approval')
      .select('id');
    if (updateError) throw updateError;
    if (updated && updated.length > 0) cancelled.push(row);
  }
  if (cancelled.length === 0) return { cancelled: [], customerNotified: false };

  await admin.from('booking_logs').insert(
    cancelled.map((r) => ({
      company_id: opts.companyId,
      shop_id: opts.shopId,
      booking_id: r.id,
      action: PAYMENT_EXPIRED_LOG_ACTION,
      description: `Payment deadline passed — booking ${r.queue_number ?? r.id} cancelled by system`,
    })),
  );

  const first = cancelled.find((r) => r.id === opts.payingBookingId) ?? cancelled[0];
  const queues = cancelled.map((r) => r.queue_number ?? '-').join(', ');
  await safeCreateNotification(admin, {
    companyId: opts.companyId,
    shopId: opts.shopId,
    branchId: first.branch_id,
    userId: null,
    type: 'booking_cancelled',
    category: 'bookings',
    priority: 'medium',
    title: `${queues} — ยกเลิกอัตโนมัติ (ไม่ชำระเงิน)`,
    message: `คิว ${queues} (${first.booking_date} ${first.start_time.slice(0, 5)}) ไม่ได้ชำระเงินภายในเวลาที่กำหนด ระบบยกเลิกและเปิดที่ว่างให้จองใหม่แล้ว`,
    relatedType: 'booking',
    relatedId: opts.payingBookingId,
    actionUrl: '/portal/bookings',
    icon: 'Cancel',
    color: '#c62828',
    metadata: { source: 'cron', reason: 'payment_expired', next_status: 'cancelled', cancelled_by: 'system' },
    createdBy: null,
  });

  const customerNotified = await safeNotifyPaymentExpired(admin, { shopId: opts.shopId, bookingId: first.id, queueLabel: queues });
  return { cancelled: cancelled.map((r) => ({ id: r.id, queue_number: r.queue_number })), customerNotified };
}

/** Tell the customer the queue lapsed. Never throws; false when there is no LINE user / token or the push failed. */
async function safeNotifyPaymentExpired(
  admin: SupabaseClient,
  opts: { shopId: string; bookingId: string; queueLabel: string },
): Promise<boolean> {
  try {
    const { data: booking } = await admin
      .from('bookings')
      .select('booking_date,start_time,line_user_id')
      .eq('id', opts.bookingId)
      .eq('shop_id', opts.shopId)
      .maybeSingle();
    const lineUserPk = (booking?.line_user_id as string | null | undefined) ?? null;
    if (!booking || !lineUserPk) return false;

    const [{ data: lineUser }, { data: shop }] = await Promise.all([
      admin.from('line_users').select('line_user_id').eq('id', lineUserPk).eq('shop_id', opts.shopId).maybeSingle(),
      admin.from('shops').select('name,shop_key,line_channel_access_token,liff_id,liff_id_login_shop').eq('id', opts.shopId).maybeSingle(),
    ]);
    const externalLineId = (lineUser as { line_user_id?: string | null } | null)?.line_user_id ?? null;
    const shopRow = shop as { name?: string | null; shop_key?: string | null; line_channel_access_token?: string | null; liff_id?: string | null; liff_id_login_shop?: string | null } | null;
    const token = shopRow?.line_channel_access_token || process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
    if (!externalLineId || !token) return false;

    const liffUrl = resolveCustomerLiffUrl({
      shopKey: shopRow?.shop_key,
      liffId: shopRow?.liff_id,
      liffIdLoginShop: shopRow?.liff_id_login_shop,
      tab: 'booking',
      appUrl: process.env.NEXT_PUBLIC_APP_URL,
    });
    await pushMessage(token, externalLineId, [
      bookingPaymentExpiredFlex({
        shopName: shopRow?.name ?? 'Queue Booking',
        queueNumber: opts.queueLabel,
        date: formatThaiDateLabel(String(booking.booking_date)),
        time: String(booking.start_time).slice(0, 5),
        liffUrl,
      }),
    ]);
    return true;
  } catch (e) {
    console.warn('[payment-hold] customer notice failed:', e instanceof Error ? e.message : e);
    return false;
  }
}
