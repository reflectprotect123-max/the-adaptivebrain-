import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { decideNext, open } from '../src/index.js';

const require = createRequire(import.meta.url);
require(join(dirname(fileURLToPath(import.meta.url)), '../browser-iife.js'));
const K = globalThis.HybridBrainKernel;

test('browser IIFE matches ESM decideNext strength', () => {
  const facts = {
    kind: 'strength',
    intendedEffort: 'medium',
    reportedEffort: 'easy',
    suggestedKg: 100,
    actualKg: 100,
    miss: false,
    completedReps: 5,
    targetReps: 5,
    equipmentStepKg: 2.5,
  };
  assert.equal(K.decideNext(facts).nextKg, decideNext(facts).nextKg);
});

test('browser IIFE open does not invent engine target', () => {
  const out = K.open({ kind: 'engine', anchor: null });
  assert.equal(out.target, null);
  assert.equal(out.needsFirstNumber, true);
  assert.deepEqual(out, open({ kind: 'engine', anchor: null }));
});
