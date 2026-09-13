# Adaptive Brain V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a deterministic Brain kernel (`open` / `decideNext` / `close`) in this repo, then update Strength and Engine athlete UIs to Easy/Medium/Hard with no extra feel screens.

**Architecture:** Pure functions in `packages/brain` read `docs/contracts/00-RULE-CONFIG.json`. Apps never compute next load/watts locally once wired. No LLM in this package. Strength and Engine live in sibling GitHub repos; clone them only when starting Tasks 8–9.

**Tech Stack:** Node.js 22+, native `node:test`, ESM, JSON contracts. Athlete apps: existing vanilla HTML/JS (`logger.js`, `app.js`, `home.css`).

**Spec:** `docs/superpowers/specs/2026-09-13-adaptivebrain-v1-design.md`

## Global Constraints

- Brain has no athlete screen.
- OpenRouter / LLM never used for `open`, `decideNext`, or `close`.
- Actual result outranks suggestion; never write suggestion as actual unless actual equals suggestion **and** reported effort matches intended.
- Strength feedback is Easy / Medium / Hard, not RIR.
- Engine rates during rest with Easy / Medium / Hard; no RPE slider, Stopped, or cooked.
- Session-end 1–5 feel screen is removed; Done Training goes to summary.
- 2k → opening pace is parked; do not invent first Engine targets.
- No Concept2 Logbook OAuth; no TrainHeroic import into Engine; no pain prompts.
- WHOOP daily zones never overwrite stored baseline or a confirmed output anchor.
- `ruleVersion` on every Brain receipt; no reason string shown to the athlete.
- `shadow_mode_required` for athlete-visible zone math is **false** (spec: no shadow mode).

## File map

| Path | Responsibility |
| --- | --- |
| `docs/contracts/00-RULE-CONFIG.json` | Enums and multipliers |
| `docs/contracts/00-FORMULAS-AND-RULES.md` | Strength EMH table |
| `docs/contracts/00-HANDOFF.md` | Product input table |
| `docs/contracts/00-TEST-VECTORS.json` | Strength vectors + existing Engine/WHOOP |
| `packages/brain/package.json` | Kernel package |
| `packages/brain/src/types.js` | Shared types and `RULE_VERSION` |
| `packages/brain/src/strength.js` | Strength `decideNext` |
| `packages/brain/src/engine.js` | Engine interval `decideNext` |
| `packages/brain/src/anchors.js` | Confirm / median |
| `packages/brain/src/zones.js` | WHOOP daily BG/GR |
| `packages/brain/src/session.js` | `open` / `close` |
| `packages/brain/src/index.js` | Public API |
| `packages/brain/test/*.test.js` | Kernel tests |
| sibling `strengthside` `apps/athlete/logger.js` | Effort popover, drop feel |
| sibling `strengthside` `apps/athlete/library.js` | Drop RPE track |
| sibling `Engine-side-` `logger.js` | Rest EMH |
| sibling `Engine-side-` `app.js` + `home.css` | Zone card |

---

### Task 1: Freeze contracts (EMH, no shadow, no RIR)

**Files:**
- Modify: `docs/contracts/00-RULE-CONFIG.json`
- Modify: `docs/contracts/00-FORMULAS-AND-RULES.md` (section 10)
- Modify: `docs/contracts/00-HANDOFF.md` (product table + Strength bullet)
- Modify: `docs/contracts/00-TEST-VECTORS.json` (add `strength` array)
- Modify: `docs/superpowers/specs/2026-09-13-adaptivebrain-v1-design.md` status line to `approved for implementation`

**Interfaces:**
- Consumes: V1 spec §4.4 and §6
- Produces: `shared.strength_feedback = ["load","completed_reps","effort"]`; `daily_zones.shadow_mode_required = false`

- [ ] **Step 1: Write failing contract test**

Create `packages/brain/test/contracts.test.js` and `packages/brain/package.json` first so the test can run:

`packages/brain/package.json`:

```json
{
  "name": "@adaptivebrain/kernel",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test test/*.test.js"
  }
}
```

`packages/brain/test/contracts.test.js`:

