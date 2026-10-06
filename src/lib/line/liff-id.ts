/**
 * Extracts a bare LIFF ID from whatever the shop owner pasted.
 *
 * The LINE console shows both a LIFF ID (`1234567890-abcdefgh`) and a LIFF URL
 * (`https://liff.line.me/1234567890-abcdefgh`), and pasting the URL used to
 * save without complaint and silently break booking.
 *
 * @param input - Raw value from the settings form.
 * @returns The bare LIFF ID, or an empty string when nothing usable was given.
 */
export function normalizeLiffId(input?: string | null): string {
  if (!input) return '';
  const raw = String(input).trim();
  if (!raw) return '';
  const match = raw.match(/liff\.line\.me\/([^/?#]+)/);
  return match?.[1] ?? raw;
}

/** LIFF IDs look like `1234567890-abcdefgh`. */
export function isValidLiffId(value: string): boolean {
  return /^\d{8,12}-[A-Za-z0-9]{4,20}$/.test(value);
}

/**
 * The LINE Login channel that owns a LIFF app, read from the LIFF ID itself.
 *
 * A LIFF ID is `<channel id>-<random>`, so `1234567890-abcdefgh` belongs to
 * channel `1234567890`. That is the channel an ID token from this LIFF app is
 * issued for, which makes the shop's own LIFF ID enough to verify tokens: no
 * separate per-shop setting or platform-wide env var is needed.
 *
 * @param liffId - A LIFF ID or a pasted LIFF URL; anything else yields null.
 * @returns The numeric channel id, or null when the value is not a valid LIFF ID.
 */
export function channelIdFromLiffId(liffId?: string | null): string | null {
  const id = normalizeLiffId(liffId);
  return isValidLiffId(id) ? id.split('-')[0] : null;
}
