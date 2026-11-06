import { describe, expect, it } from 'vitest';
import { buildDemoSeedPlan, resolveDemoAmount, resolveDemoBusinessType } from '@/lib/demo/seed-plan';
import { BUSINESS_SCENARIOS } from '@/lib/demo/scenarios';
import { BUSINESS_TYPES } from '@/lib/line/rich-menu/business-types';

describe('buildDemoSeedPlan', () => {
  it('prices a court booking from the resource unit_price and links services', () => {
    const scenario = BUSINESS_SCENARIOS.sports_court;
    const plan = buildDemoSeedPlan(scenario, { withPayment: true });

    const c3 = plan.resources.find((r) => r.resource_code === 'C3');
    expect(c3?.unit_price).toBe(240);
    expect(c3?.service_names).toEqual(['จองสนามแบดมินตัน']);

    const a004 = plan.bookings.find((b) => b.queue_number === 'A004');
    expect(a004?.payment_amount).toBe(240);
    expect(a004?.payment_status).toBe('awaiting_verification');
    expect(plan.closeTime).toBe('00:00:00');
    expect(plan.signage).toEqual(scenario.signage);
  });

  it('strips every payment column when withPayment is false', () => {
    const plan = buildDemoSeedPlan(BUSINESS_SCENARIOS.sports_court, { withPayment: false });
    for (const b of plan.bookings) {
      expect(b.payment_status).toBe('unpaid');
      expect(b.payment_method).toBeNull();
      expect(b.payment_amount).toBeNull();
    }
    // resource prices stay: they are shop config, not payment state
    expect(plan.resources.some((r) => r.unit_price > 0)).toBe(true);
  });

  it('seeds a no-resource scenario against service price only', () => {
    // Every shipped scenario has service points, so derive a resource-less variant.
    const base = BUSINESS_SCENARIOS.clinic;
    const noResource = {
      ...base,
      resources: [],
      queues: base.queues.map((q) => ({ ...q, resourceCode: undefined })),
    };
    const on = buildDemoSeedPlan(noResource, { withPayment: true });
    const off = buildDemoSeedPlan(noResource, { withPayment: false });
    expect(on.resources).toHaveLength(0);
    expect(on.bookings.length).toBe(off.bookings.length);
    expect(off.bookings.every((b) => b.payment_amount === null)).toBe(true);
    for (const b of on.bookings) {
      if (b.payment_amount !== null) expect(b.payment_amount).toBeGreaterThan(0);
    }
  });

  it('puts completed queues on the previous day and keeps queue numbers unique', () => {
    for (const type of BUSINESS_TYPES) {
      const plan = buildDemoSeedPlan(BUSINESS_SCENARIOS[type], { withPayment: true });
      expect(new Set(plan.bookings.map((b) => b.queue_number)).size).toBe(plan.bookings.length);
      for (const b of plan.bookings) expect(b.previous_day).toBe(b.status === 'completed');
    }
  });
});

describe('resolveDemoAmount', () => {
  it('uses service price, falling back to resource unit_price only when price is 0', () => {
    expect(resolveDemoAmount(500, 240)).toBe(500);
    expect(resolveDemoAmount(0, 240)).toBe(240);
    expect(resolveDemoAmount(0, 0)).toBe(0);
  });
});

describe('resolveDemoBusinessType', () => {
  it('normalizes legacy and empty values', () => {
    expect(resolveDemoBusinessType('barber')).toBe('salon');
    expect(resolveDemoBusinessType('general_service')).toBe('salon');
    expect(resolveDemoBusinessType(null)).toBe('salon');
    expect(resolveDemoBusinessType('sports_court')).toBe('sports_court');
  });
});
