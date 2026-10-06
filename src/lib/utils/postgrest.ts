/**
 * Make free text safe to embed inside a PostgREST `.or()` filter string.
 *
 * `.or('a.ilike.%q%,b.ilike.%q%')` is parsed by PostgREST, so a raw `,` `(` `)`
 * or `.` sequence in user text can add filter clauses of its own. Those
 * characters are removed, and LIKE wildcards are escaped so `%` / `_` match
 * literally. Length is capped to keep queries cheap.
 *
 * @param input - Raw search text from the query string.
 * @param maxLength - Maximum characters kept (default 100).
 * @returns Sanitised text; may be an empty string.
 */
export function escapePostgrestSearch(input: string | null | undefined, maxLength = 100): string {
  return String(input ?? '')
    .slice(0, maxLength)
    .replace(/[,()"'*:\\]/g, ' ')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    .trim();
}

/**
 * Escape LIKE wildcards for a single `.ilike()` value (not inside `.or()`).
 *
 * @param input - Raw text.
 * @returns Text where `%`, `_` and `\` match literally.
 */
export function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (c) => `\\${c}`);
}
