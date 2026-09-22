/**
 * Shop-level display flags for the customer-facing LIFF booking page.
 *
 * These read a single `shops` column each, deliberately outside the main
 * `select(...)` of whatever route needs them: the booking flow must keep
 * working on a database where the migration has not run yet, so a failing
 * read resolves to the column default instead of bubbling up.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Whether the LIFF booking page may show a service's duration in minutes.
 *
 * `shops.show_service_duration` ships in migration 202608240003. Until that has
 * run the query errors, and this path is on the customer booking flow — so a
 * failure resolves to the column default (visible) instead of hiding data the
 * shop never asked to hide.
 *
 * @param client - Supabase client already allowed to read this shop.
 * @param shopId - Shop to read the flag for.
 * @returns true unless the shop explicitly turned the duration off.
 */
export async function isServiceDurationVisible(client: SupabaseClient, shopId: string): Promise<boolean> {
  const { data, error } = await client
    .from('shops')
    .select('show_service_duration')
    .eq('id', shopId)
    .maybeSingle();
  if (error) return true;
  return (data as { show_service_duration?: boolean } | null)?.show_service_duration !== false;
}

/**
 * Whether this shop limits each customer to one LIFF booking per day.
 *
 * `shops.one_booking_per_day` ships in migration 202609220002. Until that has
 * run the query errors, and this path is on the customer booking flow — so a
 * failure resolves to the column default (off) rather than blocking bookings
 * the shop never asked to block.
 *
 * @param client - Supabase client already allowed to read this shop.
 * @param shopId - Shop to read the flag for.
 * @returns true only when the shop explicitly turned the limit on.
 */
export async function isOneBookingPerDay(client: SupabaseClient, shopId: string): Promise<boolean> {
  const { data, error } = await client
    .from('shops')
    .select('one_booking_per_day')
    .eq('id', shopId)
    .maybeSingle();
  if (error) return false;
  return (data as { one_booking_per_day?: boolean } | null)?.one_booking_per_day === true;
}
