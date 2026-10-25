import { describe, expect, it } from 'vitest';
import { paymentResumeKind, pickLinkedPaymentTarget, readLinkedBookingId } from './liff-payment-link';

const ID = '3f2b8c1e-6a4d-4e8f-9b2a-1c3d5e7f9a0b';
const OTHER = '11111111-2222-4333-8444-555555555555';

describe('paymentResumeKind', () => {
  it('offers the slip panel for unpaid or rejected transfers', () => {
    expect(paymentResumeKind({ id: ID, queue_number: 'A1', payment_method: 'bank_transfer', payment_status: 'pending_payment' })).toBe('slip');
    expect(paymentResumeKind({ id: ID, queue_number: 'A1', payment_method: 'bank_transfer', payment_status: 'rejected' })).toBe('slip');
  });

  it('offers nothing once the slip is in or paid', () => {
    expect(paymentResumeKind({ id: ID, queue_number: 'A1', payment_method: 'bank_transfer', payment_status: 'awaiting_verification' })).toBeNull();
    expect(paymentResumeKind({ id: ID, queue_number: 'A1', payment_method: 'bank_transfer', payment_status: 'paid' })).toBeNull();
  });

  it('offers the bank app for unfinished bank-app payments', () => {
    expect(paymentResumeKind({ id: ID, queue_number: 'A1', payment_method: 'omise_mobile_banking', payment_status: 'failed' })).toBe('bank_app');
  });
});

describe('readLinkedBookingId', () => {
  it('reads a uuid booking_id', () => {
    expect(readLinkedBookingId(`?shop_key=S&tab=account&booking_id=${ID.toUpperCase()}`)).toBe(ID);
  });

  it('ignores missing or malformed ids', () => {
    expect(readLinkedBookingId('?tab=account')).toBeNull();
    expect(readLinkedBookingId('?booking_id=1;drop')).toBeNull();
  });
});

describe('pickLinkedPaymentTarget', () => {
  const unpaid = { id: ID, queue_number: 'A7', payment_method: 'bank_transfer', payment_status: 'pending_payment' };

  it('opens the linked queue when it still needs a slip', () => {
    expect(pickLinkedPaymentTarget(ID, [unpaid])).toEqual({ booking_id: ID, queue_number: 'A7', payment_method: 'bank_transfer' });
  });

  it('does nothing for a queue that is not the customer\'s', () => {
    expect(pickLinkedPaymentTarget(OTHER, [unpaid])).toBeNull();
  });

  it('does nothing once the slip was uploaded', () => {
    expect(pickLinkedPaymentTarget(ID, [{ ...unpaid, payment_status: 'awaiting_verification' }])).toBeNull();
  });
});
