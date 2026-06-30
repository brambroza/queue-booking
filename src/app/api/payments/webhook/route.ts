import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { retrieveCharge, resolveOmiseSecretKey } from '@/lib/payments/omise';
import { pushMessage } from '@/lib/line/client';
import { paymentReceiptFlex } from '@/lib/line/messages-payment';
import { formatThaiDateLabel } from '@/lib/utils/date-format';

interface OmiseWebhookEvent {
  object: string;
  key: string;
  data: {
    id: string;
    object: string;
    status?: string;
    amount?: number;
    currency?: string;
    paid_at?: string | null;
    metadata?: Record<string, string>;
  };
}

export async function POST(req: Request) {
  let event: OmiseWebhookEvent;
  try {
    event = (await req.json()) as OmiseWebhookEvent;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Only process charge.complete events
  if (event.key !== 'charge.complete') {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const chargeId = event.data?.id;
  if (!chargeId) {
    return NextResponse.json({ error: 'Missing charge id' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Look up the booking by omise_charge_id
  const { data: booking, error: bookingErr } = await admin
    .from('bookings')
    .select(`
      id, shop_id, company_id, queue_number, booking_date, start_time,
      payment_status, payment_amount, omise_charge_id,
      line_user_id,
      branches(branch_name),
      services(service_name),
      shops(name, omise_secret_key, line_channel_access_token, shop_key)
    `)
    .eq('omise_charge_id', chargeId)
    .maybeSingle();

  if (bookingErr || !booking) {
    // Unknown charge — acknowledge to prevent retries
    return NextResponse.json({ ok: true, skipped: 'booking_not_found' });
  }

  if (booking.payment_status === 'paid') {
    return NextResponse.json({ ok: true, skipped: 'already_paid' });
  }

  const shop = booking.shops as unknown as { name: string; omise_secret_key: string | null; line_channel_access_token: string | null; shop_key: string } | null;
  const secretKey = resolveOmiseSecretKey(shop?.omise_secret_key);

  // Re-fetch charge from Omise to verify status (webhook verification pattern)
  let charge;
  try {
    charge = await retrieveCharge(chargeId, secretKey);
  } catch (e) {
    return NextResponse.json({ error: `Omise verify failed: ${e instanceof Error ? e.message : 'unknown'}` }, { status: 502 });
  }

  if (charge.status !== 'successful') {
    // Record failure/expiry
    await admin.from('payment_transactions').insert({
      company_id: booking.company_id,
      shop_id: booking.shop_id,
      booking_id: booking.id,
      omise_charge_id: chargeId,
      amount: booking.payment_amount ?? 0,
      currency: 'THB',
      status: charge.status,
      event_type: 'charge.complete.non_successful',
      raw_event: charge as unknown as Record<string, unknown>,
    });
    return NextResponse.json({ ok: true, status: charge.status });
  }

  const paidAt = charge.paid_at ?? new Date().toISOString();
  const receiptRef = chargeId.replace('chrg_', 'RCP-').toUpperCase();

  // Mark booking as paid
  await admin
    .from('bookings')
    .update({ payment_status: 'paid', paid_at: paidAt })
    .eq('id', booking.id)
    .eq('shop_id', booking.shop_id);

  // Record successful transaction
  await admin.from('payment_transactions').insert({
    company_id: booking.company_id,
    shop_id: booking.shop_id,
    booking_id: booking.id,
    omise_charge_id: chargeId,
    amount: booking.payment_amount ?? 0,
    currency: 'THB',
    status: 'successful',
    event_type: 'charge.complete',
    raw_event: charge as unknown as Record<string, unknown>,
  });

  // Send LINE receipt (non-blocking)
  try {
    const lineToken = shop?.line_channel_access_token || process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
    const lineUserId = booking.line_user_id as string | null;
    if (lineToken && lineUserId) {
      const lineUser = await admin
        .from('line_users')
        .select('line_user_id')
        .eq('id', lineUserId)
        .maybeSingle();

      const externalLineId = lineUser?.data?.line_user_id as string | null;
      if (externalLineId) {
        const branches = booking.branches as unknown as { branch_name: string } | null;
        const services = booking.services as unknown as { service_name: string } | null;
        await pushMessage(lineToken, externalLineId, [
          paymentReceiptFlex({
            shopName: shop?.name ?? 'Queue Booking',
            queueNumber: booking.queue_number as string,
            service: services?.service_name ?? '-',
            branch: branches?.branch_name ?? '-',
            date: formatThaiDateLabel(booking.booking_date as string),
            time: String(booking.start_time ?? '').slice(0, 5),
            amountTHB: booking.payment_amount ?? 0,
            receiptRef,
            paidAt,
          }),
        ]);
      }
    }
  } catch {
    // Non-critical — payment already recorded
  }

  return NextResponse.json({ ok: true, receipt_ref: receiptRef });
}
