(function (root) {
  function parseRx(prescription) {
    const raw = String(prescription || '');
    const m = raw.match(/(\d+)\s*[x×]\s*(\d+|MAX)/i);
    if (!m) return { setCount: 3, targetReps: 8, isMax: false };
    const isMax = String(m[2]).toUpperCase() === 'MAX';
    return {
      setCount: Number(m[1]),
      targetReps: isMax ? null : Number(m[2]),
      isMax,
    };
  }

  function logModeFor(block, rx) {
    if (block.kind === 'engine') return 'engine';
    if (block.kind === 'warmup' || block.kind === 'recovery') return 'complete';
    return 'complete';
  }

  function emptySets(page) {
    if (page.logMode === 'complete' || page.logMode === 'doneHub' || page.logMode === 'superset' || page.logMode === 'engine') return [];
    const rows = [];
    for (let i = 0; i < page.setCount; i++) {
      rows.push({
        reps: page.logMode === 'max' ? null : page.targetReps,
        kg: null,
        cells: {},
        logged: false,
        miss: false,
      });
    }
    return rows;
  }

  function letterParts(letter) {
    const m = String(letter || '').match(/^([A-Za-z]+)(\d+)$/);
    if (!m) return null;
    return { base: m[1].toUpperCase(), n: Number(m[2]) };
  }

  function logIdsForPage(page) {
    if (page && page.logMode === 'superset') return (page.members || []).map((m) => m.id);
    return page ? [page.id] : [];
  }

  function memberOf(page, memberId) {
    if (!page || page.logMode !== 'superset') return page;
    return (page.members || []).find((m) => m.id === memberId || m.letter === memberId) || page.members[0];
  }

  function ensureLog(session, page) {
    session.logs = session.logs || {};
    if (page.logMode === 'superset') {
      for (const m of page.members || []) {
        if (!session.logs[m.id]) {
          session.logs[m.id] = {
            completed: false,
            sets: emptySets(m),
            note: '',
          };
        }
      }
      return session.logs[(page.members && page.members[0] && page.members[0].id) || page.id];
    }
    if (!session.logs[page.id]) {
      session.logs[page.id] = {
        completed: false,
        sets: emptySets(page),
        note: '',
      };
    }
    if (page.logMode === 'engine' && !session.logs[page.id].engine && root.HybridEngine) {
      const anchors = session.engineAnchors || {};
      const day = session.date;
      const checkin = (root.S && root.S.checkin && day && root.S.checkin[day]) || {};
      const rec = Number(checkin.whoopRecovery);
      const ready = root.HybridEngine.readyLog(
        page,
        root.HybridAdaptive,
        anchors[page.machine] || null,
        Number.isFinite(rec) && rec > 0 ? rec : null,
      );
      session.logs[page.id] = { ...session.logs[page.id], ...ready };
    }
    return session.logs[page.id];
  }

  function getLog(session, page, memberId) {
    ensureLog(session, page);
    if (page.logMode === 'superset') {
      const m = memberOf(page, memberId);
      return session.logs[m.id];
    }
    return session.logs[page.id];
  }

  function clone(session) {
    return JSON.parse(JSON.stringify(session));
  }

  function pageFromBlock(block) {
    const rx = parseRx(block.prescription);
    const cols = Array.isArray(block.columns) ? block.columns.filter(Boolean) : [];
    const mode = cols.length && !cols.includes('weight_kg') && !cols.includes('weight_lb') && !cols.includes('weight_pct') && !cols.includes('lwp')
      ? (rx.isMax ? 'max' : 'reps')
      : logModeFor(block, rx);
    return {
      id: block.letter || block.title,
      letter: block.letter || '',
      title: block.title || '',
      kind: block.kind,
      logMode: mode,
      prescription: block.prescription || '',
      notes: block.notes || [],
      items: block.items || [],
      bullets: block.bullets || [],
      note: block.note || '',
      goal: block.goal || '',
      footer: block.footer || '',
      section: block.section || (block.kind === 'recovery' ? 'Recovery' : block.kind === 'warmup' ? 'Prep' : 'Strength/Power'),
      setCount: mode === 'complete' || mode === 'engine' ? 0 : (Number(block.setCount) || rx.setCount),
      targetReps: rx.targetReps,
      columns: cols,
      machine: block.machine,
      structure: block.structure,
      effort: block.effort,
      workSec: block.workSec,
      restSec: block.restSec,
      rounds: block.rounds,
      typedWatts: block.typedWatts,
      typedSplitSec: block.typedSplitSec,
      typedRpm: block.typedRpm,
    };
  }

  function pagesFromPlan(plan) {
    const members = [];
    for (const block of (plan && plan.blocks) || []) {
      if (!block || block.kind === 'section' || block.kind === 'lift') continue;
      members.push(pageFromBlock(block));
    }
    const pages = [];
    for (let i = 0; i < members.length; i++) {
      const a = members[i];
      const pa = letterParts(a.letter);
      if (!pa) {
        pages.push(a);
        continue;
      }
      const group = [a];
      let j = i + 1;
      while (j < members.length) {
        const pb = letterParts(members[j].letter);
        if (!pb || pb.base !== pa.base || pb.n !== pa.n + (j - i)) break;
        group.push(members[j]);
        j += 1;
      }
      if (group.length >= 2) {
        pages.push({
          id: pa.base,
          letter: pa.base,
          title: group.map((m) => m.title).join(' / '),
          kind: 'lift',
          logMode: 'superset',
          prescription: '',
          notes: [],
          items: [],
          bullets: [],
          note: '',
          goal: '',
          footer: '',
          section: a.section,
          setCount: 0,
          targetReps: null,
          members: group,
        });
        i = j - 1;
      } else {
        pages.push(a);
      }
    }
    pages.push({
      id: 'done',
      letter: '',
      title: 'Done Training',
      kind: 'doneHub',
      logMode: 'doneHub',
      setCount: 0,
      targetReps: null,
    });
    return pages;
  }

  function attachLogs(session) {
    for (const page of session.pages) ensureLog(session, page);
    return session;
  }

  function startSession({ date, plan, letter, existing } = {}) {
    const pages = pagesFromPlan(plan);
    if (existing && existing.date === date && existing.phase !== 'summary' && !letter) {
      const s = clone(existing);
      s.pages = pages;
      return attachLogs(s);
    }
    const session = attachLogs({
      date,
      title: (plan && plan.title) || '',
      instructions: (plan && plan.instructions) || '',
      phase: letter ? 'block' : 'quote',
      blockIndex: 0,
      startedAt: Date.now(),
      pages,
      logs: {},
      workingMax: {},
      engineAnchors: (existing && existing.engineAnchors)
        || (root.S && root.S.engineAnchors)
        || {},
      feel: { intensity: null, durationMin: 0, note: '' },
      unit: 'kg',
    });
    if (letter) {
      const idx = pages.findIndex((p) => pageMatchesLetter(p, letter));
      session.blockIndex = idx >= 0 ? idx : 0;
    }
    return session;
  }

  function ackQuote(session) {
    const s = clone(session);
    s.phase = 'coach';
    return s;
  }

  function ackCoach(session) {
    const s = clone(session);
    s.phase = 'block';
    s.blockIndex = s.blockIndex || 0;
    return s;
  }

  function currentPage(session) {
    return session.pages[session.blockIndex] || session.pages[0];
  }

  function nextPage(session) {
    const s = clone(session);
    s.phase = 'block';
    s.blockIndex = Math.min(s.pages.length - 1, (s.blockIndex || 0) + 1);
    return s;
  }

  function prevPage(session) {
    const s = clone(session);
    s.phase = 'block';
    s.blockIndex = Math.max(0, (s.blockIndex || 0) - 1);
    return s;
  }

  function pageMatchesLetter(page, letter) {
    if (!page) return false;
    if (page.id === letter || page.letter === letter) return true;
    return (page.members || []).some((m) => m.id === letter || m.letter === letter);
  }

  function goToLetter(session, letter) {
    const s = clone(session);
    const idx = s.pages.findIndex((p) => pageMatchesLetter(p, letter));
    if (idx >= 0) s.blockIndex = idx;
    s.phase = 'block';
    return s;
  }

  function completeCurrent(session) {
    const s = clone(session);
    const page = currentPage(s);
    const log = ensureLog(s, page);
    log.completed = true;
    return s;
  }

  function logSet(session, setIndex, patch, memberId) {
    const s = clone(session);
    const page = currentPage(s);
    const log = getLog(s, page, memberId);
    const row = log.sets[setIndex];
    if (!row) return s;
    if (patch.reps != null) row.reps = Number(patch.reps);
    if (patch.kg != null) row.kg = Number(patch.kg);
    if (patch.cells && typeof patch.cells === 'object') {
      row.cells = { ...(row.cells || {}), ...patch.cells };
    }
    if (patch.miss != null) row.miss = !!patch.miss;
    row.logged = true;
    return s;
  }

  function toggleLogged(session, setIndex, memberId) {
    const s = clone(session);
    const page = currentPage(s);
    const log = getLog(s, page, memberId);
    const row = log.sets[setIndex];
    if (!row) return s;
    row.logged = !row.logged;
    return s;
  }

  function autofillFrom(session, setIndex, memberId) {
    const s = clone(session);
    const page = currentPage(s);
    const log = getLog(s, page, memberId);
    const src = log.sets[setIndex];
    if (!src) return s;
    for (let i = setIndex + 1; i < log.sets.length; i++) {
      if (log.sets[i].logged) continue;
      log.sets[i].kg = src.kg;
      if (src.reps != null) log.sets[i].reps = src.reps;
    }
    return s;
  }

  function totals(session) {
    let reps = 0;
    let kg = 0;
    for (const page of session.pages) {
      for (const id of logIdsForPage(page)) {
        const log = (session.logs || {})[id];
        if (!log) continue;
        for (const row of log.sets || []) {
          if (!row.logged) continue;
          reps += Number(row.reps) || 0;
          kg += Number(row.kg) || 0;
        }
      }
    }
    return { reps, kg };
  }

  function setWorkingMax(session, exerciseId, value) {
    const s = clone(session);
    s.workingMax = s.workingMax || {};
    s.workingMax[exerciseId] = Number(value);
    return s;
  }

  function openFeel(session) {
    return openSummary(session);
  }

  function openSummary(session) {
    const s = clone(session);
    s.phase = 'summary';
    const started = s.startedAt || Date.now();
    const mins = Math.max(1, Math.round((Date.now() - started) / 60000));
    s.feel = s.feel || {};
    if (!s.feel.durationMin) s.feel.durationMin = mins;
    return s;
  }

  function setFeel(session, feel) {
    const s = clone(session);
    s.feel = { ...(s.feel || {}), ...feel };
    return s;
  }

  function finishToSummary(session) {
    const s = clone(session);
    s.phase = 'summary';
    return s;
  }

  function summaryStats(session) {
    const t = totals(session);
    let exercises = 0;
    let sets = 0;
    let blocksDone = 0;
    const workPages = session.pages.filter((p) => p.logMode !== 'doneHub');
    for (const page of workPages) {
      if (page.logMode === 'complete' || page.logMode === 'engine') {
        const log = (session.logs || {})[page.id];
        if (log && log.completed) {
          exercises += 1;
          blocksDone += 1;
        }
        continue;
      }
      let pageSets = 0;
      let pageExercises = 0;
      for (const id of logIdsForPage(page)) {
        const log = (session.logs || {})[id];
        if (!log) continue;
        const logged = (log.sets || []).filter((r) => r.logged).length;
        if (logged) {
          pageExercises += 1;
          pageSets += logged;
        }
      }
      if (pageExercises) {
        exercises += pageExercises;
        sets += pageSets;
        blocksDone += 1;
      }
    }
    return {
      exercises,
      sets,
      reps: t.reps,
      kg: t.kg,
      blocksDone,
      blocksTotal: workPages.length,
      minutes: (session.feel && session.feel.durationMin) || 0,
    };
  }

  const HybridSession = {
    parseRx,
    pagesFromPlan,
    startSession,
    ackQuote,
    ackCoach,
    currentPage,
    nextPage,
    prevPage,
    goToLetter,
    completeCurrent,
    logSet,
    toggleLogged,
    autofillFrom,
    logIdsForPage,
    memberOf,
    totals,
    setWorkingMax,
    openFeel,
    openSummary,
    setFeel,
    finishToSummary,
    summaryStats,
  };

  root.HybridSession = HybridSession;
  if (typeof module !== 'undefined' && module.exports) module.exports = HybridSession;
})(typeof globalThis !== 'undefined' ? globalThis : this);
