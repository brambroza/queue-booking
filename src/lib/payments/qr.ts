import { createAdminClient } from '@/lib/supabase/admin';
import { createPromptPayCharge, resolveOmiseSecretKey } from './omise';

function buildQrProxyUrl(bookingId: string) {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '');
  return `${base}/api/payments/qr-image?booking_id=${bookingId}`;
}

export interface QrPaymentResult {
  chargeId: string;
  qrImageUrl: string;
  expiresAt: string | null;
  amountTHB: number;
  isTest: boolean;
}

/**
 * Create a PromptPay QR charge for a booking and persist the charge info.
 * Uses the admin client to bypass RLS for reading omise_secret_key.
 * Returns null if QR payment is not enabled for this shop.
 */
export async function createBookingQrPayment(opts: {
  bookingId: string;
  shopId: string;
  companyId: string;
  amountTHB: number;
  shopName: string;
  queueNumber: string;
}): Promise<QrPaymentResult | null> {
  const admin = createAdminClient();
  const { data: shop, error: shopErr } = await admin
    .from('shops')
    .select('qr_payment_enabled, omise_secret_key')
    .eq('id', opts.shopId)
    .maybeSingle();

  if (shopErr) {
    console.error('[QR] shop fetch error:', shopErr.message);
    return null;
  }

  const secretKey = resolveOmiseSecretKey(shop?.omise_secret_key ?? null);
  const isTestEnvBypass = secretKey.startsWith('skey_test_');

  // Skip if not enabled — unless test key in env (dev convenience bypass)
  if (!shop?.qr_payment_enabled && !isTestEnvBypass) {
    console.log('[QR] skipped: qr_payment_enabled=false and no test-key bypass');
    return null;
  }

  if (!secretKey) {
    console.log('[QR] skipped: no omise secret key');
    return null;
  }

  const amountTHB = opts.amountTHB > 0 ? opts.amountTHB : 0;
  if (amountTHB <= 0) {
    console.log('[QR] skipped: amountTHB=0, set price on the resource or service record');
    return null;
  }

  const charge = await createPromptPayCharge({
    secretKey,
    amountTHB,
    description: `${opts.shopName} – ${opts.queueNumber}`,
    metadata: {
      booking_id: opts.bookingId,
      shop_id: opts.shopId,
      queue_number: opts.queueNumber,
    },
  });

  const omiseDownloadUri = charge.source?.scannable_code?.image?.download_uri ?? '';
  const expiresAt = charge.expires_at ?? null;
  const qrImageUrl = buildQrProxyUrl(opts.bookingId);

  await admin
    .from('bookings')
    .update({
      payment_status: 'pending_payment',
      payment_amount: amountTHB,
      omise_charge_id: charge.id,
      omise_qr_image_url: omiseDownloadUri || null,
      payment_expires_at: expiresAt,
    })
    .eq('id', opts.bookingId)
    .eq('shop_id', opts.shopId);

  await admin.from('payment_transactions').insert({
    company_id: opts.companyId,
    shop_id: opts.shopId,
    booking_id: opts.bookingId,
    omise_charge_id: charge.id,
    amount: amountTHB,
    currency: 'THB',
    status: 'pending',
    event_type: 'charge.create',
    raw_event: charge as unknown as Record<string, unknown>,
  });

  return {
    chargeId: charge.id,
    qrImageUrl,
    expiresAt,
    amountTHB,
    isTest: secretKey.startsWith('skey_test_'),
  };
}