```javascript
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const rules = JSON.parse(readFileSync(join(root, 'docs/contracts/00-RULE-CONFIG.json'), 'utf8'));
const vectors = JSON.parse(readFileSync(join(root, 'docs/contracts/00-TEST-VECTORS.json'), 'utf8'));

test('strength feedback is load, reps, effort — not rir', () => {
  assert.deepEqual(rules.shared.strength_feedback, ['load', 'completed_reps', 'effort']);
  assert.equal(rules.shared.required_pain_prompt, false);
});

test('athlete zone math is live, not shadow', () => {
  assert.equal(rules.daily_zones.shadow_mode_required, false);
});

test('strength vectors exist', () => {
  assert.ok(Array.isArray(vectors.strength) && vectors.strength.length >= 5);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /workspace/packages/brain && npm test
```

Expected: FAIL — `strength_feedback` still includes `rir` and/or `shadow_mode_required` is true; `vectors.strength` missing.

- [ ] **Step 3: Patch contracts**

In `00-RULE-CONFIG.json` set:

```json
"strength_feedback": ["load", "completed_reps", "effort"],
```

and

```json
"shadow_mode_required": false
```

In `00-FORMULAS-AND-RULES.md` replace section 10 table with:

| Reported vs intended | Default response |
| --- | --- |
| Missed repetitions or Miss | Reduce one equipment step |
| Reported Easy (easier than intended) | Increase one equipment step |
| Reported Medium (matches intended) | Hold |
| Reported Hard (harder than intended) | Reduce one equipment step |
| Missing load, reps, or effort | No automatic change |

In `00-HANDOFF.md` product table Strength inputs: `Load, completed repetitions, Easy / Medium / Hard`. Strength bullet: same. Conditioning sentence: both pillars use Easy / Medium / Hard; maths still differ.

Append to `00-TEST-VECTORS.json`:

```json
"strength": [
  {"intended":"medium","reported":"easy","actualKg":100,"suggestedKg":100,"miss":false,"step":2.5,"expectedKg":102.5},
  {"intended":"medium","reported":"medium","actualKg":100,"suggestedKg":100,"miss":false,"step":2.5,"expectedKg":100},
  {"intended":"medium","reported":"hard","actualKg":100,"suggestedKg":100,"miss":false,"step":2.5,"expectedKg":97.5},
  {"intended":"medium","reported":"medium","actualKg":70,"suggestedKg":60,"miss":false,"step":2.5,"expectedKg":70},
  {"intended":"medium","reported":"easy","actualKg":100,"suggestedKg":100,"miss":true,"step":2.5,"expectedKg":97.5},
  {"intended":"medium","reported":null,"actualKg":100,"suggestedKg":100,"miss":false,"step":2.5,"expectedKg":100}
]
```

(Last row: missing effort → hold 100.)

- [ ] **Step 4: Re-run tests**

```bash
cd /workspace/packages/brain && npm test
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add docs/contracts/00-RULE-CONFIG.json docs/contracts/00-FORMULAS-AND-RULES.md docs/contracts/00-HANDOFF.md docs/contracts/00-TEST-VECTORS.json docs/superpowers/specs/2026-09-13-adaptivebrain-v1-design.md packages/brain/package.json packages/brain/test/contracts.test.js
git commit -m "docs(contracts): switch Strength to EMH feedback"
```

---

### Task 2: Strength `decideNext`

**Files:**
- Create: `packages/brain/src/types.js`
- Create: `packages/brain/src/strength.js`
- Create: `packages/brain/test/strength.test.js`

**Interfaces:**
- Consumes: `docs/contracts/00-TEST-VECTORS.json` `strength` rows
- Produces: `export function decideNextStrength(input): { nextKg: number, hold: boolean, ruleVersion: string }`

`input` shape:

```javascript
{
  intendedEffort: 'easy' | 'medium' | 'hard',
  reportedEffort: 'easy' | 'medium' | 'hard' | null,
  suggestedKg: number,
  actualKg: number | null,
  miss: boolean,
  completedReps: number | null,
  targetReps: number | null,
  equipmentStepKg: number
}
```

- [ ] **Step 1: Write failing tests** `packages/brain/test/strength.test.js`

