import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isCronAuthorized } from '@/lib/cron/auth';
import { verifySlipPayload } from '@/lib/payments/slip/auto-verify';
import { approveSlip } from '@/lib/payments/slip/approve';
import { MAX_RECHECK_ATTEMPTS } from '@/lib/payments/slip/recheck';

/** Vercel Hobby caps a function at 60 s; every item below is one vendor round trip (≤ 8 s). */
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/** Slips handled per tick. Anything left is picked up 5 minutes later. */
const MAX_PER_TICK = 40;

type SlipRow = {
  id: string;
  booking_id: string;
  shop_id: string;
  company_id: string;
  qr_payload: string | null;
  amount_claimed: number | null;
  created_at: string;
  provider_recheck_count: number | null;
};

type BookingRow = {
  payment_amount: number | null;
  payment_expires_at: string | null;
  payment_status: string | null;
  is_demo: boolean | null;
};

/**
 * Called every 5 minutes by Supabase pg_cron (see migration 202610090002).
 * Re-runs the bank-side check on pending slips whose first answer was
 * inconclusive (vendor down, quota exhausted, bank still posting) and settles
 * the booking when the bank now confirms it. Uses the stored QR payload — the
 * image is never downloaded again.
 */
export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: rowsRaw, error } = await admin
    .from('payment_slips')
    .select('id,booking_id,shop_id,company_id,qr_payload,amount_claimed,created_at,provider_recheck_count')
    .eq('status', 'pending')
    .eq('is_deleted', false)
    .not('qr_payload', 'is', null)
    .lte('next_recheck_at', nowIso)
    .order('next_recheck_at', { ascending: true })
    .limit(MAX_PER_TICK);
  if (error) {
    console.warn('[slip-recheck] query failed:', error.message);
    return NextResponse.json({ error: 'Query failed' }, { status: 500 });
  }

  const counters = { scanned: 0, verified: 0, rescheduled: 0, exhausted: 0, skipped: 0, failed: 0 };

  for (const slip of (rowsRaw ?? []) as SlipRow[]) {
    counters.scanned += 1;
    try {
      const { data: booking } = await admin
        .from('bookings')
        .select('payment_amount,payment_expires_at,payment_status,is_demo')
        .eq('id', slip.booking_id)
        .eq('shop_id', slip.shop_id)
        .maybeSingle();
      const b = booking as BookingRow | null;

      // The booking moved on (paid by hand, cancelled, demo) — stop looking.
      if (!b || b.is_demo || b.payment_status !== 'awaiting_verification') {
        await admin.from('payment_slips').update({ next_recheck_at: null }).eq('id', slip.id).eq('shop_id', slip.shop_id);
        counters.skipped += 1;
        continue;
      }

      const uploadedAt = new Date(slip.created_at);
      const attempt = Number(slip.provider_recheck_count ?? 1);
      const { evaluation, transRef } = await verifySlipPayload(admin, {
        slipId: slip.id,
        bookingId: slip.booking_id,
        shopId: slip.shop_id,
        companyId: slip.company_id,
        qrPayload: slip.qr_payload,
        expectedAmountTHB: Number(b.payment_amount ?? 0),
        amountClaimedTHB: slip.amount_claimed === null ? null : Number(slip.amount_claimed),
        paymentExpiresAt: b.payment_expires_at,
        uploadedAt: Number.isNaN(uploadedAt.getTime()) ? new Date() : uploadedAt,
        attempt,
      });

      if (evaluation.autoApprove && evaluation.providerId && transRef) {
        const approved = await approveSlip(admin, {
          slipId: slip.id,
          bookingId: slip.booking_id,
          shopId: slip.shop_id,
          companyId: slip.company_id,
          reviewerId: null,
          amountClaimed: slip.amount_claimed === null ? null : Number(slip.amount_claimed),
          auto: { providerId: evaluation.providerId, verifiedAmountTHB: evaluation.verifiedAmountTHB, transRef },
        });
        if (approved.ok) {
          counters.verified += 1;
          continue;
        }
      }

      if (evaluation.status === 'error') counters.failed += 1;
      else if (evaluation.retryReason && attempt + 1 < MAX_RECHECK_ATTEMPTS) counters.rescheduled += 1;
      else counters.exhausted += 1;
    } catch (e) {
      counters.failed += 1;
      console.error('[slip-recheck] slip failed:', slip.id, e instanceof Error ? e.message : e);
    }
  }

  return NextResponse.json({ data: counters });
}
