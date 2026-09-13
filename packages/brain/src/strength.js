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