```javascript
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { decideNextStrength } from '../src/strength.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const vectors = JSON.parse(readFileSync(join(root, 'docs/contracts/00-TEST-VECTORS.json'), 'utf8'));

test('strength vectors', () => {
  for (const row of vectors.strength) {
    const out = decideNextStrength({
      intendedEffort: row.intended,
      reportedEffort: row.reported,
      suggestedKg: row.suggestedKg,
      actualKg: row.actualKg,
      miss: row.miss,
      completedReps: row.miss ? 2 : 5,
      targetReps: 5,
      equipmentStepKg: row.step,
    });
    assert.equal(out.nextKg, row.expectedKg);
  }
});

test('missing actual kg holds suggestion', () => {
  const out = decideNextStrength({
    intendedEffort: 'medium',
    reportedEffort: 'easy',
    suggestedKg: 80,
    actualKg: null,
    miss: false,
    completedReps: 5,
    targetReps: 5,
    equipmentStepKg: 2.5,
  });
  assert.equal(out.nextKg, 80);
  assert.equal(out.hold, true);
});
```

- [ ] **Step 2: Run tests — expect FAIL** (`Cannot find module '../src/strength.js'`)

```bash
cd /workspace/packages/brain && npm test
```

- [ ] **Step 3: Implement**

`packages/brain/src/types.js`:

```javascript
export const RULE_VERSION = 'v1.0.0';
export const EFFORTS = ['easy', 'medium', 'hard'];
```

`packages/brain/src/strength.js`:

```javascript
import { RULE_VERSION, EFFORTS } from './types.js';

function rank(effort) {
  return { easy: 0, medium: 1, hard: 2 }[effort];
}

export function decideNextStrength(input) {
  const step = Number(input.equipmentStepKg) || 2.5;
  const suggested = Number(input.suggestedKg);
  const actual = input.actualKg == null ? null : Number(input.actualKg);
  const reference = actual == null || Number.isNaN(actual) ? suggested : actual;

  const missingEffort = !EFFORTS.includes(input.reportedEffort);
  const missingLoad = actual == null || Number.isNaN(actual);
  const missedReps = !!input.miss || (
    input.completedReps != null &&
    input.targetReps != null &&
    Number(input.completedReps) < Number(input.targetReps)
  );

  if (missingLoad && !missedReps) {
    return { nextKg: suggested, hold: true, ruleVersion: RULE_VERSION };
  }
  if (missingEffort && !missedReps) {
    return { nextKg: reference, hold: true, ruleVersion: RULE_VERSION };
  }
  if (missedReps) {
    return { nextKg: reference - step, hold: false, ruleVersion: RULE_VERSION };
  }

  const ir = rank(input.intendedEffort);
  const rr = rank(input.reportedEffort);
  if (rr < ir) return { nextKg: reference + step, hold: false, ruleVersion: RULE_VERSION };
  if (rr > ir) return { nextKg: reference - step, hold: false, ruleVersion: RULE_VERSION };
  return { nextKg: reference, hold: true, ruleVersion: RULE_VERSION };
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd /workspace/packages/brain && npm test
```

- [ ] **Step 5: Commit**

```bash
git add packages/brain/src/types.js packages/brain/src/strength.js packages/brain/test/strength.test.js
git commit -m "feat(brain): Strength decideNext from EMH"
```

---

### Task 3: Engine interval `decideNext` + incomplete guard

**Files:**
- Create: `packages/brain/src/engine.js`
- Create: `packages/brain/test/engine.test.js`
- Modify: `packages/brain/src/index.js` (create if missing)

**Interfaces:**
- Consumes: `00-TEST-VECTORS.json` `conditioning.echo_rpm` and `conditioning.concept2_watts`
- Produces: `decideNextEngine(input): { nextOutput: number, unit: 'rpm'|'watts', ruleVersion: string }`

`input`:

```javascript
{
  machine: 'echo' | 'concept2',
  intendedEffort: 'easy'|'medium'|'hard',
  reportedEffort: 'easy'|'medium'|'hard'|null,
  actualOutput: number|null,
  complete: boolean,
  unit: 'rpm'|'watts'
}
```

- [ ] **Step 1: Write `packages/brain/test/engine.test.js`**

