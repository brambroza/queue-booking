import { describe, expect, it } from 'vitest';
import type { SignagePerson } from './types';
import { bangkokMinutes, buildStations, buildTimeline, diffScene, isIdle, minutesUntil, toLabel, toMinutes, waitingLine } from './scene';

function person(id: string, overrides: Partial<SignagePerson> = {}): SignagePerson {
  return {
    id,
    queue_number: id.toUpperCase(),
    status: 'confirmed',
    start_time: '14:00',
    end_time: '15:00',
    called_at: null,
    customer_name: null,
    service_name: null,
    resource_name: 'สนาม 1',
    ...overrides,
  };
}

describe('toMinutes / toLabel', () => {
  it('reads HH:MM and ignores seconds', () => {
    expect(toMinutes('09:30')).toBe(570);
    expect(toMinutes('09:30:00')).toBe(570);
  });
  it('rejects missing or impossible times', () => {
    expect(toMinutes(null)).toBeNull();
    expect(toMinutes('')).toBeNull();
    expect(toMinutes('25:00')).toBeNull();
    expect(toMinutes('10:75')).toBeNull();
  });
  it('formats and clamps to one day', () => {
    expect(toLabel(570)).toBe('09:30');
    expect(toLabel(-5)).toBe('00:00');
    expect(toLabel(24 * 60 + 30)).toBe('24:00');
  });
});

describe('bangkokMinutes', () => {
  it('uses Bangkok time whatever the device timezone is', () => {
    expect(bangkokMinutes(new Date('2026-09-28T06:06:00.000Z'))).toBe(13 * 60 + 6);
  });
  it('wraps past midnight', () => {
    expect(bangkokMinutes(new Date('2026-09-28T17:15:00.000Z'))).toBe(15);
  });
});

describe('minutesUntil', () => {
  it('counts down to the appointment', () => {
    expect(minutesUntil({ start_time: '14:00' }, 13 * 60 + 35)).toBe(25);
  });
  it('never goes negative once the time has come', () => {
    expect(minutesUntil({ start_time: '14:00' }, 15 * 60)).toBe(0);
  });
  it('has no answer without a start time', () => {
    expect(minutesUntil({ start_time: null }, 600)).toBeNull();
  });
});

describe('buildTimeline', () => {
  const now = 13 * 60 + 6;
  const resources = [{ id: 'r1', name: 'สนาม 1' }, { id: 'r2', name: 'สนาม 2' }];

  it('puts each booking on its own service point with a state', () => {
    const t = buildTimeline(
      {
        resources,
        schedule: [
          person('a', { start_time: '12:00', end_time: '13:00', status: 'completed' }),
          person('b', { start_time: '13:00', end_time: '14:00', status: 'serving' }),
          person('c', { start_time: '13:30', end_time: '14:30', resource_name: 'สนาม 2' }),
          person('d', { start_time: '16:00', end_time: '17:00', resource_name: 'สนาม 2' }),
        ],
      },
      now,
      4,
    );
    expect(t.rows.map((r) => r.name)).toEqual(['สนาม 1', 'สนาม 2']);
    expect(t.rows[0].blocks.map((b) => b.state)).toEqual(['done', 'now']);
    expect(t.rows[1].blocks.map((b) => b.state)).toEqual(['soon', 'later']);
  });

  it('offers free time only from the next half hour on', () => {
    const t = buildTimeline({ resources, schedule: [person('a', { start_time: '15:00', end_time: '16:00' })] }, now, 4);
    expect(t.rows[0].gaps[0]).toEqual({ start: 13 * 60 + 30, end: 15 * 60 });
  });

  it('does not offer gaps shorter than half an hour', () => {
    const t = buildTimeline(
      { resources: [resources[0]], schedule: [person('a', { start_time: '13:45', end_time: '14:45' }), person('b', { start_time: '15:00', end_time: '17:00' })] },
      now,
      4,
    );
    expect(t.rows[0].gaps).toEqual([]);
  });

  it('gives a booking without an end time the default length', () => {
    const t = buildTimeline({ resources: [resources[0]], schedule: [person('a', { start_time: '14:00', end_time: null })] }, now, 4);
    expect(t.rows[0].blocks[0].end - t.rows[0].blocks[0].start).toBe(30);
  });

  it('adds a row for a service point that only exists on a booking', () => {
    const t = buildTimeline({ resources: [resources[0]], schedule: [person('a', { resource_name: 'สนามเก่า' })] }, now, 4);
    expect(t.rows.map((r) => r.name)).toEqual(['สนาม 1', 'สนามเก่า']);
  });

  it('leaves out bookings with no service point or no time', () => {
    const t = buildTimeline({ resources, schedule: [person('a', { resource_name: null }), person('b', { start_time: null })] }, now, 4);
    expect(t.rows.every((r) => r.blocks.length === 0)).toBe(true);
  });

  it('keeps a readable axis for an empty day and stays inside one day', () => {
    const empty = buildTimeline({ resources, schedule: [] }, now, 4);
    expect(empty.end - empty.start).toBeGreaterThanOrEqual(4 * 60);
    const late = buildTimeline({ resources, schedule: [] }, 23 * 60 + 30, 4);
    expect(late.end).toBe(24 * 60);
    expect(late.start).toBeLessThanOrEqual(20 * 60);
  });

  it('shows no more rows than the template can fit', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ id: `r${i}`, name: `สนาม ${i + 1}` }));
    expect(buildTimeline({ resources: many, schedule: [] }, now, 6).rows).toHaveLength(6);
  });
});

