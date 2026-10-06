/** Thai mobile/landline numbers in the form customers type: 10 digits. */
export const THAI_PHONE_DIGITS = 10;

/**
 * Keeps only digits, max 10. Converts a +66 / 66 prefix to a leading 0 so
 * numbers saved from LINE or pasted from contacts still fit the 10-digit form.
 *
 * @param input Raw user input or stored phone value.
 * @returns Up to 10 digits.
 */
export function normalizeThaiPhoneDigits(input: string): string {
  let digits = input.replace(/\D/g, '');
  if (/^\+\s*66/.test(input.trim()) && digits.startsWith('66')) digits = `0${digits.slice(2)}`;
  return digits.slice(0, THAI_PHONE_DIGITS);
}

/**
 * Formats digits as 0XX-XXX-XXXX (e.g. 085-608-3298), progressively while typing.
 *
 * @param input Raw or already-normalized phone value.
 * @returns Display string with dashes.
 */
export function formatThaiPhone(input: string): string {
  const d = normalizeThaiPhoneDigits(input);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
}

/**
 * @param input Phone value.
 * @returns True when exactly 10 digits.
 */
export function isCompleteThaiPhone(input: string): boolean {
  return normalizeThaiPhoneDigits(input).length === THAI_PHONE_DIGITS;
}

/**
 * Display-only format for stored numbers: 0XX-XXX-XXXX when the value is a
 * complete 10-digit Thai number, otherwise the original text (never truncates
 * foreign or malformed numbers).
 *
 * @param input Stored phone value.
 * @returns Formatted number or the original value.
 */
export function displayThaiPhone(input: string | null | undefined): string {
  const raw = (input ?? '').trim();
  const full = raw.replace(/\D/g, '');
  const converted = /^\+\s*66/.test(raw) ? full.length - 2 + 1 : full.length;
  return converted === THAI_PHONE_DIGITS && isCompleteThaiPhone(raw) ? formatThaiPhone(raw) : raw;
}
