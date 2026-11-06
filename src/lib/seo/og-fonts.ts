import { readFile } from 'node:fs/promises';
import path from 'node:path';

export type OgFont = { name: string; data: ArrayBuffer; weight: 400 | 700; style: 'normal' };

/**
 * Kanit for social cards. Satori ships a Latin-only fallback, so without
 * these files a Thai headline renders as empty boxes on LINE/Facebook/X.
 * The TTFs live in public/fonts (SIL OFL, licence file alongside them).
 */
export async function loadKanit(): Promise<OgFont[]> {
  const dir = path.join(process.cwd(), 'public', 'fonts');
  const [regular, bold] = await Promise.all([
    readFile(path.join(dir, 'Kanit-Regular.ttf')),
    readFile(path.join(dir, 'Kanit-Bold.ttf')),
  ]);
  const toArrayBuffer = (buf: Buffer): ArrayBuffer =>
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  return [
    { name: 'Kanit', data: toArrayBuffer(regular), weight: 400, style: 'normal' },
    { name: 'Kanit', data: toArrayBuffer(bold), weight: 700, style: 'normal' },
  ];
}

/**
 * Hostname printed in card footers — the same origin `metadataBase` in the
 * root layout resolves to, so a card never advertises a stale deploy URL.
 */
export function siteHost(): string {
  const fallback = 'queuebooking.com';
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL || `https://${fallback}`).host || fallback;
  } catch {
    return fallback;
  }
}
