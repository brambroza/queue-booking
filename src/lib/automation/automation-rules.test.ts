import { describe, expect, it } from 'vitest';
import {
  addDays,
  daysBetween,
  decideWinback,
  expectedIntervalDays,
  graceDays,
  medianIntervalDays,
  summarizeWinbackPreview,
  WINBACK_MAX_INTERVAL_DAYS,
  WINBACK_MIN_INTERVAL_DAYS,
} from '@/lib/automation/visit-interval';
import { followupSelectionRange, followupTiming, normalizeReviewUrl } from '@/lib/automation/followup-window';
import { bangkokMonthStartIso, effectiveAutomationCap, remainingAutomationQuota, STARTER_AUTOMATION_CAP } from '@/lib/automation/cap';
import { pickAttributableSend, summarizeAutomationRoi, type SendForAttribution } from '@/lib/automation/attribution';

describe('date helpers', () => {
  it('counts days across months and years', () => {
    expect(daysBetween('2026-01-31', '2026-03-01')).toBe(29);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(daysBetween('2026-03-10', '2026-03-01')).toBe(-9);
    expect(addDays('2026-02-27', 3)).toBe('2026-03-02');
  });
});

describe('medianIntervalDays', () => {
  it('needs two distinct visit dates', () => {
    expect(medianIntervalDays([])).toBeNull();
    expect(medianIntervalDays(['2026-01-01', '2026-01-01'])).toBeNull();
  });

  it('takes the median gap regardless of order', () => {
    // gaps 30 and 29 → mean of the two middle values, rounded
    expect(medianIntervalDays(['2026-03-01', '2026-01-01', '2026-01-31'])).toBe(30);
  });

  it('uses the middle gap for an odd count', () => {
    // gaps 10, 20, 90 → 20
    expect(medianIntervalDays(['2026-01-01', '2026-01-11', '2026-01-31', '2026-05-01'])).toBe(20);
  });
});

describe('expectedIntervalDays', () => {
  it('falls back to the shop default for one visit', () => {
    expect(expectedIntervalDays(['2026-01-01'], 45)).toBe(45);
  });
  it('clamps outliers', () => {
    expect(expectedIntervalDays(['2026-01-01', '2026-01-02'], 30)).toBe(WINBACK_MIN_INTERVAL_DAYS);
    expect(expectedIntervalDays(['2025-01-01', '2026-01-01'], 30)).toBe(WINBACK_MAX_INTERVAL_DAYS);
  });
});

describe('decideWinback', () => {
  const base = { hasUpcoming: false, reachable: true, lastWinbackAt: null };
  // Monthly customer: last visit 2026-09-01, interval 31, grace 8 → due 2026-10-10.
  const monthly = ['2026-07-01', '2026-08-01', '2026-09-01'];

  it('sends when overdue', () => {
    const d = decideWinback('2026-10-12', { ...base, visitDates: monthly }, 30);
    expect(d.send).toBe(true);
    if (d.send) {
      expect(d.lastVisit).toBe('2026-09-01');
      expect(d.daysSince).toBe(41);
    }
  });

  it('waits until the grace period ends', () => {
    const d = decideWinback('2026-10-05', { ...base, visitDates: monthly }, 30);
    expect(d).toMatchObject({ send: false, reason: 'not_due' });
  });

  it('skips customers who already booked again', () => {
    expect(decideWinback('2026-10-12', { ...base, visitDates: monthly, hasUpcoming: true }, 30)).toMatchObject({ send: false, reason: 'has_upcoming' });
  });

  it('respects the cooldown', () => {
    expect(
      decideWinback('2026-10-12', { ...base, visitDates: monthly, lastWinbackAt: '2026-09-25T03:00:00Z' }, 30),
    ).toMatchObject({ send: false, reason: 'cooldown' });
    expect(decideWinback('2026-10-30', { ...base, visitDates: monthly, lastWinbackAt: '2026-09-25T03:00:00Z' }, 30).send).toBe(true);
  });

  it('stops nudging lapsed customers', () => {
    expect(decideWinback('2026-10-12', { ...base, visitDates: ['2026-01-01'] }, 30)).toMatchObject({ send: false, reason: 'lapsed' });
  });

  it('reports unreachable after due checks', () => {
    expect(decideWinback('2026-10-12', { ...base, visitDates: monthly, reachable: false }, 30)).toMatchObject({ send: false, reason: 'unreachable' });
  });

  it('grace scales with the interval', () => {
    expect(graceDays(7)).toBe(3);
    expect(graceDays(60)).toBe(15);
  });
});

