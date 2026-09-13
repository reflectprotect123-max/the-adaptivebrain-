import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
require(join(dirname(fileURLToPath(import.meta.url)), 'library.js'));
const Lib = globalThis.HybridLibrary;

test('track lock includes reps kg meters and for completion', () => {
  const keys = Lib.TRACK.map((t) => t.key);
  assert.ok(keys.includes('reps'));
  assert.ok(keys.includes('weight_kg'));
  assert.ok(keys.includes('meters'));
  assert.ok(keys.includes('for_completion'));
  assert.equal(keys.filter((k) => k === 'inches').length, 1);
  assert.ok(!keys.includes('none'));
  assert.ok(!keys.includes('rpe'));
});

test('create session template starts empty then letters A warmup B1 B2 B3 C', () => {
  let st = Lib.emptyState();
  st = Lib.createTemplate(st, { title: 'Upper' });
  const tid = st.templates[0].id;
  st = Lib.addCircuit(st, tid, { title: 'Bench Press Warm-Up', instructions: 'Foam roll\nPec stretch' });
  st = Lib.addExercise(st, tid, { title: 'Bench Press', setCount: 3, columns: ['reps', 'weight_kg'] });
  st = Lib.addExercise(st, tid, { title: 'Lat Pull Downs', setCount: 3, columns: ['reps', 'weight_kg'] });
  st = Lib.linkSuperset(st, tid, st.templates[0].blocks[1].id, st.templates[0].blocks[2].id);
  st = Lib.addExercise(st, tid, { title: 'Back Squat', setCount: 3, columns: ['reps', 'weight_kg'] });
  st = Lib.linkSuperset(st, tid, st.templates[0].blocks[2].id, st.templates[0].blocks[3].id);
  st = Lib.addExercise(st, tid, { title: 'Bendh', setCount: 3, columns: ['reps', 'meters'] });
  const letters = Lib.lettered(st.templates[0]).map((b) => b.letter);
  assert.deepEqual(letters, ['A', 'B1', 'B2', 'B3', 'C']);
});

test('compile plan maps complete + lifts + section labels for training/logger', () => {
  let st = Lib.emptyState();
  st = Lib.createTemplate(st, { title: 'Session Template', instructions: 'Test' });
  const tid = st.templates[0].id;
  st = Lib.addCircuit(st, tid, { title: 'Warm-Up', instructions: '1. Foam roll' });
  st = Lib.addExercise(st, tid, { title: 'Bench Press', setCount: 5, columns: ['reps', 'weight_kg'], notes: ['increase weight'] });
  const plan = Lib.compile(st.templates[0]);
  assert.equal(plan.title, 'Session Template');
  assert.equal(plan.instructions, 'Test');
  const kinds = plan.blocks.map((b) => b.kind);
  assert.ok(kinds.includes('warmup'));
  assert.ok(kinds.includes('lift'));
  assert.ok(kinds.includes('section'));
  const lift = plan.blocks.find((b) => b.kind === 'lift');
  assert.equal(lift.prescription.includes('5'), true);
  assert.deepEqual(lift.columns, ['reps', 'weight_kg']);
});

test('assign template to date wins over fallback demo', () => {
  let st = Lib.emptyState();
  st = Lib.createTemplate(st, { title: 'Mine' });
  const tid = st.templates[0].id;
  st = Lib.addExercise(st, tid, { title: 'Front Squat', setCount: 3, columns: ['reps'] });
  st = Lib.assignDate(st, tid, '2026-09-11');
  const plan = Lib.planForDate(st, '2026-09-11', { title: 'Demo', blocks: [{ kind: 'lift', letter: 'Z', title: 'Demo Lift' }] });
  assert.equal(plan.title, 'Mine');
  assert.equal(plan.blocks.some((b) => b.title === 'Front Squat'), true);
});

test('reps plus meters compiles a metres prescription', () => {
  let st = Lib.emptyState();
  st = Lib.createTemplate(st, { title: 'Sled day' });
  const tid = st.templates[0].id;
  st = Lib.addExercise(st, tid, { title: 'Sled', setCount: 3, columns: ['reps', 'meters'] });
  const lift = Lib.compile(st.templates[0]).blocks.find((b) => b.kind === 'lift');
  assert.match(lift.prescription, /m/);
  assert.deepEqual(lift.columns, ['reps', 'meters']);
});

test('create catalog exercise with reps + meters is searchable', () => {
  let st = Lib.emptyState();
  st = Lib.createCatalogExercise(st, { title: 'Bendh', columns: ['reps', 'meters'] });
  const hits = Lib.searchCatalog(st, 'exercises', 'bend');
  assert.equal(hits[0].title, 'Bendh');
  assert.deepEqual(hits[0].columns, ['reps', 'meters']);
});
