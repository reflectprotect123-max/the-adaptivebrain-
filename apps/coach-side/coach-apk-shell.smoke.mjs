import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const cap = join(dir, 'capacitor', 'capacitor.config.json');
if (!existsSync(cap)) throw new Error('missing capacitor/capacitor.config.json');
const cfg = JSON.parse(readFileSync(cap, 'utf8'));
if (cfg.appId !== 'com.hybrid.coach') throw new Error(`appId ${cfg.appId}`);
if (cfg.appName !== 'THE Hybrid Coach') throw new Error(`appName ${cfg.appName}`);
if (cfg.webDir !== 'www') throw new Error(`webDir ${cfg.webDir}`);
if (JSON.stringify(cfg.plugins || {}).includes('BluetoothLe')) {
  throw new Error('Coach APK must not add BluetoothLe');
}
const html = readFileSync(join(dir, 'coach.html'), 'utf8');
if (!html.includes('./coach-native-bridge.js')) {
  throw new Error('coach.html must load coach-native-bridge.js');
}
if (html.includes('com.hybrid.athlete://whoop')) {
  throw new Error('coach.html must not use athlete WHOOP URL scheme');
}
const scripts = [
  'whoop.js',
  'exercise-search-index.js',
  'exercise-search.js',
  'coach-exercise-catalog.js',
  'coach-loop.js',
  'log-columns.js',
  'coach-nutrition.js',
  'coach-bridge.js',
  'coach-cloud.js',
  'coach-views.js',
  'coach-native-bridge.js',
];
const sync = readFileSync(join(dir, 'scripts/sync-coach-apk.sh'), 'utf8');
for (const s of scripts) {
  if (!sync.includes(s)) throw new Error(`sync-coach-apk.sh missing ${s}`);
}
const gradle = join(dir, 'capacitor/android/app/build.gradle');
if (existsSync(gradle)) {
  const g = readFileSync(gradle, 'utf8');
  if (!g.includes('applicationId "com.hybrid.coach"')) {
    throw new Error('android applicationId must be com.hybrid.coach');
  }
}
const manifest = join(dir, 'capacitor/android/app/src/main/AndroidManifest.xml');
if (existsSync(manifest)) {
  const m = readFileSync(manifest, 'utf8');
  if (m.includes('whoop') || m.includes('com.hybrid.athlete')) {
    throw new Error('Coach manifest must not include athlete WHOOP scheme');
  }
}
console.log('coach-apk-shell.smoke.mjs ok');
