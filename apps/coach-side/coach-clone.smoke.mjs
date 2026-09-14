/**
 * Visual clone contract vs docs/trainheroic-coach-spec/screenshots (224 frames).
 * Hybrid labels only — no third-party brand strings.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(dir, 'coach.html'), 'utf8');
const views = readFileSync(join(dir, 'coach-views.js'), 'utf8');
const src = html + '\n' + views;

function must(cond, msg) {
  if (!cond) throw new Error(msg);
}

must(!/TrainHeroic|Train HYBRD|trainheroic/i.test(src), 'clone must not use third-party brand/copy');
must(src.includes('Coach Home'), 'Coach Home label');
must(src.includes('My Athletes'), 'My Athletes');
must(src.includes('Analytics'), 'Analytics chrome');
must(src.includes('Nutrition'), 'Nutrition remains in chrome');

must(src.includes('--coach-main-bg:#f4f6f8') || src.includes('--coach-main-bg:#ffffff'), 'light content pane like reference shots');
must(src.includes('coach-rail-slim') || src.includes('--coach-rail-width:64px'), 'slim icon rail');
must(src.includes('#0057ff') || src.includes('#2563eb') || src.includes('#1d4ed8'), 'saturated primary CTA like reference');
must(src.includes('data-table') || src.includes('th-table'), 'data-table list pattern');
must(src.includes('Circuits'), 'Library Circuits tab');
must(src.includes('Prescriptions'), 'Library Prescriptions tab');
must(src.includes('GROUP') || src.includes('All Athletes ('), 'Athletes GROUP filter');
must(src.includes('STATUS'), 'Athletes STATUS filter');
must(src.includes('Invite Athletes'), 'Invite Athletes toolbar');
must(src.includes('Create Team') || src.includes('Create team'), 'Create Team');
must(src.includes('0/75') || src.includes('team-create-dialog'), 'Create Team dialog (not window.prompt)');
must(src.includes('UNPUBLISHED') || src.includes('Unpublished'), 'unpublished calendar chip');
must(src.includes('Welcome back'), 'Home welcome header');
must(src.includes('session-comment-bar') || src.includes('Session Comment'), 'full-width session comment CTA');
must(src.includes('Needs Programming') || src.includes('Needs programming'), 'right rail');
must(src.includes('Expand all'), 'Expand all cards');
must(src.includes('Rows per page') || src.includes('rows-per-page'), 'table pagination footer');

console.log('coach-clone: ok');
