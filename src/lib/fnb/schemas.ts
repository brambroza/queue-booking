import { z } from 'zod';

/** Order lifecycle on the staff board. `cancelled` is terminal, like `served`. */
export const FNB_ORDER_STATUSES = ['new', 'preparing', 'served', 'cancelled'] as const;
export type FnbOrderStatus = (typeof FNB_ORDER_STATUSES)[number];

/** Booking statuses during which the customer is on site and may order. */
export const FNB_ORDERABLE_BOOKING_STATUSES: readonly string[] = [
  'checked_in',
  'waiting',
  'called',
  'serving',
  'seating',
  'in_service',
];

const emptyToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);

/** Portal create / update of one menu item. */
export const fnbMenuItemSchema = z.object({
  category: z.string().trim().min(1).max(60).default('ทั่วไป'),
  item_name: z.string().trim().min(1, 'กรุณากรอกชื่อเมนู').max(120),
  description: z.preprocess(emptyToNull, z.string().trim().max(500).nullable().optional()),
  price: z.coerce.number().min(0, 'ราคาต้องไม่ติดลบ').max(100000),
  image_url: z.preprocess(emptyToNull, z.string().trim().url().max(500).nullable().optional()),
  branch_id: z.preprocess(emptyToNull, z.string().uuid().nullable().optional()),
  is_available: z.coerce.boolean().default(true),
  active: z.coerce.boolean().default(true),
  sort_order: z.coerce.number().int().min(0).max(9999).default(0),
});
export type FnbMenuItemInput = z.infer<typeof fnbMenuItemSchema>;

/** Customer order from LIFF. Prices are never accepted from the client. */
export const fnbOrderCreateSchema = z.object({
  line_user_id: z.string().min(1).max(64).optional(),
  /** LIFF ID token; the verified `sub` is the caller's identity. */
  id_token: z.string().max(4096).optional(),
  booking_id: z.string().uuid(),
  note: z.preprocess(emptyToNull, z.string().trim().max(300).nullable().optional()),
  items: z
    .array(
      z.object({
        menu_item_id: z.string().uuid(),
        quantity: z.coerce.number().int().min(1).max(99),
        note: z.preprocess(emptyToNull, z.string().trim().max(200).nullable().optional()),
      }),
    )
    .min(1, 'ตะกร้าว่าง')
    .max(30),
});
export type FnbOrderCreateInput = z.infer<typeof fnbOrderCreateSchema>;

/** Allowed staff transitions. Cancelling is possible until the order is served. */
const NEXT_STATUS: Record<FnbOrderStatus, readonly FnbOrderStatus[]> = {
  new: ['preparing', 'served', 'cancelled'],
  preparing: ['served', 'cancelled'],
  served: [],
  cancelled: [],
};

/**
 * Whether staff may move an order from one status to another.
 *
 * @param from - Current stored status.
 * @param to - Requested status.
 */
export function canTransitionFnbOrder(from: FnbOrderStatus, to: FnbOrderStatus): boolean {
  return NEXT_STATUS[from]?.includes(to) ?? false;
}

/** Customer buttons on the order sheet. */
export const FNB_REQUEST_TYPES = ['call_staff', 'bill'] as const;
export type FnbRequestType = (typeof FNB_REQUEST_TYPES)[number];

export const FNB_REQUEST_STATUSES = ['open', 'acknowledged', 'closed'] as const;
export type FnbRequestStatus = (typeof FNB_REQUEST_STATUSES)[number];

/** Customer taps "เรียกพนักงาน" or "ขอเช็คบิล" for one of their bookings. */
export const fnbRequestCreateSchema = z.object({
  line_user_id: z.string().min(1).max(64).optional(),
  id_token: z.string().max(4096).optional(),
  booking_id: z.string().uuid(),
  request_type: z.enum(FNB_REQUEST_TYPES),
});
export type FnbRequestCreateInput = z.infer<typeof fnbRequestCreateSchema>;

/** Same idea as the order flow: open → acknowledged → closed, or closed straight away. */
const NEXT_REQUEST_STATUS: Record<FnbRequestStatus, readonly FnbRequestStatus[]> = {
  open: ['acknowledged', 'closed'],
  acknowledged: ['closed'],
  closed: [],
};

/**
 * Whether staff may move a customer request from one status to another.
 *
 * @param from - Current stored status.
 * @param to - Requested status.
 */
export function canTransitionFnbRequest(from: FnbRequestStatus, to: FnbRequestStatus): boolean {
  return NEXT_REQUEST_STATUS[from]?.includes(to) ?? false;
}
