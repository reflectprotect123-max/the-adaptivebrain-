/**
 * THE Hybrid Coach — Electron shell with the coach workspace bundled locally.
 *
 * Packaged builds also auto-update the shell via GitHub Releases (electron-updater).
 *
 * Does not bundle coach HTML or touch athlete app code.
 */
const { app, BrowserWindow, shell, Menu } = require('electron');
const { initUpdater } = require('./updater.cjs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

function resolveCoachUrl() {
  if (process.env.HYBRID_COACH_URL) return process.env.HYBRID_COACH_URL.trim();
  const coachFile = app.isPackaged
    ? path.join(process.resourcesPath, 'coach', 'coach.html')
    : path.resolve(__dirname, '../../coach/coach.html');
  return pathToFileURL(coachFile).href;
}
const COACH_URL = resolveCoachUrl();

/** @type {import('electron').BrowserWindow | null} */
let mainWindow = null;
/** @type {{ isEnabled: boolean; checkForUpdates: () => unknown } | null} */
let updater = null;

function coachOrigin(url) {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

function shouldOpenExternally(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();
    if (parsed.origin !== coachOrigin(COACH_URL)) return true;
    if (/oauth|authorize|whoop|concept2|supabase/.test(host + path)) return true;
    return false;
  } catch {
    return true;
  }
}

function getMainWindow() {
  return mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
}

function buildMenu() {
  const template = [
    {
      label: 'Coach',
      submenu: [
        {
          label: 'Reload coach (get latest UI)',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            const win = getMainWindow();
            if (win) win.webContents.reload();
          },
        },
        {
          label: 'Check for app updates',
          click: () => {
            updater?.checkForUpdates();
          },
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1320,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    title: 'THE Hybrid Coach',
    autoHideMenuBar: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (shouldOpenExternally(url)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (shouldOpenExternally(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  win.loadURL(COACH_URL);
  mainWindow = win;
  return win;
}

app.whenReady().then(() => {
  buildMenu();
  createWindow();
  updater = initUpdater(getMainWindow);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
