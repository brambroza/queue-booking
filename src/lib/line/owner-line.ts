/**
 * Linking the shop owner's LINE account to the shop for owner alerts.
 *
 * The owner creates a one-time code in the portal and sends it to the shop's
 * LINE OA; the webhook matches it and stores the sender's LINE user id. A LINE
 * user id cannot be typed in by hand (it is not the LINE ID people share), so
 * a message to the OA is the only way to learn it.
 */
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';

/** Unambiguous characters only (no 0/O, 1/I/L), so a typed code still matches. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const OWNER_LINK_CODE_LENGTH = 8;
/** How long a code stays valid. */
export const OWNER_LINK_CODE_TTL_MINUTES = 15;
/** Prefix the owner sends, e.g. "OWNER-K7M2Q9XA". */
export const OWNER_LINK_PREFIX = 'OWNER-';

/** New random code (8 chars, ~10^12 combinations). */
export function generateOwnerLinkCode(): string {
  let out = '';
  for (let i = 0; i < OWNER_LINK_CODE_LENGTH; i += 1) out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return out;
}

/** SHA-256 hex of a normalised code, the only form stored. */
export function hashOwnerLinkCode(code: string): string {
  return createHash('sha256').update(code.toUpperCase()).digest('hex');
}

/** The message the owner sends to the OA. */
export function ownerLinkMessage(code: string): string {
  return `${OWNER_LINK_PREFIX}${code}`;
}

const MESSAGE_RE = new RegExp(`^\\s*OWNER\\s*-?\\s*([${CODE_ALPHABET}]{${OWNER_LINK_CODE_LENGTH}})\\s*$`, 'i');

/**
 * Code inside an OA text message, or null when the text is not a link request.
 * Case-insensitive; tolerates a missing dash and stray spaces.
 */
export function parseOwnerLinkMessage(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = MESSAGE_RE.exec(text);
  return m ? m[1].toUpperCase() : null;
}

/** True when the text looks like a link attempt at all (even a bad code), so the bot answers it instead of the menu. */
export function looksLikeOwnerLinkMessage(text: string | null | undefined): boolean {
  return Boolean(text && /^\s*OWNER\s*-/i.test(text));
}

/**
 * Constant-time check of a sent code against the stored hash and expiry.
 *
 * @param code - Parsed code from the message.
 * @param storedHash - `shops.owner_line_link_code_hash`.
 * @param expiresAt - `shops.owner_line_link_code_expires_at`.
 * @param now - Current time.
 */
export function isOwnerLinkCodeValid(code: string, storedHash: string | null | undefined, expiresAt: string | null | undefined, now: Date): boolean {
  if (!storedHash || !expiresAt) return false;
  const exp = new Date(expiresAt).getTime();
  if (!Number.isFinite(exp) || exp < now.getTime()) return false;
  const a = Buffer.from(hashOwnerLinkCode(code), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * LINE URL that opens a chat with the OA with the message pre-filled, or null
 * without a basic id.
 *
 * @param basicId - OA basic id, with or without "@".
 * @param message - Text to pre-fill.
 */
export function oaMessageUrl(basicId: string | null | undefined, message: string): string | null {
  const id = (basicId ?? '').trim().replace(/^@?/, '@');
  if (id.length < 2) return null;
  return `https://line.me/R/oaMessage/${encodeURIComponent(id)}/?${encodeURIComponent(message)}`;
}
