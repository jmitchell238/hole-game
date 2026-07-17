#!/usr/bin/env bash
# Run VoidRush perf suite in headless Chrome (WSL-friendly).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CHROME="${CHROME:-/mnt/c/Program Files/Google/Chrome/Application/chrome.exe}"
URL="file:///C:/Users/jmitc/workspace/hole-game/tests/perf/perf.html"

if [[ ! -x "$CHROME" && ! -f "$CHROME" ]]; then
  echo "Chrome not found at: $CHROME" >&2
  exit 1
fi

echo "Running perf suite: $URL"
OUT="$("$CHROME" \
  --headless=new --disable-gpu --enable-unsafe-swiftshader \
  --enable-logging=stderr --virtual-time-budget=90000 \
  --window-size=1280,720 \
  "$URL" 2>&1 || true)"

echo "$OUT" | grep -a '^PERF \|PERF ' || echo "$OUT" | grep -a PERF || true

if echo "$OUT" | grep -aq 'PERF RESULT pass'; then
  echo "PERF suite: PASS"
  exit 0
fi
echo "PERF suite: FAIL (see PERF FAIL lines above)"
exit 1
