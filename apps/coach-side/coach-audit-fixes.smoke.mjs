/**
 * Regression smokes from full-ecosystem bug audit (Aug 2026).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const dir = dirname(fileURLToPath(import.meta.url));
const loopSrc = readFileSync(join(dir, 'coach-loop.js'), 'utf8');
const syncSrc = readFileSync(join(dir, 'coach-sync.js'), 'utf8');
const cloudSrc = readFileSync(join(dir, 'coach-cloud.js'), 'utf8');
const nutSrc = readFileSync(join(dir, 'coach-nutrition.js'), 'utf8');
const strengthSyncSrc = readFileSync(join(dir, 'strength-sync.js'), 'utf8');
const logColsSrc = readFileSync(join(dir, 'log-columns.js'), 'utf8');
const coachHtml = readFileSync(join(dir, 'coach.html'), 'utf8');
const viewsSrc = readFileSync(join(dir, 'coach-views.js'), 'utf8');
const indexHtml = readFileSync(join(dir, 'index.html'), 'utf8');

const sandbox = { console, module: { exports: {} }, globalThis: {} };
sandbox.globalThis = sandbox;
vm.runInNewContext(loopSrc, sandbox);
const L = sandbox.module.exports;
sandbox.CoachLoop = L;
sandbox.module = { exports: {} };
vm.runInNewContext(nutSrc, sandbox);
const CoachNutrition = sandbox.module.exports;
sandbox.module = { exports: {} };
vm.runInNewContext(syncSrc, sandbox);
const Sync = sandbox.CoachSync;
sandbox.module = { exports: {} };
vm.runInNewContext(cloudSrc, sandbox);
const Cloud = sandbox.CoachCloud;

// needsProgramming: published sessions beyond 21-day horizon should not flag athlete
{
  const start = L.today();
  const horizon = L.addDays(start, 21);
  const beyond = L.addDays(horizon, 5);
  const state = {
    athletes: [{ id: 'a1', name: 'Test' }],
    sessions: [
      {
        id: 's1',
        athleteId: 'a1',
        date: beyond,
        published: true,
        status: 'scheduled',
      },
    ],
  };
  const need = L.needsProgramming(state);
  if (need.athletes.length) {
    throw new Error('needsProgramming false-positive for beyond-horizon published session');
  }
}

// needsProgramming: completed-only horizon should not flag athlete
{
  const start = L.today();
  const mid = L.addDays(start, 3);
  const state = {
    athletes: [{ id: 'a1', name: 'Test' }],
    sessions: [
      {
        id: 's1',
        athleteId: 'a1',
        date: mid,
        published: true,
        status: 'completed',
      },
    ],
  };
  const need = L.needsProgramming(state);
  if (need.athletes.length) {
    throw new Error('needsProgramming false-positive for completed-only horizon');
  }
}

// addCalendarSession dedupes same athlete/date/template
{
  const state = L.buildSeed({ startMonday: '2026-08-24' });
  const tplId = state.templates[0].id;
  const athleteId = state.athletes[0].id;
  const date = L.addDays(L.today(), 60);
  const first = L.addCalendarSession(state, { athleteId, date, templateId: tplId });
  const second = L.addCalendarSession(state, { athleteId, date, templateId: tplId });
  if (!first) throw new Error('addCalendarSession first add failed');
  if (second) throw new Error('addCalendarSession should dedupe duplicate add');
}

// addCalendarSession: completed session still blocks duplicate add
{
  const state = L.buildSeed({ startMonday: '2026-08-24' });
  const tplId = state.templates[0].id;
  const athleteId = state.athletes[0].id;
  const date = L.addDays(L.today(), 60);
  const first = L.addCalendarSession(state, { athleteId, date, templateId: tplId });
  if (!first) throw new Error('addCalendarSession first add failed');
  first.status = 'completed';
  const second = L.addCalendarSession(state, { athleteId, date, templateId: tplId });
  if (second) throw new Error('addCalendarSession should dedupe when completed exists');
}

// monthGridCells: invalid month rolls to current month grid, not empty
{
  const cells = L.monthGridCells('bad');
  const dated = cells.filter(Boolean);
  if (dated.length < 28 || dated.length > 31) {
    throw new Error('monthGridCells(bad) should yield a valid month, got ' + dated.length);
  }
}

// mergeSession: same date+templateId must not collapse distinct coach sessions
{
  const state = {
    sessions: [
      {
        id: 'local1',
        coachSessionId: 'coach-a',
        date: '2026-09-01',
        templateId: 'tpl1',
        source: 'coach-bridge',
        status: 'scheduled',
      },
    ],
  };
  const incoming = {
    id: 'incoming2',
    coachSessionId: 'coach-b',
    date: '2026-09-01',
    templateId: 'tpl1',
    source: 'coach-bridge',
    status: 'scheduled',
  };
  if (!Sync.mergeSession(state, incoming)) throw new Error('mergeSession should accept new coachSessionId');
  if (state.sessions.length !== 2) {
    throw new Error('mergeSession collapsed sessions on date+templateId: ' + state.sessions.length);
  }
}

// pickBucket: no silent fallback to athletes[0]
if (syncSrc.includes('payload.athletes[0]')) {
  throw new Error('coach-sync.js still falls back to athletes[0]');
}
if (!syncSrc.includes('athleteEmailFromState')) {
  throw new Error('coach-sync.js missing athleteEmailFromState');
}

// nutritionSnapshot: empty payload is null (no false Macros pill)
{
  const snap = Cloud.nutritionSnapshot({ nutrition: { targetsByAthlete: {}, mealDays: [] } }, 'a1', '2026-08-30');
  if (snap) throw new Error('nutritionSnapshot should be null when no targets/meals');
}

// clearCoachOverride removes targets entirely
{
  const nut = CoachNutrition.ensureNutrition({});
  CoachNutrition.setCoachOverride(nut, 'a1', { calories: 2500, proteinG: 180, carbsG: 250, fatG: 70 });
  CoachNutrition.clearCoachOverride(nut, 'a1');
  if (nut.targetsByAthlete.a1) {
    throw new Error('clearCoachOverride should delete targetsByAthlete entry');
  }
}

// normalizeBlockType: text with leftover effort stays text
{
  const out = L.normalizeBlockType({
    type: 'text',
    category: 'Prep',
    effort: 'easy',
    heading: 'Notes',
  });
  if (out.type !== 'text') throw new Error('text block with effort reverted to ' + out.type);
}

// applyCondBuilderToBlock: empty targetWatts clears field
{
  const b = L.makeBlock({ type: 'conditioning', targetWatts: 180 });
  L.applyCondBuilderToBlock(b, { targetWatts: '' });
  if (b.targetWatts != null) throw new Error('empty targetWatts should clear field');
}

// strength-sync: active sessions protected from remote overwrite
if (!strengthSyncSrc.includes("local.status === 'active'")) {
  throw new Error('strength-sync missing active session guard');
}

// log-columns: weight_kg syncs to ex.load
if (!logColsSrc.includes("loadCol.kind === 'weight_kg'")) {
  throw new Error('log-columns missing weight_kg legacy sync');
}

// coach.html deep audit hooks
if (!coachHtml.includes('L.num(b.baselineDurationMin)')) {
  throw new Error('setBlockType recovery must use L.num not num()');
}
if (!coachHtml.includes('function clearCondFields')) throw new Error('clearCondFields helper missing');
if (!coachHtml.includes('closeCoachExEdit();')) throw new Error('coach.html missing closeCoachExEdit guards');
if (!coachHtml.includes('blockTypeValue(b)')) throw new Error('cellSummary must use blockTypeValue');

// coach-views
if (!viewsSrc.includes('pickLibraryAthlete')) throw new Error('team calendar athlete picker missing');
if (!viewsSrc.includes('hasNutritionBundle = false')) {
  throw new Error('revertPublishOnCloudFail must clear hasNutritionBundle');
}
if (!viewsSrc.includes('function removeLocal()')) {
  throw new Error('deleteChip must unpublish cloud before local delete');
}
if (viewsSrc.match(/ctx\.persist\(\);\s*\n\s*if \(root\.CoachBridge/)) {
  throw new Error('CoachViews.persist still double-pushes bridge');
}

// cloud pull applies scheduled_date
if (!cloudSrc.includes('incoming.date = row.scheduled_date')) {
  throw new Error('pullForAthlete must apply scheduled_date');
}

// athlete deep fixes
if (!indexHtml.includes('function sessionHasStrengthWork')) {
  throw new Error('sessionHasStrengthWork missing');
}
if (!indexHtml.includes('if(sessionHasStrengthWork(x)){train();return}')) {
  throw new Error('enterSessionScreen must prefer strength for hybrid sessions');
}
if (!indexHtml.includes("x.status!=='abandoned'")) {
  throw new Error('coachControlsStrength must ignore abandoned prescriptions');
}
if (!indexHtml.includes('sessionLooksLikeConditioning(active)&&!sessionHasStrengthWork(active)')) {
  throw new Error('nextConditioningSession must not hijack hybrid active session');
}
if (!indexHtml.includes('sessionHasStrengthWork(x)&&(x.tasks||[]).some(task=>(task.kind===\'strength\'')) {
  throw new Error('completeSimpleCond must not skip strength on hybrid');
}
if (indexHtml.includes('function minimalUi(')) {
  throw new Error('minimalUi toggle removed');
}
if (/Working maxes[\s\S]{0,320}openStrengthProgress\(\)/.test(indexHtml)) {
  throw new Error('Settings should not duplicate Library Progress button');
}
if (indexHtml.includes('function showBlockHelp(')) {
  throw new Error('showBlockHelp removed — block help is not athlete-facing');
}
if (!indexHtml.includes("S.tab==='library'")) {
  throw new Error('render/go should remap legacy library tab');
}

console.log('coach-audit-fixes: ok');
