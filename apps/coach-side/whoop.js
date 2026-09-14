/* WHOOP bridge — OAuth tokens stay on THE-HYBRID-ENGINE1; this page proxies + maps. */
(function (global) {
  const SUPABASE_URL = "https://orysjncrksmdfabpuftd.supabase.co";
  const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yeXNqbmNya3NtZGZhYnB1ZnRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0MTE4NzksImV4cCI6MjA5OTk4Nzg3OX0.GTMBfFtH5O6SikzHo75sXGIZoEhmuJ7TvXiACd7T078";
  const ATHLETE_NETLIFY = 'https://thehybridsystem.netlify.app';
  const FN = {
    connect: '/.netlify/functions/whoop-connect',
    sync: '/.netlify/functions/whoop-sync',
    status: '/.netlify/functions/integrations-status',
    disconnect: '/.netlify/functions/integrations-disconnect'
  };
  function resolveProxyBase() {
    try {
      const loc = global.location;
      if (!loc || !loc.hostname) return ATHLETE_NETLIFY;
      const host = String(loc.hostname).toLowerCase();
      if (host === 'thehybridsystem.netlify.app') return '';
      if (loc.protocol === 'file:' || loc.protocol === 'capacitor:') return ATHLETE_NETLIFY;
      if (host === 'localhost' || host === '127.0.0.1') return ATHLETE_NETLIFY;
      if (host.endsWith('.github.io')) return ATHLETE_NETLIFY;
      return ATHLETE_NETLIFY;
    } catch (_) { return ATHLETE_NETLIFY; }
  }
  function fnUrl(path, query) {
    const q = query ? '?' + new URLSearchParams(query) : '';
    const rel = path + q;
    const base = resolveProxyBase();
    return base ? base.replace(/\/$/, '') + rel : rel;
  }
  let sb = null;
  const ui = { busy: false, message: '' };

  function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function client() {
    if (sb) return sb;
    if (!global.supabase || !global.supabase.createClient) throw new Error('Supabase SDK failed to load');
    sb = global.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storage: global.localStorage }
    });
    return sb;
  }
  async function token() {
    const { data, error } = await client().auth.getSession();
    if (error) throw error;
    return (data.session && data.session.access_token) || null;
  }
  async function email() {
    try {
      const { data } = await client().auth.getSession();
      return (data.session && data.session.user && data.session.user.email) || null;
    } catch (_) { return null; }
  }
  async function api(path, opts) {
    opts = opts || {};
    const method = opts.method || 'GET';
    const t = await token();
    if (!t) { const e = new Error('Sign in to sync WHOOP'); e.code = 'auth_required'; throw e; }
    const url = fnUrl(path, opts.query);
    const res = await fetch(url, {
      method,
      headers: { authorization: 'Bearer ' + t, accept: 'application/json' },
      cache: 'no-store'
    });
    let body = null;
    try { body = await res.json(); } catch (_) { body = null; }
    if (!res.ok) {
      const e = new Error((body && (body.error || body.message)) || ('WHOOP request failed (' + res.status + ')'));
      e.status = res.status; e.body = body; throw e;
    }
    return body;
  }
  // `today` and `S` are let/const in the HTML script, so they are NOT on window.
  // Resolve them explicitly — otherwise applyNormalized silently no-ops and Home
  // keeps the fixture recovery/HRV/RHR values after a "WHOOP synced" toast.
  function todayIso() {
    if (typeof global.today === 'function') return global.today();
    const d = new Date();
    const tz = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tz).toISOString().slice(0, 10);
  }
  function appState() {
    if (global.S && typeof global.S === 'object') return global.S;
    return null;
  }
  function finiteNum(v) {
    // Number(null) === 0 — treat null/'' as missing so we don't write zeros.
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  // Ephemeral WHOOP UI state before index.html bridges window.S ↔ let S.
  // Never invent a stub on global.S — that orphans StrengthSync from real app state.
  var whoopFallback = { connected: false, lastSyncAt: null, sampleDate: null, email: null };
  function st() {
    const S = appState();
    if (!S) return whoopFallback;
    S.settings = S.settings || {};
    S.settings.whoop = S.settings.whoop || { connected: false, lastSyncAt: null, sampleDate: null, email: null };
    return S.settings.whoop;
  }
  function applyNormalized(n, meta) {
    meta = meta || {};
    if (!n || typeof n !== 'object') return false;
    if (typeof global.dailyCheckin !== 'function') return false;
    const c = global.dailyCheckin(todayIso(), true);
    let changed = false;
    const recovery = finiteNum(n.recoveryScore), hrv = finiteNum(n.hrvMs), rhr = finiteNum(n.restingHr);
    const sleepPerf = finiteNum(n.sleepPerformance), strain = finiteNum(n.strain);
    if (recovery != null && recovery > 0) { c.whoopRecovery = Math.round(recovery); changed = true; }
    if (hrv != null && hrv > 0) { c.hrv = Math.round(hrv); changed = true; }
    if (rhr != null && rhr > 0) { c.restingHr = Math.round(rhr); changed = true; }
    if (sleepPerf != null && sleepPerf > 0) { c.sleepQuality = Math.max(1, Math.min(10, Math.round(sleepPerf / 10))); changed = true; }
    if (strain != null && strain > 0) { c.whoopStrain = Math.round(strain * 10) / 10; changed = true; }
    if (changed) {
      c.updatedAt = Date.now();
      c.whoopSyncedAt = meta.syncedAt || n.capturedAt || new Date().toISOString();
      c.whoopSampleDate = n.date || meta.sampleDate || null;
      if (typeof global.readinessScore === 'function') {
        const s = global.readinessScore(c);
        Object.assign(c, {
          readinessColor: s.color, mainLimiter: s.reason,
          backgroundLoad: s.backgroundLoad, recoveryPenalty: s.recoveryPenalty, wearablePenalty: s.wearablePenalty
        });
      }
      if (typeof global.touchRecord === 'function') global.touchRecord(c, 'daily_checkins');
    }
    const w = st();
    w.connected = true;
    w.lastSyncAt = meta.syncedAt || n.capturedAt || new Date().toISOString();
    w.sampleDate = n.date || meta.sampleDate || w.sampleDate || null;
    w.lastNormalized = n;
    if (typeof global.save === 'function') global.save();
    return changed;
  }
  function metaLine() {
    const w = st();
    if (!w.connected) return 'Not connected — using typed check-in values';
    const when = w.lastSyncAt ? new Date(w.lastSyncAt).toLocaleString() : 'never';
    return 'Connected · sample ' + (w.sampleDate || '—') + ' · synced ' + when;
  }
  function statusChip(label, ok, detail) {
    return '<div class=meta style="margin-top:6px"><b>' + esc(label) + '</b> · ' + esc(ok ? 'OK' : '—') + (detail ? ' · ' + esc(detail) : '') + '</div>';
  }
  function cloudStatusLines() {
    var lines = '';
    if (global.StrengthSync && global.StrengthSync.getStatus) {
      var ss = global.StrengthSync.getStatus();
      var sLast = ss.lastSyncAt ? new Date(ss.lastSyncAt).toLocaleString() : 'never';
      lines += statusChip('Strength', !!ss.lastOk && !ss.lastError, ss.lastError || sLast);
    }
    if (global.NutritionSync && global.NutritionSync.getStatus) {
      var ns = global.NutritionSync.getStatus();
      var nLast = ns.lastSyncAt ? new Date(ns.lastSyncAt).toLocaleString() : 'never';
      lines += statusChip('Nutrition', !!ns.lastOk && !ns.lastError, ns.lastError || nLast);
    }
    var w = st();
    lines += statusChip('WHOOP', !!w.connected, w.connected ? metaLine() : 'not connected');
    if (global.Concept2 && typeof global.Concept2.metaLine === 'function') {
      var c2 = (global.S && global.S.settings && global.S.settings.concept2) || {};
      lines += statusChip('Concept2', !!c2.connected, global.Concept2.metaLine());
    }
    return lines;
  }
  function cardHtml() {
    const w = st();
    const busy = ui.busy ? ' disabled' : '';
    const msg = ui.message ? '<div class=meta style="margin-top:8px">' + esc(ui.message) + '</div>' : '';
    if (!w.email) {
      return '<div class=card id=whoopCard><div class=eyebrow>Account</div><div class=title>Sign in & sync</div>' +
        '<div class=meta>One sign-in syncs calendar sessions, templates, strength, nutrition, WHOOP, and Concept2 Logbook (when already linked). Use the same account on web and phone.</div>' +
        '<div class=field style="margin-top:12px"><label>Email</label><input id=whoopEmail type=email autocomplete=username placeholder="you@email.com"></div>' +
        '<div class=field><label>Password</label><input id=whoopPassword type=password autocomplete=current-password></div>' +
        '<div class=btns style="margin-top:12px"><button class="btn primary block" onclick="Whoop.signIn()"' + busy + '>Sign in & sync</button></div>' + msg + '</div>';
    }
    const whoopBtn = w.connected
      ? '<button class="btn" onclick="Whoop.disconnect()"' + busy + '>Disconnect WHOOP</button>'
      : '<button class="btn" onclick="Whoop.connect()"' + busy + '>Connect WHOOP</button>';
    return '<div class=card id=whoopCard><div class=eyebrow>Account</div><div class=title>Signed in</div>' +
      '<div class=meta>' + esc(w.email) + '</div>' +
      cloudStatusLines() +
      '<div class=btns style="margin-top:12px">' +
      '<button class="btn primary block" onclick="Whoop.syncAll()"' + busy + '>Sync all</button>' +
      whoopBtn +
      '<button class="btn" onclick="Whoop.signOut()"' + busy + '>Sign out</button></div>' +
      msg +
      '<div class=meta style="margin-top:10px">Live workout HR still uses Bluetooth. WHOOP fills recovery / HRV / resting HR.</div></div>';
  }
  function renderPanels() {
    const card = document.getElementById('whoopCard');
    if (card) { const wrap = document.createElement('div'); wrap.innerHTML = cardHtml(); card.replaceWith(wrap.firstChild); }
    const line = document.getElementById('whoopSleepLine');
    if (line) line.textContent = metaLine();
  }
  async function refreshStatus() {
    const body = await api(FN.status);
    const whoop = (body && body.whoop) || {};
    const w = st();
    w.connected = !!whoop.connected;
    w.lastSyncAt = whoop.lastSyncAt || w.lastSyncAt;
    w.sampleDate = whoop.sampleDate || w.sampleDate;
    if (whoop.normalized) applyNormalized(whoop.normalized, { syncedAt: whoop.lastSyncAt, sampleDate: whoop.sampleDate });
    w.email = await email();
    if (typeof global.save === 'function') global.save();
    return body;
  }
  function refreshVisibleUi() {
    renderPanels();
    // Sleep overview: rebuild metrics without re-entering auto-sync.
    if (document.getElementById('whoopSleepLine') && typeof global.openAthleteSleepOverview === 'function') {
      global.openAthleteSleepOverview(undefined, { skipWhoopSync: true });
      return;
    }
    const tab = (appState() && appState().tab) || null;
    // Settings: only swap the Account card in place. Calling settings() rebuilds
    // the whole page and shell() scrolls to top — that feels like broken scroll.
    if (tab === 'settings') return;
    if (typeof global.render === 'function') global.render();
  }
  async function sync(opts) {
    opts = opts || {};
    if (ui.busy && !opts.quiet) return;
    if (!opts.quiet) { ui.busy = true; ui.message = 'Syncing WHOOP…'; renderPanels(); }
    try {
      const body = await api(FN.sync, opts.backfill ? { query: { backfill: '1' } } : undefined);
      let applied = false;
      if (body && body.normalized) {
        applied = !!applyNormalized(body.normalized, { syncedAt: body.syncedAt, sampleDate: body.normalized.date });
      } else {
        await refreshStatus();
        applied = !!(st().lastNormalized && finiteNum(st().lastNormalized.recoveryScore));
      }
      if (!opts.quiet) {
        ui.message = applied
          ? 'WHOOP synced — Home recovery / HRV / RHR updated'
          : 'WHOOP reached but no recovery sample yet';
      }
      try { await refreshStatus(); } catch (_) {}
      if (!opts.quiet) {
        ui.busy = false;
        refreshVisibleUi();
      }
    } catch (err) {
      if (!opts.quiet) ui.message = err.code === 'auth_required' ? 'Sign in to sync WHOOP' : (err.message || 'Sync failed');
      throw err;
    } finally {
      if (!opts.quiet) { ui.busy = false; renderPanels(); }
    }
  }
  async function connect() {
    if (ui.busy) return;
    ui.busy = true; ui.message = 'Opening WHOOP…'; renderPanels();
    try {
      const body = await api(FN.connect, { query: { client: 'native' } });
      const url = body && typeof body.authorizeUrl === 'string' ? body.authorizeUrl : '';
      if (!/^https:\/\//i.test(url)) throw new Error('WHOOP connect URL missing');
      global.open(url, '_blank', 'noopener');
      ui.message = 'Finish consent in the WHOOP window, then tap Sync';
      const onFocus = async function () {
        global.removeEventListener('focus', onFocus);
        try { await refreshStatus(); if (st().connected) await sync(); }
        catch (err) { ui.message = err.message || 'Could not finish WHOOP connect'; renderPanels(); }
      };
      global.addEventListener('focus', onFocus);
    } catch (err) {
      ui.message = err.code === 'auth_required' ? 'Sign in before connecting WHOOP' : (err.message || 'Connect failed');
      throw err;
    } finally { ui.busy = false; renderPanels(); }
  }
  async function disconnect() {
    if (ui.busy) return;
    if (!global.confirm('Disconnect WHOOP for this account?')) return;
    ui.busy = true; ui.message = 'Disconnecting…'; renderPanels();
    try {
      await api(FN.disconnect, { method: 'POST', query: { provider: 'whoop' } });
      const w = st();
      w.connected = false; w.lastSyncAt = null; w.sampleDate = null; w.lastNormalized = null;
      if (typeof global.save === 'function') global.save();
      ui.message = 'WHOOP disconnected';
    } catch (err) { ui.message = err.message || 'Disconnect failed'; }
    finally { ui.busy = false; renderPanels(); }
  }
  async function syncAll() {
    if (ui.busy) return;
    ui.busy = true;
    ui.message = 'Syncing account…';
    renderPanels();
    var bits = [];
    try {
      try {
        await refreshStatus();
        if (st().connected) {
          ui.message = 'Syncing WHOOP…';
          renderPanels();
          await sync({ quiet: true });
          bits.push('WHOOP');
        } else {
          bits.push('WHOOP (sign-in only — connect when ready)');
        }
      } catch (err) {
        bits.push('WHOOP: ' + ((err && err.message) || 'failed'));
      }

      if (global.StrengthSync && typeof global.StrengthSync.reconcile === 'function' && global.S) {
        try {
          ui.message = 'Syncing strength…';
          renderPanels();
          global.S = await global.StrengthSync.reconcile(global.S);
          if (typeof global.save === 'function') global.save('strength-sync');
          var ss = global.StrengthSync.getStatus ? global.StrengthSync.getStatus() : null;
          if (ss && ss.lastError) bits.push('Strength: ' + ss.lastError);
          else bits.push('Strength');
        } catch (err) {
          bits.push('Strength: ' + ((err && err.message) || 'failed'));
        }
      } else if (!global.S) {
        bits.push('Strength: app state not ready');
      }

      if (global.NutritionSync && typeof global.NutritionSync.reconcile === 'function') {
        try {
          var local =
            (global.NutritionUI && typeof global.NutritionUI.load === 'function' && global.NutritionUI.load()) ||
            null;
          if (local) {
            ui.message = 'Syncing nutrition…';
            renderPanels();
            var merged = await global.NutritionSync.reconcile(local);
            if (global.NutritionUI && typeof global.NutritionUI.replace === 'function') {
              global.NutritionUI.replace(merged);
            }
            var ns = global.NutritionSync.getStatus ? global.NutritionSync.getStatus() : null;
            if (ns && ns.lastError) bits.push('Nutrition: ' + ns.lastError);
            else bits.push('Nutrition');
          } else {
            bits.push('Nutrition (open Nutrition once to enable)');
          }
        } catch (err) {
          bits.push('Nutrition: ' + ((err && err.message) || 'failed'));
        }
      }

      if (global.CoachSync && typeof global.CoachSync.schedulePull === 'function' && global.S) {
        try {
          ui.message = 'Syncing coach…';
          renderPanels();
          global.CoachSync.schedulePull(global.S);
          bits.push('Coach');
        } catch (err) {
          bits.push('Coach: ' + ((err && err.message) || 'failed'));
        }
      }

      if (global.Concept2 && typeof global.Concept2.syncIfLinked === 'function') {
        try {
          ui.message = 'Syncing Concept2…';
          renderPanels();
          var c2 = await global.Concept2.syncIfLinked();
          if (c2 && c2.ok) {
            bits.push(c2.summary ? 'Concept2 (' + c2.summary + ')' : 'Concept2');
          } else if (c2 && c2.reason === 'not_linked') {
            bits.push('Concept2 (not linked)');
          } else if (c2 && c2.reason === 'auth_required') {
            bits.push('Concept2 (sign-in required)');
          } else {
            bits.push('Concept2: ' + ((c2 && c2.message) || 'failed'));
          }
        } catch (err) {
          bits.push('Concept2: ' + ((err && err.message) || 'failed'));
        }
      }

      ui.message = 'Synced: ' + bits.join(' · ');
      ui.busy = false;
      refreshVisibleUi();
    } catch (err) {
      ui.message = (err && err.message) || 'Sync failed';
    } finally {
      ui.busy = false;
      renderPanels();
    }
  }
  async function signIn() {
    const em = ((document.getElementById('whoopEmail') && document.getElementById('whoopEmail').value) || '').trim();
    const pw = (document.getElementById('whoopPassword') && document.getElementById('whoopPassword').value) || '';
    if (!em || !pw) { global.alert('Enter the same email + password you use on THE Hybrid Engine'); return; }
    ui.busy = true; ui.message = 'Signing in…'; renderPanels();
    try {
      const { error } = await client().auth.signInWithPassword({ email: em, password: pw });
      if (error) throw error;
      st().email = em;
      if (typeof global.save === 'function') global.save();
      ui.busy = false;
      await syncAll();
    } catch (err) {
      ui.message = err.message || 'Sign-in failed';
      ui.busy = false;
      renderPanels();
    }
  }
  async function signOut() {
    try { await client().auth.signOut(); } catch (_) {}
    st().email = null;
    if (typeof global.save === 'function') global.save();
    ui.message = 'Signed out';
    renderPanels();
  }
  async function autoSyncIfPossible() {
    try {
      if (!(await token())) return;
      st().email = await email();
      await refreshStatus();
      renderPanels();
      if (!st().connected) return;
      const last = st().lastSyncAt ? Date.parse(st().lastSyncAt) : 0;
      // Status already applied last normalized sample; only hit WHOOP every 5 min.
      if (last && Number.isFinite(last) && Date.now() - last < 5 * 60 * 1000) return;
      await sync();
    } catch (_) {}
  }
  (async function hydrate() {
    try {
      const em = await email();
      if (em) { st().email = em; if (typeof global.save === 'function') global.save(); }
    } catch (_) {}
  })();

  global.Whoop = {
    cardHtml, metaLine, renderPanels, autoSyncIfPossible,
    signIn, signOut, connect, sync, syncAll, disconnect, refreshStatus,
    client, token, email
  };
})(window);
