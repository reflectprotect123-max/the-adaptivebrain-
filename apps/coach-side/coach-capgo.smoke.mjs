import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const failures = [];
function must(c, m) {
  if (!c) failures.push(m);
}

const cap = join(dir, 'capacitor');
const cfg = JSON.parse(readFileSync(join(cap, 'capacitor.config.json'), 'utf8'));
const pkg = JSON.parse(readFileSync(join(cap, 'package.json'), 'utf8'));
const bridge = readFileSync(join(dir, 'coach-native-bridge.js'), 'utf8');
const html = readFileSync(join(dir, 'coach.html'), 'utf8');
const ship = join(dir, 'capacitor/scripts/ship-capgo.sh');

must(!!pkg.dependencies['@capgo/capacitor-updater'], 'package.json has @capgo/capacitor-updater');
must(cfg.appId === 'com.hybrid.coach', 'capacitor appId is com.hybrid.coach');
must(cfg.plugins && cfg.plugins.CapacitorUpdater, 'CapacitorUpdater in capacitor.config.json');
must(cfg.plugins.CapacitorUpdater.appId === 'com.hybrid.coach', 'Capgo appId is com.hybrid.coach');
must(cfg.plugins.CapacitorUpdater.autoUpdate === true, 'autoUpdate enabled');
must(cfg.plugins.CapacitorUpdater.defaultChannel === 'live', 'defaultChannel live (not dogfood-only)');
must(bridge.includes("plugin('CapacitorUpdater')"), 'bridge uses CapacitorUpdater');
must(bridge.includes('notifyAppReady') || bridge.includes('notifyLiveUpdateReady'), 'Capgo notifyAppReady handshake');
must(bridge.includes("setChannel({ channel: 'live' })") || bridge.includes('channel: \'live\''), 'pins live channel');
must(bridge.includes('function probeLiveUpdate'), 'probeLiveUpdate');
must(bridge.includes('function applyLiveUpdate'), 'applyLiveUpdate');
must(html.includes('coach-native-bridge.js'), 'coach.html loads coach-native-bridge.js');
must(existsSync(ship), 'capacitor/scripts/ship-capgo.sh exists');
if (existsSync(ship)) {
  const sh = readFileSync(ship, 'utf8');
  must(sh.includes('com.hybrid.coach'), 'ship-capgo targets com.hybrid.coach');
  must(!sh.includes('com.hybrid.athlete'), 'ship-capgo must not upload to athlete');
  must(sh.includes('@capgo/cli'), 'ship-capgo uses Capgo CLI');
}
const gradle = join(cap, 'android/app/capacitor.build.gradle');
const settings = join(cap, 'android/capacitor.settings.gradle');
if (existsSync(gradle)) {
  must(readFileSync(gradle, 'utf8').includes("project(':capgo-capacitor-updater')"), 'android gradle wires Capgo');
}
if (existsSync(settings)) {
  must(readFileSync(settings, 'utf8').includes("include ':capgo-capacitor-updater'"), 'settings.gradle includes Capgo');
}

if (failures.length) {
  console.error('coach-capgo.smoke FAIL');
  failures.forEach((f) => console.error(' -', f));
  process.exit(1);
}
console.log('coach-capgo.smoke: ok');
