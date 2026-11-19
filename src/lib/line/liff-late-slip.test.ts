import { describe, expect, it } from 'vitest';
import { canSendLateSlip } from './liff-payment-link';
import { NOTE_MARKER } from '@/lib/payments/payment-hold';
import { slipReceivedHint } from './messages-payment';

const lapsed = {
  id: 'b1',
  queue_number: 'A001',
  status: 'cancelled',
  note: NOTE_MARKER,
  booking_date: '2026-11-19',
  payment_method: 'bank_transfer',
  payment_status: 'pending_payment',
};

describe('canSendLateSlip', () => {
  it('offers the late slip on a lapsed unpaid transfer for today', () => {
    expect(canSendLateSlip(lapsed, '2026-11-19')).toBe(true);
    expect(canSendLateSlip({ ...lapsed, payment_status: 'rejected' }, '2026-11-19')).toBe(true);
  });
  it('hides it when the day is over or today is unknown', () => {
    expect(canSendLateSlip(lapsed, '2026-11-20')).toBe(false);
    expect(canSendLateSlip(lapsed, '')).toBe(false);
  });
  it('hides it for other cancellations, methods or a slip already in review', () => {
    expect(canSendLateSlip({ ...lapsed, note: 'ลูกค้ายกเลิกเอง' }, '2026-11-19')).toBe(false);
    expect(canSendLateSlip({ ...lapsed, payment_method: 'omise_promptpay' }, '2026-11-19')).toBe(false);
    expect(canSendLateSlip({ ...lapsed, payment_status: 'awaiting_verification' }, '2026-11-19')).toBe(false);
  });
});

describe('slipReceivedHint', () => {
  it('keeps the normal wording for an on-time slip', () => {
    expect(slipReceivedHint(null)).toBe('กำลังรอร้านตรวจสอบ จะแจ้งผลให้ทราบทางนี้ค่ะ');
  });
  it('tells the customer what happened to a late slip', () => {
    expect(slipReceivedHint('restored')).toContain('คืนคิวให้แล้ว');
    expect(slipReceivedHint('slot_taken')).toContain('คืนเงิน');
    expect(slipReceivedHint('not_restored')).toContain('หมดเวลาชำระ');
  });
});
