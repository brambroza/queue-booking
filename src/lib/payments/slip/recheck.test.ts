import { describe, expect, it } from 'vitest';
import type { SlipCheck, SlipEvaluation } from './evaluate';
import { MAX_RECHECK_ATTEMPTS, RECHECK_BACKOFF_MINUTES, nextRecheckAt, shouldRecheck } from './recheck';

function evaluation(overrides: Partial<SlipEvaluation> = {}, checks: SlipCheck[] = []): Pick<SlipEvaluation, 'status' | 'autoApprove' | 'retryReason' | 'checks'> {
  return { status: 'plausible', autoApprove: false, retryReason: null, checks, ...overrides };
}

const bankNotFound: SlipCheck = { key: 'bank_found', status: 'fail', detail: 'x' };

describe('shouldRecheck', () => {
  it('retries a pending or unavailable answer while attempts remain', () => {
    expect(shouldRecheck({ evaluation: evaluation({ retryReason: 'pending' }), attempt: 0, hadProvider: true })).toBe(true);
    expect(shouldRecheck({ evaluation: evaluation({ retryReason: 'unavailable' }), attempt: 3, hadProvider: true })).toBe(true);
    expect(shouldRecheck({ evaluation: evaluation({ retryReason: 'unavailable' }), attempt: MAX_RECHECK_ATTEMPTS, hadProvider: true })).toBe(false);
  });

  it('gives a bank "not found" exactly one more look', () => {
    const ev = evaluation({ status: 'suspicious' }, [bankNotFound]);
    expect(shouldRecheck({ evaluation: ev, attempt: 0, hadProvider: true })).toBe(true);
    expect(shouldRecheck({ evaluation: ev, attempt: 1, hadProvider: true })).toBe(false);
  });

  it('never retries without a provider, a verified slip, or an unreadable one', () => {
    expect(shouldRecheck({ evaluation: evaluation({ retryReason: 'pending' }), attempt: 0, hadProvider: false })).toBe(false);
    expect(shouldRecheck({ evaluation: evaluation({ status: 'verified', autoApprove: true }), attempt: 0, hadProvider: true })).toBe(false);
    expect(shouldRecheck({ evaluation: evaluation({ status: 'unreadable' }), attempt: 0, hadProvider: true })).toBe(false);
  });

  it('does not retry a suspicious slip for any other reason', () => {
    const ev = evaluation({ status: 'suspicious' }, [{ key: 'bank_amount', status: 'fail', detail: 'x' }]);
    expect(shouldRecheck({ evaluation: ev, attempt: 0, hadProvider: true })).toBe(false);
  });

  it('does not retry an invalid key (retryReason null, no bank_found failure)', () => {
    const ev = evaluation({}, [{ key: 'bank_found', status: 'warn', detail: 'x' }]);
    expect(shouldRecheck({ evaluation: ev, attempt: 0, hadProvider: true })).toBe(false);
  });
});

describe('nextRecheckAt', () => {
  it('follows the backoff table and stops after the last step', () => {
    const now = new Date('2026-10-09T10:00:00.000Z');
    RECHECK_BACKOFF_MINUTES.forEach((minutes, i) => {
      expect(nextRecheckAt(now, i)?.toISOString()).toBe(new Date(now.getTime() + minutes * 60_000).toISOString());
    });
    expect(nextRecheckAt(now, RECHECK_BACKOFF_MINUTES.length)).toBeNull();
  });
});
