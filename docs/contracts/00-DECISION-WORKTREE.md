# Decision Worktree

This tree shows what each decision controls, its status and what must be built beneath it.

## Root product principle — LOCKED

`Actual performed result outranks the suggestion`

├── **Strength** — LOCKED  
│   ├── Athlete logs load + completed reps + RIR  
│   ├── Never-used exercise: athlete chooses first working weight  
│   ├── Actual completed set becomes provisional reference  
│   ├── Next suggestion respects set architecture  
│   └── Longer-term model waits for comparable evidence  
│  
└── **Engine** — LOCKED  
    ├── Athlete logs actual average output when available  
    ├── Athlete reports Easy / Medium / Hard  
    ├── Actual output becomes the next calculation point  
    ├── Intended effort and reported effort are compared  
    └── Long-term anchor remains separate from today's suggestion

## Engine execution branch — LOCKED

`Template → morning adjustment → opening target → perform → log → adjust → close → progress`

### Template

Stores purpose, machine/model, method, work time/distance, recovery, repetitions, intended effort, optional anchor and warm-up/cooldown.

### Morning adjustment

├── WHOOP Recovery current  
│   ├── Recalculate daily Blue/Green/Red boundaries — REQUIRED  
│   ├── Apply module ceiling — LOCKED  
│   └── If Red and session is Easy: suggest 25% shorter duration — LOCKED  
└── WHOOP missing/stale  
    ├── Use baseline zones  
    ├── Keep planned module  
    └── Show truthful missing-data state

### Opening target

├── Confirmed comparable anchor exists → show it  
├── Provisional comparable anchor exists → show it with provisional state  
└── No comparable history → athlete chooses; do not invent a number

### During controlled intervals

├── Complete work interval  
├── Capture actual average output  
├── During rest, report Easy/Medium/Hard for completed work  
├── Apply machine-specific target-relative table  
└── Display next target before next work interval

### During continuous Easy work

├── No repeated interruption  
├── Log output and Easy/Medium/Hard at finish  
├── Compare first and final steady five-minute blocks  
├── Up to 5% fade is stable  
└── Greater fade preserves work but blocks upward anchor confirmation

### Close session

├── Controlled intervals: median qualifying actual output  
├── Concept2: median watts, then convert to split  
├── Continuous: confirm across two comparable sessions  
├── No qualifying match + old confirmed anchor → retain old anchor  
└── No history → retain final complete actual as provisional

### Progress structure

├── At least 90% of adjusted prescription completed?  
│   ├── No → record work; no qualifying completion  
│   └── Yes → continue  
├── Intended Easy reported Easy?  
│   ├── No → adjust output; do not claim Easy mastery  
│   └── Yes → qualifying exposure  
├── Two qualifying exposures?  
│   ├── No → repeat  
│   └── Yes → add five minutes  
├── Reaches 45 minutes → review point  
├── Chooses continuation → progress toward 60 minutes  
└── Reaches 60 minutes → stop automatic duration growth

## Daily HR-zone branch — APPROVED EXPERIMENTAL V1

`Baseline physiology estimate + WHOOP Recovery → daily working boundaries`

├── Baseline source hierarchy  
│   ├── Valid measured VT1/VT2 or coach-approved threshold profile — preferred  
│   ├── Repeated modality-specific field observations — second  
│   └── Karvonen/HRR fallback — estimated  
├── Stable inputs  
│   ├── Best observed/tested HRmax  
│   └── 28-day resting-HR median  
├── Daily input  
│   └── WHOOP Recovery 0–100 plus timestamp/freshness  
├── Apply piecewise HRR-percentage-point shift  
├── Round only for display  
├── Store baseline and daily boundaries separately  
└── Shadow-validate before automatic release

Status note: daily zone movement is a required behavior. The coefficients are an original V1 engineering rule because Morpheus and WHOOP do not publish a transferable formula.

## Machine branch

### Rogue Echo Bike — LOCKED V1

├── No resistance-level field  
├── Athlete creates resistance through fan speed  
├── Use average RPM, never peak RPM  
├── Apply integer RPM table  
└── Machine/model identity is part of anchor key

### Concept2 — LOCKED V1

├── Store average watts as canonical output  
├── Convert to RowErg/SkiErg `/500 m` split for display  
├── BikeErg may display `/1000 m`  
├── Apply 3%/5% changes in watts  
├── Convert adjusted watts back to split  
└── Stroke rate and drag factor are context, not intensity

### Other machines — OPEN

Need device-specific units, rounding, comparability rules and tested adjustment tables. Do not automatically inherit Echo or Concept2 constants.

## Strength branch — LOCKED DIRECTION; IMPLEMENTATION TABLES INCOMPLETE

├── Stable framework with flexible exercise slots  
├── First working load supplied by athlete  
├── Actual load/reps/RIR drives next suggestion  
├── Prescribed and actual values remain separate  
├── Straight, ramp, top/back-off, wave, technical and fixed-load structures differ  
├── Smallest equipment increment controls rounding  
├── Double progression is default for rep ranges  
└── Exact executable table for every architecture still requires completion/testing

## Compliance and optional expansion branch

├── Recovery-adjusted prescription is the day's real prescription  
├── 90% duration completion is the tolerance  
├── Adjusted completion counts as work, compliance and duration progression  
├── Extra Medium day is not auto-added to starter plan  
└── Four-week compliance gate is a discussed eligibility rule, not an automatic insertion

## Explicitly unresolved

1. Validation-derived replacement values for the daily HRR shift anchors.
2. Measured threshold onboarding and recalibration protocol.
3. Device tables for modalities beyond Echo and Concept2.
4. Exact Strength rule tables for every set architecture.
5. Final product policy for the optional additional Medium day across all athlete populations.
6. Minimum sample size and statistical acceptance criteria for promoting shadow-mode zone rules.
