/**
 * When to look at a slip again. Pure — the cron route and the upload path both
 * call this after `evaluateSlip`.
 *
 * Retries exist for answers that time can change: the vendor was down, the
 * quota ran out, or the bank had not posted the transfer yet. A slip the bank
 * actively rejected, or one with no QR, is not retried.
 */
import type { SlipEvaluation } from './evaluate';

/** Minutes to wait before attempt n+1 (index = attempts already made − 1). About two hours in all. */
export const RECHECK_BACKOFF_MINUTES = [5, 10, 15, 30, 60] as const;
export const MAX_RECHECK_ATTEMPTS = RECHECK_BACKOFF_MINUTES.length;

export interface RecheckInput {
  evaluation: Pick<SlipEvaluation, 'status' | 'autoApprove' | 'retryReason' | 'checks'>;
  /** Attempts already made. 0 = only the upload-time check has run. */
  attempt: number;
  /** A provider was configured for the shop when this attempt ran. */
  hadProvider: boolean;
}

/**
 * Whether the slip deserves another automatic look.
 *
 * The one deliberate exception to "no retry on a bank rejection": a slip the
 * bank does not know *on the very first attempt* gets one more look, because a
 * transfer made seconds before the upload can still be in flight.
 */
export function shouldRecheck(input: RecheckInput): boolean {
  if (!input.hadProvider) return false;
  if (input.attempt >= MAX_RECHECK_ATTEMPTS) return false;
  const { evaluation } = input;
  if (evaluation.status === 'verified' || evaluation.status === 'unreadable') return false;
  if (evaluation.retryReason) return true;
  const bankNotFound = evaluation.checks.some((c) => c.key === 'bank_found' && c.status === 'fail');
  return bankNotFound && input.attempt === 0;
}

/** Time of the next attempt, or null once the schedule is exhausted. */
export function nextRecheckAt(now: Date, attempt: number): Date | null {
  const minutes = RECHECK_BACKOFF_MINUTES[attempt];
  if (minutes === undefined) return null;
  return new Date(now.getTime() + minutes * 60_000);
}
