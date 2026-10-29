/**
 * Public pages are language-routed: Thai at `/…`, English at `/en/…`.
 * Only a few pages have an English route, so switching language must not
 * blindly prefix `/en` (that produced 404s such as `/en/register`).
 */

export type PublicLang = 'th' | 'en';

/** Paths that have a page under `/en` (exact match). */
const EN_EXACT_PATHS = new Set(['/', '/pricing', '/contact', '/blog', '/use-cases']);

/** Path prefixes whose `[slug]` children all have an English page. */
const EN_SLUG_PREFIXES = ['/use-cases/'];

/**
 * Prefixes with only some slugs translated. The switch cannot know which
 * without loading the content, so it lands on the English list instead.
 */
const EN_PARTIAL_PREFIXES: Record<string, string> = { '/blog/': '/blog' };

/** True when `pathname` is under `/en`. */
export function isEnglishPath(pathname: string): boolean {
  return pathname === '/en' || pathname.startsWith('/en/');
}

/** Thai path for an `/en` path (or the path itself when it is already Thai). */
export function toThaiPath(pathname: string): string {
  if (!isEnglishPath(pathname)) return pathname;
  return pathname.replace(/^\/en/, '') || '/';
}

/** English path for a Thai path, or null when no English page exists. */
export function toEnglishPath(pathname: string): string | null {
  if (isEnglishPath(pathname)) return pathname;
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (EN_EXACT_PATHS.has(path)) return path === '/' ? '/en' : `/en${path}`;
  if (EN_SLUG_PREFIXES.some((prefix) => path.startsWith(prefix))) return `/en${path}`;
  const partial = Object.keys(EN_PARTIAL_PREFIXES).find((prefix) => path.startsWith(prefix));
  if (partial) return `/en${EN_PARTIAL_PREFIXES[partial]}`;
  return null;
}

/**
 * Where to go when the visitor picks `nextLang` on `pathname`.
 * Returns the same path when the page has no route in that language;
 * the UI language still switches through the dictionary.
 */
export function toPublicLocalizedPath(pathname: string, nextLang: PublicLang): string {
  if (nextLang === 'th') return toThaiPath(pathname);
  return toEnglishPath(pathname) ?? pathname;
}

/** Language a public page is rendered in, read from its path. */
export function publicLangFromPath(pathname: string | null | undefined): PublicLang {
  return pathname && isEnglishPath(pathname) ? 'en' : 'th';
}
