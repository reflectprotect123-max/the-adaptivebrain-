/**
 * THE Hybrid — coach nutrition domain (local-first).
 *
 * LAST surface after training loop + training bridge.
 * Reuses athlete nutrition-engine / nutrition-core shapes:
 *   - Macro targets + coach override
 *   - Prescribed meal days → athlete Nutrition (green-check / skip / add)
 *
 * Pure data helpers. No React. Coach UI loads this next to coach-loop.js.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CoachNutrition = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function uid(prefix) {
    return (prefix || 'id') + '_' + Math.random().toString(36).slice(2, 10);
  }

  function clone(x) {
    return JSON.parse(JSON.stringify(x));
  }

  function num(x) {
    const n = Number(x);
    return Number.isFinite(n) ? n : 0;
  }

  /** Empty nutrition slice on coach state. */
  function emptyNutritionState() {
    return {
      /** athleteId → current targets + override flag */
      targetsByAthlete: {},
      /** meal days: { id, athleteId, date, meals[] } */
      mealDays: [],
      /** weekly proposals coach has seen / accepted / overridden */
      checkInReviews: [],
    };
  }

  /**
   * Macro targets. Coach override sets `source: 'coach_override'`.
   * Engine proposal uses `source: 'engine_proposal'` until coach accepts.
   */
  function makeTargets(partial) {
    return {
      athleteId: partial.athleteId,
      calories: num(partial.calories),
      proteinG: num(partial.proteinG),
      carbsG: num(partial.carbsG),
      fatG: num(partial.fatG),
      source: partial.source || 'coach_override',
      override: partial.override !== false && (partial.source || 'coach_override') === 'coach_override',
      updatedAt: partial.updatedAt || new Date().toISOString(),
      note: partial.note || '',
    };
  }

  /**
   * Ownership: coach override wins until cleared or coach accepts engine proposal.
   */
  function resolveActiveTargets(stored, engineProposal) {
    if (stored && stored.override) return { active: stored, reason: 'coach_override' };
    if (engineProposal) {
      return {
        active: makeTargets({
          ...engineProposal,
          athleteId: (stored && stored.athleteId) || engineProposal.athleteId,
          source: 'engine_proposal',
          override: false,
        }),
        reason: 'engine_proposal',
      };
    }
    if (stored) return { active: stored, reason: 'stored' };
    return { active: null, reason: 'none' };
  }

  function setCoachOverride(nutritionState, athleteId, macros, note) {
    nutritionState.targetsByAthlete[athleteId] = makeTargets({
      athleteId,
      ...macros,
      source: 'coach_override',
      override: true,
      note: note || '',
    });
    return nutritionState.targetsByAthlete[athleteId];
  }

  function clearCoachOverride(nutritionState, athleteId) {
    if (!nutritionState.targetsByAthlete) return null;
    delete nutritionState.targetsByAthlete[athleteId];
    return null;
  }

  function acceptEngineProposal(nutritionState, athleteId, proposal) {
    nutritionState.targetsByAthlete[athleteId] = makeTargets({
      athleteId,
      calories: proposal.calories,
      proteinG: proposal.proteinG,
      carbsG: proposal.carbsG,
      fatG: proposal.fatG,
      source: 'engine_accepted',
      override: false,
    });
    return nutritionState.targetsByAthlete[athleteId];
  }

  /** Meal item — usually from food catalog search on coach side. */
  function makeMealItem(partial) {
    return {
      id: partial.id || uid('mi'),
      foodId: partial.foodId || '',
      name: partial.name || 'Food',
      amount: partial.amount || '',
      grams: partial.grams == null ? null : num(partial.grams),
      calories: partial.calories == null ? null : num(partial.calories),
      proteinG: partial.proteinG == null ? null : num(partial.proteinG),
      carbsG: partial.carbsG == null ? null : num(partial.carbsG),
      fatG: partial.fatG == null ? null : num(partial.fatG),
    };
  }

  /**
   * Prescribed meal. Athlete Nutrition: green-check / skip / add.
   * status: 'prescribed' | 'done' | 'skipped'
   */
  function makeMeal(partial) {
    return {
      id: partial.id || uid('meal'),
      title: partial.title || 'Meal',
      items: (partial.items || []).map(makeMealItem),
      status: partial.status || 'prescribed',
      athleteNote: partial.athleteNote || '',
    };
  }

  function makeMealDay(partial) {
    return {
      id: partial.id || uid('mday'),
      athleteId: partial.athleteId,
      date: partial.date,
      published: !!partial.published,
      meals: (partial.meals || []).map(makeMeal),
      coachNote: partial.coachNote || '',
    };
  }

  function upsertMealDay(nutritionState, day) {
    const i = nutritionState.mealDays.findIndex(
      (d) => d.athleteId === day.athleteId && d.date === day.date,
    );
    if (i >= 0) nutritionState.mealDays[i] = day;
    else nutritionState.mealDays.push(day);
    return day;
  }

  function publishMealDay(day) {
    day.published = true;
    return day;
  }

  /** Athlete: green-check */
  function markMealDone(day, mealId) {
    const m = (day.meals || []).find((x) => x.id === mealId);
    if (m) m.status = 'done';
    return day;
  }

  /** Athlete: didn't eat it */
  function markMealSkipped(day, mealId) {
    const m = (day.meals || []).find((x) => x.id === mealId);
    if (m) m.status = 'skipped';
    return day;
  }

  /**
   * Payload shape for athlete Nutrition bridge (N4).
   * Athlete app merges into its nutrition DB / day log — green-check UI in N5.
   */
  function athleteNutritionPayload(nutritionState, athleteId, date) {
    const targets = nutritionState.targetsByAthlete[athleteId] || null;
    const day =
      (nutritionState.mealDays || []).find(
        (d) => d.athleteId === athleteId && d.date === date && d.published,
      ) || null;
    return {
      version: 1,
      athleteId,
      date,
      targets: targets ? clone(targets) : null,
      mealDay: day ? clone(day) : null,
    };
  }

  function ensureNutrition(state) {
    if (!state.nutrition) state.nutrition = emptyNutritionState();
    state.nutrition.targetsByAthlete = state.nutrition.targetsByAthlete || {};
    state.nutrition.mealDays = Array.isArray(state.nutrition.mealDays)
      ? state.nutrition.mealDays
      : [];
    state.nutrition.checkInReviews = Array.isArray(state.nutrition.checkInReviews)
      ? state.nutrition.checkInReviews
      : [];
    return state.nutrition;
  }

  return {
    emptyNutritionState,
    ensureNutrition,
    makeTargets,
    resolveActiveTargets,
    setCoachOverride,
    clearCoachOverride,
    acceptEngineProposal,
    makeMealItem,
    makeMeal,
    makeMealDay,
    upsertMealDay,
    publishMealDay,
    markMealDone,
    markMealSkipped,
    athleteNutritionPayload,
    clone,
    uid,
  };
});
