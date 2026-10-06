import type { SupabaseClient } from '@supabase/supabase-js';

/** The five activation steps, in the order the dashboard checklist shows them. */
export const SETUP_STEP_KEYS = ['branch', 'service', 'working_hours', 'line', 'first_booking'] as const;
export type SetupStepKey = (typeof SETUP_STEP_KEYS)[number];

/** Short Thai names for compact displays (admin table). The dashboard has its own longer copy. */
export const SETUP_STEP_LABEL_TH: Record<SetupStepKey, string> = {
  branch: 'สาขา',
  service: 'บริการ',
  working_hours: 'เวลาทำการ',
  line: 'LINE',
  first_booking: 'คิวแรก',
};

export type SetupStep = { key: SetupStepKey; done: boolean };

export type SetupStatus = {
  steps: SetupStep[];
  completed: number;
  total: number;
};

/**
 * The single definition of "is this shop set up", shared by the dashboard
 * checklist (`/api/onboarding-status`) and the super-admin shop list so the two
 * can never disagree about what counts as done.
 *
 * @param input - How many rows of each kind the shop has, and whether all three
 *   LINE credentials (channel token, channel secret, LIFF id) are present.
 */
export function buildSetupStatus(input: {
  branches: number;
  services: number;
  workingHours: number;
  lineConnected: boolean;
  bookings: number;
}): SetupStatus {
  const steps: SetupStep[] = [
    { key: 'branch', done: input.branches > 0 },
    { key: 'service', done: input.services > 0 },
    { key: 'working_hours', done: input.workingHours > 0 },
    { key: 'line', done: input.lineConnected },
    { key: 'first_booking', done: input.bookings > 0 },
  ];
  return { steps, completed: steps.filter((s) => s.done).length, total: steps.length };
}

/** True when all three LINE credentials the booking flow needs are filled in. */
export function isLineConnected(shop: {
  line_channel_access_token?: string | null;
  line_channel_secret?: string | null;
  liff_id?: string | null;
} | null | undefined): boolean {
  return Boolean(shop?.line_channel_access_token && shop?.line_channel_secret && shop?.liff_id);
}

/** Tables whose rows count toward a step, one per shop-scoped existence check. */
const COUNTED_TABLES = ['branches', 'services', 'working_hours', 'bookings'] as const;
type CountedTable = (typeof COUNTED_TABLES)[number];

/** Parallel queries in flight at once, so a long shop list cannot flood the database. */
const CONCURRENCY = 20;

/**
 * Setup status for many shops at once, for the super-admin list.
 *
 * Existence (`limit 1`) rather than a count per shop: the list only needs to
 * know "at least one", and a count over every booking of every shop is the
 * expensive part. Per-shop queries rather than one `in (…)` scan because
 * PostgREST caps a response at 1,000 rows, which would silently mark shops as
 * not set up once the tables grow.
 *
 * Any failed lookup resolves to "not found" for that shop and is logged, so one
 * bad query never takes the plan list down.
 *
 * @param admin - Service-role client (reads across tenants by design; super_admin route only).
 * @param shops - Shops to evaluate with their LINE credential flag.
 * @returns Map of shop id to status.
 */
export async function loadSetupStatuses(
  admin: SupabaseClient,
  shops: Array<{ id: string; lineConnected: boolean }>,
): Promise<Map<string, SetupStatus>> {
  const result = new Map<string, SetupStatus>();

  const hasRow = async (table: CountedTable, shopId: string): Promise<boolean> => {
    const { data, error } = await admin.from(table).select('id').eq('shop_id', shopId).eq('is_deleted', false).limit(1);
    if (error) {
      console.error(`[onboarding/status] ${table} lookup failed`, error.message);
      return false;
    }
    return (data?.length ?? 0) > 0;
  };

  for (let i = 0; i < shops.length; i += CONCURRENCY) {
    const chunk = shops.slice(i, i + CONCURRENCY);
    const rows = await Promise.all(
      chunk.map(async (shop) => {
        const [branches, services, workingHours, bookings] = await Promise.all(COUNTED_TABLES.map((t) => hasRow(t, shop.id)));
        return buildSetupStatus({
          branches: Number(branches),
          services: Number(services),
          workingHours: Number(workingHours),
          lineConnected: shop.lineConnected,
          bookings: Number(bookings),
        });
      }),
    );
    chunk.forEach((shop, idx) => result.set(shop.id, rows[idx]));
  }
  return result;
}
