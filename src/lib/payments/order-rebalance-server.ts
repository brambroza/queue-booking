import type { SupabaseClient } from '@supabase/supabase-js';
import { safeCreateNotification } from '@/lib/notifications/createNotification';
import { formatThaiDateLabel } from '@/lib/utils/date-format';
import { parseBankCode } from '@/lib/payments/mobile-banking/banks';
import type { PaymentMethod } from '@/types/db';
import {
  PAYMENT_HOLD_UNPAID_STATUSES,
  PAYMENT_SETTLED_STATUSES,
  isActiveOrderQueue,
  pickOrderPayer,
  rebalancedOrderAmount,
  retargetOrderNote,
} from './payment-hold';
import { resolvePaymentForBooking } from './resolve';

/**
 * A customer cancelled one queue of a multi-pick order (A002 + A003 paid
 * together through A002). Without this the paying queue kept asking for the
 * whole order (vspin, 2026-11-07: A003 cancelled, A002 still 1,000 instead of 500).
 *
 * - Order not paid yet → amount scaled to the queues still active and the
 *   invoice re-issued (same method, bank-transfer deadline kept); when the
 *   paying queue itself was cancelled, the earliest active queue takes over.
 *   The caller sends the returned Flex to the customer.
 * - Slip already sent / paid → nothing is changed; staff get a high-priority
 *   notice to check the amount or refund.
 *
 * Only orders on payment hold (`payment_hold_booking_id`) are linked, so a
 * multi-pick without online payment is left alone. Never throws.
 */

export type OrderRebalanceResult =
  | { kind: 'reissued'; payerBookingId: string; payerQueue: string; amountTHB: number; flex: object | null }
  | { kind: 'staff_check'; payerQueue: string; expectedTHB: number }
  | { kind: 'none' };

type OrderRow = {
  id: string;
  company_id: string;
  branch_id: string | null;
  service_id: string | null;
  queue_number: string | null;
  booking_date: string;
  start_time: string;
  status: string;
  note: string | null;
  payment_status: string | null;
  payment_method: string | null;
  payment_amount: number | null;
  payment_expires_at: string | null;
  bank_provider: string | null;
  payment_hold_booking_id: string | null;
};

const ORDER_COLUMNS =
  'id,company_id,branch_id,service_id,queue_number,booking_date,start_time,status,note,payment_status,payment_method,payment_amount,payment_expires_at,bank_provider,payment_hold_booking_id';

const PAYMENT_METHODS: readonly PaymentMethod[] = ['omise_promptpay', 'omise_mobile_banking', 'bank_transfer', 'bank_deeplink'];

function asPaymentMethod(value: string | null): PaymentMethod | null {
  return (PAYMENT_METHODS as readonly string[]).includes(String(value)) ? (value as PaymentMethod) : null;
}

/**
 * Re-price (or flag) the order of a queue the customer just cancelled.
 *
 * @param admin - Service-role client.
 * @param opts.cancelledBookingId - The queue that was just cancelled.
 */
