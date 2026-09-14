# Athlete back-to-back + Totem WHOOP — surgical

**Date:** 2026-09-14  
**Status:** approved in chat (Approach A; WHOOP ingest = Totem; no merge; no `---` door)  
**Constraint:** nothing athlete-visible may break. Two live APKs stay live.

**Authority:** this spec for *navigation between apps* and *WHOOP ingest sequencing*. Logger UX and `decideNext` stay in `2026-09-13-adaptivebrain-v1-design.md`. Totem slice math stays in `2026-09-14-whoop-totem-mcp-design.md` except where this file **replaces** “Edge OAuth is the product phone path.”

---

## ELI5

Two apps. Settings has TRACK / Engine switches. Flip one → the **other installed app** opens. Homework does not mix. WHOOP talks through Totem. Engine home still only shows recovery colors. Fancy WHOOP lives in Coach later.

---

## Locked

| Decision | Meaning |
| --- | --- |
| No merge | Do not fuse `com.hybrid.athlete` and `com.hybrid.engine`. Do not load both loggers in one WebView. Do not share `localStorage`. |
| Approach A | Settings switches **open the other APK** (Android package / URL). Navigation only. |
| No `---` | Do not add a hidden door on athlete chrome. |
| Wall | Strength `decideNext` + `strength_side`. Engine `decideNext` + `engine_side`. Never mix kinds. |
| Loggers frozen | No new columns, sheets, restyle, RIR, 1–5 feel, Engine visual redesign. |
| WHOOP product path | [thebriangao/totem](https://github.com/thebriangao/totem). Not mmnto-ai/totem. Brain still Recovery → `dailyZones` only. |
| Coach | Separate workspace. Totem **full** projection = Coach analytics. Not this phase’s UI. |

---

## Surgical law

**Violating the letter is violating the spirit.** Small surface. Existing tests must still pass before any Capgo.

**Do not touch**

- `packages/brain/src/*` math, `00-RULE-CONFIG.json`, `00-TEST-VECTORS.json`
- Logger paint / EMH popover / rest flow / lift memory seed
- Capgo `appId`, channel pin behaviour, Capacitor major version unification
- Vendor Totem source / iOS private API client into this monorepo
- Delete or “simplify” Edge `whoop-*` functions in the same change as the toggle
- Parked list in `HANDOFF.md`

**Allowed files (phase 1)**

- Strength Me/settings HTML in `strengthside` `apps/athlete` (`meHtml` / Me tab — already aliases `settings`)
- Engine Me/settings HTML in `Engine-side-` athlete shell (same pattern)
- A **new** tiny helper (one file per app, or one shared snippet copied) whose only job is: resolve target package, try open, report missing
- Tests that **only** cover the helper (package ids, exclusive switch, missing-app message)
- This spec + `HANDOFF.md` pointer

If a change needs `Logger.paint`, `logSet`, `decideNext`, or WHOOP connect HTML, it is **out of phase 1**. Stop.

---

## Phase 1 — settings switches (ship first)

### Behaviour

On **Me** (settings) in both apps, a **Side** card with two switches: TRACK and Engine.

- The current app’s switch is on and disabled (you are already here).
- The other switch, when turned on, opens that app:
  - TRACK → `com.hybrid.athlete`
  - Engine → `com.hybrid.engine`
- Exactly one side is the *intent*. Do not invent a third mode.
- If the target is not installed: stay on Me, show a short “install TRACK / Engine” line. Do not crash. Do not swap logger UI in-place.
- If open fails (no plugin, web browser): same stay-put message. Browser/web hosts do **not** need to open the other APK.
- Mid-session: do not auto-`close` into the other side. Android backgrounding keeps the current session as today.

### Data

No new snapshot domain. Do not write `strength_side` from Engine or `engine_side` from Strength because of the switch. Optional local flag `lastSideHandoffAt` is allowed only in that app’s existing `S.settings` object; it must not sync into Brain kernel payloads.

### Native

Use existing Capacitor **App** plugin if already on that binary. Do not add a new native plugin for phase 1 if `App.openUrl` / Android intent to the other package works. Engine already listens to `appUrlOpen` for WHOOP — **do not** reuse the WHOOP callback URL for this handoff. Use a dedicated scheme or explicit package start that cannot be confused with `whoop-callback`.

### Tests (phase 1)

- Helper: TRACK target package is `com.hybrid.athlete`; Engine is `com.hybrid.engine`.
- Helper: current-app switch does not call open.
- Helper: missing target returns a stable error code (`NOT_INSTALLED` / `NOT_NATIVE`), never throws through `render()`.
- Existing Strength session/library tests and Engine session/library/kernel tests: **zero failures**, no edits unless a test file is new and isolated.
- Manual (human phones): both APKs installed → Me → flip → other app foreground; kg still only in TRACK; output still only in Engine; Engine home zone card unchanged.

### Rollback

Revert the Me-card + helper only. OTA the two HTML bundles independently. Do not roll kernel.

---

## Phase 2 — WHOOP via Totem (after phase 1 is live)

Product path: WHOOP → Totem (full projection) → Brain **slice only** → Engine home BPM card.

### Sequencing (do not skip)

1. Keep Edge `whoop-connect` / `whoop-callback` / `whoop-sync` **working as fallback** until Totem recovery is proven on a dogfood channel. Live callback 503 is a **separate** Engine `_shared/auth.ts` `whoopCallbackUrl` redeploy — do not block phase 1 on it.
2. Add a **slice ingest** that maps Totem Recovery (0–100) + freshness into the same shape Engine home already feeds `HybridBrainKernel.dailyZones`. No new kernel functions unless tests in `packages/brain` demand a pure mapper (prefer app-side map).
3. Dual-run: if Totem slice is fresh, use it; else keep last successful Edge/local recovery; else show existing missing/stale home state. Never blank a working card because Totem failed.
4. Only then stop sending athletes through developer OAuth as the **happy path**. Do not delete Edge functions in the dual-run commit.
5. Coach analytics (full Totem) is **phase 3 / own spec**. Do not build Coach UI here.

### Still forbidden

- Totem Strength Trainer → TRACK `liftMemory`
- Totem coach / live HR / writes → `decideNext` or Close anchors
- LLM for target math

### Supabase

If Totem needs stored tokens or a projection cache: new tables get RLS, `TO authenticated` **and** `(select auth.uid()) = user_id` (and `WITH CHECK` on UPDATE). Never authorize from `user_metadata`. No `SECURITY DEFINER` to “make WHOOP work.” Pin client libraries if adding packages. Run advisors before any migration commit.

Do not expose Totem raw dumps on `anon`.

---

## Phase 3 (not this spec)

Coach workspace + Totem analytics. Existing concept art: `docs/concept-art/`. Source HTML: `strengthside` `apps/coach/coach.html`.

---

## Error handling

| Case | Result |
| --- | --- |
| Other APK missing | Stay on Me; one sentence; switches unchanged |
| Open throws | Catch at helper; same as missing |
| Totem down (phase 2) | Keep last good recovery / Edge fallback; home does not crash |
| Athlete in logger | Switch is not on the logger screen; no new chrome there |

---

## Success

- Two icons still on the phone.
- Me switches open the sibling app when installed.
- Kernel tests and athlete session tests still pass.
- Engine home colors still come from Recovery slice only.
- No logger visual change. No merged WebView.

---

## Explicit non-goals

One APK, shared WebView, `---` button, Capacitor 7→8 unification, restyling Engine, TrainHeroic import, Concept2 OAuth, vendoring Totem, feeding Totem into `decideNext`.
