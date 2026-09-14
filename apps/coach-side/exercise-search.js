/**
 * Exercise variant search — names only in results; canonical exercise_id on pick.
 * Depends on EXERCISE_SEARCH_INDEX from exercise-search-index.js.
 */
(function (global) {
  'use strict';

  var ABBREV = {
    db: 'dumbbell',
    bb: 'barbell',
    kb: 'kettlebell',
    dl: 'deadlift',
    bp: 'bench press',
    ohp: 'overhead press',
    rdl: 'romanian deadlift',
    lat: 'lat',
  };

  function norm(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  function tokens(query) {
    return norm(query)
      .split(' ')
      .filter(Boolean)
      .flatMap(function (t) {
        return ABBREV[t] ? [t, ABBREV[t]] : [t];
      });
  }

  function indexEntries() {
    return global.EXERCISE_SEARCH_INDEX || [];
  }

  function byId(exerciseId) {
    if (!exerciseId) return null;
    return indexEntries().find(function (e) {
      return e.id === exerciseId;
    }) || null;
  }

  function scoreEntry(entry, queryNorm, queryTokens) {
    if (!queryNorm) return 0;
    var nameNorm = norm(entry.name);
    var aliasNorms = (entry.aliases || []).map(norm);
    var score = 0;

    if (nameNorm === queryNorm) score += 1000;
    if (nameNorm.startsWith(queryNorm)) score += 500;
    if (queryNorm.length >= 3 && nameNorm.includes(queryNorm)) score += 150;

    var allInName = queryTokens.length > 0 && queryTokens.every(function (t) {
      return nameNorm.includes(t);
    });
    if (allInName) score += 300 + queryTokens.length * 15;

    for (var i = 0; i < aliasNorms.length; i++) {
      var a = aliasNorms[i];
      if (a === queryNorm) score += 850;
      if (queryTokens.length && queryTokens.every(function (t) { return a.includes(t); })) score += 400;
    }

    if (entry.family && queryTokens.length === 1 && queryTokens[0] === entry.family) score += 280;
    if (entry.family && queryNorm === entry.family.replace(/-/g, ' ')) score += 320;
    if (entry.family && queryTokens.indexOf(entry.family) >= 0) score += 200;

    if (queryTokens.indexOf('deadlift') >= 0 && entry.family === 'deadlift') score += 180;
    if (queryTokens.indexOf('squat') >= 0 && entry.family === 'squat') score += 180;

    if (queryTokens.indexOf('raise') >= 0 && queryTokens.indexOf('pulldown') < 0) {
      if (/pulldown/.test(nameNorm) && !/lateral raise/.test(nameNorm)) score -= 400;
    }
    if (queryTokens.indexOf('pulldown') >= 0 && /lateral raise/.test(nameNorm)) score -= 350;
    if (queryTokens.indexOf('raise') >= 0 && entry.family === 'lateral-raise') score += 120;
    if (queryTokens.indexOf('pulldown') >= 0 && entry.family === 'lat-pulldown') score += 120;

    return score;
  }

  function search(query, limit) {
    limit = limit || 12;
    var queryNorm = norm(query);
    if (!queryNorm) return [];

    var queryTokens = [...new Set(tokens(query))];
    var ranked = indexEntries()
      .map(function (entry) {
        return { entry: entry, score: scoreEntry(entry, queryNorm, queryTokens) };
      })
      .filter(function (r) {
        return r.score > 0;
      })
      .sort(function (a, b) {
        if (b.score !== a.score) return b.score - a.score;
        return a.entry.name.localeCompare(b.entry.name);
      });

    var out = [];
    var seen = new Set();
    for (var i = 0; i < ranked.length && out.length < limit; i++) {
      var e = ranked[i].entry;
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      out.push({
        exerciseId: e.id,
        name: e.name,
        category: e.category || '',
        family: e.family || '',
      });
    }
    return out;
  }

  function mergeCustomHits(hits, stateExercises, query, limit) {
    limit = limit || 12;
    var queryNorm = norm(query);
    if (!queryNorm || !Array.isArray(stateExercises)) return hits.slice(0, limit);

    var seen = new Set(hits.map(function (h) { return h.exerciseId; }));
    var extras = stateExercises
      .filter(function (x) {
        if (!x || !x.name || x.builtIn === true) return false;
        if (seen.has(x.id)) return false;
        var n = norm(x.name);
        return n.includes(queryNorm) || norm(x.category || '').includes(queryNorm);
      })
      .slice(0, 4)
      .map(function (x) {
        return {
          exerciseId: x.id,
          name: x.name,
          category: x.category || 'Custom',
          family: '',
          custom: true,
        };
      });

    return hits.concat(extras).slice(0, limit);
  }

  global.ExerciseSearch = {
    search: search,
    byId: byId,
  mergeCustomHits: mergeCustomHits,
  norm: norm,
  byId: byId,
  resolveTitleAlias: function (title, aliasMap) {
    if (!title || !aliasMap) return null;
    if (aliasMap[title]) return byId(aliasMap[title]);
    var q = norm(title);
    for (var k in aliasMap) {
      if (norm(k) === q) return byId(aliasMap[k]);
    }
    return null;
  },
};
})(typeof window !== 'undefined' ? window : global);
