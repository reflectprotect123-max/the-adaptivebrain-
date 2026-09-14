/**
 * Smoke: coach session builder uses 120-library exercise search.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

function must(cond, msg) {
  if (!cond) throw new Error(msg);
}

const dir = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(dir, 'coach.html'), 'utf8');
const loop = readFileSync(join(dir, 'coach-loop.js'), 'utf8');
const catalog = readFileSync(join(dir, 'coach-exercise-catalog.js'), 'utf8');
const search = readFileSync(join(dir, 'exercise-search.js'), 'utf8');
const index = readFileSync(join(dir, 'exercise-search-index.js'), 'utf8');

must(html.includes('./exercise-search-index.js'), 'coach.html loads exercise-search-index.js');
must(html.includes('./exercise-search.js'), 'coach.html loads exercise-search.js');
must(html.includes('./coach-exercise-catalog.js'), 'coach.html loads coach-exercise-catalog.js');
must(html.includes('coachExerciseSuggestHits'), 'coach variant search helper present');
must(html.includes('pickExerciseVariant'), 'coach variant pick handler present');
must(html.includes('mergeExerciseCatalog'), 'coach boot merges catalog');
must(!/trainheroic|TrainHeroic|TRAINHEROIC/i.test(html), 'coach.html has no TrainHeroic strings');
must(loop.includes('mergeExerciseCatalog'), 'coach-loop exports catalog merge');

const sandbox = { window: {}, console, globalThis: {} };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(`${index}\n${search}\n${catalog}\n${loop}`, sandbox);

must(Array.isArray(sandbox.COACH_EXERCISE_CATALOG), 'catalog array present');
must(sandbox.COACH_EXERCISE_CATALOG.length >= 100, 'catalog has 120-library entries');
const merged = sandbox.CoachLoop.mergeExerciseCatalog({ exercises: [], meta: {} });
must(merged.exercises.length >= 100, 'mergeExerciseCatalog fills exercises');
must(sandbox.ExerciseSearch.search('deadlift', 5).length > 0, 'deadlift search works');

console.log('coach-library.smoke: ok');
