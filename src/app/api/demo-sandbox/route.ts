import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { getErrorStatus, requireAuthContext } from '@/lib/auth/context';
import {
  callNextDemoQueue,
  convertDemoToReal,
  createDemoBooking,
  createDemoSandbox,
  resetDemoSandbox,
  sendDemoChatMessage,
  updateDemoChecklist,
  type DemoBusinessType,
} from '@/lib/demo/sandbox';
import { writeAuditLog } from '@/lib/audit/activity-log';

const actionSchema = z.object({
  action: z.enum(['create', 'reset', 'disable', 'create_booking', 'call_next', 'send_mock', 'convert_to_real', 'update_checklist']),
  business_type: z.enum(['barber', 'clinic', 'restaurant', 'buffet', 'meeting_room', 'general_service']).optional(),
  message_text: z.string().optional(),
  direction: z.enum(['customer', 'bot', 'system']).optional(),
  keep_branches: z.boolean().optional(),
  keep_services: z.boolean().optional(),
  keep_resources: z.boolean().optional(),
  checklist: z.record(z.boolean()).optional(),
});

async function resolveTenant(userId: string, profile: { company_id: string | null; shop_id: string | null }) {
  if (profile.company_id && profile.shop_id) {
    return { companyId: profile.company_id, shopId: profile.shop_id };
  }
  const admin = createAdminClient();
  const { data: roleContext } = await admin
    .from('user_roles')
    .select('company_id,shop_id')
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .not('shop_id', 'is', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (roleContext?.company_id && roleContext?.shop_id) {
    return { companyId: roleContext.company_id, shopId: roleContext.shop_id };
  }
  throw new Error('Missing shop context');
}

export async function GET() {
  try {
    const { user, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager', 'staff'] });
    const tenant = await resolveTenant(user.id, profile);
    const admin = createAdminClient();

    const [{ data: shop }, { data: session }, { count: demoBookingCount }, { data: chats }] = await Promise.all([
      admin
        .from('shops')
        .select('id,name,demo_mode_enabled,demo_business_type,line_setup_completed,is_demo,shop_key')
        .eq('id', tenant.shopId)
        .single(),
      admin
        .from('demo_sandbox_sessions')
        .select('id,business_type,status,started_at,reset_count,last_reset_at,checklist,completed_at,converted_at')
        .eq('shop_id', tenant.shopId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin.from('bookings').select('id', { count: 'exact', head: true }).eq('shop_id', tenant.shopId).eq('is_demo', true).eq('is_deleted', false),
      admin
        .from('demo_chat_messages')
        .select('id,direction,message_text,created_at')
        .eq('shop_id', tenant.shopId)
        .order('created_at', { ascending: true })
        .limit(100),
    ]);

    return NextResponse.json({
      data: {
        shop,
        session,
        has_demo_data: (demoBookingCount ?? 0) > 0,
        chats: chats ?? [],
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function POST(req: Request) {
  try {
    const { user, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager'] });
    const body = await req.json();
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload', issues: parsed.error.issues }, { status: 400 });

    const tenant = await resolveTenant(user.id, profile);
    const admin = createAdminClient();

    if (parsed.data.action === 'create') {
      const businessType = (parsed.data.business_type ?? 'general_service') as DemoBusinessType;
      await createDemoSandbox({
        companyId: tenant.companyId,
        shopId: tenant.shopId,
        userId: user.id,
        businessType,
      });
      return NextResponse.json({ data: true });
    }

    if (parsed.data.action === 'reset') {
      await resetDemoSandbox({
        companyId: tenant.companyId,
        shopId: tenant.shopId,
        userId: user.id,
        businessType: parsed.data.business_type as DemoBusinessType | undefined,
      });
      return NextResponse.json({ data: true });
    }

    if (parsed.data.action === 'create_booking') {
      const booking = await createDemoBooking({
        companyId: tenant.companyId,
        shopId: tenant.shopId,
        userId: user.id,
      });
      return NextResponse.json({ data: booking });
    }

    if (parsed.data.action === 'call_next') {
      const result = await callNextDemoQueue({
        companyId: tenant.companyId,
        shopId: tenant.shopId,
        userId: user.id,
      });
      return NextResponse.json({ data: result });
    }

    if (parsed.data.action === 'send_mock') {
      await sendDemoChatMessage({
        companyId: tenant.companyId,
        shopId: tenant.shopId,
        direction: parsed.data.direction ?? 'bot',
        text: parsed.data.message_text?.trim() || 'นี่คือข้อความตัวอย่างจากระบบ Mock LINE',
      });
      return NextResponse.json({ data: true });
    }

    if (parsed.data.action === 'update_checklist') {
      await updateDemoChecklist({
        companyId: tenant.companyId,
        shopId: tenant.shopId,
        userId: user.id,
        checklist: parsed.data.checklist ?? {},
      });
      return NextResponse.json({ data: true });
    }

    if (parsed.data.action === 'convert_to_real') {
      await convertDemoToReal({
        companyId: tenant.companyId,
        shopId: tenant.shopId,
        userId: user.id,
        keepBranches: Boolean(parsed.data.keep_branches),
        keepServices: Boolean(parsed.data.keep_services),
        keepResources: Boolean(parsed.data.keep_resources),
      });
      return NextResponse.json({ data: true });
    }

    await admin
      .from('shops')
      .update({ demo_mode_enabled: false, is_demo: false, updated_by: user.id })
      .eq('id', tenant.shopId);
    await admin
      .from('companies')
      .update({ is_demo: false, updated_by: user.id })
      .eq('id', tenant.companyId);

    await writeAuditLog({
      companyId: tenant.companyId,
      shopId: tenant.shopId,
      userId: user.id,
      action: 'demo_mode_disabled',
      targetTable: 'shops',
      targetId: tenant.shopId,
    });

    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
