/**
 * Strength Side plan sync — Library templates + calendar/logger sessions.
 * Domain `strength_side` is the copy The Brain can pull later.
 * Uses existing upsert_athlete_domain_snapshot (no new table in this repo).
 * WHOOP/Concept2 stay on their own buttons — this is not that path.
 */
(function (root) {
  const DOMAIN = 'strength_side';
  const WRITER = 'strengthside-athlete';
  const SCHEMA = 1;
  const DEBOUNCE_MS = 2500;

  const status = {
    lastSyncAt: null,
    lastError: '',
    lastOk: false,
    busy: false,
    pending: false,
  };

  function clone(v) {
    return JSON.parse(JSON.stringify(v || null));
  }

  function bodyHash(entity) {
    const copy = clone(entity) || {};
    delete copy._meta;
    return JSON.stringify(copy);
  }

  function touch(entity, prev) {
    const next = clone(entity) || {};
    const fp = bodyHash(next);
    const prevMeta = (prev && prev._meta) || next._meta || {};
    const prevFp = prevMeta.bodyFp;
    let rev = Number(prevMeta.rev) || 0;
    if (prevFp !== fp) rev += 1;
    if (rev < 1) rev = 1;
    next._meta = {
      localId: next.id,
      rev,
      bodyFp: fp,
      updatedAt: prevFp === fp && prevMeta.updatedAt ? prevMeta.updatedAt : new Date().toISOString(),
    };
    return next;
  }

  function prevIndex(lastPlan) {
    const idx = { template: {}, session: {} };
    (lastPlan && lastPlan.templates || []).forEach((t) => { idx.template[t.id] = t; });
    (lastPlan && lastPlan.sessions || []).forEach((t) => { idx.session[t.id] = t; });
    return idx;
  }

  function pack(state) {
    const lib = (state && state.library) || { templates: [], catalog: { exercises: [], circuits: [] }, assignments: {} };
    const prev = prevIndex(state && state.planSync && state.planSync.lastPlan);
    const templates = (lib.templates || []).map((t) => touch(t, prev.template[t.id]));
    const sessions = [];
    const assignments = lib.assignments && typeof lib.assignments === 'object' ? lib.assignments : {};
    for (const date of Object.keys(assignments)) {
      const id = 'asg_' + date;
      sessions.push(touch({ id, date, kind: 'assignment', templateId: assignments[date] }, prev.session[id]));
    }
    const logs = (state && state.sessions) || {};
    for (const date of Object.keys(logs)) {
      if (!logs[date]) continue;
      const id = 'log_' + date;
      sessions.push(touch({ id, date, kind: 'log', payload: logs[date] }, prev.session[id]));
    }
    const catalogId = 'catalog';
    const catalogEnt = touch({
      id: catalogId,
      kind: 'catalog',
      exercises: (lib.catalog && lib.catalog.exercises) || [],
      circuits: (lib.catalog && lib.catalog.circuits) || [],
    }, prev.session[catalogId]);
    sessions.push(catalogEnt);

    const prevTpls = new Set(Object.keys(prev.template));
    const liveTpls = new Set(templates.map((t) => t.id));
    const tombstones = clone((state && state.planSync && state.planSync.lastPlan && state.planSync.lastPlan.tombstones) || []) || [];
    for (const id of prevTpls) {
      if (!liveTpls.has(id) && !tombstones.some((t) => t.id === id && t.kind === 'template')) {
        const rev = ((prev.template[id]._meta && prev.template[id]._meta.rev) || 0) + 1;
        tombstones.push({ id, kind: 'template', rev });
      }
    }
    const still = tombstones.filter((t) => t.kind !== 'template' || !liveTpls.has(t.id));

    return {
      domain: DOMAIN,
      schemaVersion: SCHEMA,
      templates,
      sessions,
      tombstones: still,
    };
  }

  function mergeLists(kind, localList, remoteList, tombs, acks) {
    const tombFor = {};
    (tombs || []).filter((t) => t.kind === kind).forEach((t) => { tombFor[t.id] = t; });
    const local = {};
    (localList || []).forEach((e) => { local[e.id] = e; });
    const remote = {};
    (remoteList || []).forEach((e) => { remote[e.id] = e; });
    const ids = new Set([...Object.keys(local), ...Object.keys(remote), ...Object.keys(tombFor)]);
    const out = [];
    const conflicts = [];
    const ackMap = (acks && acks[kind]) || {};
    for (const id of ids) {
      const tomb = tombFor[id];
      const L = local[id];
      const R = remote[id];
      const lrev = L && L._meta ? Number(L._meta.rev) || 0 : 0;
      const rrev = R && R._meta ? Number(R._meta.rev) || 0 : 0;
      const ack = Number(ackMap[id]) || 0;
      if (tomb) {
        const trev = Number(tomb.rev) || 0;
        if ((!L || lrev <= trev) && (!R || rrev <= trev)) continue;
        if (L && lrev > trev) continue;
      }
      if (L && R) {
        if (bodyHash(L) === bodyHash(R)) {
          out.push(lrev >= rrev ? L : R);
          continue;
        }
        if (lrev > ack && rrev > ack) {
          conflicts.push({ id, kind, local: L, remote: R });
          out.push(L);
          continue;
        }
        out.push(lrev >= rrev ? L : R);
        continue;
      }
      if (L) out.push(L);
      else if (R) out.push(R);
    }
    return { list: out, conflicts };
  }

  function mergePlan(local, remote, acks) {
    const tombs = [].concat((local && local.tombstones) || [], (remote && remote.tombstones) || []);
    const byKey = {};
    tombs.forEach((t) => {
      const k = t.kind + ':' + t.id;
      if (!byKey[k] || (Number(t.rev) || 0) > (Number(byKey[k].rev) || 0)) byKey[k] = t;
    });
    const tombstones = Object.values(byKey);
    const t = mergeLists('template', local.templates, remote.templates, tombstones, acks);
    const s = mergeLists('session', local.sessions, remote.sessions, tombstones, acks);
    return {
      plan: {
        domain: DOMAIN,
        schemaVersion: SCHEMA,
        templates: t.list,
        sessions: s.list,
        tombstones,
      },
      conflicts: t.conflicts.concat(s.conflicts),
    };
  }

  function applyPlan(state, plan) {
    const next = state || {};
    const assignments = {};
    const sessions = {};
    let catalog = (next.library && next.library.catalog) || { exercises: [], circuits: [] };
    (plan.sessions || []).forEach((row) => {
      if (row.kind === 'assignment' && row.date) assignments[row.date] = row.templateId;
      else if (row.kind === 'log' && row.date) sessions[row.date] = row.payload;
      else if (row.kind === 'catalog') catalog = { exercises: row.exercises || [], circuits: row.circuits || [] };
    });
    next.library = {
      templates: plan.templates || [],
      catalog,
      assignments,
    };
    next.sessions = sessions;
    next.planSync = next.planSync || { acks: { template: {}, session: {} }, snapshotRev: 0 };
    next.planSync.lastPlan = plan;
    return next;
  }

  function ackFrom(plan) {
    const acks = { template: {}, session: {} };
    (plan.templates || []).forEach((t) => { acks.template[t.id] = (t._meta && t._meta.rev) || 0; });
    (plan.sessions || []).forEach((t) => { acks.session[t.id] = (t._meta && t._meta.rev) || 0; });
    return acks;
  }

  async function pushWithIo(plan, revision, io) {
    const uid = await io.userId();
    if (!uid) return { ok: false, reason: 'auth_required' };
    const result = await io.push(revision, plan);
    if (!result || result.wrote === false) {
      return { ok: false, reason: 'STALE_REV', remoteRev: result && result.revision };
    }
    return { ok: true, revision: result.revision };
  }

  function defaultIo() {
    function sb() {
      if (root.Whoop && typeof root.Whoop.client === 'function') return root.Whoop.client();
      throw new Error('Sign in to copy training');
    }
    return {
      async userId() {
        try {
          const { data, error } = await sb().auth.getSession();
          if (error) throw error;
          return (data.session && data.session.user && data.session.user.id) || null;
        } catch {
          return null;
        }
      },
      async pull() {
        const uid = await this.userId();
        if (!uid) return null;
        const { data, error } = await sb()
          .from('athlete_domain_snapshots')
          .select('revision,snapshot')
          .eq('user_id', uid)
          .eq('domain', DOMAIN)
          .maybeSingle();
        if (error) throw error;
        if (!data) return null;
        return { revision: Math.max(0, Number(data.revision) || 0), snapshot: data.snapshot };
      },
      async push(revision, plan) {
        const { data: wrote, error } = await sb().rpc('upsert_athlete_domain_snapshot', {
          p_domain: DOMAIN,
          p_schema_version: SCHEMA,
          p_revision: revision,
          p_writer: WRITER,
          p_client_updated_at: new Date().toISOString(),
          p_snapshot: plan,
        });
        if (error) throw error;
        return { wrote: wrote !== false, revision };
      },
    };
  }

  function setStatus(patch) {
    Object.assign(status, patch || {});
  }

  function getStatus() {
    return { ...status };
  }

  function readState() {
    return root.S || {};
  }

  function writeState(next) {
    root.S = next;
    if (typeof root.save === 'function') {
      root.__planSyncWriting = true;
      try { root.save(); } finally { root.__planSyncWriting = false; }
    }
  }

  async function syncNow(opts) {
    const io = (opts && opts.io) || defaultIo();
    const onConflict = (opts && opts.onConflict) || function defaultConflict() {
      return 'local';
    };
    setStatus({ busy: true, lastError: '' });
    try {
      const uid = await io.userId();
      if (!uid) {
        setStatus({ busy: false, lastError: 'auth_required' });
        return { ok: false, reason: 'auth_required' };
      }
      let state = readState();
      let local = pack(state);
      const remoteWrap = await io.pull();
      let snapshotRev = (state.planSync && state.planSync.snapshotRev) || 0;
      let plan = local;
      let conflicts = [];
      if (remoteWrap && remoteWrap.snapshot) {
        snapshotRev = Math.max(snapshotRev, Number(remoteWrap.revision) || 0);
        const merged = mergePlan(local, remoteWrap.snapshot, (state.planSync && state.planSync.acks) || { template: {}, session: {} });
        plan = merged.plan;
        conflicts = merged.conflicts;
        if (conflicts.length) {
          const choice = onConflict(conflicts);
          if (choice === 'remote') plan = remoteWrap.snapshot;
        }
        state = applyPlan(state, plan);
        writeState(state);
      }
      const nextRev = snapshotRev + 1;
      const packed = pack(state);
      const pushed = await pushWithIo(packed, nextRev, io);
      if (!pushed.ok) {
        setStatus({ busy: false, lastOk: false, lastError: pushed.reason || 'push failed' });
        return pushed;
      }
      state = readState();
      state.planSync = state.planSync || {};
      state.planSync.snapshotRev = pushed.revision;
      state.planSync.acks = ackFrom(packed);
      state.planSync.lastPlan = packed;
      writeState(state);
      setStatus({ busy: false, lastOk: true, lastSyncAt: new Date().toISOString(), lastError: '', pending: false });
      return { ok: true, revision: pushed.revision, conflicts };
    } catch (err) {
      const msg = (err && err.message) || 'sync failed';
      setStatus({ busy: false, lastOk: false, lastError: msg });
      return { ok: false, reason: msg };
    }
  }

  let timer = null;
  function schedulePush() {
    if (root.__planSyncWriting) return;
    status.pending = true;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      syncNow().catch(() => {});
    }, DEBOUNCE_MS);
  }

  const PlanSync = {
    DOMAIN,
    WRITER,
    pack,
    mergePlan,
    applyPlan,
    pushWithIo,
    syncNow,
    schedulePush,
    getStatus,
    statusLine() {
      if (status.busy) return 'Copying training…';
      if (status.lastError === 'auth_required') return 'Sign in to copy training across phones.';
      if (status.lastError === 'STALE_REV') return 'Another phone changed training — will retry.';
      if (status.lastError) return 'Training copy failed.';
      if (status.lastSyncAt) return 'Training last copied ' + String(status.lastSyncAt).replace('T', ' ').slice(0, 16);
      return 'Training lives on this phone until you copy it.';
    },
  };

  root.PlanSync = PlanSync;
})(typeof window !== 'undefined' ? window : globalThis);
