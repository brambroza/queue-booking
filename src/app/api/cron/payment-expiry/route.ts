import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isCronAuthorized } from '@/lib/cron/auth';
import { confirmOmiseCharge } from '@/lib/payments/omise-confirm';
import { confirmDeeplinkPayment } from '@/lib/payments/deeplink/confirm';
import {
  PAYMENT_EXPIRY_GRACE_MINUTES,
  PAYMENT_HOLD_UNPAID_STATUSES,
  isPaymentHoldExpired,
  type PaymentHoldRow,
} from '@/lib/payments/payment-hold';
import { cancelExpiredPaymentHold } from '@/lib/payments/payment-hold-server';
import { safeSyncBookingToGoogleCalendar } from '@/lib/google-calendar/sync';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/** Orders handled per tick. Anything left is picked up 5 minutes later. */
const MAX_PER_TICK = 50;

const OMISE_METHODS = new Set(['omise_promptpay', 'omise_mobile_banking']);

type ExpiryRow = PaymentHoldRow & {
  shop_id: string;
  company_id: string;
  payment_method: string | null;
};

/**
 * Called every 5 minutes by Supabase pg_cron (see migration 202610250002).
 * Cancels LIFF orders held as `pending_approval` whose payment deadline
 * (+ grace) passed without payment, so the seat is bookable again.
 *
 * Omise / bank-deeplink bookings are asked once more at the provider first —
 * a webhook that never arrived must not cost a paying customer the queue.
 * A slip in review (`awaiting_verification`) is never cancelled here.
 */
export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const cutoffIso = new Date(now.getTime() - PAYMENT_EXPIRY_GRACE_MINUTES * 60_000).toISOString();

  const { data: rowsRaw, error } = await admin
    .from('bookings')
    .select('id,shop_id,company_id,status,payment_status,payment_method,payment_expires_at,payment_hold_booking_id')
    .eq('status', 'pending_approval')
    .eq('is_deleted', false)
    .not('payment_hold_booking_id', 'is', null)
    .in('payment_status', [...PAYMENT_HOLD_UNPAID_STATUSES])
    .lt('payment_expires_at', cutoffIso)
    .order('payment_expires_at', { ascending: true })
    .limit(MAX_PER_TICK);
  if (error) {
    // Column missing = migration 202610250002 not run yet: nothing is ever held.
    console.warn('[payment-expiry] query failed:', error.message);
    return NextResponse.json({ error: 'Query failed' }, { status: 500 });
  }

  const counters = { scanned: 0, cancelled: 0, paid_late_webhook: 0, skipped: 0, failed: 0, customer_notified: 0 };

  for (const row of (rowsRaw ?? []) as ExpiryRow[]) {
    counters.scanned += 1;
    if (!isPaymentHoldExpired(row, now)) {
      counters.skipped += 1;
      continue;
    }
    try {
      if (row.payment_status === 'pending_payment') {
        const method = String(row.payment_method);
        const outcome = OMISE_METHODS.has(method)
          ? await confirmOmiseCharge(admin, { shopId: row.shop_id, bookingId: row.id })
          : method === 'bank_deeplink'
            ? await confirmDeeplinkPayment(admin, { shopId: row.shop_id, bookingId: row.id })
            : null;
        // Paid after all — the confirm path already released the hold.
        if (outcome === 'paid' || outcome === 'already_paid') {
          counters.paid_late_webhook += 1;
          continue;
        }
        // Provider unreachable: do not cancel on a guess, try again next tick.
        if (outcome === 'provider_error') {
          counters.skipped += 1;
          continue;
        }
      }

      const result = await cancelExpiredPaymentHold(admin, {
        shopId: row.shop_id,
        companyId: row.company_id,
        payingBookingId: row.id,
      });
      counters.cancelled += result.cancelled.length;
      if (result.customerNotified) counters.customer_notified += 1;
      for (const c of result.cancelled) await safeSyncBookingToGoogleCalendar(row.shop_id, c.id);
    } catch (e) {
      counters.failed += 1;
      console.error('[payment-expiry] booking failed:', row.id, e instanceof Error ? e.message : e);
    }
  }

  return NextResponse.json({ data: counters });
}
