/**
 * Smoke: catalogue rows match the live PR 273 columns, and they are not 1RM keys.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

function must(cond, msg) {
  if (!cond) throw new Error(msg);
}

const dir = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(dir, 'coach-catalogue.js'), 'utf8');
const html = readFileSync(join(dir, 'coach.html'), 'utf8');
const sandbox = { console, globalThis: {} };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
const C = sandbox.CoachCatalogue;

must(C.isCatalogueId('exercise_6ec38a5f580f95a0'), 'canonical id shape');
must(!C.isCatalogueId('core-back-squat'), 'logger ids are not catalogue ids');

const labels = C.labelsFromSources([{
  catalogue: 'main',
  taxonomy: { categories: [{ id: 'horizontal_push', label: 'Horizontal push' }] },
}]);
const row = C.rowToCatalog({
  canonical_exercise_id: 'exercise_6ec38a5f580f95a0',
  catalogue: 'main',
  canonical_title: '1 1/2 Bench Press',
  aliases: ['1- 1/2 bench press'],
  movement_category: 'horizontal_push',
  movement_subcategory: 'press_push_up',
  secondary_categories: [],
  tags: ['family:bench_press'],
  in_custom_library: true,
}, labels);
must(row.name === '1 1/2 Bench Press' && row.category === 'Horizontal push', 'title and category label');
must(row.catalogue === 'main' && row.custom === true, 'catalogue and custom flag');
must(row.source === 'supabase-exercise-catalogue', 'source stays the supabase catalogue');

const state = { exercises: [{ id: 'core-back-squat', name: 'Back Squat', source: 'THE-core-120' }] };
const applied = C.apply(state, [row]);
must(applied.changed && applied.count === 1, 'new catalogue row is added');
must(state.exercises[0].id === 'core-back-squat', 'core logger id stays');
must(state.exercises.some((e) => e.id === row.id), 'catalogue id is stored separately');
const again = C.apply(state, [row]);
must(!again.changed, 'the same catalogue row is a no-op');

const calls = [];
const fake = {
  auth: { getSession: async () => ({ data: { session: { user: { id: 'u' } } } }) },
  from(table) {
    return {
      select() {
        return {
          range(from, to) {
            calls.push(table);
            if (table === 'exercise_catalogue_sources') {
              return Promise.resolve({ data: [{ catalogue: 'main', schema_version: 2, exercise_count: 1, taxonomy: { categories: [{ id: 'hinge', label: 'Hinge' }] } }] });
            }
            return Promise.resolve({
              data: [{
                canonical_exercise_id: 'exercise_aaaaaaaaaaaaaaaa',
                catalogue: 'main',
                canonical_title: 'Romanian Deadlift',
                aliases: [],
                movement_category: 'hinge',
                movement_subcategory: 'hip_hinge',
                secondary_categories: [],
                tags: [],
                in_custom_library: false,
              }],
            });
          },
        };
      },
    };
  },
};
const pulled = await C.refresh({ exercises: [] }, fake);
must(pulled.ok && pulled.count === 1 && pulled.changed, 'signed-in read applies one row');
must(calls.includes('exercise_catalogue_sources') && calls.includes('exercise_catalogue'), 'reads both PR 273 tables');

must(html.includes('./coach-catalogue.js'), 'coach loads the catalogue reader');
must(html.includes('CoachCatalogue.refresh'), 'signed-in boot refreshes the catalogue');

console.log('coach-catalogue.smoke: ok');
