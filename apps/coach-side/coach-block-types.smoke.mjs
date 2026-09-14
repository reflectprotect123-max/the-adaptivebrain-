/**
 * Block type normalization — strength / conditioning / recovery stay distinct.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const dir = dirname(fileURLToPath(import.meta.url));
const loopSrc = readFileSync(join(dir, 'coach-loop.js'), 'utf8');
const bridgeSrc = readFileSync(join(dir, 'coach-bridge.js'), 'utf8');
const indexHtml = readFileSync(join(dir, 'index.html'), 'utf8');

const sandbox = { console, module: { exports: {} }, globalThis: {} };
sandbox.globalThis = sandbox;
vm.runInNewContext(loopSrc, sandbox);
const L = sandbox.module.exports;
sandbox.CoachLoop = L;
sandbox.module = { exports: {} };
vm.runInNewContext(bridgeSrc, sandbox);
const Bridge = sandbox.CoachBridge;

if (!L.normalizeBlockType) throw new Error('normalizeBlockType missing');

const recovery = L.normalizeBlockType({
  type: 'conditioning',
  heading: 'Recovery movement',
  category: 'Recovery',
  recoverySession: true,
  condFmt: 'steady',
  modality: 'Mixed',
  baselineDurationMin: 30,
  targetDurationMin: 30,
});
if (!recovery.recoverySession || recovery.type !== 'conditioning') {
  throw new Error('recovery block not normalized');
}

const cond = L.normalizeBlockType({
  category: 'Conditioning',
  condFmt: 'steady',
  modality: 'Bike',
  targetDurationMin: 20,
});
if (cond.type !== 'conditioning' || (cond.exercises || []).length) {
  throw new Error('conditioning inferred wrong');
}

const strength = L.normalizeBlockType({
  type: 'strength',
  exercises: [{ name: 'Squat', sets: 3, reps: '5' }],
});
if (strength.type !== 'strength') throw new Error('strength block wrong');

const switched = L.decorateBlocks([
  L.makeBlock({
    type: 'strength',
    heading: 'Strength',
    category: 'Strength/Power',
    scoring: 'weight',
    superset: true,
    exercises: [L.makeExercise({ name: 'Squat', sets: 3, reps: '5' })],
  }),
]);
switched[0].superset = true;
delete switched[0].exercises;
switched[0].recoverySession = true;
L.applyCondBuilderToBlock(switched[0], {
  condFmt: 'steady',
  effort: 'easy',
  modality: 'Mixed',
  targetDurationMin: 30,
  heading: 'Recovery movement',
});
switched[0].category = 'Recovery';
switched[0].type = 'conditioning';
[switched[0]] = L.decorateBlocks(switched);
if (!switched[0].recoverySession || switched[0].type !== 'conditioning') {
  throw new Error('strength→recovery conversion failed');
}
if (switched[0].category !== 'Recovery') throw new Error('recovery category lost');

const bridged = Bridge.blocksForAthlete([
  {
    type: 'conditioning',
    recoverySession: true,
    category: 'Recovery',
    condFmt: 'steady',
    modality: 'Mixed',
    targetDurationMin: 30,
  },
])[0];
if (!bridged.recoverySession || bridged.type !== 'conditioning') {
  throw new Error('bridge stripped recovery block');
}

if (!indexHtml.includes('function normalizeWorkoutBlock')) {
  throw new Error('athlete normalizeWorkoutBlock missing');
}
if (!indexHtml.includes('function sessionBlockKindSummary')) {
  throw new Error('sessionBlockKindSummary missing');
}

console.log('coach-block-types: ok');
