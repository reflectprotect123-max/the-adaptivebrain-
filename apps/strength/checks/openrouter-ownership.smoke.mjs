/**
 * OpenRouter ownership — athlete deploy is PROXY-ONLY for brain-coach.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BRAIN_OWNER_HOST } from '../../../scripts/brain-owner-site.mjs';

const dir = dirname(fileURLToPath(import.meta.url));
const fnDir = join(dir, '..', 'netlify/functions');

const failures = [];
function must(cond, msg) {
  if (!cond) failures.push(msg);
}

const coach = join(fnDir, 'brain-coach.mjs');
must(existsSync(coach), 'missing brain-coach.mjs');
const coachSrc = readFileSync(coach, 'utf8');
must(coachSrc.includes('proxyHybrid'), 'brain-coach must proxy to Brain owner site');
must(!coachSrc.includes('OPENROUTER_API_KEY'), 'brain-coach must not read OPENROUTER on athlete site');

const proxy = readFileSync(join(fnDir, '_hybrid-proxy.mjs'), 'utf8');
must(proxy.includes(BRAIN_OWNER_HOST), '_hybrid-proxy must forward to Brain owner site');

const ownerCoach = join(dir, '..', '..', '..', 'scripts/brain-owner-coach/netlify/functions/brain-coach.mjs');
must(existsSync(ownerCoach), 'missing scripts/brain-owner-coach/netlify/functions/brain-coach.mjs');
must(readFileSync(ownerCoach, 'utf8').includes('OPENROUTER_API_KEY'), 'Brain owner brain-coach must use OPENROUTER_API_KEY');

if (failures.length) {
  console.error('openrouter-ownership.smoke: FAIL');
  for (const f of failures) console.error(' -', f);
  process.exit(1);
}
console.log('openrouter-ownership.smoke: ok');