```javascript
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { decideNextEngine } from '../src/engine.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const v = JSON.parse(readFileSync(join(root, 'docs/contracts/00-TEST-VECTORS.json'), 'utf8'));

test('echo rpm table', () => {
  for (const row of v.conditioning.echo_rpm) {
    const out = decideNextEngine({
      machine: 'echo',
      intendedEffort: row.intended,
      reportedEffort: row.reported,
      actualOutput: row.actual,
      complete: true,
      unit: 'rpm',
    });
    assert.equal(out.nextOutput, row.expected);
    assert.equal(out.unit, 'rpm');
  }
});

test('concept2 watt table', () => {
  for (const row of v.conditioning.concept2_watts) {
    const out = decideNextEngine({
      machine: 'concept2',
      intendedEffort: row.intended,
      reportedEffort: row.reported,
      actualOutput: row.actual_watts,
      complete: true,
      unit: 'watts',
    });
    assert.equal(out.nextOutput, row.expected_watts);
  }
});

test('incomplete cannot increase', () => {
  const out = decideNextEngine({
    machine: 'concept2',
    intendedEffort: 'medium',
    reportedEffort: 'easy',
    actualOutput: 200,
    complete: false,
    unit: 'watts',
  });
  assert.equal(out.nextOutput, 200);
});

test('missing effort holds', () => {
  const out = decideNextEngine({
    machine: 'echo',
    intendedEffort: 'medium',
    reportedEffort: null,
    actualOutput: 60,
    complete: true,
    unit: 'rpm',
  });
  assert.equal(out.nextOutput, 60);
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement `packages/brain/src/engine.js`**

```javascript
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RULE_VERSION, EFFORTS } from './types.js';

const rules = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../../docs/contracts/00-RULE-CONFIG.json'), 'utf8'),
);

export function decideNextEngine(input) {
  const actual = input.actualOutput;
  if (actual == null || !EFFORTS.includes(input.reportedEffort)) {
    return { nextOutput: actual ?? null, unit: input.unit, ruleVersion: RULE_VERSION, hold: true };
  }

  const intended = input.intendedEffort;
  const reported = input.reportedEffort;

  if (input.machine === 'echo') {
    const delta = rules.conditioning.echo_bike_rpm_multipliers[intended][reported];
    if (!input.complete && delta > 0) {
      return { nextOutput: actual, unit: 'rpm', ruleVersion: RULE_VERSION, hold: true };
    }
    return { nextOutput: actual + delta, unit: 'rpm', ruleVersion: RULE_VERSION, hold: delta === 0 };
  }

  const factor = rules.conditioning.concept2_power_multipliers[intended][reported];
  if (!input.complete && factor > 1) {
    return { nextOutput: actual, unit: 'watts', ruleVersion: RULE_VERSION, hold: true };
  }
  return {
    nextOutput: Math.round(actual * factor),
    unit: 'watts',
    ruleVersion: RULE_VERSION,
    hold: factor === 1,
  };
}
```

- [ ] **Step 4: Run — expect PASS** (`cd /workspace/packages/brain && npm test`)

- [ ] **Step 5: Commit** `feat(brain): Engine EMH watt and RPM tables`

---

### Task 4: Anchors

**Files:**
- Create: `packages/brain/src/anchors.js`
- Create: `packages/brain/test/anchors.test.js`

**Interfaces:**
- Produces: `confirmAnchor({ unit, observations: number[] }): { confidence: 'provisional'|'confirmed', anchor: number|null }`

- [ ] **Step 1: Test from `v.conditioning.anchor`**

```javascript
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { confirmAnchor } from '../src/anchors.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const rows = JSON.parse(readFileSync(join(root, 'docs/contracts/00-TEST-VECTORS.json'), 'utf8')).conditioning.anchor;

