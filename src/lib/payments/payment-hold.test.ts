import { describe, expect, it } from 'vitest';
import {
  PAYMENT_EXPIRY_GRACE_MINUTES,
  appendPaymentExpiredNote,
  isAwaitingPayment,
  isPaymentHoldExpired,
  shouldHoldForPayment,
  type PaymentHoldRow,
} from './payment-hold';

const now = new Date('2026-10-25T12:00:00.000Z');
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000).toISOString();

const held = (over: Partial<PaymentHoldRow> = {}): PaymentHoldRow => ({
  id: 'b1',
  status: 'pending_approval',
  payment_status: 'pending_payment',
  payment_expires_at: minutesAgo(PAYMENT_EXPIRY_GRACE_MINUTES + 1),
  payment_hold_booking_id: 'b1',
  ...over,
});

describe('shouldHoldForPayment', () => {
  it('holds a confirmed booking with a payment deadline', () => {
    expect(shouldHoldForPayment('confirmed', true)).toBe(true);
  });
  it('keeps the old flow without payment', () => {
    expect(shouldHoldForPayment('confirmed', false)).toBe(false);
  });
  it('leaves a service that needs manual approval alone', () => {
    expect(shouldHoldForPayment('pending_approval', true)).toBe(false);
  });
});

describe('isPaymentHoldExpired', () => {
  it('expires an unpaid hold past deadline + grace', () => {
    expect(isPaymentHoldExpired(held(), now)).toBe(true);
  });
  it('waits out the grace period', () => {
    expect(isPaymentHoldExpired(held({ payment_expires_at: minutesAgo(PAYMENT_EXPIRY_GRACE_MINUTES - 1) }), now)).toBe(false);
  });
  it('treats failed and rejected payments as unpaid', () => {
    expect(isPaymentHoldExpired(held({ payment_status: 'failed' }), now)).toBe(true);
    expect(isPaymentHoldExpired(held({ payment_status: 'rejected' }), now)).toBe(true);
  });
  it('never expires a slip in review or a paid booking', () => {
    expect(isPaymentHoldExpired(held({ payment_status: 'awaiting_verification' }), now)).toBe(false);
    expect(isPaymentHoldExpired(held({ payment_status: 'paid' }), now)).toBe(false);
  });
  it('ignores bookings that are not held or no longer pending', () => {
    expect(isPaymentHoldExpired(held({ payment_hold_booking_id: null }), now)).toBe(false);
    expect(isPaymentHoldExpired(held({ status: 'confirmed' }), now)).toBe(false);
  });
  it('only the paying booking of an order carries the deadline', () => {
    expect(isPaymentHoldExpired(held({ id: 'b2', payment_hold_booking_id: 'b1' }), now)).toBe(false);
  });
  it('ignores a missing or broken deadline', () => {
    expect(isPaymentHoldExpired(held({ payment_expires_at: null }), now)).toBe(false);
    expect(isPaymentHoldExpired(held({ payment_expires_at: 'not-a-date' }), now)).toBe(false);
  });
});

describe('isAwaitingPayment', () => {
  it('is true for pending_approval with money owed', () => {
    expect(isAwaitingPayment('pending_approval', 'pending_payment')).toBe(true);
  });
  it('is false for a slip in review or another status', () => {
    expect(isAwaitingPayment('pending_approval', 'awaiting_verification')).toBe(false);
    expect(isAwaitingPayment('pending_approval', 'unpaid')).toBe(false);
    expect(isAwaitingPayment('confirmed', 'pending_payment')).toBe(false);
  });
});

describe('appendPaymentExpiredNote', () => {
  it('keeps staff notes and does not duplicate the marker', () => {
    const once = appendPaymentExpiredNote('โต๊ะริมหน้าต่าง');
    expect(once).toBe('โต๊ะริมหน้าต่าง | ยกเลิกอัตโนมัติ: เลยเวลาชำระเงิน');
    expect(appendPaymentExpiredNote(once)).toBe(once);
    expect(appendPaymentExpiredNote(null)).toBe('ยกเลิกอัตโนมัติ: เลยเวลาชำระเงิน');
  });
});
