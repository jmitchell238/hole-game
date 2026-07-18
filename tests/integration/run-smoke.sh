#!/usr/bin/env bash
# Run VoidRush per-level smoke suite in headless Chrome (WSL-friendly).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CHROME="${CHROME:-/mnt/c/Program Files/Google/Chrome/Application/chrome.exe}"
URL="file:///C:/Users/jmitc/workspace/hole-game/tests/integration/smoke-levels.html"

if [[ ! -x "$CHROME" && ! -f "$CHROME" ]]; then
  echo "Chrome not found at: $CHROME" >&2
  exit 1
fi

echo "Running smoke suite: $URL"
OUT="$("$CHROME" \
  --headless=new --disable-gpu --enable-unsafe-swiftshader \
  --enable-logging=stderr --virtual-time-budget=180000 \
  --window-size=1280,720 \
  "$URL" 2>&1 || true)"

echo "$OUT" | grep -a '^SMOKE \|SMOKE ' || echo "$OUT" | grep -a SMOKE || true

if echo "$OUT" | grep -aq 'SMOKE RESULT pass'; then
  echo "SMOKE suite: PASS"
  exit 0
fi
echo "SMOKE suite: FAIL (see SMOKE FAIL lines above)"
exit 1
