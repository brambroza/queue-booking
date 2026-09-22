import { describe, expect, it, vi } from 'vitest';
import { safeNotifyBookingStatus, type StatusNotifyClient } from './notify-booking-status';

const SHOP = 'shop-1';
const BOOKING = 'booking-1';

type Row = Record<string, unknown> | null;

/**
 * Minimal chainable stub: every `from(table)` returns a builder whose terminal
 * `maybeSingle()` resolves to the row configured for that table. `update()` is
 * recorded so tests can assert what was written.
 */
function stubAdmin(rows: { bookings: Row; line_users: Row; shops: Row; booking_resources?: Row }) {
  const updates: Array<{ table: string; values: Record<string, unknown> }> = [];
  const builder = (table: keyof typeof rows) => {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    Object.assign(chain, {
      select: self,
      eq: self,
      maybeSingle: () => Promise.resolve({ data: rows[table] ?? null }),
      update: (values: Record<string, unknown>) => {
        updates.push({ table, values });
        return { eq: () => ({ eq: () => Promise.resolve({ error: null }) }) };
      },
    });
    return chain;
  };
  const admin = { from: (table: string) => builder(table as keyof typeof rows) } as unknown as StatusNotifyClient;
  return { admin, updates };
}

const booking = {
  id: BOOKING,
  queue_number: 'A007',
  booking_date: '2026-09-13',
  start_time: '14:00:00',
  line_user_id: 'lu-1',
  resource_id: 'r-1',
  resource_name: 'ช่างต้น',
  branches: { branch_name: 'สาขาหลัก' },
  services: { service_name: 'ตัดผม' },
};

const LIFF_ID = '2001234567-AbCdEfGh';
const shop = { name: 'ร้านตัดผมดี', shop_key: 'barber', line_channel_access_token: 'tok', liff_id: LIFF_ID, liff_id_login_shop: null };

type FlexMsg = {
  type: string;
  altText: string;
  contents: {
    header: { contents: Array<{ text: string }> };
    body: { contents: Array<{ text?: string }> };
    footer: { contents: Array<{ action: { type: string; label: string; uri?: string } }> };
  };
};

