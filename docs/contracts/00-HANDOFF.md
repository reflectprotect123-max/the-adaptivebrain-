# Hybrid System Complete Handoff

**Checkpoint:** 12 September 2026  
**Purpose:** authoritative product, research, formula, data and source-code handoff  
**Start here:** this file, then `00-DECISION-WORKTREE.md`, `00-FORMULAS-AND-RULES.md`, and `00-BUILD-SPEC.md`

## What this package is

This ZIP combines the focused fitness evidence pack with the latest Strength and Engine decisions, current source-code references, TrainHeroic source data, Morpheus method references, WHOOP integration design, implementation formulas, test cases and known gaps.

It deliberately excludes the user's personal lifting split, personal resting-heart-rate episode, videos, duplicate archives, dependency folders, credentials and generated application binaries. The goal is a complete working product handoff, not a byte-for-byte forensic backup.

## Product boundary

| Surface | Owns | Primary athlete input |
| --- | --- | --- |
| Strength / TRACK | Strength templates, set architecture, exercise history and load suggestions | Load, completed repetitions, RIR |
| Engine | Conditioning methods, timers, HR zones, output anchors and interval suggestions | Actual average output, Easy / Medium / Hard |
| WHOOP morning layer | Daily recovery input used by the Engine | Automatically imported Recovery score and timestamp |
| Brain | Cross-product context and explanation | Does not become a second progression engine |

Strength and conditioning share one interaction principle:

> Suggest → perform → log the actual result and effort → calculate from the actual result.

They do not share identical mathematics. Strength learns from load, repetitions and RIR. Conditioning learns from duration, actual average watts/RPM/split and Easy/Medium/Hard.

## Authoritative decisions

### Simple athlete execution

- Conditioning asks only **Easy / Medium / Hard** after the completed work interval. It refers to that work interval, not the recovery period.
- Strength asks for **load, completed repetitions and RIR**.
- Do not add a required pain signal, cooked question, technique rating or notes prompt to either core logging loop.
- Prescribed values and actual results are always stored separately.
- A suggested value must never be silently saved as an actual result.
- An athlete may exceed a suggestion. A successfully completed actual result becomes the new calculation reference.

### Conditioning anchors

- Anchors are specific to machine/model, method/structure, work duration, recovery duration, intended effort and output unit.
- First use begins without an invented target. The athlete chooses an output; the first completed actual average becomes provisional.
- Controlled intervals confirm an anchor after two intended-effort matches that are reasonably close: approximately **within 3% power or 1 RPM**. They need not be consecutive.
- Continuous work confirms across two comparable sessions.
- The next-session anchor is the median actual output of the qualifying observations. Concept2 median calculations occur in watts, then convert to the chosen split display.
- If there is no qualifying observation, retain the last confirmed anchor. With no history, retain the final completed output as provisional.

### Easy continuous progression

- The default starter pathway uses one Easy conditioning exposure per week.
- Progress the main work duration by **5 minutes after two qualifying exposures**.
- Completion of at least **90% of the recovery-adjusted prescription** counts for compliance and duration progression when the session is still reported Easy.
- Work remains recorded even when it does not qualify for an output-anchor increase.
- An output fade of up to **5%** between the first and final steady five-minute blocks is acceptable. A larger fade does not erase work or compliance, but it blocks an upward output-anchor confirmation.
- **45 minutes** of main Easy work is a review point, not a physiological ceiling.
- **60 minutes** is the automatic-programming ceiling. Longer Easy sessions require an explicit athlete/coach choice.
- Planned overload comes from duration. Easy output improves when the athlete demonstrates more RPM/watts/faster split while still reporting Easy; the system does not mechanically add output every week.

### Daily WHOOP behavior

- Heart-rate zones recalculate every morning across the full WHOOP Recovery range. Daily movement is a required product behavior.
- The permanent baseline and the daily working zones are separate. One morning never rewrites long-term fitness.
- WHOOP Green or Yellow does not shorten a planned Easy session.
- WHOOP Red suggests a **25% duration reduction**, with athlete override. WHOOP alone does not cancel training.
- The recovery-adjusted duration becomes the official prescription for that day; completing at least 90% qualifies.
- The broader module ceiling remains: Green permits the scheduled module, Yellow permits at most Green, and Red permits Blue only. A Green score never upgrades an Easy plan.
- Missing or stale Recovery uses baseline zones and states that no current adjustment was applied.
- The approved V1 daily-boundary formula is documented in `00-FORMULAS-AND-RULES.md`. It is an original, versioned product hypothesis—not the Morpheus or WHOOP formula.

### Optional additional conditioning

