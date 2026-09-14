#!/usr/bin/env bash
# Serve THIS repo's coach.html and open the Electron shell against it.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${HYBRID_COACH_PORT:-8765}"
URL="http://127.0.0.1:${PORT}/coach.html"

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 required" >&2
  exit 1
fi

if ! curl -sf "$URL" >/dev/null 2>&1; then
  echo "Starting static server on $PORT …"
  python3 -m http.server "$PORT" --directory "$ROOT" >/tmp/hybrid-coach-static.log 2>&1 &
  SERVER_PID=$!
  trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT
  for _ in $(seq 1 20); do
    curl -sf "$URL" >/dev/null 2>&1 && break
    sleep 0.25
  done
fi

export HYBRID_COACH_URL="$URL"
echo "Coach URL: $HYBRID_COACH_URL"
cd "$ROOT/desktop"
if command -v pnpm >/dev/null 2>&1; then
  pnpm start
else
  npx electron .
fi
