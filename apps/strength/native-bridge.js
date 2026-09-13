/** Capacitor bridge — Capgo OTA only. Browser installs stay quiet. */
(function (global) {
  function isNative() {
    try {
      return !!(global.Capacitor && global.Capacitor.isNativePlatform && global.Capacitor.isNativePlatform());
    } catch {
      return false;
    }
  }

  function plugin(name) {
    try {
      return global.Capacitor && global.Capacitor.Plugins && global.Capacitor.Plugins[name];
    } catch {
      return null;
    }
  }

  function notifyLiveUpdateReady() {
    if (!isNative()) return Promise.resolve('skipped');
    const Updater = plugin('CapacitorUpdater');
    if (!Updater || typeof Updater.notifyAppReady !== 'function') return Promise.resolve('unavailable');
    return Updater.notifyAppReady().then(() => 'ready').catch(() => 'error');
  }

  function bundleVersion(raw) {
    if (!raw || typeof raw !== 'object') return '';
    const b = raw.bundle && typeof raw.bundle === 'object' ? raw.bundle : raw;
    return String(b.version || b.bundle || raw.version || '').trim();
  }

  function bundleId(raw) {
    if (!raw || typeof raw !== 'object') return '';
    const b = raw.bundle && typeof raw.bundle === 'object' ? raw.bundle : raw;
    return String(b.id || '').trim();
  }

  async function probeLiveUpdate(opts) {
    if (!isNative()) return { status: 'browser', current: '', next: '', latest: '' };
    const Updater = plugin('CapacitorUpdater');
    if (!Updater) return { status: 'unavailable', current: '', next: '', latest: '' };
    if (opts && opts.refresh && typeof Updater.triggerUpdateCheck === 'function') {
      try { await Updater.triggerUpdateCheck(); } catch (_) {}
    }
    let current = '';
    let next = '';
    let latest = '';
    try {
      if (typeof Updater.current === 'function') current = bundleVersion(await Updater.current());
    } catch (_) {}
    try {
      if (typeof Updater.getNextBundle === 'function') next = bundleVersion(await Updater.getNextBundle());
    } catch (_) {}
    try {
      if (typeof Updater.getLatest === 'function') latest = bundleVersion(await Updater.getLatest());
    } catch (_) {}
    if (next === 'builtin' || next === current) next = '';
    if (latest === current) latest = '';
    let status = 'current';
    if (next) status = 'ready';
    else if (latest) status = 'available';
    return { status, current, next, latest };
  }

  async function applyLiveUpdate() {
    if (!isNative()) return 'skipped';
    const Updater = plugin('CapacitorUpdater');
    if (!Updater) return 'unavailable';
    try {
      let next = null;
      if (typeof Updater.getNextBundle === 'function') next = await Updater.getNextBundle();
      const id = bundleId(next);
      if (id && typeof Updater.set === 'function') await Updater.set({ id });
      if (typeof Updater.reload === 'function') await Updater.reload();
      return 'reloading';
    } catch (_) {
      return 'error';
    }
  }

  function onLiveUpdateStatus(cb) {
    if (typeof cb !== 'function') return () => {};
    const Updater = plugin('CapacitorUpdater');
    const handles = [];
    const ping = () => {
      probeLiveUpdate()
        .then((info) => { try { cb(info); } catch (_) {} })
        .catch(() => {});
    };
    if (Updater && typeof Updater.addListener === 'function') {
      ['downloadComplete', 'updateAvailable', 'appReady', 'noNeedUpdate'].forEach((ev) => {
        try {
          const p = Updater.addListener(ev, ping);
          if (p && typeof p.then === 'function') p.then((h) => handles.push(h)).catch(() => {});
          else if (p) handles.push(p);
        } catch (_) {}
      });
    }
    ping();
    return () => {
      handles.forEach((h) => {
        try { if (h && h.remove) h.remove(); } catch (_) {}
      });
    };
  }

  try { notifyLiveUpdateReady(); } catch (_) {}

  global.NativeBridge = {
    isNative,
    notifyLiveUpdateReady,
    probeLiveUpdate,
    applyLiveUpdate,
    onLiveUpdateStatus,
  };
})(typeof window !== 'undefined' ? window : globalThis);
