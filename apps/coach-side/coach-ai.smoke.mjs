/**
 * Smoke: coach intent LLM client validation (no network).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const dir = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(dir, 'coach-ai.js'), 'utf8');
const html = readFileSync(join(dir, 'index.html'), 'utf8');

if (!html.includes('coach-ai.js')) throw new Error('index.html missing coach-ai.js');
if (!html.includes('function coachControlsStrength(){return false}')) throw new Error('coachControlsStrength should stay off');
if (html.includes('settings.llmCoachIntent=this.checked')) throw new Error('llmCoachIntent should not be a settings toggle');
if (html.includes('settings.llmProgression=this.checked')) throw new Error('llmProgression should not be a settings toggle');

const sandbox = { window: {}, console, fetch: () => Promise.reject(new Error('no network')) };
sandbox.esc = (s) => String(s);
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(src, sandbox);

const intent = sandbox.CoachAI.validateCoachIntent({
  recovery_gate: 'caution',
  cond_effort: 'easy',
  flags: ['pain'],
  athlete_cue: 'Stay smooth — no grinders today.',
  confidence: 0.82,
  reason_codes: ['coach_said_easy_day'],
});
if (!intent || intent.recoveryGate !== 'caution') throw new Error('recovery gate parse failed');
if (intent.condEffort !== 'easy') throw new Error('effort parse failed');
if (!intent.flags.includes('pain')) throw new Error('flags parse failed');
if (!intent.athleteCue) throw new Error('athlete cue missing');

const bad = sandbox.CoachAI.validateCoachIntent({ confidence: 0.5 });
if (bad !== null) throw new Error('empty intent should fail validation');

const session = { coachInstructions: 'Easy day — legs sore from travel.', name: 'Lower A', blocks: [] };
const payload = sandbox.CoachAI.buildIntentPayload(session);
if (!payload.coach_instructions.includes('sore')) throw new Error('payload build failed');

sandbox.CoachAI.applyCoachIntentToSession(
  { tasks: [{ kind: 'conditioning', effort: 'medium', notes: '' }], sessionPain: null },
  intent,
);
const t = { tasks: [{ kind: 'conditioning', effort: 'medium', notes: '' }] };
sandbox.CoachAI.applyCoachIntentToSession(t, intent);
if (t.tasks[0].effort !== 'easy') throw new Error('cond effort not applied');
if (t.sessionPain !== 'yes') throw new Error('pain flag should set sessionPain');

const cueHtml = sandbox.CoachAI.athleteCueHtml({
  llmIntent: { athleteCue: 'Smooth reps — no grinders.' },
});
if (!cueHtml.includes('Smooth reps')) throw new Error('athleteCueHtml failed');
if (sandbox.CoachAI.athleteCueForSession(null)) throw new Error('empty session cue should be blank');

if (!sandbox.CoachAI.llmEnabled({ settings: {} })) throw new Error('coach intent AI should be on by default');

console.log('coach-ai.smoke: ok');
