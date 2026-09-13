import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
require(join(dirname(fileURLToPath(import.meta.url)), 'engine.js'));
require(join(dirname(fileURLToPath(import.meta.url)), 'library.js'));
const Lib = globalThis.HybridLibrary;

test('this product only creates Engine templates', () => {
  let st = Lib.emptyState();
  st = Lib.createTemplate(st, { title: 'Row 15/45', lane: 'strength' });
  assert.equal(st.templates[0].lane, 'engine');
});

test('Engine product rejects lifts and compiles split prescriptions', () => {
  let st = Lib.emptyState();
  st = Lib.createTemplate(st, { title: 'Row 15/45' });
  const tid = st.templates[0].id;
  st = Lib.addExercise(st, tid, { title: 'Bench Press', columns: ['reps', 'weight_kg'] });
  assert.equal(st.templates[0].blocks.length, 0);
  st = Lib.addEnginePiece(st, tid, {
    machine: 'row',
    structure: 'intervals',
    effort: 'hard',
    workSec: 15,
    restSec: 45,
    rounds: 8,
    typedSplitSec: 136,
  });
  const plan = Lib.compile(st.templates[0]);
  const piece = plan.blocks.find((b) => b.kind === 'engine');
  assert.ok(piece);
  assert.match(piece.prescription, /2:16/);
  assert.equal(plan.blocks.some((b) => b.kind === 'lift'), false);
});

test('Engine catalog has no barbell TRACK seed', () => {
  const st = Lib.emptyState();
  assert.equal(st.catalog.exercises.length, 0);
  assert.equal(st.catalog.exercises.some((e) => /bench|squat|deadlift/i.test(e.title)), false);
});

test('compile drops leftover lift blocks even if they sit on the template', () => {
  let st = Lib.emptyState();
  st = Lib.createTemplate(st, { title: 'Mixed' });
  const tid = st.templates[0].id;
  st = Lib.addEnginePiece(st, tid, { machine: 'bike', typedWatts: 200 });
  st.templates[0].blocks.push({
    id: 'blk_lift',
    kind: 'lift',
    title: 'Bench Press',
    setCount: 3,
    columns: ['reps', 'weight_kg'],
    notes: [],
  });
  const plan = Lib.compile(st.templates[0]);
  assert.equal(plan.blocks.some((b) => b.kind === 'lift'), false);
  assert.ok(plan.blocks.some((b) => b.kind === 'engine'));
});
