import { describe, expect, it } from 'vitest';
import { canTransitionFnbOrder, fnbMenuItemSchema, fnbOrderCreateSchema } from './schemas';

const uuid = '3f9c1d1e-6a4b-4c1e-9d55-0b1d8a7c2f10';

describe('canTransitionFnbOrder', () => {
  it('moves forward and allows cancelling before served', () => {
    expect(canTransitionFnbOrder('new', 'preparing')).toBe(true);
    expect(canTransitionFnbOrder('new', 'served')).toBe(true);
    expect(canTransitionFnbOrder('preparing', 'served')).toBe(true);
    expect(canTransitionFnbOrder('preparing', 'cancelled')).toBe(true);
  });

  it('never reopens a finished order or goes backwards', () => {
    expect(canTransitionFnbOrder('served', 'new')).toBe(false);
    expect(canTransitionFnbOrder('served', 'cancelled')).toBe(false);
    expect(canTransitionFnbOrder('cancelled', 'preparing')).toBe(false);
    expect(canTransitionFnbOrder('preparing', 'new')).toBe(false);
  });
});

describe('fnbOrderCreateSchema', () => {
  it('accepts a normal order and ignores any client-sent price', () => {
    const parsed = fnbOrderCreateSchema.parse({
      booking_id: uuid,
      items: [{ menu_item_id: uuid, quantity: 2, unit_price: 1 }],
    });
    expect(parsed.items[0]).toEqual({ menu_item_id: uuid, quantity: 2, note: undefined });
  });

  it('rejects an empty cart, zero or oversized quantity and a bad id', () => {
    expect(fnbOrderCreateSchema.safeParse({ booking_id: uuid, items: [] }).success).toBe(false);
    expect(fnbOrderCreateSchema.safeParse({ booking_id: uuid, items: [{ menu_item_id: uuid, quantity: 0 }] }).success).toBe(false);
    expect(fnbOrderCreateSchema.safeParse({ booking_id: uuid, items: [{ menu_item_id: uuid, quantity: 100 }] }).success).toBe(false);
    expect(fnbOrderCreateSchema.safeParse({ booking_id: 'x', items: [{ menu_item_id: uuid, quantity: 1 }] }).success).toBe(false);
  });
});

describe('fnbMenuItemSchema', () => {
  it('turns blank optional fields into null and defaults the category', () => {
    const parsed = fnbMenuItemSchema.parse({ item_name: ' Singha ', price: '60', description: '', image_url: '', branch_id: '' });
    expect(parsed).toMatchObject({ item_name: 'Singha', price: 60, description: null, image_url: null, branch_id: null, category: 'ทั่วไป' });
  });

  it('rejects a negative price and a missing name', () => {
    expect(fnbMenuItemSchema.safeParse({ item_name: 'a', price: -1 }).success).toBe(false);
    expect(fnbMenuItemSchema.safeParse({ item_name: '  ', price: 10 }).success).toBe(false);
  });
});
