import { describe, expect, it } from 'vitest';
import { publicLangFromPath, toEnglishPath, toPublicLocalizedPath, toThaiPath } from './public-routes';

describe('toEnglishPath', () => {
  it('maps pages that have an English route', () => {
    expect(toEnglishPath('/')).toBe('/en');
    expect(toEnglishPath('/pricing')).toBe('/en/pricing');
    expect(toEnglishPath('/contact/')).toBe('/en/contact');
    expect(toEnglishPath('/use-cases')).toBe('/en/use-cases');
    expect(toEnglishPath('/use-cases/clinic')).toBe('/en/use-cases/clinic');
  });

  it('sends a blog post to the English list (only some posts are translated)', () => {
    expect(toEnglishPath('/blog')).toBe('/en/blog');
    expect(toEnglishPath('/blog/some-thai-only-post')).toBe('/en/blog');
  });

  it('returns null for pages without an English route', () => {
    for (const path of ['/register', '/login', '/sandbox-demo', '/terms', '/privacy', '/solutions/clinic-booking-system', '/features/promptpay-payment']) {
      expect(toEnglishPath(path)).toBeNull();
    }
  });

  it('does not match a prefix that only looks similar', () => {
    expect(toEnglishPath('/pricing-old')).toBeNull();
    expect(toEnglishPath('/blogger')).toBeNull();
  });

  it('keeps an English path as is', () => {
    expect(toEnglishPath('/en/pricing')).toBe('/en/pricing');
  });
});

describe('toThaiPath', () => {
  it('strips /en', () => {
    expect(toThaiPath('/en')).toBe('/');
    expect(toThaiPath('/en/blog/x')).toBe('/blog/x');
    expect(toThaiPath('/register')).toBe('/register');
  });

  it('does not strip a path that merely starts with "en"', () => {
    expect(toThaiPath('/enterprise')).toBe('/enterprise');
  });
});

describe('toPublicLocalizedPath', () => {
  it('stays on the page when no English route exists', () => {
    expect(toPublicLocalizedPath('/register', 'en')).toBe('/register');
    expect(toPublicLocalizedPath('/login', 'en')).toBe('/login');
  });

  it('switches both ways where routes exist', () => {
    expect(toPublicLocalizedPath('/pricing', 'en')).toBe('/en/pricing');
    expect(toPublicLocalizedPath('/en/pricing', 'th')).toBe('/pricing');
  });
});

describe('publicLangFromPath', () => {
  it('reads the language from the path', () => {
    expect(publicLangFromPath('/en/blog')).toBe('en');
    expect(publicLangFromPath('/blog')).toBe('th');
    expect(publicLangFromPath(null)).toBe('th');
  });
});
