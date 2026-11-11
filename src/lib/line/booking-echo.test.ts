import { describe, expect, it } from 'vitest';
import {
  buildBookingEchoText,
  buildSlipEchoText,
  isBookingEcho,
  isEchoFresh,
  isSlipEcho,
  parseBookingEcho,
  parseSlipEcho,
} from './booking-echo';

describe('booking echo', () => {
  const text = buildBookingEchoText({ queueNumber: 'A002', branch: 'สาขาหลัก', service: 'จองคอร์ท', dateLabel: '14/11/2026', time: '13:00' });

  it('round-trips the queue number', () => {
    expect(text).toBe('ยืนยันคิว A002 · 14/11/2026 13:00 · จองคอร์ท · สาขาหลัก');
    expect(isBookingEcho(text)).toBe(true);
    expect(parseBookingEcho(text)).toEqual({ queueNumber: 'A002' });
  });

  it('ignores a customer typing the prefix by hand', () => {
    expect(isBookingEcho('ยืนยันคิว')).toBe(false);
    expect(parseBookingEcho('ยืนยันคิว A002')).toBeNull();
    expect(parseBookingEcho('ยืนยันคิว - · 13:00')).toBeNull();
  });
});

describe('slip echo', () => {
  it('round-trips and never collides with the booking echo', () => {
    const t = buildSlipEchoText('A002');
    expect(t).toBe('ส่งสลิปคิว A002 · แล้ว');
    expect(isSlipEcho(t)).toBe(true);
    expect(isBookingEcho(t)).toBe(false);
    expect(parseSlipEcho(t)).toEqual({ queueNumber: 'A002' });
    expect(parseSlipEcho('ส่งสลิปคิว A002')).toBeNull();
  });
});

describe('isEchoFresh', () => {
  const now = new Date('2026-11-11T10:00:00Z');
  it('accepts an echo within two minutes of the action, tolerating clock skew', () => {
    expect(isEchoFresh('2026-11-11T09:59:00Z', now)).toBe(true);
    expect(isEchoFresh('2026-11-11T10:00:03Z', now)).toBe(true);
  });
  it('rejects old, future and missing stamps', () => {
    expect(isEchoFresh('2026-11-11T09:57:00Z', now)).toBe(false);
    expect(isEchoFresh('2026-11-11T10:01:00Z', now)).toBe(false);
    expect(isEchoFresh(null, now)).toBe(false);
    expect(isEchoFresh('nope', now)).toBe(false);
  });
});
