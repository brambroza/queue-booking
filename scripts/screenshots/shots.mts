/**
 * Shot list for the marketing screenshots.
 *
 * Every shot is read-only: it opens a page, optionally walks through UI-only
 * steps (tabs, option cards, "next"), and captures. Nothing here may submit a
 * form or change a booking.
 */

export type ShotKind = 'portal' | 'liff' | 'display';

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
  /** Element to crop to when capturing a business set (portal shots: the page content). */
  clipSelector?: string;
  /** Capture the whole scrollable page instead of the viewport. */
  fullPage?: boolean;
  /** Visible text to scroll to the top of the viewport before the capture (after the clicks). */
  scrollToText?: string;
  /** Sub-folder of public/images/product to write to (e.g. 'guide'); default is the folder itself. */
  dir?: string;
  /**
   * JSON bodies served in place of these read endpoints (path → body), so a
   * page can show a state the demo shop is not in. Writes stay blocked.
   */
  routes?: Record<string, unknown>;
  /**
   * Show this origin wherever the page prints SCREENSHOT_BASE_URL (webhook and
   * LIFF endpoints), so a capture from localhost reads like production.
   */
  showBaseUrlAs?: string;
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

export const SHOTS: Shot[] = [
  ...GUIDE,
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
