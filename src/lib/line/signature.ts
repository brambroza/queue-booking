import crypto from 'crypto';

/**
 * Verify a LINE webhook `x-line-signature` header.
 *
 * Uses a constant-time comparison so the expected HMAC cannot be recovered by
 * timing the response.
 *
 * @param channelSecret - The shop's LINE Messaging API channel secret.
 * @param body - Raw request body, exactly as received.
 * @param signature - Value of the `x-line-signature` header.
 * @returns true only when the signature matches.
 */
export function verifyLineSignature(channelSecret: string, body: string, signature: string): boolean {
  if (!channelSecret || !signature) return false;
  const expected = Buffer.from(crypto.createHmac('sha256', channelSecret).update(body).digest('base64'));
  const given = Buffer.from(signature);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}
