import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { createAdminClient } from '@/lib/supabase/admin';
import { writeAuditLog } from '@/lib/audit/activity-log';
import { getSubscriptionState } from '@/lib/subscription/enforcement';
import { planAllowsPackages, SubscriptionFeatureLockedError } from '@/lib/subscription/features';
import { subscriptionErrorResponse } from '@/lib/subscription/response';
import { customerPackageActionSchema, sellPackageSchema } from '@/lib/packages/schemas';
import { CUSTOMER_PACKAGE_COLUMNS, PACKAGES_NOT_READY, type CustomerPackageRow } from '@/lib/packages/packages-server';
import { packageDbErrorCode } from '@/lib/packages/rules';
import { safeNotifyPackageCustomer } from '@/lib/packages/notify-customer';
import { signSlipUrls } from '@/lib/storage/buckets';
import { escapePostgrestSearch } from '@/lib/utils/postgrest';

/**
 * Packages sold to customers (`customer_packages`).
 *
 * GET `?status=&customer_id=&q=` → list with customer name/phone; `?id=` →
 *   one package with its ledger and slips (signed URLs, 5 min). Staff may read.
 * POST → staff sells a package at the counter (cash / transfer received):
 *   created and activated at once. Professional+.
 * PATCH `{ id, action }` → approve (LIFF purchase slip OK) | reject (slip) |
 *   adjust (± minutes, reason) | cancel (void the balance). shop_owner /
 *   branch_manager.
 */

const READ_ROLES = ['super_admin', 'shop_owner', 'branch_manager', 'staff'] as const;
const WRITE_ROLES = ['super_admin', 'shop_owner', 'branch_manager'] as const;
const LIST_COLUMNS = `${CUSTOMER_PACKAGE_COLUMNS},customers(full_name,nickname,phone)`;

function errorResponse(e: unknown) {
  const subscription = subscriptionErrorResponse(e);
  if (subscription) return subscription;
  return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
}

async function loadOne(admin: ReturnType<typeof createAdminClient>, shopId: string, id: string) {
  const { data, error } = await admin.from('customer_packages').select(CUSTOMER_PACKAGE_COLUMNS).eq('id', id).eq('shop_id', shopId).maybeSingle();
  if (error) throw error;
  return data as CustomerPackageRow | null;
}

