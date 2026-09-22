import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { isOneBookingPerDay, isServiceDurationVisible } from '@/lib/booking/display-settings';

// Each switch on the Services page saves on its own, so every key is optional
// and only the keys present are written.
const PatchSchema = z
  .object({
    show_service_duration: z.boolean().optional(),
    one_booking_per_day: z.boolean().optional(),
  })
  .refine((b) => b.show_service_duration !== undefined || b.one_booking_per_day !== undefined, {
    message: 'nothing to update',
  });

/** Read the shop's customer-facing booking flags. */
export async function GET() {
  try {
    const { supabase, profile } = await requireAuthContext({
      roles: ['super_admin', 'shop_owner', 'branch_manager'],
    });
    const shopId = profile.shop_id as string;
    const [showServiceDuration, oneBookingPerDay] = await Promise.all([
      isServiceDurationVisible(supabase, shopId),
      isOneBookingPerDay(supabase, shopId),
    ]);
    return NextResponse.json({ data: { show_service_duration: showServiceDuration, one_booking_per_day: oneBookingPerDay } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

/** Update the shop's customer-facing booking flags (only the keys sent). */
export async function PATCH(req: Request) {
  try {
    const { supabase, user, profile } = await requireAuthContext({
      roles: ['super_admin', 'shop_owner'],
    });
    const body = PatchSchema.parse(await req.json());

    const patch: Record<string, boolean | string> = { updated_by: user.id };
    if (body.show_service_duration !== undefined) patch.show_service_duration = body.show_service_duration;
    if (body.one_booking_per_day !== undefined) patch.one_booking_per_day = body.one_booking_per_day;

    const { error } = await supabase.from('shops').update(patch).eq('id', profile.shop_id);
    if (error) {
      console.error('[shop_display_settings_update_failed]', error.message);
      return NextResponse.json({ error: 'บันทึกการตั้งค่าไม่สำเร็จ' }, { status: 400 });
    }

    return NextResponse.json({ data: { show_service_duration: body.show_service_duration, one_booking_per_day: body.one_booking_per_day } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
