# Athlete apps (snapshots in this repo)

GitHub `cursor[bot]` **cannot push** to `strengthside` or `Engine-side-` (403). The V1 logger/kernel wiring lives here so it can ship on `the-adaptivebrain-`.

| Path | Upstream | Notes |
| --- | --- | --- |
| `apps/strength/` | `reflectprotect123-max/strengthside` `apps/athlete` | Effort popover + Brain `decideNext` / `close` |
| `apps/engine/` | `reflectprotect123-max/Engine-side-` | Rest EMH + Brain `open` / `decideNext` / `close` + home zones |

Kernel browser bundle: `packages/brain/browser-iife.js` (copied to each app as `brain-kernel.js`).

Merged to `main`:

- Strength: https://github.com/reflectprotect123-max/strengthside/pull/218
- Engine: https://github.com/reflectprotect123-max/Engine-side-/pull/8

Re-publish: `./scripts/publish-sibling-apps.sh` (uses `GH_SIBLING_PUSH_TOKEN` or `~/.config/hybrid/gh-sibling-push-token`).
