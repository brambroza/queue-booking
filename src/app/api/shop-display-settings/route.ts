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
  getLiffBookingHints,
  isPricingEnabled,
} from '@/lib/booking/display-settings';
import { invalidateCache } from '@/lib/cache/kv';
import { loadShopPricingUsage } from '@/lib/pricing/pricing-server';
import { getSubscriptionState } from '@/lib/subscription/enforcement';
import { planAllowsPricing, SubscriptionFeatureLockedError } from '@/lib/subscription/features';
import { subscriptionErrorResponse } from '@/lib/subscription/response';

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
    /** Helper text under the LIFF time grid (set on /portal/resources), display only. */
    liff_show_multi_pick_hint: z.boolean().optional(),
    liff_show_price_bands: z.boolean().optional(),
    liff_show_consecutive_discount: z.boolean().optional(),
    /** Time-range prices + consecutive discount on/off (set on /portal/resources); ON needs Professional+. */
    pricing_enabled: z.boolean().optional(),
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
    const [showServiceDuration, oneBookingPerDay, multiSlotEnabled, requireResourceChoice, showResourceCapacity, liffShowPackages, liffHints, pricingUsage, pricingEnabled, sub] = await Promise.all([
      isServiceDurationVisible(supabase, shopId),
      isOneBookingPerDay(supabase, shopId),
      isMultiSlotEnabled(supabase, shopId),
      isResourceChoiceRequired(supabase, shopId),
      isResourceCapacityVisible(supabase, shopId),
      isLiffPackagesAlwaysShown(supabase, shopId),
      getLiffBookingHints(supabase, shopId),
      loadShopPricingUsage(supabase, shopId),
      isPricingEnabled(supabase, shopId),
      getSubscriptionState(shopId),
    ]);
    return NextResponse.json({
      data: {
        show_service_duration: showServiceDuration,
        one_booking_per_day: oneBookingPerDay,
        multi_slot_enabled: multiSlotEnabled,
        require_resource_choice: requireResourceChoice,
        show_resource_capacity: showResourceCapacity,
        liff_show_packages: liffShowPackages,
        liff_show_multi_pick_hint: liffHints.multi_pick_hint,
        liff_show_price_bands: liffHints.price_bands,
        liff_show_consecutive_discount: liffHints.consecutive_discount,
        pricing_enabled: pricingEnabled,
        pricing_plan_allowed: sub.active && planAllowsPricing(sub.planCode),
        // Which LIFF texts exist at all: the portal shows a switch only for features in use.
        hint_features: {
          multi_pick_hint: multiSlotEnabled,
          price_bands: pricingUsage.rules,
          consecutive_discount: pricingUsage.discount,
        },
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
    // Turning prices on needs the plan; turning them off is always allowed.
    if (body.pricing_enabled === true) {
      const sub = await getSubscriptionState(profile.shop_id);
      if (!(sub.active && planAllowsPricing(sub.planCode))) {
        throw new SubscriptionFeatureLockedError('ราคาตามช่วงเวลา / ส่วนลดชั่วโมงต่อเนื่อง', sub.planCode, 'pricing');
      }
    }

    const patch: Record<string, boolean | string> = { updated_by: user.id };
    if (body.show_service_duration !== undefined) patch.show_service_duration = body.show_service_duration;
    if (body.one_booking_per_day !== undefined) patch.one_booking_per_day = body.one_booking_per_day;
    if (body.multi_slot_enabled !== undefined) patch.multi_slot_enabled = body.multi_slot_enabled;
    if (body.require_resource_choice !== undefined) patch.require_resource_choice = body.require_resource_choice;
    if (body.show_resource_capacity !== undefined) patch.show_resource_capacity = body.show_resource_capacity;
    if (body.liff_show_packages !== undefined) patch.liff_show_packages = body.liff_show_packages;
    if (body.liff_show_multi_pick_hint !== undefined) patch.liff_show_multi_pick_hint = body.liff_show_multi_pick_hint;
    if (body.liff_show_price_bands !== undefined) patch.liff_show_price_bands = body.liff_show_price_bands;
    if (body.liff_show_consecutive_discount !== undefined) patch.liff_show_consecutive_discount = body.liff_show_consecutive_discount;
    if (body.pricing_enabled !== undefined) patch.pricing_enabled = body.pricing_enabled;

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
        liff_show_multi_pick_hint: body.liff_show_multi_pick_hint,
        liff_show_price_bands: body.liff_show_price_bands,
        liff_show_consecutive_discount: body.liff_show_consecutive_discount,
        pricing_enabled: body.pricing_enabled,
      },
    });
  } catch (e) {
    const subscription = subscriptionErrorResponse(e);
    if (subscription) return subscription;
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
