/**
 * Pure rules for the customer how-to image ("วิธีจองคิวผ่าน LINE") a shop
 * downloads after connecting LINE and posts on Facebook or sends in LINE.
 * One tall image, five steps, drawn from the shop's own OA id, rich menu,
 * services and working hours. Drawing lives in `customer-guide-render.ts`.
 */
import { bookingConfirmFlex } from '@/lib/line/messages';
import type { RichMenuButton } from '@/lib/line/rich-menu/schema';
import { formatThaiDateLabel } from '@/lib/utils/date-format';

/** 9:16 — fits a Facebook / LINE image post and a story. */
export const GUIDE_IMAGE_SIZE = { width: 1080, height: 1920 } as const;

/** Service rows shown in step 3. */
export const GUIDE_SERVICES_MAX = 3;

/** Time chips shown in step 4. */
export const GUIDE_SLOT_COUNT = 6;

/**
 * Normalize a LINE OA basic id to `@xxxx`.
 *
 * @param raw - `basicId` from LINE `/v2/bot/info` (with or without `@`).
 * @returns `@id`, or null when empty or not a plausible id.
 */
export function normalizeBasicId(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? '').trim().replace(/^@+/, '');
  if (!trimmed || !/^[A-Za-z0-9._-]{2,40}$/.test(trimmed)) return null;
  return `@${trimmed}`;
}

/**
 * Add-friend link LINE opens straight to the OA chat (where the rich menu shows).
 *
 * @param basicId - Raw or normalized basic id.
 * @returns `https://line.me/R/ti/p/%40id`, or null when the id is unusable.
 */
export function lineAddFriendUrl(basicId: string | null | undefined): string | null {
  const id = normalizeBasicId(basicId);
  return id ? `https://line.me/R/ti/p/${encodeURIComponent(id)}` : null;
}

/**
 * Rich menu button the customer taps to book: the first `liff_booking`
 * button, else the first button.
 */
export function bookingButtonIndex(buttons: readonly RichMenuButton[]): number {
  const index = buttons.findIndex((b) => b.action.type === 'liff_booking');
  return index >= 0 ? index : 0;
}

export type GuideService = { name: string; durationMinutes: number | null; price: number | null };

/**
 * Second line under a service name, e.g. "60 นาที · ฿350".
 * Free or unpriced services show the duration only.
 */
export function serviceSubtitle(service: GuideService): string {
  const parts: string[] = [];
  if (service.durationMinutes && service.durationMinutes > 0) parts.push(`${service.durationMinutes} นาที`);
  if (service.price && service.price > 0) parts.push(`฿${service.price.toLocaleString('th-TH', { maximumFractionDigits: 2 })}`);
  return parts.join(' · ');
}

/** `HH:MM[:SS]` → minutes since midnight, or null when malformed. */
function toMinutes(time: string | null | undefined): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(time ?? '');
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 24 || m > 59) return null;
  return h * 60 + m;
}

function toHhMm(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** Times used when the shop has no working hours yet. */
const FALLBACK_SLOT_TIMES = ['10:00', '10:30', '11:00', '11:30', '13:00', '13:30'];

/**
 * Example slot times for step 4, from one day of the shop's working hours.
 * Skips the break; `close_time` 00:00 means end of day.
 *
 * @param hours - One `working_hours` row, or null.
 * @param count - How many times to return.
 */
export function sampleSlotTimes(
  hours: { open_time: string; close_time: string; slot_interval_minutes: number | null; break_start?: string | null; break_end?: string | null } | null,
  count = GUIDE_SLOT_COUNT,
): string[] {
  const open = toMinutes(hours?.open_time);
  let close = toMinutes(hours?.close_time);
  if (close === 0) close = 24 * 60;
  const interval = hours?.slot_interval_minutes && hours.slot_interval_minutes > 0 ? hours.slot_interval_minutes : 30;
  if (open === null || close === null || close <= open) return FALLBACK_SLOT_TIMES.slice(0, count);

  const breakStart = toMinutes(hours?.break_start);
  const breakEnd = toMinutes(hours?.break_end);
  const times: string[] = [];
  for (let t = open; t + interval <= close && times.length < count; t += interval) {
    const inBreak = breakStart !== null && breakEnd !== null && t >= breakStart && t < breakEnd;
    if (!inBreak) times.push(toHhMm(t));
  }
  return times.length ? times : FALLBACK_SLOT_TIMES.slice(0, count);
}

/**
 * Download file name, ASCII only so LINE / Facebook uploads keep it.
 *
 * @param shopKey - Shop key, may be empty.
 */
export function guideFileName(shopKey: string | null | undefined): string {
  const safeKey = (shopKey ?? '').replace(/[^A-Za-z0-9-]/g, '').toLowerCase();
  return `line-booking-guide${safeKey ? `-${safeKey}` : ''}.png`;
}

/** True for `#rrggbb` — the only form the color picker and rich menu use. */
export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}

export type ExampleDay = { iso: string; weekday: string; day: string };

/**
 * Days shown in the step 4 date strip: `count` days from tomorrow, Bangkok calendar.
 *
 * @param now - Clock (injected for tests).
 */
export function exampleDays(now: Date, count = 5): ExampleDay[] {
  const iso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' });
  const weekday = new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', weekday: 'short' });
  const day = new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric' });
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getTime() + (i + 1) * 86_400_000);
    return { iso: iso.format(d), weekday: weekday.format(d), day: day.format(d) };
  });
}

/** Queue number printed on the example confirmation. */
export const EXAMPLE_QUEUE_NUMBER = 'A001';

/**
 * The booking-confirmed Flex bubble exactly as `/book` pushes it, filled with
 * the example picks from steps 3–4. Only the bubble (`contents`) is returned.
 */
export function exampleConfirmBubble(input: { shopName: string; branchName: string | null; serviceName: string; dateIso: string; time: string }) {
  const message = bookingConfirmFlex({
    shopName: input.shopName,
    queueNumber: EXAMPLE_QUEUE_NUMBER,
    branch: input.branchName || '-',
    service: input.serviceName,
    date: formatThaiDateLabel(input.dateIso),
    time: input.time,
    // Any id gives the one-tap cancel button the real message has.
    bookingId: 'example',
  });
  return message.contents as Record<string, unknown>;
}
