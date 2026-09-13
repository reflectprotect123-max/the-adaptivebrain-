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

test('engine open uses provisional anchor', () => {
  const out = open({ kind: 'engine', anchor: { confidence: 'provisional', canonicalOutput: 60, canonicalUnit: 'rpm' } });
  assert.equal(out.target, 60);
  assert.equal(out.needsFirstNumber, false);
});

test('strength open without history does not invent kg', () => {
  const out = open({ kind: 'strength', lastKg: null });
  assert.equal(out.targetKg, null);
});

test('engine close confirms two agreeing watts', () => {
  const out = close({ kind: 'engine', unit: 'watts', observations: [200, 205] });
  assert.equal(out.confidence, 'confirmed');
  assert.equal(out.anchor, 202.5);
});

test('decideNext engine dispatches', () => {
  const out = decideNext({
    kind: 'engine',
    machine: 'echo',
    intendedEffort: 'medium',
    reportedEffort: 'easy',
    actualOutput: 60,
    complete: true,
    unit: 'rpm',
  });
  assert.equal(out.nextOutput, 61);
});
