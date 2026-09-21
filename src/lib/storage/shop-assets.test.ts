import { describe, expect, it } from 'vitest';
import { buildShopAssetPath, isOwnShopAssetUrl, removedAssetPaths, shopAssetPathFromUrl } from './shop-assets';

const SUPABASE = 'https://abc.supabase.co';
const SHOP = '11111111-1111-1111-1111-111111111111';
const OTHER = '22222222-2222-2222-2222-222222222222';
const urlFor = (path: string) => `${SUPABASE}/storage/v1/object/public/shop-assets/${path}`;

describe('buildShopAssetPath', () => {
  it('prefixes the shop and kind', () => {
    expect(buildShopAssetPath(SHOP, 'resources', 'jpg', 'a1b2c3', 1700000000000)).toBe(`${SHOP}/resources/1700000000000-a1b2c3.jpg`);
  });
});

describe('shopAssetPathFromUrl', () => {
  it('returns the object key for a bucket URL', () => {
    expect(shopAssetPathFromUrl(urlFor(`${SHOP}/resources/1-x.jpg`), SUPABASE)).toBe(`${SHOP}/resources/1-x.jpg`);
  });

  it('rejects another origin', () => {
    expect(shopAssetPathFromUrl(`https://evil.example/storage/v1/object/public/shop-assets/${SHOP}/x.jpg`, SUPABASE)).toBeNull();
  });

  it('rejects another bucket', () => {
    expect(shopAssetPathFromUrl(`${SUPABASE}/storage/v1/object/public/payment-slips/${SHOP}/x.jpg`, SUPABASE)).toBeNull();
  });

  it('rejects empty and doubly-encoded dot segments', () => {
    expect(shopAssetPathFromUrl(urlFor(`${SHOP}//x.jpg`), SUPABASE)).toBeNull();
    expect(shopAssetPathFromUrl(urlFor(`${SHOP}/%252e%252e/x.jpg`), SUPABASE)).not.toBeNull();
    expect(shopAssetPathFromUrl(urlFor(`${SHOP}/%2e%2e%2f${OTHER}/x.jpg`), SUPABASE)).toBeNull();
  });

  it('rejects garbage', () => {
    expect(shopAssetPathFromUrl('not a url', SUPABASE)).toBeNull();
    expect(shopAssetPathFromUrl(urlFor(''), SUPABASE)).toBeNull();
  });
});

describe('isOwnShopAssetUrl', () => {
  it('accepts the shop own prefix', () => {
    expect(isOwnShopAssetUrl(urlFor(`${SHOP}/resources/1-x.jpg`), SHOP, SUPABASE)).toBe(true);
  });

  it('rejects another tenant', () => {
    expect(isOwnShopAssetUrl(urlFor(`${OTHER}/resources/1-x.jpg`), SHOP, SUPABASE)).toBe(false);
  });

  it('rejects traversal out of the shop prefix (the URL parser resolves %2e%2e)', () => {
    expect(isOwnShopAssetUrl(urlFor(`${SHOP}/%2e%2e/${OTHER}/x.jpg`), SHOP, SUPABASE)).toBe(false);
    expect(isOwnShopAssetUrl(urlFor(`${SHOP}/../${OTHER}/x.jpg`), SHOP, SUPABASE)).toBe(false);
  });

  it('rejects a prefix that only starts with the shop id', () => {
    expect(isOwnShopAssetUrl(urlFor(`${SHOP}-evil/x.jpg`), SHOP, SUPABASE)).toBe(false);
  });

  it('rejects an empty shop id', () => {
    expect(isOwnShopAssetUrl(urlFor('x.jpg'), '', SUPABASE)).toBe(false);
  });
});

describe('removedAssetPaths', () => {
  it('lists only what was dropped', () => {
    const a = urlFor(`${SHOP}/resources/1-a.jpg`);
    const b = urlFor(`${SHOP}/resources/2-b.jpg`);
    const c = urlFor(`${SHOP}/resources/3-c.jpg`);
    expect(removedAssetPaths([a, b], [b, c], SUPABASE)).toEqual([`${SHOP}/resources/1-a.jpg`]);
  });

  it('ignores nulls and foreign URLs', () => {
    expect(removedAssetPaths([null, undefined, 'https://evil.example/x.jpg'], [], SUPABASE)).toEqual([]);
  });

  it('is unchanged when only the order changes', () => {
    const a = urlFor(`${SHOP}/resources/1-a.jpg`);
    const b = urlFor(`${SHOP}/resources/2-b.jpg`);
    expect(removedAssetPaths([a, b], [b, a], SUPABASE)).toEqual([]);
  });
});
