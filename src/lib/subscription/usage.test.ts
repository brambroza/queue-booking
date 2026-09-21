import { describe, expect, it, vi } from 'vitest';

// `usage.ts` builds a service-role client at call time; the date helper under test never touches it.
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }));

import { monthBounds } from './usage';

describe('monthBounds', () => {
  it('ends a 30-day month on the 30th, not an invalid 31st', () => {
    expect(monthBounds('2026-09-21')).toEqual({ from: '2026-09-01', to: '2026-09-30' });
  });

  it('ends February on the 28th in a common year', () => {
    expect(monthBounds('2026-02-10')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
  });

  it('ends February on the 29th in a leap year', () => {
    expect(monthBounds('2028-02-10')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });

  it('keeps the 31st for 31-day months and does not roll into the next year', () => {
    expect(monthBounds('2026-12-31')).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });

  it('works from the first day of the month', () => {
    expect(monthBounds('2026-04-01')).toEqual({ from: '2026-04-01', to: '2026-04-30' });
  });

  it('returns null for malformed input instead of throwing', () => {
    expect(monthBounds('')).toBeNull();
    expect(monthBounds('2026-9-1')).toBeNull();
    expect(monthBounds('not-a-date')).toBeNull();
  });

  it('returns null for a day that does not exist', () => {
    expect(monthBounds('2026-02-30')).toBeNull();
    expect(monthBounds('2026-13-01')).toBeNull();
  });
});
