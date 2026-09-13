/**
 * WHOOP ownership — TRACK talks to shared Supabase Edge (not Netlify).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
function must(cond, msg) {
  if (!cond) failures.push(msg);
}

const whoopJs = readFileSync(join(appRoot, 'connectors/whoop.js'), 'utf8');
const cfg = readFileSync(join(appRoot, 'strength-config.js'), 'utf8');
const html = readFileSync(join(appRoot, 'index.html'), 'utf8');
const app = readFileSync(join(appRoot, 'app.js'), 'utf8');
const bridge = readFileSync(join(appRoot, 'native-bridge.js'), 'utf8');

must(cfg.includes("functionsProvider: 'supabase'"), 'STRENGTH_CONFIG uses supabase');
must(html.includes('strength-config.js'), 'index loads strength-config');
must(whoopJs.includes("functions/v1"), 'whoop hits Edge functions');
must(whoopJs.includes("x-hybrid-product': 'strength'") || whoopJs.includes('x-hybrid-product": "strength"'), 'whoop sends strength product');
must(whoopJs.includes('Browser.open'), 'native WHOOP opens Capacitor Browser');
must(whoopJs.includes('appUrlOpen'), 'native WHOOP listens for deep link');
must(!whoopJs.includes('thehybridsystem.netlify.app'), 'whoop must not call dead athlete Netlify WHOOP');
must(app.includes("Whoop.fnUrl('brain-coach')"), 'coach uses Edge via Whoop.fnUrl');
must(bridge.includes('setChannel'), 'OTA pins Capgo channel');

if (failures.length) {
  console.error('brain whoop-ownership FAIL');
  failures.forEach((f) => console.error(' -', f));
  process.exit(1);
}
console.log('brain whoop-ownership: ok');
