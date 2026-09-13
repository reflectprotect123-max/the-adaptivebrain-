import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { decideNextEngine } from '../src/engine.js';
import { RULE_VERSION } from '../src/types.js';

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
    assert.equal(out.ruleVersion, RULE_VERSION);
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
    assert.equal(out.ruleVersion, RULE_VERSION);
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
  assert.equal(out.hold, true);
  assert.equal(out.ruleVersion, RULE_VERSION);
});

test('echo incomplete cannot increase', () => {
  const out = decideNextEngine({
    machine: 'echo',
    intendedEffort: 'medium',
    reportedEffort: 'easy',
    actualOutput: 60,
    complete: false,
    unit: 'rpm',
  });
  assert.equal(out.nextOutput, 60);
  assert.equal(out.hold, true);
  assert.equal(out.ruleVersion, RULE_VERSION);
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
  assert.equal(out.hold, true);
  assert.equal(out.ruleVersion, RULE_VERSION);
});

test('missing actualOutput holds', () => {
  const out = decideNextEngine({
    machine: 'echo',
    intendedEffort: 'medium',
    reportedEffort: 'easy',
    actualOutput: null,
    complete: true,
    unit: 'rpm',
  });
  assert.equal(out.nextOutput, null);
  assert.equal(out.hold, true);
  assert.equal(out.ruleVersion, RULE_VERSION);
});
