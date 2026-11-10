import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { blogPosts } from '@/components/public/blog-content';
import { SCENARIO_LIST } from '@/lib/demo/scenarios';
import { businessTiles, landingDefinition, landingFaqs, recommendedPostSlugs, setupSteps, supportItems } from './landing-content';

/** Rough word count for Thai: spaces plus Thai word boundaries via Intl.Segmenter. */
function wordCount(text: string): number {
  const seg = new Intl.Segmenter('th', { granularity: 'word' });
  let n = 0;
  for (const s of seg.segment(text)) if (s.isWordLike) n += 1;
  return n;
}

describe('landing content', () => {
  it('FAQ questions are unique and answers short enough to quote', () => {
    const questions = new Set(landingFaqs.map((f) => f.q));
    expect(questions.size).toBe(landingFaqs.length);
    for (const f of landingFaqs) {
      expect(f.a.length, f.q).toBeGreaterThan(20);
      expect(wordCount(f.a), f.q).toBeLessThanOrEqual(60);
    }
  });

  it('definition paragraph is answer-first and under 70 words', () => {
    expect(landingDefinition.startsWith('QueueBooking คือ')).toBe(true);
    expect(wordCount(landingDefinition)).toBeLessThanOrEqual(70);
  });

  it('business tiles link to pages that exist', () => {
    const appDir = path.resolve(process.cwd(), 'src/app');
    const sandboxSlugs = new Set(SCENARIO_LIST.map((s) => s.slug));
    for (const tile of businessTiles) {
      if (tile.href.startsWith('/sandbox-demo/')) {
        expect(sandboxSlugs.has(tile.href.replace('/sandbox-demo/', '')), tile.href).toBe(true);
      } else {
        expect(existsSync(path.join(appDir, tile.href, 'page.tsx')), tile.href).toBe(true);
      }
    }
  });

  it('recommended posts exist in the blog', () => {
    const slugs = new Set(blogPosts.map((p) => p.slug));
    for (const slug of recommendedPostSlugs) expect(slugs.has(slug), slug).toBe(true);
  });

  it('step images exist under public/', () => {
    for (const step of setupSteps) {
      expect(existsSync(path.join(process.cwd(), 'public', step.image)), step.image).toBe(true);
    }
  });

  it('support copy matches the FAQ support hours', () => {
    const faq = landingFaqs.find((f) => f.q.includes('ติดปัญหา'));
    expect(faq?.a).toContain('09:00–18:00');
    expect(supportItems[0].desc).toContain('09:00–18:00');
  });
});
