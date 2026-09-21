/**
 * Public `shop-assets` bucket: shop logo, rich menu image, and the photos that
 * help a customer recognise what they book (resource / service / venue map).
 *
 * Everything here is pure so it can be unit-tested; the upload route and the
 * CRUD routes do the actual storage calls.
 */
export const SHOP_ASSETS_BUCKET = 'shop-assets';

/** Matches the bucket's own `fileSizeLimit`. */
export const SHOP_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/** Photos per resource; mirrored by the DB check in migration 202609210001. */
export const RESOURCE_IMAGE_MAX = 5;

export const SHOP_IMAGE_KINDS = ['resources', 'services', 'branches'] as const;
export type ShopImageKind = (typeof SHOP_IMAGE_KINDS)[number];

const PUBLIC_OBJECT_PREFIX = `/storage/v1/object/public/${SHOP_ASSETS_BUCKET}/`;

/**
 * Object key for a new upload: `<shopId>/<kind>/<timestamp>-<suffix>.<ext>`.
 * The shop prefix is what `isOwnShopAssetUrl` later checks, so a URL can only be
 * attached to a record of the shop that uploaded it.
 */
export function buildShopAssetPath(shopId: string, kind: ShopImageKind, ext: string, suffix: string, now: number = Date.now()): string {
  return `${shopId}/${kind}/${now}-${suffix}.${ext}`;
}

/**
 * Object key inside `shop-assets` for a public URL, or `null` when the URL does
 * not point at this bucket on this Supabase project.
 */
export function shopAssetPathFromUrl(url: string, supabaseUrl: string): string | null {
  let parsed: URL;
  let base: URL;
  try {
    parsed = new URL(url);
    base = new URL(supabaseUrl);
  } catch {
    return null;
  }
  if (parsed.origin !== base.origin) return null;
  if (!parsed.pathname.startsWith(PUBLIC_OBJECT_PREFIX)) return null;
  let path: string;
  try {
    path = decodeURIComponent(parsed.pathname.slice(PUBLIC_OBJECT_PREFIX.length));
  } catch {
    return null;
  }
  if (!path || path.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')) return null;
  return path;
}

/**
 * True when the URL is a `shop-assets` object uploaded under this shop's prefix.
 * Rejects external URLs (tracking pixels, hot-linked content) and another
 * tenant's objects.
 */
export function isOwnShopAssetUrl(url: string, shopId: string, supabaseUrl: string): boolean {
  if (!shopId) return false;
  const path = shopAssetPathFromUrl(url, supabaseUrl);
  return path !== null && path.startsWith(`${shopId}/`);
}

/**
 * Object keys that were attached before and are gone now, so the caller can
 * delete them from storage. URLs outside the bucket are ignored.
 */
export function removedAssetPaths(
  before: ReadonlyArray<string | null | undefined>,
  after: ReadonlyArray<string | null | undefined>,
  supabaseUrl: string,
): string[] {
  const kept = new Set(after.filter((u): u is string => Boolean(u)));
  const out = new Set<string>();
  for (const url of before) {
    if (!url || kept.has(url)) continue;
    const path = shopAssetPathFromUrl(url, supabaseUrl);
    if (path) out.add(path);
  }
  return [...out];
}
