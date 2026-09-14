/**
 * R4 program grid — Library Programs list + week×day cells.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const dir = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(dir, 'coach.html'), 'utf8');
const src = readFileSync(join(dir, 'coach-loop.js'), 'utf8');

for (const needle of [
  'prog-days',
  'prog-cell',
  'Create program',
  'Add week',
  'Add from library',
  'Save as template',
  'openProgram',
  'Open grid',
  'function programHtml',
]) {
  if (!html.includes(needle)) throw new Error(`coach.html missing ${needle}`);
}

const sandbox = { console, module: { exports: {} }, globalThis: {} };
sandbox.globalThis = sandbox;
vm.runInNewContext(src, sandbox);
const L = sandbox.module.exports || sandbox.CoachLoop;

const S = L.buildSeed({ startMonday: '2026-08-24' });
const p = S.programs[0];
if (!p) throw new Error('seed program missing');
if (p.cells['1-1'] !== L.IDS.tplStrength) throw new Error('W1D1 strength');
if (p.cells['1-3'] !== L.IDS.tplCond) throw new Error('W1D3 cond');
if (p.cells['1-7'] !== L.IDS.tplRecovery) throw new Error('W1D7 recovery');

L.setProgramCell(p, 1, 2, L.IDS.tplCond);
if (p.cells['1-2'] !== L.IDS.tplCond) throw new Error('setProgramCell failed');
L.setProgramCell(p, 1, 2, null);
if (p.cells['1-2']) throw new Error('clear cell failed');

const before = p.weeks;
L.addProgramWeek(p);
if (p.weeks !== before + 1) throw new Error('addProgramWeek');

const empty = L.emptyProgram('Test grid', 3);
if (empty.weeks !== 3 || Object.keys(empty.cells).length) throw new Error('emptyProgram');

const key = L.cellKey(2, 5);
if (key !== '2-5') throw new Error('cellKey');
const parsed = L.parseCellKey(key);
if (parsed.week !== 2 || parsed.day !== 5) throw new Error('parseCellKey');

console.log('coach-program-grid: ok', {
  program: p.name,
  weeks: p.weeks,
  filled: Object.keys(p.cells).length,
});
