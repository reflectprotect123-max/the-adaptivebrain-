/**
 * Coach lift memory. Working max is e1RM. LAST is the last working load.
 * Warm-up and cool-down never write either. Math matches packages/brain estimateE1rmKg.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CoachLifts = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function memoryKey(name) {
    return String(name || '').trim().toLowerCase();
  }

  function estimateE1rmKg(loadKg, reps) {
    const w = Number(loadKg);
    const r = Number(reps);
    if (!w || !r || w <= 0 || r < 1) return 0;
    const effective = Math.min(20, r);
    return Math.round(w * (1 + effective / 30) * 10) / 10;
  }

  function isPrep(event) {
    const role = event && event.role;
    const section = event && (event.section || event.category);
    return role === 'warmup' || role === 'cooldown' || section === 'Warm-Up' || section === 'Cool-Down';
  }

  function blank() {
    return {
      key: '',
      exerciseId: '',
      name: '',
      lastKg: null,
      lastReps: null,
      lastEffort: null,
      lastMiss: false,
      e1rmKg: 0,
      lastPct: null,
      source: null,
      formula: 'epley',
    };
  }

  function bucket(memory, athleteId) {
    const next = memory && typeof memory === 'object' ? memory : {};
    if (!next[athleteId]) next[athleteId] = {};
    return next;
  }

  function read(memory, athleteId, name) {
    const key = memoryKey(name);
    const row = memory && memory[athleteId] && memory[athleteId][key];
    return row ? { ...row } : null;
  }

  function listFor(memory, athleteId) {
    const rows = (memory && memory[athleteId]) || {};
    return Object.keys(rows)
      .map((key) => rows[key])
      .filter((row) => row && (row.e1rmKg > 0 || row.lastKg != null))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }

  function remember(memory, event) {
    const athleteId = event && event.athleteId;
    const name = event && event.name;
    if (!athleteId || !memoryKey(name)) return memory || {};
    if (isPrep(event)) return memory || {};
    const store = bucket(memory, athleteId);
    const key = memoryKey(name);
    const prev = store[athleteId][key] || blank();
    const loadKg = Number(event.loadKg);
    const reps = event.reps != null && event.reps !== '' ? Number(event.reps) : null;
    const miss = !!event.miss;
    const next = {
      ...prev,
      key,
      exerciseId: event.exerciseId || prev.exerciseId || '',
      name: String(name).trim(),
      lastKg: Number.isFinite(loadKg) ? loadKg : prev.lastKg,
      lastReps: reps,
      lastEffort: event.effort ? String(event.effort).toLowerCase() : null,
      lastMiss: miss,
      formula: 'epley',
    };
    if (!miss && Number.isFinite(loadKg) && loadKg > 0 && reps >= 1) {
      const est = estimateE1rmKg(loadKg, reps);
      next.e1rmKg = Math.max(Number(next.e1rmKg) || 0, est);
      if (next.e1rmKg > 0) next.lastPct = Math.round((loadKg / next.e1rmKg) * 1000) / 10;
      if (next.e1rmKg > (Number(prev.e1rmKg) || 0)) next.source = 'auto_estimate';
    }
    store[athleteId][key] = next;
    return store;
  }

  function setWorkingMax(memory, event) {
    const athleteId = event && event.athleteId;
    const name = event && event.name;
    const kg = Number(event && event.e1rmKg);
    if (!athleteId || !memoryKey(name) || !(kg > 0)) return memory || {};
    const store = bucket(memory, athleteId);
    const key = memoryKey(name);
    const prev = store[athleteId][key] || blank();
    store[athleteId][key] = {
      ...prev,
      key,
      exerciseId: event.exerciseId || prev.exerciseId || '',
      name: String(name).trim(),
      e1rmKg: Math.round(kg * 10) / 10,
      source: 'coach_set',
      formula: 'epley',
    };
    return store;
  }

  function ensureFromSessions(state) {
    if (!state) return state;
    state.liftMemory = state.liftMemory || {};
    if (Object.keys(state.liftMemory).length) return state;
    for (const session of state.sessions || []) {
      const athleteId = session && session.athleteId;
      if (!athleteId) continue;
      for (const block of session.blocks || []) {
        for (const ex of block.exercises || []) {
          for (const row of ex.rows || []) {
            if (!row || !row.done) continue;
            const load = Number(row.weight);
            if (!(load > 0)) continue;
            state.liftMemory = remember(state.liftMemory, {
              athleteId,
              exerciseId: ex.exerciseId,
              name: ex.name,
              loadKg: load,
              reps: row.reps,
              effort: row.effort || 'medium',
              miss: !!row.miss,
              role: block.role || '',
              section: block.category,
            });
          }
        }
      }
    }
    return state;
  }

  function rpcPayload(row, athleteCloudId) {
    return {
      p_athlete: athleteCloudId,
      p_exercise_key: row.key,
      p_exercise_id: row.exerciseId || '',
      p_name: row.name,
      p_load_kg: row.lastKg,
      p_reps: row.lastReps,
      p_effort: row.lastEffort,
      p_miss: !!row.lastMiss,
      p_role: '',
    };
  }

  async function pushRow(client, fn, args) {
    if (!client || typeof client.rpc !== 'function') return { ok: false, reason: 'offline' };
    const res = await client.rpc(fn, args);
    if (res && res.error) return { ok: false, reason: res.error.message || 'rpc' };
    return { ok: true, row: res && res.data };
  }

  function cloudClient() {
    try {
      if (typeof Whoop !== 'undefined' && Whoop.client) return Whoop.client();
    } catch (e) { /* unsigned */ }
    return null;
  }

  function athleteCloudId(state, athleteId) {
    const athlete = ((state && state.athletes) || []).find((a) => a && a.id === athleteId);
    return (athlete && (athlete.cloudUserId || athlete.authUserId)) || null;
  }

  function syncRemember(state, athleteId, name) {
    const row = read(state && state.liftMemory, athleteId, name);
    const cloudId = athleteCloudId(state, athleteId);
    const client = cloudClient();
    if (!row || !cloudId || !client) return Promise.resolve({ ok: false, reason: 'local' });
    return pushRow(client, 'remember_coach_lift', rpcPayload(row, cloudId));
  }

  function syncWorkingMax(state, athleteId, name) {
    const row = read(state && state.liftMemory, athleteId, name);
    const cloudId = athleteCloudId(state, athleteId);
    const client = cloudClient();
    if (!row || !cloudId || !client) return Promise.resolve({ ok: false, reason: 'local' });
    return pushRow(client, 'set_coach_working_max', {
      p_athlete: cloudId,
      p_exercise_key: row.key,
      p_exercise_id: row.exerciseId || '',
      p_name: row.name,
      p_e1rm_kg: row.e1rmKg,
    });
  }

  return {
    memoryKey,
    estimateE1rmKg,
    isPrep,
    read,
    listFor,
    remember,
    setWorkingMax,
    ensureFromSessions,
    rpcPayload,
    pushRow,
    syncRemember,
    syncWorkingMax,
  };
});
