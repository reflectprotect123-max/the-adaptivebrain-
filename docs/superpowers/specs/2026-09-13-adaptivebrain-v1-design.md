# Adaptive Brain V1 — product design

**Date:** 2026-09-13  
**Status:** implemented kernel; Strength/Engine UI done in local sibling clones (GitHub push 403)  
**Repos:** Brain = `reflectprotect123-max/the-adaptivebrain-`; Strength = `reflectprotect123-max/strengthside`; Engine = `reflectprotect123-max/Engine-side-`  
**Authority:** this spec for V1 athlete behaviour and Brain API. Numeric tables already in `docs/contracts/00-FORMULAS-AND-RULES.md` stay in force unless this file overrides them.  
**Override:** Strength athlete input is **Easy / Medium / Hard**, not RIR. Session-end 1–5 feel screen is **removed**.

Related: `docs/superpowers/specs/2026-09-13-adaptivebrain-ownership-design.md` (ZIP routing / file owners). Method catalogue photos: `docs/handoff-engine/morpheus-hub-lessons/`.

---

## 1. What we are building

Adaptive Brain is the **decision hub above two athlete apps**. It has **no athlete screen**.

| Surface | Repo | Athlete sees | Logs |
| --- | --- | --- | --- |
| Strength / TRACK | `strengthside` | lifts, table, timers | kg, reps, Easy / Medium / Hard |
| Engine | `Engine-side-` | cardio timers, watts/RPM, home zones | actual output, Easy / Medium / Hard |
| Brain | this repo | nothing | facts in, suggestion out, internal receipt |

**Approach A (locked):** Brain is a deterministic rule engine plus internal receipts. Apps are UI and session chrome only. OpenRouter / LLM is **coach chat only**, never `decideNext` math.

Simplicity rule: if a feature adds a new question or concept for the athlete, V1 does not add it.

---

## 2. Shared principle

```
Suggest → athlete performs → athlete logs actual result and effort → next suggestion uses the actual.
```

- Store prescribed and actual separately.
- Never silently save a suggestion as an actual.
- Auto-save a suggestion as actual **only** when the logged number equals the suggestion **and** reported effort matches intended effort.
- If they lift or row a different number, **that number is the reference**.

Strength and Engine share this principle and the **same three effort words**. They do **not** share the same numeric tables (kg steps vs watts/RPM).

---

## 3. Brain API (locked)

Three calls. Simple.

| Call | When | In | Out |
| --- | --- | --- | --- |
| `open` | Session or piece starts | athlete, template/anchor key, WHOOP freshness if Engine | opening target + `ruleVersion` + confidence |
| `decideNext` | After a logged set (Strength) or after rest EMH (Engine) | actuals + reported effort | next suggestion |
| `close` | Piece or session ends | qualifying actuals | updated anchor/reference + receipt |

Brain stores `ruleVersion` on every receipt. Apps do **not** show reason copy from Brain to the athlete.

Error / missing data: if load, reps, output, or effort is missing, Brain returns **no change** (hold last suggestion). Do not invent numbers.

---

## 4. Strength — athlete UI (locked)

Existing OLED logger stays: black screen, green dots, blue clock, REPS/KG totals, Working Max card, set table, number pad, Back / play / Next.

### 4.1 Per set

Table columns: **Sets · Reps · Weight (kg) · Effort · ✓**

1. Athlete taps reps / kg → existing number pad (Log / Autofill / Miss unchanged).
2. Athlete taps **Effort** → **small popover** on that cell (not a full-page sheet, not a dim overlay). Three buttons: Easy, Medium, Hard. Same visual language as existing `.log-intensity` (blue selected).
3. Choice writes `Easy` / `Med` / `Hard` into the cell; popover closes.
4. Athlete taps the **green tick**. Tick only completes the set when reps, kg, **and** effort are present. Empty effort: do not complete; highlight Effort.

First time on an exercise: athlete supplies first working weight. No invented load.

### 4.2 After Done Training

**Drop** the screen “How did this session feel?” (1–5 + duration stepper + reflection).  
**Done Training** → existing summary (exercises, sets, reps, minutes) → close.

Optional exercise note field on the lift page may remain. It is not required.

### 4.3 Library

Remove **RPE** from “What do you want to track?” so athletes cannot add an RPE column back onto the table.

### 4.4 Strength maths (Brain)

Intended effort lives on the template (easy / medium / hard). Compare **reported** to **intended**:

| Reported vs intended | Next load |
| --- | --- |
| Easy (easier than intended) | Increase **one equipment step** if architecture allows |
| Medium (matches intended) | Hold |
| Hard (harder than intended) | Decrease one equipment step |
| Missed reps (`Miss` or completed reps below target) | Decrease one step; do not require the popover if Miss was used |
| Missing kg, reps, or effort | No change |

Top / back-off: back-off loads calculate from the **actual top set**, not the suggestion.

Double progression for rep ranges: fill the rep range at intended effort, then add the smallest load increment and return toward the low end of the range. Exact per-architecture tables beyond this remain **parked** (straight sets are enough for V1).

Do not show RIR anywhere.

---

## 5. Engine — athlete UI (locked)

Morpheus Hub screenshots define **method shape** (work/rest/reps/zone colour). They do **not** supply Morpheus’s unpublished HR formula. Engine coaches with **watts or RPM + EMH**, not HR chasing during intervals.

### 5.1 Interval flow (replaces current RPE rate phase)

Today’s snapshot: work → RPE 1–10 slider → Log bout / Stopped → rest.  
**V1:**

```
Work timer (target on screen)
  → Rest timer starts
  → Easy / Medium / Hard for that work interval (same three buttons)
  → decideNext
  → next target shown before next work
```

