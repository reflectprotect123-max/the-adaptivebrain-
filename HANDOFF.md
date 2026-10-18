> Current as of 18 October 2026. `main` is `da39733`. This repository owns `packages/brain`, `apps/coach/`, and `apps/desktop/`. Coach moved here from strengthside in [PR #3](https://github.com/reflectprotect123-max/the-adaptivebrain-/pull/3). The live athlete apps stay on `strengthside` and `Engine-side-` `main`.

# Adaptive Brain — agent handoff

**If the human said “read the handoff” (or “read the hand off”), this is the file.**  
Do not start from `docs/contracts/00-HANDOFF.md`. That file is the older ZIP contract. Use it only when this file sends you there for formulas or history.

**Start chat with:** “read the handoff” on `reflectprotect123-max/the-adaptivebrain-`.  
**Stay on `main`** unless you are already mid-PR. Do not re-merge ZIP-era history. Do not continue `cursor/cloud-agent-env-2c59` — that branch landed as [PR #4](https://github.com/reflectprotect123-max/the-adaptivebrain-/pull/4).

---

## What is already on `main`

| Surface | Status |
| --- | --- |
| Brain kernel | On `main` since [PR #1](https://github.com/reflectprotect123-max/the-adaptivebrain-/pull/1) (`9ca454d`). Deterministic `open` → `decideNext` → `close`. |
| Coach web UI | `apps/coach/`. Offline demo needs no Supabase credentials. |
| Movement library | 2,120 stored rows. Search and the builder share one generated array. Version `core-120-v2+fbb-wu-cd-2026-10-16+sb-cat-2026-10-17`. |
| Session editor | Imported athlete APK builder only. The older Coach prescription sheet is removed (`da39733`). |
| Working max | e1RM by the brain Epley rule. LAST is the last working load. Warm-up and cool-down never write either. |
| Windows shell | `apps/desktop/package.json` version **1.0.7**. App id `com.hybrid.coach`. Capgo channel `coach-live`. Minimum shell for that channel is **1.0.6**. |
| Strength / Engine athlete loggers | Already on those repos’ `main`. EMH loggers and lift memory do not need to be rebuilt here. |

`apps/coach/README.md` still says “Version 1.0.3” in one sentence. That sentence is stale. Desktop version and update behaviour come from `apps/desktop/package.json` and `apps/desktop/CAPGO.md`.

---

## What happened

1. **13 September 2026 — Brain V1.** Kernel, athlete snapshots, and lift memory merged in PR #1. Strength logger overlay is strengthside PR #218. Engine logger overlays are Engine-side- PRs #8 and #9. Capgo at that time: Strength `com.hybrid.athlete` **1.0.86**, Engine `com.hybrid.engine` **1.0.7**.
2. **17 October 2026 — Coach moved here.** PR #3 (`89baede`) brought the Coach UI and Windows installer into this repo. The preserved UI source is strengthside `7d92c5b6e062e8a85f853d35bd6594731ca43056`. Shared browser contracts live in this repo. Do not fetch mutable sibling files at runtime.
3. **18 October 2026 — editing, publish, results.** [PR #5](https://github.com/reflectprotect123-max/the-adaptivebrain-/pull/5) fixed prescription editing, publication identity, and athlete result display. Desktop went 1.0.3 → 1.0.4. Publishing resolves `assigned_session` by athlete + Coach session key. Published snapshots stay frozen. Duplicate a workout to publish changed content. An unchanged re-publish keeps its original publication time. Dates move through `scheduled_date`.
4. **18 October 2026 — library, first builder, 1RM.** PR #4 added the FBB warm-up/cool-down library, a Coach warm-up → lift → cool-down builder, the Supabase catalogue snapshot, and Coach lift memory (`c400ad8` is the catalogue/1RM tip of that branch).
5. **18 October 2026 — installer link.** [PR #6](https://github.com/reflectprotect123-max/the-adaptivebrain-/pull/6) pointed the Coach download at the supported Strength installer and bumped the shell to 1.0.5.
6. **18 October 2026 — Capgo.** `c33dc85` added live UI updates for Windows Coach, with a guarded restart and recovery. Shell became 1.0.6. `158f654` documented the release command. Shipping a UI bundle is explicit: `pnpm run verify`, then `bash scripts/ship-coach-capgo.sh <bundle-version>`. Main-branch pushes run verification. They do not rebuild the installer or upload Capgo.
7. **18 October 2026 — cleanup.** `b4c314d` removed unused athlete brain modules from `apps/coach/`, made search and the builder share one catalogue array, stopped rewriting the full builtin catalogue into every save, and bumped the shell to 1.0.7. Custom exercises, working maxima, e1RM, prescriptions, and old exercise ids stay. Details: `docs/audits/2026-10-18-coach-cleanup.md`.
8. **18 October 2026 — imported builder, then the old editor left.** `b6068b1` connected the exported APK strength builder. `da39733` removed the old prescription sheet, target-effort controls, block-type editor, drag handlers, old warm-up/cool-down editor, and editor-only CSS. Write-up: `docs/releases/2026-10-18-imported-apk-builder.md`.

[PR #2](https://github.com/reflectprotect123-max/the-adaptivebrain-/pull/2) (`cursor/whoop-callback-boot-4d23`, September Capacitor APK and phone chrome) is still open. It is not the current Coach path. Leave it.

---

## Movement library

Three sources are compiled by `scripts/gen-exercise-search-index.mjs` into:

- `apps/coach/exercise-search-index.js` (`EXERCISE_SEARCH_INDEX`)
- `apps/coach/coach-exercise-catalog.js` (`COACH_EXERCISE_CATALOG` is that same array)

Do not hand-edit the generated files. Change the JSON, then run the generator.

| Source | File | Stored rows | What a new pick shows |
| --- | --- | --- | --- |
| Supabase Main catalogue | `apps/coach/data/supabase-exercise-catalogue.json` | 1,674 | All 1,674 |
| Supabase Banded catalogue | same file | 153 | All 153 |
| FBB warm-up / cool-down | `apps/coach/data/warmup-cooldown-library.json` | 115 warm-ups + 58 cool-downs = 173 | All 173 |
| Older logger ids (`core-…`) | `apps/coach/data/exercise-library.json` | 120 | 38 whose names are absent from Main |
| **Total** | | **2,120** | **2,038** |

The other 82 core rows are hidden when a Main-catalogue title matches. `core-back-squat` still resolves for a workout that already uses it. “Back Squat” appears once in a fresh search. Banded rows stay visible. Warm-up and cool-down stay visible. Four names exist in both prep sections and must keep both rows: Horse Stance Pulse, Shinbox Heel Touch, Shinbox Switch, Theraband Around the World. Horse Stance Pulse therefore returns two hits.

Catalogue snapshot metadata:

- Project `orysjncrksmdfabpuftd`
- Tables `public.exercise_catalogue` and `public.exercise_catalogue_sources`
- Cited migration: strengthside `supabase/migrations/20261018090000_exercise_catalogue.sql`
- Cited PR: [strengthside #273](https://github.com/reflectprotect123-max/strengthside/pull/273)

On 18 October 2026 that GitHub PR was still **open**. The tables can already exist in the live project. Coach ships the JSON so search works signed out. `apps/coach/coach-catalogue.js` refreshes those tables when a user is signed in. Anon cannot read them. Catalogue ids look like `exercise_` plus 16 hex characters. They are search and navigation metadata. They are not working-max keys. A refresh must not wipe local custom exercises.

Signed-in Coach reads the live catalogue. It does not own the catalogue schema. Do not add a second `exercise_catalogue` migration in this repo.

Custom movements created in the builder are stored on Coach state as `builderCatalog`. They are separate from the generated builtin array.

---

## Session builder

The editor is the athlete APK builder exported from strengthside `5551ef5a4394f16582c3a9687c38bb1e02859508`.

| File | Role |
| --- | --- |
| `apps/coach/builder/library.js` | Model |
| `apps/coach/builder/library-ui.js` | View |
| `apps/coach/builder/library.css` | Builder CSS, scoped |
| `apps/coach/builder/strength-targets.js` | Targets |
| `apps/coach/builder/host.js` | Coach adapter. Binds to `CoachBuilderHost`, not Coach account state |
| `apps/coach/builder/host.css` | Desktop placement and APK tokens |

Strength templates, including old ones, open in this builder. The flow is warm-up, then lift cards, then cool-down. Numbered sets, the photo keypad, range entry, a final AMRAP at the first working-set weight, the tempo dropdown, circuits, and supersets stay.

`host.js` translates older templates into authored lift and circuit blocks and keeps exercise ids plus existing load and history fields. Existing assigned sessions stay independent snapshots. Calendar posting selects a Coach athlete and saves an unpublished session. The existing calendar Publish sends it. It does not write athlete-local date assignments.

Conditioning and recovery blocks already saved on a template stay byte-for-byte when a strength edit is applied. The imported builder does not rewrite them.

Prep defaults inside the imported source are unchanged: five movements, three rounds; 180 seconds for Bike, Row, Run, and Ski; 60 seconds for Jump Rope. This import did not add duration or round editors to those locked prep screens.

The FBB warm-up and cool-down library is still the prep catalogue. The retirement deleted the old Coach editor for those sections. It did not delete `warmup-cooldown-library.json`.

---

## Working max and LAST

Working max is e1RM. LAST is the last working load. They are different numbers.

Browser math is `estimateE1rmKg` in `apps/coach/coach-lifts.js`, matching `packages/brain/src/load.js`: Epley, reps clamped at 20, rounded to 0.1 kg.

`e1RM = round(loadKg * (1 + min(20, reps) / 30), 1)`

Rules already implemented:

- Memory is per athlete and per normalised exercise **name**, not per catalogue id.
- A completed working set can raise e1RM only when it is not a miss and the new estimate is higher. A miss updates LAST and does not raise e1RM.
- Warm-up and cool-down (`role` warmup/cooldown, or category Warm-Up/Cool-Down) never write LAST or e1RM.
- A coach can set a working max directly (`source: coach_set`).
- The athlete-side Brain rule still stands for loggers: actual beats suggestion. Never silently save a suggestion as actual unless the logged number matches and effort matches intended.

Signed-in copy: `supabase/migrations/20261017220000_coach_lift_memory.sql`.

- Table `public.coach_lift_memory`, primary key `(athlete_id, exercise_key)`, RLS on.
- Athlete rows are the signed-in user. A coach can read an athlete when `coaches_athlete_anywhere` allows it.
- RPCs: `remember_coach_lift`, `set_coach_working_max`. SQL helper: `estimate_e1rm_kg`.
- These RPCs do not call `decideNext` and do not write `exercise_catalogue`.

`coach-lifts.js` calls those RPCs when a signed-in client exists. This handoff does not certify that the migration has been applied on the live project. Confirm the live function before changing it.

Strength assignment completion is a different store. The athlete app returns completed actuals and its canonical engine estimates in `assigned_session.athlete_result`. That schema is strengthside migration `20261018040000_coach_assignment_results.sql`. Strength owns it. Do not create a second schema here, and do not calculate that returned e1RM again in Coach. Receipt notes: strengthside `docs/coach-assignment-results.md`.

---

## Desktop and Capgo

- Product: THE Hybrid Coach. App id `com.hybrid.coach`.
- Native installer: GitHub Releases, generic feed `coach-desktop-latest`, via `electron-updater`. Publish with the **Build coach desktop** workflow. Local build: `corepack pnpm --filter @hybrid/coach-desktop run dist`.
- UI updates: `@capgo/electron-updater` 0.0.6, channel `coach-live`, ZIP only, Electron only. Minimum desktop version on the channel is 1.0.6. Documented initial live bundle is 1.0.7; the 1.0.6 shell carries the same UI as its builtin fallback.
- A background check runs five seconds after launch. A download is queued for the next full restart. It is not applied on blur or while editing. Failed bundles fall back to the last healthy bundle, then the builtin UI.
- Installer changes are required for native, main-process, preload, or dependency changes. HTML/JS/CSS can ship through Capgo.
- The app is not code-signed.
- `apps/coach/README.md` and `apps/desktop/CAPGO.md` disagree about “1.0.3” versus 1.0.6/1.0.7. Follow CAPGO.md.

Browser suites and `pnpm run verify` do not certify a physical Windows install, a live Supabase login, or a physical Strength APK.

---

## How to run

From the repo root, with the commands in `apps/coach/README.md`:

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm exec playwright install chromium
corepack pnpm run verify
python3 -m http.server 4173 --directory apps/coach
```

Cloud `start` already serves `http://127.0.0.1:4173/coach.html` when that port is up. Sign in with **Demo coach (offline)** unless the task needs a real account. `pnpm run verify` runs the brain tests and the Coach checks, including desktop typecheck, desktop updater tests, and the Playwright browser check.

Kernel-only, if you change `packages/brain`:

```sh
cd packages/brain && npm test
```

After a kernel change, rebuild `browser-iife.js` and copy it to the athlete `brain-kernel.js` files before any sibling overlay.

---

## Authority

1. This file, for what is already shipped and what to leave alone.
2. `docs/superpowers/specs/2026-09-13-adaptivebrain-v1-design.md` — V1 athlete behaviour and Brain API. Wins on Strength **EMH not RIR**, no 1–5 feel, no shadow mode.
3. `docs/contracts/00-RULE-CONFIG.json` and `00-TEST-VECTORS.json` — numbers the kernel must match.
4. `docs/contracts/00-FORMULAS-AND-RULES.md` — tables. Stale sentences (“shadow mode”, “target RIR” in §10) lose to the spec and the JSON.
5. `docs/contracts/00-HANDOFF.md` — older ZIP contract. This file and the V1 spec win where they disagree. Brain does own `decideNext`.
6. Coach behaviour that this file summarises is spelled out in `docs/releases/2026-10-18-imported-apk-builder.md`, `docs/audits/2026-10-18-coach-cleanup.md`, `apps/coach/README.md`, and `apps/desktop/CAPGO.md`.

Implementation plan `docs/superpowers/plans/2026-09-13-adaptivebrain-v1.md` tasks 1–9 are done.

---

## Settled

- Brain `main` is the live tree for the kernel. Athlete GitHub `main`s are the live Strength and Engine trees.
- Approach A: Brain is deterministic. Apps are UI. An LLM is never used for target math. Coach chat can use an LLM.
- Strength logger: effort column, compact Easy/Medium/Hard popover, green tick. Tick needs reps, kg, and effort unless Miss. No RPE track. No session-end 1–5 feel.
- Engine logger: work, then rest, then EMH. No RPE, Stopped, or cooked. `open` / `close` are kernel-only. WHOOP daily Blue/Green/Red on Engine home does not rewrite a confirmed output anchor or stored baselines. No athlete-visible shadow mode.
- LAST and working max stay separate on the athlete loggers too. Spec: `docs/superpowers/specs/2026-09-13-lift-memory-sync-design.md`.
- Two-observation anchors use the midpoint `(a+b)/2`.
- `moduleCeiling` is the highest allowed module (0–33 blue, 34–66 green, 67–100 red), not a WHOOP colour name.
- Engine `echo` machine in the app is watts. The RPM table is for `modality === 'rpm'`.
- The Coach editor is the imported APK builder. The FBB prep library and the 2,120-row movement index stay.
- Catalogue rows do not share working maxes across exercises and do not authorise strength progression by themselves.
- Parked, and still parked: 2k opening pace, Engine logger visual redesign, full Strength set-architecture tables, extra machines, Concept2 Logbook OAuth, TrainHeroic import into Engine, pain prompts.

---

## Cloud and GitHub

- This environment is personal and lists `the-adaptivebrain-`. Git identity is `cursor[bot]`. Push to `strengthside` or `Engine-side-` as the bot returns 403. Public read works.
- A Cursor GitHub App installed on all repos does not enlarge this VM’s token. A classic PAT with `repo` was what could push to the sibling repos on 13 September 2026. Do not commit a token. Do not leave a PAT on disk. If a sibling overlay is required, ask the human for a new classic PAT and tell them to revoke any token pasted in chat.
- Sibling overlay script: `./scripts/publish-sibling-apps.sh` with `GH_SIBLING_PUSH_TOKEN`. Snapshots: `apps/strength/` overlays strengthside `apps/athlete`; `apps/engine/` overlays the Engine repo root and must not delete Engine `mobile/` or `supabase/`.
- On 13 September 2026 no further overlay was required. Strength #218 and Engine #8/#9 were already on `main`.
- Re-publishing Capgo or the Windows installer is a human release step, not part of an ordinary code change.

---

## For the next agent

Read this file, then the release note and the cleanup audit if the task touches Coach. The movement library, the imported builder, and the working-max rules above are the current product. Verify against `origin/main` before changing counts, ids, or editor flow.

Useful checks when touching this area:

- `apps/coach/coach-cleanup.smoke.mjs` — one shared catalogue, Back Squat once, `core-back-squat` still resolves, 153 banded, Horse Stance Pulse twice.
- `apps/coach/coach-imported-builder.smoke.mjs` and `apps/coach/builder/library-ui.test.mjs` — imported editor.
- `apps/coach/coach-lifts.smoke.mjs` and `apps/coach/coach-catalogue.smoke.mjs` — e1RM and catalogue refresh.
- `pnpm run verify` before calling Coach done.

Loose ends that are status, not a request to rebuild:

- strengthside #273 was still open. Confirm live catalogue rows before editing the snapshot.
- Confirm `coach_lift_memory` exists on the live project before changing the RPCs.
- PR #2 is a stale Coach branch. Leave it.
- Correct the stale “1.0.3” sentence in `apps/coach/README.md` if you touch that file.
- A published 1.0.7 installer exists only if the desktop workflow was dispatched after `b4c314d`. The version in git is 1.0.7 either way.

---

## File map

| Path | Role |
| --- | --- |
| `HANDOFF.md` | This file. Current agent start |
| `AGENTS.md` | “Read the handoff” rule and the local Coach server |
| `packages/brain/` | Kernel |
| `apps/coach/` | Coach web UI, library JSON, imported builder |
| `apps/coach/data/exercise-library.json` | 120 older logger movements |
| `apps/coach/data/warmup-cooldown-library.json` | 115 warm-ups, 58 cool-downs |
| `apps/coach/data/supabase-exercise-catalogue.json` | 1,674 Main + 153 Banded offline snapshot |
| `scripts/gen-exercise-search-index.mjs` | Regenerates the shared search/catalog files |
| `apps/coach/coach-lifts.js` | LAST and working max |
| `apps/coach/coach-catalogue.js` | Signed-in catalogue read |
| `supabase/migrations/20261017220000_coach_lift_memory.sql` | Signed-in lift-memory table and RPCs |
| `apps/desktop/` | Windows shell, Capgo wrapper |
| `apps/strength/`, `apps/engine/` | Athlete UI snapshots for sibling overlay |
| `docs/superpowers/specs/2026-09-13-adaptivebrain-v1-design.md` | Locked V1 athlete/Brain spec |
| `docs/releases/2026-10-18-imported-apk-builder.md` | Why the APK builder replaced the old editor |
| `docs/audits/2026-10-18-coach-cleanup.md` | Catalogue dedupe and save-size cleanup |
| `docs/contracts/00-*` | Formulas, rule JSON, vectors, older ZIP handoff |
| `docs/wiring/` | House-wiring map |
| `scripts/publish-sibling-apps.sh` | Overlay snapshots onto sibling remotes |
| `scripts/ship-coach-capgo.sh` | Explicit Coach UI bundle upload |
