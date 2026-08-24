import { createAdminClient } from '@/lib/supabase/admin';

/** How much of a plan a single shop is currently consuming. */
export type ShopUsage = {
  branches: number;
  services: number;
  staff: number;
  resources: number;
  bookings: number;
};

/**
 * Counts what the shop is currently consuming, so the UI can show
 * "3 / 3 บริการ" instead of only telling the owner after they hit the wall.
 *
 * Shared by the shop-facing plan card and the super-admin package editor, so
 * both surfaces report the same numbers.
 *
 * @param shopId - Tenant scope for every count.
 */
export async function countShopUsage(shopId: string): Promise<ShopUsage> {
  const admin = createAdminClient();
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const countTable = async (table: string) => {
    const { count } = await admin
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', shopId)
      .eq('is_deleted', false);
    return count ?? 0;
  };

  const { count: bookingCount } = await admin
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('shop_id', shopId)
    .eq('is_deleted', false)
    .gte('booking_date', `${month}-01`)
    .lte('booking_date', `${month}-31`);

  const [branches, services, staff, resources] = await Promise.all([
    countTable('branches'),
    countTable('services'),
    countTable('staff'),
    countTable('resources'),
  ]);

  return { branches, services, staff, resources, bookings: bookingCount ?? 0 };
}
