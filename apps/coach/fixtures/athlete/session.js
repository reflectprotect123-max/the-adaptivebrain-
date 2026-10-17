(function (root) {
  function parseRx(prescription) {
    const raw = String(prescription || '').replace(/\s·\s[0-9X]{4}(?=\s|$)/gi, '');
    const m = raw.match(/(\d+)\s*[x×]\s*(\d+|MAX)(?:\s*[-–—]\s*(\d+))?/i);
    if (!m) return { setCount: 3, targetReps: 8, targetRepMax: 8, isMax: false };
    const isMax = String(m[2]).toUpperCase() === 'MAX';
    return {
      setCount: Number(m[1]),
      targetReps: isMax ? null : Number(m[2]),
      targetRepMax: isMax ? null : Math.max(Number(m[2]), Number(m[3] || m[2])),
      isMax,
    };
  }

  function logModeFor(block, rx) {
    if (block.kind === 'warmup' || block.kind === 'recovery') return 'complete';
    if (rx.isMax) return 'max';
    if (/^F\d/i.test(block.letter || '')) return 'reps';
    return 'kg';
  }

  function emptySets(page) {
    if (page.logMode === 'complete' || page.logMode === 'doneHub' || page.logMode === 'superset') return [];
    const rows = [];
    const targets=Array.isArray(page.setTargets)?page.setTargets:[];
    for (let i = 0; i < page.setCount; i++) {
      const target=targets[i];
      const cells = {};
      if (page.prescribed && (page.columns || []).includes('seconds')) cells.seconds = String(page.prescribed);
      if (page.prescribed && (page.columns || []).includes('time_mmss')) cells.time_mmss = String(page.prescribed);
      if (page.prescribed && (page.columns || []).includes('meters')) cells.meters = String(page.prescribed);
      rows.push({
        targetId:target?.id||null,
        purpose:page.section === 'Warm-Up' || page.section === 'Cool-Down' ? 'warmup' : (target?.purpose||'working'),
        workingIndex:targets.slice(0,i).filter(t=>t.purpose!=='warmup').length,
        reps: target?.purpose==='amrap'||page.logMode === 'max' ? null : target?.reps?.min??page.targetReps,
        kg: null,
        cells,
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
    const cols = Array.isArray(block.columns) ? block.columns.filter(Boolean).map(root.TrainingCore.canonical) : [];
    let setTargets=Array.isArray(block.setTargets)?JSON.parse(JSON.stringify(block.setTargets)):null;
    if(!setTargets&&cols.some(c=>c==='reps'||c==='reps_range')){
      try{setTargets=JSON.parse(JSON.stringify(root.StrengthTargets.normalize(block)));}catch{}
    }
    const rx=setTargets?{setCount:setTargets.length,targetReps:null,targetRepMax:null,isMax:false}
      :block.targetContractVersion===2?{setCount:Math.max(1,Number(block.setCount)||1),targetReps:null,targetRepMax:null,isMax:false}
      :parseRx(block.prescription);
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
      tempo: block.tempo || null,
      barWeightKg: block.barWeightKg ?? null,
      notes: block.notes || [],
      items: block.items || [],
      bullets: block.bullets || [],
      note: block.note || '',
      goal: block.goal || '',
      footer: block.footer || '',
      section: block.section || (block.kind === 'recovery' ? 'Recovery' : block.kind === 'warmup' ? 'Prep' : 'Strength/Power'),
      setCount: mode === 'complete' ? 0 : (setTargets?.length||Number(block.setCount) || rx.setCount),
      setTargets,
      ...(setTargets||block.targetContractVersion===2?{}:{targetReps:rx.targetReps,targetRepMax:rx.targetRepMax}),
      exerciseId: block.exerciseId || block.libraryExerciseId || null,
      equipmentId: block.equipmentId || null,
      equipmentStepKg: Number(block.equipmentStepKg) > 0 ? Number(block.equipmentStepKg) : null,
      availableLoads: Array.isArray(block.availableLoads) ? block.availableLoads : [],
      minimumKg: block.minimumKg==null?null:Number(block.minimumKg),
      loadConvention: block.loadConvention || null,
      loadUnit: cols.includes('weight_lb') ? 'lb' : 'kg',
      exerciseType: block.exerciseType || null,
      rampCount: block.rampCount,
      columns: cols,
      prescribed: block.prescribed || '',
      countIn: Number(block.countIn) || 0,
      askEffort: block.section !== 'Warm-Up' && block.section !== 'Cool-Down',
    };
  }

  function expandWarmupRounds(members) {
    const out = [];
    let i = 0;
    while (i < members.length) {
      const section = members[i].section;
      const roundSection = section === 'Warm-Up' || section === 'Cool-Down';
      if (!roundSection || members[i].logMode === 'complete') {
        out.push(members[i]);
        i += 1;
        continue;
      }
      let j = i;
      while (j < members.length && members[j].section === section && members[j].logMode !== 'complete') j += 1;
      const group = members.slice(i, j);
      const rounds = group.reduce((n, member) => Math.max(n, member.setCount || 1), 1);
      for (let r = 0; r < rounds; r++) {
        for (const member of group) {
          if (r >= (member.setCount || 1)) continue;
          const one = JSON.parse(JSON.stringify(member));
          one.setCount = 1;
          one.round = r + 1;
          one.rounds = rounds;
          one.id = member.id + '-r' + (r + 1);
          if (Array.isArray(one.setTargets)) one.setTargets = one.setTargets[r] ? [one.setTargets[r]] : null;
          out.push(one);
        }
      }
      i = j;
    }
    return out;
  }

  function pagesFromPlan(plan) {
    const members = [];
    for (const block of (plan && plan.blocks) || []) {
      if (!block || !['lift', 'warmup', 'recovery'].includes(block.kind)) continue;
      members.push(pageFromBlock(block));
    }
    const ordered = expandWarmupRounds(members);
    const pages = [];
    members.length = 0;
    ordered.forEach((member) => members.push(member));
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
      const s = root.TrainingCore.migrateSession(clone(existing));
      s.pages = s.pages?.length ? s.pages : pages;
      for(const log of Object.values(s.logs||{}))for(const row of log.sets||[])
        if(row.logged&&row.context?.inputVersion!==3&&!root.StrengthContext?.normalizeLoad(row.context?.normalizedLoad)?.eligible)
          row.context={...(row.context||{}),loadAmbiguous:true};
      return attachLogs(s);
    }
    const session = attachLogs({
      id: root.crypto?.randomUUID?.() || String(Date.now()),
      date,
      title: (plan && plan.title) || '',
      instructions: (plan && plan.instructions) || '',
      phase: letter ? 'block' : 'quote',
      inputContractVersion:3,
      completedAt:null,
      blockIndex: 0,
      startedAt: Date.now(),
      pages,
      logs: {},
      liftMemory: {},
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
    if(s.phase==='summary')s.completedAt=null;
    s.phase = 'block';
    s.blockIndex = s.blockIndex || 0;
    return s;
  }

  function currentPage(session) {
    return session.pages[session.blockIndex] || session.pages[0];
  }

  function nextPage(session) {
    const s = clone(session);
    if(s.phase==='summary')s.completedAt=null;
    s.phase = 'block';
    s.blockIndex = Math.min(s.pages.length - 1, (s.blockIndex || 0) + 1);
    return s;
  }

  function prevPage(session) {
    const s = clone(session);
    if(s.phase==='summary')s.completedAt=null;
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
    if(s.phase==='summary')s.completedAt=null;
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

  function canLogRow(row,page) { return root.TrainingCore.validateRow(row,page).ok; }

  function logSet(session, setIndex, patch, memberId, options = {}) {
    const s = clone(session);
    const page = currentPage(s);
    const log = getLog(s, page, memberId);
    const row = log.sets[setIndex];
    if (!row) return s;
    const liftPage = page.logMode === 'superset' ? memberOf(page, memberId) : page;
    const wasLogged=row.logged,previousKg=row.kg;
    if (patch.reps != null) row.reps = Number(patch.reps);
    if (patch.kg != null) row.kg = Number(patch.kg);
    if (patch.cells && typeof patch.cells === 'object') {
      row.cells = { ...(row.cells || {}), ...patch.cells };
    }
    if (patch.miss != null) row.miss = !!patch.miss;
    if (patch.effort !== undefined) row.effort = patch.effort;
    if (patch.context && typeof patch.context === 'object') row.context = { ...(row.context || {}), ...patch.context };
    if(root.StrengthLoad&&((!wasLogged&&!row.context?.loadAmbiguous)||row.context?.inputVersion===3||(patch.kg!=null&&Number(patch.kg)!==previousKg))) {
      row.context={...(row.context||{}),inputVersion:3,normalizedLoad:root.StrengthLoad.fromPage({page:liftPage,value:row.kg,provenance:'explicit'})};
    } else if(wasLogged&&!row.context?.normalizedLoad) row.context={...(row.context||{}),loadAmbiguous:true};
    row.logged = options.commit === false ? false : canLogRow(row, liftPage);
    return s;
  }

  function toggleLogged(session, setIndex, memberId) {
    const s = clone(session);
    const page = currentPage(s);
    const log = getLog(s, page, memberId);
    const row = log.sets[setIndex];
    if (!row) return s;
    if(row.logged&&row.context?.inputVersion!==3&&!root.StrengthContext?.normalizeLoad(row.context?.normalizedLoad)?.eligible)row.context={...(row.context||{}),loadAmbiguous:true};
    row.logged = row.logged ? false : canLogRow(row, page.logMode === 'superset' ? memberOf(page, memberId) : page);
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
          if (!row.logged || row.purpose === 'ramp') continue;
          reps += Number(row.reps) || 0;
          kg += Number(row.kg) || 0;
        }
      }
    }
    return { reps, kg };
  }

  function openFeel(session) {
    const s = clone(session);
    s.phase = 'feel';
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
    s.completedAt=new Date().toISOString();
    return s;
  }

  function summaryStats(session) {
    const t = totals(session);
    let exercises = 0;
    let sets = 0;
    let blocksDone = 0;
    const workPages = session.pages.filter((p) => p.logMode !== 'doneHub');
    for (const page of workPages) {
      if (page.logMode === 'complete') {
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
        const logged = (log.sets || []).filter((r) => r.logged && r.purpose !== 'ramp').length;
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
    seedOpeningLoads: (session) => session,
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
    openFeel,
    setFeel,
    finishToSummary,
    summaryStats,
  };

  root.HybridSession = HybridSession;
  if (typeof module !== 'undefined' && module.exports) module.exports = HybridSession;
})(typeof globalThis !== 'undefined' ? globalThis : this);
