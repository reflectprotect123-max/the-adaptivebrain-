import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const athlete = join(dirname(fileURLToPath(import.meta.url)), '..');
const cap = join(athlete, '..', 'mobile', 'capacitor');
const failures = [];
function must(c, m) {
  if (!c) failures.push(m);
}

const bridge = readFileSync(join(athlete, 'native-bridge.js'), 'utf8');
const app = readFileSync(join(athlete, 'app.js'), 'utf8');
const html = readFileSync(join(athlete, 'index.html'), 'utf8');
const cfg = JSON.parse(readFileSync(join(cap, 'capacitor.config.json'), 'utf8'));
const pkg = JSON.parse(readFileSync(join(cap, 'package.json'), 'utf8'));
const gradle = readFileSync(join(cap, 'android/app/capacitor.build.gradle'), 'utf8');
const settings = readFileSync(join(cap, 'android/capacitor.settings.gradle'), 'utf8');

must(!!pkg.dependencies['@capgo/capacitor-updater'], 'package.json has @capgo/capacitor-updater');
must(cfg.plugins && cfg.plugins.CapacitorUpdater, 'CapacitorUpdater in capacitor.config.json');
must(cfg.plugins.CapacitorUpdater.autoUpdate === true, 'autoUpdate enabled for dogfood OTA');
must(cfg.plugins.CapacitorUpdater.defaultChannel === 'dogfood', 'dogfood channel');
must(bridge.includes('notifyLiveUpdateReady'), 'native-bridge Capgo handshake');
must(bridge.includes("plugin('CapacitorUpdater')"), 'uses CapacitorUpdater plugin');
must(bridge.includes('function probeLiveUpdate'), 'probeLiveUpdate for banner');
must(bridge.includes('function applyLiveUpdate'), 'applyLiveUpdate reloads ready bundle');
must(gradle.includes("project(':capgo-capacitor-updater')"), 'android gradle wires Capgo');
must(settings.includes("include ':capgo-capacitor-updater'"), 'settings.gradle includes Capgo');
must(html.includes('native-bridge.js'), 'index loads native-bridge.js');
must(app.includes('function otaBannerHtml'), 'Me tab renders OTA banner');
must(app.includes('Restart now'), 'ready state has Restart now');
must(app.includes('function applyOtaUpdate'), 'applyOtaUpdate from banner');
must(app.includes('function lookForAppUpdate'), 'Settings can look for an app update');
must(app.includes('Look for app update'), 'Look for app update button');
must(app.includes('.ota-banner') || app.includes('ota-banner'), 'OTA banner markup');
must(existsSync(join(cap, 'scripts/ship-capgo.sh')), 'ship-capgo.sh exists');

if (failures.length) {
  console.error('capgo-live-update.smoke FAIL');
  failures.forEach((f) => console.error(' -', f));
  process.exit(1);
}
console.log('capgo-live-update.smoke: ok');
