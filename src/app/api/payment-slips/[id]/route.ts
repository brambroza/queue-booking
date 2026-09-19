import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { createAdminClient } from '@/lib/supabase/admin';
import { pushMessage } from '@/lib/line/client';
import { slipRejectedFlex } from '@/lib/line/messages-payment';
import { approveSlip } from '@/lib/payments/slip/approve';

const schema = z
  .object({
    action: z.enum(['approve', 'reject']),
    reject_reason: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.action !== 'reject' || Boolean(v.reject_reason), {
    message: 'reject_reason is required when rejecting',
  });

/** Push a LINE message to a booking's customer. Never throws — a failed push must not undo a decision. */
async function notifyCustomer(
  admin: ReturnType<typeof createAdminClient>,
  shopId: string,
  lineUserPk: string | null,
  messages: object[],
) {
  if (!lineUserPk) return;
  try {
    const [{ data: lineUser }, { data: shopLine }] = await Promise.all([
      admin.from('line_users').select('line_user_id').eq('id', lineUserPk).maybeSingle(),
      admin.from('shops').select('line_channel_access_token').eq('id', shopId).maybeSingle(),
    ]);
    const token = shopLine?.line_channel_access_token || process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
    if (!token || !lineUser?.line_user_id) return;
    await pushMessage(token, lineUser.line_user_id, messages);
  } catch (e) {
    console.error('[slip] customer notify failed:', e instanceof Error ? e.message : e);
  }
}

/**
 * Approve or reject one uploaded slip.
 *
 * Plain `staff` is excluded on purpose: confirming that money arrived is a
 * financial decision, not a queue operation.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, user, profile } = await requireAuthContext({
      roles: ['super_admin', 'shop_owner', 'branch_manager'],
    });

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    const { action, reject_reason } = parsed.data;

    // Session client + tenant filter: a slip from another shop is simply not found.
    const { data: slip } = await supabase
      .from('payment_slips')
      .select('id,booking_id,status,amount_claimed')
      .eq('id', id)
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false)
      .maybeSingle();
    if (!slip) return NextResponse.json({ error: 'Slip not found' }, { status: 404 });

    // Idempotency: a second reviewer acting on the same slip gets a conflict
    // rather than a duplicate transaction row.
    if (slip.status !== 'pending') {
      return NextResponse.json({ error: 'สลิปนี้ถูกตรวจสอบไปแล้ว' }, { status: 409 });
    }

    const { data: booking } = await supabase
      .from('bookings')
      .select('id,queue_number,payment_amount,line_user_id')
      .eq('id', slip.booking_id)
      .eq('shop_id', profile.shop_id)
      .maybeSingle();
    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

    const admin = createAdminClient();
    const { data: shopRow } = await admin
      .from('shops')
      .select('name,shop_key')
      .eq('id', profile.shop_id)
      .maybeSingle();
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '');
    const uploadUrl = appUrl && shopRow?.shop_key
      ? `${appUrl}/liff/${encodeURIComponent(shopRow.shop_key)}?tab=account`
      : null;

    const now = new Date().toISOString();
    const amount = Number(booking.payment_amount ?? 0);

    if (action === 'approve') {
      const result = await approveSlip(admin, {
        slipId: slip.id,
        bookingId: booking.id,
        shopId: profile.shop_id,
        companyId: profile.company_id,
        reviewerId: user.id,
        amountClaimed: slip.amount_claimed === null ? null : Number(slip.amount_claimed),
      });
      if (!result.ok) {
        if (result.reason === 'not_pending') {
          return NextResponse.json({ error: 'สลิปนี้ถูกตรวจสอบไปแล้ว' }, { status: 409 });
        }
        if (result.reason === 'duplicate_trans_ref') {
          return NextResponse.json({ error: 'สลิปนี้ถูกใช้ยืนยันการชำระเงินของรายการอื่นไปแล้ว (สลิปซ้ำ)' }, { status: 409 });
        }
        return NextResponse.json({ error: 'ดำเนินการไม่สำเร็จ' }, { status: result.reason === 'booking_not_found' ? 404 : 500 });
      }
      return NextResponse.json({ data: { status: 'approved' } });
    }

    // ── reject ──
    const reason = reject_reason as string;
    const { error: slipError } = await admin
      .from('payment_slips')
      .update({ status: 'rejected', reject_reason: reason, reviewed_by: user.id, reviewed_at: now, updated_by: user.id })
      .eq('id', slip.id)
      .eq('status', 'pending');
    if (slipError) throw slipError;

    await admin
      .from('bookings')
      .update({ payment_status: 'rejected', payment_reject_reason: reason })
      .eq('id', booking.id)
      .eq('shop_id', profile.shop_id);

    await admin.from('payment_transactions').insert({
      company_id: profile.company_id,
      shop_id: profile.shop_id,
      booking_id: booking.id,
      slip_id: slip.id,
      method: 'bank_transfer',
      amount,
      currency: 'THB',
      status: 'failed',
      event_type: 'slip.rejected',
      note: reason,
      raw_event: { reviewed_by: user.id, reason },
      created_by: user.id,
    });

    await admin.from('booking_logs').insert({
      company_id: profile.company_id,
      shop_id: profile.shop_id,
      booking_id: booking.id,
      action: 'payment_slip_rejected',
      description: `Slip rejected for ${booking.queue_number}: ${reason}`,
      created_by: user.id,
    });

    await notifyCustomer(admin, profile.shop_id, booking.line_user_id, [
      slipRejectedFlex({
        shopName: shopRow?.name ?? 'Queue Booking',
        queueNumber: booking.queue_number,
        amountTHB: amount,
        reason,
        uploadUrl,
      }),
    ]);

    return NextResponse.json({ data: { status: 'rejected' } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
