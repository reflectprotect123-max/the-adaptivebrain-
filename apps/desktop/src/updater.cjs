/**
 * Auto-update for the packaged Windows shell via GitHub Releases (electron-updater).
 * The installer includes a fallback Coach UI; Capgo delivers later UI updates.
 */
const { app, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');

/** Stable release tag — same pattern as dogfood-latest for the athlete APK. */
const RELEASE_FEED =
  'https://github.com/reflectprotect123-max/the-adaptivebrain-/releases/download/coach-desktop-latest';

function initUpdater(getMainWindow) {
  if (!app.isPackaged) {
    return {
      isEnabled: false,
      checkForUpdates: () =>
        dialog.showMessageBox(getMainWindow?.() || undefined, {
          type: 'info',
          title: 'App updates',
          message: 'Shell auto-update runs in the installed Windows app only.',
          detail: 'The coach screen is bundled with this app. Install a newer app build to update it.',
          buttons: ['OK'],
        }),
    };
  }

  autoUpdater.setFeedURL({
    provider: 'generic',
    url: RELEASE_FEED,
  });
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-downloaded', (info) => {
    const win = getMainWindow();
    const opts = {
      type: 'info',
      title: 'Update ready',
      message: `THE Hybrid Coach ${info.version} is ready.`,
      detail: 'Restart now to install the update.',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      cancelId: 1,
    };
    const prompt =
      win && !win.isDestroyed()
        ? dialog.showMessageBox(win, opts)
        : dialog.showMessageBox(opts);
    prompt.then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall();
    });
  });

  autoUpdater.on('error', (err) => {
    console.error('[coach-desktop] update error:', err?.message || err);
  });

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 5000);

  return {
    isEnabled: true,
    checkForUpdates: () => autoUpdater.checkForUpdates(),
  };
}

module.exports = { initUpdater };
