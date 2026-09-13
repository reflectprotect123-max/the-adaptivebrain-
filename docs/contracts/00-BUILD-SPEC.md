# Build Specification

## 1. Required domain objects

### Conditioning template

```ts
type Effort = "easy" | "medium" | "hard";

interface ConditioningTemplate {
  id: string;
  purpose: string;
  machineType: string;
  machineModel?: string;
  method: string;
  workSeconds?: number;
  workDistanceM?: number;
  recoverySeconds?: number;
  repetitions?: number;
  intendedEffort: Effort;
  outputUnit?: "rpm" | "watts" | "split_500m" | "split_1000m";
  warmupSeconds?: number;
  cooldownSeconds?: number;
}
```

### Interval result

```ts
interface IntervalResult {
  intervalIndex: number;
  prescribedOutput?: number;
  actualAverageOutput?: number;
  actualPeakOutput?: number;
  outputUnit?: string;
  intendedEffort: Effort;
  reportedEffort?: Effort;
  prescribedSeconds: number;
  completedSeconds: number;
  complete: boolean;
  source: "device" | "manual";
}
```

Peak output is stored for context only. V1 suggestions use actual average output.

### Anchor

```ts
interface ConditioningAnchor {
  anchorKey: string;
  canonicalOutput: number;
  canonicalUnit: "rpm" | "watts";
  confidence: "provisional" | "confirmed";
  qualifyingObservationIds: string[];
  ruleVersion: string;
  updatedAt: string;
}
```

Concept2 anchors use watts canonically even when displayed as split.

### Daily zones

```ts
interface DailyZoneReceipt {
  date: string;
  modalityProfileId: string;
  recoveryScore?: number;
  recoveryCategory?: "green" | "yellow" | "red";
  recoveryTimestamp?: string;
  freshness: "current" | "stale" | "missing";
  rhrBaseline: number;
  hrMax: number;
  bgBase: number;
  grBase: number;
  shiftHrrPoints: number;
  bgToday: number;
  grToday: number;
  moduleCeiling: "blue" | "green" | "red";
  ruleVersion: string;
}
```

## 2. Decision receipt

Every suggestion must be reproducible. Store:

- template and anchor identity;
- rule version;
- intended effort;
- prescribed and actual output;
- feedback and completion;
- adjustment action and reason codes;
- before/after target;
- WHOOP score, timestamp, freshness, baseline and daily zones;
- planned and delivered module;
- athlete override;
- whether the observation affected today's target, long-term anchor, compliance and structural progression.

## 3. Conditioning pseudocode

```text
open_session(template, athlete, today):
  zones = calculate_daily_zones(today.whoop, athlete.modality_profile)
  delivered_template = apply_module_ceiling(template, zones.module_ceiling)
  delivered_template = apply_red_easy_duration_rule(delivered_template, today.whoop)
  anchor = find_exact_comparable_anchor(delivered_template)
  return prescription + anchor + zones

after_interval(result, session):
  if result incomplete or actual output/feedback missing:
    hold and record reason
  reference = result.actualAverageOutput
  next = apply_machine_effort_table(reference, intended, reported)
  return bounded, rounded next target

close_session(session):
  record all work
  update compliance using 90% of adjusted prescription
  select qualifying anchor observations
  confirm only when comparison rule passes
  update duration after two qualifying Easy exposures
  never overwrite baseline HR zones from one daily recovery
```

## 4. Daily zone pseudocode

```text
calculate_daily_zones(recovery, profile):
  if missing or stale:
    return baseline boundaries, planned ceiling, shift 0

  shift_points = interpolate(
    recovery,
    [(0,-8), (34,-5), (67,-2), (100,0)]
  )

  shift_bpm = profile.hrr * shift_points / 100
  bg_today = profile.bg_base + shift_bpm
  gr_today = profile.gr_base + shift_bpm
  ceiling = green if recovery >= 67
            yellow if recovery >= 34
            red otherwise
  return unrounded values + rounded display values + receipt
```

In code, map the category to ceiling as Green→Red module, Yellow→Green module and Red→Blue module. Do not confuse WHOOP category names with module names.

## 5. Progression-state model

Use explicit states:

- `unseen`
- `provisional`
- `confirmed`
- `held`
- `progression_eligible`
- `recalibrating`
- `missing_data`

Do not infer confirmation merely because an anchor number exists.

## 6. Strength implementation

Keep Strength and Engine decision functions separate but return a shared envelope:

```ts
interface SuggestionReceipt {
  domain: "strength" | "conditioning";
  action: "increase" | "hold" | "reduce" | "abstain";
  suggested: unknown;
  actualReference: unknown;
  reasons: string[];
  ruleVersion: string;
}
```

Strength needs distinct handlers for:

- straight sets;
- ramps;
- top plus back-off;
- waves;
- technical/speed sets;
- fixed-load volume;
- bodyweight and assisted bodyweight;
- unilateral/per-hand equipment rounding.

## 7. UI contract

### Conditioning rest screen

- Show completed interval summary and actual average output.
- Ask one question: **How did that work interval feel?**
- Three buttons: Easy, Medium, Hard.
- Show next output target and a short reason.
- Never display an invented device measurement.

### Continuous Easy session

- Do not interrupt repeatedly.
- Display today's HR zones and current duration.
- At finish, collect actual output and Easy/Medium/Hard once.
- Show work credited, anchor status and whether duration progressed.

### Strength set screen

- Inputs: load, completed reps and RIR.
- Show next suggestion only after actual values are logged.
- Preserve prescribed set architecture.

## 8. Migration requirements

- Add enum fields without deleting historical numeric RPE.
- Preserve old numeric data as legacy evidence; do not fabricate Easy/Medium/Hard conversions unless versioned and explicitly labelled inferred.
- Store Concept2 split and watts when both are available; watts is canonical for calculations.
- Add anchor confidence and comparable-key version.
- Add zone-rule version and daily receipts.
- Migration must be idempotent and reversible.

## 9. Verification plan

1. Pure unit tests for every effort-table cell.
2. Concept2 round-trip tests: split→watts→split within display tolerance.
3. Exact-boundary tests at WHOOP 0, 33, 34, 66, 67 and 100.
4. Fresh, stale and missing WHOOP cases.
5. Sequence tests showing an athlete exceeding a suggestion and becoming the next reference.
6. Incomplete interval never earns increase.
7. Two-observation anchor confirmation and non-consecutive matching.
8. Continuous-session 90% completion and 5% fade cases.
9. Red 25%-duration suggestion and override.
10. Strength architecture tests and equipment rounding.
11. Persistence/reload tests proving prescriptions and actuals remain separate.
12. Shadow-mode comparison before enabling automatic daily-zone prescriptions.

## 10. Local build commands

### Engine snapshot

Requires Node `>=20.19` and pnpm `10.33.0`:

```bash
pnpm install
pnpm verify
```

The repository's verification runs typecheck, unit tests, bundle build and Engine smoke checks.

### Strength snapshot

Requires Node `>=20.19` and pnpm `10.33.0`:

```bash
pnpm install
pnpm verify
```

The Strength verification command includes typecheck, unit tests, migrations, bundles, athlete checks and coach smoke suites. Some integration checks may require the repository's configured environment; do not place credentials in this package.

## 11. Deployment boundary

The Engine handoff identifies Supabase Edge hosting for Engine, Strength/TRACK and Brain. WHOOP tokens belong server-side. Concept2 Logbook OAuth was intentionally retired. Review `10-src/eng/HANDOFF.md` and `10-src/eng/HOSTING.md` before deployment.
