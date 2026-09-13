#!/usr/bin/env bash
# Static site for Capacitor www + Supabase Storage (engine-web).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${1:-"$ROOT/_site"}"
rm -rf "$DEST"
mkdir -p "$DEST/connectors" "$DEST/vendor" "$DEST/assets"
cp "$ROOT/index.html" "$DEST/"
cp "$ROOT/engine-config.js" "$DEST/"
for f in app.js engine.js session.js library.js library-ui.js timer.js logger.js native-bridge.js adaptive-bundle.js brain-bundle.js brain-kernel.js plan-sync.js service-worker.js PRODUCT.json home.css logger.css library.css; do
  cp "$ROOT/$f" "$DEST/"
done
cp "$ROOT/connectors/whoop.js" "$DEST/connectors/"
cp "$ROOT/vendor/supabase.min.js" "$DEST/vendor/"
cp "$ROOT/assets/hpp-logo.jpg" "$DEST/assets/"
touch "$DEST/.nojekyll"
echo "assembled $DEST"
