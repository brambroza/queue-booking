/**
 * Rules for telling a shop its monthly booking quota is running out.
 * Pure: no I/O, so the thresholds and wording are unit-tested.
 */

/** Usage percentages that raise one alert each per quota month. */
export const QUOTA_ALERT_THRESHOLDS = [80, 90, 100] as const;
export type QuotaAlertThreshold = (typeof QUOTA_ALERT_THRESHOLDS)[number];

/** Notification type for the 80 / 90 / 100 % alerts. */
export const QUOTA_NEAR_LIMIT_TYPE = 'quota_near_limit';
/** Notification type for a booking refused because the quota is used up. */
export const QUOTA_EXCEEDED_TYPE = 'quota_exceeded';

/**
 * Bookings at which a threshold is reached, e.g. 80 % of 50 = 40.
 *
 * @param limit - Monthly booking limit (> 0).
 * @param threshold - Percentage.
 */
export function thresholdCount(limit: number, threshold: number): number {
  return Math.max(1, Math.ceil((limit * threshold) / 100));
}

/**
 * Highest threshold this booking pushed usage across, or null.
 *
 * Several bookings at once (multi-pick) can jump past 80 and 90 together; only
 * the highest is reported so the owner gets one message.
 *
 * @param before - Bookings in the month before this order.
 * @param after - Bookings in the month after this order.
 * @param limit - Monthly limit; null / ≤ 0 = unlimited, never alerts.
 */
export function crossedQuotaThreshold(before: number, after: number, limit: number | null): QuotaAlertThreshold | null {
  if (limit === null || !Number.isFinite(limit) || limit <= 0) return null;
  if (!(after > before)) return null;
  let crossed: QuotaAlertThreshold | null = null;
  for (const t of QUOTA_ALERT_THRESHOLDS) {
    const at = thresholdCount(limit, t);
    if (before < at && after >= at) crossed = t;
  }
  return crossed;
}

/** `yyyy-mm` of the quota month (the quota counts by `booking_date`). */
export function quotaPeriod(bookingDate: string): string {
  return bookingDate.slice(0, 7);
}

const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

/** "พ.ย. 2569" from "2026-11"; returns the input when it is not a month. */
export function quotaPeriodLabel(period: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (!m) return period;
  const month = THAI_MONTHS[Number(m[2]) - 1];
  return month ? `${month} ${Number(m[1]) + 543}` : period;
}

/**
 * Title + message for a threshold alert (notification centre and LINE).
 *
 * @param args.threshold - Threshold reached.
 * @param args.used - Bookings counted in the month.
 * @param args.limit - Monthly limit.
 * @param args.period - `yyyy-mm`.
 */
export function quotaThresholdText(args: { threshold: QuotaAlertThreshold; used: number; limit: number; period: string }) {
  const month = quotaPeriodLabel(args.period);
  const usage = `${args.used}/${args.limit} คิว`;
  if (args.threshold >= 100) {
    return {
      title: `โควต้าการจองเดือน ${month} เต็มแล้ว`,
      message: `ใช้ไป ${usage} — ลูกค้าจะจองคิวของเดือนนี้ไม่ได้จนกว่าจะอัปเกรดแพ็กเกจ`,
    };
  }
  return {
    title: `โควต้าการจองเดือน ${month} ใช้ไป ${args.threshold}%`,
    message: `ใช้ไป ${usage} เหลืออีก ${Math.max(0, args.limit - args.used)} คิว อัปเกรดแพ็กเกจก่อนเต็มเพื่อไม่ให้ลูกค้าจองไม่ได้`,
  };
}

/** Who was refused: a customer in LIFF or staff in the portal. */
export type QuotaRefusalSource = 'liff' | 'staff';

/**
 * Title + message for a refused booking.
 *
 * @param source - Who tried to book.
 * @param inactive - True when the shop is suspended rather than out of quota.
 */
export function quotaExceededText(source: QuotaRefusalSource, inactive = false) {
  const who = source === 'liff' ? 'ลูกค้าจองไม่ได้' : 'พนักงานสร้างคิวไม่ได้';
  if (inactive) {
    return {
      title: `${who} — แพ็กเกจถูกระงับ`,
      message: 'ระบบปฏิเสธการจองเพราะแพ็กเกจของร้านถูกระงับ กรุณาติดต่อผู้ดูแลระบบ',
    };
  }
  return {
    title: `${who} — โควต้าแพ็กเกจเต็ม`,
    message:
      source === 'liff'
        ? 'มีลูกค้าพยายามจองคิวแต่ระบบปฏิเสธเพราะโควต้าการจองของแพ็กเกจเต็มแล้ว อัปเกรดแพ็กเกจเพื่อเปิดรับการจองต่อ'
        : 'ระบบไม่ให้สร้างคิวเพิ่มเพราะโควต้าการจองของแพ็กเกจเต็มแล้ว อัปเกรดแพ็กเกจเพื่อเปิดรับการจองต่อ',
  };
}

/** Start of the Bangkok day containing `now`, as an ISO instant (UTC+7, no DST). */
export function bangkokDayStartIso(now: Date): string {
  const day = new Date(now.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
  return `${day}T00:00:00+07:00`;
}

/**
 * Plain LINE text for the owner: title, message and a link to the plan page.
 *
 * @param text - From `quotaThresholdText` / `quotaExceededText`.
 * @param shopName - Shown first so an owner of several shops knows which one.
 * @param appUrl - Base URL; omitted when not https.
 */
export function ownerQuotaLineText(text: { title: string; message: string }, shopName: string, appUrl?: string | null): string {
  const lines = [`[${shopName}] ${text.title}`, text.message];
  if (appUrl && /^https:\/\//.test(appUrl)) lines.push(`ดูแพ็กเกจ: ${appUrl.replace(/\/+$/, '')}/portal/settings`);
  return lines.join('\n');
}
