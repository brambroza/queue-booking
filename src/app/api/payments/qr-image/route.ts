import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveOmiseSecretKey } from '@/lib/payments/omise';

/**
 * Public proxy — ดึง QR image จาก Omise แล้วส่งกลับ
 * LINE Flex Message จะ fetch URL นี้แทน Omise โดยตรง (Omise download_uri ต้องการ auth)
 * GET /api/payments/qr-image?booking_id=xxx
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const bookingId = searchParams.get('booking_id');
  if (!bookingId) {
    return new Response('Missing booking_id', { status: 400 });
  }
 
  const admin = createAdminClient();
  const { data: booking } = await admin
    .from('bookings')
    .select('omise_charge_id, omise_qr_image_url, payment_status, shops(omise_secret_key)')
    .eq('id', bookingId)
    .maybeSingle();

  if (!booking?.omise_charge_id) {
    return new Response('Not found', { status: 404 });
  }

  // QR already expired or paid — still serve image for record
  const downloadUri = booking.omise_qr_image_url;
  if (!downloadUri) {
    return new Response('QR not available', { status: 404 });
  }

  const shop = booking.shops as unknown as { omise_secret_key?: string | null } | null;
  const secretKey = resolveOmiseSecretKey(shop?.omise_secret_key);

  const omiseRes = await fetch(downloadUri, {
    headers: secretKey
      ? { Authorization: 'Basic ' + Buffer.from(`${secretKey}:`).toString('base64') }
      : {},
  });

  if (!omiseRes.ok) {
    return new Response('Failed to fetch QR', { status: 502 });
  }

  const imageBuffer = await omiseRes.arrayBuffer();
  const contentType = omiseRes.headers.get('content-type') ?? 'image/png';

  return new Response(imageBuffer, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
