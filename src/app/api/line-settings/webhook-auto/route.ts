import { NextResponse } from 'next/server';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { writeAuditLog } from '@/lib/audit/activity-log';
import { provisionWebhook, WebhookProvisionError } from '@/lib/line/webhook-provision';

/**
 * Set the shop's webhook URL on its Messaging API channel using the stored
 * channel access token, then run LINE's webhook test. Body `{ overwrite: true }`
 * replaces a webhook that currently points to another system.
 */
export async function POST(req: Request) {
  try {
    const { supabase, user, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner'] });
    const body = (await req.json().catch(() => ({}))) as { overwrite?: unknown };
    // Only the explicit button overwrites a webhook that points to another system.
    const overwrite = body.overwrite === true;

    const { data: shop, error } = await supabase
      .from('shops')
      .select('id,shop_key,line_channel_access_token')
      .eq('id', profile.shop_id)
      .single();
    if (error) throw error;
    if (!shop?.shop_key) return NextResponse.json({ error: 'ร้านนี้ยังไม่มี shop_key' }, { status: 400 });

    const result = await provisionWebhook({
      token: shop.line_channel_access_token ?? '',
      appUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://queuebooking.com',
      shopKey: shop.shop_key,
      overwrite,
    });

    await writeAuditLog({
      companyId: profile.company_id,
      shopId: profile.shop_id,
      userId: user.id,
      action: 'line_settings_webhook_auto_set',
      targetTable: 'shops',
      targetId: profile.shop_id ?? null,
      payload: { endpoint: result.endpoint, previous_endpoint: result.previousEndpoint, skipped: result.skipped, active: result.active, test_success: result.test.success, test_status: result.test.statusCode },
    });

    return NextResponse.json({ data: result });
  } catch (e) {
    if (e instanceof WebhookProvisionError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
