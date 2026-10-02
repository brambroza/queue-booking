import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isFallbackReplyEnabled } from './fallback-reply';

/** Minimal client whose shops lookup resolves to `result`. */
function clientReturning(result: { data: unknown; error: unknown }) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => result,
  };
  return { from: () => chain } as unknown as SupabaseClient;
}

describe('isFallbackReplyEnabled', () => {
  it('is off only when the shop set it to false', async () => {
    expect(await isFallbackReplyEnabled(clientReturning({ data: { fallback_reply_enabled: false }, error: null }), 's1')).toBe(false);
  });

  it('is on when the shop set it to true', async () => {
    expect(await isFallbackReplyEnabled(clientReturning({ data: { fallback_reply_enabled: true }, error: null }), 's1')).toBe(true);
  });

  it('defaults to on when the column is null or the shop is missing', async () => {
    expect(await isFallbackReplyEnabled(clientReturning({ data: { fallback_reply_enabled: null }, error: null }), 's1')).toBe(true);
    expect(await isFallbackReplyEnabled(clientReturning({ data: null, error: null }), 's1')).toBe(true);
  });

  it('defaults to on when the column does not exist yet', async () => {
    const missingColumn = { message: 'column shops.fallback_reply_enabled does not exist', code: '42703' };
    expect(await isFallbackReplyEnabled(clientReturning({ data: null, error: missingColumn }), 's1')).toBe(true);
  });
});