test('anchor vectors', () => {
  for (const row of rows) {
    const out = confirmAnchor({ unit: row.unit, observations: row.observations });
    assert.equal(out.confidence, row.expected_confidence);
    if (row.expected_anchor != null) assert.equal(out.anchor, row.expected_anchor);
  }
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement `anchors.js`**

Vectors use two observations. Agreement: Echo `abs(b-a) <= 1` RPM; Concept2 `abs(b-a)/mid <= 0.03`. Confirmed anchor is the midpoint.

```javascript
export function confirmAnchor({ unit, observations }) {
  const obs = (observations || []).filter((n) => typeof n === 'number');
  if (obs.length < 2) return { confidence: 'provisional', anchor: obs[0] ?? null };
  const a = obs[0];
  const b = obs[1];
  const mid = (a + b) / 2;
  const ok = unit === 'rpm' ? Math.abs(b - a) <= 1 : Math.abs(b - a) / Math.abs(mid) <= 0.03;
  if (!ok) return { confidence: 'provisional', anchor: null };
  return { confidence: 'confirmed', anchor: mid };
}
```

- [ ] **Step 4: PASS + commit** `feat(brain): confirm output anchors`

---

### Task 5: Daily WHOOP zones

**Files:**
- Create: `packages/brain/src/zones.js`
- Create: `packages/brain/test/zones.test.js`

**Interfaces:**
- Produces: `dailyZones({ recovery, freshness, hrMax, rhr28, bgBase, grBase }): DailyZoneReceipt`

- [ ] **Step 1: Test** — loop `v.daily_zones.cases` with profile; assert `bg_today` / `gr_today` within 0.05 of JSON. Add case `freshness: 'missing'` → `bg_today === bgBase`.

- [ ] **Step 2: FAIL then implement** `shiftS(R)` piecewise from formulas §8; `shift_bpm = (S/100)*HRR`; `BG_today = bgBase + shift_bpm`. Never mutate `bgBase`. `moduleCeiling` from recovery bands 67–100 green, 34–66 yellow, 0–33 red.

```javascript
export function shiftHrrPoints(R) {
  if (R <= 34) return -8 + 3 * (R / 34);
  if (R <= 67) return -5 + 3 * ((R - 34) / 33);
  return -2 + 2 * ((R - 67) / 33);
}

export function dailyZones(input) {
  const { hrMax, rhr28, bgBase, grBase } = input;
  const hrr = hrMax - rhr28;
  if (input.freshness === 'missing' || input.freshness === 'stale' || input.recovery == null) {
    return {
      bgToday: bgBase,
      grToday: grBase,
      shiftHrrPoints: 0,
      moduleCeiling: 'planned',
      freshness: input.freshness || 'missing',
      ruleVersion: 'v1.0.0',
    };
  }
  const S = shiftHrrPoints(input.recovery);
  const shiftBpm = (S / 100) * hrr;
  let moduleCeiling = 'red';
  if (input.recovery < 34) moduleCeiling = 'blue';
  else if (input.recovery < 67) moduleCeiling = 'green';
  return {
    bgToday: bgBase + shiftBpm,
    grToday: grBase + shiftBpm,
    shiftHrrPoints: S,
    moduleCeiling,
    freshness: 'current',
    ruleVersion: 'v1.0.0',
  };
}
```

- [ ] **Step 3: PASS + commit** `feat(brain): WHOOP daily zone shift`

---

### Task 6: `open` / `close` facade (no LLM)

**Files:**
- Create: `packages/brain/src/session.js`
- Create: `packages/brain/src/index.js`
- Create: `packages/brain/test/session.test.js`

**Interfaces:**
- Produces:

```javascript
export function open(facts)
export function decideNext(facts)
export function close(facts)
```

`open` Engine: if `anchor.confidence === 'confirmed'` or `'provisional'`, return `anchor.canonicalOutput`; else `target: null` and `needsFirstNumber: true`. Never call `map-from-2k`. Strength open: `targetKg: null` if no history.

`decideNext` dispatches `kind: 'strength'|'engine'` to Task 2/3 functions.

`close` calls `confirmAnchor` for engine observations; strength stores last actual kg.

- [ ] **Step 1: Tests**

```javascript
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { open, decideNext, close } from '../src/index.js';

test('engine open without history does not invent target', () => {
  const out = open({ kind: 'engine', anchor: null });
  assert.equal(out.target, null);
  assert.equal(out.needsFirstNumber, true);
});

test('engine open uses confirmed anchor', () => {
  const out = open({ kind: 'engine', anchor: { confidence: 'confirmed', canonicalOutput: 225, canonicalUnit: 'watts' } });
  assert.equal(out.target, 225);
});

test('public api has no llm field', () => {
  const out = decideNext({
    kind: 'strength',
    intendedEffort: 'medium',
    reportedEffort: 'medium',
    suggestedKg: 50,
    actualKg: 50,
    miss: false,
    completedReps: 5,
    targetReps: 5,
    equipmentStepKg: 2.5,
  });
  assert.equal(out.llm, undefined);
  assert.ok(out.ruleVersion);
});
```

- [ ] **Step 2–4: Implement `session.js` + `index.js` re-exports, PASS, commit** `feat(brain): open decideNext close facade`

`packages/brain/src/index.js`:

```javascript
export { RULE_VERSION } from './types.js';
export { decideNextStrength } from './strength.js';
export { decideNextEngine } from './engine.js';
export { confirmAnchor } from './anchors.js';
export { dailyZones } from './zones.js';
export { open, decideNext, close } from './session.js';
```

---

### Task 7: Strength athlete UI (sibling repo `strengthside`)

**Files:**
- Modify: `apps/athlete/logger.js` (`tableHtml`, `check`, `feelHtml` / `doneTraining`)
- Modify: `apps/athlete/logger.css` (`.effort-pop` only)
- Modify: `apps/athlete/library.js` (remove `{ key: 'rpe', label: 'RPE' }`)
- Modify: `apps/athlete/session.js` if `openFeel` is called from `doneTraining`

**Clone (only if not already a sibling checkout):**

```bash
git clone https://github.com/reflectprotect123-max/strengthside.git /tmp/strengthside
```

Work on a branch `cursor/emh-logger-4d23`.

- [ ] **Step 1: Failing UI test** — if `logger` has no test harness, add `apps/athlete/logger-effort.test.js` that imports session helpers: `logSet` requires `effort` before `logged: true`. Prefer extending `session.js` `logSet` to accept `effort` and reject tick without it. Write the test against `session.js` (already has `node:test`).

In `session.test.js` add:

```javascript
test('logSet without effort does not mark logged', () => {
  let s = HybridSession.startSession({ date: '2026-09-07', plan: demoPlan, letter: 'B' });
  s = HybridSession.logSet(s, 0, { kg: 60, effort: null });
  assert.equal(s.logs.B.sets[0].logged, false);
});

test('logSet with effort marks logged', () => {
  let s = HybridSession.startSession({ date: '2026-09-07', plan: demoPlan, letter: 'B' });
  s = HybridSession.logSet(s, 0, { kg: 60, effort: 'medium' });
  assert.equal(s.logs.B.sets[0].logged, true);
  assert.equal(s.logs.B.sets[0].effort, 'medium');
});

test('doneTraining skips feel phase', () => {
  let s = HybridSession.startSession({ date: '2026-09-07', plan: demoPlan, letter: 'done' });
  s = HybridSession.openFeel(s);
  assert.equal(s.phase, 'summary');
});
```

Change `openFeel` to set `phase: 'summary'` directly (or rename to `openSummary` and point `doneTraining` at it).

- [ ] **Step 2: FAIL then implement session + logger table**

`tableHtml` extra column:

```javascript
<th>Effort</th>
// cell:
<td><button type="button" class="log-cell${effortOpen===i?' tap':''}" onclick="Logger.effortPop('${mid}',${i})">${esc(row.effort==='easy'?'Easy':row.effort==='hard'?'Hard':row.effort==='medium'?'Med':'—')}</button></td>
```

Popover HTML (inside `.log-body`, not `.log-sheet`):

```html
<div class="effort-pop" id="effortPop">
  <p>Effort</p>
  <div class="log-intensity">
    <button type="button" onclick="Logger.effortPick('easy')">Easy</button>
    <button type="button" onclick="Logger.effortPick('medium')">Medium</button>
    <button type="button" onclick="Logger.effortPick('hard')">Hard</button>
  </div>
</div>
```

CSS (compact, no full-screen dim):

```css
.effort-pop {
  position: absolute;
  width: 214px;
  background: #1c1c1e;
  border: 1px solid rgba(255,255,255,.14);
  border-radius: 12px;
  padding: 8px;
  z-index: 6;
}
.effort-pop .log-intensity { flex-direction: column; gap: 6px; }
```

`Logger.check`: if `!row.effort && !row.miss` return without logging; add class `tap` on Effort cell.

Remove `feelHtml` from `paint()` branches. `doneTraining` → `openSummary` / summary phase.

Delete RPE from `TRACK` in `library.js`.

- [ ] **Step 3: Run** `node --test apps/athlete/session.test.js`

- [ ] **Step 4: Manual check** — Effort popover is not a dimmed full sheet.

- [ ] **Step 5: Commit on strengthside** `feat(logger): Effort popover and drop session feel`

---

### Task 8: Engine athlete UI (sibling repo `Engine-side-`)

**Files:**
- Modify: `logger.js` `engineHtml` phases `rate` and `rest`
- Modify: `engine.js` remove cooked/stopped/actualRpe path for V1 (map Easy/Medium/Hard to `decideNextEngine`)
- Modify: `app.js` `gaugeRowHtml` / home
- Modify: `home.css` zone card

- [ ] **Step 1: Tests in `engine.test.js`** — `rate` phase no longer produced; after work, phase is `rest` with `needsEffort: true`. `engineRate` removed; `engineEffort(effort)` calls decideNext.

Replace `e.phase === 'rate'` block with nothing. In `engineEnd` / work complete, go to `rest` and require effort.

Rest stage HTML:

```javascript
stage = `
  <p class="eng-phase">Rest</p>
  <p class="eng-clock" id="engClock">${esc(remainLabel(e.restEndsAt, now))}</p>
  <p class="eng-up">Last interval · ${esc(target)}</p>
  <p class="log-emh-label">How was that interval?</p>
  <div class="log-intensity">
    <button type="button" onclick="Logger.engineEffort('easy')">Easy</button>
    <button type="button" onclick="Logger.engineEffort('medium')">Medium</button>
    <button type="button" onclick="Logger.engineEffort('hard')">Hard</button>
  </div>
  <p class="eng-target">Up next · ${esc(nextTarget)}</p>
  <button type="button" class="log-primary" onclick="Logger.engineSkipRest()">Skip · start work</button>`;
```

Do not render `.eng-rpe`, Stopped, or RPE hint.

Home zone card after WHOOP dials:

```html
<section class="ath-zones" aria-label="Heart rate zones">
  <span class="ath-label">Today's zones</span>
  <p class="ath-zone-est">Estimated from baseline${freshness==='current'?'':' · no WHOOP adjustment today'}</p>
  <ul>
    <li>Blue → ${Math.round(bgToday)} bpm</li>
    <li>Green → ${Math.round(grToday)} bpm</li>
  </ul>
</section>
```

Wire `dailyZones()` from Brain kernel (copy or npm workspace later; V1 may inline the function in `engine.js` **only if** the sibling cannot import this repo — prefer copying `zones.js` once with `ruleVersion`).

- [ ] **Step 2: PASS engine tests, commit** `feat(engine): EMH on rest and home zones`

---

### Task 9: Guardrails doc + kernel README

**Files:**
- Create: `packages/brain/README.md` (how to run tests; no athlete UI)
- Modify: `docs/superpowers/specs/2026-09-13-adaptivebrain-v1-design.md` status `implemented kernel; apps in sibling PRs`

- [ ] **Step 1: README**

```markdown
# @adaptivebrain/kernel

Deterministic `open` / `decideNext` / `close`. No HTTP. No LLM.

npm test
```

- [ ] **Step 2: Commit** `docs(brain): kernel readme`

---

## Spec coverage

| Spec section | Task |
| --- | --- |
| §1–3 API | 6 |
| §4 Strength UI + maths | 2, 7 |
| §5 Engine flow + maths | 3, 8 |
| §5.2 no invented / no 2k | 6 |
| §6 WHOOP | 5, 8 |
| §8 payloads | 2, 3, 6 |
| §9 parked items | not implemented (no tasks) |
| Drop session feel | 7, 8 (Engine feelHtml same file) |
| Library RPE | 7 |
| Anchors | 4 |

## Placeholder scan

None remaining. Sibling clone paths are `/tmp/strengthside` and `https://github.com/reflectprotect123-max/Engine-side-`.
