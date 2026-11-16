import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import {
  isMultiSlotEnabled,
  isOneBookingPerDay,
  isResourceCapacityVisible,
  isResourceChoiceRequired,
  isServiceDurationVisible,
  isLiffPackagesAlwaysShown,
} from '@/lib/booking/display-settings';
import { invalidateCache } from '@/lib/cache/kv';

// Each switch on the Services / Resources pages saves on its own, so every key is optional
// and only the keys present are written.
const PatchSchema = z
  .object({
    show_service_duration: z.boolean().optional(),
    one_booking_per_day: z.boolean().optional(),
    multi_slot_enabled: z.boolean().optional(),
    require_resource_choice: z.boolean().optional(),
    show_resource_capacity: z.boolean().optional(),
    /** Always show "แพ็กเกจของฉัน" on the LIFF member page (set on /portal/packages). */
    liff_show_packages: z.boolean().optional(),
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
    const [showServiceDuration, oneBookingPerDay, multiSlotEnabled, requireResourceChoice, showResourceCapacity, liffShowPackages] = await Promise.all([
      isServiceDurationVisible(supabase, shopId),
      isOneBookingPerDay(supabase, shopId),
      isMultiSlotEnabled(supabase, shopId),
      isResourceChoiceRequired(supabase, shopId),
      isResourceCapacityVisible(supabase, shopId),
      isLiffPackagesAlwaysShown(supabase, shopId),
    ]);
    return NextResponse.json({
      data: {
        show_service_duration: showServiceDuration,
        one_booking_per_day: oneBookingPerDay,
        multi_slot_enabled: multiSlotEnabled,
        require_resource_choice: requireResourceChoice,
        show_resource_capacity: showResourceCapacity,
        liff_show_packages: liffShowPackages,
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
    if (body.show_resource_capacity !== undefined) patch.show_resource_capacity = body.show_resource_capacity;
    if (body.liff_show_packages !== undefined) patch.liff_show_packages = body.liff_show_packages;

    const { error } = await supabase.from('shops').update(patch).eq('id', profile.shop_id);
    if (error) {
      console.error('[shop_display_settings_update_failed]', error.message);
      return NextResponse.json({ error: 'บันทึกการตั้งค่าไม่สำเร็จ' }, { status: 400 });
    }
    // LIFF reads these flags from /meta; drop the cached copy so the change shows within the CDN window.
    await invalidateCache([`meta:${profile.shop_id}`, `packages-flag:${profile.shop_id}`]);

    return NextResponse.json({
      data: {
        show_service_duration: body.show_service_duration,
        one_booking_per_day: body.one_booking_per_day,
        multi_slot_enabled: body.multi_slot_enabled,
        require_resource_choice: body.require_resource_choice,
        show_resource_capacity: body.show_resource_capacity,
        liff_show_packages: body.liff_show_packages,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
