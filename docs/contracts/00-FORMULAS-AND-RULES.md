# Formulas and Rule Tables

This is the implementation-facing mathematical contract. Constants labelled **product heuristic** are testable rules, not established physiological laws.

## 1. Shared actual-result rule

For any comparable set or interval:

`calculation_reference = usable_actual_result ?? previous_confirmed_reference`

Never use a suggestion as an observed value.

## 2. Conditioning comparability key

`anchor_key = athlete + machine_type + machine_model + method + work_duration + recovery_duration + intended_effort + output_unit`

A material change to any field creates a new comparison group. A nearby prior anchor may seed a provisional opening target, but confidence resets until the new structure is confirmed.

## 3. Anchor confirmation

### Controlled intervals

An interval qualifies when it is complete, has usable actual output, and reported effort matches intended effort.

Two qualifying observations confirm when:

- watts: `abs(w2 - w1) / median(w1,w2) <= 0.03`
- Echo RPM: `abs(rpm2 - rpm1) <= 1`

Observations need not be consecutive. The confirmed anchor is:

`anchor = median(qualifying_actual_outputs)`

For an even count, median means the arithmetic mean of the two middle values. Apply device rounding after calculating the median.

### Continuous work

Confirm across two comparable completed sessions reported at intended effort. Store average output and first/final steady-block output separately.

## 4. Rogue Echo Bike V1

The Echo Bike has no selectable resistance level. Use completed interval-average RPM.

| Intended | Reported Easy | Reported Medium | Reported Hard |
| --- | ---: | ---: | ---: |
| Easy | Hold actual | Actual −1 RPM | Actual −2 RPM |
| Medium | Actual +1 RPM | Hold actual | Actual −1 RPM |
| Hard | Actual +2 RPM | Actual +1 RPM | Hold actual |

An incomplete interval cannot earn an increase. Missing actual RPM or feedback produces no calculated change.

## 5. Concept2 V1

Use watts internally. RowErg and SkiErg normally display `/500 m`; BikeErg may display `/1000 m`.

### Power and pace

For pace in seconds per metre:

`watts = 2.8 / pace_seconds_per_metre^3`

For a `/500 m` split:

`split500_seconds = 500 × cube_root(2.8 / watts)`

For a `/1000 m` split:

`split1000_seconds = 1000 × cube_root(2.8 / watts)`

### Target-relative power table

| Intended | Reported Easy | Reported Medium | Reported Hard |
| --- | ---: | ---: | ---: |
| Easy | Hold actual watts | Actual ×0.97 | Actual ×0.95 |
| Medium | Actual ×1.03 | Hold actual watts | Actual ×0.97 |
| Hard | Actual ×1.05 | Actual ×1.03 | Hold actual watts |

Round the power target to a device-appropriate whole watt, then convert to the athlete's preferred split display. Do not add or subtract a fixed number of split seconds as the primary calculation.

## 6. Continuous Easy completion and fade

### Recovery-adjusted duration

For WHOOP Red only:

`adjusted_duration = planned_duration × 0.75`

Green/Yellow:

`adjusted_duration = planned_duration`

Qualification threshold:

`completed_duration / adjusted_duration >= 0.90`

### Output fade

For watts or RPM where higher is more output:

`fade = (first_steady_block - final_steady_block) / first_steady_block`

For split seconds where lower is better, calculate in watts first. Stable output requires:

`fade <= 0.05`

A larger fade preserves completed work and compliance but prevents an upward anchor confirmation.

### Duration progression

After two qualifying exposures:

`next_main_duration = current_main_duration + 5 minutes`

- 45 minutes: review point.
- 60 minutes: automatic ceiling.
- Beyond 60: explicit choice only.

These values are product heuristics.

## 7. Baseline heart-rate zones

### Preferred baseline

Use valid modality-specific VT1/VT2 or coach-approved threshold boundaries when available:

- `BG_base`: Blue-to-Green boundary, approximately the lower/aerobic threshold.
- `GR_base`: Green-to-Red boundary, approximately the upper/anaerobic threshold.
- `HRmax`: measured or best credible observed maximum.

