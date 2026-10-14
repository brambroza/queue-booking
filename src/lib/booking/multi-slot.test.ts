import { describe, expect, it } from 'vitest';
import {
  bookingDurationMinutes,
  bookingEndTime,
  bookingTimeLabel,
  consecutiveSlotsOpen,
  isExtendableStatus,
  isSlotCountAllowed,
  maxOpenSlotCount,
  maxSlotCount,
  minSlotCount,
  nextSlotSelection,
  selectedSlotTimes,
  timeToMinutes,
} from './multi-slot';

const flexible = { booking_mode: 'flexible_duration', duration_minutes: 60, min_duration_minutes: 60, max_duration_minutes: 180 };

const grid = (entries: Array<[string, number, boolean?]>) =>
  entries.map(([slot_time, remaining_capacity, is_past]) => ({ slot_time, remaining_capacity, is_past: Boolean(is_past) }));

describe('maxSlotCount / minSlotCount', () => {
  it('is 1 for non-flexible services', () => {
    expect(maxSlotCount({ booking_mode: 'fixed_slot', duration_minutes: 60, max_duration_minutes: 180 })).toBe(1);
    expect(maxSlotCount({ duration_minutes: 60 })).toBe(1);
  });

  it('floors max duration by slot length', () => {
    expect(maxSlotCount(flexible)).toBe(3);
    expect(maxSlotCount({ ...flexible, max_duration_minutes: 150 })).toBe(2);
  });

  it('is 1 when max is missing or not longer than one slot', () => {
    expect(maxSlotCount({ ...flexible, max_duration_minutes: null })).toBe(1);
    expect(maxSlotCount({ ...flexible, max_duration_minutes: 60 })).toBe(1);
  });

  it('caps at 24', () => {
    expect(maxSlotCount({ ...flexible, duration_minutes: 5, max_duration_minutes: 1000 })).toBe(24);
  });

  it('rounds min duration up', () => {
    expect(minSlotCount({ ...flexible, min_duration_minutes: 90 })).toBe(2);
    expect(minSlotCount({ ...flexible, min_duration_minutes: null })).toBe(1);
  });
});

describe('isSlotCountAllowed', () => {
  it('always allows one slot', () => {
    expect(isSlotCountAllowed({ duration_minutes: 60 }, 1)).toBe(true);
    expect(isSlotCountAllowed({ ...flexible, min_duration_minutes: 120 }, 1)).toBe(true);
  });

  it('respects min and max', () => {
    expect(isSlotCountAllowed(flexible, 3)).toBe(true);
    expect(isSlotCountAllowed(flexible, 4)).toBe(false);
    expect(isSlotCountAllowed({ ...flexible, min_duration_minutes: 180 }, 2)).toBe(false);
  });

  it('refuses multi-slot on a fixed service and bad numbers', () => {
    expect(isSlotCountAllowed({ duration_minutes: 60 }, 2)).toBe(false);
    expect(isSlotCountAllowed(flexible, 0)).toBe(false);
    expect(isSlotCountAllowed(flexible, 1.5)).toBe(false);
  });
});

describe('bookingEndTime', () => {
  it('adds count slots', () => {
    expect(bookingEndTime('18:00', 60, 2)).toBe('20:00:00');
    expect(bookingEndTime('09:30:00', 45, 3)).toBe('11:45:00');
  });

  it('refuses running to or past midnight', () => {
    expect(bookingEndTime('23:00', 60, 1)).toBeNull();
    expect(bookingEndTime('22:30', 60, 2)).toBeNull();
  });

  it('refuses malformed times', () => {
    expect(bookingEndTime('7pm', 60, 1)).toBeNull();
  });
});

describe('consecutiveSlotsOpen', () => {
  const slots = grid([
    ['17:00:00', 1, true],
    ['18:00:00', 1],
    ['19:00:00', 1],
    ['20:00:00', 0],
    ['21:00:00', 1],
  ]);

  it('accepts a free run', () => {
    expect(consecutiveSlotsOpen(slots, '18:00', 60, 2)).toBe(true);
  });

  it('refuses a run through a full slot', () => {
    expect(consecutiveSlotsOpen(slots, '19:00', 60, 2)).toBe(false);
  });

  it('refuses a past slot', () => {
    expect(consecutiveSlotsOpen(slots, '17:00', 60, 2)).toBe(false);
  });

  it('refuses a run past the last offered slot', () => {
    expect(consecutiveSlotsOpen(slots, '21:00', 60, 2)).toBe(false);
  });

  it('works with an interval shorter than the slot length', () => {
    const half = grid([['18:00', 1], ['18:30', 1], ['19:00', 1]]);
    expect(consecutiveSlotsOpen(half, '18:00', 60, 2)).toBe(true);
    expect(consecutiveSlotsOpen(half, '18:30', 60, 2)).toBe(false);
  });
});

