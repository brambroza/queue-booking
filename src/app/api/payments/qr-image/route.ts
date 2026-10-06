import { createAdminClient } from '@/lib/supabase/admin';
import { resolveOmiseSecretKey } from '@/lib/payments/omise';
import { Resvg } from '@resvg/resvg-js';
import { verifyBookingToken } from '@/lib/payments/tokens';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * True when a URL is an https Omise host, the only place the shop key may be sent.
 *
 * @param raw - Stored Omise `download_uri`.
 */
function isOmiseHost(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && (url.hostname === 'omise.co' || url.hostname.endsWith('.omise.co'));
  } catch {
    return false;
  }
}

/**
 * Public proxy — ดึง QR image จาก Omise แล้วแปลง SVG → PNG ก่อนส่งกลับ
 * LINE Flex Message ต้องการ PNG/JPEG เท่านั้น (ไม่รองรับ SVG)
 * GET /api/payments/qr-image?booking_id=xxx
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const bookingId = searchParams.get('booking_id');
  if (!bookingId || !UUID_RE.test(bookingId)) {
    return new Response('Not found', { status: 404 });
  }
  // Same HMAC as the PromptPay proxy: a booking id alone must not unlock the QR.
  if (!verifyBookingToken(bookingId, searchParams.get('t'))) {
    return new Response('Not found', { status: 404 });
  }

  const admin = createAdminClient();
  const { data: booking } = await admin
    .from('bookings')
    .select('omise_charge_id, omise_qr_image_url, payment_status, shops(omise_secret_key)')
    .eq('id', bookingId)
    .maybeSingle();

  // One flat 404 for every failure so the route is not an oracle for booking ids.
  if (!booking?.omise_charge_id || booking.payment_status !== 'pending_payment') {
    return new Response('Not found', { status: 404 });
  }

  const downloadUri = booking.omise_qr_image_url;
  // The shop's Omise secret goes in the Authorization header below, so the
  // target must be Omise and nothing else.
  if (!downloadUri || !isOmiseHost(downloadUri)) {
    return new Response('Not found', { status: 404 });
  }

  const shop = booking.shops as unknown as { omise_secret_key?: string | null } | null;
  const secretKey = resolveOmiseSecretKey(shop?.omise_secret_key);

  const omiseRes = await fetch(downloadUri, {
    headers: { Authorization: 'Basic ' + Buffer.from(`${secretKey}:`).toString('base64') },
  });

  if (!omiseRes.ok) {
    return new Response('Failed to fetch QR from Omise', { status: 502 });
  }

  const rawBuffer = Buffer.from(await omiseRes.arrayBuffer());
  const contentType = omiseRes.headers.get('content-type') ?? '';

  // Omise returns SVG — convert to PNG so LINE can render it
  let pngBytes: Uint8Array;
  const isSvg = contentType.includes('svg')
    || rawBuffer.subarray(0, 5).toString() === '<?xml'
    || rawBuffer.subarray(0, 4).toString() === '<svg';

  if (isSvg) {
    const resvg = new Resvg(rawBuffer, {
      fitTo: { mode: 'width', value: 512 },
      background: 'white',
    });
    pngBytes = resvg.render().asPng();
  } else {
    pngBytes = new Uint8Array(rawBuffer);
  }

  return new Response(pngBytes.buffer.slice(pngBytes.byteOffset, pngBytes.byteOffset + pngBytes.byteLength) as ArrayBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      // Per-customer artefact: never from a shared cache.
      'Cache-Control': 'private, max-age=900',
    },
  });
}
