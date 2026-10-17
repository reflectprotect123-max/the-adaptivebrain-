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
const warm = sandbox.COACH_EXERCISE_CATALOG.filter((e) => e.category === 'Warm-Up');
const cool = sandbox.COACH_EXERCISE_CATALOG.filter((e) => e.category === 'Cool-Down');
must(warm.length === 115, 'warm-up starter library is 115, got ' + warm.length);
must(cool.length === 58, 'cool-down starter library is 58, got ' + cool.length);
must(warm.some((e) => e.name === 'Band Pull Apart' && e.unit === 'reps'), 'Band Pull Apart stays in warm-up');
must(cool.some((e) => e.name === 'Couch Stretch' && e.perSide === 'Yes'), 'Couch Stretch stays in cool-down');
must(warm.some((e) => e.name === 'Horse Stance Pulse') && cool.some((e) => e.name === 'Horse Stance Pulse'), 'shared names stay in both catalogs');
must(warm.find((e) => e.name === 'Lateral Banded Walk').review.includes('Metres vs steps'), 'unit conflict stays visible');
must(sandbox.COACH_EXERCISE_CATALOG.filter((e) => e.source === 'THE-core-120').length === 120, 'main library stays 120');
const merged = sandbox.CoachLoop.mergeExerciseCatalog({ exercises: [], meta: {} });
must(merged.exercises.length >= 100, 'mergeExerciseCatalog fills exercises');
must(merged.exercises.some((e) => e.name === 'Couch Stretch' && e.category === 'Cool-Down' && e.typical), 'merge keeps cool-down prescription');
must(sandbox.ExerciseSearch.search('deadlift', 5).length > 0, 'deadlift search works');
const horse = sandbox.ExerciseSearch.search('Horse Stance Pulse', 5);
must(horse.filter((h) => h.name === 'Horse Stance Pulse').length === 2, 'search returns both sections for a shared name');
must(html.includes('setExCatalogSection'), 'catalog tabs call setExCatalogSection');
must(!html.includes('onclick="ui.exCatalogSection='), 'catalog tab click is not broken by nested quotes');
must(html.includes('id="exPickerSearch"'), 'exercise picker search keeps an id so typing can stay focused');
must(html.includes('restoreTypingFocus'), 'render restores the search caret');

console.log('coach-library.smoke: ok');
