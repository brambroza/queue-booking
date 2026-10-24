import type { SupabaseClient } from '@supabase/supabase-js';
import { addDays, WINBACK_COOLDOWN_DAYS, type WinbackCandidate } from '@/lib/automation/visit-interval';

/** Visit history looked at for a customer's rhythm. */
const HISTORY_DAYS = 365;
/** PostgREST returns at most 1,000 rows per request. */
const PAGE_SIZE = 1000;
/** Safety stop for a very large shop (20k completed queues a year). */
const MAX_PAGES = 20;

/** Statuses that mean the customer is still coming. */
const NOT_UPCOMING_STATUSES = ['cancelled', 'no_show', 'completed'] as const;

export type CustomerVisitStats = WinbackCandidate & {
  customerId: string;
  /** `line_users.id` from the most recent visit that had one. */
  lineUserPk: string | null;
  lastService: string | null;
  /** Average `services.price` over the visits, baht. */
  avgSpend: number;
};

type CompletedRow = {
  customer_id: string | null;
  booking_date: string;
  line_user_id: string | null;
  services: { service_name?: string | null; price?: number | string | null } | { service_name?: string | null; price?: number | string | null }[] | null;
};

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? v[0] ?? null : v;
}

/**
 * Pages through a query builder factory until a short page comes back.
 *
 * @param fetchPage - Builds and runs the query for `[from, to]`.
 * @throws When any page fails, so callers never act on half the data.
 */
async function fetchAll<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE_SIZE;
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as T[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows;
}

/**
 * Per-customer visit history for win-back decisions and the portal preview.
 * Tenant-scoped on every query; demo and deleted rows are ignored.
 *
 * @param client - Service-role client (cron) or a session client that can read the shop.
 * @param shopId - Shop.
 * @param today - Bangkok date.
 * @throws When a query fails (the caller must not send on partial data).
 */
export async function loadCustomerVisitStats(client: SupabaseClient, shopId: string, today: string): Promise<CustomerVisitStats[]> {
  const historyFrom = addDays(today, -HISTORY_DAYS);
  const cooldownFrom = `${addDays(today, -WINBACK_COOLDOWN_DAYS)}T00:00:00+07:00`;

  const [completed, upcoming, sends] = await Promise.all([
    fetchAll<CompletedRow>((from, to) =>
      client
        .from('bookings')
        .select('customer_id,booking_date,line_user_id,services(service_name,price)')
        .eq('shop_id', shopId)
        .eq('status', 'completed')
        .eq('is_deleted', false)
        .eq('is_demo', false)
        .not('customer_id', 'is', null)
        .gte('booking_date', historyFrom)
        .lte('booking_date', today)
        .order('booking_date', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to),
    ),
    fetchAll<{ customer_id: string | null }>((from, to) =>
      client
        .from('bookings')
        .select('customer_id')
        .eq('shop_id', shopId)
        .eq('is_deleted', false)
        .not('customer_id', 'is', null)
        .not('status', 'in', `(${NOT_UPCOMING_STATUSES.join(',')})`)
        .gte('booking_date', today)
        .order('id', { ascending: true })
        .range(from, to),
    ),
    fetchAll<{ customer_id: string | null; sent_at: string }>((from, to) =>
      client
        .from('automation_sends')
        .select('customer_id,sent_at')
        .eq('shop_id', shopId)
        .eq('kind', 'winback')
        // Failed attempts count too: a blocked customer is not retried daily.
        .gte('sent_at', cooldownFrom)
        .order('id', { ascending: true })
        .range(from, to),
    ),
  ]);

  const upcomingIds = new Set(upcoming.map((r) => r.customer_id).filter((id): id is string => Boolean(id)));
  const lastSent = new Map<string, string>();
  for (const s of sends) {
    if (!s.customer_id) continue;
    const prev = lastSent.get(s.customer_id);
    if (!prev || s.sent_at > prev) lastSent.set(s.customer_id, s.sent_at);
  }

  const byCustomer = new Map<string, { dates: string[]; lineUserPk: string | null; lastService: string | null; spend: number; visits: number }>();
  // Rows are sorted by date, so the last write wins = most recent visit.
  for (const row of completed) {
    if (!row.customer_id) continue;
    const entry = byCustomer.get(row.customer_id) ?? { dates: [], lineUserPk: null, lastService: null, spend: 0, visits: 0 };
    const service = one(row.services);
    entry.dates.push(row.booking_date);
    if (row.line_user_id) entry.lineUserPk = row.line_user_id;
    entry.lastService = service?.service_name ?? entry.lastService;
    entry.spend += Number(service?.price) || 0;
    entry.visits += 1;
    byCustomer.set(row.customer_id, entry);
  }

  return [...byCustomer.entries()].map(([customerId, e]) => ({
    customerId,
    visitDates: e.dates,
    hasUpcoming: upcomingIds.has(customerId),
    reachable: Boolean(e.lineUserPk),
    lastWinbackAt: lastSent.get(customerId) ?? null,
    lineUserPk: e.lineUserPk,
    lastService: e.lastService,
    avgSpend: e.visits > 0 ? e.spend / e.visits : 0,
  }));
}