describe('buildStations', () => {
  const resources = [{ id: 'r1', name: 'เก้าอี้ 1' }, { id: 'r2', name: 'เก้าอี้ 2' }, { id: 'r3', name: 'เก้าอี้ 3' }];

  it('marks who is at each service point and leaves the rest free', () => {
    const stations = buildStations({ resources, now_calling: [person('a', { resource_name: 'เก้าอี้ 2', status: 'called' })] }, 4);
    expect(stations.map((s) => s.occupant?.id ?? null)).toEqual([null, 'a', null]);
  });

  it('falls back to the called queues when the shop has no service points', () => {
    const stations = buildStations({ resources: [], now_calling: [person('a', { resource_name: 'โต๊ะ 7', status: 'called' })] }, 4);
    expect(stations).toEqual([expect.objectContaining({ name: 'โต๊ะ 7' })]);
  });

  it('keeps busy points on screen when there are too many to show', () => {
    const stations = buildStations({ resources, now_calling: [person('a', { resource_name: 'เก้าอี้ 3', status: 'serving' })] }, 2);
    expect(stations.map((s) => s.name)).toEqual(['เก้าอี้ 3', 'เก้าอี้ 1']);
  });

  it('ignores a called queue that has no service point', () => {
    expect(buildStations({ resources: [], now_calling: [person('a', { resource_name: null })] }, 4)).toEqual([]);
  });
});

describe('waitingLine / isIdle', () => {
  it('joins next and waiting in calling order', () => {
    expect(waitingLine({ next_queue: [person('a')], waiting_queue: [person('b')] }).map((p) => p.id)).toEqual(['a', 'b']);
  });
  it('is idle only with nobody called and nobody waiting', () => {
    const totals = { waiting: 0, calling: 0, served_today: 12 };
    expect(isIdle({ now_calling: [], totals })).toBe(true);
    expect(isIdle({ now_calling: [person('a')], totals })).toBe(false);
    expect(isIdle({ now_calling: [], totals: { ...totals, waiting: 3 } })).toBe(false);
  });
});

describe('diffScene', () => {
  const base = { now_calling: [person('a')], next_queue: [person('b')], waiting_queue: [person('c')] };

  it('reports nothing on the first poll', () => {
    expect(diffScene(null, base)).toEqual({ entered: [], left: [], called: [] });
  });

  it('sees a new queue, a finished one and a call', () => {
    const next = { now_calling: [person('b')], next_queue: [person('c')], waiting_queue: [person('d')] };
    expect(diffScene(base, next)).toEqual({ entered: ['d'], left: ['a'], called: ['b'] });
  });

  it('does not count a queue that stays called as called again', () => {
    expect(diffScene(base, base).called).toEqual([]);
  });
});
