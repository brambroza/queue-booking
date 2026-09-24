import { describe, expect, it } from 'vitest';
import type { createAdminClient } from '@/lib/supabase/admin';
import { appendCancelNote, cancelBookingByCustomer } from './cancel-by-customer';

type AdminClient = ReturnType<typeof createAdminClient>;
type Row = Record<string, unknown> | null;

const SHOP = 'shop-1';
const COMPANY = 'co-1';
const BOOKING = 'booking-1';
const ARGS = { shopId: SHOP, companyId: COMPANY, externalLineUserId: 'Uabc', bookingId: BOOKING } as const;

/**
 * Chainable stub: `from(table)` resolves `maybeSingle()` to the configured row;
 * `update()` and `insert()` are recorded. `insert()` returns a promise that also
 * exposes `.select().single()` because `createNotification` chains on it.
 */
function stubAdmin(rows: { line_users: Row; bookings: Row }, opts: { updateError?: { message: string } } = {}) {
  const updates: Array<{ table: string; values: Record<string, unknown> }> = [];
  const inserts: Array<{ table: string; values: Record<string, unknown> }> = [];
  const builder = (table: string) => {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    Object.assign(chain, {
      select: self,
      eq: self,
      maybeSingle: () => Promise.resolve({ data: (rows as Record<string, Row>)[table] ?? null }),
      update: (values: Record<string, unknown>) => {
        updates.push({ table, values });
        return { eq: () => ({ eq: () => Promise.resolve({ error: opts.updateError ?? null }) }) };
      },
      insert: (values: Record<string, unknown>) => {
        inserts.push({ table, values });
        const p = Promise.resolve({ data: { id: 'n1', ...values }, error: null });
        return Object.assign(p, { select: () => ({ single: () => p }) });
      },
    });
    return chain;
  };
  const admin = { from: (table: string) => builder(table) } as unknown as AdminClient;
  return { admin, updates, inserts };
}

const booking = {
  id: BOOKING,
  queue_number: 'A012',
  booking_date: '2026-09-25',
  start_time: '10:30:00',
  branch_id: 'br-1',
  status: 'confirmed',
  note: 'auto_assign_by_party_size',
};

describe('appendCancelNote', () => {
  it('returns the marker alone when there is no note', () => {
    expect(appendCancelNote(null, 'liff')).toBe('Cancelled by customer via LIFF');
    expect(appendCancelNote('   ', 'line')).toBe('Cancelled by customer via LINE');
  });

  it('keeps the existing note and appends the marker', () => {
    expect(appendCancelNote('manual_assign', 'line')).toBe('manual_assign | Cancelled by customer via LINE');
  });

  it('does not duplicate the marker', () => {
    const once = appendCancelNote('x', 'liff');
    expect(appendCancelNote(once, 'liff')).toBe(once);
    expect(appendCancelNote('Cancelled by customer via LIFF', 'liff')).toBe('Cancelled by customer via LIFF');
  });
});

describe('cancelBookingByCustomer', () => {
  it('cancels from LINE: status, appended note, log row and staff notification', async () => {
    const { admin, updates, inserts } = stubAdmin({ line_users: { id: 'lu-1' }, bookings: booking });
    const r = await cancelBookingByCustomer(admin, { ...ARGS, source: 'line' });
    expect(r).toEqual({
      ok: true,
      booking: { id: BOOKING, queue_number: 'A012', booking_date: '2026-09-25', start_time: '10:30:00', branch_id: 'br-1', status: 'confirmed' },
    });
    expect(updates).toEqual([
      { table: 'bookings', values: { status: 'cancelled', note: 'auto_assign_by_party_size | Cancelled by customer via LINE' } },
    ]);
    const log = inserts.find((i) => i.table === 'booking_logs');
    expect(log?.values).toMatchObject({ company_id: COMPANY, shop_id: SHOP, booking_id: BOOKING, action: 'cancel_by_customer_line' });
    const notif = inserts.find((i) => i.table === 'notifications');
    expect(notif?.values).toMatchObject({
      company_id: COMPANY,
      shop_id: SHOP,
      branch_id: 'br-1',
      type: 'booking_cancelled',
      priority: 'high',
      related_id: BOOKING,
    });
    expect((notif?.values.metadata as Record<string, unknown>).source).toBe('line');
    expect(String(notif?.values.title)).toContain('A012');
  });

  it('cancels from LIFF with the legacy log action name and LIFF marker', async () => {
    const { admin, updates, inserts } = stubAdmin({ line_users: { id: 'lu-1' }, bookings: { ...booking, note: null } });
    const r = await cancelBookingByCustomer(admin, { ...ARGS, source: 'liff' });
    expect(r.ok).toBe(true);
    expect(updates[0]?.values).toEqual({ status: 'cancelled', note: 'Cancelled by customer via LIFF' });
    expect(inserts.find((i) => i.table === 'booking_logs')?.values.action).toBe('cancel_by_customer_liff');
    expect((inserts.find((i) => i.table === 'notifications')?.values.metadata as Record<string, unknown>).source).toBe('liff');
  });

  it('refuses an unknown LINE user without writing', async () => {
    const { admin, updates, inserts } = stubAdmin({ line_users: null, bookings: booking });
    const r = await cancelBookingByCustomer(admin, { ...ARGS, source: 'line' });
    expect(r).toEqual({ ok: false, reason: 'line_user_not_found' });
    expect(updates).toHaveLength(0);
    expect(inserts).toHaveLength(0);
  });

  it("reports booking_not_found for another customer's booking", async () => {
    const { admin, updates, inserts } = stubAdmin({ line_users: { id: 'lu-1' }, bookings: null });
    const r = await cancelBookingByCustomer(admin, { ...ARGS, source: 'line' });
    expect(r).toEqual({ ok: false, reason: 'booking_not_found' });
    expect(updates).toHaveLength(0);
    expect(inserts).toHaveLength(0);
  });

  it('refuses a booking that is already being called', async () => {
    const { admin, updates, inserts } = stubAdmin({ line_users: { id: 'lu-1' }, bookings: { ...booking, status: 'called' } });
    const r = await cancelBookingByCustomer(admin, { ...ARGS, source: 'line' });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error('expected failure');
    expect(r.reason).toBe('not_cancellable');
    if (!('booking' in r)) throw new Error('expected booking');
    expect(r.booking.queue_number).toBe('A012');
    expect(updates).toHaveLength(0);
    expect(inserts).toHaveLength(0);
  });

  it('reports already_cancelled on a second tap without writing again', async () => {
    const { admin, updates, inserts } = stubAdmin({ line_users: { id: 'lu-1' }, bookings: { ...booking, status: 'cancelled' } });
    const r = await cancelBookingByCustomer(admin, { ...ARGS, source: 'line' });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error('expected failure');
    expect(r.reason).toBe('already_cancelled');
    expect(updates).toHaveLength(0);
    expect(inserts).toHaveLength(0);
  });

  it('throws when the status update fails so callers can report it', async () => {
    const { admin, inserts } = stubAdmin({ line_users: { id: 'lu-1' }, bookings: booking }, { updateError: { message: 'boom' } });
    await expect(cancelBookingByCustomer(admin, { ...ARGS, source: 'liff' })).rejects.toEqual({ message: 'boom' });
    expect(inserts).toHaveLength(0);
  });
});
