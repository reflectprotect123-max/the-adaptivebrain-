/**
 * Athlete-side pull from THE-coach-bridge-v1 (local) + assigned_session (cloud).
 * Merges coach-published sessions into athlete calendar state.
 */
(function (global) {
  'use strict';

  var BRIDGE_KEY = 'THE-coach-bridge-v1';
  var NUTRITION_KEY = 'hybrid-coach-nutrition-bridge-v1';
  var status = {
    lastPullAt: null,
    lastCloudAt: null,
    lastAutoPullAt: null,
    lastCount: 0,
    lastCloud: 0,
    lastTotalMerged: 0,
    lastError: '',
    autoSyncEnabled: true,
  };
  var cloudPullTimer = null;
  var lastCloudPullMs = 0;
  var CLOUD_PULL_MIN_MS = 45000;
  var mergeCallback = null;

  function isCoachPrescription(s) {
    if (!s) return false;
    if (s.source === 'coach-bridge') return true;
    if (s.coachSessionId) return true;
    return false;
  }

  function setMergeCallback(fn) {
    mergeCallback = typeof fn === 'function' ? fn : null;
  }

  function notifyMerge(info) {
    if (mergeCallback) mergeCallback(info || {});
  }

  function readBridge() {
    try {
      var raw = localStorage.getItem(BRIDGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function pickBucket(payload, email) {
    if (!payload || !payload.athletes) return null;
    if (!email) return null;
    email = String(email).toLowerCase();
    return (
      payload.athletes.find(function (a) {
        return String(a.email || '').toLowerCase() === email;
      }) || null
    );
  }

  function mergeSession(state, incoming) {
    if (!incoming || !incoming.coachSessionId) return false;
    if (incoming.coachWithdrawn) {
      return markWithdrawn(state, incoming.coachSessionId);
    }
    var sessions = state.sessions || (state.sessions = []);
    var idx = sessions.findIndex(function (s) {
      return (
        s.coachSessionId === incoming.coachSessionId ||
        s.id === incoming.id ||
        (s.cloudAssignedId && incoming.cloudAssignedId && s.cloudAssignedId === incoming.cloudAssignedId)
      );
    });
    if (idx >= 0) {
      var cur = sessions[idx];
      if (cur.status === 'active' || cur.status === 'completed') {
        if (incoming.status === 'completed' && cur.status !== 'completed') {
          sessions[idx] = Object.assign({}, incoming, { id: cur.id, coachSessionId: incoming.coachSessionId });
          return true;
        }
        return false;
      }
      incoming.coachWithdrawn = false;
      sessions[idx] = Object.assign({}, incoming, { id: cur.id });
      return true;
    }
    incoming.coachWithdrawn = false;
    sessions.push(incoming);
    return true;
  }

  function markWithdrawn(state, coachSessionId) {
    if (!coachSessionId) return false;
    var sessions = state.sessions || [];
    var idx = sessions.findIndex(function (s) {
      return s.coachSessionId === coachSessionId || s.id === coachSessionId;
    });
    if (idx < 0) return false;
    var cur = sessions[idx];
    if (cur.status === 'active' || cur.status === 'completed') return false;
    cur.coachWithdrawn = true;
    cur.coachPrescription = isCoachPrescription(cur);
    return true;
  }

  function applyCloudCompletion(state, row) {
    if (!row || !row.id) return false;
    var sessions = state.sessions || [];
    var idx = sessions.findIndex(function (s) {
      return s.cloudAssignedId === row.id || s.coachSessionId === row.coach_session_key;
    });
    if (idx < 0) return false;
    var cur = sessions[idx];
    if (row.state === 'completed' && cur.status !== 'active') {
      cur.status = 'completed';
      cur.coachWithdrawn = false;
      return true;
    }
    return false;
  }

  function mergeNutrition(nutrition) {
    if (!nutrition) return;
    try {
      localStorage.setItem(NUTRITION_KEY, JSON.stringify(nutrition));
    } catch (_) {}
  }

  function mergeNutritionFromSnapshot(nutrition) {
    mergeNutrition(nutrition);
  }

  function athleteEmailFromState(state, opts) {
    opts = opts || {};
    if (opts.email) return String(opts.email).toLowerCase();
    var settings = state && state.settings;
    if (settings && settings.whoop && settings.whoop.email) {
      return String(settings.whoop.email).toLowerCase();
    }
    if (state && state.profile && state.profile.email) {
      return String(state.profile.email).toLowerCase();
    }
    return null;
  }

  function pullLocal(state, opts) {
    opts = opts || {};
    var payload = readBridge();
    if (!payload) return { ok: true, merged: 0 };
    var email = athleteEmailFromState(state, opts);
    if (!email) return { ok: true, merged: 0, reason: 'no_athlete_email' };
    var bucket = pickBucket(payload, email);
    if (!bucket) return { ok: true, merged: 0 };
    var merged = 0;
    (bucket.sessions || []).forEach(function (s) {
      if (mergeSession(state, s)) merged++;
    });
    mergeNutrition(bucket.nutrition);
    return { ok: true, merged: merged, bucket: bucket };
  }

  function pull(state, opts) {
    opts = opts || {};
    try {
      var local = pullLocal(state, opts);
      var merged = local.merged || 0;
      status.lastPullAt = new Date().toISOString();
      status.lastCount = merged;
      status.lastError = '';
      return { ok: true, merged: merged, bucket: local.bucket };
    } catch (e) {
      status.lastError = String(e.message || e);
      return { ok: false, error: status.lastError };
    }
  }

  async function pullCloud(state, opts) {
    opts = opts || {};
    if (!global.CoachCloud || !CoachCloud.pullForAthlete) return { ok: true, merged: 0, withdrawn: 0 };
    try {
      var r = await CoachCloud.pullForAthlete(state, opts);
      status.lastCloud = (r && r.merged) || 0;
      status.lastCloudAt = new Date().toISOString();
      if (opts.auto) status.lastAutoPullAt = status.lastCloudAt;
      status.lastError = r && r.error ? r.error : '';
      return r;
    } catch (e) {
      status.lastError = String(e.message || e);
      return { ok: false, error: status.lastError, merged: 0, withdrawn: 0 };
    }
  }

  async function pullAll(state, opts) {
    opts = opts || {};
    var local = pull(state, opts);
    if (!local.ok) return local;
    var localMerged = local.merged || 0;
    var cloudMerged = 0;
    var withdrawn = 0;
    if (global.CoachCloud && CoachCloud.pullForAthlete) {
      var cr = await pullCloud(state, opts);
      if (cr && cr.ok) {
        cloudMerged = cr.merged || 0;
        withdrawn = cr.withdrawn || 0;
      }
    }
    var total = localMerged + cloudMerged;
    status.lastTotalMerged = total;
    status.lastPullAt = new Date().toISOString();
    if (total > 0 || withdrawn > 0) {
      notifyMerge({ local: localMerged, cloud: cloudMerged, total: total, withdrawn: withdrawn });
    }
    return {
      ok: true,
      merged: localMerged,
      cloudMerged: cloudMerged,
      total: total,
      withdrawn: withdrawn,
    };
  }

  function scheduleCloudPull(state, opts) {
    opts = opts || {};
    if (!state || status.autoSyncEnabled === false) return;
    if (!global.CoachCloud || !CoachCloud.pullForAthlete) return;
    clearTimeout(cloudPullTimer);
    var delay = opts.immediate ? 0 : 800;
    cloudPullTimer = setTimeout(function () {
      var now = Date.now();
      if (!opts.force && now - lastCloudPullMs < CLOUD_PULL_MIN_MS) {
        var wait = CLOUD_PULL_MIN_MS - (now - lastCloudPullMs);
        setTimeout(function () {
          scheduleCloudPull(state, Object.assign({}, opts, { immediate: true, force: true }));
        }, wait);
        return;
      }
      lastCloudPullMs = now;
      pullAll(state, Object.assign({ auto: true }, opts)).then(function (r) {
        if (!r || !r.ok) return;
        if ((r.total || 0) > 0 || (r.withdrawn || 0) > 0) {
          if (typeof global.save === 'function') global.save('coach-sync-pull');
          if (typeof global.render === 'function' && !(global.S && global.S.tab === 'settings')) {
            global.render();
          }
        }
      });
    }, delay);
  }

  function schedulePull(state, opts) {
    if (!state) return;
    var r = pull(state, opts);
    if (r.ok && r.merged && typeof global.save === 'function') {
      global.save('coach-sync-pull');
      if (typeof global.render === 'function' && !(global.S && global.S.tab === 'settings')) {
        global.render();
      }
    }
    scheduleCloudPull(state, opts);
    return r;
  }

  function importPayload(payload, state, opts) {
    opts = opts || {};
    try {
      if (!payload || !payload.athletes) return { ok: false, error: 'invalid payload' };
      try {
        localStorage.setItem(BRIDGE_KEY, JSON.stringify(payload));
      } catch (_) {}
      return pull(state, opts);
    } catch (e) {
      return { ok: false, error: String(e.message || e) };
    }
  }

  function formatStatusLine() {
    var parts = [];
    if (status.lastPullAt) parts.push('Last check ' + new Date(status.lastPullAt).toLocaleString());
    if (status.lastAutoPullAt) parts.push('Auto ' + new Date(status.lastAutoPullAt).toLocaleString());
    return parts.join(' · ') || 'Not checked yet';
  }

  global.CoachSync = {
    pull: pull,
    pullCloud: pullCloud,
    pullAll: pullAll,
    schedulePull: schedulePull,
    scheduleCloudPull: scheduleCloudPull,
    readBridge: readBridge,
    importPayload: importPayload,
    mergeSession: mergeSession,
    markWithdrawn: markWithdrawn,
    applyCloudCompletion: applyCloudCompletion,
    mergeNutritionFromSnapshot: mergeNutritionFromSnapshot,
    isCoachPrescription: isCoachPrescription,
    setMergeCallback: setMergeCallback,
    formatStatusLine: formatStatusLine,
    status: status,
    BRIDGE_KEY: BRIDGE_KEY,
    NUTRITION_KEY: NUTRITION_KEY,
  };
})(typeof window !== 'undefined' ? window : globalThis);
