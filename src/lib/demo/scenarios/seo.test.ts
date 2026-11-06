import { describe, expect, it } from 'vitest';
import { sportsCourtScenario } from './sports-court';
import type { BusinessScenario } from './types';
import { formatBaht, jsonLdScript, relatedScenarios, sandboxIndexJsonLd, sandboxPath, scenarioJsonLd, siteOrigin } from './seo';

const ORIGIN = 'https://example.test';

describe('sandbox seo helpers', () => {
  it('builds paths and origin', () => {
    expect(sandboxPath(sportsCourtScenario)).toBe('/sandbox-demo/sports-court');
    expect(siteOrigin('https://a.test///')).toBe('https://a.test');
    expect(siteOrigin('')).toBe('https://queuebooking.com');
  });

  it('formats baht', () => {
    expect(formatBaht(1200)).toBe('1,200 บาท');
    expect(formatBaht(0)).toBe('ฟรี / ชำระหน้าร้าน');
  });

  it('mirrors the visible FAQ in FAQPage schema', () => {
    const blocks = scenarioJsonLd(sportsCourtScenario, ORIGIN, '2026-11-06');
    const faq = blocks.find((b) => b['@type'] === 'FAQPage') as { mainEntity: Array<{ name: string; acceptedAnswer: { text: string } }> };
    expect(faq.mainEntity.map((q) => q.name)).toEqual(sportsCourtScenario.seo.faqs.map((f) => f.q));
    expect(faq.mainEntity[0].acceptedAnswer.text).toBe(sportsCourtScenario.seo.faqs[0].a);
    const page = blocks.find((b) => b['@type'] === 'WebPage') as { url: string };
    expect(page.url).toBe(`${ORIGIN}/sandbox-demo/sports-court`);
    expect(blocks.some((b) => b['@type'] === 'HowTo')).toBe(true);
  });

  it('escapes < in JSON-LD', () => {
    expect(jsonLdScript({ a: '</script>' })).not.toContain('</script>');
  });

  it('lists scenarios and related links without the current page', () => {
    const list = [1, 2, 3, 4].map((n) => ({ ...sportsCourtScenario, type: `t${n}`, slug: `s${n}` })) as unknown as BusinessScenario[];
    const index = sandboxIndexJsonLd(list, ORIGIN) as { numberOfItems: number };
    expect(index.numberOfItems).toBe(4);
    const related = relatedScenarios(list, list[3], 2);
    expect(related.map((s) => s.slug)).toEqual(['s1', 's2']);
  });
});