describe('summarizeWinbackPreview', () => {
  it('counts overdue, reachable and baht, ignoring cooldown', () => {
    const monthly = ['2026-07-01', '2026-08-01', '2026-09-01'];
    const preview = summarizeWinbackPreview(
      '2026-10-12',
      [
        { visitDates: monthly, hasUpcoming: false, reachable: true, lastWinbackAt: '2026-10-01T00:00:00Z', avgSpend: 400 },
        { visitDates: monthly, hasUpcoming: false, reachable: false, lastWinbackAt: null, avgSpend: 300 },
        { visitDates: monthly, hasUpcoming: true, reachable: true, lastWinbackAt: null, avgSpend: 500 },
      ],
      30,
    );
    expect(preview).toEqual({ overdue: 2, reachable: 1, estimatedBaht: 400 });
  });
});

describe('followupTiming', () => {
  const now = new Date('2026-10-23T10:00:00Z');
  it('waits, then is due, then goes stale', () => {
    expect(followupTiming('2026-10-23T09:30:00Z', 60, now)).toBe('wait');
    expect(followupTiming('2026-10-23T08:00:00Z', 60, now)).toBe('due');
    expect(followupTiming('2026-10-21T08:00:00Z', 60, now)).toBe('stale');
    expect(followupTiming(null, 60, now)).toBe('stale');
  });

  it('selection range matches the timing rule', () => {
    const r = followupSelectionRange(60, now);
    expect(r.to).toBe('2026-10-23T09:00:00.000Z');
    expect(r.from).toBe('2026-10-22T09:00:00.000Z');
  });
});

describe('normalizeReviewUrl', () => {
  it('accepts https only', () => {
    expect(normalizeReviewUrl('  ')).toBeNull();
    expect(normalizeReviewUrl('https://g.page/r/abc/review')).toBe('https://g.page/r/abc/review');
    expect(normalizeReviewUrl('http://example.com')).toBeUndefined();
    expect(normalizeReviewUrl('javascript:alert(1)')).toBeUndefined();
    expect(normalizeReviewUrl('not a url')).toBeUndefined();
  });
});

describe('automation cap', () => {
  it('caps Starter and keeps paid plans at the shop value', () => {
    expect(effectiveAutomationCap('starter', 300)).toBe(STARTER_AUTOMATION_CAP);
    expect(effectiveAutomationCap(null, 50)).toBe(50);
    expect(effectiveAutomationCap('professional', 1000)).toBe(1000);
    expect(effectiveAutomationCap('professional', null)).toBe(300);
    expect(remainingAutomationQuota(100, 120)).toBe(0);
  });

  it('month start is Bangkok midnight on the 1st', () => {
    // 2026-11-01 01:00 Bangkok = 2026-10-31T18:00Z → already November.
    expect(bangkokMonthStartIso(new Date('2026-10-31T18:00:00Z'))).toBe('2026-10-31T17:00:00.000Z');
    expect(bangkokMonthStartIso(new Date('2026-10-15T00:00:00Z'))).toBe('2026-09-30T17:00:00.000Z');
  });
});

describe('attribution', () => {
  const sends: SendForAttribution[] = [
    { id: 'old', kind: 'winback', sent_at: '2026-09-01T03:00:00Z', status: 'sent', converted_booking_id: null },
    { id: 'recent', kind: 'followup', sent_at: '2026-10-20T03:00:00Z', status: 'sent', converted_booking_id: null },
    { id: 'failed', kind: 'winback', sent_at: '2026-10-22T03:00:00Z', status: 'failed', converted_booking_id: null },
    { id: 'used', kind: 'winback', sent_at: '2026-10-21T03:00:00Z', status: 'sent', converted_booking_id: 'b1' },
  ];

  it('credits the latest unused sent push within the window', () => {
    expect(pickAttributableSend(sends, new Date('2026-10-23T00:00:00Z'))).toBe('recent');
    expect(pickAttributableSend(sends, new Date('2026-12-01T00:00:00Z'))).toBeNull();
    expect(pickAttributableSend(sends, new Date('2026-08-01T00:00:00Z'))).toBeNull();
  });

  it('summarizes ROI per kind', () => {
    const roi = summarizeAutomationRoi([
      { kind: 'winback', status: 'sent', converted_booking_id: 'b1', revenue_estimate: '400.00' },
      { kind: 'winback', status: 'sent', converted_booking_id: null, revenue_estimate: null },
      { kind: 'followup', status: 'sent', converted_booking_id: 'b2', revenue_estimate: 250 },
      { kind: 'followup', status: 'failed', converted_booking_id: null, revenue_estimate: null },
    ]);
    expect(roi.winback).toEqual({ sent: 2, converted: 1, revenue: 400 });
    expect(roi.followup).toEqual({ sent: 1, converted: 1, revenue: 250 });
    expect(roi.total).toEqual({ sent: 3, converted: 2, revenue: 650 });
  });
});