export async function GET(req: Request) {
  try {
    const { profile } = await requireAuthContext({ roles: [...READ_ROLES] });
    const admin = createAdminClient();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (id) {
      if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
      const { data: row, error } = await admin.from('customer_packages').select(LIST_COLUMNS).eq('id', id).eq('shop_id', profile.shop_id).maybeSingle();
      if (error) return NextResponse.json({ error: PACKAGES_NOT_READY }, { status: 503 });
      if (!row) return NextResponse.json({ error: 'ไม่พบแพ็กเกจ' }, { status: 404 });
      const [{ data: ledger }, { data: slips }] = await Promise.all([
        admin
          .from('package_ledger')
          .select('id,booking_id,kind,minutes,balance_after,note,created_at,bookings(queue_number,booking_date,start_time)')
          .eq('shop_id', profile.shop_id)
          .eq('customer_package_id', id)
          .order('created_at', { ascending: false })
          .limit(200),
        admin
          .from('package_slips')
          .select('id,storage_path,status,reject_reason,created_at,reviewed_at')
          .eq('shop_id', profile.shop_id)
          .eq('customer_package_id', id)
          .order('created_at', { ascending: false })
          .limit(20),
      ]);
      const slipRows = (slips ?? []) as Array<{ id: string; storage_path: string; status: string; reject_reason: string | null; created_at: string; reviewed_at: string | null }>;
      const urls = await signSlipUrls(admin, slipRows.map((s) => s.storage_path));
      return NextResponse.json({
        data: {
          ...row,
          ledger: ledger ?? [],
          slips: slipRows.map(({ storage_path, ...s }) => ({ ...s, url: urls[storage_path] ?? null })),
        },
      });
    }

    let query = admin
      .from('customer_packages')
      .select(LIST_COLUMNS)
      .eq('shop_id', profile.shop_id)
      .order('created_at', { ascending: false })
      .limit(300);
    const status = searchParams.get('status');
    if (status && /^[a-z_]+$/.test(status)) query = query.eq('status', status);
    const customerId = searchParams.get('customer_id');
    if (customerId && z.string().uuid().safeParse(customerId).success) query = query.eq('customer_id', customerId);
    const { data, error } = await query;
    if (error) return NextResponse.json({ data: [], ready: false });

    const q = escapePostgrestSearch(searchParams.get('q'))?.toLowerCase() ?? '';
    type Row = CustomerPackageRow & { customers: { full_name?: string | null; nickname?: string | null; phone?: string | null } | null };
    const rows = ((data ?? []) as unknown as Row[]).filter((r) => {
      if (!q) return true;
      const c = r.customers ?? {};
      return [r.name, c.full_name, c.nickname, c.phone].some((v) => String(v ?? '').toLowerCase().includes(q));
    });
    return NextResponse.json({ data: rows, ready: true });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const { user, profile } = await requireAuthContext({ roles: [...WRITE_ROLES] });
    const parsed = sellPackageSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
    const sub = await getSubscriptionState(profile.shop_id);
    if (!sub.active || !planAllowsPackages(sub.planCode)) {
      throw new SubscriptionFeatureLockedError('แพ็กเกจชั่วโมงแบบจ่ายล่วงหน้า', sub.planCode, 'packages');
    }

    const admin = createAdminClient();
    const [{ data: customer }, { data: template, error: templateError }] = await Promise.all([
      admin.from('customers').select('id,full_name').eq('id', parsed.data.customer_id).eq('shop_id', profile.shop_id).eq('is_deleted', false).maybeSingle(),
      admin
        .from('credit_packages')
        .select('id,name,credit_minutes,price,valid_days,service_ids,usage_windows,active')
        .eq('id', parsed.data.package_id)
        .eq('shop_id', profile.shop_id)
        .eq('is_deleted', false)
        .maybeSingle(),
    ]);
    if (templateError) return NextResponse.json({ error: PACKAGES_NOT_READY }, { status: 503 });
    if (!customer) return NextResponse.json({ error: 'ไม่พบลูกค้า' }, { status: 404 });
    if (!template || !template.active) return NextResponse.json({ error: 'ไม่พบแพ็กเกจ หรือแพ็กเกจปิดขายอยู่' }, { status: 404 });

    const { data: created, error } = await admin
      .from('customer_packages')
      .insert({
        company_id: profile.company_id,
        shop_id: profile.shop_id,
        customer_id: customer.id,
        package_id: template.id,
        name: template.name,
        total_minutes: template.credit_minutes,
        remaining_minutes: 0,
        price_paid: parsed.data.price_paid ?? Number(template.price ?? 0),
        valid_days: template.valid_days,
        service_ids: template.service_ids,
        usage_windows: template.usage_windows ?? [],
        status: 'pending_payment',
        source: 'staff',
        payment_method: parsed.data.payment_method,
        payment_note: parsed.data.payment_note,
        sold_by: user.id,
      })
      .select('id')
      .single();
    if (error || !created) {
      console.error('[customer-packages] sell failed:', error?.message);
      return NextResponse.json({ error: 'บันทึกการขายไม่สำเร็จ' }, { status: 500 });
    }
    const { error: actError } = await admin.rpc('activate_customer_package', {
      p_shop_id: profile.shop_id,
      p_customer_package_id: created.id,
      p_actor: user.id,
      p_note: `sold at counter (${parsed.data.payment_method})`,
    });
    if (actError) {
      console.error('[customer-packages] activate failed:', actError.message);
      return NextResponse.json({ error: 'บันทึกการขายแล้ว แต่เปิดใช้แพ็กเกจไม่สำเร็จ กรุณากดอนุมัติอีกครั้ง' }, { status: 500 });
    }

    await writeAuditLog({
      companyId: profile.company_id,
      shopId: profile.shop_id,
      userId: user.id,
      action: 'package_sold',
      targetTable: 'customer_packages',
      targetId: created.id,
      payload: { customer: customer.full_name, package: template.name, price_paid: parsed.data.price_paid ?? template.price, method: parsed.data.payment_method },
    });
    const row = await loadOne(admin, profile.shop_id, created.id);
    if (row) {
      await safeNotifyPackageCustomer(admin, {
        shopId: profile.shop_id,
        customerId: row.customer_id,
        kind: 'activated',
        packageName: row.name,
        remainingMinutes: row.remaining_minutes,
        expiresOn: row.expires_on,
      });
    }
    return NextResponse.json({ data: row });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(req: Request) {
  try {
    const { user, profile } = await requireAuthContext({ roles: [...WRITE_ROLES] });
    const parsed = customerPackageActionSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
    const body = parsed.data;
    const admin = createAdminClient();
    const row = await loadOne(admin, profile.shop_id, body.id);
    if (!row) return NextResponse.json({ error: 'ไม่พบแพ็กเกจ' }, { status: 404 });
    const now = new Date().toISOString();

    if (body.action === 'approve') {
      const { data: ok, error } = await admin.rpc('activate_customer_package', {
        p_shop_id: profile.shop_id,
        p_customer_package_id: row.id,
        p_actor: user.id,
        p_note: 'payment approved',
      });
      if (error) throw error;
      if (!ok) return NextResponse.json({ error: 'แพ็กเกจนี้อนุมัติไปแล้วหรือไม่อยู่ในสถานะรออนุมัติ' }, { status: 409 });
      await admin
        .from('package_slips')
        .update({ status: 'approved', reviewed_by: user.id, reviewed_at: now })
        .eq('shop_id', profile.shop_id)
        .eq('customer_package_id', row.id)
        .eq('status', 'pending');
      const fresh = await loadOne(admin, profile.shop_id, row.id);
      await safeNotifyPackageCustomer(admin, {
        shopId: profile.shop_id,
        customerId: row.customer_id,
        kind: 'activated',
        packageName: row.name,
        remainingMinutes: fresh?.remaining_minutes ?? row.total_minutes,
        expiresOn: fresh?.expires_on ?? null,
      });
    } else if (body.action === 'reject') {
      if (!['awaiting_verification', 'pending_payment'].includes(row.status)) {
        return NextResponse.json({ error: 'แพ็กเกจนี้ไม่ได้รอตรวจสลิป' }, { status: 409 });
      }
      const { error } = await admin
        .from('customer_packages')
        .update({ status: 'rejected', reject_reason: body.reason, updated_at: now })
        .eq('id', row.id)
        .eq('shop_id', profile.shop_id);
      if (error) throw error;
      await admin
        .from('package_slips')
        .update({ status: 'rejected', reject_reason: body.reason, reviewed_by: user.id, reviewed_at: now })
        .eq('shop_id', profile.shop_id)
        .eq('customer_package_id', row.id)
        .eq('status', 'pending');
      await safeNotifyPackageCustomer(admin, { shopId: profile.shop_id, customerId: row.customer_id, kind: 'rejected', packageName: row.name, reason: body.reason });
    } else if (body.action === 'adjust') {
      const { error } = await admin.rpc('adjust_customer_package', {
        p_shop_id: profile.shop_id,
        p_customer_package_id: row.id,
        p_minutes: body.minutes,
        p_note: body.reason,
        p_actor: user.id,
      });
      if (error) {
        const code = packageDbErrorCode(error.message);
        if (code === 'package_negative') return NextResponse.json({ error: 'ปรับแล้วยอดคงเหลือติดลบไม่ได้' }, { status: 400 });
        if (code === 'package_unavailable') return NextResponse.json({ error: 'ปรับยอดได้เฉพาะแพ็กเกจที่ใช้งานอยู่' }, { status: 409 });
        throw error;
      }
    } else {
      if (row.status === 'cancelled') return NextResponse.json({ error: 'แพ็กเกจนี้ยกเลิกไปแล้ว' }, { status: 409 });
      const { data: cancelled, error } = await admin
        .from('customer_packages')
        .update({ status: 'cancelled', remaining_minutes: 0, reject_reason: body.reason, updated_at: now })
        .eq('id', row.id)
        .eq('shop_id', profile.shop_id)
        .neq('status', 'cancelled')
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (cancelled && row.remaining_minutes > 0) {
        await admin.from('package_ledger').insert({
          company_id: profile.company_id,
          shop_id: profile.shop_id,
          customer_package_id: row.id,
          kind: 'void',
          minutes: -row.remaining_minutes,
          balance_after: 0,
          note: body.reason,
          created_by: user.id,
        });
      }
    }

    await writeAuditLog({
      companyId: profile.company_id,
      shopId: profile.shop_id,
      userId: user.id,
      action: `package_${body.action}`,
      targetTable: 'customer_packages',
      targetId: row.id,
      payload: { name: row.name, ...('minutes' in body ? { minutes: body.minutes } : {}), ...('reason' in body ? { reason: body.reason } : {}) },
    });
    return NextResponse.json({ data: await loadOne(admin, profile.shop_id, row.id) });
  } catch (e) {
    return errorResponse(e);
  }
}
