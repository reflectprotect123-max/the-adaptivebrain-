/** Remove legacy conditioning entities at device and cloud import boundaries. */
(function (root) {
  function isConditioning(value) {
    if (value?.kind === 'section' && /^(conditioning|engine|cardio)$/i.test(String(value.label || '').trim())) return true;
    return !!value && ['kind', 'type', 'product', 'hybridProduct', 'room', 'logMode'].some((key) =>
      /^(engine|conditioning|cond|cardio)(?:_|$)/i.test(String(value[key] || '')));
  }

  function cleanWorkout(workout) {
    if (!workout || isConditioning(workout)) return null;
    if (Array.isArray(workout.blocks)) {
      workout.blocks = workout.blocks.filter((b) => b && !isConditioning(b) &&
        ['lift', 'circuit', 'warmup', 'recovery', 'section'].includes(b.kind));
    }
    if (Array.isArray(workout.pages)) {
      const current = workout.pages[workout.blockIndex || 0];
      const removedIds = new Set(workout.pages.filter(isConditioning).map((p) => p.id));
      workout.pages = workout.pages.filter((p) => p && !isConditioning(p));
      if (!workout.pages.some((p) => p.kind !== 'doneHub')) return null;
      const newIndex = workout.pages.indexOf(current);
      workout.blockIndex = newIndex >= 0 ? newIndex : Math.min(workout.blockIndex || 0, workout.pages.length - 1);
      for (const id of removedIds) {
        if (workout.logs) delete workout.logs[id];
      }
    }
    return workout;
  }

  function cleanState(state) {
    if (!state || typeof state !== 'object') return state;
    for (const key of ['engine', 'engineSchedule', 'engineSessions', 'engineTemplates', 'conditioning', 'conditioningSchedule', 'hybridOccupancy']) delete state[key];
    if (state.library) {
      state.library.templates = (state.library.templates || []).map(cleanWorkout).filter(Boolean);
      const live = new Set(state.library.templates.map((t) => t.id));
      for (const [date, id] of Object.entries(state.library.assignments || {})) {
        if (!live.has(id)) delete state.library.assignments[date];
      }
    }
    for (const key of ['sessions', 'trainingPlans']) {
      for (const [date, value] of Object.entries(state[key] || {})) {
        const cleaned = cleanWorkout(value);
        if (cleaned) state[key][date] = cleaned;
        else delete state[key][date];
      }
    }
    for (const [date, items] of Object.entries(state.published || {})) {
      state.published[date] = (items || []).filter((item) => !isConditioning(item));
    }
    if (state.session) {
      state.session = cleanWorkout(state.session);
      if (!state.session) { state.loggerOpen = false; state.timer = null; }
    }
    return state;
  }

  root.StrengthOnly = { isConditioning, cleanWorkout, cleanState };
})(typeof window !== 'undefined' ? window : globalThis);
