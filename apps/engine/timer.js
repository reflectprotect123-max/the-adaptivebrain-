(function (root) {
  const PICKER = [
    { id: 'rest', label: 'Rest Timer' },
    { id: 'stopwatch', label: 'Stopwatch' },
    { id: 'amrap', label: 'AMRAP' },
    { id: 'forTime', label: 'For Time' },
    { id: 'tabata', label: 'Tabata' },
    { id: 'custom', label: 'Custom Interval' },
    { id: 'emom', label: 'EMOM' },
  ];

  const READY_MS = 1000;
  const DIGIT_MS = 1000;
  const GO_MS = 700;

  function clone(t) {
    return JSON.parse(JSON.stringify(t));
  }

  function defaults(mode) {
    if (mode === 'rest') return { restMs: 60000 };
    if (mode === 'stopwatch') return { countInMs: 5000 };
    if (mode === 'amrap') return { totalMs: 600000, countInMs: 5000 };
    if (mode === 'forTime') return { countInMs: 5000 };
    if (mode === 'tabata') return { rounds: 8, workMs: 20000, restMs: 10000, countInMs: 5000 };
    if (mode === 'custom') return { rounds: 8, workMs: 60000, restMs: 30000, countInMs: 5000 };
    if (mode === 'emom') return { everyMs: 60000, rounds: 8, countInMs: 5000 };
    return {};
  }

  function create() {
    return {
      view: 'idle',
      display: 'fullscreen',
      mode: null,
      config: {},
      last: null,
      startedAt: null,
      countInAt: null,
      pausedAt: null,
      pauseAccum: 0,
      stopSheet: false,
      reducedMotion: false,
    };
  }

  function countInTotal(cfg, reduced) {
    const sec = Math.round((cfg.countInMs || 0) / 1000);
    if (sec <= 0) return 0;
    if (reduced) return sec * DIGIT_MS;
    return READY_MS + sec * DIGIT_MS + GO_MS;
  }

  function countInLabelAt(cfg, elapsed, reduced) {
    const sec = Math.round((cfg.countInMs || 0) / 1000);
    if (sec <= 0) return null;
    if (reduced) {
      if (elapsed < sec * DIGIT_MS) {
        return String(sec - Math.floor(elapsed / DIGIT_MS));
      }
      return null;
    }
    if (elapsed < READY_MS) return 'GET READY!';
    const after = elapsed - READY_MS;
    if (after < sec * DIGIT_MS) {
      const n = sec - Math.floor(after / DIGIT_MS);
      return String(n);
    }
    if (after < sec * DIGIT_MS + GO_MS) return 'GO!';
    return null;
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function formatClock(ms, tenths) {
    const v = Math.max(0, ms);
    const m = Math.floor(v / 60000);
    const s = Math.floor((v % 60000) / 1000);
    if (!tenths) return `${m}:${pad2(s)}`;
    const d = Math.floor((v % 1000) / 100);
    return `${m}:${pad2(s)}.${d}`;
  }

  function runElapsed(t, now) {
    if (t.pausedAt != null) return t.pausedAt - t.startedAt - (t.pauseAccum || 0);
    return now - t.startedAt - (t.pauseAccum || 0);
  }

  function restDuration(t) {
    return (t.config && t.config.restMs) || (t.last && t.last.restMs) || 60000;
  }

  function snapshot(t, now) {
    const chrome = t.last ? 'play' : 'select';
    if (t.view === 'countIn') {
      const cfg = t.config || {};
      const elapsed = now - t.countInAt;
      const label = countInLabelAt(cfg, elapsed, !!t.reducedMotion);
      const total = countInTotal(cfg, !!t.reducedMotion);
      if (label) {
        return {
          view: 'countIn',
          display: t.display,
          mode: t.mode,
          config: cfg,
          chrome,
          countInLabel: label,
          remainingMs: null,
          clock: null,
          stopSheet: false,
          roundLabel: null,
          roundFraction: null,
        };
      }
      const startedAt = t.countInAt + total;
      return snapshot({ ...t, view: 'running', startedAt, countInAt: null }, now);
    }
    if (t.view !== 'running') {
      return {
        view: t.view,
        display: t.display,
        mode: t.mode,
        config: t.config,
        chrome,
        countInLabel: null,
        remainingMs: null,
        clock: null,
        stopSheet: !!t.stopSheet,
        roundLabel: null,
        roundFraction: null,
      };
    }
    const elapsed = Math.max(0, runElapsed(t, now));
    const mode = t.mode;
    let remainingMs = null;
    let clock = null;
    let roundLabel = null;
    let roundFraction = null;
    let duration = 1;
    let done = false;
    if (mode === 'rest') {
      duration = restDuration(t);
      remainingMs = Math.max(0, duration - elapsed);
      clock = formatClock(remainingMs, t.display !== 'docked');
      done = remainingMs <= 0;
    } else if (mode === 'stopwatch' || mode === 'forTime') {
      remainingMs = null;
      clock = formatClock(elapsed, true);
      duration = Math.max(elapsed, 1);
    } else if (mode === 'amrap') {
      duration = t.config.totalMs || 600000;
      remainingMs = Math.max(0, duration - elapsed);
      clock = formatClock(remainingMs, true);
      done = remainingMs <= 0;
    } else if (mode === 'tabata' || mode === 'custom') {
      const work = t.config.workMs || 20000;
      const rest = t.config.restMs || 10000;
      const rounds = t.config.rounds || 8;
      const cycle = work + rest;
      const roundIdx = Math.min(rounds - 1, Math.floor(elapsed / cycle));
      const into = elapsed - roundIdx * cycle;
      const inWork = into < work;
      duration = inWork ? work : rest;
      remainingMs = Math.max(0, duration - (inWork ? into : into - work));
      clock = formatClock(remainingMs, true);
      roundLabel = inWork ? 'Work' : 'Rest';
      roundFraction = `${roundIdx + 1}/${rounds}`;
      done = elapsed >= rounds * cycle;
    } else if (mode === 'emom') {
      const every = t.config.everyMs || 60000;
      const rounds = t.config.rounds || 8;
      const roundIdx = Math.min(rounds - 1, Math.floor(elapsed / every));
      const into = elapsed - roundIdx * every;
      duration = every;
      remainingMs = Math.max(0, every - into);
      clock = formatClock(remainingMs, true);
      roundLabel = `Round ${roundIdx + 1}`;
      roundFraction = `${roundIdx + 1}/${rounds}`;
      done = elapsed >= rounds * every;
    }
    const progress = remainingMs == null ? 0 : remainingMs / duration;
    return {
      view: done ? 'idle' : 'running',
      display: t.display,
      mode,
      config: t.config,
      chrome: done ? 'play' : chrome,
      countInLabel: null,
      remainingMs,
      clock,
      stopSheet: !!t.stopSheet,
      roundLabel,
      roundFraction,
      progress,
      done,
    };
  }

  function openPicker(t) {
    const s = clone(t);
    s.view = 'picker';
    s.stopSheet = false;
    return s;
  }

  function closePicker(t) {
    const s = clone(t);
    s.view = s.last ? 'idle' : 'idle';
    s.mode = null;
    return s;
  }

  function choose(t, mode) {
    const s = clone(t);
    s.mode = mode;
    s.view = 'setup';
    s.display = 'fullscreen';
    s.config = { ...defaults(mode), ...(s.last && s.last.mode === mode ? s.last : {}) };
    if (mode === 'rest' && s.last && s.last.restMs) s.config.restMs = s.last.restMs;
    s.stopSheet = false;
    return s;
  }

  function quickStart(t, restMs) {
    const s = clone(t);
    s.config = { ...(s.config || {}), restMs };
    return s;
  }

  function nudgeRest(t, dir) {
    const s = clone(t);
    const cur = (s.config && s.config.restMs) || 60000;
    s.config = { ...(s.config || {}), restMs: Math.max(5000, cur + dir * 5000) };
    return s;
  }

  function patch(t, fields) {
    const s = clone(t);
    s.config = { ...(s.config || {}), ...fields };
    return s;
  }

  function remember(s) {
    s.last = { mode: s.mode, ...s.config };
  }

  function start(t, now) {
    const s = clone(t);
    remember(s);
    s.stopSheet = false;
    const cfg = s.config || {};
    const needsCount = s.mode !== 'rest' && (cfg.countInMs || 0) > 0;
    if (needsCount) {
      s.view = 'countIn';
      s.display = 'fullscreen';
      s.countInAt = now;
      s.startedAt = null;
      return s;
    }
    s.view = 'running';
    s.display = 'fullscreen';
    s.startedAt = now;
    s.countInAt = null;
    s.pauseAccum = 0;
    s.pausedAt = null;
    return s;
  }

  function play(t, now) {
    if (!t.last) return openPicker(t);
    const s = clone(t);
    s.mode = t.last.mode;
    s.config = { ...defaults(t.last.mode), ...t.last };
    s.stopSheet = false;
    s.pauseAccum = 0;
    s.pausedAt = null;
    if (s.mode === 'rest') {
      s.view = 'countIn';
      s.display = 'docked';
      s.config.countInMs = s.config.countInMs || 5000;
      s.countInAt = now;
      s.startedAt = null;
      return s;
    }
    return start(s, now);
  }

  function collapse(t) {
    const s = clone(t);
    s.display = 'docked';
    return s;
  }

  function expand(t) {
    const s = clone(t);
    s.display = 'fullscreen';
    s.stopSheet = false;
    return s;
  }

  function openStopSheet(t) {
    const s = clone(t);
    s.stopSheet = true;
    return s;
  }

  function cancelStopSheet(t) {
    const s = clone(t);
    s.stopSheet = false;
    return s;
  }

  function stop(t) {
    const s = clone(t);
    if (s.mode) remember(s);
    s.view = 'idle';
    s.display = 'fullscreen';
    s.startedAt = null;
    s.countInAt = null;
    s.pausedAt = null;
    s.stopSheet = false;
    return s;
  }

  function reset(t, now) {
    const s = clone(t);
    s.view = 'setup';
    s.startedAt = null;
    s.countInAt = null;
    s.pausedAt = null;
    s.pauseAccum = 0;
    s.stopSheet = false;
    s.display = 'fullscreen';
    return s;
  }

  function tick(t, now) {
    const reduced = !!t.reducedMotion;
    if (t.view === 'countIn') {
      const cfg = t.config || {};
      const elapsed = now - t.countInAt;
      const label = countInLabelAt(cfg, elapsed, reduced);
      if (label) return t;
      const s = clone(t);
      s.view = 'running';
      s.startedAt = t.countInAt + countInTotal(cfg, reduced);
      s.countInAt = null;
      s.pauseAccum = 0;
      s.pausedAt = null;
      t = s;
    }
    if (t.view === 'running') {
      const snap = snapshot(t, now);
      if (snap.done) return stop(t);
    }
    return t;
  }

  function togglePause(t, now) {
    const s = clone(t);
    if (s.pausedAt != null) {
      s.pauseAccum = (s.pauseAccum || 0) + (now - s.pausedAt);
      s.pausedAt = null;
    } else {
      s.pausedAt = now;
    }
    return s;
  }

  const HybridTimer = {
    PICKER,
    READY_MS,
    GO_MS,
    create,
    snapshot,
    openPicker,
    closePicker,
    choose,
    quickStart,
    nudgeRest,
    patch,
    start,
    play,
    collapse,
    expand,
    openStopSheet,
    cancelStopSheet,
    stop,
    reset,
    tick,
    togglePause,
    formatClock,
  };

  root.HybridTimer = HybridTimer;
  if (typeof module !== 'undefined' && module.exports) module.exports = HybridTimer;
})(typeof globalThis !== 'undefined' ? globalThis : this);
