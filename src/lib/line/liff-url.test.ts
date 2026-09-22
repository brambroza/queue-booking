import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildLiffUri, resolveCustomerLiffUrl } from './liff-url';

const BOOKING_ID = '2001234567-AbCdEfGh';
const MEMBER_ID = '2007654321-ZyXwVuTs';
const ENV_ID = '2000000001-EnvEnvEn';

describe('buildLiffUri', () => {
  it('builds the shared liff.line.me shape with shop_key and tab', () => {
    expect(buildLiffUri(BOOKING_ID, 'SHOP-1', 'account')).toBe(
      `https://liff.line.me/${BOOKING_ID}?shop_key=SHOP-1&tab=account`,
    );
  });

  it('encodes the shop key', () => {
    expect(buildLiffUri(BOOKING_ID, 'a b&c', 'booking')).toContain('shop_key=a+b%26c');
  });
});

describe('resolveCustomerLiffUrl', () => {
  let prevLiff: string | undefined;
  let prevPublic: string | undefined;
  beforeEach(() => {
    prevLiff = process.env.LIFF_ID;
    prevPublic = process.env.NEXT_PUBLIC_LIFF_ID;
    delete process.env.LIFF_ID;
    delete process.env.NEXT_PUBLIC_LIFF_ID;
  });
  afterEach(() => {
    if (prevLiff !== undefined) process.env.LIFF_ID = prevLiff;
    if (prevPublic !== undefined) process.env.NEXT_PUBLIC_LIFF_ID = prevPublic;
  });

  it('prefers the member LIFF for the account tab', () => {
    const url = resolveCustomerLiffUrl({ shopKey: 'fit', liffId: BOOKING_ID, liffIdLoginShop: MEMBER_ID, tab: 'account', appUrl: 'https://app.test' });
    expect(url).toBe(`https://liff.line.me/${MEMBER_ID}?shop_key=fit&tab=account`);
  });

  it('prefers the booking LIFF for the booking tab', () => {
    const url = resolveCustomerLiffUrl({ shopKey: 'fit', liffId: BOOKING_ID, liffIdLoginShop: MEMBER_ID, tab: 'booking', appUrl: 'https://app.test' });
    expect(url).toBe(`https://liff.line.me/${BOOKING_ID}?shop_key=fit&tab=booking`);
  });

  it('falls back to the booking LIFF with tab=account when no member LIFF is set', () => {
    const url = resolveCustomerLiffUrl({ shopKey: 'fit', liffId: BOOKING_ID, liffIdLoginShop: null, tab: 'account' });
    expect(url).toBe(`https://liff.line.me/${BOOKING_ID}?shop_key=fit&tab=account`);
  });

  it('accepts a full LIFF URL pasted from the LINE console', () => {
    const url = resolveCustomerLiffUrl({ shopKey: 'fit', liffId: `https://liff.line.me/${BOOKING_ID}`, tab: 'account' });
    expect(url).toBe(`https://liff.line.me/${BOOKING_ID}?shop_key=fit&tab=account`);
  });

  it('skips malformed IDs and uses the env LIFF ID', () => {
    process.env.LIFF_ID = ENV_ID;
    const url = resolveCustomerLiffUrl({ shopKey: 'fit', liffId: 'not-a-liff-id', liffIdLoginShop: '', tab: 'account' });
    expect(url).toBe(`https://liff.line.me/${ENV_ID}?shop_key=fit&tab=account`);
  });

  it('keeps the direct app link when the shop has no LIFF ID at all', () => {
    expect(resolveCustomerLiffUrl({ shopKey: 'fit', tab: 'account', appUrl: 'https://app.test/' })).toBe('https://app.test/liff/fit/member');
    expect(resolveCustomerLiffUrl({ shopKey: 'fit', tab: 'booking', appUrl: 'https://app.test' })).toBe('https://app.test/liff/fit');
  });

  it('returns undefined without a LIFF ID or app URL, or without a shop key', () => {
    expect(resolveCustomerLiffUrl({ shopKey: 'fit', tab: 'account' })).toBeUndefined();
    expect(resolveCustomerLiffUrl({ shopKey: null, liffId: BOOKING_ID, tab: 'account', appUrl: 'https://app.test' })).toBeUndefined();
  });
});
