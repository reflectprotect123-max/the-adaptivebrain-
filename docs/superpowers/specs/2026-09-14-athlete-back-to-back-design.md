# Athlete stack sequence — Coach APK first

**Date:** 2026-09-14  
**Status:** approved in chat (Coach APK → Totem → WHOOP → byte-by-byte debug; Approach A later; no merge; no `---` door)  
**Constraint:** live TRACK (`com.hybrid.athlete`) and Engine (`com.hybrid.engine`) must not break. Do not restyle frozen loggers. Do not change kernel math.

**Authority:** this spec for *order of work* and Coach native shell. Logger UX and `decideNext` stay in `2026-09-13-adaptivebrain-v1-design.md`. Totem slice: `2026-09-14-whoop-totem-mcp-design.md`.

---

## ELI5

First we put **Coach** on the phone as its own icon. Then we plug in **Totem**. Then **WHOOP** talks through Totem. Then we check every hop with evidence (no guessing). TRACK and Engine stay two separate gym apps. Settings switches that open the other gym app come **after** that, not before.

---

## Locked

| Decision | Meaning |
| --- | --- |
| Order | **1 Coach APK → 2 Totem → 3 WHOOP ingest → 4 systematic debug.** Do not skip ahead. |
| No merge | Do not fuse TRACK and Engine. Do not load gym loggers inside Coach. |
| Coach package | Android `applicationId` **`com.hybrid.coach`** (same id as the Windows Electron shell in `strengthside` `apps/desktop`). Third icon. |
| Coach HTML | Wrap **`apps/coach/coach.html`** (Hybrid Coach home you locked), **not** `apps/coach/index.html` (different older workspace). |
| Totem | [thebriangao/totem](https://github.com/thebriangao/totem). Not mmnto-ai/totem. Full projection = Coach analytics (after APK exists). Brain still Recovery → `dailyZones` only. |
| Approach A | Me TRACK/Engine switches open the sibling gym APK. **Phase 5.** |
| No `---` | No hidden door on athlete chrome. |
| Wall | `strength_side` vs `engine_side`. Never mix `decideNext` kinds. |
| Loggers frozen | No new columns, sheets, restyle, RIR, 1–5 feel, Engine visual redesign. |

---

## Surgical law

**Violating the letter is violating the spirit.**

**Do not touch for phase 1 (Coach APK)**

- `packages/brain/src/*`, `00-RULE-CONFIG.json`, `00-TEST-VECTORS.json`
- Strength / Engine `Logger.paint`, `logSet`, `decideNext`, lift memory
- Capgo app ids / channels of **athlete** and **engine**
- Edge `whoop-*` (leave fallback as-is, including live 503 until phase 3–4)
- Vendor Totem source / iOS private API
- `apps/coach/index.html` content rewrite
- Parked `HANDOFF.md` items

If a change needs gym logger files or kernel math, **stop**.

---

## Phase 1 — Coach APK (this plan)

**Repo:** `https://github.com/reflectprotect123-max/coach-side` (own GitHub tree, **not** `strengthside`, **not** Engine). Until that remote exists, the tree lives in Brain `apps/coach-side/` and is pushed with `scripts/push-coach-side-repo.sh` + a classic PAT (`GH_SIBLING_PUSH_TOKEN`). The Cloud Agent GitHub App token **cannot** create repos.

**Shape:** New Capacitor Android shell, copy of the athlete pattern (`apps/mobile/capacitor`) but **minimal plugins**: `@capacitor/core`, `@capacitor/android`, `@capacitor/app`, `@capgo/capacitor-updater`. No Bluetooth, camera, barcode, keep-awake unless Coach HTML already requires them (it does not for home).

**www:** Sync script copies `coach.html` → `www/index.html` plus the `./` scripts `coach.html` already loads (`whoop.js`, `coach-*.js`, `log-columns.js`, `exercise-search*.js`). Do not copy `*.smoke.mjs`.

**OTA:** New Capgo app id `com.hybrid.coach`, pin `live` the same way athlete `native-bridge.js` pins live. Human must create the Capgo app; agent must not invent a token.

**Desktop:** Windows Electron stays. Do not delete `apps/desktop`. APK is an extra shell, not a replacement.

**WHOOP in this phase:** `coach.html` may keep existing `whoop.js`. Do **not** retarget it to Totem yet. Do **not** add OAuth intent filters copied from athlete (`com.hybrid.athlete://whoop`) onto Coach. Coach must not steal the gym WHOOP callback.

**Success:** Debug APK launches Coach home (the locked Hybrid layout). Existing Coach smoke tests still pass. Athlete and Engine APKs unchanged.

---

## Phase 2 — Totem (own plan, after Coach APK is installable)

Consume Totem as an **external** adapter. Do not vendor the iOS private client. Coach is the MCP/analytics host. Brain still does not become 55 tools.

---

## Phase 3 — WHOOP through Totem (own plan, after Totem talks)

Happy path: WHOOP → Totem → Recovery slice → Brain `dailyZones` → Engine home. Dual-run Edge `whoop-sync` until Totem recovery is proven. Do not delete Edge functions in the first Totem commit.

---

## Phase 4 — Byte-by-byte systematic debug (own plan)

**REQUIRED:** `systematic-debugging`. No fix without root cause. No bundled “while I’m here.”

For **each** boundary, log enter/exit once, then read the logs:

1. WHOOP account / Totem auth  
2. Totem Recovery object (0–100, sample time)  
3. Mapper → `{ recovery, capturedAt }`  
4. Brain `dailyZones({ recovery })` BPM triple  
5. Engine home card render  
6. Coach analytics (full projection) — must not write `decideNext`

Live `whoop-callback` 503: already hypothesized as missing `whoopCallbackUrl` in Engine `_shared/auth.ts`. Phase 4 **re-proves** with GET/OPTIONS + worker boot logs before any further Edge change. If ≥3 failed fixes, stop and question architecture with the human.

**Do not** start phase 4 by “just redeploying” unless evidence from this list says that hop is the failure.

---

## Phase 5 — Gym back-to-back switches (own plan, after 1–4)

Me card on TRACK and Engine: switches open `com.hybrid.athlete` / `com.hybrid.engine`. Navigation only. Dedicated scheme, never WHOOP callback URLs. Missing APK → stay on Me.

---

## Error handling (phase 1)

| Case | Result |
| --- | --- |
| Sync missed a JS file | Coach console 404; fix the copy list; do not ship |
| Capgo app missing | APK still runs local www; updater no-ops |
| Human opens Coach instead of TRACK | Expected; gym apps untouched |

---

## Explicit non-goals (phase 1)

One gym APK, shared WebView, `---` button, Totem, Edge OAuth rewrite, Engine restyle, TrainHeroic import, Concept2 OAuth, kernel changes, rewriting `apps/coach/index.html` into `coach.html`.
