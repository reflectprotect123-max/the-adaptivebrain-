# Lift memory, load metrics, and snapshot sync — V1 afternoon

**Date:** 2026-09-13  
**Status:** approved in chat (LAST + e1RM, Weight (%) of WM, LWP, don’t lose library)  
**Repos:** Brain kernel + Strength / Engine athlete snapshots  
**Logger chrome:** frozen (no new columns, sheets, or warm-up logging)

Related: `docs/superpowers/specs/2026-09-13-adaptivebrain-v1-design.md` (EMH, no RIR, no 1–5 feel).

## 1. What we are building

Keep the existing OLED logger. Wire **library → Brain → next empty box**, and **copy library + logs to Supabase** so a signed-in phone does not lose training.

Brain stays a **local calculator**. Supabase stores a **snapshot**, not `decideNext`.

## 2. Athlete-visible (no layout change)

On a kg-family lift, the existing side card:

- **WORKING MAX** = e1RM for that lift (typed override still allowed).
- **LAST** = last **logged working** kg (not the same number as WM).

Warm-up / cooldown / circuit **For Completion** pages stay complete-only. They never write LAST, e1RM, or `decideNext`.

## 3. Memory key

Per lift, keyed by normalized title (`trim` + lower case), not by session letter (B/C change by day).

Stored fields: `lastKg`, `lastReps`, `lastEffort`, `lastMiss`, `e1rmKg`, `lastPct`.

Also written onto matching catalog exercise when titles match.

## 4. e1RM

Epley **without RIR**: `round1(loadKg * (1 + min(reps, 20) / 30))`.

After a logged working set (not Miss): `e1rmKg = max(previous, newEstimate)`. Miss does not raise e1RM. Athlete-typed Working Max replaces `e1rmKg`.

## 5. Opening the first empty kg (`open` / seed)

Never overwrite a typed or already-filled kg.

| Load column | First empty kg |
| --- | --- |
| `weight_kg` or `weight_lb` | `lastKg` or blank |
| `weight_pct` | `roundToStep(e1rmKg * lastPct / 100)` if both exist; else `lastKg`; else blank |
| `lwp` | `lastKg + 2.5` if last working set hit target reps and effort was not Hard and not Miss; else `lastKg`; else blank |
| no load column | do not seed kg |

Step = 2.5 kg. In-session `decideNext` **unchanged** (Easy +step, Medium hold, Hard/miss −step).

**Pad on Weight (%):** if the athlete types 1–100 and e1RM exists, store **kg** = % × e1RM and remember `lastPct`. If they type >100, treat as kg and derive `lastPct` when e1RM exists.

## 6. Metrics we do **not** auto-progress this afternoon

Reps, rep range, time, distance, watts-on-Strength, calories, inches, velocity, other: log only. Autofill still copies kg+reps only.

Engine athlete: last **output** already comes from Close anchors. Add snapshot sync so library + sessions + `engineAnchors` survive. No e1RM.

Engine library still lists RPE; Strength does not — do not add RPE back to Strength.

## 7. Sync

Reuse `upsert_athlete_domain_snapshot` / `athlete_domain_snapshots`.

| App | Domain | Writer | Payload |
| --- | --- | --- | --- |
| Strength (already) | `strength_side` | `strengthside-athlete` | templates, catalog, assignments, session logs, **liftMemory** |
| Engine (new) | `engine_side` | `engine-athlete` | same shape + `engineAnchors` |

Signed in: pull/merge/push on launch and debounced save. Unsigned: localStorage only. Offline: local first, push later.

WHOOP, coach chat, Capgo, kernel JS are not this blob.

## 8. Out of scope (still parked)

Ramp/wave/top-back-off tables, double progression, %1RM program builder fields, Engine visual redesign, 2k→pace, LLM for targets.

## 9. Afternoon dogfood

1. Sign in on both apps.  
2. Open apps so Capgo pulls the new bundles.  
3. Strength: log a working set → LAST and WM split; next session first box filled.  
4. Optional: track Weight (%) and type 70 with a WM set.  
5. Kill and reopen: library and LAST still there if signed in.

## 10. Testing

Kernel: e1RM, opening kg for kg/pct/lwp, no invent, miss does not raise e1RM.  
Strength session: seed first empty kg from memory; do not overwrite; warmup never calls Brain.  
Plan-sync: pack/unpack `liftMemory`. Engine pack includes anchors.