Remove: numeric RPE slider, “1 conversation · 7 short phrases…” hint, **Stopped**, **cooked**. Incomplete interval: athlete can still end early; Brain does not award an increase.

Live update after rest — **no shadow mode** for athletes.

### 5.2 Opening target (V1)

- Confirmed comparable anchor → show it.  
- Provisional comparable anchor → show it as provisional.  
- **No history:** do **not** invent a pace. Athlete types first number or logs first actual (existing “first number” field).  
- **2k → opening watts:** **parked**. Do not build in V1.

Echo Bike: RPM table in `00-FORMULAS-AND-RULES.md`. No 2k seed.

Concept2: watts internally; display `/500m` or `/1000m` via existing cube-root conversions.

### 5.3 Engine maths (Brain)

Use the target-relative tables in `00-FORMULAS-AND-RULES.md` §4–5 (Echo RPM integers; Concept2 3%/5% in watts). Anchor confirmation §3. Continuous Easy completion, fade, +5 min §6.

Anchor key: athlete + machine type + model + method + work duration + recovery duration + intended effort + output unit.

### 5.4 Home (Engine)

Keep WHOOP Sleep / Recovery / Strain dials.  
**Add** today’s **Blue / Green / Red BPM boundaries** (from Brain / WHOOP morning layer). Label estimated baselines as estimated.

Keep Easy / Medium / Hard as the in-session language; home is zones + recovery, not a second logger.

Logger visual redesign beyond this flow: **parked**.

### 5.5 End of Engine session

Same as Strength: no 1–5 feel page. Piece done → Next / summary.

---

## 6. WHOOP (locked)

Implemented on Engine Home; Brain consumes the score for zone math.

- Every current Recovery score recalculates **today’s** BG/GR boundaries (`00-FORMULAS-AND-RULES.md` §8). Coefficients are product heuristics, not Morpheus/WHOOP published formulas.
- Store baseline vs daily working zones separately. One morning never rewrites long-term fitness.
- Module ceiling §9: Green keeps scheduled module; Yellow caps at Green; Red caps at Blue; Easy duration may suggest −25% on Red.
- Missing/stale Recovery: baseline zones; tell the truth that no daily adjustment applied. Do not fabricate a score.
- WHOOP never overwrites a **confirmed output anchor**.

Athlete-visible shadow mode for zones: **not used**. Ship the daily move on Home when wired.

---

## 7. Method catalogue (Engine templates)

The 14 Morpheus Hub captures are Engine-owned recipes for **structure** (Steady Z1/Z2, Tempo, Blue Repeats, Green Power/Endurance/Repeats/Threshold, Red Power/Endurance/Threshold/Max). Programming picks a method; Brain does not invent the workout shape.

V1 does not require all 12 methods in the starter week. Starter stays the existing Hybrid frequency (typically Easy continuous + optional controlled intervals as already planned).

---

## 8. Data the apps send Brain

**Strength `decideNext`:** exercise / architecture identity, intended effort, suggested kg/reps, actual kg/reps, reported effort, miss flag, equipment increment.

**Engine `decideNext`:** `anchor_key` fields, intended effort, suggested output, actual average output, reported effort, complete flag, machine unit.

**Engine `open`:** plus Recovery score, timestamp, freshness, HR baseline inputs when available.

Receipts stay internal to Brain (and coach tools later). Not shown as essays in the logger.

---

## 9. Explicitly out of V1

| Item | Status |
| --- | --- |
| 2k / benchmark → opening pace | Parked |
| Engine logger visual redesign | Parked |
| Strength waves, ramps, full architecture tables | Parked; straight / simple double progression only |
| Machines other than Rogue Echo V1 and Concept2 V1 | Open |
| Extra Medium day auto-insert | Not automatic |
| Brain athlete UI | Never |
| LLM for targets | Never |
| Pain, technique, cooked, numeric RPE, RIR | Never in core loop |
| Concept2 Logbook OAuth | Do not restore |
| TrainHeroic history → Engine storage | Do not import |
| Personal lifting split / personal RHR episode | Stay excluded |

---

## 10. Conflict rule

1. This spec + `docs/contracts/00-FORMULAS-AND-RULES.md` = V1 target. Where they disagree on Strength effort, **this spec wins** (EMH not RIR).  
2. Live Strength/Engine code = current debt.  
3. Research dossiers and Morpheus pages = method/UX reference, not proprietary formulas.  
4. ZIP `10-src/` snapshots = provenance, not a third live app.

---

## 11. Testing (when we implement)

- Strength: Easy at intended medium → one step up; Hard → one step down; Medium → hold; miss reps → down; tick blocked without effort; popover not full-screen.  
- Strength: suggested 60, logged 70 → reference 70.  
- Engine: EMH on rest only; no slider; Concept2 3%/5% watt table vectors already in `docs/contracts/00-TEST-VECTORS.json`.  
- Engine: two qualifying actuals within 3% watts → confirmed anchor.  
- WHOOP piecewise shift examples in formulas §8.  
- `decideNext` never called with LLM. Missing inputs → hold.

---

## 12. Implementation order (after this spec is approved)

Not a substitute for `writing-plans`. Intended sequence:

1. Freeze contracts in Brain (`00-RULE-CONFIG.json` strength_feedback → effort enum; formulas Strength section → EMH).  
2. Brain `open` / `decideNext` / `close` with receipts (Strength load + Engine output).  
3. Strengthside logger: Effort column, mini popover, tick rule, drop session-feel, drop Library RPE track.  
4. Engine-side logger: rest EMH, remove RPE/Stopped; Home zone card; WHOOP daily boundaries.  
5. Wire apps to Brain API; keep UI in the apps.

Work happens in **three repos**. This repo owns the contract and Brain service. The two apps own their screens.
