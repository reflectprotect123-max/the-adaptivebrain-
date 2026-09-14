/**
 * R3 session builder — markup + template round-trip.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const dir = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(dir, 'coach.html'), 'utf8');
const src = readFileSync(join(dir, 'coach-loop.js'), 'utf8');

for (const needle of [
  'Coach instructions',
  'Add a block type',
  '+ Strength',
  'For Weight',
  'For Completion',
  'Choose exercise',
  'Search variants',
  'pickExerciseVariant',
  'New session',
  'block-card',
  'engine-box',
  'Effort',
  'Steady-state',
  'Edit prescription',
  'Target RIR',
  'builderPrescriptionHtml',
  'log-columns.js',
  'removeBlk',
  'prep-textarea',
  'Delete block',
  'block-drag-handle',
  'coachBlockList',
  'moveBlock',
]) {
  if (!html.includes(needle)) throw new Error(`coach.html missing ${needle}`);
}
if (html.includes('Exercise instructions')) {
  throw new Error('coach.html must not show per-exercise instructions field in builder');
}
if (!src.includes('autopilot load')) throw new Error('coach-loop.js missing autopilot load hint');
if (!src.includes('Uncategorized')) throw new Error('coach-loop.js missing Uncategorized category');
if (!src.includes('COND_EFFORTS')) throw new Error('coach-loop.js missing COND_EFFORTS');
if (!src.includes('applyCondBuilderToBlock')) throw new Error('coach-loop.js missing applyCondBuilderToBlock');
if (!src.includes('condPlanLineBlock')) throw new Error('coach-loop.js missing condPlanLineBlock');

if (!src.includes('parseRepRange')) throw new Error('coach-loop.js missing parseRepRange');

const sandbox = { console, module: { exports: {} }, globalThis: {} };
sandbox.globalThis = sandbox;
vm.runInNewContext(src, sandbox);
const L = sandbox.module.exports || sandbox.CoachLoop;

const rirEx = L.makeExercise({ name: 'Squat', sets: 3, reps: '6-8', load: '', targetRir: 3 });
if (rirEx.targetRir !== 3) throw new Error('targetRir on exercise');
const rirLine = L.prescriptionLine(rirEx);
if (!rirLine.includes('target 3 RIR')) throw new Error('prescription target RIR: ' + rirLine);
const range = L.parseRepRange('6-8');
if (!range || range.lo !== 6 || range.hi !== 8) throw new Error('parseRepRange');

if (!L.BLOCK_CATEGORIES.includes('Uncategorized')) {
  throw new Error('BLOCK_CATEGORIES must include Uncategorized');
}

const t = L.makeTemplate({
  name: 'Test session',
  coachInstructions: 'Move well.',
  blocks: [
    L.makeBlock({
      type: 'strength',
      category: 'Strength/Power',
      scoring: 'weight',
      exercises: [L.makeExercise({ name: 'Bench Press', sets: 3, reps: '5', load: '80', metric: 'Weight' })],
    }),
  ],
});

if (t.blocks[0].letter !== 'A') throw new Error('expected block letter A');
if (t.blocks[0].scoring !== 'weight') throw new Error('scoring weight');
const line = L.prescriptionLine(t.blocks[0].exercises[0]);
if (!line.includes('3')) throw new Error('prescription line: ' + line);

const cross = L.decorateBlocks([
  L.makeBlock({
    type: 'strength',
    category: 'Strength/Power',
    exercises: [L.makeExercise({ name: 'Squat A', sets: 3, reps: '5' })],
  }),
  L.makeBlock({
    type: 'strength',
    category: 'Strength/Power',
    superset: true,
    exercises: [L.makeExercise({ name: 'Press B', sets: 3, reps: '8' })],
  }),
  L.makeBlock({
    type: 'strength',
    category: 'Strength/Power',
    exercises: [L.makeExercise({ name: 'Row C', sets: 3, reps: '10' })],
  }),
]);
if (cross[0].letter !== 'A') throw new Error('cross block A letter');
if (cross[1].letter !== 'B1') throw new Error('cross superset leader expected B1 got ' + cross[1].letter);
if (cross[2].letter !== 'B2') throw new Error('cross superset partner expected B2 got ' + cross[2].letter);
if (!cross[2].supersetPartner) throw new Error('cross superset partner flag');

const reorder = L.reorderBlocks(
  [
    L.makeBlock({ type: 'strength', heading: 'A', exercises: [L.makeExercise({ name: 'A' })] }),
    L.makeBlock({ type: 'strength', heading: 'B', exercises: [L.makeExercise({ name: 'B' })] }),
    L.makeBlock({ type: 'text', heading: 'Prep', notes: 'warm' }),
  ],
  0,
  2,
);
if (reorder[0].heading !== 'B' || reorder[1].heading !== 'A' || reorder[2].heading !== 'Prep') {
  throw new Error('reorderBlocks failed: ' + reorder.map((b) => b.heading).join(','));
}

const session = L.instantiateSession(t, { athleteId: 'ath-1', date: '2026-08-27', name: t.name });
if (!session.blocks.length) throw new Error('instantiateSession empty');
if (session.coachInstructions !== 'Move well.') throw new Error('coach instructions copy');

const cond = L.makeBlock({
  type: 'conditioning',
  condFmt: 'intervals',
  effort: 'medium',
  modality: 'Bike',
  rounds: 4,
  workSec: 240,
  restSec: 180,
});
if (cond.effort !== 'medium') throw new Error('cond effort');
if (cond.condFmt !== 'intervals') throw new Error('cond fmt');
const plan = L.condPlanLineBlock(cond);
if (!plan.includes('Bike') || !plan.includes('Medium') || !plan.includes('4×')) {
  throw new Error('plan line: ' + plan);
}
L.applyCondBuilderToBlock(cond, { effort: 'hard', modality: 'Rower' });
if (cond.effort !== 'hard' || cond.modality !== 'Rower') throw new Error('applyCondBuilder patch');
if (L.formatMmSs(240) !== '4:00') throw new Error('formatMmSs');
if (L.parseMmSs('3:00') !== 180) throw new Error('parseMmSs');

console.log('coach-session-builder: ok', { blocks: t.blocks.length, letter: t.blocks[0].letter, plan });
