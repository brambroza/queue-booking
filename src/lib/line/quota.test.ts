import { describe, expect, it } from 'vitest';
import {
  isLineDeliveryPaused,
  isLineQuotaExceeded,
  lineQuotaPeriod,
  lineQuotaThreshold,
  lineQuotaWarnText,
  parseLineQuota,
} from './quota';

describe('isLineQuotaExceeded', () => {
  it('matches the monthly-limit 429 only', () => {
    expect(isLineQuotaExceeded(429, '{"message":"You have reached your monthly limit."}')).toBe(true);
    expect(isLineQuotaExceeded(429, '{"message":"Too Many Requests"}')).toBe(false);
    expect(isLineQuotaExceeded(400, 'monthly limit')).toBe(false);
  });
});

describe('parseLineQuota', () => {
  it('combines the two LINE responses', () => {
    expect(parseLineQuota({ type: 'limited', value: 200 }, { totalUsage: 150 })).toEqual({ type: 'limited', limit: 200, used: 150 });
    expect(parseLineQuota({ type: 'none' }, { totalUsage: 9 })).toEqual({ type: 'none', limit: null, used: 9 });
  });
  it('returns null on garbage', () => {
    expect(parseLineQuota(null, null)).toBeNull();
    expect(parseLineQuota({ type: 'weird' }, {})).toBeNull();
  });
});

describe('lineQuotaThreshold', () => {
  it('reports the highest threshold reached', () => {
    expect(lineQuotaThreshold({ type: 'limited', limit: 200, used: 159 })).toBeNull();
    expect(lineQuotaThreshold({ type: 'limited', limit: 200, used: 160 })).toBe(80);
    expect(lineQuotaThreshold({ type: 'limited', limit: 200, used: 200 })).toBe(100);
    expect(lineQuotaThreshold({ type: 'none', limit: null, used: 5000 })).toBeNull();
  });
});

describe('isLineDeliveryPaused', () => {
  const now = new Date('2026-11-11T03:00:00Z');
  it('is true for a stamp in the same Bangkok month and false after the reset', () => {
    expect(lineQuotaPeriod(now)).toBe('2026-11');
    expect(isLineDeliveryPaused('2026-11-10T16:59:00Z', now)).toBe(true);
    expect(isLineDeliveryPaused('2026-10-31T16:59:00Z', now)).toBe(false);
    expect(isLineDeliveryPaused(null, now)).toBe(false);
  });
});

describe('lineQuotaWarnText', () => {
  it('words 80 % and 100 % differently', () => {
    expect(lineQuotaWarnText(80, { type: 'limited', limit: 200, used: 160 }).title).toContain('80%');
    expect(lineQuotaWarnText(100, { type: 'limited', limit: 200, used: 200 }).title).toContain('หมดโควตา');
  });
});
