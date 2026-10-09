#!/usr/bin/env bash
# Rebuilds public/docs/line-setup-guide.pdf from docs/guides/line-setup-guide.html.
#
# Portal screenshots come from `npm run screenshots -- guide-*` (needs the dev
# server and SCREENSHOT_* env, see scripts/screenshots/README.md). LINE console
# screenshots are captured by hand into docs/guides/images/line/ (list in
# line-screenshots-needed.md). A missing image renders as a "รอภาพ" placeholder.
set -euo pipefail
cd "$(dirname "$0")/../.."

CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
if [ ! -x "$CHROME" ]; then
  echo "Chrome not found at $CHROME (set CHROME=/path/to/chrome)" >&2
  exit 1
fi

OUT="public/docs/line-setup-guide.pdf"
"$CHROME" --headless=new --disable-gpu --no-pdf-header-footer --virtual-time-budget=8000 \
  --print-to-pdf="$OUT" "file://$PWD/docs/guides/line-setup-guide.html" >/dev/null 2>&1

echo "wrote $OUT ($(du -h "$OUT" | cut -f1))"
if command -v pdfinfo >/dev/null; then pdfinfo "$OUT" | grep -E '^Pages'; fi
missing=$(grep -o 'images/line/[a-z0-9._-]*' docs/guides/line-setup-guide.html | sort -u | while read -r f; do [ -f "docs/guides/$f" ] || echo "  $f"; done)
if [ -n "$missing" ]; then printf 'LINE screenshots still missing (placeholders used):\n%s\n' "$missing"; fi
