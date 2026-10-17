/**
 * Coach cloud publish — assigned_session rows on shared Supabase.
 * Local bridge still runs; this is the APK path when coach + athlete are signed in.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CoachCloud = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const status = {
    lastPushAt: null,
    lastError: '',
    lastOk: false,
    lastCount: 0,
    lastAthleteName: '',
    lastErrors: [],
  };

  function client() {
    if (typeof Whoop !== 'undefined' && Whoop.client) return Whoop.client();
    throw new Error('Supabase client unavailable — sign in on coach (same account as athlete sync).');
  }

  async function sessionUserId() {
    const data = await client().auth.getSession();
    if (data.error) throw data.error;
    return (data.data.session && data.data.session.user && data.data.session.user.id) || null;
  }

  async function isSignedIn() {
    try {
      return !!(await sessionUserId());
    } catch (_) {
      return false;
    }
  }

  function uuid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function timezone() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch (_) {
      return 'UTC';
    }
  }

  function athleteCloudId(athlete) {
    if (!athlete) return null;
    return athlete.cloudUserId || athlete.authUserId || null;
  }

  function nutritionPayloadHasContent(payload) {
    if (!payload) return false;
    if (payload.mealDay) return true;
    if ((payload.mealDays || []).length) return true;
    const t = payload.targets;
    if (t) {
      const n = (v) => Number(v) || 0;
      if (n(t.calories) > 0 || n(t.proteinG) > 0 || n(t.carbsG) > 0 || n(t.fatG) > 0) return true;
    }
    return false;
  }

  function nutritionSnapshot(state, athleteId, sessionDate) {
    const N = typeof globalThis !== 'undefined' ? globalThis.CoachNutrition : null;
    const L = typeof globalThis !== 'undefined' ? globalThis.CoachLoop : null;
    if (!N || !athleteId) return null;
    try {
      const nut = N.ensureNutrition(state);
      const date = sessionDate || (L && L.today ? L.today() : new Date().toISOString().slice(0, 10));
      const payload = N.athleteNutritionPayload(nut, athleteId, date);
      payload.mealDays = (nut.mealDays || [])
        .filter((d) => d.athleteId === athleteId && d.published)
        .map((d) => JSON.parse(JSON.stringify(d)));
      payload.targets = nut.targetsByAthlete[athleteId]
        ? JSON.parse(JSON.stringify(nut.targetsByAthlete[athleteId]))
        : null;
      return nutritionPayloadHasContent(payload) ? payload : null;
    } catch (_) {
      return null;
    }
  }

  function sessionForCloud(session, Bridge) {
    const email = session.bridgeAthleteEmail || '';
    const B = Bridge || (typeof globalThis !== 'undefined' && globalThis.CoachBridge);
    return B
      ? B.sessionForAthlete(session, email)
      : {
          id: 'coach-bridge-' + session.id,
          coachSessionId: session.id,
          templateId: session.templateId,
          name: session.name,
          sessionTitle: session.sessionTitle || session.name,
          date: session.date,
          status: 'scheduled',
          coachInstructions: session.coachInstructions || '',
          blocks: session.blocks || [],
          source: 'coach-bridge',
          published: true,
        };
  }

  async function upsertAssigned(row) {
    const sb = client();
    const existing = await sb
      .from('assigned_session')
      .select('id,state')
      .eq('athlete_id', row.athlete_id)
      .eq('coach_session_key', row.coach_session_key)
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data && existing.data.id) {
      const patch = {
        state: row.state,
        scheduled_date: row.scheduled_date,
        timezone: row.timezone,
        coach_session_key: row.coach_session_key,
      };
      if (row.resolved_snapshot) {
        patch.resolved_snapshot = row.resolved_snapshot;
        patch.published_at = row.published_at;
      }
      const upd = await sb.from('assigned_session').update(patch).eq('id', existing.data.id);
      if (upd.error) throw upd.error;
      return existing.data.id;
    }
    const ins = await sb.from('assigned_session').insert(row).select('id').single();
    if (ins.error) throw ins.error;
    return ins.data && ins.data.id;
  }

  async function pushPublished(state, opts) {
    opts = opts || {};
    const Bridge = typeof globalThis !== 'undefined' ? globalThis.CoachBridge : null;
    if (!(await isSignedIn())) {
      status.lastError = 'auth_required';
      status.lastOk = false;
      status.lastErrors = [{ error: 'auth_required' }];
      return { ok: false, reason: 'auth_required' };
    }

    const sessions = (state.sessions || []).filter((s) => {
      if (opts.sessionIds && opts.sessionIds.length) return opts.sessionIds.indexOf(s.id) >= 0;
      return !!s.published;
    });

    let pushed = 0;
    const errors = [];
    let lastAthlete = null;
    for (const session of sessions) {
      const athlete = (state.athletes || []).find((a) => a.id === session.athleteId);
      const cloudId = athleteCloudId(athlete);
      lastAthlete = athlete;
      if (!cloudId) {
        errors.push({ sessionId: session.id, error: 'athlete missing cloudUserId' });
        continue;
      }
      if (!session.cloudAssignedId) session.cloudAssignedId = uuid();
      const htmlSession = sessionForCloud(session, Bridge);
      const nutrition = nutritionSnapshot(state, athlete.id, session.date);
      const row = {
        id: session.cloudAssignedId,
        athlete_id: cloudId,
        source_session_id: null,
        scheduled_date: session.date,
        state: session.published ? 'published' : 'unpublished',
        published_at: session.publishedAt || new Date().toISOString(),
        resolved_snapshot: {
          v: 1,
          writer: 'html-coach',
          coachSessionId: session.id,
          htmlSession: htmlSession,
          nutrition: nutrition || undefined,
        },
        timezone: timezone(),
        coach_session_key: session.id,
      };
      try {
        await upsertAssigned(row);
        pushed++;
      } catch (e) {
        errors.push({ sessionId: session.id, error: String(e.message || e) });
      }
    }

    status.lastPushAt = new Date().toISOString();
    status.lastCount = pushed;
    status.lastOk = errors.length === 0;
    status.lastError = errors.length ? errors[0].error : '';
    status.lastErrors = errors;
    status.lastAthleteName = (lastAthlete && lastAthlete.name) || '';
    return { ok: errors.length === 0, pushed: pushed, errors: errors };
  }

  async function unpublishSession(state, session) {
    if (!session || !session.cloudAssignedId) return { ok: true, skipped: true };
    if (!(await isSignedIn())) return { ok: false, reason: 'auth_required' };
    const sb = client();
    const res = await sb
      .from('assigned_session')
      .update({ state: 'unpublished' })
      .eq('id', session.cloudAssignedId);
    if (res.error) return { ok: false, error: res.error.message };
    session.published = false;
    return { ok: true };
  }

  async function markCompleted(cloudAssignedId) {
    if (!cloudAssignedId) return { ok: true, skipped: true };
    if (!(await isSignedIn())) return { ok: false, reason: 'auth_required' };
    const uid = await sessionUserId();
    const sb = client();
    const res = await sb
      .from('assigned_session')
      .update({ state: 'completed' })
      .eq('id', cloudAssignedId)
      .eq('athlete_id', uid);
    if (res.error) return { ok: false, error: res.error.message };
    return { ok: true };
  }

  async function refreshPublishedStates(state) {
    if (!(await isSignedIn())) return { ok: false, reason: 'auth_required', updated: 0 };
    const ids = (state.sessions || []).filter((s) => s.cloudAssignedId).map((s) => s.cloudAssignedId);
    if (!ids.length) return { ok: true, updated: 0 };
    const sb = client();
    const res = await sb.from('assigned_session').select('id,state,coach_session_key').in('id', ids);
    if (res.error) throw res.error;
    let updated = 0;
    for (const row of res.data || []) {
      const session = (state.sessions || []).find((s) => s.cloudAssignedId === row.id);
      if (!session) continue;
      if (row.state === 'completed' && session.status !== 'active') {
        session.status = 'completed';
        updated++;
      }
    }
    return { ok: true, updated: updated };
  }

  /** Athlete: pull published assigned_session rows for auth user. */
  async function pullForAthlete(state, opts) {
    opts = opts || {};
    if (!(await isSignedIn())) return { ok: false, reason: 'auth_required', merged: 0, withdrawn: 0 };
    const uid = await sessionUserId();
    const sb = client();
    const res = await sb
      .from('assigned_session')
      .select('id,scheduled_date,state,resolved_snapshot,coach_session_key,published_at')
      .eq('athlete_id', uid)
      .eq('state', 'published');
    if (res.error) throw res.error;

    const unpub = await sb
      .from('assigned_session')
      .select('id,coach_session_key,state')
      .eq('athlete_id', uid)
      .eq('state', 'unpublished');

    const Sync = typeof globalThis !== 'undefined' ? globalThis.CoachSync : null;
    let merged = 0;
    let withdrawn = 0;
    let nutritionApplied = false;

    for (const row of res.data || []) {
      const snap = row.resolved_snapshot || {};
      const incoming = snap.htmlSession;
      if (!incoming) continue;
      incoming.coachSessionId = incoming.coachSessionId || snap.coachSessionId || row.coach_session_key;
      incoming.cloudAssignedId = row.id;
      incoming.source = incoming.source || 'coach-bridge';
      incoming.coachWithdrawn = false;
      if (row.scheduled_date) incoming.date = row.scheduled_date;
      if (snap.nutrition && Sync && Sync.mergeNutritionFromSnapshot) {
        Sync.mergeNutritionFromSnapshot(snap.nutrition);
        nutritionApplied = true;
      }
      if (Sync && typeof Sync.mergeSession === 'function') {
        if (Sync.mergeSession(state, incoming)) merged++;
      } else {
        state.sessions = state.sessions || [];
        const idx = state.sessions.findIndex(
          (s) => s.coachSessionId === incoming.coachSessionId || s.id === incoming.id,
        );
        if (idx >= 0) {
          if (state.sessions[idx].status === 'active' || state.sessions[idx].status === 'completed') continue;
          state.sessions[idx] = Object.assign({}, incoming, { id: state.sessions[idx].id });
          merged++;
        } else {
          state.sessions.push(incoming);
          merged++;
        }
      }
    }

    if (!unpub.error) {
      for (const row of unpub.data || []) {
        if (Sync && Sync.markWithdrawn) {
          if (Sync.markWithdrawn(state, row.coach_session_key)) withdrawn++;
        }
      }
    }

    return {
      ok: true,
      merged: merged,
      withdrawn: withdrawn,
      nutritionApplied: nutritionApplied,
      rows: (res.data || []).length,
    };
  }

  function deliverySummary() {
    if (!status.lastPushAt) return 'Not pushed yet';
    const when = new Date(status.lastPushAt).toLocaleString();
    if (status.lastOk) {
      return (
        'Delivered ' +
        status.lastCount +
        ' session(s)' +
        (status.lastAthleteName ? ' · ' + status.lastAthleteName : '') +
        ' · ' +
        when
      );
    }
    return 'Push issue · ' + (status.lastError || 'unknown') + ' · ' + when;
  }

  return {
    pushPublished: pushPublished,
    unpublishSession: unpublishSession,
    pullForAthlete: pullForAthlete,
    markCompleted: markCompleted,
    refreshPublishedStates: refreshPublishedStates,
    isSignedIn: isSignedIn,
    sessionUserId: sessionUserId,
    athleteCloudId: athleteCloudId,
    nutritionSnapshot: nutritionSnapshot,
    deliverySummary: deliverySummary,
    status: status,
    uuid: uuid,
  };
});
