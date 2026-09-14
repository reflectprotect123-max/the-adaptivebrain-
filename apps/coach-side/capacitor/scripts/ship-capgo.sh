#!/usr/bin/env bash
# Ship Coach HTML to Capgo live (+ optional dogfood). Fails without CAPGO_TOKEN.
#
# Usage (The-coach or Brain apps/coach-side):
#   CAPGO_BUNDLE_VERSION=1.0.0 CAPGO_TOKEN=... bash capacitor/scripts/ship-capgo.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VERSION="${CAPGO_BUNDLE_VERSION:-}"
APP_ID="${CAPGO_APP_ID:-com.hybrid.coach}"
CHANNELS="${CAPGO_CHANNELS:-live}"

if [[ -z "${CAPGO_TOKEN:-}" && -f "$ROOT/.capgo" ]]; then
  CAPGO_TOKEN="$(cat "$ROOT/.capgo")"
fi
if [[ -z "${CAPGO_TOKEN:-}" ]]; then
  echo "ship-capgo: FAIL — set CAPGO_TOKEN or create $ROOT/.capgo" >&2
  exit 1
fi
if [[ -z "$VERSION" ]]; then
  echo "ship-capgo: FAIL — set CAPGO_BUNDLE_VERSION (e.g. 1.0.0)" >&2
  exit 1
fi
if [[ "$APP_ID" != "com.hybrid.coach" ]]; then
  echo "ship-capgo: FAIL — refusing app id $APP_ID (must be com.hybrid.coach)" >&2
  exit 1
fi

bash "$ROOT/scripts/sync-coach-apk.sh"
cd "$ROOT/capacitor"
if [[ ! -x node_modules/.bin/cap ]]; then
  npm install --no-fund --no-audit
fi

echo "ship-capgo: upload $VERSION → $APP_ID channels=$CHANNELS"
npx --yes @capgo/cli@latest bundle upload "$APP_ID" \
  --apikey "$CAPGO_TOKEN" \
  --path www \
  --channel "$CHANNELS" \
  --bundle "$VERSION" \
  --comment "coach $VERSION"

IFS=',' read -r -a chans <<< "$CHANNELS"
for ch in "${chans[@]}"; do
  ch="$(echo "$ch" | tr -d ' ')"
  [[ -z "$ch" ]] && continue
  echo "ship-capgo: pin $ch → $VERSION"
  npx --yes @capgo/cli@latest channel set "$ch" "$APP_ID" \
    --apikey "$CAPGO_TOKEN" \
    --bundle "$VERSION"
done

echo "ship-capgo: done ($VERSION on $CHANNELS)."
