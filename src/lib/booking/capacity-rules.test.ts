import { describe, expect, it } from 'vitest';
import { findOverlap, type CapacityRuleInput } from './capacity-rules';

const BR_A = 'aaaaaaaa-0000-0000-0000-000000000001';

function rule(partial: Partial<CapacityRuleInput>): CapacityRuleInput {
  return { branch_id: null, weekday: null, time_from: '09:00', time_to: '12:00', capacity: 2, active: true, ...partial };
}

describe('findOverlap', () => {
  it('accepts adjacent ranges because time_to is exclusive', () => {
    expect(findOverlap([rule({ time_from: '09:00', time_to: '12:00' }), rule({ time_from: '12:00', time_to: '18:00', capacity: 3 })])).toBeNull();
  });

  it('rejects two shop-wide every-day rules that share a slot', () => {
    const a = rule({ time_from: '09:00', time_to: '13:00' });
    const b = rule({ time_from: '12:30', time_to: '18:00' });
    expect(findOverlap([a, b])).toEqual([a, b]);
  });

  it('lets a branch rule overlap a shop-wide rule (different tier)', () => {
    expect(findOverlap([rule({}), rule({ branch_id: BR_A, capacity: 5 })])).toBeNull();
  });

  it('lets a weekday rule overlap an every-day rule (different tier)', () => {
    expect(findOverlap([rule({}), rule({ weekday: 6, capacity: 5 })])).toBeNull();
  });

  it('ignores inactive rules', () => {
    expect(findOverlap([rule({}), rule({ active: false })])).toBeNull();
  });

  it('handles HH:MM:SS as stored in the database', () => {
    expect(findOverlap([rule({ time_from: '09:00:00', time_to: '12:00:00' }), rule({ time_from: '11:59:00', time_to: '13:00:00' })])).not.toBeNull();
  });
});
