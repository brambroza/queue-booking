/**
 * When to send the post-service "thank you" after a queue is completed.
 * Pure — the cron route passes the stamp and the shop delay.
 */

/** Shop delay presets offered in the portal (minutes after completion). */
export const FOLLOWUP_DELAY_PRESETS = [30, 60, 120, 240, 1440] as const;
export const FOLLOWUP_DELAY_DEFAULT = 120;
/** A thank-you later than this after the delay reads odd — skip it instead. */
export const FOLLOWUP_STALE_HOURS = 24;

export type FollowupTiming = 'wait' | 'due' | 'stale';

/**
 * Whether a completed booking's follow-up is due now.
 *
 * @param completedAt - `bookings.completed_at` (ISO), or null for bookings completed before the feature.
 * @param delayMinutes - `shops.followup_delay_minutes`.
 * @param now - Current instant.
 */
export function followupTiming(completedAt: string | null, delayMinutes: number, now: Date): FollowupTiming {
  if (!completedAt) return 'stale';
  const done = new Date(completedAt).getTime();
  if (!Number.isFinite(done)) return 'stale';
  const delayMs = Math.max(0, Number.isFinite(delayMinutes) ? delayMinutes : FOLLOWUP_DELAY_DEFAULT) * 60_000;
  const dueAt = done + delayMs;
  if (now.getTime() < dueAt) return 'wait';
  if (now.getTime() > dueAt + FOLLOWUP_STALE_HOURS * 3_600_000) return 'stale';
  return 'due';
}

/**
 * The `completed_at` range the cron should select for one shop: old enough to
 * be due, young enough not to be stale.
 *
 * @param delayMinutes - Shop delay.
 * @param now - Current instant.
 * @returns ISO bounds (inclusive).
 */
export function followupSelectionRange(delayMinutes: number, now: Date): { from: string; to: string } {
  const delayMs = Math.max(0, Number.isFinite(delayMinutes) ? delayMinutes : FOLLOWUP_DELAY_DEFAULT) * 60_000;
  const to = new Date(now.getTime() - delayMs);
  const from = new Date(to.getTime() - FOLLOWUP_STALE_HOURS * 3_600_000);
  return { from: from.toISOString(), to: to.toISOString() };
}

/**
 * Accepts only an https link for the review button (Google Maps / Facebook page).
 *
 * @param raw - Owner input.
 * @returns Trimmed URL, null when empty, or undefined when invalid.
 */
export function normalizeReviewUrl(raw: string | null | undefined): string | null | undefined {
  const value = (raw ?? '').trim();
  if (!value) return null;
  if (value.length > 500) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}
