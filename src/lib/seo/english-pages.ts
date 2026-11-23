/**
 * Whether the English pages under `/en` are offered to search engines.
 *
 * Off since 2026-11-23: Search Console listed all 22 `/en` URLs as "Discovered –
 * currently not indexed" (average position 47, almost no clicks) while the Thai
 * pages that sell were waiting for crawl. With this off, `/en` pages are noindex,
 * left out of the sitemap, and Thai pages stop pointing at them with hreflang.
 * The pages still open for visitors. Set to true to put them back.
 */
export const ENGLISH_PAGES_INDEXABLE = false;

/** `alternates` value for Next.js metadata. */
export type ThaiAlternates = {
  canonical: string;
  languages: Record<string, string>;
};

/**
 * Canonical + hreflang for a Thai page.
 * @param thaiPath Path of the Thai page, e.g. `/pricing`.
 * @param englishPath Path of its English twin, or undefined when there is none.
 * @param indexable Override of `ENGLISH_PAGES_INDEXABLE` (tests).
 * @returns `th-TH` and `x-default` always; `en-US` only when English pages are indexable and a twin exists.
 */
export function thaiAlternates(
  thaiPath: string,
  englishPath?: string,
  indexable: boolean = ENGLISH_PAGES_INDEXABLE,
): ThaiAlternates {
  const languages: Record<string, string> = { 'th-TH': thaiPath };
  if (indexable && englishPath) languages['en-US'] = englishPath;
  languages['x-default'] = thaiPath;
  return { canonical: thaiPath, languages };
}
