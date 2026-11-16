import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { safeCreateNotification } from '@/lib/notifications/createNotification';
import { sniffImageMime } from '@/lib/utils/image-sniff';
import { clientIp, hitRateLimit, liffSubject, tooManyRequests } from '@/lib/security/rate-limit';
import { PAYMENT_SLIP_BUCKET, SLIP_ALLOWED_MIME, SLIP_MAX_BYTES, ensurePaymentSlipBucket } from '@/lib/storage/buckets';
import { resolveLiffPackageCaller } from '@/lib/packages/liff-package-auth';
import { formatPackageMinutes } from '@/lib/packages/rules';

const UPLOADABLE = new Set(['pending_payment', 'rejected', 'awaiting_verification']);
const MAX_SLIPS_PER_PACKAGE_PER_HOUR = 5;
const EXT_BY_MIME: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

function randomHex(bytes: number) {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * LIFF: upload the transfer slip of a package purchase. Stored in the private
 * slip bucket; the package goes to `awaiting_verification` and staff get a
 * notification to approve it at /portal/packages. No automatic approval.
 * POST multipart: customer_package_id, file, id_token, line_user_id.
 */
export async function POST(req: Request, { params }: { params: Promise<{ shopKey: string }> }) {
  const { shopKey } = await params;
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
  const id = String(form.get('customer_package_id') ?? '').trim();
  const idToken = String(form.get('id_token') ?? '').trim() || null;
  const lineUserId = String(form.get('line_user_id') ?? '').trim() || null;
  const file = form.get('file');
  if (!/^[0-9a-f-]{36}$/i.test(id) || !(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!(await hitRateLimit(admin, 'liffAction', liffSubject(req, idToken ?? undefined)))) return tooManyRequests();
  if (!(await hitRateLimit(admin, 'liffIp', clientIp(req)))) return tooManyRequests();

  const caller = await resolveLiffPackageCaller(admin, shopKey, lineUserId, idToken);
  if (!caller.ok) return NextResponse.json({ error: caller.error }, { status: caller.status });
  const { shop, customerId, lineUserPk } = caller;
  if (!customerId) return NextResponse.json({ error: 'ไม่พบแพ็กเกจ' }, { status: 404 });

  const { data: pkg } = await admin
    .from('customer_packages')
    .select('id,name,status,price_paid,total_minutes')
    .eq('id', id)
    .eq('shop_id', shop.id)
    .eq('customer_id', customerId)
    .maybeSingle();
  if (!pkg) return NextResponse.json({ error: 'ไม่พบแพ็กเกจ' }, { status: 404 });
  if (!UPLOADABLE.has(String(pkg.status))) return NextResponse.json({ error: 'แพ็กเกจนี้ไม่ต้องส่งสลิปแล้ว' }, { status: 409 });

  if (file.size > SLIP_MAX_BYTES) return NextResponse.json({ error: 'ไฟล์ใหญ่เกิน 5MB' }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniffImageMime(bytes);
  if (!mime || !SLIP_ALLOWED_MIME.includes(mime)) return NextResponse.json({ error: 'รองรับเฉพาะไฟล์รูป JPG, PNG หรือ WebP' }, { status: 400 });

  const { count } = await admin
    .from('package_slips')
    .select('id', { count: 'exact', head: true })
    .eq('customer_package_id', pkg.id)
    .gte('created_at', new Date(Date.now() - 3600_000).toISOString());
  if ((count ?? 0) >= MAX_SLIPS_PER_PACKAGE_PER_HOUR) return NextResponse.json({ error: 'อัปโหลดบ่อยเกินไป กรุณารอสักครู่' }, { status: 429 });

  try {
    await ensurePaymentSlipBucket(admin);
  } catch (e) {
    console.error('[package-slip] bucket error:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'อัปโหลดไม่สำเร็จ' }, { status: 500 });
  }
  const storagePath = `${shop.id}/packages/${pkg.id}/${Date.now()}-${randomHex(6)}.${EXT_BY_MIME[mime]}`;
  const { error: uploadError } = await admin.storage.from(PAYMENT_SLIP_BUCKET).upload(storagePath, bytes, { contentType: mime, upsert: false });
  if (uploadError) {
    console.error('[package-slip] upload error:', uploadError.message);
    return NextResponse.json({ error: 'อัปโหลดไม่สำเร็จ' }, { status: 500 });
  }

  // Older pending slips are replaced by this one.
  await admin.from('package_slips').update({ status: 'superseded' }).eq('customer_package_id', pkg.id).eq('shop_id', shop.id).eq('status', 'pending');
  const { error: insertError } = await admin.from('package_slips').insert({
    company_id: shop.company_id,
    shop_id: shop.id,
    customer_package_id: pkg.id,
    storage_path: storagePath,
    status: 'pending',
    uploaded_by_line_user: lineUserPk,
  });
  if (insertError) {
    console.error('[package-slip] insert error:', insertError.message);
    await admin.storage.from(PAYMENT_SLIP_BUCKET).remove([storagePath]);
    return NextResponse.json({ error: 'อัปโหลดไม่สำเร็จ' }, { status: 500 });
  }
  await admin
    .from('customer_packages')
    .update({ status: 'awaiting_verification', reject_reason: null, updated_at: new Date().toISOString() })
    .eq('id', pkg.id)
    .eq('shop_id', shop.id);

  await safeCreateNotification(admin, {
    companyId: shop.company_id,
    shopId: shop.id,
    branchId: null,
    userId: null,
    type: 'package_slip',
    category: 'billing',
    priority: 'high',
    title: `สลิปซื้อแพ็กเกจ "${pkg.name}" รอตรวจ`,
    message: `ลูกค้าส่งสลิปซื้อแพ็กเกจ ${pkg.name} (${formatPackageMinutes(Number(pkg.total_minutes))}) ${Number(pkg.price_paid).toLocaleString('th-TH')} บาท — ตรวจแล้วกดอนุมัติที่หน้าแพ็กเกจ`,
    relatedType: 'customer_package',
    relatedId: pkg.id,
    actionUrl: `/portal/packages?id=${pkg.id}`,
    icon: 'ReceiptLong',
    color: '#ed6c02',
    metadata: { customer_package_id: pkg.id },
    createdBy: null,
  });

  return NextResponse.json({ data: { status: 'awaiting_verification' } });
}
