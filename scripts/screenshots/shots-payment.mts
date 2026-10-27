/**
 * Shots for docs/guides/payment-booking-guide.html: a shop that collects
 * payment when a customer books (bank transfer + slip), from the portal
 * settings to the customer's "รอชำระเงิน" screen and the slip review.
 *
 * Output: public/images/product/payment-guide/. Sample business: badminton.
 * Every name, account and phone number below is fictional. The booking itself
 * is answered from a fixture (`writes`), so nothing is created.
 */

import QRCode from 'qrcode';
import type { BodyPatch, PatchContext, Shot } from './shots.mts';

const DIR = 'payment-guide';
const DESKTOP = { width: 1440, height: 900 };
const DESKTOP_LONG = { width: 1440, height: 1500 };
const MOBILE = { width: 390, height: 844 };
const MOBILE_LONG = { width: 390, height: 1500 };
const PORTAL_CONTENT = 'main[data-tour="page-content"]';

const SHOP_NAME = 'สมาร์ทแบดมินตัน';
const PRICE = 180;
const WINDOW_MINUTES = 30;

/** A QR that only says it is a sample, so a reader scanning the PDF pays nobody. */
const SAMPLE_QR = await QRCode.toDataURL('ตัวอย่าง QR ในคู่มือ ใช้ชำระเงินไม่ได้', { margin: 1, width: 480 });

