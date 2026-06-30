import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';

const patchSchema = z.object({
  qr_payment_enabled: z.boolean().optional(),
  omise_public_key: z.string().optional(),
  omise_secret_key: z.string().optional(),
});

export async function GET(_req: Request) {
  try {
    const { supabase, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner'] });

    const { data, error } = await supabase
      .from('shops')
      .select('qr_payment_enabled, omise_public_key, omise_secret_key')
      .eq('id', profile.shop_id)
      .maybeSingle();

    if (error) throw error;

    // Mask secret key in response — show only last 4 chars
    const masked = data?.omise_secret_key
      ? `skey_...${data.omise_secret_key.slice(-4)}`
      : null;

    return NextResponse.json({
      data: {
        qr_payment_enabled: data?.qr_payment_enabled ?? false,
        omise_public_key: data?.omise_public_key ?? null,
        omise_secret_key_set: !!data?.omise_secret_key,
        omise_secret_key_hint: masked,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function PATCH(req: Request) {
  try {
    const { supabase, user, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner'] });
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

    const updates: Record<string, unknown> = { updated_by: user.id };
    const d = parsed.data;

    if (d.qr_payment_enabled !== undefined) updates.qr_payment_enabled = d.qr_payment_enabled;
    if (d.omise_public_key !== undefined) updates.omise_public_key = d.omise_public_key || null;
    // Only update secret key if a full key is provided (not the masked hint)
    if (d.omise_secret_key && !d.omise_secret_key.includes('...')) {
      updates.omise_secret_key = d.omise_secret_key;
    }

    const { error } = await supabase
      .from('shops')
      .update(updates)
      .eq('id', profile.shop_id);

    if (error) throw error;
    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
