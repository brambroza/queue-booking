/**
 * Shot list for the marketing screenshots.
 *
 * Every shot is read-only: it opens a page, optionally walks through UI-only
 * steps (tabs, option cards, "next"), and captures. Nothing here may submit a
 * form or change a booking.
 */

import { addDays } from './fixtures.mts';
import type { BusinessKey } from './catalogs.mts';
import { FNB_ORDER_GUIDE } from './shots-fnb-order.mts';
import { PAYMENT_GUIDE } from './shots-payment.mts';
import { SIGNAGE_SCENES } from './shots-signage-scenes.mts';

export type ShotKind = 'portal' | 'liff' | 'display';

/** Values a `patch` function may build dates from. */
export type PatchContext = { today: string; shopKey: string };

/** Rewrites the body a read endpoint would have returned (real, sampled or from `routes`). */
export type BodyPatch = (body: unknown, ctx: PatchContext) => unknown;

/** A fixed JSON body, or one built at run time (dates relative to today). */
export type FixtureBody = unknown | ((ctx: PatchContext) => unknown);

export type Viewport = { width: number; height: number };

export type Shot = {
  /** Output file name without extension, written to public/images/product/. */
  name: string;
  kind: ShotKind;
  /** Path relative to the base URL. `{shopKey}` is replaced at run time. */
  path: string;
  viewport: Viewport;
  /** Visible text that must be on screen before the capture. */
  waitForText?: string;
  /** CSS selector that must match before the capture, checked after the clicks. */
  waitForSelector?: string;
  /** Visible texts to click in order before the capture (UI navigation only). */
  clickTexts?: string[];
  /** CSS selectors to click in order after `clickTexts` (first match; UI navigation only, e.g. an edit icon). */
  clickSelectors?: string[];
  /** Element to crop to when capturing a business set (portal shots: the page content). */
  clipSelector?: string;
  /** Capture the whole scrollable page instead of the viewport. */
  fullPage?: boolean;
  /** Visible text to scroll to the top of the viewport before the capture (after the clicks). */
  scrollToText?: string;
  /** Pixels of the page kept above `scrollToText`, so a section label is not cut at the edge. */
  scrollMargin?: number;
  /** Sub-folder of public/images/product to write to (e.g. 'guide'); default is the folder itself. */
  dir?: string;
  /**
   * JSON bodies served in place of these read endpoints (path → body, or a
   * function of today), so a page can show a state the demo shop is not in.
   * Writes stay blocked. `{shopKey}` in a path is replaced at run time.
   */
  routes?: Record<string, unknown>;
  /**
   * Functions applied to the body of these read endpoints (path → patch), after
   * `routes` and the sample catalog. `{shopKey}` in a path is replaced at run
   * time. Use it to show dates relative to today that no fixed JSON can hold.
   */
  patch?: Record<string, BodyPatch>;
  /**
   * Sample business served for this shot even without `--business`, so a LIFF
   * shot has services and slots when the demo shop has none of its own.
   */
  business?: BusinessKey;
  /**
   * Show this origin wherever the page prints SCREENSHOT_BASE_URL (webhook and
   * LIFF endpoints), so a capture from localhost reads like production.
   */
  showBaseUrlAs?: string;
  /**
   * Answers for write requests (path → body), so a shot can walk past a submit
   * button (e.g. "ยืนยันจองคิว") to the screen after it. The request is answered
   * here and never reaches the server; every other write stays blocked.
   * `{shopKey}` in a path is replaced at run time.
   */
  writes?: Record<string, FixtureBody>;
  /** Body for LIFF `POST /me` instead of the default fixture (e.g. a queue waiting for payment). */
  me?: FixtureBody;
  /** Extra wait before the capture, e.g. for a toast to close. */
  delayMs?: number;
  /** Freeze the page's clock at this Bangkok time today ('HH:MM:SS'), so a board that reads the time always looks the same. */
  fixedTime?: string;
};

export const DESKTOP: Viewport = { width: 1440, height: 900 };
export const MOBILE: Viewport = { width: 390, height: 844 };
/** Taller than DESKTOP, so a cropped portal page still shows a full table or report. */
export const DESKTOP_TALL: Viewport = { width: 1440, height: 1100 };
export const TV: Viewport = { width: 1920, height: 1080 };

const PORTAL_CONTENT = 'main[data-tour="page-content"]';

/** Shots captured once per business when the script runs with --business. */
export const BUSINESS_SHOT_NAMES = ['liff-services', 'liff-slots', 'signage-tv', 'portal-bookings', 'portal-reports'];

/**
 * Dashboard checklist at 3 of 5: the demo shop is fully set up, so the real
 * endpoint would hide the card the setup guide needs to show.
 */
