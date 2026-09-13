(function (root) {
  const EFFORT = {
    easy: { min: 3, max: 4 },
    medium: { min: 5, max: 7 },
    hard: { min: 8, max: 9.5 },
  };

  const MACHINES = {
    bike: { title: 'Bike', modality: 'watts' },
    echo: { title: 'Echo', modality: 'watts' },
    row: { title: 'Row', modality: 'split' },
    ski: { title: 'Ski', modality: 'split' },
    fan: { title: 'Fan bike', modality: 'rpm' },
    walk: { title: 'Walk', modality: 'none' },
    run: { title: 'Run', modality: 'none' },
  };

  const CONCEPT2_WATTS_FACTOR = 2.8;

  function clone(v) {
    return JSON.parse(JSON.stringify(v));
  }

  function ad(passed) {
    return passed || root.HybridAdaptive;
  }

  function kernel() {
    return root.HybridBrainKernel;
  }

  function machineMeta(id) {
    return MACHINES[id] || { title: id || 'Engine', modality: 'none' };
  }

  function bandFor(effort) {
    return EFFORT[effort] || EFFORT.medium;
  }

  function modalityFor(machine, piece) {
    if (piece) {
      if (piece.typedWatts != null && Number.isFinite(Number(piece.typedWatts))) return 'watts';
      if (piece.typedSplitSec != null && Number.isFinite(Number(piece.typedSplitSec))) return 'split';
      if (piece.typedRpm != null && Number.isFinite(Number(piece.typedRpm))) return 'rpm';
    }
    return machineMeta(machine).modality;
  }

  function formatSplit(sec) {
    const n = Math.round(Number(sec) || 0);
    const m = Math.floor(n / 60);
    const s = n % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function formatTarget(target, modality) {
    if (!target) return '';
    if (modality === 'watts' && target.watts != null) return `${Math.round(target.watts)} W`;
    if (modality === 'split' && target.splitSec != null) return `${formatSplit(target.splitSec)}/500m`;
    if (modality === 'rpm' && target.rpm != null) return `${Math.round(target.rpm)} rpm`;
    return '';
  }

  function emptyTarget() {
    return { watts: null, splitSec: null, rpm: null };
  }

  function wattsFromSplitSec(splitSec) {
    const pace = Number(splitSec) / 500;
    return Math.round(CONCEPT2_WATTS_FACTOR / (pace * pace * pace));
  }

  function splitSecFromWatts(watts) {
    const pace = Math.cbrt(CONCEPT2_WATTS_FACTOR / Number(watts));
    return Math.round(500 * pace);
  }

  function targetFromOpen(opened, modality) {
    const t = emptyTarget();
    if (!opened || !opened.ok) return t;
    if (modality === 'split') t.splitSec = opened.splitSec == null ? null : opened.splitSec;
    else if (modality === 'rpm') t.rpm = opened.rpm == null ? null : opened.rpm;
    else if (modality === 'watts') t.watts = opened.watts == null ? null : opened.watts;
    return t;
  }

  function typedFor(piece, modality) {
    if (modality === 'split') return piece.typedSplitSec;
    if (modality === 'rpm') return piece.typedRpm;
    if (modality === 'watts') return piece.typedWatts;
    return null;
  }

  function softenTarget(target, modality, recovery, adaptive) {
    const A = ad(adaptive);
    if (!A || typeof A.softenOpen !== 'function') return target;
    const rec = recovery == null ? null : Number(recovery);
    const next = emptyTarget();
    if (modality === 'split' && target.splitSec != null) {
      next.splitSec = A.softenOpen(target.splitSec, 'split', rec);
    } else if (modality === 'rpm' && target.rpm != null) {
      next.rpm = A.softenOpen(target.rpm, 'rpm', rec);
    } else if (modality === 'watts' && target.watts != null) {
      next.watts = A.softenOpen(target.watts, 'watts', rec);
    }
    return next;
  }

  function openPiece(piece, lastClose, adaptive, recovery) {
    const modality = modalityFor(piece.machine, piece);
    if (modality === 'none') {
      return { ok: true, skipped: true, modality, target: emptyTarget() };
    }
    const typed = typedFor(piece, modality);
    const hasTyped = typed != null && Number.isFinite(Number(typed));
    if (hasTyped) {
      const t = emptyTarget();
      if (modality === 'split') t.splitSec = Number(typed);
      else if (modality === 'rpm') t.rpm = Number(typed);
      else t.watts = Number(typed);
      return { ok: true, skipped: false, modality, target: t };
    }

    const K = kernel();
    if (K && typeof K.open === 'function') {
      if (modality === 'split') {
        if (lastClose && lastClose.splitSec != null) {
          const t = emptyTarget();
          t.splitSec = lastClose.splitSec;
          return { ok: true, skipped: false, modality, target: t };
        }
        return { ok: true, skipped: true, modality, target: emptyTarget() };
      }
      const unit = modality === 'rpm' ? 'rpm' : 'watts';
      let canonical = null;
      if (lastClose) {
        canonical = lastClose.canonicalOutput;
        if (canonical == null) canonical = unit === 'rpm' ? lastClose.rpm : (lastClose.watts ?? lastClose.anchor);
      }
      const opened = K.open({
        kind: 'engine',
        anchor: canonical != null ? {
          confidence: lastClose.confidence || 'provisional',
          canonicalOutput: canonical,
          canonicalUnit: unit,
        } : null,
      });
      if (opened.needsFirstNumber || opened.target == null) {
        return { ok: true, skipped: true, modality, target: emptyTarget() };
      }
      const t = emptyTarget();
      if (unit === 'rpm') t.rpm = opened.target;
      else t.watts = opened.target;
      return { ok: true, skipped: false, modality, target: t };
    }

    const A = ad(adaptive);
    if (!A) return { ok: true, skipped: true, modality, target: emptyTarget() };
    const opened = A.openCond({
      dayKind: 'conditioning',
      modality,
      lastClose: lastClose || null,
      typedWatts: piece.typedWatts,
      typedSplitSec: piece.typedSplitSec,
      typedRpm: piece.typedRpm,
    });
    if (!opened || !opened.ok) return { ok: false, modality, target: emptyTarget() };
    let target = targetFromOpen(opened, modality);
    target = softenTarget(target, modality, recovery, A);
    const blank = (modality === 'watts' && target.watts == null)
      || (modality === 'split' && target.splitSec == null)
      || (modality === 'rpm' && target.rpm == null);
    return { ok: true, skipped: blank, modality, target };
  }

  function readyLog(piece, adaptive, lastClose, recovery) {
    const opened = openPiece(piece, lastClose || null, adaptive, recovery);
    return {
      completed: false,
      note: '',
      sets: [],
      engine: {
        machine: piece.machine,
        title: piece.title || machineMeta(piece.machine).title,
        structure: piece.structure || 'intervals',
        effort: piece.effort || 'medium',
        modality: opened.modality,
        skipped: !!opened.skipped,
        workSec: Math.max(1, Number(piece.workSec) || 60),
        restSec: Math.max(0, Number(piece.restSec) || 0),
        rounds: Math.max(1, Number(piece.rounds) || 1),
        roundIndex: 0,
        phase: 'ready',
        target: opened.target,
        bouts: [],
        workEndsAt: null,
        restEndsAt: null,
        needsEffort: false,
        workComplete: true,
      },
    };
  }

  function startWork(log, now) {
    const s = clone(log);
    const e = s.engine;
    e.phase = 'work';
    e.workEndsAt = now + e.workSec * 1000;
    e.restEndsAt = null;
    e.needsEffort = false;
    e.workComplete = true;
    return s;
  }

  function endWork(log, now, early) {
    const s = clone(log);
    const e = s.engine;
    e.phase = 'rest';
    e.needsEffort = true;
    e.workEndsAt = now;
    e.workComplete = !early;
    const more = e.structure === 'intervals' && (e.roundIndex + 1) < e.rounds;
    if (more && e.restSec > 0) {
      e.restEndsAt = now + e.restSec * 1000;
    } else {
      e.restEndsAt = null;
    }
    return s;
  }

  function tick(log, now) {
    const e = log.engine;
    if (!e) return log;
    if (e.phase === 'work' && e.workEndsAt != null && now >= e.workEndsAt) return endWork(log, now, false);
    if (e.phase === 'rest' && !e.needsEffort && e.restEndsAt != null && now >= e.restEndsAt) {
      const s = clone(log);
      s.engine.phase = 'ready';
      s.engine.restEndsAt = null;
      return s;
    }
    return log;
  }

  function applyDecideNext(e, reportedEffort) {
    const K = kernel();
    if (!K || typeof K.decideNextEngine !== 'function') return null;
    const intended = e.effort || 'medium';
    const complete = e.workComplete !== false;
    if (e.modality === 'rpm' && e.target.rpm != null) {
      const out = K.decideNextEngine({
        machine: 'echo',
        intendedEffort: intended,
        reportedEffort,
        actualOutput: e.target.rpm,
        complete,
        unit: 'rpm',
      });
      return { ...e.target, rpm: out.nextOutput };
    }
    if (e.modality === 'watts' && e.target.watts != null) {
      const out = K.decideNextEngine({
        machine: 'concept2',
        intendedEffort: intended,
        reportedEffort,
        actualOutput: e.target.watts,
        complete,
        unit: 'watts',
      });
      return { ...e.target, watts: out.nextOutput };
    }
    if (e.modality === 'split' && e.target.splitSec != null) {
      const watts = wattsFromSplitSec(e.target.splitSec);
      const out = K.decideNextEngine({
        machine: 'concept2',
        intendedEffort: intended,
        reportedEffort,
        actualOutput: watts,
        complete,
        unit: 'watts',
      });
      return { ...emptyTarget(), splitSec: splitSecFromWatts(out.nextOutput) };
    }
    return null;
  }

  function recordEffort(log, reportedEffort, adaptive, now) {
    const s = clone(log);
    const e = s.engine;
    const bout = {
      effort: reportedEffort,
      watts: e.target.watts,
      splitSec: e.target.splitSec,
      rpm: e.target.rpm,
    };
    e.bouts.push(bout);
    if (!e.skipped) {
      const next = applyDecideNext(e, reportedEffort);
      if (next) e.target = next;
    }
    e.needsEffort = false;
    e.roundIndex += 1;
    const more = e.roundIndex < e.rounds && e.structure === 'intervals';
    if (more) {
      e.phase = 'rest';
      if (e.restEndsAt == null && e.restSec > 0) {
        e.restEndsAt = (now || Date.now()) + e.restSec * 1000;
      }
    } else {
      e.phase = 'done';
      s.completed = true;
      e.workEndsAt = null;
      e.restEndsAt = null;
    }
    return s;
  }

  function skipRest(log) {
    const s = clone(log);
    if (s.engine.needsEffort) return log;
    s.engine.phase = 'ready';
    s.engine.restEndsAt = null;
    return s;
  }

  function skipRestAndStart(log, now) {
    if (log.engine.needsEffort) return log;
    return startWork(skipRest(log), now);
  }

  function closePiece(log, adaptive) {
    const e = log.engine;
    const last = e.bouts[e.bouts.length - 1] || {};
    const lastMade = {};
    if (e.modality === 'rpm' && (last.rpm != null || e.target.rpm != null)) lastMade.rpm = last.rpm != null ? last.rpm : e.target.rpm;
    else if (e.modality === 'watts' && (last.watts != null || e.target.watts != null)) lastMade.watts = last.watts != null ? last.watts : e.target.watts;
    else if (e.modality === 'split' && (last.splitSec != null || e.target.splitSec != null)) lastMade.splitSec = last.splitSec != null ? last.splitSec : e.target.splitSec;
    const K = kernel();
    if (K && typeof K.close === 'function' && e.modality !== 'split') {
      const unit = e.modality === 'rpm' ? 'rpm' : 'watts';
      const observations = (e.bouts || [])
        .map((b) => (unit === 'rpm' ? b.rpm : b.watts))
        .filter((n) => typeof n === 'number');
      const closed = K.close({ kind: 'engine', unit, observations });
      return {
        ok: true,
        ...lastMade,
        confidence: closed.confidence,
        canonicalOutput: closed.anchor,
        canonicalUnit: unit,
        ruleVersion: closed.ruleVersion,
      };
    }
    const A = ad(adaptive);
    if (!A || typeof A.closeCond !== 'function' || !Object.keys(lastMade).length) {
      return { ok: true, ...lastMade };
    }
    return A.closeCond({ lastMade });
  }

  function rxText(piece) {
    const modality = modalityFor(piece.machine, piece);
    const effort = String(piece.effort || 'medium');
    const rounds = Math.max(1, Number(piece.rounds) || 1);
    const work = Math.max(1, Number(piece.workSec) || 0);
    const rest = Math.max(0, Number(piece.restSec) || 0);
    const structure = piece.structure || 'intervals';
    let clock = structure === 'intervals'
      ? `${rounds} × ${work}s / ${rest}s`
      : `${Math.round(work / 60) || work} min`;
    const t = emptyTarget();
    if (piece.typedWatts != null) t.watts = piece.typedWatts;
    if (piece.typedSplitSec != null) t.splitSec = piece.typedSplitSec;
    if (piece.typedRpm != null) t.rpm = piece.typedRpm;
    const num = formatTarget(t, modality);
    const chip = effort.charAt(0).toUpperCase() + effort.slice(1);
    return [clock, chip, num].filter(Boolean).join(' · ');
  }

  const HybridEngine = {
    MACHINES,
    bandFor,
    modalityFor,
    formatSplit,
    formatTarget,
    openPiece,
    readyLog,
    startWork,
    endWork,
    tick,
    recordEffort,
    skipRest,
    skipRestAndStart,
    closePiece,
    rxText,
    machineTitle(id) { return machineMeta(id).title; },
  };

  root.HybridEngine = HybridEngine;
  if (typeof module !== 'undefined' && module.exports) module.exports = HybridEngine;
})(typeof globalThis !== 'undefined' ? globalThis : this);
