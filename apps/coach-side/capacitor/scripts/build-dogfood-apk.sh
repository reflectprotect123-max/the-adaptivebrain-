#!/usr/bin/env bash
# Build a debug APK of THE Hybrid Coach (com.hybrid.coach).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
bash scripts/sync-coach-apk.sh
cd "$ROOT/capacitor"
if [[ ! -x node_modules/.bin/cap ]]; then
  npm install --no-fund --no-audit
fi
npx cap sync android

if [[ -z "${ANDROID_HOME:-}${ANDROID_SDK_ROOT:-}" ]]; then
  for candidate in "$HOME/Android/Sdk" /opt/android-sdk /usr/lib/android-sdk; do
    if [[ -d "$candidate" ]]; then
      export ANDROID_HOME="$candidate"
      break
    fi
  done
fi
if [[ -z "${ANDROID_HOME:-}" || ! -d "${ANDROID_HOME}" ]]; then
  echo "ANDROID_HOME not set and no SDK found. GitHub Actions installs the SDK." >&2
  exit 2
fi
export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$ANDROID_HOME}"

cd "$ROOT/capacitor/android"
chmod +x ./gradlew
./gradlew assembleDebug --no-daemon

APK="$ROOT/capacitor/android/app/build/outputs/apk/debug/app-debug.apk"
if [[ ! -f "$APK" ]]; then
  echo "Missing $APK" >&2
  exit 1
fi
NAMED="$ROOT/capacitor/android/app/build/outputs/apk/debug/the-hybrid-coach-dogfood-debug.apk"
cp -f "$APK" "$NAMED"
echo "Built: $NAMED"
