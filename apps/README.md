# Athlete apps (snapshots in this repo)

V1 logger/kernel wiring also lives on the upstream remotes’ `main`:

| Path | Upstream | Notes |
| --- | --- | --- |
| `apps/strength/` | `reflectprotect123-max/strengthside` `apps/athlete` @ `24376dc` | Effort popover + Brain `decideNext` / `close` |
| `apps/engine/` | `reflectprotect123-max/Engine-side-` @ `c81c484` | Rest EMH + Brain `open` / `decideNext` / `close` + home zones (no Adaptive `softenOpen`) |

Kernel browser bundle: `packages/brain/browser-iife.js` (copied to each app as `brain-kernel.js`).

Merged to sibling `main`:

- Strength: https://github.com/reflectprotect123-max/strengthside/pull/218
- Engine logger: https://github.com/reflectprotect123-max/Engine-side-/pull/8
- Engine kernel-only open/close: https://github.com/reflectprotect123-max/Engine-side-/pull/9

`cursor[bot]` cannot push those remotes (403). Re-publish: `./scripts/publish-sibling-apps.sh` with `GH_SIBLING_PUSH_TOKEN`. Do not store PATs in git.
