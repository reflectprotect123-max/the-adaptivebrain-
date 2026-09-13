import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { decideNextStrength } from '../src/strength.js';
import { RULE_VERSION } from '../src/types.js';

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
    assert.equal(out.ruleVersion, RULE_VERSION);
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
  assert.equal(out.ruleVersion, RULE_VERSION);
});

test('missing completedReps holds actual', () => {
  const out = decideNextStrength({
    intendedEffort: 'medium',
    reportedEffort: 'easy',
    suggestedKg: 100,
    actualKg: 100,
    miss: false,
    completedReps: null,
    targetReps: 5,
    equipmentStepKg: 2.5,
  });
  assert.equal(out.nextKg, 100);
  assert.equal(out.hold, true);
  assert.equal(out.ruleVersion, RULE_VERSION);
});

test('rep shortfall reduces one step without miss flag', () => {
  const out = decideNextStrength({
    intendedEffort: 'medium',
    reportedEffort: 'easy',
    suggestedKg: 100,
    actualKg: 100,
    miss: false,
    completedReps: 3,
    targetReps: 5,
    equipmentStepKg: 2.5,
  });
  assert.equal(out.nextKg, 97.5);
  assert.equal(out.hold, false);
  assert.equal(out.ruleVersion, RULE_VERSION);
});
