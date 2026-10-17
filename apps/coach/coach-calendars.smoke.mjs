/**
 * Coach calendars + views — markup + publish helpers.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const dir = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(dir, 'coach.html'), 'utf8');
const views = readFileSync(join(dir, 'coach-views.js'), 'utf8');
const loop = readFileSync(join(dir, 'coach-loop.js'), 'utf8');

for (const needle of [
  'cal-grid',
  'cal-chip',
  'Publish all',
  'Add from library',
  'CoachViews.confirmAssign',
  'roster-table',
  'Save override',
  'function nutritionHtml',
]) {
  if (!html.includes(needle) && !views.includes(needle)) {
    throw new Error(`missing ${needle}`);
  }
}

const sandbox = { console, module: { exports: {} }, globalThis: {} };
sandbox.globalThis = sandbox;
vm.runInNewContext(loop, sandbox);
const L = sandbox.module.exports;

const s = { published: false, status: 'scheduled' };
L.publishSession(s);
if (!s.published) throw new Error('publishSession');
L.unpublishSession(s);
if (s.published) throw new Error('unpublishSession');

const days = L.monthDays('2026-08');
if (days.length !== 31 || days[0] !== '2026-08-01') throw new Error('monthDays');
const grid = L.monthGridCells('2026-08');
if (grid.length % 7 !== 0) throw new Error('monthGridCells length');
if (grid[0] !== null || grid[4] !== null) throw new Error('monthGridCells Aug 2026 padding');
if (grid[5] !== '2026-08-01') throw new Error('monthGridCells Aug 1 is Saturday at index 5');
if (grid.filter(Boolean).length !== 31) throw new Error('monthGridCells day count');
if (L.shiftMonth('2026-08', 1) !== '2026-09') throw new Error('shiftMonth');

console.log('coach-calendars: ok');
