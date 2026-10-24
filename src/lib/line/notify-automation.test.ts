import { describe, expect, it, vi } from 'vitest';
import { safeSendFollowup, safeSendWinback, type AutomationClient } from './notify-automation';
import { followupThanksFlex, winbackFlex } from './messages-automation';

const SHOP = 'shop-1';
type Row = Record<string, unknown> | null;

/**
 * Chainable stub: every builder method returns the chain; `maybeSingle()`
 * resolves to the row configured for the table (for `bookings`, the row the
 * claim-update returns). Inserts are recorded.
 */
function stubAdmin(rows: { bookings?: Row; line_users: Row; shops: Row; customers?: Row }) {
  const inserts: Array<{ table: string; values: Record<string, unknown> }> = [];
  const builder = (table: string) => {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    Object.assign(chain, {
      select: self,
      eq: self,
      is: self,
      update: self,
      maybeSingle: () => Promise.resolve({ data: (rows as Record<string, Row>)[table] ?? null }),
      insert: (values: Record<string, unknown>) => {
        inserts.push({ table, values });
        return Promise.resolve({ error: null });
      },
    });
    return chain;
  };
  const admin = { from: (table: string) => builder(table) } as unknown as AutomationClient;
  return { admin, inserts };
}

const shop = { company_id: 'co-1', name: 'ร้านตัดผมดี', shop_key: 'cut', line_channel_access_token: 'tok', liff_id: '2001234567-AbCdEfGh', liff_id_login_shop: null };
const now = () => new Date('2026-10-23T05:00:00Z');

type Msg = { altText: string; contents: { footer?: { contents: Array<{ action: { label: string; uri: string } }> } } };

describe('safeSendFollowup', () => {
  const booking = { id: 'b1', customer_id: 'c1', line_user_id: 'lu-1', services: { service_name: 'ตัดผมชาย' } };

  it('pushes thanks with review + booking buttons and records the send', async () => {
    const { admin, inserts } = stubAdmin({ bookings: booking, line_users: { line_user_id: 'Uabc' }, shops: shop, customers: { nickname: 'บอย' } });
    const push = vi.fn().mockResolvedValue(undefined);
    const r = await safeSendFollowup({ shopId: SHOP, bookingId: 'b1', reviewUrl: 'https://g.page/r/x/review' }, { admin, push, now });
    expect(r).toEqual({ sent: true });
    const [token, to, messages] = push.mock.calls[0] as [string, string, Msg[]];
    expect(token).toBe('tok');
    expect(to).toBe('Uabc');
    expect(messages[0].altText).toContain('คุณบอย');
    const labels = messages[0].contents.footer?.contents.map((b) => b.action.label);
    expect(labels).toEqual(['ให้คะแนนร้าน', 'จองครั้งถัดไป']);
    expect(messages[0].contents.footer?.contents[1].action.uri).toBe('https://liff.line.me/2001234567-AbCdEfGh?shop_key=cut&tab=booking');
    expect(inserts).toEqual([
      expect.objectContaining({ table: 'automation_sends', values: expect.objectContaining({ kind: 'followup', status: 'sent', source_booking_id: 'b1', shop_id: SHOP }) }),
    ]);
  });

  it('does nothing when another tick already claimed the booking', async () => {
    const { admin, inserts } = stubAdmin({ bookings: null, line_users: null, shops: shop });
    const push = vi.fn();
    expect(await safeSendFollowup({ shopId: SHOP, bookingId: 'b1', reviewUrl: null }, { admin, push, now })).toEqual({ sent: false, reason: 'already_sent' });
    expect(push).not.toHaveBeenCalled();
    expect(inserts).toHaveLength(0);
  });

  it('records a failed push without throwing', async () => {
    const { admin, inserts } = stubAdmin({ bookings: booking, line_users: { line_user_id: 'Uabc' }, shops: shop });
    const push = vi.fn().mockRejectedValue(new Error('LINE push failed: blocked'));
    const r = await safeSendFollowup({ shopId: SHOP, bookingId: 'b1', reviewUrl: null }, { admin, push, now });
    expect(r).toMatchObject({ sent: false, reason: 'push_failed' });
    expect(inserts[0].values).toMatchObject({ status: 'failed', error: 'LINE push failed: blocked' });
  });

  it('skips a shop with no channel token', async () => {
    const { admin } = stubAdmin({ bookings: booking, line_users: { line_user_id: 'Uabc' }, shops: { ...shop, line_channel_access_token: null } });
    const prev = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    delete process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const push = vi.fn();
    expect(await safeSendFollowup({ shopId: SHOP, bookingId: 'b1', reviewUrl: null }, { admin, push, now })).toEqual({ sent: false, reason: 'no_token' });
    if (prev !== undefined) process.env.LINE_CHANNEL_ACCESS_TOKEN = prev;
  });
});

describe('safeSendWinback', () => {
  it('pushes the win-back card and records it', async () => {
    const { admin, inserts } = stubAdmin({ line_users: { line_user_id: 'Uabc' }, shops: shop, customers: { full_name: 'สมชาย ใจดี' } });
    const push = vi.fn().mockResolvedValue(undefined);
    const r = await safeSendWinback({ shopId: SHOP, customerId: 'c1', lineUserPk: 'lu-1', lastService: 'ตัดผมชาย', daysSince: 41 }, { admin, push, now });
    expect(r).toEqual({ sent: true });
    const [, , messages] = push.mock.calls[0] as [string, string, Msg[]];
    expect(messages[0].altText).toContain('คิดถึงคุณสมชาย ใจดี');
    expect(inserts[0].values).toMatchObject({ kind: 'winback', status: 'sent', customer_id: 'c1', source_booking_id: null });
  });

  it('returns no_line_user when the LINE user is gone', async () => {
    const { admin } = stubAdmin({ line_users: null, shops: shop });
    const push = vi.fn();
    expect(await safeSendWinback({ shopId: SHOP, customerId: 'c1', lineUserPk: 'lu-1', lastService: null, daysSince: 40 }, { admin, push, now })).toEqual({
      sent: false,
      reason: 'no_line_user',
    });
  });
});

describe('automation Flex', () => {
  it('follow-up without links has no footer', () => {
    const m = followupThanksFlex({ shopName: 'ร้าน', service: 'นวด' }) as { contents: Record<string, unknown> };
    expect(m.contents.footer).toBeUndefined();
  });

  it('win-back speaks in months after 60 days', () => {
    const m = winbackFlex({ shopName: 'ร้าน', lastService: 'ทำเล็บ', daysSince: 95 }) as {
      contents: { body: { contents: Array<{ text: string }> } };
    };
    expect(m.contents.body.contents[0].text).toContain('3 เดือน');
  });
});
