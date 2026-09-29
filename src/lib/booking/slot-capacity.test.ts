import { describe, expect, it } from 'vitest';
import {
  isSlotFull,
  isSlotFullDbError,
  occupiesSlot,
  slotFullMessage,
  slotFullStaffMessage,
} from './slot-capacity';

describe('occupiesSlot', () => {
  it('frees the seat for cancelled and no_show', () => {
    expect(occupiesSlot('cancelled')).toBe(false);
    expect(occupiesSlot('no_show')).toBe(false);
  });

  it('counts every live status and completed', () => {
    for (const s of ['pending', 'pending_approval', 'confirmed', 'checked_in', 'waiting', 'called', 'serving', 'completed']) {
      expect(occupiesSlot(s)).toBe(true);
    }
  });

  it('treats unknown / missing status as counting (fail closed)', () => {
    expect(occupiesSlot(undefined)).toBe(true);
    expect(occupiesSlot('')).toBe(true);
  });
});

describe('isSlotFull', () => {
  it('is full once the count reaches capacity', () => {
    expect(isSlotFull(0, 2)).toBe(false);
    expect(isSlotFull(1, 2)).toBe(false);
    expect(isSlotFull(2, 2)).toBe(true);
    expect(isSlotFull(3, 2)).toBe(true);
  });

  it('reads a missing or invalid capacity as 1, never as unlimited', () => {
    expect(isSlotFull(0, null)).toBe(false);
    expect(isSlotFull(1, null)).toBe(true);
    expect(isSlotFull(1, undefined)).toBe(true);
    expect(isSlotFull(1, 0)).toBe(true);
    expect(isSlotFull(1, Number.NaN)).toBe(true);
  });
});

describe('messages', () => {
  it('names the slot for the customer', () => {
    expect(slotFullMessage('10:30:00')).toContain('10:30');
    expect(slotFullMessage('10:30')).toContain('10:30');
    expect(slotFullMessage(null)).toContain('รอบนี้เต็มแล้ว');
  });

  it('shows staff the count against capacity', () => {
    expect(slotFullStaffMessage('10:30:00', 3, 3)).toBe('รอบ 10:30 เต็มแล้ว (3/3)');
  });
});

describe('isSlotFullDbError', () => {
  it('recognises the trigger error only', () => {
    expect(isSlotFullDbError('slot_full')).toBe(true);
    expect(isSlotFullDbError('ERROR: slot_full (P0001)')).toBe(true);
    expect(isSlotFullDbError('daily_limit')).toBe(false);
    expect(isSlotFullDbError(null)).toBe(false);
  });
});
