import { describe, expect, it } from 'vitest';
import { createdTogether, needsDelivery, packBookingMessages } from './booking-delivery';

describe('packBookingMessages', () => {
  const c = (n: number) => ({ type: 'flex', altText: `c${n}` });
  const pay = { type: 'flex', altText: 'pay' };

  it('puts confirmations first and the payment card last', () => {
    expect(packBookingMessages([c(1), c(2)], pay)).toEqual([c(1), c(2), pay]);
    expect(packBookingMessages([c(1)], null)).toEqual([c(1)]);
  });

  it('caps at 5 and never drops the payment card', () => {
    const out = packBookingMessages([c(1), c(2), c(3), c(4), c(5), c(6)], pay);
    expect(out).toHaveLength(5);
    expect(out[4]).toBe(pay);
    expect(packBookingMessages([c(1), c(2), c(3), c(4), c(5), c(6)], null)).toHaveLength(5);
  });
});

describe('createdTogether', () => {
  it('groups inserts of one order and separates later bookings', () => {
    expect(createdTogether('2026-11-07T03:00:37.292Z', '2026-11-07T03:00:37.466Z')).toBe(true);
    expect(createdTogether('2026-11-07T03:00:37Z', '2026-11-07T03:01:34Z')).toBe(false);
    expect(createdTogether('x', '2026-11-07T03:00:37Z')).toBe(false);
  });
});

describe('needsDelivery', () => {
  const now = new Date('2026-11-11T10:00:00Z');
  it('is true only for a fresh booking nothing was sent for', () => {
    expect(needsDelivery({ created_at: '2026-11-11T09:58:00Z', last_line_notify_at: null }, now)).toBe(true);
    expect(needsDelivery({ created_at: '2026-11-11T09:58:00Z', last_line_notify_at: '2026-11-11T09:58:01Z' }, now)).toBe(false);
    expect(needsDelivery({ created_at: '2026-11-11T09:40:00Z', last_line_notify_at: null }, now)).toBe(false);
  });
});
