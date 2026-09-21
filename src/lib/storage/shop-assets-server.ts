import { createAdminClient } from '@/lib/supabase/admin';
import { SHOP_ASSETS_BUCKET, isOwnShopAssetUrl, removedAssetPaths } from '@/lib/storage/shop-assets';

/** Base URL every `shop-assets` public URL must start with. */
function supabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
}

/**
 * First URL that is not one of this shop's own uploads, or `null` when all are
 * fine. CRUD routes call this before saving so a record can never point at an
 * external image or another tenant's object.
 */
export function findForeignAssetUrl(urls: ReadonlyArray<string | null | undefined>, shopId: string): string | null {
  const base = supabaseUrl();
  for (const url of urls) {
    if (url && !isOwnShopAssetUrl(url, shopId, base)) return url;
  }
  return null;
}

/**
 * Delete photos that were detached from a record. Best-effort: an orphaned
 * object costs a few hundred KB, a failed save over a storage hiccup costs the
 * user their edit — so this never throws.
 */
export async function removeDetachedShopAssets(
  before: ReadonlyArray<string | null | undefined>,
  after: ReadonlyArray<string | null | undefined>,
  shopId: string,
): Promise<void> {
  try {
    // Only ever delete inside the shop's own prefix, whatever the old row held.
    const paths = removedAssetPaths(before, after, supabaseUrl()).filter((p) => p.startsWith(`${shopId}/`));
    if (paths.length === 0) return;
    const { error } = await createAdminClient().storage.from(SHOP_ASSETS_BUCKET).remove(paths);
    if (error) console.error('[shop-assets] cleanup error:', error.message);
  } catch (e) {
    console.error('[shop-assets] cleanup error:', e instanceof Error ? e.message : e);
  }
}
