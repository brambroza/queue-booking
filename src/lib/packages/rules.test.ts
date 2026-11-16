import { describe, expect, it } from 'vitest';
import {
  formatPackageMinutes,
  isPackageUsable,
  packageChargeFor,
  packageCoversService,
  packageDbErrorCode,
  packageExpiryDate,
  packageSlotRate,
  parseUsageWindows,
  usageWindowsLabel,
} from './rules';

const PEAK = parseUsageWindows([
  { weekday: null, time_from: '08:00', time_to: '15:00', rate: 1 },
  { weekday: null, time_from: '15:00', time_to: '00:00', rate: 1.5 },
]);

describe('usage windows', () => {
  it('no windows = any time ×1', () => {
    expect(packageSlotRate([], '2026-11-16', '03:00')).toBe(1);
  });

  it('picks the window of the slot start', () => {
    expect(packageSlotRate(PEAK, '2026-11-16', '08:00')).toBe(1);
    expect(packageSlotRate(PEAK, '2026-11-16', '15:00')).toBe(1.5);
    expect(packageSlotRate(PEAK, '2026-11-16', '23:30')).toBe(1.5);
    expect(packageSlotRate(PEAK, '2026-11-16', '07:00')).toBeNull();
  });

  it('a day-specific window beats an every-day one', () => {
    const windows = parseUsageWindows([
      { weekday: null, time_from: '08:00', time_to: '00:00', rate: 1 },
      { weekday: 6, time_from: '08:00', time_to: '00:00', rate: 2 },
    ]);
    expect(packageSlotRate(windows, '2026-11-21', '10:00')).toBe(2); // Saturday
    expect(packageSlotRate(windows, '2026-11-20', '10:00')).toBe(1);
  });

  it('drops malformed windows and bad rates', () => {
    expect(parseUsageWindows([{ time_from: 'x', time_to: '10:00' }, null, 'a'])).toEqual([]);
    expect(parseUsageWindows([{ time_from: '08:00', time_to: '10:00', rate: -1 }])[0].rate).toBe(1);
    expect(parseUsageWindows('nope')).toEqual([]);
  });
});

describe('packageChargeFor', () => {
  it('sums slot minutes × rate per queue', () => {
    const charge = packageChargeFor(PEAK, [
      { date: '2026-11-16', startTime: '14:00', slotCount: 1, unitMinutes: 60 },
      { date: '2026-11-16', startTime: '15:00', slotCount: 1, unitMinutes: 60 },
    ]);
    expect(charge).toEqual({ ok: true, perQueue: [60, 90], minutes: 150 });
  });

  it('slot_count spans windows slot by slot', () => {
    const charge = packageChargeFor(PEAK, [{ date: '2026-11-16', startTime: '14:00', slotCount: 2, unitMinutes: 60 }]);
    expect(charge).toEqual({ ok: true, perQueue: [150], minutes: 150 });
  });

  it('refuses a slot outside every window', () => {
    expect(packageChargeFor(PEAK, [{ date: '2026-11-16', startTime: '07:00', slotCount: 1, unitMinutes: 60 }])).toEqual({
      ok: false,
      code: 'package_not_covered',
      time: '07:00',
    });
  });

  it('rounds fractional minutes up', () => {
    const windows = parseUsageWindows([{ weekday: null, time_from: '00:00', time_to: '00:00', rate: 1.25 }]);
    // 00:00–00:00 = the whole day.
    expect(packageSlotRate(windows, '2026-11-16', '03:00')).toBe(1.25);
    const w2 = parseUsageWindows([{ weekday: null, time_from: '06:00', time_to: '00:00', rate: 1.25 }]);
    expect(packageChargeFor(w2, [{ date: '2026-11-16', startTime: '09:00', slotCount: 1, unitMinutes: 45 }])).toEqual({ ok: true, perQueue: [57], minutes: 57 });
  });
});

describe('package state', () => {
  it('usable only when active, not expired and with minutes left', () => {
    const base = { status: 'active', remaining_minutes: 60, expires_on: '2026-11-30' };
    expect(isPackageUsable(base, '2026-11-30')).toBe(true);
    expect(isPackageUsable(base, '2026-12-01')).toBe(false);
    expect(isPackageUsable({ ...base, remaining_minutes: 0 }, '2026-11-16')).toBe(false);
    expect(isPackageUsable({ ...base, status: 'pending_payment' }, '2026-11-16')).toBe(false);
    expect(isPackageUsable({ ...base, expires_on: null }, '2030-01-01')).toBe(true);
  });

  it('expiry is inclusive', () => {
    expect(packageExpiryDate('2026-11-16', 1)).toBe('2026-11-16');
    expect(packageExpiryDate('2026-11-16', 30)).toBe('2026-12-15');
    expect(packageExpiryDate('2026-11-16', null)).toBeNull();
  });

  it('covers every service when no list', () => {
    expect(packageCoversService(null, 'a')).toBe(true);
    expect(packageCoversService([], 'a')).toBe(true);
    expect(packageCoversService(['b'], 'a')).toBe(false);
  });
});

describe('labels', () => {
  it('formats minutes in Thai', () => {
    expect(formatPackageMinutes(600)).toBe('10 ชม.');
    expect(formatPackageMinutes(450)).toBe('7 ชม. 30 นาที');
    expect(formatPackageMinutes(45)).toBe('45 นาที');
  });

  it('describes windows', () => {
    expect(usageWindowsLabel([])).toBe('ใช้ได้ทุกช่วงเวลา');
    expect(usageWindowsLabel(PEAK)).toBe('08:00–15:00 · 15:00–00:00 (ตัด ×1.5)');
  });

  it('maps DB errors', () => {
    expect(packageDbErrorCode('ERROR: package_insufficient')).toBe('package_insufficient');
    expect(packageDbErrorCode('other')).toBeNull();
  });
});