/** Stand-in for an uploaded transfer slip. */
const SAMPLE_SLIP =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="360" height="560" viewBox="0 0 360 560">
<rect width="360" height="560" rx="18" fill="#f4faf6"/><rect x="0" y="0" width="360" height="92" rx="18" fill="#0e9f5a"/>
<text x="180" y="56" font-family="Kanit, sans-serif" font-size="24" fill="#fff" text-anchor="middle">โอนเงินสำเร็จ</text>
<text x="32" y="150" font-family="Kanit, sans-serif" font-size="16" fill="#5b6b62">จำนวนเงิน</text>
<text x="32" y="190" font-family="Kanit, sans-serif" font-size="34" fill="#14211a">${PRICE}.00 บาท</text>
<text x="32" y="250" font-family="Kanit, sans-serif" font-size="16" fill="#5b6b62">จาก</text>
<text x="32" y="278" font-family="Kanit, sans-serif" font-size="18" fill="#14211a">น.ส. มะลิ ใจดี</text>
<text x="32" y="330" font-family="Kanit, sans-serif" font-size="16" fill="#5b6b62">ไปยัง</text>
<text x="32" y="358" font-family="Kanit, sans-serif" font-size="18" fill="#14211a">${SHOP_NAME}</text>
<text x="32" y="520" font-family="Kanit, sans-serif" font-size="13" fill="#9aa8a0">ภาพตัวอย่างประกอบคู่มือ</text></svg>`);

/** Payee details the shop entered (fictional). */
const PAYEE = {
  methods: ['bank_transfer'],
  promptpay_display_name: SHOP_NAME,
  promptpay_masked: '080-xxx-0000',
  bank_name: 'ธนาคารกสิกรไทย',
  bank_account_no: '000-0-00000-0',
  bank_account_name: 'บจก. สมาร์ทแบดมินตัน',
  deeplink_banks: [],
  mobile_banking_banks: [],
};

/** Deadline shown on the customer's screens: 30 minutes from now, the shop's window. */
const deadline = () => new Date(Date.now() + (WINDOW_MINUTES - 4) * 60_000).toISOString();

/** The customer's queue: today 15:00 (the slot booked in the LIFF shots), held until paid. */
function heldQueue(ctx: PatchContext, payment: Record<string, unknown>) {
  return {
    id: 'sample-pay-booking',
    queue_number: 'A012',
    booking_date: ctx.today,
    start_time: '15:00:00',
    end_time: '16:00:00',
    status: 'pending_approval',
    note: null,
    created_at: new Date().toISOString(),
    resource_id: null,
    resource_name: null,
    payment_status: 'pending_payment',
    payment_method: 'bank_transfer',
    payment_amount: PRICE,
    payment_expires_at: deadline(),
    bank_provider: null,
    change_notified_at: null,
    change_acknowledged_at: null,
    checked_in_at: null,
    called_at: null,
    branches: { branch_name: 'สาขารามอินทรา' },
    services: { service_name: 'เช่าสนาม 1 ชั่วโมง' },
    ...payment,
  };
}

/** LIFF `/me` with one held queue. */
const meWith = (payment: Record<string, unknown>) => (ctx: PatchContext) => ({
  data: {
    customer: { id: 'sample-customer', full_name: 'มะลิ ใจดี', phone: '0800000001', nickname: 'มะลิ' },
    was_registered: false,
    today: ctx.today,
    upcoming: [heldQueue(ctx, payment)],
    history: [],
  },
});

/** `/payment/status` for the held queue. */
const paymentState = (payment: Record<string, unknown>, slip: Record<string, unknown> | null) => () => ({
  data: {
    booking_id: 'sample-pay-booking',
    queue_number: 'A012',
    payment_status: 'pending_payment',
    payment_method: 'bank_transfer',
    payment_amount: PRICE,
    payment_expires_at: deadline(),
    payment_reject_reason: null,
    qr_image_url: SAMPLE_QR,
    payee: PAYEE,
    bank_provider: null,
    bank_provider_name: null,
    bank_deeplink_url: null,
    return_url: null,
    slip,
    ...payment,
  },
});

/** The shop takes bank transfer only, so the LIFF needs no method picker. */
const metaWithPayment: BodyPatch = (body) => {
  const meta = body as { data?: Record<string, unknown> };
  return { ...meta, data: { ...meta.data, payment: PAYEE } };
};

/** Future slots only (the sample marks the morning as past). */
const noPastSlots: BodyPatch = (body) => {
  const slots = body as { data?: Array<Record<string, unknown>> };
  return { ...slots, data: (slots.data ?? []).map((s) => ({ ...s, is_past: false })) };
};

const LIFF_META = '/api/public/shop/{shopKey}/meta';
const LIFF_SLOTS = '/api/public/shop/{shopKey}/slots';
const LIFF_BOOK = '/api/public/shop/{shopKey}/book';
const LIFF_STATUS = '/api/public/shop/{shopKey}/payment/status';

/** Response of "ยืนยันจองคิว": the order is held until paid. */
const bookResponse = (ctx: PatchContext) => ({
  data: {
    booking_id: 'sample-pay-booking',
    queue_number: 'A012',
    status: 'pending_approval',
    awaiting_payment: true,
    booking_date: ctx.today,
    booking_time: '15:00',
    end_time: '16:00',
    slot_count: 1,
    bookings: [{ booking_id: 'sample-pay-booking', queue_number: 'A012', start_time: '15:00' }],
    branch_name: 'สาขารามอินทรา',
    service_name: 'เช่าสนาม 1 ชั่วโมง',
    line_push_sent: true,
    line_push_error: null,
    qr_payment_created: true,
    payment: {
      method: 'bank_transfer',
      amount: PRICE,
      qr_image_url: SAMPLE_QR,
      expires_at: deadline(),
      bank: {
        payeeName: SHOP_NAME,
        promptpayMasked: PAYEE.promptpay_masked,
        bankName: PAYEE.bank_name,
        bankAccountNo: PAYEE.bank_account_no,
        bankAccountName: PAYEE.bank_account_name,
      },
      deeplink: null,
    },
  },
});

/** Shop payment settings (bank transfer on, 30 minutes to pay). */
const SETTINGS = {
  data: {
    qr_payment_enabled: false,
    mobile_banking_enabled: false,
    mobile_banking_available: false,
    omise_public_key: null,
    omise_secret_key_set: false,
    omise_secret_key_hint: null,
    transfer_payment_enabled: true,
    promptpay_id: '0800000000',
    promptpay_display_name: SHOP_NAME,
    bank_name: PAYEE.bank_name,
    bank_account_no: PAYEE.bank_account_no,
    bank_account_name: PAYEE.bank_account_name,
    transfer_payment_window_minutes: WINDOW_MINUTES,
  },
};

/** One slip waiting for the shop's review. */
const slipInbox = (ctx: PatchContext) => ({
  data: [
    {
      id: 'sample-slip',
      booking_id: 'sample-pay-booking',
      storage_path: 'sample/slip.png',
      status: 'pending',
      amount_claimed: PRICE,
      transferred_at: new Date(Date.now() - 6 * 60_000).toISOString(),
      reject_reason: null,
      reviewed_at: null,
      created_at: new Date(Date.now() - 5 * 60_000).toISOString(),
      mime_type: 'image/png',
      file_size: 182_000,
      sending_bank_code: '004',
      trans_ref: null,
      auto_check_status: 'plausible',
      auto_check_result: null,
      auto_approved: false,
      verified_amount: null,
      provider_recheck_count: 0,
      next_recheck_at: null,
      image_url: SAMPLE_SLIP,
      bookings: {
        queue_number: 'A012',
        booking_date: ctx.today,
        start_time: '15:00:00',
        payment_amount: PRICE,
        payment_status: 'awaiting_verification',
        customers: { full_name: 'มะลิ ใจดี', nickname: 'มะลิ', phone: '0800000001' },
      },
    },
  ],
  count: 1,
  page: 1,
  page_size: 25,
  meta: { slip_verify: { source: 'none', plan_locked: false, can_configure: true } },
});

/** Walk LIFF to the slot grid and pick tomorrow 18:00-ish (first free afternoon slot). */
const LIFF_BOOKING: Pick<Shot, 'kind' | 'path' | 'business' | 'dir' | 'patch'> = {
  kind: 'liff',
  path: '/liff/{shopKey}',
  business: 'badminton',
  dir: DIR,
  patch: { [LIFF_META]: metaWithPayment, [LIFF_SLOTS]: noPastSlots },
};

export const PAYMENT_GUIDE: Shot[] = [
  {
    name: 'pay-portal-settings',
    kind: 'portal',
    path: '/portal/payment-settings',
    viewport: DESKTOP_LONG,
    business: 'badminton',
    dir: DIR,
    clipSelector: PORTAL_CONTENT,
    waitForText: 'ให้เวลาชำระ',
    routes: { '/api/shop-payment-settings': SETTINGS },
  },
  {
    name: 'pay-portal-services',
    kind: 'portal',
    path: '/portal/services',
    viewport: DESKTOP,
    business: 'badminton',
    dir: DIR,
    clipSelector: PORTAL_CONTENT,
    // The sample catalog carries no `active` flag; the list would read "inactive".
    patch: { '/api/services': (body) => {
      const rows = body as { data?: Array<Record<string, unknown>> };
      return { ...rows, data: (rows.data ?? []).map((r) => ({ ...r, active: true })) };
    } },
  },
  {
    ...LIFF_BOOKING,
    name: 'pay-liff-pick-slot',
    viewport: MOBILE,
    clickTexts: ['ถัดไป: เลือกคิว', '15:00'],
    scrollToText: 'เวลาว่าง ·',
    scrollMargin: 16,
  },
  {
    ...LIFF_BOOKING,
    name: 'pay-liff-awaiting-payment',
    viewport: MOBILE_LONG,
    clickTexts: ['ถัดไป: เลือกคิว', '15:00', 'ยืนยันจองคิว'],
    waitForText: 'จองคิวแล้ว รอชำระเงิน',
    // The "จองคิวแล้ว" toast covers the header for a few seconds.
    delayMs: 6000,
    writes: { [LIFF_BOOK]: bookResponse, [LIFF_STATUS]: paymentState({}, null) },
  },
  {
    name: 'pay-liff-my-queue-unpaid',
    kind: 'liff',
    path: '/liff/{shopKey}/member',
    viewport: MOBILE,
    business: 'badminton',
    dir: DIR,
    waitForText: 'รอชำระเงิน',
    me: meWith({}),
  },
  {
    name: 'pay-liff-slip-review',
    kind: 'liff',
    path: '/liff/{shopKey}/member',
    viewport: MOBILE,
    business: 'badminton',
    dir: DIR,
    waitForText: 'รอร้านตรวจสอบสลิป',
    me: meWith({ payment_status: 'awaiting_verification' }),
  },
  {
    name: 'pay-portal-slip-inbox',
    kind: 'portal',
    path: '/portal/payment-verification',
    viewport: DESKTOP,
    business: 'badminton',
    dir: DIR,
    clipSelector: PORTAL_CONTENT,
    routes: { '/api/payment-slips': slipInbox },
  },
  {
    // The review dialog the shop opens from the inbox (no approve/reject is pressed).
    name: 'pay-portal-slip-review',
    kind: 'portal',
    path: '/portal/payment-verification',
    business: 'badminton',
    dir: DIR,
    viewport: { width: 1440, height: 2300 },
    clickSelectors: ['tbody button'],
    waitForSelector: 'div.fixed.inset-0 > div',
    // The panel only: the portal shell behind it shows the demo shop's own name.
    clipSelector: 'div.fixed.inset-0 > div',
    routes: { '/api/payment-slips': slipInbox },
  },
  {
    // Notification center: what the shop sees as the order moves along.
    name: 'pay-portal-notifications',
    kind: 'portal',
    path: '/portal/notifications',
    viewport: DESKTOP,
    business: 'badminton',
    dir: DIR,
    clipSelector: PORTAL_CONTENT,
    routes: { '/api/notifications': () => notificationsBody() },
  },
  {
    // Bookings list: the unpaid order sits as "รออนุมัติ" with its payment state.
    name: 'pay-portal-bookings',
    kind: 'portal',
    path: '/portal/bookings',
    business: 'badminton',
    dir: DIR,
    clipSelector: PORTAL_CONTENT,
    viewport: DESKTOP,
    // The afternoon only (last four queues), so the unpaid A012 is on screen.
    patch: { '/api/bookings': (body) => {
      const rows = body as { data?: Array<Record<string, unknown>>; pagination?: Record<string, unknown> };
      const tail = (rows.data ?? []).slice(-4).map((r, i) => ({
        ...r,
        queue_number: `A0${9 + i < 10 ? '0' : ''}${9 + i}`,
        // The unpaid one is the customer of the LIFF shots: มะลิ, court hire at 15:00.
        ...(r.status === 'pending_approval'
          ? {
              start_time: '15:00:00',
              end_time: '16:00:00',
              payment_method: 'bank_transfer',
              payment_amount: PRICE,
              payment_expires_at: deadline(),
              customers: { full_name: 'มะลิ ใจดี', nickname: 'มะลิ', phone: '0800000001' },
              services: { service_name: 'เช่าสนาม 1 ชั่วโมง' },
            }
          : {}),
      })).sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));
      return { ...rows, data: tail, pagination: { ...rows.pagination, total: tail.length } };
    } },
  },
];

/** Notification center rows for the order, newest first (fictional). */
function notificationsBody() {
  const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
  const at = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString();
  const base = {
    company_id: 'sample', shop_id: 'sample', branch_id: null, user_id: null, body: null,
    related_type: 'booking', related_id: 'sample-pay-booking', metadata: {}, archived_at: null, is_archived: false,
  };
  const rows = [
    { id: 'n4', type: 'payment_verified', category: 'billing', priority: 'medium', title: 'ยืนยันการชำระเงินแล้ว', message: 'คิว A012 ชำระ 180 บาท เรียบร้อย', action_url: '/portal/payment-verification', icon: 'payments', color: '#2e7d32', read_at: null, is_read: false, created_at: at(1), updated_at: at(1) },
    { id: 'n3', type: 'payment_slip_uploaded', category: 'billing', priority: 'high', title: 'สลิปใหม่รอตรวจสอบ', message: 'คิว A012 อัปโหลดสลิปแล้ว ยอด 180 บาท', action_url: '/portal/payment-verification', icon: 'receipt', color: '#d97706', read_at: null, is_read: false, created_at: at(6), updated_at: at(6) },
    { id: 'n2', type: 'booking_created', category: 'bookings', priority: 'medium', title: 'A012 — จองใหม่ รอชำระเงิน', message: `ลูกค้าจอง ${today()} 15:00 (เช่าสนาม 1 ชั่วโมง) — คิวจะยืนยันอัตโนมัติเมื่อชำระเงิน ถ้าไม่ชำระภายในเวลาที่กำหนดระบบจะยกเลิกให้`, action_url: '/portal/bookings', icon: 'PendingActions', color: '#d97706', read_at: null, is_read: false, created_at: at(12), updated_at: at(12) },
    { id: 'n1', type: 'booking_cancelled', category: 'bookings', priority: 'medium', title: 'A009 — ยกเลิกอัตโนมัติ (ไม่ชำระเงิน)', message: `คิว A009 (${today()} 14:00) ไม่ได้ชำระเงินภายในเวลาที่กำหนด ระบบยกเลิกและเปิดที่ว่างให้จองใหม่แล้ว`, action_url: '/portal/bookings', icon: 'Cancel', color: '#c62828', read_at: at(30), is_read: true, created_at: at(40), updated_at: at(30) },
  ].map((r) => ({ ...base, ...r }));
  return { data: rows, pagination: { total: rows.length, limit: 20, offset: 0 }, unread_count: 3 };
}
