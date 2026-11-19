#!/usr/bin/env bash
# Renders the two LINE announcement images (info + mini manual) from
# docs/guides/pricing-packages-announce.html to PNG at 2x (2160px wide).
# Usage: docs/guides/build-pricing-announce.sh [out_dir]   (default docs/guides/images/announce)
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT="${1:-docs/guides/images/announce}"
mkdir -p "$OUT"
node --input-type=module -e "
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1180, height: 1200 }, deviceScaleFactor: 2 });
await page.goto('file://$PWD/docs/guides/pricing-packages-announce.html', { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
for (const id of ['info', 'manual']) {
  await page.locator('#' + id).screenshot({ path: '$OUT/pricing-' + id + '.png' });
}
await browser.close();
"
ls -la "$OUT"
