(function (root) {
  const TRACK = root.TrainingCore.definitions;

  const SEED_EXERCISES = [
    ['bench_press','Bench Press','barbell','total','main',20,2.5],
    ['lat_pull_downs','Lat Pull Downs','machine','total','main'],
    ['back_squat','Back Squat','barbell','total','main',20,2.5],
    ['front_squat','Front Squat','barbell','total','main',20,2.5],
    ['snatch_grip_rack_deadlift','Snatch Grip Rack Deadlift','barbell','total','main',20,2.5],
    ['barbell_lateral_squat','Barbell Lateral Squat','barbell','total','main',20,2.5],
    ['goblet_box_squat','Goblet Box Squat','dumbbell','single','accessory',1],
    ['reverse_hypers','Reverse Hypers','machine','total','accessory'],
    ['double_leg_banded_leg_curls','Double Leg Banded Leg Curls','band','total','accessory'],
    ['garhammer_raises','Garhammer Raises','bodyweight','bodyweight','accessory'],
    ['farmer_carry','Farmer Carry','dumbbell','per_hand','carry',1],
    ['backwards_sled_drag','Backwards Sled Drag','sled','total','carry'],
  ];

  const SEED_CIRCUITS = [
    { title: 'Deadlift Warm-Up', instructions: 'Foam roll hamstrings\nActive straight leg raises' },
    { title: 'Bench Press Warm-Up', instructions: 'Foam roll pecs\nBiphasic pec stretch' },
    { title: 'Recovery Breathing', instructions: '10 nasal breaths\n5s inhale · 1s hold · 5s exhale' },
    { title: 'Cooldown', instructions: 'Worlds Greatest Stretch\nRecovery breathing' },
  ];

  function nid(prefix) {
    return prefix + '_' + Math.random().toString(36).slice(2, 9);
  }

  function clone(v) {
    return JSON.parse(JSON.stringify(v));
  }

  // Lower-body lifts step +5 kg on a barbell; everything else is upper (+2.5 kg).
  const LOWER=/squat|deadlift|\brdl\b|romanian|hip thrust|glute bridge|lunge|split squat|step.?up|leg press|good morning|swing|calf/i;
  function region(value){return LOWER.test(value)?'lower':'upper';}
  function inferredMetadata(title='') {
    const value=String(title),bodyRegion=region(value);
    const with_=m=>({...m,bodyRegion});
    if(/farmer|suitcase|carry/i.test(value))return with_({equipmentId:/dumbbell|\bdb\b/i.test(value)?'dumbbell':/kettlebell|\bkb\b/i.test(value)?'kettlebell':null,loadConvention:'per_hand',exerciseType:'carry'});
    if(/plank|\bhold\b/i.test(value))return with_({equipmentId:'bodyweight',loadConvention:'bodyweight',exerciseType:'hold'});
    if(/goblet/i.test(value))return with_({equipmentId:/kettlebell|\bkb\b/i.test(value)?'kettlebell':'dumbbell',loadConvention:'single',exerciseType:'accessory',minimumKg:/kettlebell|\bkb\b/i.test(value)?4:1});
    if(/dumbbell|\bdb\b/i.test(value))return with_({equipmentId:'dumbbell',loadConvention:'per_hand',exerciseType:/curl|extension|raise|fly|flye|calf|kickback/i.test(value)?'accessory':null,minimumKg:1});
    if(/kettlebell|\bkb\b/i.test(value))return with_({equipmentId:'kettlebell',loadConvention:'single',exerciseType:'accessory',minimumKg:4});
    if(/trap.?bar|hex.?bar/i.test(value))return with_({equipmentId:'barbell',loadConvention:'total',exerciseType:'main',minimumKg:25,barWeightKg:25,equipmentStepKg:2.5});
    if(/pull.?up|chin.?up|\bdips?\b|push.?up|inverted row/i.test(value))return with_({equipmentId:'bodyweight',loadConvention:'bodyweight',exerciseType:'main'});
    if(/barbell/i.test(value))return with_({equipmentId:'barbell',loadConvention:'total',minimumKg:20,equipmentStepKg:2.5,...(/squat|deadlift|bench|overhead press|\bohp\b/i.test(value)?{exerciseType:'main'}:{})});
    if(/^(?:back squat|front squat|bench press|snatch grip rack deadlift|deadlift|sumo deadlift|overhead press|ohp|military press|strict press|push press)$/i.test(value.trim()))return with_({equipmentId:'barbell',loadConvention:'total',exerciseType:'main',minimumKg:20,equipmentStepKg:2.5});
    if(/\brdl\b|romanian deadlift|hip thrust|good morning|pendlay row|bent.?over row|barbell row|incline bench|close.?grip bench|rack pull/i.test(value))return with_({equipmentId:'barbell',loadConvention:'total',minimumKg:20,equipmentStepKg:2.5});
    return {};
  }
  // Typed titles match the catalogue loosely; unmatched lifts get a stable title key.
  function titleKey(title=''){
    return String(title).toLowerCase().replace(/\((?:each side|per side)\)/g,' ').replace(/\bdb\b/g,'dumbbell').replace(/\bkb\b/g,'kettlebell').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,'_');
  }

  const LOAD_METADATA=['equipmentId','loadConvention','exerciseType','minimumKg','barWeightKg','equipmentStepKg','availableLoads','bodyRegion','startingKg'];

  function canonicalBlock(block) {
    const b={...block};
    // A legacy demo starting weight is the coach's cold-start load; keep it as startingKg.
    if(b.startingKg==null&&Number(b.demoStartingKg)>0)b.startingKg=Number(b.demoStartingKg);
    for(const key of ['repMin','repMax','targetReps','targetRepMax','targetEffort','demoStartingKg'])delete b[key];
    return b;
  }

  function exerciseRecord(exercise) {
    const inferred=inferredMetadata(exercise.title),merged={...inferred,...exercise};
    return Object.fromEntries(Object.entries(merged).filter(([,value])=>value!=null));
  }

  function seedCatalog() {
    return {
      exercises: SEED_EXERCISES.map(([id,title,equipmentId,loadConvention,exerciseType,minimumKg,equipmentStepKg]) => exerciseRecord({
        id:`ex_${id}`,title,equipmentId,loadConvention,exerciseType,minimumKg,equipmentStepKg,
        columns: title === 'Garhammer Raises' ? ['reps'] : ['reps', 'weight_kg'],
      })),
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
      templates: Array.isArray(state.templates) ? state.templates.filter((t) => !root.StrengthOnly?.isConditioning(t)).map((t) => ({ ...t, blocks: (t.blocks || []).filter((b) => ['lift', 'circuit'].includes(b.kind)).map(b => {
        const reps = parseRepTarget(b.repTarget);
        // Preserve ranges saved before Reps and Rep Range had separate entry rules.
        return canonicalBlock(reps && reps.min !== reps.max && (b.columns || []).includes('reps') && !(b.columns || []).includes('meters')
          ? { ...b, columns: b.columns.map(c => c === 'reps' ? 'reps_range' : c) } : b);
      }) })) : [],
      catalog: state.catalog && Array.isArray(state.catalog.exercises)
        ? {...state.catalog,exercises:state.catalog.exercises.map(exerciseRecord)}
        : seedCatalog(),
      assignments: state.assignments && typeof state.assignments === 'object' ? state.assignments : {},
    };
    const templateIds = new Set(next.templates.map(t => t.id));
    next.assignments = Object.fromEntries(Object.entries(next.assignments).filter(([, id]) => templateIds.has(id)));
    if (!next.catalog.exercises.length && !next.catalog.circuits.length) next.catalog = seedCatalog();
    const byId=new Map(next.catalog.exercises.map(x=>[x.id,x])),byTitle=new Map(next.catalog.exercises.map(x=>[String(x.title||'').trim().toLowerCase(),x]));
    for(const template of next.templates)for(const block of template.blocks||[])if(block.kind==='lift'){
      const hit=byId.get(block.exerciseId)||byTitle.get(String(block.title||'').trim().toLowerCase());
      if(hit){block.exerciseId=hit.id;for(const key of LOAD_METADATA)if(block[key]==null&&hit[key]!=null)block[key]=clone(hit[key]);}
      else Object.assign(block,{...inferredMetadata(block.title),...block});
    }
    return next;
  }

  function template(state, tid) {
    return (state.templates || []).find((t) => t.id === tid) || null;
  }

  function createTemplate(state, { title, instructions } = {}) {
    const st = clone(ensure(state));
    st.templates.unshift({
      id: nid('tpl'),
      title: String(title || 'Session Template').trim() || 'Session Template',
      instructions: String(instructions || ''),
      blocks: [],
    });
    [
      ['Bike', '180'],
      ['Row', '180'],
      ['Run', '180'],
      ['Ski', '180'],
      ['Jump Rope', '60'],
    ].forEach(([title, value]) => {
      Object.assign(st, addExercise(st, st.templates[0].id, {
        title, columns: ['seconds'], setCount: 3, value, role: 'warmup',
      }));
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

  function addExercise(state, tid, { title, setCount, columns, notes, catalogId, value, role, countIn, startingKg } = {}) {
    const st = clone(ensure(state));
    const t = st.templates.find((x) => x.id === tid);
    if (!t) return st;
    let cols = Array.isArray(columns) && columns.length ? columns.slice() : ['reps', 'weight_kg'];
    let name = title || 'Exercise';
    let metadata=inferredMetadata(name),exerciseId=null;
    if (catalogId) {
      const hit = st.catalog.exercises.find((c) => c.id === catalogId);
      if (hit) {
        name = hit.title;
        cols = (hit.columns || cols).slice();
        exerciseId=hit.id;metadata=exerciseRecord(hit);
      }
    }
    if(!exerciseId){
      const key=titleKey(name),hit=st.catalog.exercises.find(c=>titleKey(c.title)===key);
      if(hit){exerciseId=hit.id;metadata=exerciseRecord(hit);}else if(key)exerciseId='title:'+key;
    }
    const start=Number(startingKg);if(Number.isFinite(start)&&start>0)metadata={...metadata,startingKg:start};
    cols = cols.filter((k) => k && k !== 'none');
    if (!cols.length) cols = ['reps'];
    const tracksReps = cols.some((c) => c === 'reps' || c === 'reps_range');
    const prescribed = value != null && String(value).trim() ? String(value).trim() : '';
    const prepRole = role === 'warmup' || role === 'cooldown' ? role : null;
    if (prepRole === 'cooldown') {
      const allowed = cols.filter((c) => c === 'reps' || c === 'seconds');
      cols = allowed.length ? allowed : ['seconds'];
    }
    t.blocks.push({
      id: nid('blk'),
      kind: 'lift',
      title: name,
      setCount: Math.max(1, Number(setCount) || 3),
      repTarget: tracksReps && prescribed ? prescribed : (cols.includes('reps_range') ? '8-12' : '8'),
      prescribed: !tracksReps && prescribed ? prescribed : '',
      role: prepRole,
      countIn: Math.max(0, Number(countIn) || 0),
      perSide: /\(each side\)|each side$/i.test(name) || undefined,
      columns: cols,
      notes: Array.isArray(notes) ? notes : [],
      exerciseId,
      ...Object.fromEntries(LOAD_METADATA.filter(key=>metadata[key]!=null).map(key=>[key,clone(metadata[key])])),
      groupId: null,
    });
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
    for(const key of ['repMin','repMax','targetReps','targetRepMax','targetEffort','demoStartingKg'])delete b[key];
    if(b.restSec!=null){const r=Math.round(Number(b.restSec));if(Number.isFinite(r)&&r>=0&&r<=600)b.restSec=r;else delete b.restSec;}
    if(Object.prototype.hasOwnProperty.call(patch,'perSide'))b.perSide=!!patch.perSide;
    if (Array.isArray(b.columns)) b.columns = b.columns.filter((k) => k && k !== 'none');
    if (Array.isArray(patch.setTargets)) {
      const targets=root.StrengthTargets.normalize({...b,setTargets:patch.setTargets});
      b.setTargets=targets;b.setCount=targets.length;
      const first=targets.find(x=>x.purpose==='working');
      if(first?.reps)b.repTarget=first.reps.min===first.reps.max?String(first.reps.min):`${first.reps.min}-${first.reps.max}`;
    } else if ((patch.setCount!=null||patch.repTarget!=null) && Array.isArray(b.setTargets)) {
      delete b.setTargets;
    }
    return st;
  }

  function placeTextBlock(state, tid, { role, title, instructions } = {}) {
    const st = clone(ensure(state));
    const t = st.templates.find((x) => x.id === tid);
    if (!t || (role !== 'warmup' && role !== 'cooldown')) return st;
    t.blocks = (t.blocks || []).filter((b) => b.role !== role);
    const text = String(instructions || '').trim();
    if (!text) return st;
    const block = {
      id: nid('blk'),
      kind: 'circuit',
      role,
      title: title || (role === 'cooldown' ? 'Cool-down' : 'Warm-up'),
      instructions: text,
      track: 'for_completion',
    };
    if (role === 'cooldown') t.blocks.push(block);
    else t.blocks.unshift(block);
    return st;
  }

  function tempoText(value) {
    const chars = String(value || '').toUpperCase().replace(/[^0-9X]/g, '').slice(0, 4);
    return chars.length === 4 ? chars : '';
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
    const rank = b => b.role === 'warmup' ? 0 : b.role === 'cooldown' ? 2 : 1;
    const blocks = (tpl.blocks || []).map((b) => ({ ...b })).sort((a,b) => rank(a)-rank(b));
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

  const parseRepTarget = root.TrainingCore.repTarget;

  function rxFor(block) {
    if(Array.isArray(block.setTargets)&&!(block.columns||[]).includes('meters')){
      const text=t=>t.purpose==='amrap'?'AMRAP':t.reps.min===t.reps.max?String(t.reps.min):`${t.reps.min}-${t.reps.max}`;
      const work=block.setTargets.filter(t=>t.purpose!=='amrap').map(text);
      const same=work.length>0&&work.every(t=>t===work[0]);
      const body=same?`${work.length} x ${work[0]}`:work.join(' / ');
      return block.setTargets.some(t=>t.purpose==='amrap')?`${body} / AMRAP`:body;
    }
    const sets = Math.max(1, Number(block.setCount) || 3);
    const cols = block.columns || ['reps'];
    const hasReps = cols.some(c => c === 'reps' || c === 'reps_range');
    const repBit = hasReps ? (parseRepTarget(block.repTarget)?.text || (cols.includes('reps_range') ? '8-12' : '8')) : '';
    const prescribed = String(block.prescribed || '').trim();
    if (cols.includes('meters')) return prescribed ? `${sets} x ${prescribed} m` : (repBit ? `${sets} x ${repBit} m` : `${sets} x m`);
    if (hasReps) return `${sets} x ${repBit}`;
    if (cols[0] === 'seconds' || cols[0] === 'time_mmss') return prescribed ? `${sets} x ${prescribed} sec` : `${sets} x time`;
    return `${sets} sets`;
  }

  function sectionFor(block) {
    if (block.role === 'warmup') return 'Warm-Up';
    if (block.role === 'cooldown') return 'Cool-Down';
    if (block.kind === 'circuit') {
      if (/recover|cool/i.test(block.title || '')) return 'Recovery';
      return 'Warm-Up';
    }
    return 'Strength/Power';
  }

  function compile(tpl) {
    const blocks = [];
    let lastSection = '';
    for (const b of lettered({ ...tpl, blocks: (tpl.blocks || []).filter((b) => ['lift', 'circuit'].includes(b.kind)) })) {
      const section = sectionFor(b);
      if (section !== lastSection) {
        blocks.push({ kind: 'section', label: section.toUpperCase() });
        lastSection = section;
      }
      if (b.kind === 'circuit') {
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
      } else {
        let columns = (b.columns || ['reps']).slice();
        const hasReps=columns.some(c=>c==='reps'||c==='reps_range');
        const targetInput={...b,columns,repTarget:b.repTarget||(columns.includes('reps_range')?'8-12':'8')};
        const setTargets=hasReps?root.StrengthTargets.normalize(targetInput):null;
        const rx = rxFor(Array.isArray(b.setTargets)?{...b,setTargets}:b);
        const tempo = tempoText(b.tempo);
        blocks.push({
          kind: 'lift',
          targetContractVersion: 2,
          letter: b.letter,
          title: b.title,
          prescription: tempo ? `${rx} · ${tempo}` : rx,
          tempo: tempo || undefined,
          prescribed: b.prescribed || '',
          countIn: Number(b.countIn) || 0,
          role: b.role || null,
          setTargets: setTargets?clone(setTargets):null,
          notes: b.notes || [],
          columns,
          setCount: setTargets?.length||b.setCount,
          exerciseId: b.exerciseId,
          equipmentId: b.equipmentId,
          equipmentStepKg: b.equipmentStepKg,
          availableLoads: b.availableLoads,
          minimumKg: b.minimumKg,
          barWeightKg: b.barWeightKg,
          loadConvention: b.loadConvention,
          exerciseType: b.exerciseType,
          rampCount: b.rampCount,
          bodyRegion: b.bodyRegion,
          startingKg: b.startingKg,
          section,
        });
      }
    }
    return {
      id: tpl.id,
      title: tpl.title || 'Session Template',
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

  function createCatalogExercise(state, { title, columns, ...metadata } = {}) {
    const st = clone(ensure(state));
    const cols = (columns || ['reps']).filter((k) => k && k !== 'none');
    st.catalog.exercises.unshift(exerciseRecord({
      ...Object.fromEntries(LOAD_METADATA.filter(key=>metadata[key]!=null).map(key=>[key,clone(metadata[key])])),
      id: nid('ex'),
      title: String(title || 'Exercise').trim() || 'Exercise',
      columns: cols.length ? cols : ['reps'],
    }));
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
    const list = (tab === 'circuits' ? st.catalog.circuits : st.catalog.exercises).filter(x=>!x.coachHidden);
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
    addExercise,
    removeBlock,
    moveBlock,
    patchBlock,
    placeTextBlock,
    tempoText,
    linkSuperset,
    unlinkSuperset,
    lettered,
    compile,
    parseRepTarget,
    rxFor,
    assignDate,
    unassignDate,
    planForDate,
    createCatalogExercise,
    createCatalogCircuit,
    searchCatalog,
    trackLabel,
  };

  root.HybridLibrary = HybridLibrary;
})(typeof window !== 'undefined' ? window.CoachBuilderHost : globalThis);
