import { describe, expect, it } from 'vitest';
import { canAttachExistingAccount, shouldDetachProfile } from './staff-access';

describe('canAttachExistingAccount', () => {
  it('allows an account with no tenant yet', () => {
    expect(canAttachExistingAccount('a', null, [])).toBe(true);
  });

  it('allows an account already in this shop', () => {
    expect(canAttachExistingAccount('a', 'a', [{ shop_id: 'a' }])).toBe(true);
  });

  it('refuses an account whose profile is in another shop', () => {
    expect(canAttachExistingAccount('a', 'b', [])).toBe(false);
  });

  it('refuses an account holding a role in another shop', () => {
    expect(canAttachExistingAccount('a', null, [{ shop_id: 'b' }])).toBe(false);
    expect(canAttachExistingAccount('a', 'a', [{ shop_id: 'a' }, { shop_id: 'b' }])).toBe(false);
  });

  it('refuses a global grant such as super_admin', () => {
    expect(canAttachExistingAccount('a', null, [{ shop_id: null }])).toBe(false);
  });
});

describe('shouldDetachProfile', () => {
  it('detaches a member with no grant left', () => {
    expect(shouldDetachProfile(0, false)).toBe(true);
  });

  it('keeps a member who still holds a role', () => {
    expect(shouldDetachProfile(1, false)).toBe(false);
  });

  it('never detaches the shop creator', () => {
    expect(shouldDetachProfile(0, true)).toBe(false);
  });
});
