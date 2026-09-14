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

const sandbox = { console, module: { exports: {} }, globalThis: {} };
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

console.log('coach-loop: ok', {
  feedCards: feed[0].cards.length,
  volumeKg: m.volumeKg,
  blocks: m.blocksDone + '/' + m.blocksTotal,
  assigned: S.sessions.length,
});
