import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_SLIP_AUTO_MODE, SLIP_AUTO_MODES, getSlipAutoMode, parseSlipAutoMode } from './auto-mode';

function clientReturning(result: { data: unknown; error: unknown }) {
  const query = { select: () => query, eq: () => query, maybeSingle: async () => result };
  return { from: () => query } as unknown as SupabaseClient;
}

describe('parseSlipAutoMode', () => {
  it('keeps every known mode', () => {
    for (const mode of SLIP_AUTO_MODES) expect(parseSlipAutoMode(mode)).toBe(mode);
  });

  it('falls back to the default, never to auto_approve', () => {
    for (const value of ['', 'AUTO_APPROVE', 'yes', null, undefined, true]) {
      expect(parseSlipAutoMode(value)).toBe(DEFAULT_SLIP_AUTO_MODE);
    }
    expect(DEFAULT_SLIP_AUTO_MODE).not.toBe('auto_approve');
  });
});

describe('getSlipAutoMode', () => {
  it('reads the stored mode', async () => {
    const client = clientReturning({ data: { slip_auto_mode: 'auto_approve' }, error: null });
    await expect(getSlipAutoMode(client, 'shop')).resolves.toBe('auto_approve');
  });

  it('resolves to the default when the column does not exist yet', async () => {
    const client = clientReturning({ data: null, error: { message: 'column does not exist' } });
    await expect(getSlipAutoMode(client, 'shop')).resolves.toBe(DEFAULT_SLIP_AUTO_MODE);
  });
});
