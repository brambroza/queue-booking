import { describe, expect, it } from 'vitest';
import { resourceHistoryBadge, sortResourcesByHistory, summarizeResourceHistory } from './resource-history';

const bookings = [
  { resource_id: 'court-1', booking_date: '2026-09-01', start_time: '18:00', status: 'completed' },
  { resource_id: 'court-1', booking_date: '2026-09-08', start_time: '18:00', status: 'completed' },
  { resource_id: 'court-3', booking_date: '2026-09-15', start_time: '19:00', status: 'confirmed' },
  { resource_id: 'court-2', booking_date: '2026-09-20', start_time: '19:00', status: 'cancelled' },
  { resource_id: null, booking_date: '2026-09-21', start_time: '19:00', status: 'completed' },
];

describe('summarizeResourceHistory', () => {
  it('counts per resource and ignores cancelled / unassigned bookings', () => {
    const h = summarizeResourceHistory(bookings);
    expect(h.byResource.get('court-1')?.count).toBe(2);
    expect(h.byResource.get('court-3')?.count).toBe(1);
    expect(h.byResource.has('court-2')).toBe(false);
    expect(h.latestResourceId).toBe('court-3');
  });

  it('breaks same-day ties by start time', () => {
    const h = summarizeResourceHistory([
      { resource_id: 'a', booking_date: '2026-09-15', start_time: '09:00', status: 'completed' },
      { resource_id: 'b', booking_date: '2026-09-15', start_time: '17:00', status: 'completed' },
    ]);
    expect(h.latestResourceId).toBe('b');
  });

  it('handles no history', () => {
    const h = summarizeResourceHistory([]);
    expect(h.byResource.size).toBe(0);
    expect(h.latestResourceId).toBeNull();
  });
});

describe('sortResourcesByHistory', () => {
  const resources = [{ id: 'court-1' }, { id: 'court-2' }, { id: 'court-3' }, { id: 'court-4' }];

  it('puts familiar resources first, most recent on top, rest in original order', () => {
    const sorted = sortResourcesByHistory(resources, summarizeResourceHistory(bookings));
    expect(sorted.map((r) => r.id)).toEqual(['court-3', 'court-1', 'court-2', 'court-4']);
  });

  it('is the identity without history', () => {
    const sorted = sortResourcesByHistory(resources, summarizeResourceHistory([]));
    expect(sorted.map((r) => r.id)).toEqual(['court-1', 'court-2', 'court-3', 'court-4']);
  });
});

describe('resourceHistoryBadge', () => {
  const h = summarizeResourceHistory(bookings);

  it('flags the most recent resource', () => {
    expect(resourceHistoryBadge('court-3', h)).toBe('จองล่าสุด');
  });

  it('shows the count for older favourites', () => {
    expect(resourceHistoryBadge('court-1', h)).toBe('เคยจอง 2 ครั้ง');
  });

  it('combines both when the latest was booked repeatedly', () => {
    const repeat = summarizeResourceHistory([bookings[0], bookings[1]]);
    expect(resourceHistoryBadge('court-1', repeat)).toBe('จองล่าสุด • เคยจอง 2 ครั้ง');
  });

  it('returns nothing for a never-booked resource', () => {
    expect(resourceHistoryBadge('court-4', h)).toBeUndefined();
  });
});
