/**
 * Browser IIFE of @adaptivebrain/kernel. Keep in sync with src/*.js.
 * Copied to apps/strength/brain-kernel.js and apps/engine/brain-kernel.js.
 */
(function (root) {
  const RULE_VERSION = 'v1.0.0';
  const EFFORTS = ['easy', 'medium', 'hard'];

  const rules = {
    conditioning: {
      echo_bike_rpm_multipliers: {
        easy: { easy: 0, medium: -1, hard: -2 },
        medium: { easy: 1, medium: 0, hard: -1 },
        hard: { easy: 2, medium: 1, hard: 0 },
      },
      concept2_power_multipliers: {
        easy: { easy: 1.0, medium: 0.97, hard: 0.95 },
        medium: { easy: 1.03, medium: 1.0, hard: 0.97 },
        hard: { easy: 1.05, medium: 1.03, hard: 1.0 },
      },
    },
  };

  function rank(effort) {
    return { easy: 0, medium: 1, hard: 2 }[effort];
  }

  function decideNextStrength(input) {
    const step = Number(input.equipmentStepKg) || 2.5;
    const suggested = Number(input.suggestedKg);
    const actual = input.actualKg == null ? null : Number(input.actualKg);
    const reference = actual == null || Number.isNaN(actual) ? suggested : actual;

    const missingEffort = !EFFORTS.includes(input.reportedEffort);
    const missingLoad = actual == null || Number.isNaN(actual);
    const missingReps = input.completedReps == null || Number.isNaN(Number(input.completedReps));
    const missedReps = !!input.miss || (
      input.completedReps != null &&
      input.targetReps != null &&
      Number(input.completedReps) < Number(input.targetReps)
    );

    if (missingLoad && !missedReps) {
      return { nextKg: suggested, hold: true, ruleVersion: RULE_VERSION };
    }
    if ((missingEffort || missingReps) && !missedReps) {
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

  function decideNextEngine(input) {
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

  function confirmAnchor({ unit, observations }) {
    const obs = (observations || []).filter((n) => typeof n === 'number');
    if (obs.length < 2) return { confidence: 'provisional', anchor: obs[0] ?? null };
    const a = obs[0];
    const b = obs[1];
    const mid = (a + b) / 2;
    const ok = unit === 'rpm' ? Math.abs(b - a) <= 1 : Math.abs(b - a) / Math.abs(mid) <= 0.03;
    if (!ok) return { confidence: 'provisional', anchor: null };
    return { confidence: 'confirmed', anchor: mid };
  }

  function shiftHrrPoints(R) {
    if (R <= 34) return -8 + 3 * (R / 34);
    if (R <= 67) return -5 + 3 * ((R - 34) / 33);
    return -2 + 2 * ((R - 67) / 33);
  }

  function dailyZones(input) {
    const { hrMax, rhr28, bgBase, grBase } = input;
    const hrr = hrMax - rhr28;
    if (input.freshness === 'missing' || input.freshness === 'stale' || input.recovery == null) {
      return {
        bgToday: bgBase,
        grToday: grBase,
        shiftHrrPoints: 0,
        moduleCeiling: 'planned',
        freshness: input.freshness || 'missing',
        ruleVersion: RULE_VERSION,
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
      ruleVersion: RULE_VERSION,
    };
  }

  function open(facts) {
    if (facts.kind === 'engine') {
      const anchor = facts.anchor;
      if (
        anchor &&
        (anchor.confidence === 'confirmed' || anchor.confidence === 'provisional') &&
        anchor.canonicalOutput != null
      ) {
        return {
          target: anchor.canonicalOutput,
          unit: anchor.canonicalUnit,
          confidence: anchor.confidence,
          needsFirstNumber: false,
          ruleVersion: RULE_VERSION,
        };
      }
      return { target: null, needsFirstNumber: true, ruleVersion: RULE_VERSION };
    }
    if (facts.kind === 'strength') {
      if (typeof facts.lastKg === 'number') {
        return { targetKg: facts.lastKg, needsFirstNumber: false, ruleVersion: RULE_VERSION };
      }
      return { targetKg: null, needsFirstNumber: true, ruleVersion: RULE_VERSION };
    }
    return { ruleVersion: RULE_VERSION };
  }

  function decideNext(facts) {
    if (facts.kind === 'strength') return decideNextStrength(facts);
    if (facts.kind === 'engine') return decideNextEngine(facts);
    return { hold: true, ruleVersion: RULE_VERSION };
  }

  function close(facts) {
    if (facts.kind === 'engine') {
      return { ...confirmAnchor({ unit: facts.unit, observations: facts.observations }), ruleVersion: RULE_VERSION };
    }
    if (facts.kind === 'strength') {
      return { lastKg: facts.actualKg ?? null, ruleVersion: RULE_VERSION };
    }
    return { ruleVersion: RULE_VERSION };
  }

  function loadKind(columns) {
    const cols = Array.isArray(columns) ? columns : [];
    if (cols.includes('weight_pct')) return 'pct';
    if (cols.includes('lwp')) return 'lwp';
    if (cols.includes('weight_kg') || cols.includes('weight_lb')) return 'kg';
    return null;
  }
  function roundToStep(kg, step) {
    const n = Number(kg);
    const s = Number(step) || 2.5;
    if (!Number.isFinite(n) || s <= 0) return 0;
    return Math.max(0, Math.round(n / s) * s);
  }
  function estimateE1rmKg(input) {
    const w = Number(input && input.loadKg);
    const r = Number(input && input.reps);
    if (!w || !r || w <= 0 || r < 1) return 0;
    return Math.round(w * (1 + Math.min(20, r) / 30) * 10) / 10;
  }
  function rememberLift(prev, event) {
    const loadKg = Number(event && event.loadKg);
    const reps = event && event.reps != null ? Number(event.reps) : null;
    const miss = !!(event && event.miss);
    const effort = event && event.effort ? event.effort : null;
    const next = {
      lastKg: Number.isFinite(loadKg) ? loadKg : (prev && prev.lastKg) || null,
      lastReps: reps,
      lastEffort: effort,
      lastMiss: miss,
      e1rmKg: (prev && prev.e1rmKg) || 0,
      lastPct: (prev && prev.lastPct) || null,
    };
    if (!miss && Number.isFinite(loadKg) && loadKg > 0 && reps >= 1) {
      const est = estimateE1rmKg({ loadKg: loadKg, reps: reps });
      next.e1rmKg = Math.max(Number(next.e1rmKg) || 0, est);
      if (next.e1rmKg > 0) next.lastPct = Math.round((loadKg / next.e1rmKg) * 1000) / 10;
    }
    return next;
  }
  function openingKg(input) {
    const cols = (input && input.columns) || [];
    const kind = loadKind(cols);
    const step = Number(input && input.stepKg) || 2.5;
    const lastKg = input && input.lastKg != null && input.lastKg !== '' ? Number(input.lastKg) : null;
    const e1rmKg = Number(input && input.e1rmKg) || 0;
    const lastPct = Number(input && input.lastPct);
    if (kind === 'pct') {
      if (e1rmKg > 0 && lastPct > 0) return roundToStep(e1rmKg * lastPct / 100, step);
      if (lastKg != null && Number.isFinite(lastKg)) return lastKg;
      return null;
    }
    if (kind === 'lwp') {
      if (lastKg == null || !Number.isFinite(lastKg)) return null;
      const hit = !input.lastMiss && input.lastEffort !== 'hard'
        && (input.targetReps == null || Number(input.lastReps) >= Number(input.targetReps));
      return hit ? roundToStep(lastKg + step, step) : lastKg;
    }
    if (kind == null) return null;
    if (lastKg == null || !Number.isFinite(lastKg)) return null;
    return lastKg;
  }
  function kgFromPctPad(input) {
    const n = Number(input && input.raw);
    if (!Number.isFinite(n)) return null;
    if (loadKind(input && input.columns) === 'pct' && n >= 1 && n <= 100 && Number(input.e1rmKg) > 0) {
      return roundToStep(Number(input.e1rmKg) * n / 100);
    }
    return n;
  }

  root.HybridBrainKernel = {
    RULE_VERSION,
    decideNextStrength,
    decideNextEngine,
    confirmAnchor,
    dailyZones,
    shiftHrrPoints,
    open,
    decideNext,
    close,
    loadKind,
    roundToStep,
    estimateE1rmKg,
    rememberLift,
    openingKg,
    kgFromPctPad,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.HybridBrainKernel;
})(typeof globalThis !== 'undefined' ? globalThis : this);
