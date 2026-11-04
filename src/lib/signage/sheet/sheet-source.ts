/**
 * Pure rules for the Google Sheet signage add-on (no I/O).
 */

/** Add-on key in `shop_addons.addon_key`. */
export const SHEET_SIGNAGE_ADDON = 'sheet_signage';

/** Seconds a sheet read is reused. Keeps one shop at ~6 Sheets API reads a minute whatever the TV count. */
export const SHEET_CACHE_SECONDS = 10;

/** Range read from the tab: 26 columns × 2,000 rows is far more than a day of a clinic. */
export const SHEET_READ_RANGE = 'A1:Z2000';

export type ShopAddonRow = { active: boolean; expires_on: string | null };

export type SheetSourceRow = {
  id: string;
  shop_id: string;
  branch_id: string | null;
  spreadsheet_id: string;
  sheet_name: string | null;
  enabled: boolean;
  updated_at?: string | null;
};

const SPREADSHEET_ID = /^[A-Za-z0-9_-]{20,100}$/;

/**
 * Spreadsheet id from a pasted Google Sheets link (`/spreadsheets/d/<id>/...`) or a bare id.
 *
 * @returns The id, or null when the text is neither.
 */
export function parseSpreadsheetId(input: string): string | null {
  const text = input.trim();
  if (SPREADSHEET_ID.test(text)) return text;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.hostname !== 'docs.google.com') return null;
  const match = /^\/spreadsheets\/d\/([A-Za-z0-9_-]+)/.exec(url.pathname);
  return match && SPREADSHEET_ID.test(match[1]) ? match[1] : null;
}

/** Link that opens the sheet, for the portal card. */
export function spreadsheetUrl(spreadsheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
}

/**
 * Whether a bought add-on is live on `today` (Bangkok date). `expires_on` is the
 * last paid day, inclusive; no row or `active: false` = off.
 */
export function isAddonActive(row: ShopAddonRow | null | undefined, today: string): boolean {
  if (!row?.active) return false;
  return !row.expires_on || row.expires_on >= today;
}

/**
 * Pick the source for a display scope: the branch's own row, else the shop-wide row.
 * A display without a branch only uses the shop-wide row.
 */
export function pickSheetSource<T extends Pick<SheetSourceRow, 'branch_id'>>(rows: T[], branchId: string | null): T | null {
  if (branchId) {
    const own = rows.find((r) => r.branch_id === branchId);
    if (own) return own;
  }
  return rows.find((r) => r.branch_id === null) ?? null;
}

/** A1 range for the Sheets API; tab names are quoted ('' escapes a quote). */
export function sheetRange(sheetName: string | null): string {
  if (!sheetName) return SHEET_READ_RANGE;
  return `'${sheetName.replace(/'/g, "''")}'!${SHEET_READ_RANGE}`;
}

/** Cache key of one source's parsed feed; includes every input that changes the result. */
export function sheetCacheKey(source: Pick<SheetSourceRow, 'id' | 'spreadsheet_id' | 'sheet_name' | 'updated_at'>, today: string): string {
  return `sheet-signage:${source.id}:${source.spreadsheet_id}:${source.sheet_name ?? ''}:${source.updated_at ?? ''}:${today}`;
}