const ONBOARDING_THREE_OF_FIVE = {
  data: {
    steps: [
      { key: 'branch', done: true },
      { key: 'service', done: true },
      { key: 'working_hours', done: true },
      { key: 'line', done: false },
      { key: 'first_booking', done: false },
    ],
    completed: 3,
    total: 5,
    shop_key: 'DEMO',
  },
};

/** Origin printed in the guide screenshots in place of the dev server's. */
const PUBLIC_ORIGIN = 'https://queuebooking.com';

/** Screens of the shop's own setup, for docs/guides/line-setup-guide.html. */
const GUIDE: Shot[] = [
  { name: 'guide-dashboard-checklist', kind: 'portal', path: '/portal/dashboard', viewport: DESKTOP, dir: 'guide', routes: { '/api/onboarding-status': ONBOARDING_THREE_OF_FIVE } },
  { name: 'guide-branches', kind: 'portal', path: '/portal/branches', viewport: DESKTOP, dir: 'guide' },
  { name: 'guide-services', kind: 'portal', path: '/portal/services', viewport: DESKTOP, dir: 'guide' },
  { name: 'guide-working-hours', kind: 'portal', path: '/portal/working-hours', viewport: DESKTOP, dir: 'guide' },
  { name: 'guide-line-settings', kind: 'portal', path: '/portal/line-settings', viewport: DESKTOP_TALL, dir: 'guide', showBaseUrlAs: PUBLIC_ORIGIN },
  { name: 'guide-line-setup', kind: 'portal', path: '/portal/onboarding/line-setup', viewport: DESKTOP_TALL, dir: 'guide', showBaseUrlAs: PUBLIC_ORIGIN },
];

// ---------------------------------------------------------------------------
// Booking window shots for the blog post on events and courses
// (public/images/product/booking-window). Dates are relative to today so the
// screenshots do not go stale; the branch is the sample workshop studio.
// ---------------------------------------------------------------------------

type Branch = Record<string, unknown>;
type MetaBody = { data?: { branches?: Branch[] } };
type RowsBody = { data?: Branch[] };
type DaysBody = { data?: Record<string, unknown> };
type SlotsBody = { data?: Array<Record<string, unknown>> };

/** The event opens for booking 14 days from today and runs three days. */
const EVENT_FROM_DAYS = 14;
const EVENT_TO_DAYS = 16;
/** Courses on the "1 week ahead" branch. */
const ADVANCE_DAYS = 7;

/**
 * Stamp every branch of a `/meta` body with the given window fields.
 * @param fields Fields to merge into each branch.
 * @returns Body patch.
 */
function metaBranches(fields: (ctx: PatchContext) => Branch): BodyPatch {
  return (body, ctx) => {
    const meta = body as MetaBody;
    return { ...meta, data: { ...meta.data, branches: (meta.data?.branches ?? []).map((b) => ({ ...b, ...fields(ctx) })) } };
  };
}

/**
 * Set the calendar bounds on a `/bookable-days` body.
 * @param bounds Bounds to merge into `data`.
 * @returns Body patch.
 */
function bookableDays(bounds: (ctx: PatchContext) => Record<string, unknown>): BodyPatch {
  return (body, ctx) => {
    const days = body as DaysBody;
    return { ...days, data: { ...days.data, ...bounds(ctx) } };
  };
}

/** Future days have no past slots; the sample marks the morning as gone. */
const noPastSlots: BodyPatch = (body) => {
  const slots = body as SlotsBody;
  return { ...slots, data: (slots.data ?? []).map((s) => ({ ...s, is_past: false })) };
};

/** The event's three-day window, used by the portal form and the LIFF calendar alike. */
const eventWindow = (ctx: PatchContext) => ({ from: addDays(ctx.today, EVENT_FROM_DAYS), to: addDays(ctx.today, EVENT_TO_DAYS) });

const LIFF_META = '/api/public/shop/{shopKey}/meta';
const LIFF_DAYS = '/api/public/shop/{shopKey}/bookable-days';
const LIFF_SLOTS = '/api/public/shop/{shopKey}/slots';

/** Walk the LIFF booking flow to the date step. */
const LIFF_TO_DATE_STEP: Pick<Shot, 'kind' | 'path' | 'viewport' | 'business' | 'dir' | 'clickTexts' | 'scrollToText'> = {
  kind: 'liff',
  path: '/liff/{shopKey}',
  viewport: MOBILE,
  business: 'workshop',
  dir: 'booking-window',
  clickTexts: ['ถัดไป: เลือกคิว'],
  scrollToText: 'เลือกวันที่',
  scrollMargin: 24,
};

