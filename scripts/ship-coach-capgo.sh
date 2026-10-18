#!/usr/bin/env bash
# Run from the repository root with the normal Capgo CLI login (or CAPGO_TOKEN).
set -euo pipefail
COACH_BUNDLE_VERSION="${1:?Usage: bash scripts/ship-coach-capgo.sh UNIQUE_VERSION}"
COACH_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$COACH_ROOT"
COACH_STAGE="$(mktemp -d)"
trap 'rm -rf "$COACH_STAGE"' EXIT
node scripts/stage-coach-capgo.mjs "$COACH_STAGE/www"
COACH_ARGS=()
if [[ -n "${CAPGO_TOKEN:-}" ]]; then COACH_ARGS+=(--apikey "$CAPGO_TOKEN"); fi
# The CLI's Cordova mode permits a plain web bundle without a Capacitor project.
# Its mobile notify scanner cannot see Electron main-process code. Our staging
# guard and desktop/browser tests verify the renderer -> main health handshake.
# Electron 0.0.6 supports ZIP + SHA256; do not enable delta/Brotli/encryption here.
npx --yes @capgo/cli@8.86.1 bundle upload com.hybrid.coach \
  --mode cordova --path "$COACH_STAGE/www" --channel coach-live \
  --bundle "$COACH_BUNDLE_VERSION" --min-update-version 1.0.6 \
  --package-json apps/desktop/package.json --node-modules apps/desktop/node_modules \
  --no-delta --disable-brotli --ignore-notify-app-ready --self-assign \
  --comment "Coach UI $(git rev-parse --short HEAD)" "${COACH_ARGS[@]}"
