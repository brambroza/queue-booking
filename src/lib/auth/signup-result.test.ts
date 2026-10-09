import { describe, expect, it } from 'vitest';
import { isExistingEmailSignUp } from './signup-result';

describe('isExistingEmailSignUp', () => {
  it('flags the obfuscated response Supabase returns for a known email', () => {
    expect(isExistingEmailSignUp({ identities: [] })).toBe(true);
  });

  it('accepts a real new user, which always carries at least one identity', () => {
    expect(isExistingEmailSignUp({ identities: [{ provider: 'email' }] })).toBe(false);
  });

  it('does not misread a response without the field as a duplicate', () => {
    expect(isExistingEmailSignUp({})).toBe(false);
    expect(isExistingEmailSignUp({ identities: null })).toBe(false);
    expect(isExistingEmailSignUp(null)).toBe(false);
    expect(isExistingEmailSignUp(undefined)).toBe(false);
  });
});
