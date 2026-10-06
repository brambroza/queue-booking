import { describe, expect, it } from 'vitest';
import { FALLBACK_OWNER_NAME, pickOwnerContact } from './shop-owner-contact';

describe('pickOwnerContact', () => {
  it('prefers the owner login, then shop, then company', () => {
    expect(
      pickOwnerContact({
        ownerProfile: { full_name: 'เจ้าของ', email: 'owner@x.com' },
        shop: { email: 'shop@x.com' },
        company: { owner_name: 'บริษัท', email: 'co@x.com' },
      }),
    ).toEqual({ name: 'เจ้าของ', email: 'owner@x.com' });
    expect(pickOwnerContact({ ownerProfile: { email: '' }, shop: { email: 'shop@x.com' }, company: { email: 'co@x.com' } }).email).toBe('shop@x.com');
    expect(pickOwnerContact({ company: { owner_name: 'คุณบริษัท', email: 'co@x.com' } })).toEqual({ name: 'คุณบริษัท', email: 'co@x.com' });
  });

  it('skips an address that is not shaped like an email and falls through', () => {
    expect(pickOwnerContact({ ownerProfile: { email: 'not-an-email' }, shop: { email: 'good@x.com' } }).email).toBe('good@x.com');
  });

  it('returns no email and a neutral greeting when nothing is on file', () => {
    expect(pickOwnerContact({})).toEqual({ name: FALLBACK_OWNER_NAME, email: null });
    expect(pickOwnerContact({ ownerProfile: { full_name: '   ', email: ' ' } })).toEqual({ name: FALLBACK_OWNER_NAME, email: null });
  });
});
