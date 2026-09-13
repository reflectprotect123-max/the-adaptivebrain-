# Athlete apps (snapshots in this repo)

GitHub `cursor[bot]` **cannot push** to `strengthside` or `Engine-side-` (403). The V1 logger/kernel wiring lives here so it can ship on `the-adaptivebrain-`.

| Path | Upstream | Notes |
| --- | --- | --- |
| `apps/strength/` | `reflectprotect123-max/strengthside` `apps/athlete` | Effort popover + Brain `decideNext` / `close` |
| `apps/engine/` | `reflectprotect123-max/Engine-side-` | Rest EMH + Brain `open` / `decideNext` / `close` + home zones |

Kernel browser bundle: `packages/brain/browser-iife.js` (copied to each app as `brain-kernel.js`).

Upstream drafts (do not merge unless asked):

- Strength: https://github.com/reflectprotect123-max/strengthside/pull/218 (`cursor/emh-logger-4d23`)
- Engine: https://github.com/reflectprotect123-max/Engine-side-/pull/8 (`cursor/engine-emh-4d23`)

Re-publish: `GH_SIBLING_PUSH_TOKEN=… ./scripts/publish-sibling-apps.sh`
