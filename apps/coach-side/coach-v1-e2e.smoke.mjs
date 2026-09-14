/**
 * End-to-end coach V1 flow — assign → publish → bridge → athlete pull.
 * Run: node apps/coach/coach-v1-e2e.smoke.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const dir = dirname(fileURLToPath(import.meta.url));

function load(path) {
  return readFileSync(join(dir, path), 'utf8');
}

const store = {};
const localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => {
    store[k] = String(v);
  },
  removeItem: (k) => {
    delete store[k];
  },
};

const sandbox = { console, module: { exports: {} }, localStorage, globalThis: {}, window: {} };
sandbox.globalThis = sandbox;
sandbox.window = sandbox;

for (const file of ['coach-loop.js', 'coach-nutrition.js', 'coach-bridge.js', 'coach-sync.js']) {
  vm.runInNewContext(load(file), sandbox);
  if (file === 'coach-loop.js') sandbox.CoachLoop = sandbox.module.exports;
  if (file === 'coach-nutrition.js') sandbox.CoachNutrition = sandbox.module.exports;
  if (file === 'coach-bridge.js') sandbox.CoachBridge = sandbox.module.exports;
  sandbox.module = { exports: {} };
}
sandbox.CoachSync = sandbox.CoachSync || sandbox.module.exports;

const L = sandbox.CoachLoop;
const Bridge = sandbox.CoachBridge;
const Sync = sandbox.CoachSync;
const N = sandbox.CoachNutrition;

let coach = L.buildSeed({ startMonday: '2026-08-24' });
const program = coach.programs[0];
const team = coach.teams[0];

// Fresh assign to a new week
L.assignProgram(coach, {
  programId: program.id,
  teamId: team.id,
  startDate: '2026-09-01',
});
const unpublished = coach.sessions.filter((s) => !s.published);
if (!unpublished.length) throw new Error('expected unpublished assigned sessions');

L.publishAllSessions(unpublished);
const push = Bridge.push(coach, localStorage);
if (!push.ok) throw new Error('push failed');

const athlete = { sessions: [], templates: [], meta: {} };
const pull = Sync.pull(athlete, { email: 'veldman@thehybrid.local' });
if (!pull.ok || pull.merged < 1) throw new Error('pull failed');

N.setCoachOverride(N.ensureNutrition(coach), L.IDS.athleteDan, {
  calories: 2900,
  proteinG: 190,
  carbsG: 310,
  fatG: 85,
});
const day = N.makeMealDay({
  athleteId: L.IDS.athleteDan,
  date: L.today(),
  meals: [N.makeMeal({ title: 'Post-lift', items: [N.makeMealItem({ name: 'Chicken · 200g' })] })],
});
N.publishMealDay(day);
N.upsertMealDay(N.ensureNutrition(coach), day);
Bridge.push(coach, localStorage);

const nutRaw = localStorage.getItem('THE-coach-bridge-v1');
if (!nutRaw || !nutRaw.includes('Post-lift')) throw new Error('nutrition not in bridge');

console.log('coach-v1-e2e: ok', {
  assigned: coach.sessions.length,
  published: coach.sessions.filter((s) => s.published).length,
  athleteMerged: pull.merged,
  athleteSessions: athlete.sessions.length,
  bridgeBytes: nutRaw.length,
});
