import { describe, expect, it } from 'vitest';
import {
  approvalPaymentWarning,
  customerPaymentState,
  isActiveOrderQueue,
  orderSiblingNote,
  pickOrderPayer,
  rebalancedOrderAmount,
  retargetOrderNote,
} from './payment-hold';

describe('rebalancedOrderAmount', () => {
  it('scales to the queues still active (vspin: 1,000 for 2 → 500 for 1)', () => {
    expect(rebalancedOrderAmount(1000, 2, 1)).toBe(500);
    expect(rebalancedOrderAmount(1500, 3, 2)).toBe(1000);
  });

  it('rounds to satang', () => {
    expect(rebalancedOrderAmount(100, 3, 1)).toBe(33.33);
  });

  it('returns 0 when nothing is left', () => {
    expect(rebalancedOrderAmount(1000, 2, 0)).toBe(0);
  });

  it('keeps the amount on nonsense input', () => {
    expect(rebalancedOrderAmount(0, 2, 1)).toBe(0);
    expect(rebalancedOrderAmount(1000, 0, 0)).toBe(1000);
    expect(rebalancedOrderAmount(1000, 2, 3)).toBe(1000);
  });
});

describe('pickOrderPayer', () => {
  const rows = [
    { id: 'a2', start_time: '13:00:00', status: 'pending_approval' },
    { id: 'a3', start_time: '14:00:00', status: 'pending_approval' },
    { id: 'a4', start_time: '11:00:00', status: 'cancelled' },
  ];

  it('keeps the current payer while it is active', () => {
    expect(pickOrderPayer(rows, 'a2')?.id).toBe('a2');
  });

  it('moves to the earliest active queue when the payer was cancelled', () => {
    const r = rows.map((x) => (x.id === 'a2' ? { ...x, status: 'cancelled' } : x));
    expect(pickOrderPayer(r, 'a2')?.id).toBe('a3');
  });

  it('returns null when every queue is cancelled', () => {
    expect(pickOrderPayer(rows.map((x) => ({ ...x, status: 'cancelled' })), 'a2')).toBeNull();
  });
});

describe('isActiveOrderQueue', () => {
  it('drops cancelled and no-show', () => {
    expect(isActiveOrderQueue('cancelled')).toBe(false);
    expect(isActiveOrderQueue('no_show')).toBe(false);
    expect(isActiveOrderQueue('pending_approval')).toBe(true);
  });
});

describe('retargetOrderNote', () => {
  it('points the note at the new payer', () => {
    expect(retargetOrderNote(`${orderSiblingNote('A002')} | x`, 'A002', 'A003')).toBe(`${orderSiblingNote('A003')} | x`);
  });

  it('drops the note on the queue that now pays itself', () => {
    expect(retargetOrderNote(orderSiblingNote('A002'), 'A002', null)).toBeNull();
    expect(retargetOrderNote(`${orderSiblingNote('A002')} | manual_assign`, 'A002', null)).toBe('manual_assign');
  });

  it('leaves other notes alone', () => {
    expect(retargetOrderNote('รีวิว', 'A002', null)).toBe('รีวิว');
    expect(retargetOrderNote(null, 'A002', 'A003')).toBeNull();
  });
});

describe('approvalPaymentWarning', () => {
  it('warns about a slip waiting in the inbox', () => {
    expect(approvalPaymentWarning('awaiting_verification', 1000)).toBe('slip_pending');
  });

  it('warns about an unpaid invoice', () => {
    expect(approvalPaymentWarning('pending_payment', 500)).toBe('unpaid');
    expect(approvalPaymentWarning('rejected', 500)).toBe('unpaid');
  });

  it('stays quiet when paid or there is no invoice', () => {
    expect(approvalPaymentWarning('paid', 500)).toBeNull();
    expect(approvalPaymentWarning('pending_payment', 0)).toBeNull();
    expect(approvalPaymentWarning(null, null)).toBeNull();
  });
});

describe('customerPaymentState', () => {
  it('maps payment status to what the customer hears', () => {
    expect(customerPaymentState('pending_payment', 500)).toBe('owed');
    expect(customerPaymentState('failed', 500)).toBe('owed');
    expect(customerPaymentState('awaiting_verification', 500)).toBe('in_review');
    expect(customerPaymentState('paid', 500)).toBe('paid');
    expect(customerPaymentState('unpaid', 500)).toBeNull();
    expect(customerPaymentState('pending_payment', null)).toBeNull();
  });
});
