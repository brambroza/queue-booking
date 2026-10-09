import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { createAdminClient } from '@/lib/supabase/admin';
import { paymentSecretBox } from '@/lib/crypto/secret-box';
import { writeAuditLog } from '@/lib/audit/activity-log';
import { SLIP_PROVIDER_IDS } from '@/lib/payments/slip/providers/types';
import { getSlipProviderAdapter, listSlipProviders } from '@/lib/payments/slip/providers/registry';
import {
  SLIP_PROVIDER_TABLE,
  isPlatformSlipKeyAvailable,
  loadShopSlipProviderRows,
  resolveSlipProviderSource,
  type SlipProviderRow,
} from '@/lib/payments/slip/providers/settings';

/**
 * Per-shop slip verification key.
 *
 * Service-role reads and writes on purpose: the table holds a sealed vendor key
 * and therefore has RLS enabled with no policies. Authorization happens here
 * (owner roles) and every query is scoped by profile.shop_id — the same
 * documented exception as the bank deeplink settings.
 */

const ROLES = ['super_admin', 'shop_owner'] as const;

const patchSchema = z.object({
  provider: z.enum(SLIP_PROVIDER_IDS),
  enabled: z.boolean().optional(),
  /** Adapter-specific credential fields; validated by the adapter, sealed before storage. */
  credentials: z.record(z.string(), z.string()).optional(),
});

function present(row: SlipProviderRow | undefined, provider: string, displayName: string, available: boolean) {
  return {
    provider,
    display_name: displayName,
    available,
    enabled: row?.enabled ?? false,
    credentials_set: Boolean(row?.credentials_enc),
    credentials_hint: row?.credentials_hint ?? null,
    last_test_at: row?.last_test_at ?? null,
    last_test_ok: row?.last_test_ok ?? null,
  };
}

export async function GET() {
  try {
    const { profile } = await requireAuthContext({ roles: [...ROLES] });
    const admin = createAdminClient();
    const [rows, resolved] = await Promise.all([
      loadShopSlipProviderRows(admin, profile.shop_id),
      resolveSlipProviderSource(admin, profile.shop_id),
    ]);

    return NextResponse.json({
      data: {
        source: resolved.source,
        provider: resolved.source === 'none' ? null : resolved.provider,
        plan_locked: resolved.source === 'none' && resolved.reason === 'plan_locked',
        plan_code: resolved.source === 'none' ? resolved.planCode : null,
        platform_available: isPlatformSlipKeyAvailable(),
        credentials_key_configured: paymentSecretBox().configured,
        providers: listSlipProviders().map(({ provider, displayName, available }) =>
          present(rows.find((r) => r.provider === provider), provider, displayName, available),
        ),
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function PATCH(req: Request) {
  try {
    const { user, profile } = await requireAuthContext({ roles: [...ROLES] });
    const parsed = patchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    const d = parsed.data;
    const adapter = getSlipProviderAdapter(d.provider);

    const admin = createAdminClient();
    const rows = await loadShopSlipProviderRows(admin, profile.shop_id);
    const existing = rows.find((r) => r.provider === d.provider);

    const updates: Record<string, unknown> = { updated_by: user.id, updated_at: new Date().toISOString() };
    if (d.enabled !== undefined) updates.enabled = d.enabled;

    // The key is replaced only when a non-blank one arrives — a form that
    // re-submits an empty password field must not wipe the stored one.
    let rotated = false;
    if (d.credentials && Object.values(d.credentials).some((v) => v.trim())) {
      let credentials: unknown;
      try {
        credentials = adapter.parseCredentials(d.credentials);
      } catch {
        return NextResponse.json({ error: 'API key ไม่ถูกต้อง (สั้นเกินไปหรือว่าง)' }, { status: 400 });
      }
      const box = paymentSecretBox();
      if (!box.configured) return NextResponse.json({ error: 'ระบบยังไม่ได้ตั้งค่า key สำหรับเข้ารหัส credentials' }, { status: 500 });
      updates.credentials_enc = box.seal(JSON.stringify(credentials));
      updates.credentials_hint = adapter.credentialsHint(credentials);
      updates.last_test_at = null;
      updates.last_test_ok = null;
      rotated = true;
    }

    // Enabling without a key would silently fall back to the platform key.
    const enabledAfter = d.enabled ?? existing?.enabled ?? false;
    const credsAfter = (updates.credentials_enc as string | undefined) ?? existing?.credentials_enc ?? null;
    if (enabledAfter && !credsAfter) {
      return NextResponse.json({ error: 'ต้องใส่ API key ก่อนเปิดใช้ key ของร้าน' }, { status: 400 });
    }

    if (existing) {
      const { error } = await admin.from(SLIP_PROVIDER_TABLE).update(updates).eq('id', existing.id).eq('shop_id', profile.shop_id);
      if (error) throw error;
    } else {
      const { error } = await admin.from(SLIP_PROVIDER_TABLE).insert({
        company_id: profile.company_id,
        shop_id: profile.shop_id,
        provider: d.provider,
        enabled: false,
        created_by: user.id,
        ...updates,
      });
      if (error) throw error;
    }

    await writeAuditLog({
      companyId: profile.company_id,
      shopId: profile.shop_id,
      userId: user.id,
      action: 'data_updated',
      targetTable: SLIP_PROVIDER_TABLE,
      targetId: existing?.id ?? null,
      payload: { provider: d.provider, enabled: enabledAfter, credentials_rotated: rotated },
    });

    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
