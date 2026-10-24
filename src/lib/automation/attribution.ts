/**
 * "Did the automation bring this booking?" and the ROI numbers built on it.
 *
 * Rule: a customer booking within ATTRIBUTION_WINDOW_DAYS after an automated
 * push counts as converted by the most recent such push. It is an estimate
 * (some would have come anyway) and the portal labels it "≈".
 */

export const ATTRIBUTION_WINDOW_DAYS = 14;

export type AutomationKind = 'followup' | 'winback';

export type SendForAttribution = {
  id: string;
  kind: AutomationKind;
  sent_at: string;
  status: 'sent' | 'failed';
  converted_booking_id: string | null;
};

/**
 * Pick the push a new booking should be credited to.
 *
 * @param sends - This customer's recent sends.
 * @param bookedAt - When the booking was created.
 * @returns The send id, or null when nothing qualifies.
 */
export function pickAttributableSend(sends: readonly SendForAttribution[], bookedAt: Date): string | null {
  const windowMs = ATTRIBUTION_WINDOW_DAYS * 86_400_000;
  let best: SendForAttribution | null = null;
  for (const s of sends) {
    if (s.status !== 'sent' || s.converted_booking_id) continue;
    const at = new Date(s.sent_at).getTime();
    if (!Number.isFinite(at)) continue;
    const age = bookedAt.getTime() - at;
    if (age < 0 || age > windowMs) continue;
    if (!best || at > new Date(best.sent_at).getTime()) best = s;
  }
  return best?.id ?? null;
}

export type RoiRow = {
  kind: AutomationKind;
  status: 'sent' | 'failed';
  converted_booking_id: string | null;
  revenue_estimate: number | string | null;
};

export type RoiByKind = { sent: number; converted: number; revenue: number };
export type AutomationRoi = Record<AutomationKind, RoiByKind> & { total: RoiByKind };

/**
 * Totals for the dashboard card.
 *
 * @param rows - Sends in the period.
 */
export function summarizeAutomationRoi(rows: readonly RoiRow[]): AutomationRoi {
  const empty = (): RoiByKind => ({ sent: 0, converted: 0, revenue: 0 });
  const out: AutomationRoi = { followup: empty(), winback: empty(), total: empty() };
  for (const r of rows) {
    if (r.status !== 'sent') continue;
    const bucket = out[r.kind];
    if (!bucket) continue;
    bucket.sent += 1;
    out.total.sent += 1;
    if (r.converted_booking_id) {
      const revenue = Number(r.revenue_estimate) || 0;
      bucket.converted += 1;
      bucket.revenue += revenue;
      out.total.converted += 1;
      out.total.revenue += revenue;
    }
  }
  return out;
}
