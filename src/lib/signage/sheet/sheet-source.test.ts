import { describe, expect, it } from 'vitest';
import { isAddonActive, parseSpreadsheetId, pickSheetSource, sheetCacheKey, sheetRange } from './sheet-source';

const ID = '1AbCdEfGhIjKlMnOpQrStUvWxYz_0123456789-xyz';

describe('parseSpreadsheetId', () => {
  it('reads the id from a pasted link or a bare id', () => {
    expect(parseSpreadsheetId(`https://docs.google.com/spreadsheets/d/${ID}/edit#gid=0`)).toBe(ID);
    expect(parseSpreadsheetId(` ${ID} `)).toBe(ID);
  });
  it('refuses other hosts, http and short ids', () => {
    expect(parseSpreadsheetId(`https://evil.example.com/spreadsheets/d/${ID}/edit`)).toBeNull();
    expect(parseSpreadsheetId(`http://docs.google.com/spreadsheets/d/${ID}/edit`)).toBeNull();
    expect(parseSpreadsheetId('https://docs.google.com/document/d/abc/edit')).toBeNull();
    expect(parseSpreadsheetId('abc')).toBeNull();
  });
});

describe('isAddonActive', () => {
  it('needs active and not past expires_on (inclusive)', () => {
    expect(isAddonActive(null, '2026-11-04')).toBe(false);
    expect(isAddonActive({ active: false, expires_on: null }, '2026-11-04')).toBe(false);
    expect(isAddonActive({ active: true, expires_on: null }, '2026-11-04')).toBe(true);
    expect(isAddonActive({ active: true, expires_on: '2026-11-04' }, '2026-11-04')).toBe(true);
    expect(isAddonActive({ active: true, expires_on: '2026-11-03' }, '2026-11-04')).toBe(false);
  });
});

describe('pickSheetSource', () => {
  const shop = { branch_id: null, name: 'shop' };
  const branch = { branch_id: 'b1', name: 'b1' };
  it('prefers the branch row, falls back to the shop-wide row', () => {
    expect(pickSheetSource([shop, branch], 'b1')).toBe(branch);
    expect(pickSheetSource([shop, branch], 'b2')).toBe(shop);
    expect(pickSheetSource([branch], null)).toBeNull();
    expect(pickSheetSource([shop], null)).toBe(shop);
  });
});

describe('sheetRange / sheetCacheKey', () => {
  it('quotes tab names', () => {
    expect(sheetRange(null)).toBe('A1:Z2000');
    expect(sheetRange("คิว'วันนี้")).toBe("'คิว''วันนี้'!A1:Z2000");
  });
  it('changes when the source is edited or the day turns', () => {
    const s = { id: 'x', spreadsheet_id: ID, sheet_name: null, updated_at: 't1' };
    expect(sheetCacheKey(s, '2026-11-04')).not.toBe(sheetCacheKey({ ...s, updated_at: 't2' }, '2026-11-04'));
    expect(sheetCacheKey(s, '2026-11-04')).not.toBe(sheetCacheKey(s, '2026-11-05'));
  });
});
