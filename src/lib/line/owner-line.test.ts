import { describe, expect, it } from 'vitest';
import {
  OWNER_LINK_CODE_LENGTH,
  generateOwnerLinkCode,
  hashOwnerLinkCode,
  isOwnerLinkCodeValid,
  looksLikeOwnerLinkMessage,
  oaMessageUrl,
  ownerLinkMessage,
  parseOwnerLinkMessage,
} from './owner-line';

describe('owner link code', () => {
  it('generates unambiguous codes of the right length', () => {
    for (let i = 0; i < 50; i += 1) {
      const code = generateOwnerLinkCode();
      expect(code).toHaveLength(OWNER_LINK_CODE_LENGTH);
      expect(code).not.toMatch(/[01OIL]/);
    }
  });

  it('round-trips through the message', () => {
    const code = generateOwnerLinkCode();
    expect(parseOwnerLinkMessage(ownerLinkMessage(code))).toBe(code);
  });

  it('tolerates case, spaces and a missing dash', () => {
    expect(parseOwnerLinkMessage('  owner-k7m2q9xa ')).toBe('K7M2Q9XA');
    expect(parseOwnerLinkMessage('OWNER K7M2Q9XA')).toBe('K7M2Q9XA');
  });

  it('rejects other text', () => {
    expect(parseOwnerLinkMessage('จองคิว')).toBeNull();
    expect(parseOwnerLinkMessage('OWNER-SHORT')).toBeNull();
    expect(parseOwnerLinkMessage('hi OWNER-K7M2Q9XA')).toBeNull();
    expect(parseOwnerLinkMessage(null)).toBeNull();
  });

  it('flags attempts with a bad code so the bot answers them', () => {
    expect(looksLikeOwnerLinkMessage('OWNER-xx')).toBe(true);
    expect(looksLikeOwnerLinkMessage('owner')).toBe(false);
  });
});

describe('isOwnerLinkCodeValid', () => {
  const now = new Date('2026-11-02T10:00:00Z');
  const hash = hashOwnerLinkCode('K7M2Q9XA');

  it('accepts the stored code before expiry, any case', () => {
    expect(isOwnerLinkCodeValid('K7M2Q9XA', hash, '2026-11-02T10:10:00Z', now)).toBe(true);
    expect(isOwnerLinkCodeValid('k7m2q9xa', hash, '2026-11-02T10:10:00Z', now)).toBe(true);
  });

  it('rejects wrong, expired or missing codes', () => {
    expect(isOwnerLinkCodeValid('K7M2Q9XB', hash, '2026-11-02T10:10:00Z', now)).toBe(false);
    expect(isOwnerLinkCodeValid('K7M2Q9XA', hash, '2026-11-02T09:59:00Z', now)).toBe(false);
    expect(isOwnerLinkCodeValid('K7M2Q9XA', null, '2026-11-02T10:10:00Z', now)).toBe(false);
    expect(isOwnerLinkCodeValid('K7M2Q9XA', hash, null, now)).toBe(false);
    expect(isOwnerLinkCodeValid('K7M2Q9XA', 'zz', '2026-11-02T10:10:00Z', now)).toBe(false);
  });
});

describe('oaMessageUrl', () => {
  it('builds a prefilled OA chat link', () => {
    expect(oaMessageUrl('@abc1234', 'OWNER-K7M2Q9XA')).toBe('https://line.me/R/oaMessage/%40abc1234/?OWNER-K7M2Q9XA');
    expect(oaMessageUrl('abc1234', 'x y')).toBe('https://line.me/R/oaMessage/%40abc1234/?x%20y');
    expect(oaMessageUrl(null, 'x')).toBeNull();
  });
});
