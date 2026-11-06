import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { isMultiSlotEnabled, isOneBookingPerDay, isResourceChoiceRequired, isServiceDurationVisible } from '@/lib/booking/display-settings';

// Each switch on the Services / Resources pages saves on its own, so every key is optional
// and only the keys present are written.
const PatchSchema = z
  .object({
    show_service_duration: z.boolean().optional(),
    one_booking_per_day: z.boolean().optional(),
    multi_slot_enabled: z.boolean().optional(),
    require_resource_choice: z.boolean().optional(),
  })
  .refine((b) => Object.values(b).some((v) => v !== undefined), {
    message: 'nothing to update',
  });

/** Read the shop's customer-facing booking flags. Staff read them too (bookings page). */
export async function GET() {
  try {
    const { supabase, profile } = await requireAuthContext({
      roles: ['super_admin', 'shop_owner', 'branch_manager', 'staff'],
    });
    const shopId = profile.shop_id as string;
    const [showServiceDuration, oneBookingPerDay, multiSlotEnabled, requireResourceChoice] = await Promise.all([
      isServiceDurationVisible(supabase, shopId),
      isOneBookingPerDay(supabase, shopId),
      isMultiSlotEnabled(supabase, shopId),
      isResourceChoiceRequired(supabase, shopId),
    ]);
    return NextResponse.json({
      data: {
        show_service_duration: showServiceDuration,
        one_booking_per_day: oneBookingPerDay,
        multi_slot_enabled: multiSlotEnabled,
        require_resource_choice: requireResourceChoice,
      },
    });
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
    if (body.multi_slot_enabled !== undefined) patch.multi_slot_enabled = body.multi_slot_enabled;
    if (body.require_resource_choice !== undefined) patch.require_resource_choice = body.require_resource_choice;

    const { error } = await supabase.from('shops').update(patch).eq('id', profile.shop_id);
    if (error) {
      console.error('[shop_display_settings_update_failed]', error.message);
      return NextResponse.json({ error: 'บันทึกการตั้งค่าไม่สำเร็จ' }, { status: 400 });
    }

    return NextResponse.json({
      data: {
        show_service_duration: body.show_service_duration,
        one_booking_per_day: body.one_booking_per_day,
        multi_slot_enabled: body.multi_slot_enabled,
        require_resource_choice: body.require_resource_choice,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
