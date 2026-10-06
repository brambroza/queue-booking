import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildSetupStatus, isLineConnected, loadSetupStatuses, SETUP_STEP_KEYS } from './status';

describe('buildSetupStatus', () => {
  it('keeps the dashboard order of the five steps', () => {
    const s = buildSetupStatus({ branches: 0, services: 0, workingHours: 0, lineConnected: false, bookings: 0 });
    expect(s.steps.map((x) => x.key)).toEqual([...SETUP_STEP_KEYS]);
    expect(s).toMatchObject({ completed: 0, total: 5 });
  });

  it('counts each finished step', () => {
    const s = buildSetupStatus({ branches: 2, services: 1, workingHours: 0, lineConnected: true, bookings: 0 });
    expect(s.completed).toBe(3);
    expect(s.steps.filter((x) => !x.done).map((x) => x.key)).toEqual(['working_hours', 'first_booking']);
  });

  it('is complete when everything exists', () => {
    expect(buildSetupStatus({ branches: 1, services: 1, workingHours: 7, lineConnected: true, bookings: 3 }).completed).toBe(5);
  });
});

describe('isLineConnected', () => {
  it('needs token, secret and LIFF id together', () => {
    expect(isLineConnected({ line_channel_access_token: 't', line_channel_secret: 's', liff_id: 'l' })).toBe(true);
    expect(isLineConnected({ line_channel_access_token: 't', line_channel_secret: 's', liff_id: '' })).toBe(false);
    expect(isLineConnected({ line_channel_access_token: null, line_channel_secret: 's', liff_id: 'l' })).toBe(false);
    expect(isLineConnected(null)).toBe(false);
  });
});

/** Stub: which shops have a row in which table; a table can also be made to fail. */
function stubAdmin(has: Record<string, string[]>, failing: string[] = []) {
  const from = (table: string) => {
    let shopId = '';
    const chain: Record<string, unknown> = {};
    chain.select = () => chain;
    chain.eq = (col: string, val: string) => {
      if (col === 'shop_id') shopId = val;
      return chain;
    };
    chain.limit = async () =>
      failing.includes(table)
        ? { data: null, error: { message: 'boom' } }
        : { data: (has[table] ?? []).includes(shopId) ? [{ id: 'x' }] : [], error: null };
    return chain;
  };
  return { from } as unknown as SupabaseClient;
}

describe('loadSetupStatuses', () => {
  it('evaluates each shop on its own rows', async () => {
    const admin = stubAdmin({ branches: ['a', 'b'], services: ['a'], working_hours: ['a'], bookings: ['a'] });
    const map = await loadSetupStatuses(admin, [
      { id: 'a', lineConnected: true },
      { id: 'b', lineConnected: false },
      { id: 'c', lineConnected: false },
    ]);
    expect(map.get('a')?.completed).toBe(5);
    expect(map.get('b')?.completed).toBe(1);
    expect(map.get('c')?.completed).toBe(0);
  });

  it('treats a failed lookup as "not done" for that step only and keeps going', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const admin = stubAdmin({ branches: ['a'], services: ['a'], working_hours: ['a'], bookings: ['a'] }, ['bookings']);
    const map = await loadSetupStatuses(admin, [{ id: 'a', lineConnected: true }]);
    expect(map.get('a')?.steps.find((s) => s.key === 'first_booking')?.done).toBe(false);
    expect(map.get('a')?.completed).toBe(4);
    expect(spy).toHaveBeenCalled();
  });

  it('handles an empty shop list and more shops than one batch', async () => {
    expect((await loadSetupStatuses(stubAdmin({}), [])).size).toBe(0);
    const many = Array.from({ length: 45 }, (_, i) => ({ id: `s${i}`, lineConnected: false }));
    const map = await loadSetupStatuses(stubAdmin({ branches: ['s44'] }), many);
    expect(map.size).toBe(45);
    expect(map.get('s44')?.completed).toBe(1);
  });
});
