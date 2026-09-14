/**
 * Coach cloud publish module + migration presence.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const dir = dirname(fileURLToPath(import.meta.url));
const root = join(dir, '../..');
const mig = join(root, 'supabase/migrations/20260827_coach_publish_assigned_session.sql');
if (!existsSync(mig)) throw new Error('missing coach publish migration');
const sql = readFileSync(mig, 'utf8');
for (const needle of [
  'assigned_session_coach_insert',
  'coaches_athlete_anywhere',
  'unpublished',
  'coach_session_key',
]) {
  if (!sql.includes(needle)) throw new Error(`migration missing ${needle}`);
}

const html = readFileSync(join(dir, 'coach.html'), 'utf8');
if (!html.includes('coach-cloud.js')) throw new Error('coach.html missing coach-cloud.js');
if (!html.includes('Push cloud now')) throw new Error('coach.html missing Push cloud now');
if (!html.includes('bindMyCloudIdToAthlete')) throw new Error('coach.html missing cloud link');
if (!html.includes('Open athlete app')) throw new Error('coach.html missing athlete app link');
if (html.includes('rx-delivery-strip')) throw new Error('coach.html must not show persistent delivery strip banner');

const indexHtml = readFileSync(join(dir, 'index.html'), 'utf8');
if (!indexHtml.includes('coach-cloud.js')) throw new Error('index.html missing coach-cloud.js');
if (!indexHtml.includes('Coach prescriptions')) throw new Error('index.html missing coach prescriptions card');
if (!indexHtml.includes('isCoachPrescription')) throw new Error('index.html missing isCoachPrescription');

const src = readFileSync(join(dir, 'coach-cloud.js'), 'utf8');
const sandbox = { console, module: { exports: {} }, globalThis: {}, Whoop: null };
sandbox.globalThis = sandbox;
vm.runInNewContext(src, sandbox);
const Cloud = sandbox.CoachCloud || sandbox.module.exports;
if (!Cloud.pushPublished || !Cloud.pullForAthlete) throw new Error('CoachCloud API incomplete');
if (!Cloud.markCompleted || !Cloud.deliverySummary || !Cloud.refreshPublishedStates) {
  throw new Error('CoachCloud portal API incomplete');
}
if (!Cloud.athleteCloudId({ cloudUserId: 'abc' })) throw new Error('athleteCloudId');
if (Cloud.athleteCloudId({})) throw new Error('athleteCloudId empty');

console.log('coach-cloud: ok');
