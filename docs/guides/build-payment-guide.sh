#!/usr/bin/env bash
# Rebuilds public/docs/payment-booking-guide.pdf from docs/guides/payment-booking-guide.html.
#
# Screenshots come from `npm run screenshots -- pay-*` (needs the dev server and
# SCREENSHOT_* env, see scripts/screenshots/README.md). They use sample data
# relative to the capture day, so re-capture before rebuilding for a new release.
#
# Prints with Playwright's Chromium (already installed for the screenshots), so a
# Chrome window left open on this Mac does not block the headless run.
set -euo pipefail
cd "$(dirname "$0")/../.."

OUT="public/docs/payment-booking-guide.pdf"
mkdir -p "$(dirname "$OUT")"
node --input-type=module -e "
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('file://$PWD/docs/guides/payment-booking-guide.html', { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.pdf({ path: '$OUT', format: 'A4', printBackground: true, preferCSSPageSize: true });
await browser.close();
"

echo "wrote $OUT ($(du -h "$OUT" | cut -f1))"
if command -v pdfinfo >/dev/null; then pdfinfo "$OUT" | grep -E '^Pages'; fi
missing=$(grep -o 'images/product/payment-guide/[a-z0-9._-]*' docs/guides/payment-booking-guide.html | sort -u | while read -r f; do [ -f "public/$f" ] || echo "  $f"; done)
if [ -n "$missing" ]; then printf 'Screenshots missing:\n%s\n' "$missing"; fi
