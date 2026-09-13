# Adaptive Brain V1 — agent handoff

**If the human said “read the handoff” (or “read the hand off”), this is the file.**  
Do not start from `docs/contracts/00-HANDOFF.md` — that is the older ZIP contract.

**Then read:** V1 spec → plan → code (paths below).

**Date:** 2026-09-13  
**Repo:** `reflectprotect123-max/the-adaptivebrain-`  
**Working branch:** `cursor/vendor-installed-github-repos-4d23`  
**PR:** https://github.com/reflectprotect123-max/the-adaptivebrain-/pull/1 (draft, base `main`)  
**Do not merge to `main` unless the human asks.**

---

## What this product is

Adaptive Brain is a **decision hub with no athlete UI**. Athletes only use:

| App | Upstream GitHub | Logs |
| --- | --- | --- |
| Strength / TRACK | `reflectprotect123-max/strengthside` | kg, reps, Easy / Medium / Hard |
| Engine | `reflectprotect123-max/Engine-side-` | actual output, Easy / Medium / Hard |

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

Implementation plan: `docs/superpowers/plans/2026-09-13-adaptivebrain-v1.md`.

---

## What is done in this PR

### Kernel (`packages/brain`)

Deterministic ESM. `npm test` in that folder: **25 passing** (as of `accf9d6` / `9493e01`).

| Surface | File | Behaviour |
| --- | --- | --- |
| Strength `decideNext` | `src/strength.js` | EMH vs intended; miss / rep shortfall −step; missing kg, reps, or effort **holds** |
| Engine `decideNext` | `src/engine.js` | Echo RPM integers; Concept2 watts `Math.round`; incomplete cannot increase |
| Anchors | `src/anchors.js` | Two observations; Echo `abs(b-a)≤1`; watts ≤3% of midpoint; confirmed = midpoint |
| WHOOP zones | `src/zones.js` | Piecewise §8; does not mutate `bgBase`. `moduleCeiling` = **highest allowed module** (0–33 blue, 34–66 green, 67–100 red), not WHOOP category names |
| Facade | `src/session.js` | `open` / `decideNext` / `close`; Engine open does **not** invent a first number |
| Browser IIFE | `browser-iife.js` | Copied to apps as `brain-kernel.js` (`HybridBrainKernel`) |

`RULE_VERSION` is `v1.0.0` on receipts. No `llm` field.

### Athlete snapshots (this repo, because sibling push is 403)

| Path | What |
| --- | --- |
| `apps/strength/` | Effort **column** → **small popover** Easy/Medium/Hard → green tick. Tick needs reps, kg, and effort (Miss can skip popover). `logSet` calls Brain `decideNext` and fills next empty row kg. Library **RPE** track removed. No 1–5 feel. |
| `apps/engine/` | Work → **rest** → EMH (no RPE slider, Stopped, cooked). Hide “Up next” until effort. `open` uses Brain (typed number or last Close). WHOOP must **not** rewrite the output anchor. `close` → `confirmAnchor`. Home zone card via `dailyZones`. |

Local sibling clones (not on GitHub):

- Strength `cursor/emh-logger-4d23` @ `2060e31` (`/tmp/strengthside` on the old VM)
- Engine `cursor/engine-emh-4d23` @ `d0a2c9d` (`/tmp/Engine-side-`)

**`cursor[bot]` cannot push those remotes (403).** Shipping UI in this PR is `apps/*`. To publish upstream, a human (or a **new** Cloud Agent whose GitHub App includes those repos) copies `apps/strength` and `apps/engine` onto those remotes.

### Tests to run

```bash
cd packages/brain && npm test
cd apps/strength && node --test session.test.js library.test.js
cd apps/engine && node --test engine.test.js session.test.js library.test.js
```

---

## Locked athlete UX (do not “improve”)

**Strength logger:** Effort column → compact popover (not full-page / dim sheet) → Easy / Medium / Hard → tick. Tick requires reps, kg, **and** effort unless Miss.

**Engine logger:** work → rest → EMH → `decideNext` → next target. No RPE, Stopped, or cooked.

**Library:** do not put RPE back on “what do you want to track?”.

---

## Cloud / GitHub

- This Cloud Agent environment is **personal** and lists only `the-adaptivebrain-`: [2c6b12e6-af02-11f1-bf4b-42ffb4d10ea7](https://cursor.com/dashboard/cloud-agents/environments/e/2c6b12e6-af02-11f1-bf4b-42ffb4d10ea7).
- Git here is **`cursor[bot]`**. `git push` to `strengthside` / `Engine-side-` returns `Permission … denied to cursor[bot]` (403). Public **read** of those remotes works.
- Dashboard `environmentJson` cannot hold `repositoryDependencies`. This branch has `.cursor/environment.json` listing both app repos so later boots can request write. **This running token does not refresh.**
- Same-chat unblock used a **classic** `ghp_` PAT (fine-grained token was read-only). `scripts/publish-sibling-apps.sh` pushed:
  - Strength https://github.com/reflectprotect123-max/strengthside/pull/218 (`cursor/emh-logger-4d23`)
  - Engine https://github.com/reflectprotect123-max/Engine-side-/pull/8 (`cursor/engine-emh-4d23`)
- Revoke that PAT after use; it was pasted in chat. `cursor[bot]` on this VM still cannot push those remotes.
- Create-environment picker “no matching repos” is a known Cursor bug; do not uninstall/reinstall the GitHub App as the first fix.

---

## Next work (in order)

1. Human reviews draft app PRs: Strength #218, Engine #8. Merge those only when the human wants V1 loggers on app `main`.
2. **Merge this Brain PR** only when the human wants kernel + snapshots on Brain `main`.
3. Do **not** implement parked items above.
4. If wiring more: keep IIFE in sync with `packages/brain/src/*` (`browser-iife.js` + copy to both `brain-kernel.js`).

---

## Rulings already made (do not re-litigate)

- Stay on `cursor/vendor-installed-github-repos-4d23` in this repo (do not invent extra Brain branches).
- Two-observation anchors: midpoint `(a+b)/2` (same as median for n=2).
- `moduleCeiling` is highest allowed **module**, not WHOOP green/yellow/red category names.
- Engine `echo` **machine** in the app is still **watts**; RPM table is for `modality === 'rpm'` (fan).
- WHOOP recovery must not soften / rewrite last Close output.

---

## File map

| Path | Role |
| --- | --- |
| `HANDOFF.md` | **This file** — current agent start |
| `docs/superpowers/specs/2026-09-13-adaptivebrain-v1-design.md` | Locked V1 product |
| `docs/superpowers/plans/2026-09-13-adaptivebrain-v1.md` | Task list (1–9) |
| `docs/contracts/00-*` | Formulas, rule JSON, vectors, older ZIP handoff |
| `packages/brain/` | Kernel |
| `apps/strength/`, `apps/engine/` | Wired athlete UI snapshots |
