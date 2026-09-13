(function (root) {
  const TRACK = [
    { key: 'reps', label: 'Reps' },
    { key: 'reps_range', label: 'Rep Range' },
    { key: 'weight_lb', label: 'Weight (lb)' },
    { key: 'weight_kg', label: 'Weight (kg)' },
    { key: 'weight_pct', label: 'Weight (%)' },
    { key: 'lwp', label: 'Linear Weight Progression' },
    { key: 'time_mmss', label: 'Time (mm:ss)' },
    { key: 'seconds', label: 'Seconds' },
    { key: 'miles', label: 'Miles' },
    { key: 'yards', label: 'Yards' },
    { key: 'meters', label: 'Meters' },
    { key: 'feet', label: 'Feet' },
    { key: 'watts', label: 'Watts' },
    { key: 'rpe', label: 'RPE' },
    { key: 'calories', label: 'Calories' },
    { key: 'inches', label: 'Inches' },
    { key: 'velocity', label: 'Velocity (m/s)' },
    { key: 'other', label: 'Other' },
    { key: 'for_completion', label: 'For Completion' },
  ];

  const SEED_CIRCUITS = [
    { title: 'Easy spin', instructions: '3–5 min easy on the machine you will work\nNasal breathing' },
    { title: 'Recovery breathing', instructions: '10 nasal breaths\n5s inhale · 1s hold · 5s exhale' },
    { title: 'Cooldown', instructions: 'Easy spin until talk-test is easy\nRecovery breathing' },
  ];

  function nid(prefix) {
    return prefix + '_' + Math.random().toString(36).slice(2, 9);
  }

  function clone(v) {
    return JSON.parse(JSON.stringify(v));
  }

  function seedCatalog() {
    return {
      exercises: [],
      circuits: SEED_CIRCUITS.map((c) => ({
        id: nid('ci'),
        title: c.title,
        track: 'for_completion',
        instructions: c.instructions,
      })),
    };
  }

  function emptyState() {
    return {
      templates: [],
      catalog: seedCatalog(),
      assignments: {},
    };
  }

  function ensure(state) {
    if (!state || typeof state !== 'object') return emptyState();
    const next = {
      templates: Array.isArray(state.templates) ? state.templates : [],
      catalog: state.catalog && Array.isArray(state.catalog.exercises)
        ? state.catalog
        : seedCatalog(),
      assignments: state.assignments && typeof state.assignments === 'object' ? state.assignments : {},
    };
    if (!next.catalog.exercises.length && !next.catalog.circuits.length) next.catalog = seedCatalog();
    return next;
  }

  function template(state, tid) {
    return (state.templates || []).find((t) => t.id === tid) || null;
  }

  function createTemplate(state, { title, instructions, lane } = {}) {
    const st = clone(ensure(state));
    const kind = 'engine';
    st.templates.unshift({
      id: nid('tpl'),
      title: String(title || (kind === 'engine' ? 'Engine session' : 'Session Template')).trim()
        || (kind === 'engine' ? 'Engine session' : 'Session Template'),
      instructions: String(instructions || ''),
      lane: kind,
      blocks: [],
    });
    return st;
  }

  function patchTemplate(state, tid, patch) {
    const st = clone(ensure(state));
    const t = st.templates.find((x) => x.id === tid);
    if (!t) return st;
    Object.assign(t, patch);
    return st;
  }

  function addEnginePiece(state, tid, piece = {}) {
    const st = clone(ensure(state));
    const t = st.templates.find((x) => x.id === tid);
    if (!t || t.lane !== 'engine') return st;
    const machine = piece.machine || 'row';
    const Eng = root.HybridEngine;
    const title = piece.title || (Eng && Eng.machineTitle(machine)) || machine;
    t.blocks.push({
      id: nid('blk'),
      kind: 'engine',
      title,
      machine,
      structure: piece.structure || 'intervals',
      effort: piece.effort || 'medium',
      workSec: Math.max(1, Number(piece.workSec) || 15),
      restSec: Math.max(0, Number(piece.restSec) || 45),
      rounds: Math.max(1, Number(piece.rounds) || 8),
      typedWatts: piece.typedWatts == null || piece.typedWatts === '' ? null : Number(piece.typedWatts),
      typedSplitSec: piece.typedSplitSec == null || piece.typedSplitSec === '' ? null : Number(piece.typedSplitSec),
      typedRpm: piece.typedRpm == null || piece.typedRpm === '' ? null : Number(piece.typedRpm),
    });
    return st;
  }

  function addCircuit(state, tid, { title, instructions, catalogId } = {}) {
    const st = clone(ensure(state));
    const t = st.templates.find((x) => x.id === tid);
    if (!t) return st;
    let instr = instructions || '';
    let name = title || 'Circuit';
    if (catalogId) {
      const hit = st.catalog.circuits.find((c) => c.id === catalogId);
      if (hit) {
        name = hit.title;
        instr = hit.instructions || instr;
      }
    }
    t.blocks.push({
      id: nid('blk'),
      kind: 'circuit',
      title: name,
      instructions: instr,
      track: 'for_completion',
    });
    return st;
  }

  function addExercise(state, tid) {
    const st = clone(ensure(state));
    const t = st.templates.find((x) => x.id === tid);
    if (!t) return st;
    return st;
  }

  function removeBlock(state, tid, bid) {
    const st = clone(ensure(state));
    const t = st.templates.find((x) => x.id === tid);
    if (!t) return st;
    t.blocks = t.blocks.filter((b) => b.id !== bid);
    return st;
  }

  function moveBlock(state, tid, bid, dir) {
    const st = clone(ensure(state));
    const t = st.templates.find((x) => x.id === tid);
    if (!t) return st;
    const i = t.blocks.findIndex((b) => b.id === bid);
    const j = i + (dir < 0 ? -1 : 1);
    if (i < 0 || j < 0 || j >= t.blocks.length) return st;
    const tmp = t.blocks[i];
    t.blocks[i] = t.blocks[j];
    t.blocks[j] = tmp;
    return st;
  }

  function patchBlock(state, tid, bid, patch) {
    const st = clone(ensure(state));
    const t = st.templates.find((x) => x.id === tid);
    if (!t) return st;
    const b = t.blocks.find((x) => x.id === bid);
    if (!b) return st;
    Object.assign(b, patch);
    if (Array.isArray(b.columns)) b.columns = b.columns.filter((k) => k && k !== 'none');
    return st;
  }

  function linkSuperset(state, tid, aId, bId) {
    const st = clone(ensure(state));
    const t = st.templates.find((x) => x.id === tid);
    if (!t) return st;
    const a = t.blocks.find((x) => x.id === aId);
    const b = t.blocks.find((x) => x.id === bId);
    if (!a || !b || a.kind !== 'lift' || b.kind !== 'lift') return st;
    const gid = a.groupId || b.groupId || nid('ss');
    a.groupId = gid;
    b.groupId = gid;
    return st;
  }

  function unlinkSuperset(state, tid, bid) {
    const st = clone(ensure(state));
    const t = st.templates.find((x) => x.id === tid);
    if (!t) return st;
    const b = t.blocks.find((x) => x.id === bid);
    if (b) b.groupId = null;
    return st;
  }

  function lettered(tpl) {
    const blocks = (tpl.blocks || []).map((b) => ({ ...b }));
    let code = 65;
    let i = 0;
    while (i < blocks.length) {
      const b = blocks[i];
      if (b.kind !== 'lift') {
        b.letter = String.fromCharCode(code++);
        i += 1;
        continue;
      }
      const run = [b];
      let j = i + 1;
      if (b.groupId) {
        while (j < blocks.length && blocks[j].kind === 'lift' && blocks[j].groupId === b.groupId) {
          run.push(blocks[j]);
          j += 1;
        }
      }
      const L = String.fromCharCode(code++);
      if (run.length === 1) run[0].letter = L;
      else run.forEach((x, n) => { x.letter = L + String(n + 1); });
      i = j;
    }
    return blocks;
  }

  function itemsFromInstructions(text) {
    const lines = String(text || '')
      .split(/\n+/)
      .map((s) => s.replace(/^\s*\d+[.)]\s*/, '').trim())
      .filter(Boolean);
    return lines.map((text, i) => ({ n: i + 1, text }));
  }

  function rxFor(block) {
    const sets = Math.max(1, Number(block.setCount) || 3);
    const cols = block.columns || ['reps'];
    const repBit = cols[0] === 'reps_range' ? '8-12' : cols[0] === 'reps' ? '8' : '';
    if (cols.includes('meters')) return repBit ? `${sets} x ${repBit} m` : `${sets} x m`;
    if (cols[0] === 'reps' || cols[0] === 'reps_range') return `${sets} x ${repBit}`;
    if (cols[0] === 'seconds' || cols[0] === 'time_mmss') return `${sets} x time`;
    return `${sets} sets`;
  }

  function sectionFor(block) {
    if (block.kind === 'engine') return 'The Engine';
    if (block.kind === 'circuit') {
      if (/recover|cool/i.test(block.title || '')) return 'Recovery';
      return 'Conditioning';
    }
    return 'Strength/Power';
  }

  function compile(tpl) {
    const blocks = [];
    let lastSection = '';
    for (const b of lettered(tpl)) {
      if (b.kind === 'lift') continue;
      const section = sectionFor(b);
      if (section !== lastSection) {
        blocks.push({ kind: 'section', label: section.toUpperCase() });
        lastSection = section;
      }
      if (b.kind === 'engine') {
        const Eng = root.HybridEngine;
        blocks.push({
          kind: 'engine',
          letter: b.letter,
          title: b.title,
          machine: b.machine,
          structure: b.structure,
          effort: b.effort,
          workSec: b.workSec,
          restSec: b.restSec,
          rounds: b.rounds,
          typedWatts: b.typedWatts,
          typedSplitSec: b.typedSplitSec,
          typedRpm: b.typedRpm,
          prescription: Eng ? Eng.rxText(b) : `${b.rounds} rounds`,
          section,
        });
      } else if (b.kind === 'circuit') {
        const recovery = /recover|cool/i.test(b.title || '');
        blocks.push({
          kind: recovery ? 'recovery' : 'warmup',
          letter: b.letter,
          title: b.title,
          items: itemsFromInstructions(b.instructions),
          bullets: recovery ? itemsFromInstructions(b.instructions).map((x) => x.text) : [],
          footer: 'For Completion',
          section,
        });
      }
    }
    return {
      id: tpl.id,
      title: tpl.title || 'Engine session',
      instructions: tpl.instructions || '',
      blocks,
      dots: {},
    };
  }

  function assignDate(state, tid, date) {
    const st = clone(ensure(state));
    if (!st.templates.some((t) => t.id === tid)) return st;
    st.assignments[date] = tid;
    return st;
  }

  function unassignDate(state, date) {
    const st = clone(ensure(state));
    delete st.assignments[date];
    return st;
  }

  function planForDate(state, date, fallback) {
    const st = ensure(state);
    const tid = st.assignments[date];
    const tpl = tid && st.templates.find((t) => t.id === tid);
    if (!tpl) return fallback || null;
    const plan = compile(tpl);
    plan.dots = Object.fromEntries(Object.keys(st.assignments).map((d) => [d, true]));
    return plan;
  }

  function createCatalogExercise(state, { title, columns } = {}) {
    const st = clone(ensure(state));
    const cols = (columns || ['reps']).filter((k) => k && k !== 'none');
    st.catalog.exercises.unshift({
      id: nid('ex'),
      title: String(title || 'Exercise').trim() || 'Exercise',
      columns: cols.length ? cols : ['reps'],
    });
    return st;
  }

  function createCatalogCircuit(state, { title, instructions } = {}) {
    const st = clone(ensure(state));
    st.catalog.circuits.unshift({
      id: nid('ci'),
      title: String(title || 'Circuit').trim() || 'Circuit',
      track: 'for_completion',
      instructions: instructions || '',
    });
    return st;
  }

  function searchCatalog(state, tab, q) {
    const st = ensure(state);
    const needle = String(q || '').trim().toLowerCase();
    const list = tab === 'circuits' ? st.catalog.circuits : st.catalog.exercises;
    if (!needle) return list.slice();
    return list.filter((x) => x.title.toLowerCase().includes(needle));
  }

  function deleteTemplate(state, tid) {
    const st = clone(ensure(state));
    st.templates = st.templates.filter((t) => t.id !== tid);
    for (const [d, id] of Object.entries(st.assignments)) {
      if (id === tid) delete st.assignments[d];
    }
    return st;
  }

  function trackLabel(key) {
    const hit = TRACK.find((t) => t.key === key);
    return hit ? hit.label : key;
  }

  const HybridLibrary = {
    TRACK,
    emptyState,
    ensure,
    template,
    createTemplate,
    patchTemplate,
    deleteTemplate,
    addCircuit,
    addEnginePiece,
    addExercise,
    removeBlock,
    moveBlock,
    patchBlock,
    linkSuperset,
    unlinkSuperset,
    lettered,
    compile,
    assignDate,
    unassignDate,
    planForDate,
    createCatalogExercise,
    createCatalogCircuit,
    searchCatalog,
    trackLabel,
  };

  root.HybridLibrary = HybridLibrary;
})(typeof window !== 'undefined' ? window : globalThis);
