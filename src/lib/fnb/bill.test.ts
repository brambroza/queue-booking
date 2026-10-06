import { describe, expect, it } from 'vitest';
import { buildBill } from './bill';

describe('buildBill', () => {
  it('adds the unpaid bay fee to the food total', () => {
    const bill = buildBill({
      bookingAmount: 600,
      bookingPaid: false,
      items: [
        { item_name: 'Singha', unit_price: 65, quantity: 2 },
        { item_name: 'Fries', unit_price: 90, quantity: 1 },
      ],
    });
    expect(bill.fnb_total).toBe(220);
    expect(bill.due_total).toBe(820);
    expect(bill.booking_paid).toBe(false);
  });

  it('does not charge the bay fee again when it was paid online', () => {
    const bill = buildBill({ bookingAmount: 600, bookingPaid: true, items: [{ item_name: 'Cola', unit_price: 30, quantity: 3 }] });
    expect(bill.due_total).toBe(90);
    expect(bill.booking_amount).toBe(600);
  });

  it('merges the same dish from separate orders into one line', () => {
    const bill = buildBill({
      bookingAmount: 0,
      bookingPaid: false,
      items: [
        { item_name: 'Singha', unit_price: 65, quantity: 1 },
        { item_name: 'Singha', unit_price: 65, quantity: 2 },
        { item_name: 'Singha', unit_price: 70, quantity: 1 },
      ],
    });
    expect(bill.fnb_lines).toHaveLength(2);
    expect(bill.fnb_lines.find((l) => l.amount === 195)).toMatchObject({ quantity: 3 });
  });

  it('rounds to satang and never goes negative', () => {
    const bill = buildBill({ bookingAmount: -5, bookingPaid: false, items: [{ item_name: 'X', unit_price: 0.1, quantity: 3 }] });
    expect(bill.booking_amount).toBe(0);
    expect(bill.fnb_total).toBe(0.3);
    expect(bill.due_total).toBe(0.3);
  });

  it('handles an empty tab', () => {
    expect(buildBill({ bookingAmount: 500, bookingPaid: false, items: [] })).toMatchObject({ fnb_lines: [], fnb_total: 0, due_total: 500 });
  });
});
