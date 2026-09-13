export function loadKind(columns) {
  const cols = Array.isArray(columns) ? columns : [];
  if (cols.includes('weight_pct')) return 'pct';
  if (cols.includes('lwp')) return 'lwp';
  if (cols.includes('weight_kg') || cols.includes('weight_lb')) return 'kg';
  return null;
}

export function roundToStep(kg, step = 2.5) {
  const n = Number(kg);
  const s = Number(step) || 2.5;
  if (!Number.isFinite(n) || s <= 0) return 0;
  return Math.max(0, Math.round(n / s) * s);
}

export function estimateE1rmKg({ loadKg, reps } = {}) {
  const w = Number(loadKg);
  const r = Number(reps);
  if (!w || !r || w <= 0 || r < 1) return 0;
  const effective = Math.min(20, r);
  return Math.round(w * (1 + effective / 30) * 10) / 10;
}

export function rememberLift(prev, event) {
  const loadKg = Number(event && event.loadKg);
  const reps = event && event.reps != null ? Number(event.reps) : null;
  const miss = !!(event && event.miss);
  const effort = event && event.effort ? event.effort : null;
  const next = {
    lastKg: Number.isFinite(loadKg) ? loadKg : (prev && prev.lastKg) || null,
    lastReps: reps,
    lastEffort: effort,
    lastMiss: miss,
    e1rmKg: (prev && prev.e1rmKg) || 0,
    lastPct: (prev && prev.lastPct) || null,
  };
  if (!miss && Number.isFinite(loadKg) && loadKg > 0 && reps >= 1) {
    const est = estimateE1rmKg({ loadKg, reps });
    next.e1rmKg = Math.max(Number(next.e1rmKg) || 0, est);
    if (next.e1rmKg > 0) {
      next.lastPct = Math.round((loadKg / next.e1rmKg) * 1000) / 10;
    }
  }
  return next;
}

export function openingKg(input) {
  const cols = (input && input.columns) || [];
  const kind = loadKind(cols);
  const step = Number(input && input.stepKg) || 2.5;
  const lastKg = input && input.lastKg != null && input.lastKg !== '' ? Number(input.lastKg) : null;
  const e1rmKg = Number(input && input.e1rmKg) || 0;
  const lastPct = Number(input && input.lastPct);
  if (kind === 'pct') {
    if (e1rmKg > 0 && lastPct > 0) return roundToStep(e1rmKg * lastPct / 100, step);
    if (lastKg != null && Number.isFinite(lastKg)) return lastKg;
    return null;
  }
  if (kind === 'lwp') {
    if (lastKg == null || !Number.isFinite(lastKg)) return null;
    const hit = !input.lastMiss
      && input.lastEffort !== 'hard'
      && (input.targetReps == null || Number(input.lastReps) >= Number(input.targetReps));
    return hit ? roundToStep(lastKg + step, step) : lastKg;
  }
  if (kind == null) return null;
  if (lastKg == null || !Number.isFinite(lastKg)) return null;
  return lastKg;
}

export function kgFromPctPad({ columns, raw, e1rmKg } = {}) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (loadKind(columns) === 'pct' && n >= 1 && n <= 100 && Number(e1rmKg) > 0) {
    return roundToStep(Number(e1rmKg) * n / 100);
  }
  return n;
}
