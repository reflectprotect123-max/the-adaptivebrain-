const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createLiveUpdater } = require('./live-updater.cjs');
const tick = () => new Promise(r => setImmediate(r));

function fixture(t, options = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coach-capgo-'));
  const stateFile = path.join(dir, 'coach-live-health.json');
  if (options.state) fs.writeFileSync(stateFile, JSON.stringify(options.state));
  const ipcMain = new EventEmitter(), win = new EventEmitter();
  win.webContents = new EventEmitter();
  win.webContents.mainFrame = { url: '' };
  const calls = [], dialogs = [];
  let current = options.current || { id: 'builtin', version: '1.0.6' }, queued = null;
  const builtin = path.join(dir, 'coach.html'), downloaded = path.join(dir, 'update', 'index.html');
  win.loadFile = async file => {
    calls.push(['load', file]);
    win.webContents.mainFrame.url = pathToFileURL(file).href;
    win.webContents.emit('did-start-navigation', {}, win.webContents.mainFrame.url, false, true);
  };
  const sdk = {
    initialize: async () => { if (options.initError) throw Error('init failure'); },
    getCurrentBundlePath: () => current.id === 'builtin' ? builtin : downloaded,
    current: async () => ({ bundle: current }),
    getLatest: async () => { if (options.networkError) throw Error('offline'); return options.latest || { error: 'no_new_version_available' }; },
    getNextBundle: async () => queued,
    download: async input => { calls.push(['download', input]); if (options.downloadError) throw Error('Checksum verification failed'); return { id: 'new', version: input.version }; },
    setMultiDelay: async input => calls.push(['delay', input]),
    next: async input => { calls.push(['next', input]); queued = { id: input.id, version: options.latest.version }; },
    notifyAppReady: async () => calls.push(['ready']),
    reset: async input => { calls.push(['reset', input]); if (!(options.lastGoodIsCurrent && input?.toLastSuccessful)) current = { id: 'builtin', version: '1.0.6' }; await win.loadFile(sdk.getCurrentBundlePath()); },
  };
  let config;
  const live = createLiveUpdater(win, {
    electron: { app: { getVersion: () => '1.0.6', getPath: () => dir }, ipcMain,
      dialog: { showMessageBox: async (_win, value) => { dialogs.push(value.message); } } },
    sdk: { ElectronUpdater: class { constructor(input) { config = input; return sdk; } } },
    healthTimeout: options.healthTimeout || 500,
  });
  t.after(() => { win.emit('closed'); fs.rmSync(dir, { recursive: true, force: true }); });
  return { live, win, calls, dialogs, config, stateFile, builtin, ipcMain,
    ready: async (event = {}) => { ipcMain.emit('coach:ready', { sender: win.webContents, senderFrame: win.webContents.mainFrame, ...event }); await tick(); },
  };
}
const latest = { version: '1.0.7', url: 'https://downloads.capgo.app/coach.zip', checksum: 'a'.repeat(64) };