### Karvonen fallback

Use a 28-day median resting heart rate rather than a single morning value:

`HRR = HRmax − RHR_28_median`

Fallback boundary estimates:

`BG_base = RHR_28_median + 0.60 × HRR`

`GR_base = RHR_28_median + 0.85 × HRR`

Optional displayed training floor:

`Blue_floor = RHR_28_median + 0.40 × HRR`

These cut-offs are conservative onboarding estimates. Research shows substantial person-to-person variation in threshold location, so the UI must label them **estimated**.

## 8. Daily WHOOP zone movement — approved experimental V1

### Design requirement

Every current WHOOP Recovery score recalculates the day's boundaries. Similar adjacent scores can still display the same rounded BPM.

Define the daily shift `S(R)` in **HRR percentage points** by linear interpolation through:

| WHOOP Recovery `R` | Shift `S` |
| ---: | ---: |
| 0 | −8 points |
| 34 | −5 points |
| 67 | −2 points |
| 100 | 0 points |

Piecewise form:

For `0 <= R <= 34`:

`S = -8 + 3 × (R / 34)`

For `34 < R <= 67`:

`S = -5 + 3 × ((R - 34) / 33)`

For `67 < R <= 100`:

`S = -2 + 2 × ((R - 67) / 33)`

Then:

`BG_today = RHR_28_median + (BG_base_fraction + S/100) × HRR`

`GR_today = RHR_28_median + (GR_base_fraction + S/100) × HRR`

For Karvonen fallback, `BG_base_fraction = 0.60` and `GR_base_fraction = 0.85`.

For measured BPM boundaries, apply the equivalent BPM shift:

`shift_bpm = (S / 100) × HRR`

`BG_today = BG_base + shift_bpm`

`GR_today = GR_base + shift_bpm`

Round only the displayed BPM. Store unrounded calculations and rule version.

### Example

Assume `HRmax=190`, `RHR_28_median=60`, so `HRR=130`.

| Recovery | Approx shift | BG today | GR today |
| ---: | ---: | ---: | ---: |
| 100 | 0.00 points / 0.0 bpm | 138 | 171 |
| 67 | −2.00 points / −2.6 bpm | 135 | 168 |
| 50 | −3.55 points / −4.6 bpm | 133 | 166 |
| 34 | −5.00 points / −6.5 bpm | 132 | 164 |
| 0 | −8.00 points / −10.4 bpm | 128 | 160 |

The formula never changes `HRmax` or the stored baseline. It changes only today's working boundaries.

### Missing and stale data

- Missing/stale Recovery: `BG_today=BG_base`, `GR_today=GR_base`.
- Store source timestamp and freshness state.
- Do not fabricate a recovery score.

### Scientific status

The architecture is Morpheus-inspired, but the coefficients are original. No located study validates these exact points, and WHOOP Recovery is a proprietary composite score. Release first in shadow mode.

## 9. Module ceiling

| WHOOP category | Highest allowed module | Rule |
| --- | --- | --- |
| Green 67–100 | Red | Keep scheduled module; never auto-upgrade |
| Yellow 34–66 | Green | Replace scheduled Red with closest-purpose Green/Blue |
| Red 0–33 | Blue | Replace Green/Red with Blue; Easy duration also suggests −25% |
| Missing/stale | Planned | Use baseline zones and explain missing adjustment |

## 10. Strength calculation principles

The exact Strength algorithm must respect architecture. The generic next-set decision is:

| Actual result relative to target | Default response |
| --- | --- |
| Repetitions missed | Reduce one available equipment step or use architecture rule |
| Actual RIR at least 2 below target | Reduce one step |
| Actual RIR within approximately 1 of target | Hold |
| Actual RIR at least 2 above target | Increase one step only when architecture permits |
| Missing load/reps/RIR | No automatic change |

For rep ranges, use double progression: build repetitions within range at target RIR, then add the smallest load increment and return toward the lower end.

Top/back-off work calculates back-offs from the **actual top set**, not the suggestion. Straight sets do not automatically ramp. Technical/speed work preserves quality intent.
