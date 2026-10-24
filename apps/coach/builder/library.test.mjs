import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
function load() {
  const c = { console };
  c.window = c;
  c.globalThis = c;
  vm.createContext(c);
  for (const f of ['../training-core.js', '../coach-loop.js', 'host.js', 'strength-targets.js', 'library.js']) {
    vm.runInContext(readFileSync(join(dir, f), 'utf8'), c);
  }
  return c;
}

function lib(c = load()) {
  return c.CoachBuilderHost.HybridLibrary;
}

function add(title, extra = {}) {
  const Lib = lib();
  let st = Lib.createTemplate(Lib.emptyState(), { title: 'Session' });
  const id = st.templates[0].id;
  st = Lib.addExercise(st, id, { title, ...extra });
  return { Lib, st, id, block: st.templates[0].blocks.at(-1) };
}

test('createTemplate starts empty without pre-filled cardio', () => {
  const Lib = lib();
  const st = Lib.createTemplate(Lib.emptyState(), { title: 'Ibex' });
  assert.equal(st.templates[0].title, 'Ibex');
  assert.equal(st.templates[0].blocks.length, 0);
});

test('inferred metadata seeds Incline Bench, lunges and RDL as loaded lifts', () => {
  const bench = add('Incline Bench').block;
  assert.equal(bench.equipmentId, 'barbell');
  assert.equal(bench.loadConvention, 'total');
  assert.equal(bench.minimumKg, 20);

  const lunge = add('Deficit Back Rack Lunge').block;
  assert.equal(lunge.equipmentId, 'barbell');
  assert.equal(lunge.loadConvention, 'total');
  assert.equal(lunge.minimumKg, 20);

  const rdl = add('Romanian Deadlift').block;
  assert.equal(rdl.equipmentId, 'barbell');
  assert.equal(rdl.loadConvention, 'total');

  const db = add('DB RDL').block;
  assert.equal(db.equipmentId, 'dumbbell');
  assert.equal(db.loadConvention, 'per_hand');
});

test('patchBlock and ensure keep restSec', () => {
  let { Lib, st, id, block } = add('Incline Bench');
  st = Lib.patchBlock(st, id, block.id, { restSec: 75 });
  assert.equal(Lib.template(st, id).blocks[0].restSec, 75);
  st = Lib.ensure(st);
  assert.equal(Lib.template(st, id).blocks[0].restSec, 75);
});

test('compile publishes rest, rampCount, groupId and percent ranges', () => {
  const Lib = lib();
  let st = Lib.createTemplate(Lib.emptyState(), { title: 'Percent day' });
  const id = st.templates[0].id;
  st = Lib.addExercise(st, id, { title: 'Incline Bench', columns: ['reps', 'weight_pct'], setCount: 4 });
  const benchId = st.templates[0].blocks[0].id;
  st = Lib.patchBlock(st, id, benchId, {
    restSec: 90,
    rampCount: 2,
    pctLow: 63,
    pctHigh: 68,
    percentMode: 'straight',
    prescribed: '63-68',
  });
  st = Lib.addExercise(st, id, { title: 'Front Squat', columns: ['reps', 'weight_pct'], setCount: 5 });
  const squatId = st.templates[0].blocks[1].id;
  st = Lib.patchBlock(st, id, squatId, {
    pctLow: 72,
    pctHigh: 77,
    percentMode: 'build',
    notes: ['5 x 5 @ 72-77% (RPE 8) build over the 5 sets'],
  });
  st = Lib.linkSuperset(st, id, benchId, squatId);
  const plan = Lib.compile(Lib.template(st, id));
  const bench = plan.blocks.find((b) => b.title === 'Incline Bench');
  const squat = plan.blocks.find((b) => b.title === 'Front Squat');
  assert.equal(bench.restSec, 90);
  assert.equal(bench.restSeconds, 90);
  assert.equal(bench.rampCount, 2);
  assert.equal(bench.pctLow, 63);
  assert.equal(bench.pctHigh, 68);
  assert.equal(bench.percentMode, 'straight');
  assert.equal(squat.percentMode, 'build');
  assert.equal(squat.pctLow, 72);
  assert.equal(squat.pctHigh, 77);
  assert.ok(bench.groupId);
  assert.equal(bench.groupId, squat.groupId);
});

