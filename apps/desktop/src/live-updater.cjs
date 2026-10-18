/** Capgo owns UI delivery. GitHub's electron-updater still owns native installers. */
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const APP_ID = 'com.hybrid.coach';
const CHANNEL = 'coach-live';

function createLiveUpdater(win, dependencies = {}) {
  const { app, ipcMain, dialog } = dependencies.electron || require('electron');
  const { ElectronUpdater } = dependencies.sdk || require('@capgo/electron-updater');
  const sdk = new ElectronUpdater({
    appId: APP_ID, version: app.getVersion(), defaultChannel: CHANNEL,
    autoUpdate: false, directUpdate: false, autoDeletePrevious: false,
    // Our watchdog resets to a known-good bundle before the SDK's timeout.
    appReadyTimeout: 60000, responseTimeout: 20,
    allowModifyUrl: false, allowModifyAppId: false, debugMenu: false,
  });
  const statePath = path.join(app.getPath('userData'), 'coach-live-health.json');
  let state = { rejected: [] };
  try { state = { ...state, ...JSON.parse(fs.readFileSync(statePath, 'utf8')) }; } catch {}
  const save = () => {
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(statePath + '.tmp', JSON.stringify(state));
    fs.renameSync(statePath + '.tmp', statePath);
  };
  let timer, checkTimer, initialized = false, recovering = false, checking = false;
  let builtinPath;
  const expectedUrl = () => pathToFileURL(sdk.getCurrentBundlePath()).href;
  const message = (detail) => dialog.showMessageBox(win, {
    type: 'info', title: 'Coach updates', message: detail, buttons: ['OK'],
  });

  async function recover() {
    if (recovering || !initialized) return;
    recovering = true;
    clearTimeout(timer);
    try {
      const { bundle } = await sdk.current();
      if (bundle.id !== 'builtin') {
        state.rejected = [...new Set([...state.rejected, bundle.version])];
        state.pending = false;
        save();
        // SDK 0.0.6's timeout reloads the current path; explicitly select fallback.
        const failedPath = sdk.getCurrentBundlePath();
        await sdk.reset({ toLastSuccessful: true });
        // A previously healthy bundle can fail on a later launch too.
        if (sdk.getCurrentBundlePath() === failedPath) await sdk.reset();
      }
    } catch (error) {
      console.error('[coach-capgo] rollback:', error.message);
      await win.loadFile(builtinPath);
    } finally { recovering = false; }
  }

  function watchLoad(_event, _url, _inPlace, isMainFrame) {
    if (isMainFrame === false) return;
    clearTimeout(timer);
    timer = setTimeout(() => { recover().catch(console.error); }, dependencies.healthTimeout || 20000);
    timer.unref?.();
  }

  async function ready(event) {
    if (!initialized || event.sender !== win.webContents ||
        event.senderFrame !== win.webContents.mainFrame || event.senderFrame.url !== expectedUrl()) return;
    const current = (await sdk.current()).bundle;
    if (current.id !== 'builtin' && state.rejected.includes(current.version)) return;
    clearTimeout(timer);
    state.pending = false;
    save();
    await sdk.notifyAppReady();
  }

  async function check(manual = false) {
    if (!initialized || recovering || checking) return;
    checking = true;
    try {
      const latest = await sdk.getLatest();
      const current = (await sdk.current()).bundle;
      const queued = await sdk.getNextBundle();
      if (latest.error && latest.error !== 'no_new_version_available') throw new Error(latest.message || latest.error);
      if (!latest.url || !latest.version || latest.version === current.version) {
        if (manual) await message(queued ? `Coach ${queued.version} is ready. Close and reopen Coach to install it.` : `Coach ${current.version} is up to date.`);
        return;
      }
      if (latest.breaking) {
        if (manual) await message('This update needs a newer desktop app. Use Coach → Check for app updates.');
        return;
      }
      if (state.rejected.includes(latest.version)) {
        if (manual) await message('This Coach update failed its startup check. Your previous version is still available.');
        return;
      }
      if (!/^https:\/\//.test(latest.url) || !/^[a-f0-9]{64}$/i.test(latest.checksum || '') || latest.sessionKey || latest.manifest?.length) {
        throw new Error('Expected an HTTPS ZIP bundle with a SHA-256 checksum.');
      }
      if (!queued || queued.version !== latest.version) {
        const bundle = await sdk.download({ url: latest.url, version: latest.version, checksum: latest.checksum });
        await sdk.setMultiDelay({ delayConditions: [{ kind: 'kill' }] });
        await sdk.next({ id: bundle.id });
      }
      if (manual) await message(`Coach ${latest.version} is ready. Close and reopen Coach to install it. Your work stays open until then.`);
    } catch (error) {
      console.error('[coach-capgo] update check:', error.message);
      if (manual) await message('Could not check for Coach updates. Please try again later.');
    } finally { checking = false; }
  }

  async function start(builtin) {
    builtinPath = builtin;
    const interrupted = state.pending;
    const shellChanged = state.shellVersion && state.shellVersion !== app.getVersion();
    const onReady = (event) => { ready(event).catch(console.error); };
    ipcMain.on('coach:ready', onReady);
    win.webContents.on('did-start-navigation', watchLoad);
    win.webContents.on('did-fail-load', (_event, code, _description, _url, isMainFrame) => {
      if (isMainFrame && code !== -3) recover().catch(console.error);
    });
    try {
      await sdk.initialize(win, builtin);
      initialized = true;
      if (shellChanged) await sdk.reset();
      else if (interrupted) await recover();
      state.shellVersion = app.getVersion();
      state.pending = (await sdk.current()).bundle.id !== 'builtin';
      save();
      // Always arm for the initial load too; SDK only arms on its own reloads.
      watchLoad();
      await win.loadFile(sdk.getCurrentBundlePath());
      checkTimer = setTimeout(() => { check().catch(console.error); }, 5000);
      checkTimer.unref?.();
    } catch (error) {
      console.error('[coach-capgo] startup:', error.message);
      await win.loadFile(builtin);
    }
    win.on('closed', () => {
      clearTimeout(timer); clearTimeout(checkTimer);
      ipcMain.removeListener('coach:ready', onReady);
    });
  }
  return { start, check };
}
module.exports = { createLiveUpdater, APP_ID, CHANNEL };
