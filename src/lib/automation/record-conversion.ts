import type { SupabaseClient } from '@supabase/supabase-js';
import { ATTRIBUTION_WINDOW_DAYS, pickAttributableSend, type SendForAttribution } from '@/lib/automation/attribution';

/**
 * Credits a new customer booking to the automated push that most likely
 * brought it (see `pickAttributableSend`). Side effect only — never throws, and
 * a missing `automation_sends` table (migration 202610230001 not run) is a no-op.
 *
 * @param admin - Service-role client.
 * @param args.revenue - Estimated value of the booking (service price × queues).
 */
export async function safeRecordAutomationConversion(
  admin: SupabaseClient,
  args: { shopId: string; customerId: string | null; bookingId: string; revenue: number; bookedAt?: Date },
): Promise<string | null> {
  try {
    if (!args.customerId) return null;
    const bookedAt = args.bookedAt ?? new Date();
    const from = new Date(bookedAt.getTime() - ATTRIBUTION_WINDOW_DAYS * 86_400_000).toISOString();
    const { data, error } = await admin
      .from('automation_sends')
      .select('id,kind,sent_at,status,converted_booking_id')
      .eq('shop_id', args.shopId)
      .eq('customer_id', args.customerId)
      .eq('status', 'sent')
      .is('converted_booking_id', null)
      .gte('sent_at', from)
      .order('sent_at', { ascending: false })
      .limit(10);
    if (error || !data) return null;

    const sendId = pickAttributableSend(data as SendForAttribution[], bookedAt);
    if (!sendId) return null;

    const { error: updateError } = await admin
      .from('automation_sends')
      .update({
        converted_booking_id: args.bookingId,
        converted_at: bookedAt.toISOString(),
        revenue_estimate: Math.max(0, Number(args.revenue) || 0),
      })
      .eq('id', sendId)
      .eq('shop_id', args.shopId)
      .is('converted_booking_id', null);
    if (updateError) {
      console.warn('[automation] conversion update failed:', updateError.message);
      return null;
    }
    return sendId;
  } catch (e) {
    console.warn('[automation] conversion failed:', e instanceof Error ? e.message : e);
    return null;
  }
}
