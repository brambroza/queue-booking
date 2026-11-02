import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { hashOwnerLinkCode } from './owner-line';
import { linkPlatformLineFromCode, safePushOwnerLine } from './owner-line-server';

type Row = Record<string, unknown>;

/** Minimal `shops` stub: select/eq/maybeSingle over one row, update records the patch. */
function stubAdmin(row: Row | null, opts: { missingPlatform?: boolean } = {}) {
  const updates: Row[] = [];
  const admin = {
    from: () => {
      let cols = '';
      let patch: Row | null = null;
      const filters: Array<[string, unknown]> = [];
      const q = {
        select: (c: string) => {
          cols = c;
          return q;
        },
        update: (p: Row) => {
          patch = p;
          return q;
        },
        eq: (k: string, v: unknown) => {
          filters.push([k, v]);
          return q;
        },
        maybeSingle: async () => {
          if (opts.missingPlatform && cols.includes('platform_')) return { data: null, error: { message: 'column does not exist' } };
          const match = row && filters.every(([k, v]) => k === 'id' || k === 'is_deleted' || row[k] === v);
          // Like PostgREST: only the selected columns come back.
          const picked = match ? Object.fromEntries(cols.split(',').filter((c) => c in row).map((c) => [c, row[c]])) : null;
          return { data: picked, error: null };
        },
        then: (resolve: (v: { error: null }) => void) => {
          if (patch) updates.push(patch);
          resolve({ error: null });
        },
      };
      return q;
    },
  };
  return { admin: admin as unknown as SupabaseClient, updates };
}

describe('safePushOwnerLine', () => {
  const both = { platform_line_user_id: 'Uplat', owner_line_user_id: 'Ushop', line_channel_access_token: 'shop-token' };

  it('prefers the platform OA', async () => {
    const push = vi.fn().mockResolvedValue(undefined);
    const { admin } = stubAdmin(both);
    const r = await safePushOwnerLine(admin, 's1', 'hi', { push, platformToken: 'plat-token' });
    expect(r).toEqual({ sent: true, channel: 'platform' });
    expect(push).toHaveBeenCalledWith('plat-token', 'Uplat', [{ type: 'text', text: 'hi' }]);
  });

  it('falls back to the shop OA when the platform push fails', async () => {
    const push = vi.fn().mockRejectedValueOnce(new Error('blocked')).mockResolvedValue(undefined);
    const { admin } = stubAdmin(both);
    const r = await safePushOwnerLine(admin, 's1', 'hi', { push, platformToken: 'plat-token' });
    expect(r).toEqual({ sent: true, channel: 'shop' });
    expect(push).toHaveBeenLastCalledWith('shop-token', 'Ushop', expect.any(Array));
  });

  it('uses the shop OA when the platform columns are not migrated', async () => {
    const push = vi.fn().mockResolvedValue(undefined);
    const { admin } = stubAdmin(both, { missingPlatform: true });
    expect(await safePushOwnerLine(admin, 's1', 'hi', { push, platformToken: 'plat-token' })).toEqual({ sent: true, channel: 'shop' });
  });

  it('respects only', async () => {
    const push = vi.fn().mockRejectedValue(new Error('blocked'));
    const { admin } = stubAdmin(both);
    const r = await safePushOwnerLine(admin, 's1', 'hi', { push, platformToken: 'plat-token', only: 'platform' });
    expect(r).toEqual({ sent: false, channel: 'platform', reason: 'push_failed' });
    expect(push).toHaveBeenCalledTimes(1);
  });

  it('reports not_linked', async () => {
    const { admin } = stubAdmin({});
    expect(await safePushOwnerLine(admin, 's1', 'hi', { push: vi.fn(), platformToken: 't' })).toEqual({ sent: false, reason: 'not_linked' });
  });
});

describe('linkPlatformLineFromCode', () => {
  const now = new Date('2026-11-02T10:00:00Z');

  it('links the shop holding the code', async () => {
    const { admin, updates } = stubAdmin({
      id: 's1',
      name: 'ร้าน A',
      platform_line_link_code_hash: hashOwnerLinkCode('K7M2Q9XA'),
      platform_line_link_code_expires_at: '2026-11-02T10:10:00Z',
    });
    const r = await linkPlatformLineFromCode(admin, { userId: 'U1', code: 'K7M2Q9XA', displayName: 'Som', now });
    expect(r).toEqual({ outcome: 'linked', shopName: 'ร้าน A' });
    expect(updates[0]).toMatchObject({ platform_line_user_id: 'U1', platform_line_display_name: 'Som', platform_line_link_code_hash: null });
  });

  it('rejects unknown or expired codes', async () => {
    const { admin, updates } = stubAdmin({
      id: 's1',
      platform_line_link_code_hash: hashOwnerLinkCode('K7M2Q9XA'),
      platform_line_link_code_expires_at: '2026-11-02T09:00:00Z',
    });
    expect((await linkPlatformLineFromCode(admin, { userId: 'U1', code: 'K7M2Q9XA', displayName: null, now })).outcome).toBe('invalid');
    expect((await linkPlatformLineFromCode(admin, { userId: 'U1', code: 'ZZZZZZZZ', displayName: null, now })).outcome).toBe('invalid');
    expect(updates).toHaveLength(0);
  });
});
