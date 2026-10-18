/**
 * Smoke: lift memory uses the brain e1RM, and warm-up does not write it.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { estimateE1rmKg } from '../../packages/brain/src/load.js';

function must(cond, msg) {
  if (!cond) throw new Error(msg);
}

const dir = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(dir, 'coach-lifts.js'), 'utf8');
const html = readFileSync(join(dir, 'coach.html'), 'utf8');
const sql = readFileSync(join(dir, '../../supabase/migrations/20261017220000_coach_lift_memory.sql'), 'utf8');
const sandbox = { console, globalThis: {} };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
const L = sandbox.CoachLifts;

must(L.estimateE1rmKg(100, 5) === estimateE1rmKg({ loadKg: 100, reps: 5 }), 'e1RM matches the brain');
must(L.estimateE1rmKg(100, 5) === 116.7, '100 kg x 5 is 116.7');
must(L.estimateE1rmKg(105, 5) === 122.5, '105 kg x 5 is 122.5');

let memory = {};
memory = L.remember(memory, { athleteId: 'ath', name: 'Back Squat', loadKg: 100, reps: 5, effort: 'medium' });
memory = L.remember(memory, { athleteId: 'ath', name: 'Back Squat', loadKg: 105, reps: 5, effort: 'medium' });
const squat = L.read(memory, 'ath', 'back squat');
must(squat.lastKg === 105, 'LAST is the last working load');
must(squat.e1rmKg === 122.5, 'working max rose to 122.5');
must(squat.source === 'auto_estimate', 'source is the estimate');

const beforeMiss = squat.e1rmKg;
memory = L.remember(memory, { athleteId: 'ath', name: 'Back Squat', loadKg: 140, reps: 1, effort: 'hard', miss: true });
const missed = L.read(memory, 'ath', 'Back Squat');
must(missed.lastKg === 140, 'a miss still stores LAST');
must(missed.e1rmKg === beforeMiss, 'a miss does not raise e1RM');
must(missed.lastMiss === true, 'miss flag stored');

const prep = L.remember(memory, { athleteId: 'ath', name: 'Bike', loadKg: 999, reps: 1, role: 'warmup' });
must(prep === memory, 'warm-up does not write memory');
must(!L.read(memory, 'ath', 'Bike'), 'warm-up lift is absent');
const cool = L.remember(memory, { athleteId: 'ath', name: 'Couch Stretch', loadKg: 40, reps: 10, section: 'Cool-Down' });
must(cool === memory, 'cool-down does not write memory');

memory = L.setWorkingMax(memory, { athleteId: 'ath', name: 'Back Squat', e1rmKg: 130 });
const set = L.read(memory, 'ath', 'Back Squat');
must(set.e1rmKg === 130 && set.lastKg === 140 && set.source === 'coach_set', 'coach working max replaces e1RM and keeps LAST');

const seeded = L.ensureFromSessions({
  sessions: [{
    athleteId: 'ath',
    blocks: [{
      category: 'Strength/Power',
      exercises: [{
        name: 'Bench Press',
        exerciseId: 'core-bench-press',
        rows: [
          { done: true, weight: '80', reps: '8' },
          { done: true, weight: '70', reps: '6' },
        ],
      }],
    }, {
      role: 'warmup',
      category: 'Warm-Up',
      exercises: [{ name: 'Bike', rows: [{ done: true, weight: '50', reps: '1' }] }],
    }],
  }],
});
const bench = L.read(seeded.liftMemory, 'ath', 'Bench Press');
must(bench.e1rmKg === estimateE1rmKg({ loadKg: 80, reps: 8 }), 'seed uses the heavier estimate');
must(bench.lastKg === 70, 'seed LAST is the last set');
must(!L.read(seeded.liftMemory, 'ath', 'Bike'), 'seed skips warm-up');

must(html.includes('./coach-lifts.js'), 'coach loads lift memory');
must(html.includes('id="lift-memory"') || readFileSync(join(dir, 'coach-views.js'), 'utf8').includes('id="lift-memory"'), 'athlete page shows working max');
must(sql.includes('estimate_e1rm_kg'), 'sql estimates e1RM');
must(sql.includes('enable row level security'), 'lift memory enables RLS');
must(sql.includes('revoke all on public.coach_lift_memory from anon, authenticated'), 'anon has no table grant');
must(sql.includes('security invoker'), 'RPCs stay invoker');
must(!/grant\s+execute[\s\S]{0,80}to\s+anon/i.test(sql), 'anon cannot execute the RPCs');
must(!/alter table public\.exercise_catalogue/i.test(sql), 'catalogue DDL stays in strengthside PR 273');
must(!sql.includes('exercise_catalogue_read'), 'this migration does not replace the catalogue read policy');

console.log('coach-lifts.smoke: ok');
