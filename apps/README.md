# Athlete apps (snapshots in this repo)

GitHub `cursor[bot]` **cannot push** to `strengthside` or `Engine-side-` (403). The V1 logger/kernel wiring lives here so it can ship on `the-adaptivebrain-`.

| Path | Upstream | Notes |
| --- | --- | --- |
| `apps/strength/` | `reflectprotect123-max/strengthside` `apps/athlete` | Effort popover + Brain `decideNext` / `close` |
| `apps/engine/` | `reflectprotect123-max/Engine-side-` | Rest EMH + Brain `open` / `decideNext` / `close` + home zones |

Kernel browser bundle: `packages/brain/browser-iife.js` (copied to each app as `brain-kernel.js`).

To publish upstream later, copy these trees onto `cursor/emh-logger-4d23` / `cursor/engine-emh-4d23` with a token that can write those remotes.
