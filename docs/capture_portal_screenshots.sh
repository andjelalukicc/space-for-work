#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/docs/assets"
BASE="http://127.0.0.1:8888/spaceforwork-portal.html"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

if [[ ! -x "$CHROME" ]]; then
  echo "Google Chrome nije pronadjen na: $CHROME" >&2
  exit 1
fi

capture() {
  local query="$1"
  local file="$2"
  "$CHROME" \
    --headless=new \
    --disable-gpu \
    --hide-scrollbars \
    --window-size=1440,1200 \
    --run-all-compositor-stages-before-draw \
    --virtual-time-budget=5000 \
    --screenshot="$OUT/$file" \
    "${BASE}?demo=1&reset=1&${query}" >/dev/null 2>&1
  echo "Saved $OUT/$file"
}

mkdir -p "$OUT"

capture "page=home" "portal-home.png"
capture "page=coworking" "portal-coworking.png"
capture "page=membership" "portal-membership.png"
capture "page=booking" "portal-booking.png"
capture "shot=admin" "portal-admin.png"

echo "Sve screenshot slike su sacuvane u docs/assets/"
