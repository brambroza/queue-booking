import { describe, expect, it } from 'vitest';
import { canOrderFoodFor, orderEntryMessage, resolveOrderEntry } from './order-entry';

const TODAY = '2026-10-29';
const q = (id: string, status: string, booking_date = TODAY) => ({ id, status, booking_date });

describe('canOrderFoodFor', () => {
  it('needs F&B on, today and an on-site status', () => {
    expect(canOrderFoodFor(q('a', 'checked_in'), TODAY, true)).toBe(true);
    expect(canOrderFoodFor(q('a', 'checked_in'), TODAY, false)).toBe(false);
    expect(canOrderFoodFor(q('a', 'confirmed'), TODAY, true)).toBe(false);
    expect(canOrderFoodFor(q('a', 'serving', '2026-10-30'), TODAY, true)).toBe(false);
    expect(canOrderFoodFor(q('a', 'serving'), '', true)).toBe(false);
  });
});

describe('resolveOrderEntry', () => {
  it('opens the only orderable queue', () => {
    expect(resolveOrderEntry([q('a', 'confirmed'), q('b', 'called')], TODAY, true)).toEqual({ kind: 'open', bookingId: 'b' });
  });

  it('asks to choose when several queues are on site', () => {
    expect(resolveOrderEntry([q('a', 'checked_in'), q('b', 'serving')], TODAY, true)).toEqual({ kind: 'choose' });
  });

  it('reports none when nobody has checked in today', () => {
    expect(resolveOrderEntry([q('a', 'confirmed'), q('b', 'checked_in', '2026-10-30')], TODAY, true)).toEqual({ kind: 'none' });
    expect(resolveOrderEntry([], TODAY, true)).toEqual({ kind: 'none' });
  });

  it('reports disabled when the shop does not take orders', () => {
    expect(resolveOrderEntry([q('a', 'checked_in')], TODAY, false)).toEqual({ kind: 'disabled' });
  });

  it('has a message for every case except open', () => {
    expect(orderEntryMessage({ kind: 'open', bookingId: 'a' })).toBeNull();
    expect(orderEntryMessage({ kind: 'choose' })).toBeTruthy();
    expect(orderEntryMessage({ kind: 'none' })).toBeTruthy();
    expect(orderEntryMessage({ kind: 'disabled' })).toBeTruthy();
  });
});