An additional Medium day is not automatically inserted into the starter plan. Consistent completion may make an athlete eligible to choose one, but the Engine does not turn the Easy session into Medium or silently add a fourth session. A four-week compliance gate was discussed; it remains an athlete/coach-controlled expansion rather than an automatic starter-plan action.

## Current code state

The source snapshots under `10-src/` are reference copies of:

- Engine repository: `reflectprotect123-max/Engine-side-`, local `main` at `62516ccd9954d9f8446b72a12b566bff6d374334`.
- Strength repository: `reflectprotect123-max/strengthside`, local `main` at `7a7027c5c58ac15cfab119a0a1e8a4fac024ea88`.

The Engine checkpoint includes the Supabase hosting consolidation and retirement of Concept2 Logbook OAuth. Concept2 remains a supported **manual/device-output modality**, but the retired OAuth integration must not be restored accidentally.

### Important implementation gap

The current Engine code does not implement this handoff completely:

- It still uses numeric RPE and `stopped`/`cooked` inputs.
- Current watts/RPM logic uses fixed percentage changes that differ from the approved target-relative tables.
- Current split logic changes seconds directly instead of calculating in watts.
- The complete anchor-confirmation, 90%-completion, 5%-fade and continuous-session progression rules are not wired end to end.
- WHOOP is connected/displayed, but the approved daily HRR rule and module/duration behavior require implementation and shadow validation.

Treat this handoff as the target contract and the source snapshot as the honest current implementation.

## Build order

1. Implement typed domain models and versioned rule configuration.
2. Replace conditioning numeric RPE with intended and reported Easy/Medium/Hard enums.
3. Implement actual-output-first adjustment for Echo RPM and Concept2 watts/splits.
4. Implement comparable anchor identity, provisional/confirmed confidence and median selection.
5. Implement continuous Easy completion, fade and duration progression.
6. Implement baseline HR zones, daily WHOOP HRR shift, module ceiling and Red-only Easy-duration reduction.
7. Store complete decision receipts and run zone logic in shadow mode.
8. Add unit, sequence, missing-data, rounding and smoke tests before changing live prescriptions.

Detailed schemas, pseudocode and acceptance cases are in `00-BUILD-SPEC.md` and `00-TEST-VECTORS.json`.

## Evidence discipline

- Peer-reviewed research supports RPE/RIR, HRR as a practical estimate, threshold-aware prescription, HRV-guided training as a possible scheduling aid, and device-specific output learning.
- Research does **not** validate the exact 1-RPM, 3%/5%, two-observation, 90%, 5%-fade, five-minute progression or WHOOP HRR-shift constants.
- Morpheus publicly confirms daily-moving zones and recovery-guided training, but does not publish its full numerical formula.
- WHOOP Recovery is not Morpheus Recovery.
- Peak Strength/Garage Strength publicly demonstrates a responsive set-suggestion pattern, but its exact algorithm is not public.

The package labels product choices as product choices. Do not market them as discovered physiological laws.

## Where everything lives

| Need | Location |
| --- | --- |
| Decision status and dependencies | `00-DECISION-WORKTREE.md` |
| All executable formulas and tables | `00-FORMULAS-AND-RULES.md` |
| Data model, pseudocode and build sequence | `00-BUILD-SPEC.md` |
| Acceptance examples | `00-TEST-VECTORS.json` |
| New citations and evidence interpretation | `00-EVIDENCE-REGISTER.md` |
| Package inventory and exclusions | `00-MANIFEST.md` |
| Strength research and exercise library | `01-strength/` |
| Conditioning and modality research | `02-conditioning/` |
| Recovery/readiness dossiers | `03-recovery-readiness/` |
| Peak/Garage and evidence audits | `04-research-audits/` |
| Practitioner/source programs and Morpheus screenshots | `05-source-programs/` |
| TrainHeroic historical data | `06-trainheroic-source-data/` |
| Wearables and integration research | `07-wearables-integrations/` |
| Known limitations | `08-limitations/` |
| Product/market architecture | `09-product-design/` |
| Current source-code references | `10-src/` |

## Non-negotiable handoff warnings

- Do not claim the V1 daily-zone calculation is Morpheus's formula.
- Do not transfer output anchors across different machines or materially different protocols.
- Do not use Concept2 stroke rate as intensity or calculate split adjustments linearly in seconds.
- Do not allow WHOOP to overwrite a confirmed output anchor.
- Do not allow an incomplete interval to earn an output increase.
- Do not confuse intended Hard with failure; a completed Hard prescription reported Hard is a match.
- Do not import Strength/TrainHeroic history into the Engine's conditioning storage merely because both products share language.
- Do not add the excluded personal split or personal RHR episode back into this evidence package.
