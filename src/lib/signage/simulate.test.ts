import { describe, expect, it } from 'vitest';
import type { SignageData, SignagePerson } from './types';
import { advanceSignage, nextQueueNumber } from './simulate';

function person(id: string, overrides: Partial<SignagePerson> = {}): SignagePerson {
  return {
    id,
    queue_number: id.toUpperCase(),
    status: 'waiting',
    start_time: '14:00',
    end_time: null,
    called_at: null,
    customer_name: null,
    service_name: 'ตัดผม',
    resource_name: null,
    ...overrides,
  };
}

function board(overrides: Partial<SignageData> = {}): SignageData {
  return {
    date: '2026-09-10',
    generated_at: '2026-09-10T03:42:00.000Z',
    shop: { name: 'ร้านตัวอย่าง', logo_url: null, demo_mode_enabled: false },
    branch: null,
    qr_url: null,
    now_calling: [person('a1', { status: 'called', resource_name: 'ช่างต้น' }), person('a0', { status: 'serving', resource_name: 'ช่างบอล' })],
    next_queue: [person('a2'), person('a3')],
    waiting_queue: [person('a4', { queue_number: 'A04', start_time: '15:00' })],
    totals: { waiting: 3, calling: 2, served_today: 5 },
    resources: [{ id: 'r1', name: 'ช่างต้น' }, { id: 'r2', name: 'ช่างบอล' }, { id: 'r3', name: 'ช่างเอก' }],
    schedule: [],
    ...overrides,
  } as SignageData;
}

describe('nextQueueNumber', () => {
  it('keeps prefix and padding', () => {
    expect(nextQueueNumber('A17')).toBe('A18');
    expect(nextQueueNumber('08')).toBe('09');
    expect(nextQueueNumber('T099')).toBe('T100');
  });
  it('still answers for a number with no digits', () => {
    expect(nextQueueNumber('VIP')).toBe('VIP1');
  });
});

describe('advanceSignage', () => {
  it('calls the head of the line to a free service point on an even tick', () => {
    const next = advanceSignage(board(), 0);
    expect(next.now_calling.map((p) => [p.id, p.status, p.resource_name])).toEqual([
      ['a2', 'called', 'ช่างเอก'],
      ['a1', 'serving', 'ช่างต้น'],
      ['a0', 'serving', 'ช่างบอล'],
    ]);
    expect(next.totals).toEqual({ waiting: 3, calling: 3, served_today: 5 });
  });

  it('adds a new customer at the tail and keeps the size of both lists', () => {
    const next = advanceSignage(board(), 0);
    expect(next.next_queue.map((p) => p.id)).toEqual(['a3', 'a4']);
    expect(next.waiting_queue).toEqual([expect.objectContaining({ id: 'sim-0', queue_number: 'A05', start_time: '15:15', status: 'waiting' })]);
  });

  it('lets the longest served customer leave on an odd tick', () => {
    const next = advanceSignage(board(), 1);
    expect(next.now_calling.map((p) => p.id)).toEqual(['a1']);
    expect(next.totals).toEqual({ waiting: 3, calling: 1, served_today: 6 });
  });

  it('finishes someone when every service point is busy, whatever the tick', () => {
    const full = advanceSignage(board(), 0);
    expect(advanceSignage(full, 2).now_calling).toHaveLength(2);
  });

  it('calls straight away when nobody is being served', () => {
    const next = advanceSignage(board({ now_calling: [], totals: { waiting: 3, calling: 0, served_today: 5 } }), 1);
    expect(next.now_calling.map((p) => p.id)).toEqual(['a2']);
  });

  it('leaves an empty shop alone', () => {
    const empty = board({ now_calling: [], next_queue: [], waiting_queue: [], totals: { waiting: 0, calling: 0, served_today: 5 } });
    expect(advanceSignage(empty, 0)).toBe(empty);
  });

  it('does not modify its input and never repeats an id over many steps', () => {
    const start = board();
    const copy = JSON.parse(JSON.stringify(start));
    let data = start;
    for (let tick = 0; tick < 40; tick += 1) {
      data = advanceSignage(data, tick);
      const ids = [...data.now_calling, ...data.next_queue, ...data.waiting_queue].map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
      const points = data.now_calling.map((p) => p.resource_name);
      expect(new Set(points).size).toBe(points.length);
      expect(data.totals.calling).toBe(data.now_calling.length);
    }
    expect(start).toEqual(copy);
  });
});