export async function rebalanceOrderAfterCustomerCancel(
  admin: SupabaseClient,
  opts: { shopId: string; companyId: string; cancelledBookingId: string },
): Promise<OrderRebalanceResult> {
  try {
    const { data: cancelled } = await admin
      .from('bookings')
      .select('id,payment_hold_booking_id')
      .eq('id', opts.cancelledBookingId)
      .eq('shop_id', opts.shopId)
      .maybeSingle();
    const holdId = (cancelled?.payment_hold_booking_id as string | null | undefined) ?? null;
    if (!holdId) return { kind: 'none' };

    const { data, error } = await admin
      .from('bookings')
      .select(ORDER_COLUMNS)
      .eq('shop_id', opts.shopId)
      .eq('payment_hold_booking_id', holdId)
      .eq('is_deleted', false);
    if (error) {
      console.warn('[order-rebalance] read failed:', error.message);
      return { kind: 'none' };
    }
    const rows = (data ?? []) as OrderRow[];
    const payer = rows.find((r) => r.id === holdId);
    // Single-queue order, or the payer row is gone: nothing to re-price.
    if (!payer || rows.length < 2) return { kind: 'none' };

    const active = rows.filter((r) => isActiveOrderQueue(r.status));
    const activeAfter = active.length;
    // The amount on the payer was charged for every queue active before this cancel.
    const activeBefore = activeAfter + 1;
    if (activeAfter === 0) return { kind: 'none' };

    const amount = Number(payer.payment_amount ?? 0);
    if (!(amount > 0)) return { kind: 'none' };
    const newAmount = rebalancedOrderAmount(amount, activeBefore, activeAfter);
    const payerQueue = payer.queue_number ?? '-';
    const cancelledQueue = rows.find((r) => r.id === opts.cancelledBookingId)?.queue_number ?? '-';

    if ((PAYMENT_SETTLED_STATUSES as readonly string[]).includes(String(payer.payment_status))) {
      const paid = payer.payment_status === 'paid';
      await safeCreateNotification(admin, {
        companyId: payer.company_id,
        shopId: opts.shopId,
        branchId: payer.branch_id,
        userId: null,
        type: 'payment_amount_check',
        category: 'billing',
        priority: 'high',
        title: `${payerQueue} — ลูกค้ายกเลิกบางคิวหลัง${paid ? 'ชำระเงิน' : 'ส่งสลิป'}`,
        message: `ลูกค้ายกเลิกคิว ${cancelledQueue} ซึ่งชำระรวมที่คิว ${payerQueue} (${amount.toLocaleString('th-TH')} บาท) — ยอดสำหรับคิวที่เหลือคือ ${newAmount.toLocaleString('th-TH')} บาท ${paid ? 'กรุณาคืนเงินส่วนต่างให้ลูกค้า' : 'กรุณาตรวจยอดในสลิปก่อนอนุมัติ'}`,
        relatedType: 'booking',
        relatedId: payer.id,
        actionUrl: paid ? `/portal/bookings?booking_id=${payer.id}` : '/portal/payment-verification',
        icon: 'alert',
        color: 'amber',
        metadata: { reason: 'partial_cancel_after_payment', amount, expected_amount: newAmount },
        createdBy: null,
      });
      return { kind: 'staff_check', payerQueue, expectedTHB: newAmount };
    }
    if (!(PAYMENT_HOLD_UNPAID_STATUSES as readonly string[]).includes(String(payer.payment_status))) {
      return { kind: 'none' };
    }

    const target = pickOrderPayer(active, holdId);
    if (!target) return { kind: 'none' };
    const targetQueue = target.queue_number ?? '-';
    const moved = target.id !== payer.id;

    if (moved) {
      // The paying queue was cancelled: the order now pays through `target`.
      for (const row of active) {
        const note = retargetOrderNote(row.note, payerQueue, row.id === target.id ? null : targetQueue);
        await admin
          .from('bookings')
          .update({ payment_hold_booking_id: target.id, note })
          .eq('id', row.id)
          .eq('shop_id', opts.shopId);
      }
    }

    const [{ data: shop }, { data: branch }, { data: service }] = await Promise.all([
      admin.from('shops').select('name,shop_key').eq('id', opts.shopId).maybeSingle(),
      target.branch_id
        ? admin.from('branches').select('branch_name').eq('id', target.branch_id).eq('shop_id', opts.shopId).maybeSingle()
        : Promise.resolve({ data: null }),
      target.service_id
        ? admin.from('services').select('service_name').eq('id', target.service_id).eq('shop_id', opts.shopId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const shopRow = (shop ?? {}) as { name?: string | null; shop_key?: string | null };
    const timeLabel = [...active]
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
      .map((r) => r.start_time.slice(0, 5))
      .join(', ');

    const payment = await resolvePaymentForBooking({
      bookingId: target.id,
      shopId: opts.shopId,
      companyId: payer.company_id,
      shopKey: shopRow.shop_key ?? null,
      amountTHB: newAmount,
      shopName: shopRow.name ?? 'Queue Booking',
      queueNumber: targetQueue,
      serviceName: (service as { service_name?: string | null } | null)?.service_name ?? '-',
      branchName: (branch as { branch_name?: string | null } | null)?.branch_name ?? '-',
      dateLabel: formatThaiDateLabel(target.booking_date),
      timeLabel,
      requestedMethod: asPaymentMethod(payer.payment_method),
      requestedBankProvider: parseBankCode(payer.bank_provider),
      keepExpiresAt: payer.payment_expires_at,
    });

    if (!payment) {
      // Could not re-issue (method switched off, provider down): at least correct
      // the amount the portal and slip inbox compare against, and tell staff.
      await admin
        .from('bookings')
        .update({ payment_amount: newAmount })
        .eq('id', target.id)
        .eq('shop_id', opts.shopId);
    }

    await admin.from('booking_logs').insert({
      company_id: payer.company_id,
      shop_id: opts.shopId,
      booking_id: target.id,
      action: 'payment_rebalanced',
      description: `Customer cancelled ${cancelledQueue} — order amount ${amount} → ${newAmount}${moved ? ` (now paid through ${targetQueue})` : ''}`,
    });

    await safeCreateNotification(admin, {
      companyId: payer.company_id,
      shopId: opts.shopId,
      branchId: target.branch_id,
      userId: null,
      type: 'payment_rebalanced',
      category: 'billing',
      priority: payment ? 'medium' : 'high',
      title: `${targetQueue} — ยอดชำระเปลี่ยนเป็น ${newAmount.toLocaleString('th-TH')} บาท`,
      message: payment
        ? `ลูกค้ายกเลิกคิว ${cancelledQueue} ระบบปรับยอดที่ต้องชำระจาก ${amount.toLocaleString('th-TH')} เป็น ${newAmount.toLocaleString('th-TH')} บาท${moved ? ` และย้ายการชำระไปที่คิว ${targetQueue}` : ''} แล้วส่ง QR ใหม่ให้ลูกค้า`
        : `ลูกค้ายกเลิกคิว ${cancelledQueue} ยอดที่ควรชำระคือ ${newAmount.toLocaleString('th-TH')} บาท แต่ระบบออกใบชำระใหม่ไม่ได้ กรุณาแจ้งลูกค้าเอง`,
      relatedType: 'booking',
      relatedId: target.id,
      actionUrl: `/portal/bookings?booking_id=${target.id}`,
      icon: 'Payments',
      color: payment ? '#2563eb' : 'amber',
      metadata: { amount, new_amount: newAmount, moved, cancelled_queue: cancelledQueue },
      createdBy: null,
    });

    return { kind: 'reissued', payerBookingId: target.id, payerQueue: targetQueue, amountTHB: newAmount, flex: payment?.flex ?? null };
  } catch (e) {
    console.warn('[order-rebalance] failed:', e instanceof Error ? e.message : e);
    return { kind: 'none' };
  }
}
