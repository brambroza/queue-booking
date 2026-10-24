/**
 * Monthly cap on automated LINE pushes. Every push spends the shop's own LINE
 * OA message quota, so the system never sends more than the owner allowed and
 * Starter shops get a smaller ceiling.
 */

/** Same value as `FREE_PLAN_CODE`; repeated so this module stays free of server imports. */
const FREE_PLAN_CODE = 'starter';

/** Default for `shops.automation_monthly_cap`. */
export const AUTOMATION_CAP_DEFAULT = 300;
/** Ceiling for Starter shops whatever the owner sets. */
export const STARTER_AUTOMATION_CAP = 100;

/**
 * Effective cap for this month.
 *
 * @param planCode - Effective plan code (null = Starter).
 * @param shopCap - `shops.automation_monthly_cap`.
 */
export function effectiveAutomationCap(planCode: string | null | undefined, shopCap: number | null | undefined): number {
  const own = typeof shopCap === 'number' && Number.isFinite(shopCap) && shopCap >= 0 ? Math.floor(shopCap) : AUTOMATION_CAP_DEFAULT;
  const isStarter = !planCode || planCode === FREE_PLAN_CODE;
  return isStarter ? Math.min(own, STARTER_AUTOMATION_CAP) : own;
}

/**
 * Start of the current Bangkok calendar month as an ISO instant, for
 * `sent_at >= …` (Bangkok has no DST: UTC+7 all year).
 *
 * @param now - Current instant.
 */
export function bangkokMonthStartIso(now: Date): string {
  const local = new Date(now.getTime() + 7 * 3_600_000);
  const start = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - 7 * 3_600_000;
  return new Date(start).toISOString();
}

/**
 * Pushes still allowed this month.
 *
 * @param cap - Effective cap.
 * @param used - Sends with status `sent` since the month start.
 */
export function remainingAutomationQuota(cap: number, used: number): number {
  return Math.max(0, cap - Math.max(0, used));
}
