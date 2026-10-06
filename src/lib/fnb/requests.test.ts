import { describe, expect, it, vi } from 'vitest';
import type { createAdminClient } from '@/lib/supabase/admin';
import { createFnbRequest } from './requests';
import { canTransitionFnbRequest, fnbRequestCreateSchema } from './schemas';

vi.mock('@/lib/notifications/createNotification', () => ({ safeCreateNotification: vi.fn(async () => undefined) }));

type Admin = ReturnType<typeof createAdminClient>;
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const TODAY = '2026-10-06';

/** Chainable stub; `insertError` makes the insert reject like Postgres would. */
function stubAdmin(tables: Record<string, unknown>, opts: { insertError?: { code: string } } = {}, inserted: Record<string, unknown[]> = {}) {
  const from = (table: string) => {
    const result = { data: tables[table] ?? null, error: null as { code?: string } | null };
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'in']) chain[m] = () => chain;
    chain.maybeSingle = async () => result;
    chain.single = async () => (opts.insertError ? { data: null, error: opts.insertError } : { data: { id: uuid(900) }, error: null });
    chain.insert = (rows: unknown) => {
      (inserted[table] ??= []).push(rows);
      return chain;
    };
    chain.then = (resolve: (v: unknown) => unknown) => resolve(result);
    return chain;
  };
  return { from } as unknown as Admin;
}

const booking = { id: uuid(1), queue_number: 'A001', booking_date: TODAY, status: 'checked_in', branch_id: uuid(5), resource_id: uuid(6), resource_name: 'Bay 3', payment_amount: 600, payment_status: 'unpaid', service_id: null };
const args = (type: 'call_staff' | 'bill') => ({
  shopId: uuid(10),
  companyId: uuid(11),
  externalLineUserId: 'U' + 'a'.repeat(32),
  todayIso: TODAY,
  bookingId: uuid(1),
  type,
});

describe('createFnbRequest', () => {
  it('creates a call request for an on-site booking', async () => {
    const inserted: Record<string, unknown[]> = {};
    const r = await createFnbRequest(stubAdmin({ line_users: { id: uuid(2) }, bookings: booking }, {}, inserted), args('call_staff'));
    expect(r).toEqual({ ok: true, requestId: uuid(900), already: false });
    expect(inserted.fnb_service_requests?.[0]).toMatchObject({ request_type: 'call_staff', status: 'open', total_amount: null });
  });

  it('treats a second tap (unique violation) as already requested, not an error', async () => {
    const r = await createFnbRequest(stubAdmin({ line_users: { id: uuid(2) }, bookings: booking }, { insertError: { code: '23505' } }), args('call_staff'));
    expect(r).toEqual({ ok: true, requestId: null, already: true });
  });

  it('snapshots the bill estimate on a bill request', async () => {
    const inserted: Record<string, unknown[]> = {};
    const admin = stubAdmin(
      {
        line_users: { id: uuid(2) },
        bookings: booking,
        booking_resources: { unit_price: 600 },
        fnb_orders: [{ fnb_order_items: [{ item_name: 'Singha', unit_price: 65, quantity: 2 }] }],
      },
      {},
      inserted,
    );
    const r = await createFnbRequest(admin, args('bill'));
    expect(r.ok).toBe(true);
    expect(inserted.fnb_service_requests?.[0]).toMatchObject({ request_type: 'bill', booking_amount: 600, fnb_amount: 130, total_amount: 730 });
  });

  it('refuses a booking that is not on site today', async () => {
    const notChecked = stubAdmin({ line_users: { id: uuid(2) }, bookings: { ...booking, status: 'confirmed' } });
    expect(await createFnbRequest(notChecked, args('call_staff'))).toEqual({ ok: false, reason: 'booking_not_orderable' });
    const yesterday = stubAdmin({ line_users: { id: uuid(2) }, bookings: { ...booking, booking_date: '2026-10-05' } });
    expect(await createFnbRequest(yesterday, args('bill'))).toEqual({ ok: false, reason: 'booking_not_orderable' });
  });

  it('refuses a caller with no LINE user or someone else\'s booking', async () => {
    expect(await createFnbRequest(stubAdmin({ line_users: null }), args('call_staff'))).toEqual({ ok: false, reason: 'line_user_not_found' });
    expect(await createFnbRequest(stubAdmin({ line_users: { id: uuid(2) }, bookings: null }), args('call_staff'))).toEqual({ ok: false, reason: 'booking_not_found' });
  });
});

describe('canTransitionFnbRequest', () => {
  it('goes open → acknowledged → closed and never back', () => {
    expect(canTransitionFnbRequest('open', 'acknowledged')).toBe(true);
    expect(canTransitionFnbRequest('open', 'closed')).toBe(true);
    expect(canTransitionFnbRequest('acknowledged', 'closed')).toBe(true);
    expect(canTransitionFnbRequest('acknowledged', 'open')).toBe(false);
    expect(canTransitionFnbRequest('closed', 'open')).toBe(false);
  });
});

describe('fnbRequestCreateSchema', () => {
  it('accepts only the two known request types', () => {
    expect(fnbRequestCreateSchema.safeParse({ booking_id: uuid(1), request_type: 'bill' }).success).toBe(true);
    expect(fnbRequestCreateSchema.safeParse({ booking_id: uuid(1), request_type: 'refund' }).success).toBe(false);
    expect(fnbRequestCreateSchema.safeParse({ booking_id: 'x', request_type: 'bill' }).success).toBe(false);
  });
});
