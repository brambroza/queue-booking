import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { clientIp, hitRateLimit, liffSubject, tooManyRequests } from '@/lib/security/rate-limit';
import { getSubscriptionState } from '@/lib/subscription/enforcement';
import { planAllowsPackages } from '@/lib/subscription/features';
import { getShopPaymentConfig } from '@/lib/payments/settings';
import { getTodayISOInBangkok } from '@/lib/utils/date-format';
import { CUSTOMER_PACKAGE_COLUMNS, toPublicCustomerPackage, type CustomerPackageRow } from '@/lib/packages/packages-server';
import { packageQrUrl, resolveLiffPackageCaller } from '@/lib/packages/liff-package-auth';

const schema = z.object({
  package_id: z.string().uuid(),
  line_user_id: z.string().max(64).optional(),
  id_token: z.string().max(4096).optional(),
});

/** Unpaid purchases one customer may hold at once (stops QR spam). */
const MAX_OPEN_PURCHASES = 2;

/**
 * LIFF: start buying a package. Creates a `pending_payment` customer package
 * (price from the template, never from the client) and returns the shop
 * PromptPay QR for it. The customer then uploads a slip
 * (`/packages/slip`) and staff approve it in the portal, which activates the
 * hours. Re-tapping the same package reuses the open purchase.
 */
export async function POST(req: Request, { params }: { params: Promise<{ shopKey: string }> }) {
  const { shopKey } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });

  const admin = createAdminClient();
  if (!(await hitRateLimit(admin, 'liffAction', liffSubject(req, parsed.data.id_token)))) return tooManyRequests();
  if (!(await hitRateLimit(admin, 'liffIp', clientIp(req)))) return tooManyRequests();

  const caller = await resolveLiffPackageCaller(admin, shopKey, parsed.data.line_user_id, parsed.data.id_token);
  if (!caller.ok) return NextResponse.json({ error: caller.error }, { status: caller.status });
  const { shop, customerId } = caller;
  if (!customerId) return NextResponse.json({ error: 'กรุณาลงทะเบียนสมาชิกหรือจองคิวครั้งแรกก่อนซื้อแพ็กเกจ', code: 'needs_member' }, { status: 409 });

  const sub = await getSubscriptionState(shop.id).catch(() => null);
  if (!sub?.active || !planAllowsPackages(sub.planCode)) {
    return NextResponse.json({ error: 'ร้านนี้ยังไม่เปิดขายแพ็กเกจ' }, { status: 409 });
  }

  const [{ data: template }, config] = await Promise.all([
    admin
      .from('credit_packages')
      .select('id,name,credit_minutes,price,valid_days,service_ids,usage_windows')
      .eq('id', parsed.data.package_id)
      .eq('shop_id', shop.id)
      .eq('is_deleted', false)
      .eq('active', true)
      .eq('sell_online', true)
      .maybeSingle(),
    getShopPaymentConfig(admin, shop.id),
  ]);
  if (!template) return NextResponse.json({ error: 'ไม่พบแพ็กเกจ หรือร้านปิดขายแล้ว' }, { status: 404 });
  if (!config.promptpayId) return NextResponse.json({ error: 'ร้านยังไม่ได้ตั้งค่าพร้อมเพย์ กรุณาซื้อที่ร้าน' }, { status: 409 });

  const { data: open } = await admin
    .from('customer_packages')
    .select(CUSTOMER_PACKAGE_COLUMNS)
    .eq('shop_id', shop.id)
    .eq('customer_id', customerId)
    .in('status', ['pending_payment', 'rejected'])
    .order('created_at', { ascending: false });
  const openRows = (open ?? []) as CustomerPackageRow[];
  let row = openRows.find((r) => r.package_id === template.id) ?? null;

  if (!row) {
    if (openRows.length >= MAX_OPEN_PURCHASES) {
      return NextResponse.json({ error: 'มีแพ็กเกจที่ยังไม่ได้ชำระอยู่ กรุณาชำระหรือรอร้านตรวจสอบก่อน' }, { status: 409 });
    }
    const { data: created, error } = await admin
      .from('customer_packages')
      .insert({
        company_id: shop.company_id,
        shop_id: shop.id,
        customer_id: customerId,
        package_id: template.id,
        name: template.name,
        total_minutes: template.credit_minutes,
        remaining_minutes: 0,
        price_paid: Number(template.price ?? 0),
        valid_days: template.valid_days,
        service_ids: template.service_ids,
        usage_windows: template.usage_windows ?? [],
        status: 'pending_payment',
        source: 'liff',
        payment_method: 'bank_transfer',
        payment_expires_at: new Date(Date.now() + Math.max(config.transferWindowMinutes, 60) * 60_000).toISOString(),
      })
      .select(CUSTOMER_PACKAGE_COLUMNS)
      .single();
    if (error || !created) {
      console.error('[packages/buy] insert failed:', error?.message);
      return NextResponse.json({ error: 'ไม่สามารถเริ่มซื้อแพ็กเกจได้ กรุณาลองใหม่' }, { status: 500 });
    }
    row = created as CustomerPackageRow;
  }

  return NextResponse.json({
    data: {
      ...toPublicCustomerPackage(row, getTodayISOInBangkok()),
      qr_image_url: packageQrUrl(shop.shop_key, row.id, Number(row.price_paid ?? 0)),
    },
  });
}
