import { FNB_ORDERABLE_BOOKING_STATUSES } from './schemas';

/** The fields of a customer's queue that decide whether food can be ordered on it. */
export type OrderableBooking = {
  id: string;
  booking_date: string;
  status: string;
};

/**
 * Same rule as `/fnb/order`: the shop has F&B on, the queue is today's
 * (Bangkok) and the customer is on site.
 *
 * @param booking - Queue from `/me`.
 * @param today - Bangkok date from `/me` (`YYYY-MM-DD`).
 * @param fnbEnabled - `shop.fnb_enabled` from `/meta` (plan allows AND switch on).
 */
export function canOrderFoodFor(booking: OrderableBooking, today: string, fnbEnabled: boolean): boolean {
  return fnbEnabled && Boolean(today) && booking.booking_date === today && FNB_ORDERABLE_BOOKING_STATUSES.includes(booking.status);
}

export type OrderEntryResult =
  /** Exactly one queue can order: open its sheet straight away. */
  | { kind: 'open'; bookingId: string }
  /** Several queues can order: show the list, the customer picks one. */
  | { kind: 'choose' }
  /** No queue is on site today. */
  | { kind: 'none' }
  /** The shop does not take food orders (switch off or plan below Professional). */
  | { kind: 'disabled' };

/**
 * What the rich menu "สั่งอาหาร" button does once the customer's queues are loaded.
 *
 * @param bookings - The customer's own upcoming queues (`/me`).
 * @param today - Bangkok date from `/me`.
 * @param fnbEnabled - `shop.fnb_enabled` from `/meta`.
 */
export function resolveOrderEntry(bookings: readonly OrderableBooking[], today: string, fnbEnabled: boolean): OrderEntryResult {
  if (!fnbEnabled) return { kind: 'disabled' };
  const orderable = bookings.filter((b) => canOrderFoodFor(b, today, true));
  if (orderable.length === 1) return { kind: 'open', bookingId: orderable[0].id };
  if (orderable.length > 1) return { kind: 'choose' };
  return { kind: 'none' };
}

/** Customer-facing text for an entry that cannot open the sheet. */
export function orderEntryMessage(result: OrderEntryResult): string | null {
  switch (result.kind) {
    case 'choose':
      return 'คุณมีหลายคิวที่ร้าน เลือกคิวที่ต้องการสั่งอาหาร';
    case 'none':
      return 'สั่งอาหารได้หลังเช็คอินที่ร้านในวันที่จอง — กด "ฉันมาถึงแล้ว" ก่อน';
    case 'disabled':
      return 'ร้านนี้ยังไม่เปิดสั่งอาหารผ่าน LINE';
    default:
      return null;
  }
}