describe('safeNotifyBookingStatus', () => {
  it('skips silently when the booking has no LINE user', async () => {
    const { admin, updates } = stubAdmin({ bookings: { ...booking, line_user_id: null }, line_users: null, shops: null });
    const push = vi.fn();
    const r = await safeNotifyBookingStatus({ shopId: SHOP, bookingId: BOOKING, kind: 'called', callCount: 1 }, { admin, push });
    expect(r).toEqual({ sent: false, reason: 'no_line_user' });
    expect(push).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
  });

  it('pushes a "ถึงคิวของคุณแล้ว" flex with the assigned person and stamps last_line_notify_at', async () => {
    const { admin, updates } = stubAdmin({
      bookings: booking,
      line_users: { line_user_id: 'Uabc' },
      shops: shop,
      booking_resources: { resource_type: 'stylist' },
    });
    const push = vi.fn().mockResolvedValue(undefined);
    const r = await safeNotifyBookingStatus({ shopId: SHOP, bookingId: BOOKING, kind: 'called', callCount: 1 }, { admin, push });
    expect(r).toEqual({ sent: true });
    const [token, to, messages] = push.mock.calls[0] as [string, string, FlexMsg[]];
    expect(token).toBe('tok');
    expect(to).toBe('Uabc');
    expect(messages[0].type).toBe('flex');
    expect(messages[0].altText).toContain('ถึงคิวของคุณแล้ว');
    expect(messages[0].altText).toContain('A007');
    const texts = messages[0].contents.body.contents.map((c) => c.text ?? '');
    expect(texts.some((t) => t.includes('ช่างต้น'))).toBe(true);
    expect(updates).toHaveLength(1);
    expect(updates[0].values).toHaveProperty('last_line_notify_at');
  });

  it('links "ดูคิวของฉัน" to the LIFF account tab, not the booking form', async () => {
    const { admin } = stubAdmin({ bookings: booking, line_users: { line_user_id: 'Uabc' }, shops: shop });
    const push = vi.fn().mockResolvedValue(undefined);
    await safeNotifyBookingStatus({ shopId: SHOP, bookingId: BOOKING, kind: 'called', callCount: 1 }, { admin, push });
    const [, , messages] = push.mock.calls[0] as [string, string, FlexMsg[]];
    const myQueues = messages[0].contents.footer.contents.find((c) => c.action.label === 'ดูคิวของฉัน');
    expect(myQueues?.action.type).toBe('uri');
    expect(myQueues?.action.uri).toBe(`https://liff.line.me/${LIFF_ID}?shop_key=barber&tab=account`);
  });

  it('keeps the direct member link when the shop has no LIFF ID', async () => {
    const prev = { LIFF_ID: process.env.LIFF_ID, NEXT_PUBLIC_LIFF_ID: process.env.NEXT_PUBLIC_LIFF_ID, NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL };
    delete process.env.LIFF_ID;
    delete process.env.NEXT_PUBLIC_LIFF_ID;
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.test';
    try {
      const { admin } = stubAdmin({ bookings: booking, line_users: { line_user_id: 'Uabc' }, shops: { ...shop, liff_id: null } });
      const push = vi.fn().mockResolvedValue(undefined);
      await safeNotifyBookingStatus({ shopId: SHOP, bookingId: BOOKING, kind: 'called', callCount: 1 }, { admin, push });
      const [, , messages] = push.mock.calls[0] as [string, string, FlexMsg[]];
      const myQueues = messages[0].contents.footer.contents.find((c) => c.action.label === 'ดูคิวของฉัน');
      expect(myQueues?.action.uri).toBe('https://app.test/liff/barber/member');
    } finally {
      for (const [k, v] of Object.entries(prev)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  });

  it('marks a repeat call in the header', async () => {
    const { admin } = stubAdmin({ bookings: booking, line_users: { line_user_id: 'Uabc' }, shops: shop });
    const push = vi.fn().mockResolvedValue(undefined);
    await safeNotifyBookingStatus({ shopId: SHOP, bookingId: BOOKING, kind: 'called', callCount: 2 }, { admin, push });
    const [, , messages] = push.mock.calls[0] as [string, string, FlexMsg[]];
    expect(messages[0].contents.header.contents[1].text).toContain('ครั้งที่ 2');
  });

  it('pushes an approval flex with the booking date', async () => {
    const { admin } = stubAdmin({ bookings: booking, line_users: { line_user_id: 'Uabc' }, shops: shop });
    const push = vi.fn().mockResolvedValue(undefined);
    const r = await safeNotifyBookingStatus({ shopId: SHOP, bookingId: BOOKING, kind: 'approved' }, { admin, push });
    expect(r).toEqual({ sent: true });
    const [, , messages] = push.mock.calls[0] as [string, string, FlexMsg[]];
    expect(messages[0].altText).toContain('ร้านยืนยันคิว');
    expect(messages[0].contents.header.contents[1].text).toBe('ร้านยืนยันคิวของคุณแล้ว');
  });

  it('reports push failures without throwing or stamping', async () => {
    const { admin, updates } = stubAdmin({ bookings: booking, line_users: { line_user_id: 'Uabc' }, shops: shop });
    const push = vi.fn().mockRejectedValue(new Error('LINE push failed: 429'));
    const r = await safeNotifyBookingStatus({ shopId: SHOP, bookingId: BOOKING, kind: 'called', callCount: 1 }, { admin, push });
    expect(r.sent).toBe(false);
    expect(r.reason).toBe('push_failed');
    expect(r.error).toContain('429');
    expect(updates).toHaveLength(0);
  });

  it('skips when the shop has no channel token', async () => {
    const prevEnv = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    delete process.env.LINE_CHANNEL_ACCESS_TOKEN;
    try {
      const { admin } = stubAdmin({ bookings: booking, line_users: { line_user_id: 'Uabc' }, shops: { ...shop, line_channel_access_token: null } });
      const push = vi.fn();
      const r = await safeNotifyBookingStatus({ shopId: SHOP, bookingId: BOOKING, kind: 'called', callCount: 1 }, { admin, push });
      expect(r).toEqual({ sent: false, reason: 'no_token' });
      expect(push).not.toHaveBeenCalled();
    } finally {
      if (prevEnv !== undefined) process.env.LINE_CHANNEL_ACCESS_TOKEN = prevEnv;
    }
  });
});
