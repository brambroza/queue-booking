import { describe, expect, it, vi } from 'vitest';
import type { createAdminClient } from '@/lib/supabase/admin';
import { placeFnbOrder } from './orders';

vi.mock('@/lib/notifications/createNotification', () => ({ safeCreateNotification: vi.fn(async () => undefined) }));

type Admin = ReturnType<typeof createAdminClient>;
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const TODAY = '2026-10-06';

/** Chainable stub: each table resolves to preset rows; inserts are recorded. */
function stubAdmin(tables: Record<string, unknown>, inserted: Record<string, unknown[]> = {}) {
  const from = (table: string) => {
    const result = { data: tables[table] ?? null, error: null as { message: string } | null };
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'in', 'update']) chain[m] = () => chain;
    chain.maybeSingle = async () => result;
    chain.single = async () => ({ data: { id: uuid(900) }, error: null });
    chain.insert = (rows: unknown) => {
      (inserted[table] ??= []).push(rows);
      return chain;
    };
    // awaiting a select list (menu rows) resolves like a promise
    chain.then = (resolve: (v: unknown) => unknown) => resolve(result);
    return chain;
  };
  return { from } as unknown as Admin;
}

const baseBooking = { id: uuid(1), queue_number: 'A001', booking_date: TODAY, status: 'checked_in', branch_id: uuid(5), resource_id: uuid(6), resource_name: 'Bay 3' };
const args = (items: Array<{ menu_item_id: string; quantity: number }>) => ({
  shopId: uuid(10),
  companyId: uuid(11),
  externalLineUserId: 'U' + 'a'.repeat(32),
  todayIso: TODAY,
  input: { booking_id: uuid(1), items },
});

describe('placeFnbOrder', () => {
  it('refuses a booking that is not checked in', async () => {
    const admin = stubAdmin({ line_users: { id: uuid(2) }, bookings: { ...baseBooking, status: 'confirmed' } });
    const r = await placeFnbOrder(admin, args([{ menu_item_id: uuid(20), quantity: 1 }]));
    expect(r).toEqual({ ok: false, reason: 'booking_not_orderable' });
  });

  it('refuses a booking from another day', async () => {
    const admin = stubAdmin({ line_users: { id: uuid(2) }, bookings: { ...baseBooking, booking_date: '2026-10-05' } });
    const r = await placeFnbOrder(admin, args([{ menu_item_id: uuid(20), quantity: 1 }]));
    expect(r).toEqual({ ok: false, reason: 'booking_not_orderable' });
  });

  it('refuses a caller who has no LINE user in this shop', async () => {
    const admin = stubAdmin({ line_users: null });
    const r = await placeFnbOrder(admin, args([{ menu_item_id: uuid(20), quantity: 1 }]));
    expect(r).toEqual({ ok: false, reason: 'line_user_not_found' });
  });

  it('refuses a sold-out item, an unknown item and an item of another branch', async () => {
    const soldOut = stubAdmin({ line_users: { id: uuid(2) }, bookings: baseBooking, fnb_menu_items: [{ id: uuid(20), item_name: 'Beer', price: 90, branch_id: null, is_available: false }] });
    expect((await placeFnbOrder(soldOut, args([{ menu_item_id: uuid(20), quantity: 1 }]))).ok).toBe(false);

    const unknown = stubAdmin({ line_users: { id: uuid(2) }, bookings: baseBooking, fnb_menu_items: [] });
    expect(await placeFnbOrder(unknown, args([{ menu_item_id: uuid(20), quantity: 1 }]))).toEqual({ ok: false, reason: 'item_unavailable' });

    const otherBranch = stubAdmin({ line_users: { id: uuid(2) }, bookings: baseBooking, fnb_menu_items: [{ id: uuid(20), item_name: 'Beer', price: 90, branch_id: uuid(99), is_available: true }] });
    expect(await placeFnbOrder(otherBranch, args([{ menu_item_id: uuid(20), quantity: 1 }]))).toEqual({ ok: false, reason: 'item_unavailable' });
  });

  it('prices from the database, merges duplicate lines and snapshots names', async () => {
    const inserted: Record<string, unknown[]> = {};
    const admin = stubAdmin(
      {
        line_users: { id: uuid(2) },
        bookings: baseBooking,
        fnb_menu_items: [
          { id: uuid(20), item_name: 'Singha', price: '60.50', branch_id: null, is_available: true },
          { id: uuid(21), item_name: 'Fries', price: 120, branch_id: uuid(5), is_available: true },
        ],
      },
      inserted,
    );
    const r = await placeFnbOrder(admin, args([
      { menu_item_id: uuid(20), quantity: 1 },
      { menu_item_id: uuid(20), quantity: 2 },
      { menu_item_id: uuid(21), quantity: 1 },
    ]));
    expect(r).toEqual({ ok: true, orderId: uuid(900), total: 301.5 });
    const lines = inserted.fnb_order_items?.[0] as Array<{ item_name: string; unit_price: number; quantity: number }>;
    expect(lines).toHaveLength(2);
    expect(lines.find((l) => l.item_name === 'Singha')).toMatchObject({ unit_price: 60.5, quantity: 3 });
    expect((inserted.fnb_orders?.[0] as { total_amount: number }).total_amount).toBe(301.5);
  });
});
