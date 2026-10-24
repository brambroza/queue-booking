/**
 * Win-back rules: when is a regular customer "overdue", and should we message
 * them today. Pure — the cron route and the portal preview load the data and
 * pass it in, so both count the same customers.
 *
 * All dates are Bangkok calendar dates (`YYYY-MM-DD`, same as `booking_date`).
 */

/** No second win-back to the same customer within this many days. */
export const WINBACK_COOLDOWN_DAYS = 30;
/** Customers gone longer than this are treated as lost, not overdue — we stop nudging. */
export const WINBACK_MAX_LAPSE_DAYS = 180;
/** Bounds for a learned visit interval, so one odd pair of visits cannot produce 1 or 900 days. */
export const WINBACK_MIN_INTERVAL_DAYS = 7;
export const WINBACK_MAX_INTERVAL_DAYS = 120;
/** Default for `shops.winback_default_days` (customers with a single visit). */
export const WINBACK_DEFAULT_DAYS = 30;

const DAY_MS = 86_400_000;

/**
 * Whole days from `from` to `to` (negative when `to` is earlier).
 *
 * @param from - `YYYY-MM-DD`.
 * @param to - `YYYY-MM-DD`.
 */
export function daysBetween(from: string, to: string): number {
  const a = Date.UTC(Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 1, Number(from.slice(8, 10)));
  const b = Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)) - 1, Number(to.slice(8, 10)));
  return Math.round((b - a) / DAY_MS);
}

/**
 * `YYYY-MM-DD` plus `days`.
 *
 * @param iso - Start date.
 * @param days - Days to add (may be negative).
 */
export function addDays(iso: string, days: number): string {
  const d = new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) + days * DAY_MS);
  return d.toISOString().slice(0, 10);
}

/**
 * Median gap in days between a customer's distinct visit dates.
 *
 * @param visitDates - Completed visit dates, any order, duplicates allowed (two queues one day = one visit).
 * @returns The median gap, or null with fewer than two distinct dates.
 */
export function medianIntervalDays(visitDates: readonly string[]): number | null {
  const unique = [...new Set(visitDates)].sort();
  if (unique.length < 2) return null;
  const gaps: number[] = [];
  for (let i = 1; i < unique.length; i += 1) gaps.push(daysBetween(unique[i - 1], unique[i]));
  gaps.sort((a, b) => a - b);
  const mid = Math.floor(gaps.length / 2);
  return gaps.length % 2 === 1 ? gaps[mid] : Math.round((gaps[mid - 1] + gaps[mid]) / 2);
}

/**
 * Expected gap between visits: the customer's own rhythm when known, else the
 * shop default, clamped so outliers stay sensible.
 *
 * @param visitDates - Completed visit dates.
 * @param shopDefaultDays - `shops.winback_default_days`.
 */
export function expectedIntervalDays(visitDates: readonly string[], shopDefaultDays: number): number {
  const learned = medianIntervalDays(visitDates);
  const raw = learned ?? (Number.isFinite(shopDefaultDays) && shopDefaultDays > 0 ? shopDefaultDays : WINBACK_DEFAULT_DAYS);
  return Math.min(WINBACK_MAX_INTERVAL_DAYS, Math.max(WINBACK_MIN_INTERVAL_DAYS, raw));
}

/**
 * Slack after the expected date before we call someone overdue — a weekly
 * customer is late after a few days, a monthly one after a week.
 *
 * @param intervalDays - Expected interval.
 */
export function graceDays(intervalDays: number): number {
  return Math.max(3, Math.round(intervalDays * 0.25));
}

export type WinbackCandidate = {
  /** Completed visit dates (`booking_date`). */
  visitDates: readonly string[];
  /** Customer has a queue today or later that is not cancelled / no-show. */
  hasUpcoming: boolean;
  /** Customer can receive a LINE push (has a LINE user). */
  reachable: boolean;
  /** Last win-back sent to this customer (ISO timestamp), or null. */
  lastWinbackAt: string | null;
};

export type WinbackSkipReason = 'no_visits' | 'has_upcoming' | 'not_due' | 'lapsed' | 'cooldown' | 'unreachable';

export type WinbackDecision =
  | { send: true; lastVisit: string; intervalDays: number; daysSince: number; dueDate: string }
  | { send: false; reason: WinbackSkipReason; lastVisit?: string; dueDate?: string };

/**
 * Should this customer get a win-back message today?
 *
 * Order matters for the preview: "lapsed" and "not_due" are decided before
 * reachability so the portal can say how many overdue customers exist even
 * when some cannot be messaged.
 *
 * @param today - Bangkok date.
 * @param candidate - Customer history.
 * @param shopDefaultDays - Interval for customers with one visit.
 */
export function decideWinback(today: string, candidate: WinbackCandidate, shopDefaultDays: number): WinbackDecision {
  const unique = [...new Set(candidate.visitDates)].sort();
  if (unique.length === 0) return { send: false, reason: 'no_visits' };
  if (candidate.hasUpcoming) return { send: false, reason: 'has_upcoming' };

  const lastVisit = unique[unique.length - 1];
  const intervalDays = expectedIntervalDays(unique, shopDefaultDays);
  const dueDate = addDays(lastVisit, intervalDays + graceDays(intervalDays));
  const daysSince = daysBetween(lastVisit, today);

  if (daysSince > WINBACK_MAX_LAPSE_DAYS) return { send: false, reason: 'lapsed', lastVisit, dueDate };
  if (today < dueDate) return { send: false, reason: 'not_due', lastVisit, dueDate };
  if (candidate.lastWinbackAt) {
    const since = daysBetween(candidate.lastWinbackAt.slice(0, 10), today);
    if (since < WINBACK_COOLDOWN_DAYS) return { send: false, reason: 'cooldown', lastVisit, dueDate };
  }
  if (!candidate.reachable) return { send: false, reason: 'unreachable', lastVisit, dueDate };
  return { send: true, lastVisit, intervalDays, daysSince, dueDate };
}

export type WinbackPreview = {
  /** Overdue customers (not lapsed, no upcoming queue), reachable or not. */
  overdue: number;
  /** Of those, how many a win-back could reach on LINE right now. */
  reachable: number;
  /** Sum of each reachable customer's average spend per visit, baht. */
  estimatedBaht: number;
};

/**
 * Numbers for the "ลูกค้าหาย N คน ≈ ฿X" card — shown to every plan, so a
 * Starter shop sees what it is missing before it can send anything.
 *
 * @param today - Bangkok date.
 * @param candidates - Each customer with their average spend per visit.
 * @param shopDefaultDays - Interval for one-visit customers.
 */
export function summarizeWinbackPreview(
  today: string,
  candidates: ReadonlyArray<WinbackCandidate & { avgSpend: number }>,
  shopDefaultDays: number,
): WinbackPreview {
  let overdue = 0;
  let reachable = 0;
  let estimatedBaht = 0;
  for (const c of candidates) {
    // Cooldown does not matter for "how many are missing", only for sending.
    const d = decideWinback(today, { ...c, lastWinbackAt: null }, shopDefaultDays);
    if (d.send) {
      overdue += 1;
      reachable += 1;
      estimatedBaht += Number.isFinite(c.avgSpend) ? c.avgSpend : 0;
    } else if (d.reason === 'unreachable') {
      overdue += 1;
    }
  }
  return { overdue, reachable, estimatedBaht: Math.round(estimatedBaht) };
}
