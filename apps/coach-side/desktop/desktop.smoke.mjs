#!/usr/bin/env node
/**
 * Coach desktop shell smoke — validates config without launching Electron.
 * Proves the live coach URL responds; does not modify coach/athlete code.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.join(here, 'package.json'), 'utf8'));
const mainPath = path.join(here, pkg.main);
const updaterPath = path.join(here, 'src/updater.cjs');

function must(cond, msg) {
  if (!cond) throw new Error(msg);
}

must(fs.existsSync(mainPath), 'main process missing: ' + pkg.main);
must(fs.existsSync(updaterPath), 'updater process missing: src/updater.cjs');
must(pkg.build?.appId === 'com.hybrid.coach', 'appId must be com.hybrid.coach');
must(String(pkg.main).endsWith('.cjs'), 'electron main must be CommonJS .cjs');
must(pkg.dependencies?.['electron-updater'], 'electron-updater dependency required for shell OTA');
must(pkg.build?.publish?.provider === 'generic', 'publish.provider must be generic for coach-desktop-latest OTA');
must(
  String(pkg.build?.publish?.url || '').includes('coach-desktop-latest'),
  'publish.url must point at coach-desktop-latest release feed',
);

const mainSrc = fs.readFileSync(mainPath, 'utf8');
const updaterSrc = fs.readFileSync(updaterPath, 'utf8');
must(mainSrc.includes('thehybridsystem.netlify.app/coach.html'), 'default coach URL missing');
must(mainSrc.includes('contextIsolation: true'), 'contextIsolation must stay enabled');
must(mainSrc.includes('nodeIntegration: false'), 'nodeIntegration must stay disabled');
must(mainSrc.includes('./updater.cjs'), 'main must wire shell OTA updater');
must(mainSrc.includes('Check for app updates'), 'menu must expose shell update check');
must(!mainSrc.includes('preview-site'), 'desktop must not bundle local preview-site');
must(updaterSrc.includes('autoUpdater'), 'updater must use electron-updater');
must(updaterSrc.includes('coach-desktop-latest'), 'updater feed must use coach-desktop-latest release');
must(updaterSrc.includes('app.isPackaged'), 'updater must skip in dev unpackaged runs');

const coachUrl = 'https://thehybridsystem.netlify.app/coach.html';
const res = await fetch(coachUrl, { method: 'GET', redirect: 'follow' });
must(res.ok, 'live coach.html must respond 200, got ' + res.status);
const html = await res.text();
must(html.includes('coach-loop.js'), 'coach.html must load coach-loop.js');
must(html.includes('coach-views.js'), 'coach.html must load coach-views.js');

console.log('coach-desktop.smoke: ok', {
  coachUrl,
  appId: pkg.build.appId,
  version: pkg.version,
  shellOta: pkg.build.publish.provider,
});
