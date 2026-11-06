import { createAdminClient } from '@/lib/supabase/admin';
import { writeAuditLog } from '@/lib/audit/activity-log';
import { ensurePaymentSlipBucket, PAYMENT_SLIP_BUCKET } from '@/lib/storage/buckets';
import type { BusinessType } from '@/lib/line/rich-menu/business-types';
import { scenarioForBusiness } from '@/lib/demo/scenarios';
import { buildDemoSeedPlan, resolveDemoBusinessType } from '@/lib/demo/seed-plan';

/** The demo sandbox now supports every normalized business type. */
export type DemoBusinessType = BusinessType;

type DemoContext = {
  companyId: string;
  shopId: string;
  userId?: string | null;
  businessType: DemoBusinessType;
  /** Seed the scenario's payment states (default true). */
  withPayment?: boolean;
};

type DemoSessionInfo = {
  business_type: string;
  reset_count: number;
};

/** Today (UTC date string) shifted by `offsetDays`. */
function todayIso(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/** "HH:MM" plus minutes, as "HH:MM:00". */
function timeAddMinutes(hhmm: string, minutes: number) {
  const [h, m] = hhmm.split(':').map(Number);
  const t = new Date();
  t.setHours(h, m, 0, 0);
  t.setMinutes(t.getMinutes() + minutes);
  const hh = String(t.getHours()).padStart(2, '0');
  const mm = String(t.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}:00`;
}

/** Prefix for demo slip images inside the private payment-slips bucket. */
function demoSlipPrefix(shopId: string) {
  return `demo-slips/${shopId}`;
}

/**
 * Delete every demo slip image for one shop.
 *
 * Storage failures are logged, not thrown: a leftover image is a tidiness
 * problem, while a throw here would abort the whole demo reset.
 */
async function removeDemoSlipObjects(shopId: string) {
  const admin = createAdminClient();
  const prefix = demoSlipPrefix(shopId);
  const { data: objects, error } = await admin.storage.from(PAYMENT_SLIP_BUCKET).list(prefix, { limit: 100 });
  if (error) {
    console.error('[demo] list demo slips failed:', error.message);
    return;
  }
  const paths = (objects ?? []).map((o) => `${prefix}/${o.name}`);
  if (paths.length === 0) return;
  const { error: removeError } = await admin.storage.from(PAYMENT_SLIP_BUCKET).remove(paths);
  if (removeError) console.error('[demo] remove demo slips failed:', removeError.message);
}

async function clearDemoData(ctx: { companyId: string; shopId: string }) {
  const admin = createAdminClient();
  const { companyId, shopId } = ctx;

  await admin.from('demo_chat_messages').delete().eq('company_id', companyId).eq('shop_id', shopId);
  const [{ data: demoBookings }, { data: demoResources }] = await Promise.all([
    admin.from('bookings').select('id').eq('company_id', companyId).eq('shop_id', shopId).eq('is_demo', true),
    admin.from('booking_resources').select('id').eq('company_id', companyId).eq('shop_id', shopId).eq('is_demo', true),
  ]);
  const demoBookingIds = (demoBookings ?? []).map((x) => x.id);
  const demoResourceIds = (demoResources ?? []).map((x) => x.id);
  if (demoBookingIds.length > 0) {
    await admin.from('booking_resource_assignments').delete().in('booking_id', demoBookingIds);
  }
  if (demoResourceIds.length > 0) {
    await admin.from('booking_resource_assignments').delete().in('resource_id', demoResourceIds);
  }

  // Demo slips must go before the bookings they hang off, otherwise they stay
  // visible in the shop's verification queue with no booking behind them.
  await admin.from('payment_slips').update({ is_deleted: true }).eq('company_id', companyId).eq('shop_id', shopId).eq('is_demo', true);
  await admin.from('payment_transactions').delete().eq('company_id', companyId).eq('shop_id', shopId).eq('is_demo', true);
  await removeDemoSlipObjects(shopId);

  await admin.from('booking_logs').update({ is_deleted: true }).eq('company_id', companyId).eq('shop_id', shopId).eq('is_demo', true);
  await admin.from('bookings').update({ is_deleted: true }).eq('company_id', companyId).eq('shop_id', shopId).eq('is_demo', true);
  await admin.from('booking_resources').update({ is_deleted: true, active: false }).eq('company_id', companyId).eq('shop_id', shopId).eq('is_demo', true);
  await admin.from('services').update({ is_deleted: true, active: false }).eq('company_id', companyId).eq('shop_id', shopId).eq('is_demo', true);
  await admin.from('working_hours').update({ is_deleted: true, active: false }).eq('company_id', companyId).eq('shop_id', shopId).eq('is_demo', true);
  await admin.from('branches').update({ is_deleted: true, active: false }).eq('company_id', companyId).eq('shop_id', shopId).eq('is_demo', true);
  await admin.from('line_messages').update({ is_deleted: true }).eq('company_id', companyId).eq('shop_id', shopId).eq('is_demo', true);
  await admin.from('notifications').update({ is_deleted: true }).eq('company_id', companyId).eq('shop_id', shopId).eq('is_demo', true);
  await admin.from('customers').update({ is_deleted: true }).eq('company_id', companyId).eq('shop_id', shopId).eq('is_demo', true);
  await admin.from('line_users').update({ is_deleted: true }).eq('company_id', companyId).eq('shop_id', shopId).eq('is_demo', true);
  await admin.from('signage_settings').update({ is_deleted: true }).eq('company_id', companyId).eq('shop_id', shopId).eq('is_demo', true);
}

/**
 * Seed the demo rows for one business type (replaces any earlier demo data).
 *
 * @param input - Tenant, acting user, business type and whether to seed payments.
 */
export async function createDemoSandbox(input: DemoContext) {
  const admin = createAdminClient();
  const businessType = resolveDemoBusinessType(input.businessType);
  const withPayment = input.withPayment ?? true;
  const plan = buildDemoSeedPlan(scenarioForBusiness(businessType), { withPayment });

  await clearDemoData({ companyId: input.companyId, shopId: input.shopId });

  const { data: branch, error: branchError } = await admin
    .from('branches')
    .insert({
      company_id: input.companyId,
      shop_id: input.shopId,
      branch_name: plan.branchName,
      address: 'Demo Address',
      phone: '020000000',
      open_time: plan.openTime,
      close_time: plan.closeTime,
      max_parallel_queues: 50,
      active: true,
      is_demo: true,
      created_by: input.userId ?? null,
      updated_by: input.userId ?? null,
    })
    .select('id,branch_name')
    .single();
  if (branchError) throw branchError;

  // get_available_slots reads working_hours, not branch open_time/close_time.
  // Without these rows the demo shop reports "closed" on every date and the
  // sandbox cannot demonstrate the one thing the product does.
  const { error: workingHoursError } = await admin.from('working_hours').insert(
    Array.from({ length: 7 }, (_, weekday) => ({
      company_id: input.companyId,
      shop_id: input.shopId,
      branch_id: branch.id,
      weekday,
      open_time: plan.openTime,
      close_time: plan.closeTime,
      slot_interval_minutes: plan.slotMinutes,
      capacity_per_slot: 5,
      active: true,
      is_demo: true,
      created_by: input.userId ?? null,
      updated_by: input.userId ?? null,
    })),
  );
  if (workingHoursError) throw workingHoursError;

  const { data: createdServices, error: serviceError } = await admin
    .from('services')
    .insert(
      plan.services.map((s) => ({
        company_id: input.companyId,
        shop_id: input.shopId,
        branch_id: branch.id,
        service_name: s.service_name,
        booking_mode: s.booking_mode,
        duration_minutes: s.duration_minutes,
        min_duration_minutes: s.min_duration_minutes,
        max_duration_minutes: s.max_duration_minutes,
        capacity_per_slot: s.capacity_per_slot,
        requires_approval: s.requires_approval,
        allow_walk_in: s.allow_walk_in,
        price: s.price,
        active: true,
        is_demo: true,
        created_by: input.userId ?? null,
        updated_by: input.userId ?? null,
      })),
    )
    .select('id,service_name,duration_minutes,price');
  if (serviceError) throw serviceError;

  const servicesByName = new Map((createdServices ?? []).map((s) => [s.service_name, s]));

  const resourcesByCode = new Map<string, { id: string; resource_name: string; capacity: number }>();
  if (plan.resources.length > 0) {
    const { data: createdResources, error: resourceError } = await admin
      .from('booking_resources')
      .insert(
        plan.resources.map((r) => {
          // Empty list = serves every service (resource-service-link migration).
          const serviceIds = r.service_names
            .map((name) => servicesByName.get(name)?.id)
            .filter((id): id is string => Boolean(id));
          return {
            company_id: input.companyId,
            shop_id: input.shopId,
            branch_id: branch.id,
            resource_type: r.resource_type,
            resource_code: r.resource_code,
            resource_name: r.resource_name,
            capacity: r.capacity,
            unit_price: r.unit_price,
            service_ids: serviceIds.length > 0 ? serviceIds : null,
            active: true,
            is_demo: true,
            created_by: input.userId ?? null,
            updated_by: input.userId ?? null,
          };
        }),
      )
      .select('id,resource_code,resource_name,capacity');
    if (resourceError) throw resourceError;
    (createdResources ?? []).forEach((r) => {
      if (r.resource_code) resourcesByCode.set(r.resource_code, { id: r.id, resource_name: r.resource_name, capacity: r.capacity });
    });
  }

  for (const b of plan.bookings) {
    const service = servicesByName.get(b.service_name);
    if (!service) continue;

    const { data: lineUser, error: lineUserError } = await admin
      .from('line_users')
      .insert({
        company_id: input.companyId,
        shop_id: input.shopId,
        branch_id: branch.id,
        line_user_id: `demo-${input.shopId}-${b.queue_number}`.slice(0, 64),
        display_name: b.customer_name,
        active: true,
        is_demo: true,
        created_by: input.userId ?? null,
        updated_by: input.userId ?? null,
      })
      .select('id')
      .single();
    if (lineUserError) throw lineUserError;

    const { data: customer, error: customerError } = await admin
      .from('customers')
      .insert({
        company_id: input.companyId,
        shop_id: input.shopId,
        branch_id: branch.id,
        line_user_id: lineUser.id,
        full_name: b.customer_name,
        phone: b.customer_phone,
        nickname: b.nickname,
        active: true,
        is_demo: true,
        created_by: input.userId ?? null,
        updated_by: input.userId ?? null,
      })
      .select('id')
      .single();
    if (customerError) throw customerError;

    const resource = b.resource_code ? resourcesByCode.get(b.resource_code) : null;
    const startTime = `${b.start_time}:00`;
    const endTime = timeAddMinutes(b.start_time, Number(service.duration_minutes ?? 30));
    const bookingDate = b.previous_day ? todayIso(-1) : todayIso(0);

    // Payment columns are demo display data only — no charge is created and the
    // shop's own qr_payment_enabled / transfer_payment_enabled stay untouched.
    // The plan already left them empty when the user chose "no payment".
    const paymentStatus = b.payment_status;

    const { data: booking, error: bookingError } = await admin
      .from('bookings')
      .insert({
        company_id: input.companyId,
        shop_id: input.shopId,
        branch_id: branch.id,
        service_id: service.id,
        customer_id: customer.id,
        line_user_id: lineUser.id,
        booking_date: bookingDate,
        start_time: startTime,
        end_time: endTime,
        queue_number: b.queue_number,
        status: b.status,
        party_size: b.party_size ?? null,
        resource_id: resource?.id ?? null,
        resource_name: resource?.resource_name ?? null,
        resource_capacity: resource?.capacity ?? null,
        payment_status: paymentStatus,
        payment_method: b.payment_method,
        payment_amount: b.payment_amount,
        payment_expires_at: paymentStatus === 'pending_payment' ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null,
        paid_at: paymentStatus === 'paid' ? new Date().toISOString() : null,
        note: 'Demo booking',
        is_demo: true,
        created_by: input.userId ?? null,
        updated_by: input.userId ?? null,
      })
      .select('id')
      .single();
    if (bookingError) throw bookingError;

    await admin.from('booking_logs').insert({
      company_id: input.companyId,
      shop_id: input.shopId,
      booking_id: booking.id,
      action: 'demo_seed',
      description: `Seed demo booking ${b.queue_number}`,
      is_demo: true,
      created_by: input.userId ?? null,
      updated_by: input.userId ?? null,
    });
  }

  await admin.from('demo_chat_messages').insert(
    plan.chats.map((m) => ({
      company_id: input.companyId,
      shop_id: input.shopId,
      branch_id: branch.id,
      direction: m.direction,
      message_text: m.message_text,
      message_type: 'text',
      is_demo: true,
    })),
  );

  const signagePreset = plan.signage;
  await admin.from('signage_settings').upsert({
    company_id: input.companyId,
    shop_id: input.shopId,
    branch_id: branch.id,
    enabled: true,
    template: signagePreset.template,
    theme: signagePreset.theme,
    layout: 'landscape',
    customer_name_mode: 'masked',
    show_logo: true,
    show_service_name: true,
    show_resource_name: true,
    show_clock: true,
    show_qr: true,
    next_queue_limit: 5,
    waiting_queue_limit: 10,
    refresh_seconds: 10,
    announcement_text: 'คุณกำลังใช้งาน Demo Sandbox',
    is_demo: true,
    created_by: input.userId ?? null,
    updated_by: input.userId ?? null,
  });

  const { data: existingSession } = await admin
    .from('demo_sandbox_sessions')
    .select('id,reset_count')
    .eq('company_id', input.companyId)
    .eq('shop_id', input.shopId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<DemoSessionInfo & { id: string }>();

  if (existingSession?.id) {
    await admin
      .from('demo_sandbox_sessions')
      .update({
        business_type: businessType,
        last_reset_at: new Date().toISOString(),
        reset_count: (existingSession.reset_count ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingSession.id);
  } else {
    await admin.from('demo_sandbox_sessions').insert({
      company_id: input.companyId,
      shop_id: input.shopId,
      user_id: input.userId ?? null,
      business_type: businessType,
      status: 'active',
      started_at: new Date().toISOString(),
    });
  }

  await admin
    .from('companies')
    .update({ is_demo: true, demo_business_type: businessType, updated_by: input.userId ?? null })
    .eq('id', input.companyId);

  await admin
    .from('shops')
    .update({
      is_demo: true,
      demo_mode_enabled: true,
      demo_business_type: businessType,
      line_setup_completed: false,
      updated_by: input.userId ?? null,
    })
    .eq('id', input.shopId);

  // Keep the rich menu business type in step with the demo type when the shop
  // has not chosen one yet. Isolated so a not-yet-migrated column cannot break
  // sandbox creation (migration 202609140001).
  {
    const { error: businessTypeError } = await admin
      .from('shops')
      .update({ business_type: businessType })
      .eq('id', input.shopId)
      .is('business_type', null);
    if (businessTypeError) console.error('[demo_sandbox_business_type_failed]', businessTypeError.message);
  }

  await writeAuditLog({
    companyId: input.companyId,
    shopId: input.shopId,
    userId: input.userId ?? null,
    action: 'demo_sandbox_created',
    targetTable: 'demo_sandbox_sessions',
    payload: { business_type: businessType, with_payment: withPayment },
  });

  return { ok: true };
}

/**
 * Re-seed the sandbox. Without an explicit type it reuses the stored
 * `demo_business_type`; legacy values (`barber`, `general_service`) are
 * normalized by `resolveDemoBusinessType`.
 *
 * @param input - Tenant, acting user and optional business type / payment choice.
 */
export async function resetDemoSandbox(input: Omit<DemoContext, 'businessType'> & { businessType?: string | null }) {
  const admin = createAdminClient();
  let raw: string | null | undefined = input.businessType;

  if (!raw) {
    const { data: shop } = await admin
      .from('shops')
      .select('demo_business_type')
      .eq('id', input.shopId)
      .maybeSingle<{ demo_business_type?: string | null }>();
    raw = shop?.demo_business_type;
  }
  const businessType = resolveDemoBusinessType(raw);

  await createDemoSandbox({
    companyId: input.companyId,
    shopId: input.shopId,
    userId: input.userId ?? null,
    businessType,
    withPayment: input.withPayment,
  });

  await writeAuditLog({
    companyId: input.companyId,
    shopId: input.shopId,
    userId: input.userId ?? null,
    action: 'demo_sandbox_reset',
    targetTable: 'demo_sandbox_sessions',
    payload: { business_type: businessType, with_payment: input.withPayment ?? true },
  });

  return { ok: true };
}

export async function createDemoBooking(input: { companyId: string; shopId: string; userId?: string | null }) {
  const admin = createAdminClient();
  const today = todayIso(0);

  const [{ data: branch }, { data: service }] = await Promise.all([
    admin.from('branches').select('id').eq('company_id', input.companyId).eq('shop_id', input.shopId).eq('is_demo', true).eq('is_deleted', false).limit(1).maybeSingle(),
    admin.from('services').select('id,service_name,duration_minutes').eq('company_id', input.companyId).eq('shop_id', input.shopId).eq('is_demo', true).eq('is_deleted', false).limit(1).maybeSingle(),
  ]);
  if (!branch || !service) throw new Error('ยังไม่มีข้อมูล demo ให้สร้างคิวเพิ่ม');

  const { count } = await admin
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', input.companyId)
    .eq('shop_id', input.shopId)
    .eq('booking_date', today)
    .eq('is_deleted', false);
  const queueNumber = `D${String((count ?? 0) + 1).padStart(3, '0')}`;

  const { data: lineUser } = await admin
    .from('line_users')
    .insert({
      company_id: input.companyId,
      shop_id: input.shopId,
      branch_id: branch.id,
      line_user_id: `demo-auto-${Date.now()}`,
      display_name: 'ลูกค้าเดโม่',
      active: true,
      is_demo: true,
      created_by: input.userId ?? null,
      updated_by: input.userId ?? null,
    })
    .select('id')
    .single();

  const { data: customer } = await admin
    .from('customers')
    .insert({
      company_id: input.companyId,
      shop_id: input.shopId,
      branch_id: branch.id,
      line_user_id: lineUser?.id ?? null,
      full_name: 'ลูกค้าเดโม่',
      phone: `089${String(Date.now()).slice(-7)}`,
      active: true,
      is_demo: true,
      created_by: input.userId ?? null,
      updated_by: input.userId ?? null,
    })
    .select('id')
    .single();

  const start = '16:00:00';
  const end = timeAddMinutes('16:00', Number(service.duration_minutes ?? 30));
  const { data: booking, error } = await admin
    .from('bookings')
    .insert({
      company_id: input.companyId,
      shop_id: input.shopId,
      branch_id: branch.id,
      service_id: service.id,
      customer_id: customer?.id,
      line_user_id: lineUser?.id ?? null,
      booking_date: today,
      start_time: start,
      end_time: end,
      queue_number: queueNumber,
      status: 'waiting',
      is_demo: true,
      note: 'Created from demo action',
      created_by: input.userId ?? null,
      updated_by: input.userId ?? null,
    })
    .select('id,queue_number')
    .single();
  if (error) throw error;

  await admin.from('booking_logs').insert({
    company_id: input.companyId,
    shop_id: input.shopId,
    booking_id: booking.id,
    action: 'demo_booking_created',
    description: `Create demo booking ${booking.queue_number}`,
    is_demo: true,
    created_by: input.userId ?? null,
    updated_by: input.userId ?? null,
  });

  await admin.from('demo_chat_messages').insert({
    company_id: input.companyId,
    shop_id: input.shopId,
    branch_id: branch.id,
    direction: 'bot',
    message_text: `สร้างคิวตัวอย่างแล้ว เลขคิว ${booking.queue_number}`,
    message_type: 'text',
    related_booking_id: booking.id,
    is_demo: true,
  });

  return booking;
}

export async function sendDemoChatMessage(input: { companyId: string; shopId: string; branchId?: string | null; direction: 'customer' | 'bot' | 'system'; text: string }) {
  const admin = createAdminClient();
  const { error } = await admin.from('demo_chat_messages').insert({
    company_id: input.companyId,
    shop_id: input.shopId,
    branch_id: input.branchId ?? null,
    direction: input.direction,
    message_text: input.text,
    message_type: 'text',
    is_demo: true,
  });
  if (error) throw error;
}

export async function callNextDemoQueue(input: { companyId: string; shopId: string; userId?: string | null; branchId?: string | null }) {
  const admin = createAdminClient();
  let query = admin
    .from('bookings')
    .select('id,queue_number,branch_id')
    .eq('company_id', input.companyId)
    .eq('shop_id', input.shopId)
    .eq('is_demo', true)
    .eq('is_deleted', false)
    .eq('status', 'waiting')
    .order('created_at', { ascending: true })
    .limit(1);
  if (input.branchId) query = query.eq('branch_id', input.branchId);
  const { data: booking, error: findError } = await query.maybeSingle();
  if (findError) throw findError;
  if (!booking) return { called: false };

  const { error: updateError } = await admin
    .from('bookings')
    .update({
      status: 'called',
      called_at: new Date().toISOString(),
      called_by: input.userId ?? null,
      call_count: 1,
      updated_by: input.userId ?? null,
    })
    .eq('id', booking.id);
  if (updateError) throw updateError;

  await admin.from('booking_logs').insert({
    company_id: input.companyId,
    shop_id: input.shopId,
    booking_id: booking.id,
    action: 'demo_call_queue',
    description: `Call demo queue ${booking.queue_number}`,
    is_demo: true,
    created_by: input.userId ?? null,
    updated_by: input.userId ?? null,
  });

  await admin.from('demo_chat_messages').insert({
    company_id: input.companyId,
    shop_id: input.shopId,
    branch_id: booking.branch_id ?? null,
    direction: 'bot',
    message_text: `ถึงคิวของคุณแล้วค่ะ เลขคิว ${booking.queue_number}`,
    message_type: 'text',
    related_booking_id: booking.id,
    is_demo: true,
  });

  return { called: true, queue_number: booking.queue_number };
}

type DemoPayableBooking = {
  id: string;
  queue_number: string;
  branch_id: string | null;
  line_user_id: string | null;
  payment_amount: number | null;
  services: { price: number | null } | { price: number | null }[] | null;
};

/**
 * Find one demo booking that still owes money, newest first.
 *
 * Falls back to the service price when the booking has no invoice yet, so a
 * sandbox that was seeded before prices existed still has something to charge.
 */
async function findDemoPayableBooking(input: { companyId: string; shopId: string }) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('bookings')
    .select('id,queue_number,branch_id,line_user_id,payment_amount,services(price)')
    .eq('company_id', input.companyId)
    .eq('shop_id', input.shopId)
    .eq('is_demo', true)
    .eq('is_deleted', false)
    .neq('payment_status', 'paid')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<DemoPayableBooking>();
  if (error) throw error;
  if (!data) throw new Error('ไม่พบคิว demo ที่ยังไม่ได้ชำระเงิน — กดสร้างข้อมูลตัวอย่างก่อน');

  const service = Array.isArray(data.services) ? data.services[0] : data.services;
  const amount = Number(data.payment_amount ?? service?.price ?? 0);
  if (amount <= 0) throw new Error('คิว demo นี้ไม่มียอดที่ต้องชำระ — เลือกประเภทธุรกิจที่มีราคาบริการแล้วสร้างใหม่');

  return { booking: data, amount };
}

/**
 * Which demo booking the next payment demo will act on.
 *
 * The slip demo needs this up front: the slip image is drawn in the browser, so
 * the client has to know the amount before it can render a believable receipt.
 */
export async function getDemoPaymentTarget(input: { companyId: string; shopId: string }) {
  const { booking, amount } = await findDemoPayableBooking(input);
  return { queue_number: booking.queue_number, amount };
}

/**
 * Demo of the Omise PromptPay path: invoice then instant confirmation.
 *
 * The real flow gets that confirmation from an Omise webhook. Here it is
 * applied directly — no charge is created, no Omise key is read, and the shop's
 * qr_payment_enabled flag is never touched.
 */
export async function simulateDemoQrPayment(input: { companyId: string; shopId: string; userId?: string | null }) {
  const admin = createAdminClient();
  const { booking, amount } = await findDemoPayableBooking(input);
  const now = new Date().toISOString();

  const { error: updateError } = await admin
    .from('bookings')
    .update({
      payment_method: 'omise_promptpay',
      payment_amount: amount,
      payment_status: 'paid',
      paid_at: now,
      payment_expires_at: null,
      payment_reject_reason: null,
      updated_by: input.userId ?? null,
    })
    .eq('id', booking.id);
  if (updateError) throw updateError;

  await admin.from('payment_transactions').insert({
    company_id: input.companyId,
    shop_id: input.shopId,
    booking_id: booking.id,
    omise_charge_id: null,
    method: 'omise_promptpay',
    amount,
    currency: 'THB',
    status: 'successful',
    event_type: 'demo.charge.complete',
    note: 'Demo payment — no money moved',
    is_demo: true,
    created_by: input.userId ?? null,
    updated_by: input.userId ?? null,
  });

  await admin.from('booking_logs').insert({
    company_id: input.companyId,
    shop_id: input.shopId,
    booking_id: booking.id,
    action: 'demo_payment_qr',
    description: `Demo QR payment ${booking.queue_number} — ${amount} THB`,
    is_demo: true,
    created_by: input.userId ?? null,
    updated_by: input.userId ?? null,
  });

  await admin.from('demo_chat_messages').insert({
    company_id: input.companyId,
    shop_id: input.shopId,
    branch_id: booking.branch_id ?? null,
    direction: 'bot',
    message_text: `ชำระเงินสำเร็จค่ะ คิว ${booking.queue_number} ยอด ${amount} บาท`,
    message_type: 'text',
    related_booking_id: booking.id,
    is_demo: true,
  });

  return { queue_number: booking.queue_number, amount };
}

/**
 * Demo of the bank-transfer path: the customer's slip lands in the shop's real
 * verification queue, so the owner can approve or reject it with the same
 * screen they would use in production.
 */
export async function createDemoPaymentSlip(input: {
  companyId: string;
  shopId: string;
  userId?: string | null;
  file: { bytes: ArrayBuffer; mimeType: string };
}) {
  const admin = createAdminClient();
  const { booking, amount } = await findDemoPayableBooking(input);

  await ensurePaymentSlipBucket(admin);

  const objectKey = `${demoSlipPrefix(input.shopId)}/${booking.id}-${Date.now()}.png`;
  const { error: uploadError } = await admin.storage
    .from(PAYMENT_SLIP_BUCKET)
    .upload(objectKey, input.file.bytes, { contentType: input.file.mimeType, upsert: true });
  if (uploadError) throw uploadError;

  const now = new Date().toISOString();

  // Any earlier demo slip for this booking is history, same as production does
  // when a customer re-uploads.
  await admin
    .from('payment_slips')
    .update({ status: 'superseded', updated_at: now, updated_by: input.userId ?? null })
    .eq('booking_id', booking.id)
    .eq('status', 'pending')
    .eq('is_deleted', false);

  const { data: slip, error: slipError } = await admin
    .from('payment_slips')
    .insert({
      company_id: input.companyId,
      shop_id: input.shopId,
      booking_id: booking.id,
      storage_path: objectKey,
      mime_type: input.file.mimeType,
      file_size: input.file.bytes.byteLength,
      amount_claimed: amount,
      transferred_at: now,
      status: 'pending',
      uploaded_by_line_user: booking.line_user_id ?? null,
      is_demo: true,
      created_by: input.userId ?? null,
      updated_by: input.userId ?? null,
    })
    .select('id')
    .single();
  if (slipError) throw slipError;

  const { error: bookingError } = await admin
    .from('bookings')
    .update({
      payment_method: 'bank_transfer',
      payment_amount: amount,
      payment_status: 'awaiting_verification',
      payment_reject_reason: null,
      updated_by: input.userId ?? null,
    })
    .eq('id', booking.id);
  if (bookingError) throw bookingError;

  await admin.from('booking_logs').insert({
    company_id: input.companyId,
    shop_id: input.shopId,
    booking_id: booking.id,
    action: 'demo_payment_slip',
    description: `Demo transfer slip ${booking.queue_number} — ${amount} THB`,
    is_demo: true,
    created_by: input.userId ?? null,
    updated_by: input.userId ?? null,
  });

  await admin.from('demo_chat_messages').insert({
    company_id: input.companyId,
    shop_id: input.shopId,
    branch_id: booking.branch_id ?? null,
    direction: 'customer',
    message_text: `ส่งสลิปการโอนของคิว ${booking.queue_number} แล้วค่ะ`,
    message_type: 'text',
    related_booking_id: booking.id,
    is_demo: true,
  });

  return { queue_number: booking.queue_number, amount, slip_id: slip.id, booking_id: booking.id };
}

export async function updateDemoChecklist(input: {
  companyId: string;
  shopId: string;
  userId?: string | null;
  checklist: Record<string, boolean>;
}) {
  const admin = createAdminClient();
  const { data: session } = await admin
    .from('demo_sandbox_sessions')
    .select('id')
    .eq('company_id', input.companyId)
    .eq('shop_id', input.shopId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session?.id) throw new Error('ไม่พบ demo session');

  const { error } = await admin
    .from('demo_sandbox_sessions')
    .update({
      checklist: input.checklist,
      updated_at: new Date().toISOString(),
    })
    .eq('id', session.id);
  if (error) throw error;
}

/**
 * Leaves trial mode without touching any data: clears the demo flags on the
 * shop and its company and writes the audit row. Demo-tagged rows stay as they
 * are — unlike `convertDemoToReal`, nothing is archived or deleted, which is
 * why it is the safe choice when a shop's setup steps were met by sample data.
 *
 * @param input.userId - Acting user, for the audit log and `updated_by`.
 */
export async function disableDemoMode(input: { companyId: string; shopId: string; userId?: string | null }) {
  const admin = createAdminClient();
  const { error: shopError } = await admin
    .from('shops')
    .update({ demo_mode_enabled: false, is_demo: false, updated_by: input.userId ?? null })
    .eq('id', input.shopId);
  if (shopError) throw shopError;
  const { error: companyError } = await admin
    .from('companies')
    .update({ is_demo: false, updated_by: input.userId ?? null })
    .eq('id', input.companyId);
  if (companyError) throw companyError;

  await writeAuditLog({
    companyId: input.companyId,
    shopId: input.shopId,
    userId: input.userId ?? null,
    action: 'demo_mode_disabled',
    targetTable: 'shops',
    targetId: input.shopId,
  });
}

export async function convertDemoToReal(input: {
  companyId: string;
  shopId: string;
  userId?: string | null;
  keepBranches: boolean;
  keepServices: boolean;
  keepResources: boolean;
}) {
  const admin = createAdminClient();

  if (input.keepBranches) {
    await admin
      .from('branches')
      .update({ is_demo: false, updated_by: input.userId ?? null })
      .eq('company_id', input.companyId)
      .eq('shop_id', input.shopId)
      .eq('is_demo', true)
      .eq('is_deleted', false);

    // Keep the branch's working hours with it — a real branch that loses them
    // stops producing slots, which is exactly the trap this convert is meant
    // to avoid.
    await admin
      .from('working_hours')
      .update({ is_demo: false, updated_by: input.userId ?? null })
      .eq('company_id', input.companyId)
      .eq('shop_id', input.shopId)
      .eq('is_demo', true)
      .eq('is_deleted', false);
  }

  if (input.keepServices) {
    await admin
      .from('services')
      .update({ is_demo: false, updated_by: input.userId ?? null })
      .eq('company_id', input.companyId)
      .eq('shop_id', input.shopId)
      .eq('is_demo', true)
      .eq('is_deleted', false);
  }

  if (input.keepResources) {
    await admin
      .from('booking_resources')
      .update({ is_demo: false, updated_by: input.userId ?? null })
      .eq('company_id', input.companyId)
      .eq('shop_id', input.shopId)
      .eq('is_demo', true)
      .eq('is_deleted', false);
  }

  // Demo slips go with the demo bookings — leaving them behind would put fake
  // rows in a now-real verification queue.
  await admin
    .from('payment_slips')
    .update({ is_deleted: true, updated_by: input.userId ?? null })
    .eq('company_id', input.companyId)
    .eq('shop_id', input.shopId)
    .eq('is_demo', true)
    .eq('is_deleted', false);

  await admin
    .from('payment_transactions')
    .delete()
    .eq('company_id', input.companyId)
    .eq('shop_id', input.shopId)
    .eq('is_demo', true);

  await removeDemoSlipObjects(input.shopId);

  await admin
    .from('bookings')
    .update({
      is_deleted: true,
      status: 'cancelled',
      note: 'Archived from demo convert',
      updated_by: input.userId ?? null,
    })
    .eq('company_id', input.companyId)
    .eq('shop_id', input.shopId)
    .eq('is_demo', true)
    .eq('is_deleted', false);

  await admin
    .from('shops')
    .update({
      demo_mode_enabled: false,
      is_demo: false,
      updated_by: input.userId ?? null,
    })
    .eq('id', input.shopId);

  await admin
    .from('companies')
    .update({
      is_demo: false,
      updated_by: input.userId ?? null,
    })
    .eq('id', input.companyId);

  await admin
    .from('demo_sandbox_sessions')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      converted_at: new Date().toISOString(),
      converted_by: input.userId ?? null,
    })
    .eq('company_id', input.companyId)
    .eq('shop_id', input.shopId)
    .eq('status', 'active');

  await writeAuditLog({
    companyId: input.companyId,
    shopId: input.shopId,
    userId: input.userId ?? null,
    action: 'demo_converted_to_real',
    targetTable: 'demo_sandbox_sessions',
    payload: {
      keep_branches: input.keepBranches,
      keep_services: input.keepServices,
      keep_resources: input.keepResources,
    },
  });

  return { ok: true };
}
