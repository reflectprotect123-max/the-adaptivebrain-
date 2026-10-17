/**
 * Coach → athlete local bridge (R10).
 * Writes published sessions + nutrition payload to shared localStorage.
 * Same-origin demo: coach.html and index.html on one device/browser.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CoachBridge = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const BRIDGE_KEY = 'THE-coach-bridge-v1';
  const BRIDGE_VERSION = 1;

  function clone(x) {
    return JSON.parse(JSON.stringify(x));
  }

  function uid(prefix) {
    return (prefix || 'id') + '_' + Math.random().toString(36).slice(2, 10);
  }

  /** Strip coach logging state; athlete rebuilds rows/tasks on start. */
  function blocksForAthlete(blocks) {
    const L = typeof globalThis !== 'undefined' ? globalThis.CoachLoop : null;
    return clone(blocks || []).map((b) => {
      const out = { ...b };
      delete out.complete;
      if (L && L.normalizeBlockType) L.normalizeBlockType(out);
      if (out.type === 'strength' || (out.exercises && out.exercises.length)) {
        out.exercises = (out.exercises || []).map((e) => {
          const ex = { ...e };
          delete ex.rows;
          delete ex.athleteNote;
          delete ex.swappedFrom;
          return ex;
        });
      }
      return out;
    });
  }

  function sessionForAthlete(session, email) {
    return {
      id: 'coach-bridge-' + session.id,
      coachSessionId: session.id,
      bridgeAthleteEmail: email,
      templateId: session.templateId,
      name: session.name,
      sessionTitle: session.sessionTitle || session.name,
      date: session.date,
      status: session.status === 'completed' ? 'completed' : 'scheduled',
      coachInstructions: session.coachInstructions || '',
      blocks: blocksForAthlete(session.blocks),
      timer: { elapsed: 0, on: false, last: null },
      taskIndex: 0,
      tasks: [],
      notes: session.notes || '',
      summary: session.summary || null,
      source: 'coach-bridge',
      published: true,
      completedAt: session.completedAt || null,
    };
  }

  function buildPayload(state, opts) {
    opts = opts || {};
    const g = typeof globalThis !== 'undefined' ? globalThis : {};
    const L = g.CoachLoop;
    const N = g.CoachNutrition;
    if (!L) throw new Error('CoachLoop required');
    const athletes = state.athletes || [];
    const buckets = athletes.map((a) => {
      const email = L.athleteAccountEmail(state, a.id) || a.id;
      const sessions = (state.sessions || [])
        .filter((s) => s.athleteId === a.id && s.published)
        .map((s) => sessionForAthlete(s, email));
      let nutrition = null;
      if (N) {
        const nut = N.ensureNutrition(state);
        const publishedSessions = (state.sessions || []).filter(
          (s) => s.athleteId === a.id && s.published,
        );
        const mealDates = (nut.mealDays || [])
          .filter((d) => d.athleteId === a.id && d.published)
          .map((d) => d.date)
          .filter(Boolean);
        const sessionDates = publishedSessions.map((s) => s.date).filter(Boolean);
        const nutritionDate =
          mealDates.sort().slice(-1)[0] ||
          sessionDates.sort().slice(-1)[0] ||
          L.today();
        nutrition = N.athleteNutritionPayload(nut, a.id, nutritionDate);
        nutrition.mealDays = (nut.mealDays || [])
          .filter((d) => d.athleteId === a.id && d.published)
          .map((d) => clone(d));
        nutrition.targets = nut.targetsByAthlete[a.id]
          ? clone(nut.targetsByAthlete[a.id])
          : null;
      }
      return { athleteId: a.id, email, name: a.name, sessions, nutrition };
    });
    return {
      version: BRIDGE_VERSION,
      exportedAt: new Date().toISOString(),
      coachId: state.coach && state.coach.id,
      athletes: buckets,
    };
  }

  function push(state, storage) {
    const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!store) return { ok: false, error: 'no storage' };
    try {
      const payload = buildPayload(state);
      store.setItem(BRIDGE_KEY, JSON.stringify(payload));
      return { ok: true, payload, count: payload.athletes.reduce((n, a) => n + a.sessions.length, 0) };
    } catch (e) {
      return { ok: false, error: String(e.message || e) };
    }
  }

  function read(storage) {
    const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!store) return null;
    try {
      const raw = store.getItem(BRIDGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  return {
    BRIDGE_KEY,
    BRIDGE_VERSION,
    buildPayload,
    push,
    read,
    sessionForAthlete,
    blocksForAthlete,
    clone,
    uid,
  };
});
