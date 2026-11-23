import { describe, expect, it } from 'vitest';
import { thaiAlternates } from './english-pages';

describe('thaiAlternates', () => {
  it('drops en-US while English pages are not indexable', () => {
    expect(thaiAlternates('/pricing', '/en/pricing', false)).toEqual({
      canonical: '/pricing',
      languages: { 'th-TH': '/pricing', 'x-default': '/pricing' },
    });
  });

  it('adds en-US when indexable and a twin exists', () => {
    expect(thaiAlternates('/pricing', '/en/pricing', true).languages).toEqual({
      'th-TH': '/pricing',
      'en-US': '/en/pricing',
      'x-default': '/pricing',
    });
  });

  it('skips en-US when there is no twin', () => {
    expect(thaiAlternates('/blog/x', undefined, true).languages).not.toHaveProperty('en-US');
  });
});
