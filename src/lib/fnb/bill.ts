import type { createAdminClient } from '@/lib/supabase/admin';

type AdminClient = ReturnType<typeof createAdminClient>;

export type BillLine = { item_name: string; quantity: number; amount: number };

/** What the customer sees under "เช็คบิล". An estimate: staff confirm the final figure. */
export type BillSummary = {
  /** Bay / table fee for the booking. */
  booking_amount: number;
  /** True when the booking fee was already paid online, so it is not due again. */
  booking_paid: boolean;
  /** Food and drinks that are not cancelled (new, preparing, served). */
  fnb_lines: BillLine[];
  fnb_total: number;
  /** What is still to pay at the counter: unpaid booking fee plus food. */
  due_total: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Pure bill arithmetic, kept apart from the database reads so it can be tested.
 *
 * Duplicate item names are merged per item and unit price so the customer sees
 * one line per dish. Cancelled orders must already be filtered out by the caller.
 */
export function buildBill(input: {
  bookingAmount: number;
  bookingPaid: boolean;
  items: Array<{ item_name: string; unit_price: number; quantity: number }>;
}): BillSummary {
  const merged = new Map<string, { item_name: string; quantity: number; amount: number }>();
  for (const i of input.items) {
    const key = `${i.item_name}|${i.unit_price}`;
    const prev = merged.get(key);
    const amount = i.unit_price * i.quantity;
    merged.set(key, {
      item_name: i.item_name,
      quantity: (prev?.quantity ?? 0) + i.quantity,
      amount: (prev?.amount ?? 0) + amount,
    });
  }
  const fnb_lines = Array.from(merged.values()).map((l) => ({ ...l, amount: round2(l.amount) }));
  const fnb_total = round2(fnb_lines.reduce((s, l) => s + l.amount, 0));
  const booking_amount = round2(Math.max(0, input.bookingAmount));
  const due_total = round2((input.bookingPaid ? 0 : booking_amount) + fnb_total);
  return { booking_amount, booking_paid: input.bookingPaid, fnb_lines, fnb_total, due_total };
}

/**
 * Loads the bill for a booking. Caller must already have proven the booking
 * belongs to the verified LINE user; this only filters by shop and booking.
 *
 * The booking fee is the stored payment amount when a payment was created,
 * otherwise the resource price (if above 0) or the service price, the same
 * precedence the booking route uses when it charges.
 */
export async function loadBill(admin: AdminClient, args: { shopId: string; bookingId: string }): Promise<BillSummary | null> {
  const { data: booking } = await admin
    .from('bookings')
    .select('id,payment_amount,payment_status,resource_id,service_id')
    .eq('id', args.bookingId)
    .eq('shop_id', args.shopId)
    .eq('is_deleted', false)
    .maybeSingle();
  if (!booking) return null;

  const [{ data: resource }, { data: service }, { data: orders }] = await Promise.all([
    booking.resource_id
      ? admin.from('booking_resources').select('unit_price').eq('id', booking.resource_id).eq('shop_id', args.shopId).maybeSingle()
      : Promise.resolve({ data: null as { unit_price?: number | string | null } | null }),
    booking.service_id
      ? admin.from('services').select('price').eq('id', booking.service_id).eq('shop_id', args.shopId).maybeSingle()
      : Promise.resolve({ data: null as { price?: number | string | null } | null }),
    admin
      .from('fnb_orders')
      .select('fnb_order_items(item_name,unit_price,quantity)')
      .eq('shop_id', args.shopId)
      .eq('booking_id', args.bookingId)
      .eq('is_deleted', false)
      .in('status', ['new', 'preparing', 'served']),
  ]);

  const resourcePrice = Number((resource as { unit_price?: number | string | null } | null)?.unit_price ?? 0);
  const servicePrice = Number((service as { price?: number | string | null } | null)?.price ?? 0);
  const stored = booking.payment_amount === null || booking.payment_amount === undefined ? null : Number(booking.payment_amount);
  const bookingAmount = stored ?? (resourcePrice > 0 ? resourcePrice : servicePrice);

  const items = ((orders ?? []) as Array<{ fnb_order_items: Array<{ item_name: string; unit_price: number | string; quantity: number }> | null }>)
    .flatMap((o) => o.fnb_order_items ?? [])
    .map((i) => ({ item_name: i.item_name, unit_price: Number(i.unit_price), quantity: i.quantity }));

  return buildBill({ bookingAmount: Number.isFinite(bookingAmount) ? bookingAmount : 0, bookingPaid: booking.payment_status === 'paid', items });
}
