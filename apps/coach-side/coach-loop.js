/**
 * THE Hybrid System — coaching loop (local-first).
 *
 * Same session / block / exercise / set-row shape as the Hybrid HTML athlete
 * app. Adds roster, teams, week×day programs, assignment, feed metrics, and
 * session notes. Zero network. Inject storage in tests.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CoachLoop = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const STORAGE = 'THE-coach-loop-v1';
  const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const BLOCK_CATEGORIES = [
    'Uncategorized',
    'Prep',
    'Speed/Agility',
    'Skill/Tech',
    'Strength/Power',
    'Conditioning',
    'Recovery',
  ];
  const SCORING = ['completion', 'weight'];
  const METRICS = ['Reps', 'Weight', 'Time', 'Distance', 'RPE', 'Watts'];
  const COND_FORMATS = [
    { key: 'steady', name: 'Steady-state', type: 'easy' },
    { key: 'intervals', name: 'Intervals', type: 'intervals', rounds: 4, workSec: 240, restSec: 180 },
    { key: 'tempo', name: 'Tempo', type: 'intervals', rounds: 10, workSec: 15, restSec: 60 },
    { key: 'free', name: 'Free run', type: 'easy' },
    { key: 'custom', name: 'Custom', type: 'custom', rounds: 6, workSec: 40, restSec: 80 },
  ];
  const COND_MODALITIES = ['Run', 'Walk', 'Bike', 'Rower', 'Ski erg', 'Circuit', 'Other'];
  const COND_EFFORTS = [
    { key: 'easy', name: 'Easy', zoneKey: 'recovery', rpe: '3–4', cue: 'full sentences' },
    { key: 'medium', name: 'Medium', zoneKey: 'aerobic', rpe: '5–7', cue: 'short sentences' },
    { key: 'hard', name: 'Hard', zoneKey: 'anaerobic', rpe: '8–9.5', cue: 'a few words at a time' },
  ];

  const REMOVED_DEMO_ATHLETE_IDS = ['ath-alex-chen', 'ath-jordan-hale'];
  const REMOVED_DEMO_ACCOUNT_IDS = ['acct-alex', 'acct-jordan'];

  const IDS = {
    coachAccount: 'acct-dan',
    coach: 'coach-dan',
    athleteDan: 'ath-dan-veldman',
    team: 'team-hybrid-sc',
    program: 'prog-hybrid-base',
    tplStrength: 'tpl-full-body-strength',
    tplCond: 'tpl-aerobic-cond',
    tplRecovery: 'tpl-recovery',
    logged: 'ses-logged-w1d1',
  };

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

  function localDate(d) {
    const x = d instanceof Date ? d : new Date(d);
    const tz = x.getTimezoneOffset() * 60000;
    return new Date(x.getTime() - tz).toISOString().slice(0, 10);
  }

  function today(clock) {
    return localDate(clock ? clock() : new Date());
  }

  function addDays(key, n) {
    const d = new Date(key + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return localDate(d);
  }

  function mondayOf(key) {
    const d = new Date(key + 'T00:00:00');
    const m = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - m);
    return localDate(d);
  }

  function dayIndex(key) {
    return (new Date(key + 'T00:00:00').getDay() + 6) % 7; // 0=Mon
  }

  function dateLabel(key) {
    return new Date(key + 'T00:00:00').toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function cellKey(week, day) {
    return week + '-' + day;
  }

  function parseCellKey(k) {
    const [w, d] = String(k).split('-').map(Number);
    return { week: w, day: d };
  }

  function splitList(raw) {
    return String(raw == null ? '' : raw)
      .split(',')
      .map((x) => x.trim())
      .filter((x, i, a) => a.length > 1 || x !== '' || i === 0);
  }

  function parseFirstNumber(raw) {
    const m = String(raw || '').match(/(\d+(?:\.\d+)?)/);
    return m ? Number(m[1]) : 0;
  }

  function targetList(ex) {
    const count = Math.max(1, num(ex.sets) || 1);
    let parts = splitList(ex.reps);
    if (!parts.length || (parts.length === 1 && parts[0] === '')) parts = [''];
    if (parts.length === 1) parts = Array.from({ length: count }, () => parts[0]);
    while (parts.length < count) parts.push(parts[parts.length - 1]);
    return parts.slice(0, count);
  }

  function loadList(ex) {
    const count = Math.max(1, num(ex.sets) || 1);
    let parts = splitList(ex.load);
    if (!parts.length) parts = [''];
    if (parts.length === 1) parts = Array.from({ length: count }, () => parts[0]);
    while (parts.length < count) parts.push(parts[parts.length - 1] || '');
    return parts.slice(0, count);
  }

  function makeRows(ex) {
    const targets = targetList(ex);
    const loads = loadList(ex);
    return targets.map((target, i) => ({
      id: uid('row'),
      n: i + 1,
      target,
      targetKind: /s(ec(onds?)?)?$/i.test(String(target)) ? 'seconds' : 'reps',
      weight: '',
      reps: '',
      prescribedLoad: loads[i] || '',
      done: false,
      extra: false,
    }));
  }

  function ensureRows(ex) {
    if (!Array.isArray(ex.rows) || !ex.rows.length) ex.rows = makeRows(ex);
    return ex;
  }

  function isWorkBlock(block) {
    if (!block) return false;
    if (block.type === 'strength' || block.type === 'conditioning') return true;
    if (block.type === 'text') return String(block.notes || '').trim().length > 0;
    return false;
  }

  function letterBlocks(blocks) {
    let next = 0;
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const out = [];
    let i = 0;
    while (i < (blocks || []).length) {
      const block = clone(blocks[i]);
      delete block.supersetPartner;

      if (!isWorkBlock(block) && block.type === 'text') {
        block.letter = '';
        out.push(block);
        i += 1;
        continue;
      }

      const ch = letters[next] || String(next + 1);

      if (block.superset && (block.exercises || []).length > 1) {
        block.letters = (block.exercises || []).map((_, j) => ch + (j + 1));
        block.letter = block.letters.join('/');
        out.push(block);
        next += 1;
        i += 1;
        continue;
      }

      const nextBlock = blocks[i + 1];
      const nextIsStrength =
        nextBlock &&
        nextBlock.type === 'strength' &&
        !nextBlock.recoverySession;

      if (block.superset && block.type === 'strength' && nextIsStrength) {
        block.letter = ch + '1';
        block.letters = [ch + '1'];
        out.push(block);

        const partner = clone(nextBlock);
        partner.letter = ch + '2';
        partner.letters = [ch + '2'];
        partner.supersetPartner = true;
        out.push(partner);
        next += 1;
        i += 2;
        continue;
      }

      block.letter = ch;
      block.letters = [ch];
      out.push(block);
      next += 1;
      i += 1;
    }
    return out;
  }

  function categoryForBlock(block) {
    if (block.category && BLOCK_CATEGORIES.includes(block.category)) return block.category;
    if (block.type === 'conditioning') return 'Conditioning';
    if (block.type === 'text') {
      const h = String(block.heading || '').toLowerCase();
      if (/cool|recover|breath/.test(h)) return 'Recovery';
      return 'Prep';
    }
    if (/speed|agility/.test(String(block.heading || '').toLowerCase())) return 'Speed/Agility';
    return 'Strength/Power';
  }

  function scoringForBlock(block) {
    if (block.scoring === 'weight' || block.scoring === 'completion') return block.scoring;
    return block.type === 'strength' ? 'weight' : 'completion';
  }

  /** Keep strength / conditioning / recovery / prep text distinct for athlete flatten. */
  function normalizeBlockType(block) {
    if (!block) return block;
    const cat = String(block.category || '').toLowerCase();
    const heading = String(block.heading || '').toLowerCase();
    const hasEx = (block.exercises || []).length > 0;
    const isRecovery =
      !!block.recoverySession || cat === 'recovery' || /recover|debt repay|easy flush/.test(heading);
    const hasCond =
      block.type === 'conditioning' ||
      !!block.condFmt ||
      !!block.conditioningType ||
      !!block.effort ||
      (!!block.modality && !hasEx);

    if (block.type === 'text' && !hasEx) return block;

    if (isRecovery || (hasCond && !hasEx)) {
      block.type = 'conditioning';
      block.scoring = 'completion';
      if (isRecovery) {
        block.recoverySession = true;
        block.category = block.category || 'Recovery';
        block.effort = block.effort || 'easy';
        block.condFmt = block.condFmt || 'steady';
        block.modality = block.modality || 'Mixed';
        if (!block.baselineDurationMin) {
          block.baselineDurationMin = num(block.targetDurationMin) || 30;
        }
        if (!block.targetDurationMin) block.targetDurationMin = block.baselineDurationMin;
      }
      delete block.exercises;
      applyCondBuilderToBlock(block);
      if (isRecovery) {
        block.recoverySession = true;
        block.category = 'Recovery';
      }
      return block;
    }

    if (hasEx || block.type === 'strength') {
      delete block.recoverySession;
      block.type = 'strength';
      block.scoring = block.scoring || 'weight';
      return block;
    }

    if (block.modality || block.targetDurationMin) {
      block.type = 'conditioning';
      block.scoring = 'completion';
      applyCondBuilderToBlock(block);
    }
    return block;
  }

  function decorateBlocks(blocks) {
    return letterBlocks(blocks).map((b) => {
      normalizeBlockType(b);
      b.category = categoryForBlock(b);
      b.scoring = scoringForBlock(b);
      b.complete = !!b.complete;
      if (b.type === 'strength') (b.exercises || []).forEach(ensureRows);
      return b;
    });
  }

  function volumeFromRows(rows) {
    return (rows || [])
      .filter((r) => r.done && r.targetKind !== 'seconds')
      .reduce((a, r) => a + num(r.weight) * num(r.reps), 0);
  }

  function sessionRows(session) {
    const out = [];
    for (const b of session.blocks || []) {
      for (const ex of b.exercises || []) {
        ensureRows(ex);
        for (const row of ex.rows || []) out.push(row);
      }
    }
    return out;
  }

  function volumeKg(session) {
    return Math.round(volumeFromRows(sessionRows(session)));
  }

  function prescribedTonnage(session) {
    let t = 0;
    for (const b of session.blocks || []) {
      for (const ex of b.exercises || []) {
        const reps = targetList(ex);
        const loads = loadList(ex);
        reps.forEach((rep, i) => {
          t += parseFirstNumber(rep) * parseFirstNumber(loads[i] || loads[0]);
        });
      }
    }
    return t;
  }

  function intensityPct(session) {
    if (session.intensity != null && session.intensity !== '') return num(session.intensity);
    const actual = volumeKg(session);
    const prescribed = prescribedTonnage(session);
    if (!actual || !prescribed) return null;
    return Math.round((100 * actual) / prescribed);
  }

  function blockProgress(session) {
    const blocks = (session.blocks || []).filter(isWorkBlock);
    const done = blocks.filter((b) => blockIsComplete(b)).length;
    return { done, total: blocks.length };
  }

  function blockIsComplete(block) {
    if (block.complete) return true;
    if (block.type === 'text') return !!block.complete;
    if (block.type === 'conditioning') return !!block.complete;
    const exercises = block.exercises || [];
    if (!exercises.length) return false;
    return exercises.every((ex) => {
      ensureRows(ex);
      const rows = ex.rows || [];
      return rows.length && rows.every((r) => r.done);
    });
  }

  function remainingSummary(session) {
    const blocks = (session.blocks || []).filter(isWorkBlock);
    const left = blocks.filter((b) => !blockIsComplete(b));
    return {
      blocksLeft: left.length,
      setsLeft: sessionRows(session).filter((r) => !r.done).length,
    };
  }

  function feedMetrics(session) {
    const prog = blockProgress(session);
    const intensity = intensityPct(session);
    const minutes = session.minutes == null || session.minutes === '' ? null : num(session.minutes);
    const readiness = session.readiness == null || session.readiness === '' ? null : num(session.readiness);
    return {
      blocksDone: prog.done,
      blocksTotal: prog.total,
      readiness,
      minutes,
      intensity,
      volumeKg: volumeKg(session),
    };
  }

  function groupFeed(sessions, athletes) {
    const byDate = {};
    for (const s of sessions || []) {
      if (s.status !== 'completed' && s.status !== 'active' && !sessionHasLog(s)) continue;
      const k = s.date;
      if (!byDate[k]) byDate[k] = [];
      const athlete = (athletes || []).find((a) => a.id === s.athleteId);
      byDate[k].push({
        session: s,
        athlete,
        metrics: feedMetrics(s),
      });
    }
    return Object.keys(byDate)
      .sort((a, b) => (a < b ? 1 : -1))
      .map((date) => ({ date, label: dateLabel(date), cards: byDate[date] }));
  }

  function sessionHasLog(session) {
    if (session.status === 'completed' || session.status === 'active') return true;
    return sessionRows(session).some((r) => r.done || num(r.weight) || num(r.reps));
  }

  function isAutopilotVolume(partial) {
    if (partial && partial.autopilotVolume === true) return true;
    if (partial && partial.autopilotVolume === false) return false;
    const hasSets = partial && partial.sets != null && partial.sets !== '';
    const hasReps = partial && partial.reps != null && String(partial.reps).trim() !== '';
    return !hasSets && !hasReps;
  }

  function makeExercise(partial) {
    partial = partial || {};
    const autopilotVol = isAutopilotVolume(partial);
    const ex = {
      id: partial.id || uid('ex'),
      name: partial.name,
      exerciseId: partial.exerciseId || '',
      category: partial.category || '',
      autopilotVolume: autopilotVol,
      sets: autopilotVol ? null : (partial.sets == null ? 3 : partial.sets),
      reps: autopilotVol ? null : (partial.reps == null ? '8' : String(partial.reps)),
      load: partial.load == null ? '' : String(partial.load),
      metric: partial.metric || 'Weight',
      restSec: partial.restSec == null ? 90 : partial.restSec,
      coachNote: partial.coachNote || '',
      athleteNote: partial.athleteNote || '',
      swappedFrom: partial.swappedFrom || null,
      logColumns: partial.logColumns || null,
      loadExpr: partial.loadExpr || null,
    };
    if (partial.targetRir != null && partial.targetRir !== '' && Number.isFinite(Number(partial.targetRir))) {
      ex.targetRir = Math.max(0, Math.min(10, Math.round(Number(partial.targetRir))));
    }
    if (!autopilotVol) ensureRows(ex);
    return ex;
  }

  /** Parse reps like "6-8" for in-session very_easy rep bumps. */
  function parseRepRange(reps) {
    const s = String(reps || '').trim();
    const m = s.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (!m) return null;
    const lo = Number(m[1]);
    const hi = Number(m[2]);
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi < lo) return null;
    return { lo, hi };
  }

  function formatMmSs(sec) {
    sec = Math.max(0, Math.round(num(sec) || 0));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m + ':' + String(s).padStart(2, '0');
  }

  function parseMmSs(raw) {
    raw = String(raw == null ? '' : raw).trim();
    if (!raw) return 0;
    if (/^\d+$/.test(raw)) return Math.max(0, num(raw));
    const m = raw.match(/^(\d+)\s*:\s*(\d{1,2})$/);
    if (m) return Math.max(0, num(m[1]) * 60 + Math.min(59, num(m[2])));
    return Math.max(0, Math.round(num(raw) || 0));
  }

  function condFormatMeta(key) {
    return COND_FORMATS.find((f) => f.key === key) || COND_FORMATS[0];
  }

  function condEffortMeta(key) {
    return COND_EFFORTS.find((e) => e.key === key) || COND_EFFORTS[0];
  }

  function fmtNeedsIntervalFields(fmt) {
    fmt = typeof fmt === 'string' ? condFormatMeta(fmt) : fmt || condFormatMeta('steady');
    return fmt.key === 'intervals' || fmt.key === 'tempo' || fmt.key === 'custom';
  }

  function condIntervalTotalMin(b) {
    const rounds = Math.max(1, num(b.rounds) || 1);
    const work = Math.max(0, num(b.workSec) || 0);
    const rest = Math.max(0, num(b.restSec) || 0);
    return Math.round(((rounds * (work + rest)) / 60) * 10) / 10;
  }

  function condPlanLineFromParts(opts) {
    opts = opts || {};
    const mod = opts.modality || '—';
    const effort = condEffortMeta(opts.effort || 'easy');
    const fmtKey = opts.fmt || opts.condFmt || 'steady';
    const fmt = condFormatMeta(fmtKey);
    const intervalish =
      fmtNeedsIntervalFields(fmt) ||
      (num(opts.workSec) > 0 &&
        (num(opts.rounds) > 1 || fmtKey === 'intervals' || fmtKey === 'tempo' || fmtKey === 'custom'));
    if (intervalish) {
      return `${mod} · ${opts.rounds || 1}×${formatMmSs(opts.workSec)} / ${formatMmSs(opts.restSec)} · ${effort.name}`;
    }
    const mins =
      opts.minutes != null && opts.minutes !== ''
        ? opts.minutes
        : opts.targetDurationMin || opts.timeCapMin || '—';
    return `${mod} · ${mins} min · ${effort.name}`;
  }

  function condPlanLineBlock(block) {
    if (!block) return '';
    return condPlanLineFromParts({
      modality: block.modality,
      effort: block.effort || 'easy',
      fmt: block.condFmt || 'steady',
      rounds: block.rounds,
      workSec: block.workSec,
      restSec: block.restSec,
      minutes: block.targetDurationMin || block.timeCapMin,
      targetDurationMin: block.targetDurationMin,
      timeCapMin: block.timeCapMin,
    });
  }

  function applyCondBuilderToBlock(block, patch) {
    patch = patch || {};
    const fmt = condFormatMeta(patch.condFmt || block.condFmt || 'steady');
    const effort = condEffortMeta(patch.effort || block.effort || 'easy');
    const modality = patch.modality != null ? patch.modality : block.modality || 'Bike';
    const interval = fmtNeedsIntervalFields(fmt);
    let minutes = patch.targetDurationMin != null ? num(patch.targetDurationMin) : num(block.targetDurationMin) || 20;
    let rounds = patch.rounds != null ? num(patch.rounds) : num(block.rounds) || fmt.rounds || 1;
    let workSec = patch.workSec != null ? num(patch.workSec) : num(block.workSec) || fmt.workSec || 0;
    let restSec = patch.restSec != null ? num(patch.restSec) : num(block.restSec) || fmt.restSec || 0;
    if (interval && !workSec) workSec = fmt.workSec || 240;
    if (interval && restSec == null) restSec = fmt.restSec || 180;
    if (interval) minutes = condIntervalTotalMin({ rounds, workSec, restSec });
    const keepRecovery = !!block.recoverySession;
    block.type = 'conditioning';
    block.category = keepRecovery ? 'Recovery' : 'Conditioning';
    block.scoring = 'completion';
    if (keepRecovery) block.recoverySession = true;
    block.heading = patch.heading != null ? patch.heading : block.heading || fmt.name;
    block.condFmt = fmt.key;
    block.conditioningType = fmt.type;
    block.effort = effort.key;
    block.modality = modality;
    block.targetDurationMin = minutes;
    block.timeCapMin = minutes;
    block.rounds = Math.max(1, rounds || 1);
    block.workSec = Math.max(0, workSec || 0);
    block.restSec = Math.max(0, restSec || 0);
    if (patch.targetWatts != null) {
      if (patch.targetWatts === '' || num(patch.targetWatts) === 0) delete block.targetWatts;
      else block.targetWatts = patch.targetWatts;
    }
    if (patch.notes != null) block.notes = patch.notes;
    block.planLine = condPlanLineBlock(block);
    return block;
  }

  function makeBlock(partial) {
    const block = {
      id: partial.id || uid('blk'),
      type: partial.type || 'strength',
      heading: partial.heading || 'Block',
      notes: partial.notes || '',
      superset: !!partial.superset,
      category: partial.category || '',
      scoring: partial.scoring || '',
      complete: !!partial.complete,
      exercises: (partial.exercises || []).map(makeExercise),
      conditioningType: partial.conditioningType || '',
      modality: partial.modality || '',
      targetDurationMin: partial.targetDurationMin || 0,
      timeCapMin: partial.timeCapMin || partial.targetDurationMin || 0,
      effort: partial.effort || '',
      condFmt: partial.condFmt || '',
      rounds: partial.rounds == null ? 1 : partial.rounds,
      workSec: partial.workSec || 0,
      restSec: partial.restSec || 0,
      targetWatts: partial.targetWatts == null ? '' : partial.targetWatts,
      planLine: partial.planLine || '',
      recoverySession: !!partial.recoverySession,
      baselineDurationMin: partial.baselineDurationMin == null ? 0 : num(partial.baselineDurationMin),
    };
    if (block.type === 'conditioning') applyCondBuilderToBlock(block);
    return normalizeBlockType(block);
  }

  function makeTemplate(partial) {
    return {
      id: partial.id || uid('tpl'),
      name: partial.name || 'Untitled session',
      coachInstructions: partial.coachInstructions || '',
      blocks: decorateBlocks((partial.blocks || []).map(makeBlock)),
    };
  }

  function instantiateSession(template, opts) {
    const blocks = decorateBlocks(clone(template.blocks || []));
    blocks.forEach((b) => {
      b.complete = false;
      (b.exercises || []).forEach((ex) => {
        ex.rows = makeRows(ex);
        ex.athleteNote = '';
      });
    });
    return {
      id: opts.id || uid('ses'),
      athleteId: opts.athleteId,
      date: opts.date,
      name: opts.name || template.name,
      templateId: template.id,
      programId: opts.programId || null,
      week: opts.week || null,
      day: opts.day || null,
      status: opts.status || 'scheduled',
      published: opts.published === true,
      publishedAt: opts.published ? new Date().toISOString() : null,
      coachInstructions: template.coachInstructions || '',
      blocks,
      notes: '',
      comment: null,
      readiness: null,
      minutes: null,
      intensity: null,
      completedAt: null,
    };
  }

  function logSet(session, blockId, exerciseId, rowIndex, patch) {
    const block = (session.blocks || []).find((b) => b.id === blockId);
    if (!block) throw new Error('block not found');
    const ex = (block.exercises || []).find((e) => e.id === exerciseId);
    if (!ex) throw new Error('exercise not found');
    ensureRows(ex);
    const row = ex.rows[rowIndex];
    if (!row) throw new Error('set not found');
    if (patch.reps != null) row.reps = String(patch.reps);
    if (patch.weight != null) row.weight = String(patch.weight);
    if (patch.done != null) row.done = !!patch.done;
    if (row.reps !== '' || row.weight !== '') {
      if (patch.done === undefined) row.done = true;
    }
    if (session.status === 'scheduled') session.status = 'active';
    return session;
  }

  function logSetArrays(session, blockId, exerciseId, repsCsv, loadCsv) {
    const block = (session.blocks || []).find((b) => b.id === blockId);
    const ex = (block.exercises || []).find((e) => e.id === exerciseId);
    ensureRows(ex);
    const reps = splitList(repsCsv);
    const loads = splitList(loadCsv);
    ex.rows.forEach((row, i) => {
      if (reps[i] != null && reps[i] !== '') row.reps = reps[i];
      if (loads[i] != null && loads[i] !== '') row.weight = loads[i];
      if (row.reps !== '' || row.weight !== '') row.done = true;
    });
    if (session.status === 'scheduled') session.status = 'active';
    return session;
  }

  function completeBlock(session, blockId, done) {
    const block = (session.blocks || []).find((b) => b.id === blockId);
    if (!block) throw new Error('block not found');
    block.complete = done !== false;
    if (block.complete && block.exercises) {
      block.exercises.forEach((ex) => {
        ensureRows(ex);
        ex.rows.forEach((row) => {
          if (!row.done) {
            if (row.reps === '') row.reps = String(parseFirstNumber(row.target) || '');
            if (row.weight === '') row.weight = String(parseFirstNumber(row.prescribedLoad) || '');
            row.done = true;
          }
        });
      });
    }
    if (session.status === 'scheduled') session.status = 'active';
    const prog = blockProgress(session);
    if (prog.total && prog.done === prog.total) {
      session.status = 'completed';
      session.completedAt = session.completedAt || new Date().toISOString();
    }
    return session;
  }

  function swapExercise(session, blockId, exerciseId, next, note) {
    const block = (session.blocks || []).find((b) => b.id === blockId);
    const ex = (block.exercises || []).find((e) => e.id === exerciseId);
    if (!ex) throw new Error('exercise not found');
    ex.swappedFrom = { name: ex.name, exerciseId: ex.exerciseId };
    ex.name = next.name;
    ex.exerciseId = next.exerciseId || next.id || '';
    ex.category = next.category || ex.category;
    if (note) ex.athleteNote = note;
    return session;
  }

  function setSessionComment(session, text, coachId) {
    session.comment = {
      text: String(text || '').trim(),
      at: new Date().toISOString(),
      coachId: coachId || IDS.coach,
    };
    return session;
  }

  function emptyProgram(name, weeks) {
    return {
      id: uid('prog'),
      name: name || 'New program',
      weeks: Math.max(1, weeks || 4),
      cells: {},
    };
  }

  function setProgramCell(program, week, day, templateId) {
    const key = cellKey(week, day);
    if (!templateId) delete program.cells[key];
    else program.cells[key] = templateId;
    return program;
  }

  /** Move template from one grid cell to another; swap if target is occupied. */
  function moveProgramCell(program, fromWeek, fromDay, toWeek, toDay) {
    const fromKey = cellKey(fromWeek, fromDay);
    const toKey = cellKey(toWeek, toDay);
    const moving = (program.cells || {})[fromKey];
    if (!moving) return program;
    const displaced = (program.cells || {})[toKey] || null;
    if (displaced) {
      program.cells[toKey] = moving;
      program.cells[fromKey] = displaced;
    } else {
      program.cells[toKey] = moving;
      delete program.cells[fromKey];
    }
    return program;
  }

  function addProgramWeek(program) {
    program.weeks = num(program.weeks) + 1;
    return program;
  }

  function assignProgram(state, opts) {
    const program = (state.programs || []).find((p) => p.id === opts.programId);
    if (!program) throw new Error('program not found');
    let athleteIds = opts.athleteIds ? opts.athleteIds.slice() : [];
    if (opts.teamId) {
      const team = (state.teams || []).find((t) => t.id === opts.teamId);
      if (!team) throw new Error('team not found');
      athleteIds = athleteIds.concat(team.athleteIds || []);
    }
    athleteIds = [...new Set(athleteIds)];
    const start = mondayOf(opts.startDate || today());
    const created = [];
    for (const [key, templateId] of Object.entries(program.cells || {})) {
      const { week, day } = parseCellKey(key);
      const template = (state.templates || []).find((t) => t.id === templateId);
      if (!template) continue;
      const date = addDays(start, (week - 1) * 7 + (day - 1));
      for (const athleteId of athleteIds) {
        const existsIdx = (state.sessions || []).findIndex(
          (s) =>
            s.athleteId === athleteId &&
            s.date === date &&
            s.templateId === templateId,
        );
        if (existsIdx >= 0) {
          const cur = state.sessions[existsIdx];
          if (cur.status === 'active' || cur.status === 'completed' || cur.published) continue;
          const refreshed = instantiateSession(template, {
            athleteId,
            date,
            programId: program.id,
            week,
            day,
            name: week && day ? `Week ${week} Day ${day}` : template.name,
          });
          refreshed.sessionTitle = template.name;
          refreshed.id = cur.id;
          state.sessions[existsIdx] = refreshed;
          continue;
        }
        const session = instantiateSession(template, {
          athleteId,
          date,
          programId: program.id,
          week,
          day,
          name: week && day ? `Week ${week} Day ${day}` : template.name,
        });
        session.sessionTitle = template.name;
        state.sessions.push(session);
        created.push(session);
      }
    }
    state.assignments = state.assignments || [];
    state.assignments.push({
      id: uid('asg'),
      programId: program.id,
      teamId: opts.teamId || null,
      athleteIds,
      startDate: start,
      createdAt: new Date().toISOString(),
    });
    return { state, created, start };
  }

  function publishSession(session) {
    if (!session) return session;
    session.published = true;
    session.publishedAt = new Date().toISOString();
    return session;
  }

  function unpublishSession(session) {
    if (!session) return session;
    session.published = false;
    session.publishedAt = null;
    return session;
  }

  function publishAllSessions(sessions) {
    (sessions || []).forEach(publishSession);
    return sessions;
  }

  function hasUnpublished(sessions) {
    return (sessions || []).some((s) => !s.published && s.status !== 'completed');
  }

  function athleteAccountEmail(state, athleteId) {
    const acct = (state.accounts || []).find((a) => a.athleteId === athleteId);
    return acct ? acct.email : null;
  }

  function addCalendarSession(state, opts) {
    const template = (state.templates || []).find((t) => t.id === opts.templateId);
    if (!template) throw new Error('template not found');
    const exists = (state.sessions || []).some(
      (s) =>
        s.athleteId === opts.athleteId &&
        s.date === opts.date &&
        s.templateId === opts.templateId,
    );
    if (exists) return null;
    const session = instantiateSession(template, {
      athleteId: opts.athleteId,
      date: opts.date,
      name: opts.name || template.name,
      status: 'scheduled',
      published: false,
    });
    session.sessionTitle = template.name;
    state.sessions.push(session);
    return session;
  }

  function monthDays(monthKey) {
    const parts = String(monthKey || today().slice(0, 7)).split('-').map(Number);
    const y = parts[0];
    const m = parts[1];
    const last = new Date(y, m, 0).getDate();
    const pad = (n) => String(n).padStart(2, '0');
    const days = [];
    for (let d = 1; d <= last; d++) days.push(`${y}-${pad(m)}-${pad(d)}`);
    return days;
  }

  /** Mon–Sun grid cells; null = padding before/after month. */
  function monthGridCells(monthKey) {
    const parts = String(monthKey || today().slice(0, 7)).split('-').map(Number);
    let y = parts[0];
    let m = parts[1];
    if (!y || !m || m < 1 || m > 12) {
      const fb = today().slice(0, 7).split('-').map(Number);
      y = fb[0];
      m = fb[1];
    }
    const pad = (n) => String(n).padStart(2, '0');
    const first = new Date(y, m - 1, 1);
    const startOffset = (first.getDay() + 6) % 7;
    const last = new Date(y, m, 0).getDate();
    const cells = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= last; d++) cells.push(`${y}-${pad(m)}-${pad(d)}`);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }

  function shiftMonth(monthKey, delta) {
    const parts = String(monthKey || today().slice(0, 7)).split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1 + num(delta), 1);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  }

  function monthLabel(monthKey) {
    const parts = String(monthKey || '').split('-').map(Number);
    try {
      return new Date(parts[0], parts[1] - 1, 1).toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return monthKey;
    }
  }

  function sessionsOnDate(state, athleteId, date) {
    return (state.sessions || []).filter((s) => s.athleteId === athleteId && s.date === date);
  }

  function needsProgramming(state) {
    const start = today();
    const horizon = addDays(start, 21);
    const athletes = state.athletes || [];
    const needAthletes = athletes.filter((a) => {
      const inHorizon = (state.sessions || []).filter(
        (s) =>
          s.athleteId === a.id &&
          s.date >= start &&
          s.date <= horizon &&
          s.status !== 'completed',
      );
      if (!inHorizon.length) {
        const hasFuturePublished = (state.sessions || []).some(
          (s) =>
            s.athleteId === a.id &&
            s.date >= start &&
            s.published &&
            s.status !== 'completed',
        );
        if (hasFuturePublished) return false;
        const hasCompletedInHorizon = (state.sessions || []).some(
          (s) =>
            s.athleteId === a.id &&
            s.date >= start &&
            s.date <= horizon &&
            s.status === 'completed',
        );
        if (hasCompletedInHorizon) return false;
        return true;
      }
      return inHorizon.some((s) => !s.published);
    });
    return { athletes: needAthletes, teams: [] };
  }

  function calendarFor(state, athleteId, monthKey) {
    const prefix = monthKey || today().slice(0, 7);
    return (state.sessions || [])
      .filter((s) => s.athleteId === athleteId && String(s.date).startsWith(prefix))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  function teamCalendar(state, teamId, monthKey) {
    const team = (state.teams || []).find((t) => t.id === teamId);
    const ids = new Set(team ? team.athleteIds : []);
    const prefix = monthKey || today().slice(0, 7);
    return (state.sessions || [])
      .filter((s) => ids.has(s.athleteId) && String(s.date).startsWith(prefix))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  function todaySession(state, athleteId, date) {
    const d = date || today();
    const list = (state.sessions || []).filter((s) => s.athleteId === athleteId && s.date === d);
    return list.find((s) => s.status === 'active') || list[0] || null;
  }

  function login(state, email, password) {
    const e = String(email || '').trim().toLowerCase();
    const p = String(password || '');
    const account = (state.accounts || []).find(
      (a) => a.email.toLowerCase() === e && a.password === p,
    );
    if (!account) return { ok: false, error: 'Unknown email or password' };
    state.currentUserId = account.id;
    return { ok: true, account };
  }

  function logout(state) {
    state.currentUserId = null;
    return state;
  }

  function currentAccount(state) {
    return (state.accounts || []).find((a) => a.id === state.currentUserId) || null;
  }

  /* ---------- exercise catalog (120-library) ---------- */

  function catalogEntries() {
    try {
      const g = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : null;
      if (g && Array.isArray(g.COACH_EXERCISE_CATALOG) && g.COACH_EXERCISE_CATALOG.length) {
        return g.COACH_EXERCISE_CATALOG;
      }
    } catch (e) {
      /* ignore */
    }
    return null;
  }

  function catalogVersion() {
    try {
      const g = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : null;
      return (g && g.COACH_EXERCISE_CATALOG_VERSION) || 'core-120-v1';
    } catch (e) {
      return 'core-120-v1';
    }
  }

  function mergeExerciseCatalog(state) {
    const catalog = catalogEntries();
    if (!catalog || !catalog.length) return state;
    state.exercises = state.exercises || [];
    const byId = {};
    for (const ex of state.exercises) {
      if (ex && ex.id) byId[ex.id] = ex;
    }
    for (const row of catalog) {
      if (!row || !row.id) continue;
      const cur = byId[row.id];
      if (!cur) {
        const next = { ...row };
        state.exercises.push(next);
        byId[row.id] = next;
      } else if (row.builtIn) {
        cur.name = row.name;
        cur.category = row.category;
        cur.builtIn = true;
        cur.source = row.source || 'THE-core-120';
      }
    }
    state.meta = state.meta || {};
    state.meta.coachExerciseCatalogVersion = catalogVersion();
    return state;
  }

  /* ---------- seed (this product's own sessions, not a third-party program) ---------- */

  function coreExercises() {
    const catalog = catalogEntries();
    if (catalog && catalog.length) return catalog.map((e) => ({ ...e }));
    return [
      { id: 'core-back-squat', name: 'Back Squat', category: 'Strength — Squat' },
      { id: 'core-bench-press', name: 'Bench Press', category: 'Strength — Push' },
      { id: 'core-deadlift', name: 'Deadlift', category: 'Strength — Hinge' },
      { id: 'core-overhead-press', name: 'Overhead Press', category: 'Strength — Push' },
      { id: 'core-barbell-row', name: 'Barbell Row', category: 'Strength — Pull' },
      { id: 'core-bulgarian-split-squat', name: 'Bulgarian Split Squat', category: 'Accessories — Legs' },
      { id: 'core-romanian-deadlift', name: 'Romanian Deadlift', category: 'Strength — Hinge' },
      { id: 'core-pull-up', name: 'Pull-up', category: 'Strength — Pull' },
      { id: 'core-dip', name: 'Dip', category: 'Strength — Push' },
      { id: 'core-hip-thrust', name: 'Hip Thrust', category: 'Strength — Hinge' },
      { id: 'core-biceps-curl', name: 'Biceps Curl', category: 'Accessories — Upper' },
      { id: 'core-triceps-pushdown', name: 'Triceps Pushdown', category: 'Accessories — Upper' },
      { id: 'core-nordic-hamstring-curl', name: 'Nordic Hamstring Curl', category: 'Accessories — Legs' },
      { id: 'core-row-erg', name: 'Row Erg', category: 'Work Capacity' },
      { id: 'core-assault-bike', name: 'Assault Bike', category: 'Work Capacity' },
      { id: 'core-plank', name: 'Plank', category: 'Trunk' },
      { id: 'core-box-jump', name: 'Box Jump', category: 'Power & Olympic' },
      { id: 'core-kettlebell-swing', name: 'Kettlebell Swing', category: 'Strength — Hinge' },
      { id: 'core-face-pull', name: 'Face Pull', category: 'Accessories — Upper' },
      { id: 'core-farmer-carry', name: 'Farmer Carry', category: 'Carries' },
    ].map((e) => ({ ...e, builtIn: true, source: 'THE-core-100' }));
  }

  function seedTemplates() {
    const strength = makeTemplate({
      id: IDS.tplStrength,
      name: 'Full Body Strength',
      coachInstructions: 'Work sets only. Leave 2–3 reps in reserve. No max attempts on squats or hinges.',
      blocks: [
        makeBlock({
          type: 'text',
          heading: 'Warm-up',
          category: 'Prep',
          scoring: 'completion',
          notes: '5 min easy bike or row. Then 2 rounds: world\'s greatest stretch, hip airplanes, empty-bar back squat × 8.',
        }),
        makeBlock({
          type: 'strength',
          heading: 'Strength',
          category: 'Strength/Power',
          scoring: 'weight',
          exercises: [
            makeExercise({
              name: 'Back Squat',
              exerciseId: 'core-back-squat',
              category: 'Strength — Squat',
              sets: 3,
              reps: '5',
              load: '100',
              metric: 'Weight',
              restSec: 150,
            }),
          ],
        }),
        makeBlock({
          type: 'strength',
          heading: 'Push',
          category: 'Strength/Power',
          scoring: 'weight',
          exercises: [
            makeExercise({
              name: 'Bench Press',
              exerciseId: 'core-bench-press',
              category: 'Strength — Push',
              sets: 3,
              reps: '8,8,6',
              load: '80,80,70',
              metric: 'Weight',
              restSec: 120,
            }),
          ],
        }),
        makeBlock({
          type: 'strength',
          heading: 'D1 / D2 Superset',
          category: 'Strength/Power',
          scoring: 'weight',
          superset: true,
          exercises: [
            makeExercise({
              name: 'Pull-up',
              exerciseId: 'core-pull-up',
              category: 'Strength — Pull',
              sets: 3,
              reps: '6-8',
              load: '',
              metric: 'Reps',
              restSec: 75,
            }),
            makeExercise({
              name: 'Dip',
              exerciseId: 'core-dip',
              category: 'Strength — Push',
              sets: 3,
              reps: '8-10',
              load: '',
              metric: 'Reps',
              restSec: 75,
            }),
          ],
        }),
        makeBlock({
          type: 'text',
          heading: 'Cool-down',
          category: 'Recovery',
          scoring: 'completion',
          notes: 'Walk 3 min. Nasal breathing. Note anything that felt off.',
        }),
      ],
    });

    const cond = makeTemplate({
      id: IDS.tplCond,
      name: 'Aerobic Conditioning',
      coachInstructions: 'Keep RPE 3–4. Finish feeling better, not cooked.',
      blocks: [
        makeBlock({
          type: 'conditioning',
          heading: 'Steady-state',
          category: 'Conditioning',
          scoring: 'completion',
          condFmt: 'steady',
          effort: 'easy',
          modality: 'Rower',
          targetDurationMin: 20,
          notes: 'Smooth first 2 minutes, then a pace you could hold while talking. Log duration, metres, and average watts.',
        }),
        makeBlock({
          type: 'conditioning',
          heading: 'Steady-state',
          category: 'Conditioning',
          scoring: 'completion',
          condFmt: 'steady',
          effort: 'easy',
          modality: 'Bike',
          targetDurationMin: 10,
          notes: 'Easy fan bike to flush. Nasal breathing if possible.',
        }),
      ],
    });

    const recovery = makeTemplate({
      id: IDS.tplRecovery,
      name: 'Recovery Session',
      templateKind: 'conditioning',
      coachInstructions: 'Optional movement. Skip any drill that aggravates something.',
      blocks: [
        makeBlock({
          type: 'conditioning',
          heading: 'Recovery movement',
          category: 'Recovery',
          scoring: 'completion',
          recoverySession: true,
          condFmt: 'steady',
          effort: 'easy',
          modality: 'Mixed',
          baselineDurationMin: 30,
          targetDurationMin: 30,
          timeCapMin: 30,
          notes:
            'Mixed modal — your choice: walk, easy bike, row, mobility. Box breathing 4-4-4-4 × 5. Log time and feel, not output.',
        }),
      ],
    });

    return [strength, cond, recovery];
  }

  function applyLoggedActuals(session) {
    const squat = session.blocks.find((b) => (b.exercises || []).some((e) => e.exerciseId === 'core-back-squat'));
    const squatEx = squat && squat.exercises.find((e) => e.exerciseId === 'core-back-squat');
    if (squatEx) {
      logSetArrays(session, squat.id, squatEx.id, '5,5,5', '100,100,105');
      completeBlock(session, squat.id, true);
    }
    const bench = session.blocks.find((b) => (b.exercises || []).some((e) => e.exerciseId === 'core-bench-press'));
    const benchEx = bench && bench.exercises.find((e) => e.exerciseId === 'core-bench-press');
    if (benchEx) {
      logSetArrays(session, bench.id, benchEx.id, '8,8,6', '80,80,70');
      completeBlock(session, bench.id, true);
    }
    const superB = session.blocks.find((b) => b.superset);
    if (superB) completeBlock(session, superB.id, true);
    session.status = 'completed';
    session.completedAt = '2026-08-24T18:40:00.000Z';
    session.minutes = 54;
    session.readiness = null;
    session.intensity = null;
    session.name = 'Week 1 Day 1';
    session.sessionTitle = 'Full Body Strength';
    return session;
  }

  function buildSeed(opts) {
    opts = opts || {};
    const startMonday = opts.startMonday || '2026-08-24';
    const templates = seedTemplates();
    const athletes = [{ id: IDS.athleteDan, name: 'Dan Veldman', initials: 'DV' }];
    const state = {
      version: 1,
      currentUserId: null,
      accounts: [
        {
          id: IDS.coachAccount,
          email: 'dan@thehybrid.local',
          password: 'demo',
          role: 'coach',
          name: 'Dan',
          athleteId: null,
        },
        {
          id: 'acct-veldman',
          email: 'veldman@thehybrid.local',
          password: 'demo',
          role: 'athlete',
          name: 'Dan Veldman',
          athleteId: IDS.athleteDan,
        },
      ],
      coach: { id: IDS.coach, name: 'Dan' },
      athletes,
      teams: [
        {
          id: IDS.team,
          name: 'hybrid S&C',
          athleteIds: [IDS.athleteDan],
        },
      ],
      exercises: coreExercises(),
      templates,
      nutrition: {
        targetsByAthlete: {},
        mealDays: [],
        checkInReviews: [],
      },
      programs: [
        {
          id: IDS.program,
          name: 'Hybrid Strength Base',
          weeks: 2,
          cells: {
            '1-1': IDS.tplStrength,
            '1-3': IDS.tplCond,
            '1-5': IDS.tplStrength,
            '1-7': IDS.tplRecovery,
            '2-1': IDS.tplStrength,
            '2-3': IDS.tplCond,
            '2-5': IDS.tplStrength,
          },
        },
      ],
      assignments: [],
      sessions: [],
    };

    assignProgram(state, {
      programId: IDS.program,
      teamId: IDS.team,
      startDate: startMonday,
    });

    const logged = (state.sessions || []).find(
      (s) => s.athleteId === IDS.athleteDan && s.date === startMonday && s.templateId === IDS.tplStrength,
    );
    if (logged) {
      logged.id = IDS.logged;
      applyLoggedActuals(logged);
    }

    return state;
  }

  function memoryStorage() {
    const map = {};
    return {
      getItem(k) {
        return Object.prototype.hasOwnProperty.call(map, k) ? map[k] : null;
      },
      setItem(k, v) {
        map[k] = String(v);
      },
      removeItem(k) {
        delete map[k];
      },
    };
  }

  function pruneRemovedDemoAthletes(state) {
    if (!state) return state;
    state.athletes = (state.athletes || []).filter((a) => !REMOVED_DEMO_ATHLETE_IDS.includes(a.id));
    state.accounts = (state.accounts || []).filter((a) => !REMOVED_DEMO_ACCOUNT_IDS.includes(a.id));
    for (const team of state.teams || []) {
      team.athleteIds = (team.athleteIds || []).filter((id) => !REMOVED_DEMO_ATHLETE_IDS.includes(id));
    }
    state.sessions = (state.sessions || []).filter((s) => !REMOVED_DEMO_ATHLETE_IDS.includes(s.athleteId));
    return state;
  }

  function loadState(storage, opts) {
    storage = storage || defaultStorage();
    try {
      const raw = storage.getItem(STORAGE);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.version === 1 && Array.isArray(parsed.accounts)) {
          parsed.nutrition = parsed.nutrition || {
            targetsByAthlete: {},
            mealDays: [],
            checkInReviews: [],
          };
          return mergeExerciseCatalog(pruneRemovedDemoAthletes(parsed));
        }
      }
    } catch (e) {
      /* fall through to seed */
    }
    const state = mergeExerciseCatalog(buildSeed(opts));
    saveState(storage, state);
    return state;
  }

  function saveState(storage, state) {
    storage = storage || defaultStorage();
    storage.setItem(STORAGE, JSON.stringify(state));
    return state;
  }

  function resetState(storage, opts) {
    storage = storage || defaultStorage();
    const state = mergeExerciseCatalog(buildSeed(opts));
    saveState(storage, state);
    return state;
  }

  function defaultStorage() {
    try {
      if (typeof localStorage !== 'undefined') return localStorage;
    } catch (e) {
      /* ignore */
    }
    return memoryStorage();
  }

  function prescriptionLine(ex) {
    const rir =
      ex.targetRir != null && Number.isFinite(Number(ex.targetRir))
        ? ` · target ${Math.round(Number(ex.targetRir))} RIR`
        : '';
    const rest = ex.restSec ? ` · rest ${ex.restSec}s` : '';
    if (ex.autopilotVolume || (ex.sets == null && !String(ex.reps || '').trim())) {
      return `autopilot${rest}${rir}`;
    }
    if (ex.loadExpr && ex.loadExpr.exprKind === 'pct_of_max') {
      const pct = Math.round(Number(ex.loadExpr.exprArg) * 100);
      return `${ex.sets} × ${ex.reps} · ${pct}% WM${rest}${rir}`;
    }
    if (ex.loadExpr && ex.loadExpr.exprKind === 'lwp_delta') {
      return `${ex.sets} × ${ex.reps} · LWP ${ex.loadExpr.exprArg}${rest}${rir}`;
    }
    const load = String(ex.load || '').trim();
    const metric = ex.metric || 'Weight';
    const loadBit = load ? ` @ ${load}${metric === 'Weight' ? 'kg' : ''}` : ' · autopilot load';
    return `${ex.sets} × ${ex.reps}${loadBit}${rest}${rir}`;
  }

  function actualLine(ex) {
    ensureRows(ex);
    const done = (ex.rows || []).filter((r) => r.done);
    if (!done.length) return '';
    const reps = done.map((r) => r.reps || '–').join(',');
    const loads = done.map((r) => r.weight || '–').join(',');
    const hasLoad = done.some((r) => String(r.weight || '').trim() !== '');
    return hasLoad ? `${reps} @ ${loads}kg` : reps;
  }

  /** Superset leader + partner move as one chunk. */
  function blockMoveSpan(blocks, from) {
    const list = blocks || [];
    const b = list[from];
    if (!b) return { start: from, len: 0 };
    if (b.supersetPartner && from > 0) return { start: from - 1, len: 2 };
    if (b.superset && list[from + 1]?.supersetPartner) return { start: from, len: 2 };
    return { start: from, len: 1 };
  }

  function reorderBlocks(blocks, from, to) {
    const list = clone(blocks || []);
    if (from === to || from < 0 || to < 0) return list;
    const { start, len } = blockMoveSpan(list, from);
    if (!len || (to >= start && to < start + len)) return list;
    const chunk = list.splice(start, len);
    let insertAt = to > start ? to - len : to;
    insertAt = Math.max(0, Math.min(insertAt, list.length));
    list.splice(insertAt, 0, ...chunk);
    return list;
  }

  return {
    STORAGE,
    DAY_NAMES,
    BLOCK_CATEGORIES,
    SCORING,
    METRICS,
    COND_FORMATS,
    COND_MODALITIES,
    COND_EFFORTS,
    IDS,
    uid,
    clone,
    num,
    localDate,
    today,
    addDays,
    mondayOf,
    dayIndex,
    dateLabel,
    cellKey,
    parseCellKey,
    targetList,
    loadList,
    makeRows,
    ensureRows,
    isWorkBlock,
    letterBlocks,
    decorateBlocks,
    blockMoveSpan,
    reorderBlocks,
    normalizeBlockType,
    formatMmSs,
    parseMmSs,
    condFormatMeta,
    condEffortMeta,
    fmtNeedsIntervalFields,
    condIntervalTotalMin,
    condPlanLineFromParts,
    condPlanLineBlock,
    applyCondBuilderToBlock,
    volumeKg,
    volumeFromRows,
    prescribedTonnage,
    intensityPct,
    blockProgress,
    blockIsComplete,
    remainingSummary,
    feedMetrics,
    groupFeed,
    sessionHasLog,
    makeExercise,
    makeBlock,
    makeTemplate,
    instantiateSession,
    logSet,
    logSetArrays,
    completeBlock,
    swapExercise,
    setSessionComment,
    emptyProgram,
    setProgramCell,
    moveProgramCell,
    addProgramWeek,
    assignProgram,
    publishSession,
    unpublishSession,
    publishAllSessions,
    hasUnpublished,
    athleteAccountEmail,
    addCalendarSession,
    monthDays,
    monthGridCells,
    shiftMonth,
    monthLabel,
    sessionsOnDate,
    needsProgramming,
    calendarFor,
    teamCalendar,
    todaySession,
    login,
    logout,
    currentAccount,
    coreExercises,
    mergeExerciseCatalog,
    seedTemplates,
    buildSeed,
    memoryStorage,
    loadState,
    saveState,
    resetState,
    prescriptionLine,
    parseRepRange,
    actualLine,
    sessionRows,
  };
});