test('downloads a checksum-verified update once and queues it for restart without loading it', async t => {
  const f = fixture(t, { latest }); await f.live.start(f.builtin); await f.ready();
  await f.live.check(true); await f.live.check(true);
  assert.equal(f.calls.filter(x => x[0] === 'download').length, 1);
  assert.deepEqual(f.calls.find(x => x[0] === 'delay')[1], { delayConditions: [{ kind: 'kill' }] });
  assert.equal(f.calls.filter(x => x[0] === 'load').length, 1);
  assert.match(f.dialogs[0], /Close and reopen/);
  assert.equal(f.config.autoUpdate, false); assert.equal(f.config.defaultChannel, 'coach-live');
});
test('healthy renderer clears crash marker and acknowledges the SDK', async t => {
  const f = fixture(t, { current: { id: 'new', version: '1.0.7' } }); await f.live.start(f.builtin);
  assert.equal(JSON.parse(fs.readFileSync(f.stateFile)).pending, true);
  await f.ready(); assert.equal(JSON.parse(fs.readFileSync(f.stateFile)).pending, false);
  assert.equal(f.calls.filter(x => x[0] === 'ready').length, 1);
});
test('foreign window, child frame and unexpected URL cannot acknowledge an update', async t => {
  const f = fixture(t); await f.live.start(f.builtin);
  await f.ready({ sender: {} }); await f.ready({ senderFrame: { url: f.win.webContents.mainFrame.url } });
  f.win.webContents.mainFrame.url = 'https://example.com'; await f.ready();
  assert.equal(f.calls.filter(x => x[0] === 'ready').length, 0);
});
for (const [label, change] of [
  ['HTTP', { url: 'http://example.com/a.zip' }], ['missing checksum', { checksum: '' }],
  ['wrong checksum format', { checksum: '1234' }], ['unsupported delta', { manifest: [{}] }],
  ['unsupported encryption', { sessionKey: 'key' }],
]) test(`rejects ${label} without downloading`, async t => {
  const f = fixture(t, { latest: { ...latest, ...change } }); await f.live.start(f.builtin); await f.live.check(true);
  assert.equal(f.calls.filter(x => x[0] === 'download').length, 0); assert.match(f.dialogs[0], /Could not check/);
});
test('checksum download failure never queues an update', async t => {
  const f = fixture(t, { latest, downloadError: true }); await f.live.start(f.builtin); await f.live.check(true);
  assert.equal(f.calls.filter(x => x[0] === 'next').length, 0);
});
test('breaking shell updates are left to the native updater', async t => {
  const f = fixture(t, { latest: { ...latest, breaking: true } }); await f.live.start(f.builtin); await f.live.check(true);
  assert.match(f.dialogs[0], /newer desktop/); assert.equal(f.calls.filter(x => x[0] === 'download').length, 0);
});
test('offline startup still loads the bundled Coach and manual checks report the failure', async t => {
  const f = fixture(t, { networkError: true }); await f.live.start(f.builtin); await f.ready(); await f.live.check(true);
  assert.equal(f.calls[0][0], 'load'); assert.match(f.dialogs[0], /Could not check/);
});
test('SDK initialization failure falls back to builtin', async t => {
  const f = fixture(t, { initError: true }); await f.live.start(f.builtin);
  assert.deepEqual(f.calls, [['load', f.builtin]]);
});
test('interrupted startup rejects the candidate and resets to the last healthy UI', async t => {
  const f = fixture(t, { current: { id: 'new', version: '1.0.7' }, state: { pending: true, rejected: [] }, latest });
  await f.live.start(f.builtin); await f.live.check(true);
  assert.deepEqual(f.calls.find(x => x[0] === 'reset')[1], { toLastSuccessful: true });
  assert.equal(f.calls.filter(x => x[0] === 'download').length, 0);
  assert.match(f.dialogs[0], /failed its startup check/);
});
test('unresponsive downloaded UI is rolled back by the watchdog', async t => {
  const f = fixture(t, { current: { id: 'new', version: '1.0.7' }, healthTimeout: 20 });
  await f.live.start(f.builtin); await new Promise(r => setTimeout(r, 45));
  assert.equal(f.calls.filter(x => x[0] === 'reset').length, 1);
  assert.deepEqual(JSON.parse(fs.readFileSync(f.stateFile)).rejected, ['1.0.7']);
});
test('new installer starts from its fresh builtin UI', async t => {
  const f = fixture(t, { current: { id: 'old', version: '1.0.5' }, state: { shellVersion: '1.0.5', rejected: [] } });
  await f.live.start(f.builtin); assert.deepEqual(f.calls.find(x => x[0] === 'reset'), ['reset', undefined]);
});

test('recovery falls back to builtin when last-successful is the failing bundle itself', async t => {
  const f = fixture(t, { current: { id: 'old-success', version: '1.0.7' }, lastGoodIsCurrent: true, healthTimeout: 20 });
  await f.live.start(f.builtin); await new Promise(r => setTimeout(r, 45));
  assert.deepEqual(f.calls.filter(x => x[0] === 'reset'), [['reset', { toLastSuccessful: true }], ['reset', undefined]]);
  assert.equal(f.calls.filter(x => x[0] === 'load').at(-1)[1], f.builtin);
});
