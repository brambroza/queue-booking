#!/usr/bin/env bash
# Renders the late-slip announcement image (#info) from
# docs/guides/late-slip-announce.html to PNG at 2x (2160px wide).
# Usage: docs/guides/build-late-slip-announce.sh [out_dir]   (default docs/guides/images/announce)
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT="${1:-docs/guides/images/announce}"
mkdir -p "$OUT"
node --input-type=module -e "
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1180, height: 1200 }, deviceScaleFactor: 2 });
await page.goto('file://$PWD/docs/guides/late-slip-announce.html', { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.locator('#info').screenshot({ path: '$OUT/late-slip-info.png' });
await browser.close();
"
ls -la "$OUT/late-slip-info.png"
