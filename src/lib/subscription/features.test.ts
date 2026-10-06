import { describe, expect, it } from 'vitest';
import { SubscriptionFeatureLockedError, planAllowsFnb } from './features';

describe('planAllowsFnb', () => {
  it('allows Professional and above', () => {
    for (const code of ['professional', 'business', 'enterprise']) expect(planAllowsFnb(code)).toBe(true);
  });

  it('denies starter, unknown and missing plans (fail closed)', () => {
    for (const code of ['starter', 'pro', '', null, undefined]) expect(planAllowsFnb(code)).toBe(false);
  });
});

describe('SubscriptionFeatureLockedError', () => {
  it('serialises into the shape the paywall dialog reads', () => {
    const err = new SubscriptionFeatureLockedError('สั่งอาหารเครื่องดื่มผ่าน LINE', 'starter');
    expect(err.status).toBe(402);
    expect(err.toJSON()).toMatchObject({ kind: 'feature_locked', feature: 'fnb', plan_code: 'starter' });
    expect(err.message).toContain('Professional');
  });
});
