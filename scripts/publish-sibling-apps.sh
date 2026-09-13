#!/usr/bin/env bash
# Overlay Brain app snapshots onto the public Strength/Engine remotes and push.
# Requires write access (GH_SIBLING_PUSH_TOKEN or a cursor[bot] token that includes those repos).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TOKEN="${GH_SIBLING_PUSH_TOKEN:-}"
if [[ -z "$TOKEN" && -f "$HOME/.config/hybrid/gh-sibling-push-token" ]]; then
  TOKEN="$(cat "$HOME/.config/hybrid/gh-sibling-push-token")"
fi
WORKDIR="${TMPDIR:-/tmp}/publish-sibling-apps-$$"
mkdir -p "$WORKDIR"
cleanup() { rm -rf "$WORKDIR"; }
trap cleanup EXIT

auth_url() {
  local repo="$1"
  if [[ -n "$TOKEN" ]]; then
    printf 'https://x-access-token:%s@github.com/%s.git' "$TOKEN" "$repo"
  else
    printf 'https://github.com/%s.git' "$repo"
  fi
}

publish() {
  local repo="$1"
  local branch="$2"
  local src="$3"
  local dest_rel="$4"
  local dir="$WORKDIR/$(basename "$repo")"
  git clone --depth 50 "$(auth_url "$repo")" "$dir"
  git -C "$dir" checkout -B "$branch"
  local dest="$dir/$dest_rel"
  mkdir -p "$dest"
  tar -C "$src" -cf - . | tar -C "$dest" -xf -
  git -C "$dir" add -A
  if git -C "$dir" diff --cached --quiet; then
    echo "No changes for $repo"
    return 0
  fi
  git -C "$dir" -c user.email=cursoragent@cursor.com -c user.name='Cursor Agent' \
    commit -m "feat: wire Adaptive Brain V1 logger (EMH + decideNext)"
  git -C "$dir" push -u origin "$branch"
  echo "Pushed $repo $branch"
}

publish reflectprotect123-max/strengthside cursor/emh-logger-4d23 \
  "$ROOT/apps/strength" apps/athlete
publish reflectprotect123-max/Engine-side- cursor/engine-emh-4d23 \
  "$ROOT/apps/engine" .
