/** The retired coach intent parser must not make automatic session decisions. */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(dir, 'fixtures/legacy-athlete.html'), 'utf8');

if (existsSync(join(dir, 'coach-ai.js'))) throw new Error('retired coach intent parser still ships');
for (const token of ['coach-ai.js', 'CoachAI.', 'llmRecoveryGate', 'enrichSessionWithCoachIntent']) {
  if (html.includes(token)) throw new Error(`coach session still invokes ${token}`);
}

console.log('coach-ai retirement: ok');
