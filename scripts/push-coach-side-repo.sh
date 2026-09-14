#!/usr/bin/env bash
# Create github.com/reflectprotect123-max/coach-side (if missing) and push apps/coach-side as repo root.
# Requires GH_SIBLING_PUSH_TOKEN (classic PAT with repo scope). Do not commit the token.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TOKEN="${GH_SIBLING_PUSH_TOKEN:-}"
if [[ -z "$TOKEN" && -f "$HOME/.config/hybrid/gh-sibling-push-token" ]]; then
  TOKEN="$(cat "$HOME/.config/hybrid/gh-sibling-push-token")"
fi
if [[ -z "$TOKEN" ]]; then
  echo "Set GH_SIBLING_PUSH_TOKEN (classic PAT, repo scope). This Cloud Agent GitHub App token cannot create repos." >&2
  exit 1
fi
OWNER="${COACH_SIDE_OWNER:-reflectprotect123-max}"
NAME="${COACH_SIDE_REPO:-coach-side}"
API="https://api.github.com/repos/${OWNER}/${NAME}"
code="$(curl -sS -o /tmp/coach-side-repo.json -w '%{http_code}' \
  -H "Authorization: Bearer ${TOKEN}" -H "Accept: application/vnd.github+json" "$API")"
if [[ "$code" == "404" ]]; then
  echo "Creating ${OWNER}/${NAME} …"
  curl -sS -f -X POST "https://api.github.com/user/repos" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    -d "{\"name\":\"${NAME}\",\"description\":\"THE Hybrid Coach — third app (not TRACK, not Engine)\",\"private\":false,\"auto_init\":false}" \
    >/tmp/coach-side-create.json
elif [[ "$code" != "200" ]]; then
  echo "GitHub GET ${API} HTTP ${code}" >&2
  cat /tmp/coach-side-repo.json >&2
  exit 1
fi
WORKDIR="${TMPDIR:-/tmp}/coach-side-push-$$"
rm -rf "$WORKDIR"
mkdir -p "$WORKDIR"
tar -C "$ROOT/apps/coach-side" -cf - . | tar -C "$WORKDIR" -xf -
cd "$WORKDIR"
git init -b main
git add -A
git -c user.email=cursoragent@cursor.com -c user.name='Cursor Agent' \
  commit -m "feat: THE Hybrid Coach side (HTML + Capacitor config)"
git remote add origin "https://x-access-token:${TOKEN}@github.com/${OWNER}/${NAME}.git"
git push -u origin main
echo "Pushed https://github.com/${OWNER}/${NAME}"
