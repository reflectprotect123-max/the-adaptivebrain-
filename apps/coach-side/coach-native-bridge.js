(function (global) {
  function isNative() {
    return !!(global.Capacitor && global.Capacitor.isNativePlatform && global.Capacitor.isNativePlatform());
  }
  function plugin(name) {
    try {
      return global.Capacitor && global.Capacitor.Plugins && global.Capacitor.Plugins[name];
    } catch (_) {
      return null;
    }
  }
  async function notifyLiveUpdateReady() {
    const Updater = plugin('CapacitorUpdater');
    if (!Updater || typeof Updater.notifyAppReady !== 'function') return;
    try {
      await Updater.notifyAppReady();
    } catch (_) {}
  }
  async function pinLiveChannel() {
    if (!isNative()) return 'skipped';
    const Updater = plugin('CapacitorUpdater');
    if (!Updater || typeof Updater.setChannel !== 'function') return 'unavailable';
    try {
      await Updater.setChannel({ channel: 'live' });
      return 'live';
    } catch (_) {
      return 'error';
    }
  }
  try {
    Promise.resolve(pinLiveChannel())
      .then(function () {
        notifyLiveUpdateReady();
      })
      .catch(function () {
        notifyLiveUpdateReady();
      });
  } catch (_) {}
  global.CoachNativeBridge = { isNative, pinLiveChannel, notifyLiveUpdateReady };
})(typeof window !== 'undefined' ? window : globalThis);
