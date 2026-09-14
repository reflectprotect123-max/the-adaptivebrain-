/**
 * Coach bridge — publish payload + athlete merge shape.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const dir = dirname(fileURLToPath(import.meta.url));
const bridgeSrc = readFileSync(join(dir, 'coach-bridge.js'), 'utf8');
const syncSrc = readFileSync(join(dir, 'coach-sync.js'), 'utf8');
const loopSrc = readFileSync(join(dir, 'coach-loop.js'), 'utf8');
const html = readFileSync(join(dir, 'coach.html'), 'utf8');
const indexHtml = readFileSync(join(dir, 'index.html'), 'utf8');

for (const needle of ['coach-bridge.js', 'coach-views.js', 'CoachViews.init']) {
  if (!html.includes(needle)) throw new Error(`coach.html missing ${needle}`);
}
if (indexHtml.includes('pullCoachBridge')) throw new Error('pullCoachBridge manual pull removed — use auto sync');
if (indexHtml.includes('Check for updates')) throw new Error('Check for updates removed — coach auto-sync');
if (indexHtml.includes('Minimal screen')) throw new Error('Minimal screen toggle removed');
if (indexHtml.includes('importCoachBridge')) throw new Error('importCoachBridge should not be exposed in athlete settings');
if (indexHtml.includes('Import coach file')) throw new Error('Import coach file should not be in athlete settings');
if (!syncSrc.includes('importPayload')) throw new Error('coach-sync.js missing importPayload');

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
vm.runInNewContext(loopSrc, sandbox);
sandbox.CoachLoop = sandbox.module.exports;
sandbox.module = { exports: {} };
vm.runInNewContext(
  readFileSync(join(dir, 'coach-nutrition.js'), 'utf8'),
  sandbox,
);
sandbox.CoachNutrition = sandbox.module.exports;
vm.runInNewContext(bridgeSrc, sandbox);
const Bridge = sandbox.CoachBridge;
vm.runInNewContext(syncSrc, sandbox);
const Sync = sandbox.CoachSync;

const L = sandbox.CoachLoop;
let S = L.buildSeed({ startMonday: '2026-08-24' });
const ses = S.sessions.find((s) => s.athleteId === L.IDS.athleteDan);
if (!ses) throw new Error('seed session missing');
L.publishSession(ses);
const push = Bridge.push(S, localStorage);
if (!push.ok) throw new Error('bridge push failed: ' + push.error);
const payload = Bridge.read(localStorage);
if (!payload.athletes.length) throw new Error('bridge athletes empty');
const bucket = payload.athletes.find((a) => a.email === 'veldman@thehybrid.local');
if (!bucket || !bucket.sessions.length) throw new Error('bridge sessions for Dan');

const athleteState = { sessions: [], templates: [] };
const pull = Sync.pull(athleteState, { email: 'veldman@thehybrid.local' });
if (!pull.ok || !pull.merged) throw new Error('coach sync pull: ' + JSON.stringify(pull));
if (!athleteState.sessions.some((s) => s.source === 'coach-bridge')) {
  throw new Error('merged session missing coach-bridge source');
}

console.log('coach-bridge: ok', { pushed: push.count, merged: pull.merged });
