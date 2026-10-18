/**
 * Read public.exercise_catalogue (strengthside PR 273).
 * Search metadata only. A catalogue id is not a working-max id.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CoachCatalogue = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const ID = /^exercise_[0-9a-f]{16}$/;
  const COLS = 'canonical_exercise_id,catalogue,canonical_title,aliases,movement_category,movement_subcategory,secondary_categories,tags,in_custom_library';

  function isCatalogueId(id) {
    return ID.test(String(id || ''));
  }

  function labelsFromSources(sources) {
    const labels = {};
    for (const src of sources || []) {
      const cats = src && src.taxonomy && src.taxonomy.categories;
      if (!Array.isArray(cats)) continue;
      for (const cat of cats) {
        if (cat && cat.id && cat.label) labels[cat.id] = cat.label;
      }
    }
    return labels;
  }

  function rowToCatalog(row, labels) {
    if (!row || !isCatalogueId(row.canonical_exercise_id)) return null;
    const categoryId = row.movement_category || '';
    return {
      id: row.canonical_exercise_id,
      name: String(row.canonical_title || '').trim(),
      category: (labels && labels[categoryId]) || categoryId,
      builtIn: true,
      source: 'supabase-exercise-catalogue',
      catalogue: row.catalogue || '',
      movementCategory: categoryId,
      movementSubcategory: row.movement_subcategory || '',
      secondaryCategories: row.secondary_categories || [],
      aliases: row.aliases || [],
      tags: row.tags || [],
      custom: !!row.in_custom_library,
    };
  }

  function apply(state, entries) {
    if (!state) return { changed: false, count: 0 };
    state.exercises = state.exercises || [];
    const byId = {};
    for (const ex of state.exercises) {
      if (ex && ex.id) byId[ex.id] = ex;
    }
    let changed = false;
    let count = 0;
    for (const row of entries || []) {
      if (!row || !row.id || !row.name) continue;
      count += 1;
      const cur = byId[row.id];
      if (!cur) {
        state.exercises.push({ ...row });
        byId[row.id] = row;
        changed = true;
        continue;
      }
      if (cur.name !== row.name || cur.category !== row.category || cur.catalogue !== row.catalogue) {
        Object.assign(cur, row, { builtIn: true });
        changed = true;
      }
    }
    return { changed, count };
  }

  async function page(client, table, columns) {
    const out = [];
    const size = 1000;
    for (let from = 0; ; from += size) {
      const res = await client.from(table).select(columns).range(from, from + size - 1);
      if (res.error) throw res.error;
      const rows = res.data || [];
      out.push.apply(out, rows);
      if (rows.length < size) break;
    }
    return out;
  }

  function client() {
    try {
      if (typeof Whoop !== 'undefined' && Whoop.client) return Whoop.client();
    } catch (e) { /* unsigned */ }
    return null;
  }

  async function refresh(state, sb) {
    const db = sb || client();
    if (!db || !db.auth || !db.from) return { ok: false, reason: 'offline', changed: false, count: 0 };
    const session = await db.auth.getSession();
    const user = session && session.data && session.data.session && session.data.session.user;
    if (!user) return { ok: false, reason: 'signed-out', changed: false, count: 0 };
    const sources = await page(db, 'exercise_catalogue_sources', 'catalogue,schema_version,taxonomy,exercise_count');
    const rows = await page(db, 'exercise_catalogue', COLS);
    const labels = labelsFromSources(sources);
    const entries = rows.map((row) => rowToCatalog(row, labels)).filter(Boolean);
    const applied = apply(state, entries);
    if (state) {
      state.meta = state.meta || {};
      state.meta.exerciseCatalogue = {
        sources: (sources || []).map((src) => ({
          catalogue: src.catalogue,
          exerciseCount: src.exercise_count,
          schemaVersion: src.schema_version,
        })),
        count: applied.count,
      };
    }
    return { ok: true, changed: applied.changed, count: applied.count };
  }

  return {
    isCatalogueId,
    labelsFromSources,
    rowToCatalog,
    apply,
    refresh,
  };
});