test('warmup cardio and bodyweight squat publish timed/bodyweight without kg or barbell', () => {
  const Lib = lib();
  let st = Lib.createTemplate(Lib.emptyState(), { title: 'Prep' });
  const id = st.templates[0].id;
  st = Lib.addExercise(st, id, { title: 'Row', columns: ['seconds'], setCount: 3, value: '180', role: 'warmup' });
  st = Lib.addExercise(st, id, { title: 'Bodyweight Squat', columns: ['reps'], setCount: 3, value: '10', role: 'warmup' });
  const row = st.templates[0].blocks.find((b) => b.title === 'Row');
  const squat = st.templates[0].blocks.find((b) => b.title === 'Bodyweight Squat');
  assert.equal(row.loadConvention, 'bodyweight');
  assert.notEqual(row.equipmentId, 'barbell');
  assert.equal(row.minimumKg, undefined);
  assert.equal(row.columns.join(), 'seconds');
  assert.equal(squat.loadConvention, 'bodyweight');
  assert.notEqual(squat.equipmentId, 'barbell');
  assert.ok(!squat.columns.includes('weight_kg'));
  const plan = Lib.compile(Lib.template(st, id));
  const publishedRow = plan.blocks.find((b) => b.title === 'Row');
  const publishedSquat = plan.blocks.find((b) => b.title === 'Bodyweight Squat');
  assert.equal(publishedRow.loadConvention, 'bodyweight');
  assert.ok(!publishedRow.columns.includes('weight_kg'));
  assert.equal(publishedRow.prescribed, '180');
  assert.equal(publishedSquat.loadConvention, 'bodyweight');
  assert.ok(!publishedSquat.columns.includes('weight_kg'));
  assert.equal(publishedRow.minimumKg, undefined);
  assert.equal(publishedRow.barWeightKg, undefined);
});

test('applyBuilder copies rest, ramp, percent, catalogue id and groupId onto the published session', () => {
  const c = load();
  const Lib = c.CoachBuilderHost.HybridLibrary;
  let st = Lib.createTemplate(Lib.emptyState(), { title: 'Live test' });
  const id = st.templates[0].id;
  st = Lib.addExercise(st, id, { title: 'Incline Bench', columns: ['reps', 'weight_kg'] });
  st = Lib.addExercise(st, id, { title: 'Deficit Back Rack Lunge', columns: ['reps', 'weight_kg'] });
  const bench = st.templates[0].blocks[0];
  const lunge = st.templates[0].blocks[1];
  st = Lib.linkSuperset(st, id, bench.id, lunge.id);
  const linked = Lib.template(st, id).blocks[0];
  linked.restSec = 60;
  linked.rampCount = 2;
  linked.pctLow = 63;
  linked.pctHigh = 68;
  linked.percentMode = 'straight';
  linked.exerciseId = 'cat_incline_bench';
  const t = { id, name: '', blocks: [] };
  c.CoachBuilder.applyBuilder(t, st.templates[0], c.CoachLoop);
  const published = t.blocks[0];
  const ex = published.exercises[0];
  assert.equal(ex.restSec, 60);
  assert.equal(ex.rampCount, 2);
  assert.equal(ex.pctLow, 63);
  assert.equal(ex.pctHigh, 68);
  assert.equal(ex.percentMode, 'straight');
  assert.equal(ex.exerciseId, 'cat_incline_bench');
  assert.equal(published.groupId, t.blocks[1].groupId);
  assert.equal(ex.groupId, published.groupId);
});