const BOOKING_WINDOW: Shot[] = [
  {
    // Branch form with the event's open/close dates filled in.
    name: 'window-portal-branch-form',
    kind: 'portal',
    path: '/portal/branches',
    viewport: DESKTOP,
    business: 'workshop',
    dir: 'booking-window',
    clickSelectors: ['tbody tr:first-child td:last-child button'],
    // The form only: the drawer's own header sits under the portal top bar.
    clipSelector: 'aside form',
    waitForText: 'แก้ไขสาขา',
    patch: {
      '/api/branches': (body, ctx) => {
        const rows = body as RowsBody;
        const { from, to } = eventWindow(ctx);
        return {
          ...rows,
          data: (rows.data ?? []).map((b) => ({
            ...b,
            address: 'ซอยเอกมัย 10 กรุงเทพฯ',
            phone: '02-000-0000',
            open_time: '10:00',
            close_time: '19:00',
            active: true,
            booking_advance_window: null,
            booking_open_from: from,
            booking_open_until: to,
            booking_release_at: null,
          })),
        };
      },
    },
  },
  {
    // LIFF calendar showing only the three event days.
    ...LIFF_TO_DATE_STEP,
    name: 'window-liff-event-days',
    waitForText: 'เปิดจองวันที่',
    patch: {
      [LIFF_META]: metaBranches((ctx) => {
        const { from, to } = eventWindow(ctx);
        return { min_booking_date: from, max_booking_date: to };
      }),
      [LIFF_DAYS]: bookableDays((ctx) => {
        const { from, to } = eventWindow(ctx);
        return { min_date: from, max_date: to };
      }),
      [LIFF_SLOTS]: noPastSlots,
    },
  },
  {
    // LIFF calendar capped one week ahead.
    ...LIFF_TO_DATE_STEP,
    name: 'window-liff-advance-1w',
    waitForText: 'จองล่วงหน้าได้ถึง',
    patch: {
      [LIFF_META]: metaBranches((ctx) => ({ max_booking_date: addDays(ctx.today, ADVANCE_DAYS) })),
      [LIFF_DAYS]: bookableDays((ctx) => ({ max_date: addDays(ctx.today, ADVANCE_DAYS) })),
    },
  },
  {
    // Waiting room: booking opens tomorrow at 19:00, the page counts down.
    name: 'window-liff-waiting-room',
    kind: 'liff',
    path: '/liff/{shopKey}',
    viewport: MOBILE,
    business: 'workshop',
    dir: 'booking-window',
    waitForText: 'ไม่ต้องกดรีเฟรช',
    scrollToText: 'เลือกบริการที่ต้องการ',
    scrollMargin: 24,
    patch: {
      [LIFF_META]: metaBranches((ctx) => ({ booking_release_at: `${addDays(ctx.today, 1)}T19:00:00+07:00` })),
    },
  },
];

export const SHOTS: Shot[] = [
  ...GUIDE,
  ...BOOKING_WINDOW,
  ...PAYMENT_GUIDE,
  ...FNB_ORDER_GUIDE,
  ...SIGNAGE_SCENES,
  { name: 'portal-dashboard', kind: 'portal', path: '/portal/dashboard', viewport: DESKTOP },
  { name: 'portal-queue-board', kind: 'portal', path: '/portal/queue-board', viewport: DESKTOP },
  { name: 'portal-bookings', kind: 'portal', path: '/portal/bookings', viewport: DESKTOP_TALL, clipSelector: PORTAL_CONTENT },
  { name: 'portal-calendar', kind: 'portal', path: '/portal/calendar', viewport: DESKTOP },
  {
    name: 'portal-reports',
    kind: 'portal',
    path: '/portal/reports',
    viewport: DESKTOP_TALL,
    clipSelector: PORTAL_CONTENT,
    clickTexts: ['ย้อนหลัง 7 วัน'],
    waitForSelector: 'button:has-text("บันทึก PDF"):not([disabled])',
  },
  { name: 'portal-rich-menu', kind: 'portal', path: '/portal/rich-menu', viewport: DESKTOP },
  { name: 'liff-services', kind: 'liff', path: '/liff/{shopKey}', viewport: MOBILE },
  { name: 'liff-slots', kind: 'liff', path: '/liff/{shopKey}', viewport: MOBILE, clickTexts: ['ถัดไป: เลือกคิว'], waitForText: 'เวลาว่าง ·', scrollToText: 'เวลาว่าง ·' },
  { name: 'liff-my-queue', kind: 'liff', path: '/liff/{shopKey}/member', viewport: MOBILE },
  { name: 'signage-tv', kind: 'display', path: '/display/{shopKey}', viewport: TV },
];
