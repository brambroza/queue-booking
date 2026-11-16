import QRCode from 'qrcode';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveShopByKeyOrId } from '@/lib/line/shop-resolver';
import { buildPromptPayPayload } from '@/lib/payments/promptpay';
import { getShopPaymentConfig } from '@/lib/payments/settings';
import { verifyPackageToken } from '@/lib/packages/liff-package-auth';
import { clientIp, hitRateLimit, tooManyRequests } from '@/lib/security/rate-limit';

/** Statuses where a payable QR still makes sense. */
const PAYABLE = new Set(['pending_payment', 'rejected', 'awaiting_verification']);

/**
 * PromptPay QR PNG for a pending package purchase.
 * GET `?id=<customer_package_id>&t=<hmac>` — public (an `<img>` in LIFF), so
 * the HMAC token is the access check. Every failure is the same 404.
 */
export async function GET(req: Request, { params }: { params: Promise<{ shopKey: string }> }) {
  const { shopKey } = await params;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id') ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(id) || !verifyPackageToken(id, searchParams.get('t'))) return new Response('Not found', { status: 404 });

  const admin = createAdminClient();
  if (!(await hitRateLimit(admin, 'liffRead', clientIp(req)))) return tooManyRequests();
  const shop = await resolveShopByKeyOrId(admin, shopKey);
  if (!shop) return new Response('Not found', { status: 404 });

  const { data: row } = await admin
    .from('customer_packages')
    .select('id,status,price_paid')
    .eq('id', id)
    .eq('shop_id', shop.id)
    .maybeSingle();
  if (!row || !PAYABLE.has(String(row.status)) || !(Number(row.price_paid) > 0)) return new Response('Not found', { status: 404 });

  const config = await getShopPaymentConfig(admin, shop.id);
  if (!config.promptpayId) return new Response('Not found', { status: 404 });

  const payload = buildPromptPayPayload({ target: config.promptpayId, amountTHB: Number(row.price_paid) });
  const buffer = await QRCode.toBuffer(payload, { type: 'png', width: 512, margin: 1, errorCorrectionLevel: 'M' });
  const bytes = new Uint8Array(buffer);
  const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new Response(body, { status: 200, headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=300' } });
}
