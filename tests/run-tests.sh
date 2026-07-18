#!/usr/bin/env bash
set -euo pipefail

# Run unit tests
echo "=== Unit tests ==="
node --test tests/unit/
UNIT_EXIT=$?

# Run integration smoke tests (skip gracefully if chrome.exe missing)
echo ""
echo "=== Integration smoke tests ==="
if bash tests/integration/run-smoke.sh; then
  SMOKE_EXIT=0
else
  SMOKE_EXIT=$?
fi

# Exit with first failure
if [ $UNIT_EXIT -ne 0 ]; then
  exit $UNIT_EXIT
fi
if [ $SMOKE_EXIT -ne 0 ]; then
  exit $SMOKE_EXIT
fi
exit 0
