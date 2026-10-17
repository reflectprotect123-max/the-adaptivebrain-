/**
 * Coaching loop domain: program grid → assign → log → coach feed.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const dir = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(dir, 'coach-loop.js'), 'utf8');
const html = readFileSync(join(dir, 'coach.html'), 'utf8');
const legacyApp = readFileSync(join(dir, 'fixtures/legacy-athlete.html'), 'utf8');
const whoopBridge = readFileSync(join(dir,'whoop-common.js'),'utf8')+'\n'+readFileSync(join(dir, 'whoop.js'), 'utf8');
const coachColumns = readFileSync(join(dir, 'log-columns.js'), 'utf8');
for (const token of ['readinessScore', 'decisionFromScore', 'athRecoveryGateOverlay'].map((name) => `function ${name}(`)) {
  if (legacyApp.includes(token)) throw new Error(`${token} must be removed`);
}
for (const token of ['readinessColor', 'mainLimiter', 'backgroundLoad', 'recoveryPenalty', 'wearablePenalty', 'biologicalCost']) {
  if (legacyApp.includes(token) || whoopBridge.includes(token)) throw new Error(`${token} must not be written by coach check-ins or WHOOP sync`);
}
for (const token of ['RecoveryPrescription.prescribe(', 'RecoveryEngine.recoveryPosture(']) {
  if (legacyApp.includes(token)) throw new Error(`${token} must not change a coach session`);
}
if (legacyApp.includes('x.summary.e1rm=sessionE1rmList(x)')) {
  throw new Error('session completion must not write a derived e1RM');
}
if (legacyApp.includes('sessionProgressionCard(') || legacyApp.includes('kg next time')) {
  throw new Error('historical progression audits must not render as current coaching');
}
if (!legacyApp.includes('state.meta.progressionAudit=state.meta.progressionAudit||[]')) {
  throw new Error('historical progression audit data must remain stored');
}
if (legacyApp.includes('readiness overview')) throw new Error('accessibility copy still promises readiness advice');
for (const text of ['next session load', 'Best e1RM', 'e1RM trend', 'Est. 1RM', 'rowE1rmHint(', 'e1rmCard(']) {
  if (legacyApp.includes(text)) throw new Error(`coach UI must not advertise ${text}`);
}
for (const text of ['the engine sets load', 'engine picks sets', 'Engine handles volume', 'RIR on last set for progression']) {
  if (coachColumns.includes(text)) throw new Error(`prescription UI must not advertise ${text}`);
}
const volumeOverviewSource = legacyApp.split('\n').find((line) => line.startsWith('function exerciseVolumeMeta('));
if (!volumeOverviewSource) throw new Error('template volume overview missing');
const volumeOverview = vm.runInNewContext(`${volumeOverviewSource}\nexerciseVolumeMeta`, { window: {} });
if (volumeOverview({ autopilotVolume: true }) !== 'Not prescribed') {
  throw new Error('template overview must describe an unset volume target honestly');
}
if (volumeOverview({ autopilotVolume: false, sets: 3, reps: '6-8' }) !== '3 × 6-8') {
  throw new Error('template overview must retain coach-prescribed volume');
}

if (!html.includes('coach-loop.js')) throw new Error('coach.html missing coach-loop.js');
if (!html.includes('coach-nutrition.js')) throw new Error('coach.html missing coach-nutrition.js');
if (!html.includes('Coach Home')) throw new Error('coach.html missing Coach Home');
if (!html.includes('hybrid S&C')) throw new Error('coach.html missing team name');
if (!html.includes('Nutrition')) throw new Error('coach.html missing Nutrition nav (greyed until N*)');
if (!html.includes('coach-shell')) throw new Error('coach.html missing R0 coach-shell layout');
if (!html.includes('--coach-main-bg:#f4f6f8') && !html.includes('--coach-main-bg:#ffffff')) {
  throw new Error('coach.html missing light main pane tokens');
}
if (!html.includes('Manage Assistants')) throw new Error('coach.html missing header actions');
if (!html.includes('My Athletes')) throw new Error('coach.html missing athletes nav label');
if (!html.includes('Analytics')) throw new Error('coach.html missing deferred Analytics nav');
if (/TrainHeroic|Train HYBRD|trainheroic/i.test(html)) {
  throw new Error('coach.html must not use third-party brand/copy');
}
if (!html.includes('Session comment') && !html.includes('Session note')) {
  throw new Error('coach.html missing Session comment');
}
if (!html.includes('prog-days')) throw new Error('coach.html missing R4 program grid');
if (!html.includes('Export bridge file')) throw new Error('coach.html missing bridge export');
if (!html.includes('exercisesCatalogHtml') && !html.includes('Search exercises')) {
  throw new Error('coach.html missing exercises catalog');
}
if (!html.includes('Session comment')) throw new Error('coach.html missing session comment drawer');
if (!html.includes('function gateHtml')) throw new Error('coach.html missing gateHtml');
if (!html.includes('ensureCoachAccount')) throw new Error('coach.html missing ensureCoachAccount');
if (!html.includes('signInWithPassword')) {
  throw new Error('coach.html must use Supabase signInWithPassword for real coach accounts');
}
if (!html.includes('same email + password')) {
  throw new Error('coach.html gate must tell coaches to use athlete account credentials');
}
if (!html.includes('empty-panel')) throw new Error('coach.html missing empty-panel polish pattern');
if (!html.includes('page-intro')) throw new Error('coach.html missing page-intro polish pattern');
if (!html.includes('--ease')) throw new Error('coach.html missing motion token --ease');
if (html.includes('id="athleteShell"') || html.includes('athlete-shell') || html.includes('Athlete ·')) {
  throw new Error('coach.html must not include an athlete login or athlete shell');
}

const sandbox = { console, module: { exports: {} }, globalThis: {}, URLSearchParams };
sandbox.globalThis = sandbox;
vm.runInNewContext(src, sandbox);
const L = sandbox.module.exports || sandbox.CoachLoop;
if (!L) throw new Error('CoachLoop missing');

const store = L.memoryStorage();
let S = L.buildSeed({ startMonday: '2026-08-24' });
L.saveState(store, S);

if (S.athletes.length !== 1) throw new Error('seed should have Dan Veldman only');
if (S.athletes[0].name !== 'Dan Veldman') throw new Error('Dan Veldman must be a test athlete');
if (S.teams[0].name !== 'hybrid S&C') throw new Error('team name');
if (S.programs[0].cells['1-1'] !== L.IDS.tplStrength) throw new Error('week×day cell');

const coach = L.login(S, 'dan@thehybrid.local', 'demo');
if (!coach.ok || coach.account.role !== 'coach') throw new Error('coach login');
L.logout(S);
const athlete = L.login(S, 'veldman@thehybrid.local', 'demo');
if (!athlete.ok || athlete.account.athleteId !== L.IDS.athleteDan) throw new Error('athlete login');

const logged = S.sessions.find((s) => s.id === L.IDS.logged);
if (!logged) throw new Error('seeded logged session missing');
if (logged.status !== 'completed') throw new Error('logged session not completed');
const m = L.feedMetrics(logged);
if (m.blocksDone < 3) throw new Error('expected ≥3 blocks logged, got ' + m.blocksDone);
if (m.volumeKg <= 0) throw new Error('volume should be > 0, got ' + m.volumeKg);
if (m.minutes !== 54) throw new Error('minutes');

const feed = L.groupFeed(S.sessions, S.athletes);
if (!feed.length) throw new Error('feed empty');
if (feed[0].date !== '2026-08-24') throw new Error('feed date');
if (feed[0].cards[0].athlete.name !== 'Dan Veldman') throw new Error('feed athlete');

const today = L.todaySession(S, L.IDS.athleteDan, '2026-08-26');
if (!today) throw new Error('today (Wed) session missing after assign');
if (today.templateId !== L.IDS.tplCond) throw new Error('Wed should be conditioning');

const squatBlock = today.blocks.find((b) => false);
void squatBlock;
const condBlock = today.blocks.find((b) => b.type === 'conditioning');
L.completeBlock(today, condBlock.id, true);
if (!L.blockIsComplete(condBlock)) throw new Error('completeBlock');

const strengthDay = S.sessions.find(
  (s) => s.athleteId === L.IDS.athleteDan && s.date === '2026-08-28' && s.templateId === L.IDS.tplStrength,
);
if (!strengthDay) throw new Error('Dan should have assigned Fri strength session');
const squat = strengthDay.blocks.find((b) => (b.exercises || []).some((e) => e.exerciseId === 'core-back-squat'));
const squatEx = squat.exercises.find((e) => e.exerciseId === 'core-back-squat');
L.logSetArrays(strengthDay, squat.id, squatEx.id, '5,5,4', '100,105,110');
const actual = L.actualLine(squatEx);
if (!actual.includes('5,5,4')) throw new Error('actual reps ' + actual);
if (!actual.includes('100,105,110')) throw new Error('actual load ' + actual);
if (L.prescriptionLine(squatEx).indexOf('3 × 5') < 0) throw new Error('prescription line');
L.completeBlock(strengthDay, squat.id, true);
L.setSessionComment(strengthDay, 'Bar speed looked honest. Keep the last set to 5 next time.', L.IDS.coach);
if (!strengthDay.comment.text.includes('Bar speed')) throw new Error('session comment');

L.swapExercise(strengthDay, squat.id, squatEx.id, { name: 'Goblet Squat', id: 'core-goblet-squat' }, 'No squat rack');
if (squatEx.name !== 'Goblet Squat') throw new Error('swap name');
if (!squatEx.swappedFrom || squatEx.swappedFrom.name !== 'Back Squat') throw new Error('swap from');

const letters = L.letterBlocks(strengthDay.blocks).filter((b) => b.letter);
const superB = letters.find((b) => b.superset);
if (!superB || !String(superB.letter).includes('/')) throw new Error('superset letters ' + (superB && superB.letter));

const prog = L.emptyProgram('Test plan', 1);
L.setProgramCell(prog, 1, 2, L.IDS.tplRecovery);
if (prog.cells['1-2'] !== L.IDS.tplRecovery) throw new Error('set cell');
L.addProgramWeek(prog);
if (prog.weeks !== 2) throw new Error('add week');

S.programs.push(prog);
const before = S.sessions.length;
L.assignProgram(S, {
  programId: prog.id,
  athleteIds: [L.IDS.athleteDan],
  startDate: '2026-08-24',
});
if (S.sessions.length <= before) throw new Error('individual assign created nothing');

const rangeEx = L.makeExercise({ name: 'Row', sets: 3, reps: '10-12', load: '60', metric: 'Weight' });
if (L.targetList(rangeEx).length !== 3) throw new Error('range still 3 sets');
if (L.targetList(rangeEx)[0] !== '10-12') throw new Error('range kept');

if (/TrainHeroic|Train HYBRD/.test(JSON.stringify(S.templates))) {
  throw new Error('seed templates must not include third-party program names');
}

const rawCheckin = { date: '2026-08-26', sleepQuality: 8 };
const whoopWindow = {
  S: { settings: {}, dailyCheckins: [rawCheckin] },
  today: () => '2026-08-26',
  dailyCheckin: () => rawCheckin,
  touchRecord: () => {},
  save: () => {},
  localStorage: {},
  location: { hostname: 'localhost', protocol: 'http:' },
  supabase: { createClient: () => ({ auth: { getSession: async () => ({ data: { session: { access_token: 'test', user: { email: 'test@example.com' } } } }) } }) },
};
vm.runInNewContext(whoopBridge, {
  window: whoopWindow,
  URLSearchParams,
  fetch: async () => ({ ok: true, json: async () => ({ whoop: {
    connected: true,
    lastSyncAt: '2026-08-26T12:00:00Z',
    normalized: { date: '2026-08-26', recoveryScore: 72, hrvMs: 58, restingHr: 51, sleepPerformance: 84, strain: 12.5 },
  } }) }),
});
await whoopWindow.Whoop.refreshStatus();
for (const [key, value] of Object.entries({ whoopRecovery: 72, hrv: 58, restingHr: 51, whoopSleepPerformance: 84, whoopStrain: 12.5, sleepQuality: 8 })) {
  if (rawCheckin[key] !== value) throw new Error(`WHOOP raw sync changed ${key}: ${rawCheckin[key]}`);
}
if (!rawCheckin.whoopSyncedAt || rawCheckin.whoopSampleDate !== '2026-08-26') throw new Error('WHOOP sample timestamps missing');
for (const key of ['readinessColor', 'mainLimiter', 'backgroundLoad', 'recoveryPenalty', 'wearablePenalty']) {
  if (key in rawCheckin) throw new Error(`WHOOP sync wrote ${key}`);
}
const metricsSource = legacyApp.slice(legacyApp.indexOf('function athObservedNumber('), legacyApp.indexOf('function athRingsSvg('));
if (!metricsSource.startsWith('function athObservedNumber(')) throw new Error('coach raw metrics helper missing');
let metricsCheckin = {};
const metricsSandbox = { dailyCheckin: () => metricsCheckin, today: () => '2026-08-26', athClamp: (n, lo, hi) => Math.min(hi, Math.max(lo, n)) };
vm.runInNewContext(metricsSource, metricsSandbox);
if (Object.values(metricsSandbox.athHomeMetrics()).some((value) => value !== null)) throw new Error('missing WHOOP observations must remain missing');
metricsCheckin = rawCheckin;
for (const [key, value] of Object.entries({ recovery: 72, hrv: 58, rhr: 51, sleep: 84, strain: 12.5 })) {
  if (metricsSandbox.athHomeMetrics()[key] !== value) throw new Error(`coach displayed ${key} incorrectly`);
}
const overviewSource = legacyApp.slice(legacyApp.indexOf('function athSleepOverviewBody('), legacyApp.indexOf('function setIllnessFlag('));
if (!overviewSource.startsWith('function athSleepOverviewBody(')) throw new Error('WHOOP overview helper missing');
let overviewRecovery = null;
const overviewSandbox = {
  athHomeMetrics: () => ({ recovery: overviewRecovery, hrv: null, rhr: null, sleep: null, strain: null }),
  athMetric: (value, suffix = '') => value == null ? '—' : `${value}${suffix}`,
  athClamp: (n, lo, hi) => Math.min(hi, Math.max(lo, n)),
  window: {},
};
vm.runInNewContext(overviewSource, overviewSandbox);
if (overviewSandbox.athSleepOverviewBody().includes('class=ath-bthumb')) throw new Error('missing recovery must not show a positioned thumb');
overviewRecovery = 72;
if (!overviewSandbox.athSleepOverviewBody().includes('class=ath-bthumb')) throw new Error('observed recovery should show its thumb');

console.log('coach-loop: ok', {
  feedCards: feed[0].cards.length,
  volumeKg: m.volumeKg,
  blocks: m.blocksDone + '/' + m.blocksTotal,
  assigned: S.sessions.length,
});
