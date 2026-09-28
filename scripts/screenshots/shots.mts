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
};

export const DESKTOP: Viewport = { width: 1440, height: 900 };
export const MOBILE: Viewport = { width: 390, height: 844 };
/** Taller than DESKTOP, so a cropped portal page still shows a full table or report. */
export const DESKTOP_TALL: Viewport = { width: 1440, height: 1100 };
export const TV: Viewport = { width: 1920, height: 1080 };

const PORTAL_CONTENT = 'main[data-tour="page-content"]';

/** Shots captured once per business when the script runs with --business. */
export const BUSINESS_SHOT_NAMES = ['liff-services', 'liff-slots', 'signage-tv', 'portal-bookings', 'portal-reports'];

export const SHOTS: Shot[] = [
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
  { name: 'liff-slots', kind: 'liff', path: '/liff/{shopKey}', viewport: MOBILE, clickTexts: ['ถัดไป: เลือกคิว'] },
  { name: 'liff-my-queue', kind: 'liff', path: '/liff/{shopKey}/member', viewport: MOBILE },
  { name: 'signage-tv', kind: 'display', path: '/display/{shopKey}', viewport: TV },
];
