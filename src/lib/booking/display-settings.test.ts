import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_LIFF_BOOKING_HINTS, getLiffBookingHints } from './display-settings';

/** Minimal stand-in for `client.from('shops').select().eq().maybeSingle()`. */
function fakeClient(result: { data: unknown; error: unknown }): SupabaseClient {
  const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => result };
  return { from: () => chain } as unknown as SupabaseClient;
}

describe('getLiffBookingHints', () => {
  it('shows every line before the migration (query error)', async () => {
    expect(await getLiffBookingHints(fakeClient({ data: null, error: { message: 'column does not exist' } }), 's1')).toEqual(DEFAULT_LIFF_BOOKING_HINTS);
  });

  it('shows every line when the shop row is missing', async () => {
    expect(await getLiffBookingHints(fakeClient({ data: null, error: null }), 's1')).toEqual(DEFAULT_LIFF_BOOKING_HINTS);
  });

  it('hides only the lines the shop turned off', async () => {
    const hints = await getLiffBookingHints(
      fakeClient({ data: { liff_show_multi_pick_hint: false, liff_show_price_bands: true, liff_show_consecutive_discount: null }, error: null }),
      's1',
    );
    expect(hints).toEqual({ multi_pick_hint: false, price_bands: true, consecutive_discount: true });
  });
});

describe('isPricingEnabled', () => {
  it('keeps the feature working before the migration (query error)', async () => {
    const { isPricingEnabled } = await import('./display-settings');
    expect(await isPricingEnabled(fakeClient({ data: null, error: { message: 'column does not exist' } }), 's1')).toBe(true);
  });

  it('is off when the shop has it off (new shops default)', async () => {
    const { isPricingEnabled } = await import('./display-settings');
    expect(await isPricingEnabled(fakeClient({ data: { pricing_enabled: false }, error: null }), 's1')).toBe(false);
  });

  it('is on when the shop turned it on', async () => {
    const { isPricingEnabled } = await import('./display-settings');
    expect(await isPricingEnabled(fakeClient({ data: { pricing_enabled: true }, error: null }), 's1')).toBe(true);
  });
});
