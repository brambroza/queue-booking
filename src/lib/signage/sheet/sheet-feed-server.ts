import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { cached } from '@/lib/cache/kv';
import { readSheetValues } from './google-sheets';
import { parseSheetRows, type ParsedSheet } from './parse-rows';
import {
  SHEET_CACHE_SECONDS,
  SHEET_SIGNAGE_ADDON,
  isAddonActive,
  pickSheetSource,
  sheetCacheKey,
  sheetRange,
  type SheetSourceRow,
  type ShopAddonRow,
} from './sheet-source';

const SOURCE_COLUMNS = 'id,shop_id,branch_id,spreadsheet_id,sheet_name,enabled,updated_at';

/** PostgREST / Postgres error for a table that does not exist (migration 202611040001 not run). */
export function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { code?: string; message?: string };
  if (e.code === '42P01' || e.code === 'PGRST205') return true;
  return typeof e.message === 'string' && /relation .* does not exist|could not find the table/i.test(e.message);
}

/** Thrown when the sheet loads but its layout cannot be read (no header row, no status column). */
export class SheetFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SheetFormatError';
  }
}

/**
 * Add-on row of a shop, or null when there is none or the migration has not run.
 *
 * @param client - Any client allowed to read the shop's rows (service role or the shop's own RLS).
 */
export async function loadSheetAddon(client: SupabaseClient, shopId: string): Promise<ShopAddonRow | null> {
  const { data, error } = await client
    .from('shop_addons')
    .select('active,expires_on')
    .eq('shop_id', shopId)
    .eq('addon_key', SHEET_SIGNAGE_ADDON)
    .maybeSingle<ShopAddonRow>();
  if (error) {
    if (!isMissingTableError(error)) console.error('[sheet] addon lookup failed', error.message);
    return null;
  }
  return data ?? null;
}

/** Every sheet source row of a shop; [] when none or the migration has not run. */
export async function loadSheetSources(client: SupabaseClient, shopId: string): Promise<SheetSourceRow[]> {
  const { data, error } = await client.from('signage_sheet_sources').select(SOURCE_COLUMNS).eq('shop_id', shopId);
  if (error) {
    if (!isMissingTableError(error)) console.error('[sheet] source lookup failed', error.message);
    return [];
  }
  return (data ?? []) as SheetSourceRow[];
}

/**
 * The sheet that should feed this display, or null = use bookings as before.
 * Needs the add-on live today and the scope's source switched on. Any lookup
 * failure returns null, so a broken add-on never takes the normal display down.
 */
export async function resolveSheetSignageSource(
  client: SupabaseClient,
  shopId: string,
  branchId: string | null,
  today: string,
): Promise<SheetSourceRow | null> {
  const addon = await loadSheetAddon(client, shopId);
  if (!isAddonActive(addon, today)) return null;
  const source = pickSheetSource(await loadSheetSources(client, shopId), branchId);
  return source?.enabled ? source : null;
}

/**
 * `resolveSheetSignageSource` cached 30 s per scope, for the public TV route so a
 * poll does not add two DB reads. Settings / add-on writes drop `sheet-source:{shopId}:*`.
 */
export async function resolveSheetSignageSourceCached(
  client: SupabaseClient,
  shopId: string,
  branchId: string | null,
  today: string,
): Promise<SheetSourceRow | null> {
  return cached(`sheet-source:${shopId}:${branchId ?? 'shop'}:${today}`, { ttlSeconds: 30 }, () =>
    resolveSheetSignageSource(client, shopId, branchId, today),
  );
}

/** Read + parse a sheet now (no cache), for the portal test button. */
export async function readSheetNow(source: Pick<SheetSourceRow, 'spreadsheet_id' | 'sheet_name'>, today: string): Promise<ParsedSheet> {
  const values = await readSheetValues(source.spreadsheet_id, sheetRange(source.sheet_name));
  return parseSheetRows(values, today);
}

/**
 * Today's rows of a sheet source, cached `SHEET_CACHE_SECONDS` per source so the
 * number of TVs never multiplies Google reads. A failed read serves the last
 * good copy (stale) when there is one, else throws.
 */
export async function loadSheetFeed(source: SheetSourceRow, today: string): Promise<ParsedSheet> {
  return cached(sheetCacheKey(source, today), { ttlSeconds: SHEET_CACHE_SECONDS, staleSeconds: 600 }, async () => {
    const parsed = await readSheetNow(source, today);
    if (parsed.error) throw new SheetFormatError(parsed.error);
    return parsed;
  });
}
