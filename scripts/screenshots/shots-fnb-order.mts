/**
 * Shots for the rich menu "สั่งอาหาร" button guide: the owner picks the action
 * in the rich menu builder, the customer taps it in LINE and lands on the
 * order sheet, and the order shows up on the shop's order board.
 *
 * Output: public/images/product/fnb-order-guide/. Sample business: golf.
 * Every name below is fictional. Orders are answered from fixtures, nothing is created.
 */

import type { BodyPatch, PatchContext, Shot } from './shots.mts';

const DIR = 'fnb-order-guide';
const DESKTOP_TALL = { width: 1440, height: 2200 };
const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };
const PORTAL_CONTENT = 'main[data-tour="page-content"]';

const SHOP_NAME = 'สวิงเลานจ์ กอล์ฟซิมูเลเตอร์';
const LIFF_META = '/api/public/shop/{shopKey}/meta';
const LIFF_MENU = '/api/public/shop/{shopKey}/fnb/menu';
const LIFF_MY_ORDERS = '/api/public/shop/{shopKey}/fnb/my-orders';

/** Rich menu with the "สั่งอาหาร" button in the third cell. */
const CONFIG = {
  version: 1,
  businessType: 'sports_court',
  layout: 'grid3x2',
  style: 'bold',
  palette: { primary: '#0e7c4a' },
  chatBarText: 'จองเบย์',
  buttons: [
    { iconKey: 'ball', label: 'จองเบย์', action: { type: 'liff_booking' } },
    { iconKey: 'queue', label: 'การจองของฉัน', action: { type: 'liff_member' } },
    { iconKey: 'food', label: 'สั่งอาหาร', action: { type: 'liff_order' } },
    { iconKey: 'promo', label: 'ราคา / โปร', action: { type: 'message', text: 'ขอดูราคาและโปรโมชัน' } },
    { iconKey: 'location', label: 'แผนที่', action: { type: 'url', url: 'https://maps.google.com' } },
    { iconKey: 'contact', label: 'ติดต่อ', action: { type: 'message', text: 'ติดต่อร้าน' } },
  ],
};

/** Builder state: Professional shop with F&B on, or a Starter shop. */
const builderState = (planAllowed: boolean) => ({
  data: {
    shop_name: SHOP_NAME,
    business_type: 'sports_court',
    config: CONFIG,
    template: CONFIG,
    image_url: null,
    line_rich_menu_id: null,
    published_at: null,
    has_token: true,
    has_liff_booking: true,
    has_liff_member: true,
    fnb_plan_allowed: planAllowed,
    fnb_enabled: planAllowed,
  },
});

/** The shop takes food orders. */
const metaFnbOn: BodyPatch = (body) => {
  const meta = body as { data?: { shop?: Record<string, unknown> } & Record<string, unknown> };
  return { ...meta, data: { ...meta.data, shop: { ...meta.data?.shop, fnb_enabled: true } } };
};

const MENU = {
  data: {
    enabled: true,
    items: [
      { id: 'm1', category: 'เครื่องดื่ม', item_name: 'เบียร์สด (แก้ว)', description: null, price: 120, image_url: null, is_available: true },
      { id: 'm2', category: 'เครื่องดื่ม', item_name: 'โค้ก', description: null, price: 45, image_url: null, is_available: true },
      { id: 'm3', category: 'เครื่องดื่ม', item_name: 'น้ำเปล่า', description: null, price: 20, image_url: null, is_available: true },
      { id: 'm4', category: 'ของทานเล่น', item_name: 'เฟรนช์ฟรายส์', description: 'จานใหญ่ ทานได้ 2-3 คน', price: 120, image_url: null, is_available: true },
      { id: 'm5', category: 'ของทานเล่น', item_name: 'ปีกไก่ทอดน้ำปลา', description: null, price: 160, image_url: null, is_available: true },
      { id: 'm6', category: 'ของทานเล่น', item_name: 'เอ็นข้อไก่ทอด', description: null, price: 140, image_url: null, is_available: false },
    ],
  },
};

/** A queue at the shop today. */
function queue(ctx: PatchContext, id: string, queueNumber: string, bay: string, start: string, status: string) {
  const end = `${String(Number(start.slice(0, 2)) + 1).padStart(2, '0')}${start.slice(2)}`;
  return {
    id,
    queue_number: queueNumber,
    booking_date: ctx.today,
    start_time: `${start}:00`,
    end_time: `${end}:00`,
    status,
    note: null,
    created_at: new Date().toISOString(),
    resource_id: null,
    resource_name: bay,
    payment_status: null,
    payment_method: null,
    payment_amount: null,
    payment_expires_at: null,
    bank_provider: null,
    change_notified_at: null,
    change_acknowledged_at: null,
    checked_in_at: status === 'confirmed' ? null : new Date().toISOString(),
    called_at: null,
    branches: { branch_name: 'สาขาทองหล่อ' },
    services: { service_name: 'เช่าเบย์ 1 ชั่วโมง' },
  };
}

