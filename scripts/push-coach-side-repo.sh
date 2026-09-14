#!/usr/bin/env bash
# Overlay Brain apps/coach-side onto github.com/reflectprotect123-max/The-coach (repo root).
# Requires GH_SIBLING_PUSH_TOKEN (classic PAT with repo). Do not commit the token.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TOKEN="${GH_SIBLING_PUSH_TOKEN:-}"
if [[ -z "$TOKEN" && -f "$HOME/.config/hybrid/gh-sibling-push-token" ]]; then
  TOKEN="$(cat "$HOME/.config/hybrid/gh-sibling-push-token")"
fi
OWNER="${COACH_SIDE_OWNER:-reflectprotect123-max}"
NAME="${COACH_SIDE_REPO:-The-coach}"
REPO="${OWNER}/${NAME}"
BRANCH="${COACH_SIDE_BRANCH:-main}"
WORKDIR="${TMPDIR:-/tmp}/the-coach-overlay-$$"
mkdir -p "$WORKDIR"
cleanup() { rm -rf "$WORKDIR"; }
trap cleanup EXIT

auth_url() {
  if [[ -n "$TOKEN" ]]; then
    printf 'https://x-access-token:%s@github.com/%s.git' "$TOKEN" "$REPO"
  else
    printf 'https://github.com/%s.git' "$REPO"
  fi
}

git clone --depth 20 "$(auth_url)" "$WORKDIR/repo"
git -C "$WORKDIR/repo" checkout -B "$BRANCH"
# Copy snapshot onto repo root; keep existing .git
tar -C "$ROOT/apps/coach-side" --exclude=capacitor/www --exclude=node_modules -cf - . \
  | tar -C "$WORKDIR/repo" -xf -
git -C "$WORKDIR/repo" add -A
if git -C "$WORKDIR/repo" diff --cached --quiet; then
  echo "No changes for $REPO"
  exit 0
fi
git -C "$WORKDIR/repo" -c user.email=cursoragent@cursor.com -c user.name='Cursor Agent' \
  commit -m "chore: overlay Coach snapshot from Adaptive Brain"
git -C "$WORKDIR/repo" push -u origin "$BRANCH"
echo "Pushed https://github.com/${REPO} ${BRANCH}"
