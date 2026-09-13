# Adaptive Brain V1 — agent handoff

**If the human said “read the handoff” (or “read the hand off”), this is the file.**  
Do not start from `docs/contracts/00-HANDOFF.md` — that is the older ZIP contract.

**Then read:** V1 spec → plan → code (paths below).

**Date:** 2026-09-13  
**Start chat with:** “read the handoff” on repo `reflectprotect123-max/the-adaptivebrain-`.  
Checkout **`cursor/vendor-installed-github-repos-4d23`**, not `main`. Brain `main` is still the uploaded ZIPs (plus a tiny probe/revert). Kernel + snapshots live on this branch / [PR #1](https://github.com/reflectprotect123-max/the-adaptivebrain-/pull/1) (**draft — do not merge unless the human asks**).

---

## What is good to go

| Surface | Status |
| --- | --- |
| Strength athlete logger on **`strengthside` `main`** | **Merged** https://github.com/reflectprotect123-max/strengthside/pull/218 (`24376dc`) — overlay matched; no extra Git push |
| Engine athlete logger on **`Engine-side-` `main`** | **Merged** https://github.com/reflectprotect123-max/Engine-side-/pull/8 |
| Engine open/close kernel-only (no Adaptive soften) | **Merged** https://github.com/reflectprotect123-max/Engine-side-/pull/9 (`c81c484`) |
| Engine Capgo assemble includes `brain-kernel.js` | **Pushed** `Engine-side-` `main` `15cdca4` |
| Brain kernel + app snapshots | On this Brain **branch / draft PR #1**, not on Brain `main` |
| **Capgo OTA Strength** `com.hybrid.athlete` | **`1.0.86`** live + dogfood (LAST/e1RM + `liftMemory` snapshot) |
| **Capgo OTA Engine** `com.hybrid.engine` | **`1.0.7`** live + dogfood (`engine_side` snapshot) |

**Lift memory (2026-09-13 afternoon):** LAST ≠ Working Max (e1RM). First empty kg from last working set / % WM / LWP. Logger chrome frozen. Spec `docs/superpowers/specs/2026-09-13-lift-memory-sync-design.md`. Strength snapshot includes `liftMemory`; Engine domain `engine_side`.

Athlete GitHub `main`s are the live product trees. A new agent does **not** need to re-implement EMH loggers.

Phones on the native shells pick up Capgo when they next check. Both apps now **pin the `live` channel** from `native-bridge.js` so Strength is not stuck on dogfood-only. Web/Supabase www is a separate host path; this agent ships **Capgo** for the HTML/WHOOP client. Netlify WHOOP functions are gone (404).

---

## What this product is

Adaptive Brain is a **decision hub with no athlete UI**. Athletes only use Strength and Engine.

**Approach A (locked):** Brain = deterministic `open` → `decideNext` → `close` + receipts. Apps = UI. **LLM never** for target math (coach chat only).

**Shared rule:** actual beats suggestion. Never silently save a suggestion as actual unless the logged number matches **and** effort matches intended.

**WHOOP:** daily Blue / Green / Red BPM on Engine **home**. Does not overwrite stored baselines or a **confirmed output anchor**. No athlete-visible shadow mode (`shadow_mode_required: false`).

**Dropped:** session-end “How did this session feel?” **1–5** (both apps). Done Training → summary.

**Parked (do not build):** 2k → opening pace; Engine logger visual redesign; full Strength set-architecture tables; extra machines; Concept2 Logbook OAuth; TrainHeroic import into Engine; pain prompts.

---

## Authority (if docs conflict)

1. `docs/superpowers/specs/2026-09-13-adaptivebrain-v1-design.md` — V1 athlete behaviour and Brain API (wins on Strength **EMH not RIR**, no 1–5 feel, no shadow mode).
2. `docs/contracts/00-RULE-CONFIG.json` + `00-TEST-VECTORS.json` — numbers the kernel must match.
3. `docs/contracts/00-FORMULAS-AND-RULES.md` — tables; stale sentences (“shadow mode”, “target RIR” in §10) lose to the spec/JSON.
4. `docs/contracts/00-HANDOFF.md` — older ZIP/product contract. **This file + the V1 spec supersede it** where they disagree (Brain **does** own `decideNext`).

Implementation plan: `docs/superpowers/plans/2026-09-13-adaptivebrain-v1.md` (tasks 1–9 are implemented).

---

## Kernel (`packages/brain`)

Deterministic ESM. Last run: **25 passing**.

| Surface | File | Behaviour |
| --- | --- | --- |
| Strength `decideNext` | `src/strength.js` | EMH vs intended; miss / rep shortfall −step; missing kg, reps, or effort **holds** |
| Engine `decideNext` | `src/engine.js` | Echo RPM integers; Concept2 watts `Math.round`; incomplete cannot increase |
| Anchors | `src/anchors.js` | Two observations; Echo `abs(b-a)≤1`; watts ≤3% of midpoint; confirmed = midpoint |
| WHOOP zones | `src/zones.js` | Piecewise §8; does not mutate `bgBase`. `moduleCeiling` = **highest allowed module** (0–33 blue, 34–66 green, 67–100 red), not WHOOP category names |
| Facade | `src/session.js` | `open` / `decideNext` / `close`; Engine open does **not** invent a first number |
| Browser IIFE | `browser-iife.js` | Copied to apps as `brain-kernel.js` (`HybridBrainKernel`) |

`RULE_VERSION` is `v1.0.0` on receipts. No `llm` field.

### Athlete snapshots in this repo (`apps/*`)

Keep in sync with sibling `main`s. Overlay: `apps/strength` → `strengthside` `apps/athlete`; `apps/engine` → Engine repo root (do not delete Engine `mobile/`, `supabase/`, etc.).

| Path | What |
| --- | --- |
| `apps/strength/` | Effort **column** → **small popover** Easy/Medium/Hard → green tick. Tick needs reps, kg, and effort (Miss can skip popover). `logSet` → Brain `decideNext` fills next empty row kg. Library **RPE** track removed. No 1–5 feel. |
| `apps/engine/` | Work → **rest** → EMH (no RPE slider, Stopped, cooked). Hide “Up next” until effort. `open` / `close` are **kernel-only** (no HybridAdaptive `openCond` / `softenOpen` / `closeCond`). WHOOP must **not** rewrite the output anchor. Home zone card via `dailyZones`. |

### Tests to run

```bash
cd packages/brain && npm test
cd apps/strength && node --test session.test.js library.test.js
cd apps/engine && node --test engine.test.js session.test.js library.test.js
```

Last run on this branch: kernel **33/33**, Strength snapshot **32/32**, Engine snapshot **32/32**.

---

## Locked athlete UX (do not “improve”)

**Strength logger:** Effort column → compact popover (not full-page / dim sheet) → Easy / Medium / Hard → tick. Tick requires reps, kg, **and** effort unless Miss.

**Engine logger:** work → rest → EMH → `decideNext` → next target. No RPE, Stopped, or cooked.

**Library:** do not put RPE back on “what do you want to track?”.

---

## Cloud / GitHub (read this before trying to push apps)

- Environment is **personal** and lists only `the-adaptivebrain-`: [2c6b12e6-af02-11f1-bf4b-42ffb4d10ea7](https://cursor.com/dashboard/cloud-agents/environments/e/2c6b12e6-af02-11f1-bf4b-42ffb4d10ea7).
- Git identity is **`cursor[bot]`**. `gh repo list` is one repo. Push to Strength/Engine as the bot is **403**. Public **read** works.
- The Cursor GitHub App being installed on “all repos” does **not** enlarge this VM’s token. Fine-grained `github_pat_` with Contents **Read-only** also 403s (`Resource not accessible by personal access token`). A **classic `ghp_` with `repo`** was able to write.
- `.cursor/environment.json` lists `repositoryDependencies` for the two app repos (dashboard JSON cannot hold that field). **A new chat still gets a one-repo bot token** until Cursor remints after that config is actually used at boot.
- Do **not** commit tokens. Do **not** keep a PAT on disk for the next chat. If apps need another overlay, ask the human for a **new** classic PAT with `repo` (any PAT pasted in chat should be **revoked** in GitHub → Settings → Developer settings → Personal access tokens).
- 2026-09-13: a classic PAT confirmed `push: true` on both remotes. **No overlay was required** — Strength #218 and Engine #8/#9 are already on `main`.
- Re-publish overlay: `./scripts/publish-sibling-apps.sh` (needs `GH_SIBLING_PUSH_TOKEN`). Do not force-push `cursor/emh-logger-4d23` / `cursor/engine-emh-4d23`; those predate merge. Use a new branch name.
- Create-environment picker “no matching repos” is a known Cursor bug; do not uninstall/reinstall the GitHub App as the first fix.

---

## Next work (in order)

1. New agent: stay on `cursor/vendor-installed-github-repos-4d23`. Do **not** re-litigate EMH vs RIR, 1–5 feel, or shadow mode.
2. **Merge Brain PR #1** only if the human wants kernel + snapshots + vendored skills on Brain `main`.
3. If changing kernel math: edit `packages/brain/src/*`, rebuild `browser-iife.js`, copy to both `brain-kernel.js` files, then overlay onto sibling `main`s with a write token.
4. Optional: human deploys Strength/Engine web hosts (Supabase Edge `www`/`strength`) if they still want browser URLs in sync. Capgo OTA is Strength **1.0.85** and Engine **1.0.6**. WHOOP on phones uses Edge, not Netlify.
5. Do **not** implement parked items.

---

## Rulings already made (do not re-litigate)

- Stay on `cursor/vendor-installed-github-repos-4d23` in this repo (do not invent extra Brain branches).
- Two-observation anchors: midpoint `(a+b)/2` (same as median for n=2).
- `moduleCeiling` is highest allowed **module**, not WHOOP green/yellow/red category names.
- Engine `echo` **machine** in the app is still **watts**; RPM table is for `modality === 'rpm'` (fan).
- WHOOP recovery must not soften / rewrite last Close output.
- Do not tell the human to “start a new Cloud Agent” to fix sibling 403; that only helps if the **environment repo list / PAT** actually includes write. Classic PAT in-chat is what worked.

---

## File map

| Path | Role |
| --- | --- |
| `HANDOFF.md` | **This file** — current agent start |
| `docs/superpowers/specs/2026-09-13-adaptivebrain-v1-design.md` | Locked V1 product |
| `docs/superpowers/plans/2026-09-13-adaptivebrain-v1.md` | Task list (1–9, done) |
| `docs/contracts/00-*` | Formulas, rule JSON, vectors, older ZIP handoff |
| `packages/brain/` | Kernel |
| `apps/strength/`, `apps/engine/` | Wired athlete UI snapshots |
| `scripts/publish-sibling-apps.sh` | Overlay snapshots onto sibling remotes |
| `.cursor/environment.json` | `repositoryDependencies` for the two apps |
| `docs/wiring/` | House-wiring map: fuse box drawing + Graphify orb (`index.html`, `graphify-out/graph.html`, `callflow.html`) |
