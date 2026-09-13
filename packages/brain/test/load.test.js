import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  loadKind,
  roundToStep,
  estimateE1rmKg,
  rememberLift,
  openingKg,
  kgFromPctPad,
} from '../src/load.js';

test('loadKind from columns', () => {
  assert.equal(loadKind(['reps', 'weight_pct']), 'pct');
  assert.equal(loadKind(['reps', 'lwp']), 'lwp');
  assert.equal(loadKind(['reps', 'weight_kg']), 'kg');
  assert.equal(loadKind(['reps', 'weight_lb']), 'kg');
  assert.equal(loadKind(['reps', 'meters']), null);
});

test('epley 100 x 5 without rir', () => {
  assert.equal(estimateE1rmKg({ loadKg: 100, reps: 5 }), 116.7);
});

test('miss does not raise e1rm', () => {
  const prev = rememberLift(null, { loadKg: 100, reps: 5, effort: 'medium', miss: false });
  const next = rememberLift(prev, { loadKg: 80, reps: 2, effort: 'hard', miss: true });
  assert.equal(next.lastKg, 80);
  assert.equal(next.e1rmKg, prev.e1rmKg);
  assert.equal(next.lastMiss, true);
});

test('opening kg uses last', () => {
  assert.equal(openingKg({ columns: ['reps', 'weight_kg'], lastKg: 100 }), 100);
  assert.equal(openingKg({ columns: ['reps', 'weight_kg'] }), null);
});

test('opening pct uses e1rm and lastPct', () => {
  assert.equal(openingKg({ columns: ['weight_pct'], e1rmKg: 100, lastPct: 70 }), 70);
  assert.equal(openingKg({ columns: ['weight_pct'], lastKg: 90 }), 90);
  assert.equal(openingKg({ columns: ['weight_pct'] }), null);
});

test('opening lwp adds step when last was a hit', () => {
  assert.equal(openingKg({
    columns: ['lwp'],
    lastKg: 100,
    lastEffort: 'medium',
    lastMiss: false,
    lastReps: 8,
    targetReps: 8,
  }), 102.5);
  assert.equal(openingKg({
    columns: ['lwp'],
    lastKg: 100,
    lastEffort: 'hard',
    lastMiss: false,
    lastReps: 8,
    targetReps: 8,
  }), 100);
});

test('pct pad 70 with e1rm 100 is 70 kg', () => {
  assert.equal(kgFromPctPad({ columns: ['weight_pct'], raw: 70, e1rmKg: 100 }), 70);
  assert.equal(kgFromPctPad({ columns: ['weight_pct'], raw: 110, e1rmKg: 100 }), 110);
  assert.equal(kgFromPctPad({ columns: ['weight_kg'], raw: 70, e1rmKg: 100 }), 70);
});

test('round to 2.5', () => {
  assert.equal(roundToStep(71.2), 70);
  assert.equal(roundToStep(71.3), 72.5);
});
