# Lift memory + snapshot sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seed next-session load from LAST + e1RM/%/LWP, show LAST ≠ Working Max, and snapshot-sync Strength + Engine to Supabase without changing logger chrome.

**Architecture:** Pure helpers in `packages/brain` (`load.js`). Strength `session.js` remembers by lift title and seeds first empty kg. Logger only reads those numbers into the existing WM/LAST rows. Plan-sync packs `liftMemory`. Engine gets the same snapshot helper on `engine_side`. Capgo OTA after tests.

**Tech Stack:** Node.js `node:test`, ESM kernel, vanilla IIFE apps, existing `upsert_athlete_domain_snapshot` RPC, Capgo CLI.

**Spec:** `docs/superpowers/specs/2026-09-13-lift-memory-sync-design.md`

## Global Constraints

- Logger layout frozen; no new columns or warm-up set logging.
- Strength effort is Easy / Medium / Hard, not RIR.
- `decideNextStrength` kg-step table stays as V1; do not change existing strength vectors.
- Never overwrite a filled kg; never invent first kg without LAST or (e1RM and lastPct).
- Stay on Brain branch `cursor/vendor-installed-github-repos-4d23`.
- Overlay Strength → `strengthside` `apps/athlete`; Engine → Engine repo root (do not delete `mobile/`, `supabase/`).
- Do not commit tokens.

---

### Task 1: Kernel load helpers

**Files:**
- Create: `packages/brain/src/load.js`
- Modify: `packages/brain/src/index.js`
- Test: `packages/brain/test/load.test.js`

**Interfaces:**
- Produces: `loadKind(columns)`, `roundToStep(kg, step)`, `estimateE1rmKg({ loadKg, reps })`, `rememberLift(prev, event)`, `openingKg(input)`, `kgFromPctPad({ columns, raw, e1rmKg })`

- [ ] **Step 1: Write failing tests** in `packages/brain/test/load.test.js` covering Epley 100×5 → 116.7, opening kg/pct/lwp, miss does not raise e1RM, blank when no history, pad 70% with e1RM 100 → 70.

- [ ] **Step 2: Run** `cd packages/brain && node --test test/load.test.js` — expect FAIL (module missing).

- [ ] **Step 3: Implement** `src/load.js` per spec §4–5.

- [ ] **Step 4: Export** from `src/index.js`. Re-run tests — PASS.

- [ ] **Step 5: Commit** `feat(brain): lift memory opening kg and e1RM`

---

### Task 2: Copy kernel IIFE

**Files:** `packages/brain/browser-iife.js`, `apps/strength/brain-kernel.js`, `apps/engine/brain-kernel.js`

- [ ] Duplicate new helpers into the IIFE `HybridBrainKernel` object (same names). Copy file to both apps.

- [ ] Run `cd packages/brain && npm test` (existing + new). PASS.

---

### Task 3: Strength session memory

**Files:**
- Modify: `apps/strength/session.js`
- Test: `apps/strength/session.test.js`

**Interfaces:**
- `startSession({ ..., liftMemory })` seeds first empty `kg` / `suggestedKg` via `openingKg` + `HybridBrainKernel.open`.
- `logSet` after Brain: `rememberLift` into `session.liftMemory[normTitle]`.
- `setWorkingMax` writes `e1rmKg` on that title.

- [ ] Tests: log 100 medium → memory lastKg 100 and e1rm > 100; new startSession with that memory fills sets[0].kg; existing kg not overwritten; warmup page no liftMemory write.

- [ ] Implement. Run `cd apps/strength && node --test session.test.js`. PASS.

---

### Task 4: Logger LAST vs WM + % pad

**Files:** `apps/strength/logger.js` (`sideHtml`, `padLog` / save path)

- [ ] LAST shows `lastKg` (or None). WORKING MAX shows `e1rmKg` / typed WM.
- [ ] On `weight_pct`, convert pad 1–100 through `kgFromPctPad` before `logSet`.
- [ ] No new DOM structure beyond filling existing spans.

---

### Task 5: Persist + Strength snapshot

**Files:** `apps/strength/app.js`, `apps/strength/plan-sync.js`, `apps/strength/plan-sync.test.js`

- [ ] `defaultState.liftMemory = {}`. `save` keeps it.
- [ ] `pack` adds session row `{ id: 'lift_memory', kind: 'lift_memory', memory }`. `applyPlan` restores `state.liftMemory`.
- [ ] Test pack/apply roundtrip.

---

### Task 6: Engine snapshot sync

**Files:**
- Create: `apps/engine/plan-sync.js` (Strength copy; `DOMAIN = 'engine_side'`, `WRITER = 'engine-athlete'`; pack `engineAnchors`)
- Modify: `apps/engine/index.html` (script), `apps/engine/app.js` (`schedulePush` / `syncNow` like Strength), `apps/engine/service-worker.js`, `apps/engine/scripts/assemble-pages.sh` (`brain-kernel.js`, `plan-sync.js`)
- Test: `apps/engine/plan-sync.test.js`

---

### Task 7: Cache + handoff

- Strength SW cache `the-brain-v15`; Engine `the-engine-v3`.
- Update root `HANDOFF.md` with this feature + Capgo versions after ship.

---

### Task 8: Verify, overlay, OTA

- [ ] `cd packages/brain && npm test`
- [ ] `cd apps/strength && node --test session.test.js library.test.js plan-sync.test.js`
- [ ] `cd apps/engine && node --test engine.test.js session.test.js library.test.js plan-sync.test.js`
- [ ] Overlay sibling `main` (new branch names, not old `cursor/emh-logger-4d23`).
- [ ] Capgo Strength **1.0.86**, Engine **1.0.7**, channels live + dogfood.

## Spec coverage

| Spec § | Task |
| --- | --- |
| 2 LAST ≠ WM | 4 |
| 3–5 memory / e1RM / opening | 1, 3 |
| 6 Engine last output + no extra Strength metrics | 6 (anchors only) |
| 7 Sync | 5, 6 |
| 9 Dogfood | 8 |
| 10 Tests | 1, 3, 5, 6, 8 |
