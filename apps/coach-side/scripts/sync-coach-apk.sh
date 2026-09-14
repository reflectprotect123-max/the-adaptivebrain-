#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT"
DEST="$SRC/capacitor/www"
mkdir -p "$DEST"
cp "$SRC/coach.html" "$DEST/index.html"
for f in \
  whoop.js \
  exercise-search-index.js \
  exercise-search.js \
  coach-exercise-catalog.js \
  coach-loop.js \
  log-columns.js \
  coach-nutrition.js \
  coach-bridge.js \
  coach-cloud.js \
  coach-views.js \
  coach-native-bridge.js
do
  cp "$SRC/$f" "$DEST/$f"
done
echo "Coach APK www ready at $DEST"
