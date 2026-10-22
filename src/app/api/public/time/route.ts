import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Server clock for the LIFF countdown before a branch's booking release, so a
 * phone with a wrong clock opens on time. Touches no database.
 */
export function GET() {
  return NextResponse.json({ now: Date.now() }, { headers: { 'Cache-Control': 'no-store' } });
}
