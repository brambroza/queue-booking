import { describe, expect, it } from 'vitest';
import { BUSINESS_TYPES } from '@/lib/line/rich-menu/business-types';
import { RESOURCE_TYPES } from '@/lib/booking/resource-types';
import { SIGNAGE_TEMPLATES, SIGNAGE_THEMES } from '@/lib/signage/types';
import { BUSINESS_SCENARIOS, SCENARIO_LIST, scenarioBySlug, scenarioForBusiness } from './index';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

describe('business scenarios', () => {
  it('covers every business type exactly once', () => {
    expect(SCENARIO_LIST).toHaveLength(BUSINESS_TYPES.length);
    for (const type of BUSINESS_TYPES) expect(BUSINESS_SCENARIOS[type].type).toBe(type);
  });

  it('has unique kebab-case slugs', () => {
    const slugs = SCENARIO_LIST.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('finds scenarios by slug and by legacy business label', () => {
    expect(scenarioBySlug('sports-court')?.type).toBe('sports_court');
    expect(scenarioBySlug('nope')).toBeNull();
    expect(scenarioForBusiness('barber').type).toBe('salon');
    expect(scenarioForBusiness('general_service').type).toBe('salon');
    expect(scenarioForBusiness(null).type).toBe('salon');
  });

  for (const s of SCENARIO_LIST) {
    describe(s.type, () => {
      const serviceKeys = new Set(s.services.map((x) => x.key));
      const resourceCodes = new Set(s.resources.map((x) => x.code));

      it('has valid hours and services', () => {
        expect(s.openTime).toMatch(HHMM);
        expect(s.closeTime).toMatch(HHMM);
        expect(s.slotMinutes).toBeGreaterThan(0);
        expect(s.services.length).toBeGreaterThanOrEqual(2);
        expect(serviceKeys.size).toBe(s.services.length);
        for (const svc of s.services) {
          expect(svc.durationMinutes).toBeGreaterThan(0);
          expect(Number.isInteger(svc.price) && svc.price >= 0).toBe(true);
          expect(svc.capacityPerSlot).toBeGreaterThanOrEqual(1);
        }
      });

      it('has consistent resources', () => {
        expect(resourceCodes.size).toBe(s.resources.length);
        if (s.resourcePicker !== 'none') expect(s.resources.length).toBeGreaterThan(0);
        for (const r of s.resources) {
          expect(RESOURCE_TYPES).toContain(r.type);
          if (r.type === 'trainer') expect(r.capacity).toBe(1);
          for (const key of r.serviceKeys ?? []) expect(serviceKeys.has(key)).toBe(true);
        }
      });

      it('has consistent sample queues', () => {
        expect(s.queues.length).toBeGreaterThanOrEqual(5);
        const numbers = s.queues.map((q) => q.queueNo);
        expect(new Set(numbers).size).toBe(numbers.length);
        const statuses = new Set(s.queues.map((q) => q.status));
        for (const st of ['waiting', 'called', 'serving', 'completed'] as const) expect(statuses.has(st)).toBe(true);
        for (const q of s.queues) {
          expect(serviceKeys.has(q.serviceKey)).toBe(true);
          if (q.resourceCode) expect(resourceCodes.has(q.resourceCode)).toBe(true);
          expect(q.time).toMatch(HHMM);
          expect(q.phone).toMatch(/^0[689]\d{8}$/);
        }
      });

      it('has signage, chargeable payments and chat data', () => {
        expect(SIGNAGE_TEMPLATES).toContain(s.signage.template);
        expect(SIGNAGE_THEMES).toContain(s.signage.theme);
        // A queue that shows a payment must have something to charge (service price or resource price).
        for (const q of s.queues.filter((x) => x.payment)) {
          const service = s.services.find((x) => x.key === q.serviceKey);
          const resource = s.resources.find((x) => x.code === q.resourceCode);
          expect((service?.price ?? 0) > 0 || (resource?.unitPrice ?? 0) > 0).toBe(true);
        }
        expect(s.chats.length).toBeGreaterThanOrEqual(2);
        expect(s.promos).toHaveLength(2);
      });

      it('has complete SEO copy', () => {
        expect(s.seo.title.length).toBeLessThanOrEqual(60);
        expect(s.seo.description.length).toBeGreaterThanOrEqual(80);
        expect(s.seo.description.length).toBeLessThanOrEqual(160);
        expect(s.seo.keywords.length).toBeGreaterThanOrEqual(4);
        expect(s.seo.painPoints).toHaveLength(3);
        expect(s.seo.benefits.length).toBeGreaterThanOrEqual(3);
        expect(s.seo.faqs.length).toBeGreaterThanOrEqual(4);
      });
    });
  }

  it('does not reuse FAQ questions across business types', () => {
    const all = SCENARIO_LIST.flatMap((s) => s.seo.faqs.map((f) => f.q));
    expect(new Set(all).size).toBe(all.length);
  });
});