describe('maxOpenSlotCount', () => {
  it('stops at the first gap', () => {
    const slots = grid([['18:00', 1], ['19:00', 1], ['20:00', 0], ['21:00', 1]]);
    expect(maxOpenSlotCount(flexible, slots, '18:00')).toBe(2);
  });

  it('stops at the service max', () => {
    const slots = grid([['10:00', 1], ['11:00', 1], ['12:00', 1], ['13:00', 1]]);
    expect(maxOpenSlotCount(flexible, slots, '10:00')).toBe(3);
  });

  it('is 1 for a fixed service', () => {
    const slots = grid([['10:00', 1], ['11:00', 1]]);
    expect(maxOpenSlotCount({ duration_minutes: 60 }, slots, '10:00')).toBe(1);
  });
});

describe('bookingDurationMinutes', () => {
  it('reads end - start', () => {
    expect(bookingDurationMinutes('18:00:00', '20:00:00', 60)).toBe(120);
  });

  it('falls back when end is missing or not after start', () => {
    expect(bookingDurationMinutes('18:00:00', null, 60)).toBe(60);
    expect(bookingDurationMinutes('18:00:00', '18:00:00', 45)).toBe(45);
  });
});

describe('misc', () => {
  it('timeToMinutes', () => {
    expect(timeToMinutes('01:30')).toBe(90);
    expect(timeToMinutes('25:00')).toBeNull();
  });

  it('isExtendableStatus', () => {
    expect(isExtendableStatus('serving')).toBe(true);
    expect(isExtendableStatus('completed')).toBe(false);
    expect(isExtendableStatus('cancelled')).toBe(false);
  });

  it('bookingTimeLabel', () => {
    expect(bookingTimeLabel('18:00:00', '20:00:00', 2)).toBe('18:00–20:00');
    expect(bookingTimeLabel('18:00:00', '19:00:00', 1)).toBe('18:00');
  });
});

describe('nextSlotSelection', () => {
  it('starts a pick on the first tap', () => {
    expect(nextSlotSelection(null, '18:00', 60, 3, 1)).toEqual({ start: '18:00', count: 1 });
  });

  it('extends to a later slot in step', () => {
    expect(nextSlotSelection({ start: '18:00', count: 1 }, '19:00', 60, 3, 1)).toEqual({ start: '18:00', count: 2 });
    expect(nextSlotSelection({ start: '18:00', count: 1 }, '20:00', 60, 3, 1)).toEqual({ start: '18:00', count: 3 });
  });

  it('shrinks when tapping inside the run, resets on the start', () => {
    expect(nextSlotSelection({ start: '18:00', count: 3 }, '19:00', 60, 3, 1)).toEqual({ start: '18:00', count: 2 });
    expect(nextSlotSelection({ start: '18:00', count: 3 }, '18:00', 60, 3, 1)).toEqual({ start: '18:00', count: 1 });
  });

  it('starts over beyond the run, before the start, off step, or when multi is off', () => {
    expect(nextSlotSelection({ start: '18:00', count: 1 }, '21:00', 60, 3, 1)).toEqual({ start: '21:00', count: 1 });
    expect(nextSlotSelection({ start: '18:00', count: 2 }, '17:00', 60, 3, 1)).toEqual({ start: '17:00', count: 1 });
    expect(nextSlotSelection({ start: '18:00', count: 1 }, '18:30', 60, 3, 1)).toEqual({ start: '18:30', count: 1 });
    expect(nextSlotSelection({ start: '18:00', count: 1 }, '19:00', 60, 1, 1)).toEqual({ start: '19:00', count: 1 });
  });

  it('stretches to the minimum when it fits', () => {
    expect(nextSlotSelection({ start: '18:00', count: 1 }, '19:00', 60, 3, 3)).toEqual({ start: '18:00', count: 3 });
    expect(nextSlotSelection({ start: '18:00', count: 1 }, '19:00', 60, 2, 3)).toEqual({ start: '19:00', count: 1 });
  });
});

describe('selectedSlotTimes', () => {
  it('lists every slot of the pick', () => {
    expect([...selectedSlotTimes({ start: '18:00', count: 3 }, 60)]).toEqual(['18:00', '19:00', '20:00']);
    expect([...selectedSlotTimes(null, 60)]).toEqual([]);
  });
});
