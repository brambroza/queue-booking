import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { getShopPaymentConfig, toPublicPaymentInfo } from '@/lib/payments/settings';
import { buildPromptPayQrUrl } from '@/lib/payments/transfer';
import { isOwnerLookupFailure, resolveBookingForLineUser } from '@/lib/payments/liff-auth';
import { signSlipUrl } from '@/lib/storage/buckets';

const schema = z.object({
  line_user_id: z.string().min(1),
  booking_id: z.string().uuid(),
  /** LIFF ID token, verified when the shop has a LINE Login channel configured. */
  id_token: z.string().optional(),
});

/**
 * Payment state of one booking, for the LIFF payment panel.
 * POST because the caller identifies itself with a body, same as cancel-booking.
 */
export async function POST(req: Request, { params }: { params: Promise<{ shopKey: string }> }) {
  const { shopKey } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const admin = createAdminClient();
  const owner = await resolveBookingForLineUser(admin, shopKey, parsed.data.line_user_id, parsed.data.booking_id, parsed.data.id_token);
  if (isOwnerLookupFailure(owner)) return NextResponse.json({ error: owner.error }, { status: owner.status });

  const { booking, shop } = owner;
  const config = await getShopPaymentConfig(admin, shop.id);

  // Latest slip the customer submitted for this booking, superseded ones excluded.
  const { data: slip } = await admin
    .from('payment_slips')
    .select('id,status,reject_reason,amount_claimed,transferred_at,created_at,storage_path')
    .eq('booking_id', booking.id)
    .eq('shop_id', shop.id)
    .neq('status', 'superseded')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const slipUrl = slip?.storage_path ? await signSlipUrl(admin, slip.storage_path) : null;

  return NextResponse.json({
    data: {
      booking_id: booking.id,
      queue_number: booking.queue_number,
      payment_status: booking.payment_status,
      payment_method: booking.payment_method,
      payment_amount: booking.payment_amount,
      payment_expires_at: booking.payment_expires_at,
      payment_reject_reason: booking.payment_reject_reason,
      qr_image_url: booking.payment_method === 'bank_transfer' ? buildPromptPayQrUrl(booking.id) : null,
      payee: toPublicPaymentInfo(config),
      slip: slip
        ? {
            id: slip.id,
            status: slip.status,
            reject_reason: slip.reject_reason,
            amount_claimed: slip.amount_claimed,
            transferred_at: slip.transferred_at,
            created_at: slip.created_at,
            // Short-lived and minted per request — never persisted.
            image_url: slipUrl,
          }
        : null,
    },
  });
}
