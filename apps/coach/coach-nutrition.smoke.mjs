/**
 * Coach nutrition domain — targets, meals, athlete payload (N* last).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const dir = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(dir, 'coach.html'), 'utf8');
const src = readFileSync(join(dir, 'coach-nutrition.js'), 'utf8');
const loopSrc = readFileSync(join(dir, 'coach-loop.js'), 'utf8');

if (!html.includes('coach-nutrition.js')) throw new Error('coach.html missing coach-nutrition.js');
if (!html.includes('Nutrition')) throw new Error('coach.html missing Nutrition nav');
if (!loopSrc.includes('targetsByAthlete')) throw new Error('coach-loop seed missing nutrition slice');

const sandbox = { console, module: { exports: {} }, globalThis: {} };
sandbox.globalThis = sandbox;
vm.runInNewContext(src, sandbox);
const N = sandbox.module.exports || sandbox.CoachNutrition;
if (!N) throw new Error('CoachNutrition missing');

const state = { nutrition: N.emptyNutritionState() };
N.ensureNutrition(state);

const targets = N.setCoachOverride(state.nutrition, 'ath-dan', {
  calories: 2800,
  proteinG: 180,
  carbsG: 300,
  fatG: 80,
}, 'Cut start');
if (!targets.override || targets.source !== 'coach_override') throw new Error('override');

const resolved = N.resolveActiveTargets(targets, {
  athleteId: 'ath-dan',
  calories: 2600,
  proteinG: 170,
  carbsG: 280,
  fatG: 75,
});
if (resolved.reason !== 'coach_override') throw new Error('override must win');

N.clearCoachOverride(state.nutrition, 'ath-dan');
const afterClear = N.resolveActiveTargets(state.nutrition.targetsByAthlete['ath-dan'], {
  athleteId: 'ath-dan',
  calories: 2600,
  proteinG: 170,
  carbsG: 280,
  fatG: 75,
});
if (afterClear.reason !== 'engine_proposal') throw new Error('engine after clear');

const day = N.makeMealDay({
  athleteId: 'ath-dan',
  date: '2026-08-27',
  meals: [
    N.makeMeal({
      title: 'Lunch',
      items: [N.makeMealItem({ name: 'Chicken', grams: 150, calories: 250 })],
    }),
  ],
});
N.publishMealDay(day);
N.upsertMealDay(state.nutrition, day);
N.markMealDone(day, day.meals[0].id);
if (day.meals[0].status !== 'done') throw new Error('green check');

const payload = N.athleteNutritionPayload(state.nutrition, 'ath-dan', '2026-08-27');
if (!payload.mealDay || !payload.mealDay.published) throw new Error('payload meal day');
if (payload.version !== 1) throw new Error('payload version');

console.log('coach-nutrition: ok', {
  reason: afterClear.reason,
  mealStatus: day.meals[0].status,
});
