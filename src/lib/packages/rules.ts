/**
 * Prepaid hour packages — pure rules (no DB). Shared by `/book`, the portal
 * and LIFF so all three agree on how many minutes a booking costs.
 *
 * - A package holds minutes. A booked slot costs `ceil(slot minutes × rate)`,
 *   where the rate comes from the first usage window that covers the slot's
 *   start time (e.g. 08:00–15:00 ×1, 15:00–00:00 ×1.5).
 * - No windows = any time at ×1. A slot outside every window cannot be paid
 *   with the package.
 * - `service_ids` empty / null = every service.
 * - `expires_on` is the last usable day (inclusive, Bangkok date).
 */

import { timeToMinutes } from '@/lib/booking/multi-slot';
import { ruleRange, weekdayOf } from '@/lib/pricing/quote';

export type UsageWindow = {
  /** 0 = Sunday … 6 = Saturday; null = every day. */
  weekday: number | null;
  time_from: string;
  /** Exclusive; `00:00` = end of day. */
  time_to: string;
  /** Minutes deducted per minute booked (1 = normal, 1.5 = peak). */
  rate: number;
};

export type PackageStatus = 'pending_payment' | 'awaiting_verification' | 'active' | 'rejected' | 'cancelled';

/** The fields of a `customer_packages` row the rules need. */
export type CustomerPackageLike = {
  status: string;
  remaining_minutes: number;
  expires_on: string | null;
  service_ids: string[] | null;
  usage_windows: unknown;
};

export const PACKAGE_INSUFFICIENT_CODE = 'package_insufficient';
export const PACKAGE_UNAVAILABLE_CODE = 'package_unavailable';
export const PACKAGE_NOT_COVERED_CODE = 'package_not_covered';

/** Max windows per package. */
export const MAX_USAGE_WINDOWS = 20;

/** Longest package description (customer-facing terms) a shop may save. */
export const MAX_PACKAGE_DESCRIPTION = 2000;

/**
 * Parse `usage_windows` jsonb defensively; malformed entries are dropped.
 *
 * @param value - Stored value.
 */
export function parseUsageWindows(value: unknown): UsageWindow[] {
  if (!Array.isArray(value)) return [];
  const out: UsageWindow[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const w = raw as Record<string, unknown>;
    const weekday = w.weekday === null || w.weekday === undefined || w.weekday === '' ? null : Number(w.weekday);
    const rate = Number(w.rate ?? 1);
    const window: UsageWindow = {
      weekday: weekday !== null && Number.isInteger(weekday) && weekday >= 0 && weekday <= 6 ? weekday : null,
      time_from: String(w.time_from ?? ''),
      time_to: String(w.time_to ?? ''),
      rate: Number.isFinite(rate) && rate > 0 ? rate : 1,
    };
    if (ruleRange(window)) out.push(window);
  }
  return out;
}

/**
 * Rate of one slot under a package's windows, or null when the package cannot pay for it.
 *
 * @param windows - Parsed windows (empty = any time ×1).
 * @param date - `YYYY-MM-DD`.
 * @param startTime - `HH:MM[:SS]`.
 */
export function packageSlotRate(windows: readonly UsageWindow[], date: string, startTime: string): number | null {
  if (windows.length === 0) return 1;
  const minutes = timeToMinutes(startTime);
  if (minutes === null) return null;
  const weekday = weekdayOf(date);
  // A day-specific window beats an every-day one.
  const matches = windows.filter((w) => {
    if (w.weekday !== null && w.weekday !== weekday) return false;
    const range = ruleRange(w);
    return Boolean(range && minutes >= range[0] && minutes < range[1]);
  });
  if (matches.length === 0) return null;
  const specific = matches.find((w) => w.weekday !== null);
  return (specific ?? matches[0]).rate;
}

/** One queue to be paid with a package. */
export type PackageQueue = {
  date: string;
  startTime: string;
  slotCount: number;
  unitMinutes: number;
};

export type PackageCharge =
  | { ok: true; perQueue: number[]; minutes: number }
  | { ok: false; code: typeof PACKAGE_NOT_COVERED_CODE; time: string };

/**
 * Minutes a booking order takes from a package.
 *
 * @param windows - Parsed usage windows.
 * @param queues - Queues of the order.
 */