/** LIFF `/me` with the given queues. */
const meWith = (build: (ctx: PatchContext) => unknown[]) => (ctx: PatchContext) => ({
  data: {
    customer: { id: 'sample-customer', full_name: 'ภูมิ สายลม', phone: '0800000002', nickname: 'ภูมิ' },
    was_registered: false,
    today: ctx.today,
    upcoming: build(ctx),
    history: [],
  },
});

const LIFF_ORDER: Pick<Shot, 'kind' | 'path' | 'viewport' | 'business' | 'dir' | 'patch' | 'routes' | 'writes'> = {
  kind: 'liff',
  path: '/liff/{shopKey}/order',
  viewport: MOBILE,
  business: 'golf',
  dir: DIR,
  patch: { [LIFF_META]: metaFnbOn },
  routes: { [LIFF_MENU]: MENU },
  writes: { [LIFF_MY_ORDERS]: { data: [], requests: [] } },
};

/** The order board after the customer sent one order (fictional). */
const boardOrders = () => {
  const at = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString();
  const customer = { full_name: 'ภูมิ สายลม', nickname: 'ภูมิ' };
  return {
    data: [
      {
        id: 'o2',
        status: 'new',
        total_amount: 360,
        note: 'เบียร์เย็น ๆ',
        created_at: at(1),
        fnb_order_items: [
          { id: 'i1', item_name: 'เบียร์สด (แก้ว)', unit_price: 120, quantity: 2, note: null },
          { id: 'i2', item_name: 'เฟรนช์ฟรายส์', unit_price: 120, quantity: 1, note: null },
        ],
        bookings: { queue_number: 'A014', resource_name: 'เบย์ 3', customers: customer },
        booking_resources: { resource_name: 'เบย์ 3', resource_code: null },
      },
      {
        id: 'o1',
        status: 'preparing',
        total_amount: 205,
        note: null,
        created_at: at(9),
        fnb_order_items: [
          { id: 'i3', item_name: 'ปีกไก่ทอดน้ำปลา', unit_price: 160, quantity: 1, note: null },
          { id: 'i4', item_name: 'โค้ก', unit_price: 45, quantity: 1, note: null },
        ],
        bookings: { queue_number: 'A011', resource_name: 'เบย์ 1', customers: { full_name: 'ฟ้า ใสสะอาด', nickname: 'ฟ้า' } },
        booking_resources: { resource_name: 'เบย์ 1', resource_code: null },
      },
    ],
  };
};

export const FNB_ORDER_GUIDE: Shot[] = [
  {
    name: 'fnbo-portal-rich-menu',
    kind: 'portal',
    path: '/portal/rich-menu',
    viewport: DESKTOP_TALL,
    business: 'golf',
    dir: DIR,
    clipSelector: PORTAL_CONTENT,
    waitForText: '4. ปุ่มและลิงก์',
    routes: { '/api/rich-menu': builderState(true) },
  },
  {
    name: 'fnbo-portal-rich-menu-starter',
    kind: 'portal',
    path: '/portal/rich-menu',
    viewport: DESKTOP_TALL,
    business: 'golf',
    dir: DIR,
    clipSelector: PORTAL_CONTENT,
    waitForText: 'ใช้ได้ตั้งแต่แพ็กเกจ Professional',
    routes: { '/api/rich-menu': builderState(false) },
  },
  {
    // Tapped "สั่งอาหาร" with one queue checked in: the order page, straight away.
    ...LIFF_ORDER,
    name: 'fnbo-liff-order-sheet',
    me: meWith((ctx) => [queue(ctx, 'q-bay3', 'A014', 'เบย์ 3', '19:00', 'checked_in')]),
    waitForText: 'เบียร์สด',
    clickSelectors: ['[data-testid="AddRoundedIcon"]', '[data-testid="AddRoundedIcon"]'],
  },
  {
    // Not checked in yet: a check-in button on the order page.
    ...LIFF_ORDER,
    name: 'fnbo-liff-order-not-checked-in',
    me: meWith((ctx) => [queue(ctx, 'q-bay3', 'A014', 'เบย์ 3', '19:00', 'confirmed')]),
    waitForText: 'สั่งอาหารได้หลังเช็คอิน',
  },
  {
    // Two queues on site: the customer picks which one to order for.
    ...LIFF_ORDER,
    name: 'fnbo-liff-order-choose',
    me: meWith((ctx) => [
      queue(ctx, 'q-bay3', 'A014', 'เบย์ 3', '19:00', 'checked_in'),
      queue(ctx, 'q-bay4', 'A015', 'เบย์ 4', '19:00', 'checked_in'),
    ]),
    waitForText: 'เลือกคิวที่ต้องการสั่งอาหาร',
  },
  {
    name: 'fnbo-portal-orders',
    kind: 'portal',
    path: '/portal/fnb-orders',
    viewport: DESKTOP,
    business: 'golf',
    dir: DIR,
    clipSelector: PORTAL_CONTENT,
    routes: {
      '/api/fnb-orders': boardOrders,
      '/api/fnb-requests': { data: [] },
      '/api/fnb-settings': { data: { fnb_enabled: true, plan_allowed: true, enabled: true, plan_code: 'professional' } },
    },
  },
];
