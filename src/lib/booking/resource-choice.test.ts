import { describe, expect, it } from 'vitest';
import { eligibleResourcesFor, isResourceChoiceMissing, resourceRequiredMessage } from './resource-choice';

describe('eligibleResourcesFor', () => {
  const resources = [
    { id: 'a', branch_id: 'b1', service_ids: ['s1'] },
    { id: 'b', branch_id: 'b2', service_ids: null },
    { id: 'c', branch_id: null, service_ids: [] },
    { id: 'd', branch_id: 'b1', service_ids: ['s2'] },
  ];

  it('keeps shop-wide and same-branch resources that serve the service', () => {
    expect(eligibleResourcesFor(resources, 'b1', 's1').map((r) => r.id)).toEqual(['a', 'c']);
  });

  it('drops resources linked to other services', () => {
    expect(eligibleResourcesFor(resources, 'b1', 's2').map((r) => r.id)).toEqual(['c', 'd']);
  });

  it('returns empty when nothing matches', () => {
    expect(eligibleResourcesFor([{ id: 'x', branch_id: 'b9', service_ids: null }], 'b1', 's1')).toEqual([]);
  });
});

describe('isResourceChoiceMissing', () => {
  it('never blocks when the switch is off', () => {
    expect(isResourceChoiceMissing({ required: false, eligibleCount: 3 })).toBe(false);
  });

  it('blocks when required, no resource sent and one could be picked', () => {
    expect(isResourceChoiceMissing({ required: true, resourceId: null, eligibleCount: 2 })).toBe(true);
  });

  it('passes when a resource was sent', () => {
    expect(isResourceChoiceMissing({ required: true, resourceId: 'r1', eligibleCount: 2 })).toBe(false);
  });

  it('passes when the service has no resource to pick', () => {
    expect(isResourceChoiceMissing({ required: true, eligibleCount: 0 })).toBe(false);
  });

  it('passes when a party size lets the server auto-assign a table', () => {
    expect(isResourceChoiceMissing({ required: true, partySize: 4, eligibleCount: 2 })).toBe(false);
  });

  it('treats party size 0 as no auto-assign', () => {
    expect(isResourceChoiceMissing({ required: true, partySize: 0, eligibleCount: 2 })).toBe(true);
  });
});

describe('resourceRequiredMessage', () => {
  it('uses the resource label', () => {
    expect(resourceRequiredMessage('สนาม')).toBe('กรุณาเลือกสนามก่อนจอง');
  });

  it('falls back when the label is empty', () => {
    expect(resourceRequiredMessage('')).toBe('กรุณาเลือกผู้ให้บริการก่อนจอง');
  });
});