export function packageChargeFor(windows: readonly UsageWindow[], queues: readonly PackageQueue[]): PackageCharge {
  const perQueue: number[] = [];
  for (const queue of queues) {
    const start = timeToMinutes(queue.startTime);
    if (start === null) return { ok: false, code: PACKAGE_NOT_COVERED_CODE, time: queue.startTime.slice(0, 5) };
    const unit = Math.max(1, Math.floor(queue.unitMinutes));
    let total = 0;
    for (let i = 0; i < Math.max(1, queue.slotCount); i++) {
      const at = start + unit * i;
      const time = `${String(Math.floor(at / 60) % 24).padStart(2, '0')}:${String(at % 60).padStart(2, '0')}`;
      const rate = packageSlotRate(windows, queue.date, time);
      if (rate === null) return { ok: false, code: PACKAGE_NOT_COVERED_CODE, time };
      total += Math.ceil(unit * rate);
    }
    perQueue.push(total);
  }
  return { ok: true, perQueue, minutes: perQueue.reduce((a, b) => a + b, 0) };
}

/**
 * Whether a package can pay for a service.
 *
 * @param serviceIds - `service_ids` of the package (null / empty = all).
 * @param serviceId - Booked service.
 */
export function packageCoversService(serviceIds: readonly string[] | null | undefined, serviceId: string): boolean {
  return !serviceIds || serviceIds.length === 0 || serviceIds.includes(serviceId);
}

/**
 * Whether a package is usable today (active, not expired, minutes left).
 *
 * @param pkg - Package row.
 * @param today - Bangkok `YYYY-MM-DD`.
 */
export function isPackageUsable(pkg: Pick<CustomerPackageLike, 'status' | 'remaining_minutes' | 'expires_on'>, today: string): boolean {
  if (pkg.status !== 'active') return false;
  if (!(pkg.remaining_minutes > 0)) return false;
  return !pkg.expires_on || pkg.expires_on >= today;
}

/**
 * Last usable day for a package activated on `start` (inclusive).
 *
 * @param start - Activation date `YYYY-MM-DD`.
 * @param validDays - Days valid; null = no expiry.
 */
export function packageExpiryDate(start: string, validDays: number | null | undefined): string | null {
  if (!validDays || validDays < 1) return null;
  const [y, m, d] = start.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + validDays - 1));
  return date.toISOString().slice(0, 10);
}

/**
 * "7 ชม. 30 นาที" / "45 นาที" / "10 ชม.".
 *
 * @param minutes - Minutes.
 */
export function formatPackageMinutes(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} นาที`;
  return m === 0 ? `${h} ชม.` : `${h} ชม. ${m} นาที`;
}

/** Thai message for a package that has too few minutes. */
export function packageInsufficientMessage(needed: number, remaining: number): string {
  return `ชั่วโมงในแพ็กเกจไม่พอ (ต้องใช้ ${formatPackageMinutes(needed)} เหลือ ${formatPackageMinutes(remaining)})`;
}

/** Thai message for a slot the package does not cover. */
export function packageNotCoveredMessage(time: string): string {
  return `แพ็กเกจนี้ใช้กับรอบ ${time} ไม่ได้ (นอกช่วงเวลาที่ร้านกำหนด) กรุณาเลือกวิธีชำระอื่น`;
}

/**
 * Thai one-liner of the windows, e.g. "08:00–15:00 ×1 · 15:00–00:00 ×1.5";
 * "ใช้ได้ทุกช่วงเวลา" when there are none.
 */
export function usageWindowsLabel(windows: readonly UsageWindow[]): string {
  if (windows.length === 0) return 'ใช้ได้ทุกช่วงเวลา';
  const days = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
  return windows
    .map((w) => `${w.weekday === null ? '' : `${days[w.weekday]} `}${w.time_from.slice(0, 5)}–${w.time_to.slice(0, 5)}${w.rate !== 1 ? ` (ตัด ×${w.rate})` : ''}`)
    .join(' · ');
}

/** Thai label of a package status. */
export const PACKAGE_STATUS_LABEL: Record<PackageStatus, string> = {
  pending_payment: 'รอชำระเงิน',
  awaiting_verification: 'รอตรวจสลิป',
  active: 'ใช้งานได้',
  rejected: 'สลิปไม่ผ่าน',
  cancelled: 'ยกเลิกแล้ว',
};

/**
 * Map a DB error from the balance functions to a code, or null.
 *
 * @param message - Postgres error message.
 */
export function packageDbErrorCode(message: string | null | undefined): 'package_insufficient' | 'package_unavailable' | 'package_negative' | null {
  const text = String(message ?? '');
  if (text.includes('package_insufficient')) return 'package_insufficient';
  if (text.includes('package_unavailable')) return 'package_unavailable';
  if (text.includes('package_negative')) return 'package_negative';
  return null;
}
