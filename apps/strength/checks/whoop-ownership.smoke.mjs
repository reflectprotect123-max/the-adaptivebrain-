/**
 * WHOOP ownership — brain-app deploy is proxy-only → hybrid1.
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const appRoot = join(dir, '..');
const fnDir = join(appRoot, 'netlify/functions');
const OWNER_HOST = 'thehybridengine1.netlify.app';
const ATHLETE_HOST = 'thehybridsystem.netlify.app';

const failures = [];
function must(cond, msg) {
  if (!cond) failures.push(msg);
}

const BANNED = ['whoop-callback.mjs', 'whoop-webhook.mjs', '_lib/whoop.mjs', '@netlify/blobs'];
const PROXY = [
  'whoop-connect.mjs',
  'whoop-sync.mjs',
  'concept2-connect.mjs',
  'concept2-sync.mjs',
  'concept2-callback.mjs',
  'integrations-status.mjs',
  'integrations-disconnect.mjs',
  'brain-coach.mjs',
];

must(existsSync(join(fnDir, '_hybrid-proxy.mjs')), 'missing _hybrid-proxy.mjs');
const proxySrc = readFileSync(join(fnDir, '_hybrid-proxy.mjs'), 'utf8');
must(proxySrc.includes(OWNER_HOST), 'proxy must target hybrid1');

for (const name of PROXY) {
  const p = join(fnDir, name);
  must(existsSync(p), `missing ${name}`);
  if (name === 'brain-coach.mjs') continue;
  const src = readFileSync(p, 'utf8');
  must(src.includes('proxyHybrid'), `${name} must call proxyHybrid`);
}

for (const banned of BANNED) {
  if (banned.startsWith('@')) continue;
  must(!existsSync(join(fnDir, banned)), `banned ${banned}`);
}

const whoopJs = readFileSync(join(appRoot, 'connectors/whoop.js'), 'utf8');
must(whoopJs.includes('client: \'native\'') || whoopJs.includes('client: "native"'), 'whoop native connect');
must(whoopJs.includes(ATHLETE_HOST), 'whoop knows athlete host');

if (failures.length) {
  console.error('brain whoop-ownership FAIL');
  failures.forEach((f) => console.error(' -', f));
  process.exit(1);
}
console.log('brain whoop-ownership: ok');
