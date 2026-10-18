#!/usr/bin/env node
/**
 * Coach desktop shell smoke — validates bundled coach assets without Electron.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.join(here, 'package.json'), 'utf8'));
const config = createRequire(import.meta.url)('./electron-builder.cjs');
const mainPath = path.join(here, pkg.main);
const updaterPath = path.join(here, 'src/updater.cjs');
const coachPath = path.resolve(here, '../coach/coach.html');

function must(cond, msg) {
  if (!cond) throw new Error(msg);
}

must(fs.existsSync(mainPath), 'main process missing: ' + pkg.main);
must(fs.existsSync(updaterPath), 'updater process missing: src/updater.cjs');
must(pkg.build?.appId === 'com.hybrid.coach', 'appId must be com.hybrid.coach');
must(String(pkg.main).endsWith('.cjs'), 'electron main must be CommonJS .cjs');
must(pkg.dependencies?.['@capgo/electron-updater'] === '0.0.6', 'Capgo Electron SDK must be pinned');
must(pkg.dependencies?.['electron-updater'], 'electron-updater dependency required for shell OTA');
must(pkg.build?.publish?.provider === 'generic', 'publish.provider must be generic for coach-desktop-latest OTA');
const releaseFeed = 'https://github.com/reflectprotect123-max/the-adaptivebrain-/releases/download/coach-desktop-latest';
must(pkg.build?.publish?.url === releaseFeed, 'desktop release feed must belong to Adaptive Brain');
must(
  String(pkg.build?.publish?.url || '').includes('coach-desktop-latest'),
  'publish.url must point at coach-desktop-latest release feed',
);
must(config.extraResources?.some((row) => row.from === '../coach' && row.to === 'coach'), 'coach UI must be bundled with the desktop app');

const mainSrc = fs.readFileSync(mainPath, 'utf8');
const updaterSrc = fs.readFileSync(updaterPath, 'utf8');
const coachHtml = fs.readFileSync(coachPath, 'utf8');
must(mainSrc.includes("path.join(process.resourcesPath, 'coach', 'coach.html')"), 'packaged coach path missing');
must(mainSrc.includes("path.resolve(__dirname, '../../coach/coach.html')"), 'development coach path missing');
must(mainSrc.includes('contextIsolation: true'), 'contextIsolation must stay enabled');
must(mainSrc.includes('nodeIntegration: false'), 'nodeIntegration must stay disabled');
must(mainSrc.includes('./updater.cjs'), 'main must wire shell OTA updater');
must(mainSrc.includes('Check for app updates'), 'menu must expose shell update check');
must(updaterSrc.includes('autoUpdater'), 'updater must use electron-updater');
must(updaterSrc.includes('coach-desktop-latest'), 'updater feed must use coach-desktop-latest release');
must(updaterSrc.includes(releaseFeed), 'runtime updater must use the Adaptive Brain release feed');
must(config.extraResources[0].filter.every(name => !name.startsWith('fixtures/') && !name.startsWith('strength-') && !name.endsWith('.smoke.mjs')), 'only Coach runtime assets may ship');
for (const asset of config.extraResources[0].filter) must(fs.existsSync(path.resolve(here, '../coach', asset)), 'release asset missing: ' + asset);
must(updaterSrc.includes('app.isPackaged'), 'updater must skip in dev unpackaged runs');
must(coachHtml.includes('coach-loop.js'), 'bundled coach.html must load coach-loop.js');
must(coachHtml.includes('coach-views.js'), 'bundled coach.html must load coach-views.js');
must(!mainSrc.includes('netlify'), 'desktop main process must not depend on Netlify');
must(!updaterSrc.includes('netlify'), 'desktop updater must not depend on Netlify');

console.log('coach-desktop.smoke: ok', {
  bundledCoach: path.relative(here, coachPath),
  appId: pkg.build.appId,
  version: pkg.version,
  shellOta: pkg.build.publish.provider,
});

const liveSrc = fs.readFileSync(path.join(here, 'src/live-updater.cjs'), 'utf8');
must(mainSrc.includes('./live-updater.cjs'), 'main must wire Coach Capgo updater');
must(mainSrc.includes('preload.cjs'), 'sandboxed health bridge missing');
must(liveSrc.includes("'com.hybrid.coach'"), 'Coach must have its own Capgo app');
must(liveSrc.includes("'coach-live'"), 'Coach must have its own Capgo channel');
must(coachHtml.includes('CoachDesktop?.notifyAppReady()'), 'Coach must acknowledge successful startup');
