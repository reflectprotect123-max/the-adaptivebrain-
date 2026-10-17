/**
 * Import TrainHeroic userData export → Hybrid backup JSON (mergeImportPayload).
 *
 * Usage:
 *   node scripts/import-trainheroic-history.mjs path/to/trainheroic-userData-export.zip
 *   node scripts/import-trainheroic-history.mjs path/to/training_data.csv
 *
 * Output (gitignored): THE-trainheroic-import.json
 * Then: pnpm run gen:exercise-history-seed  (load hints + aliases only — no sessions)
 * The app auto-merges exercise-history-seed.js on boot.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIN_USES = 3;
const LB_TO_KG = 0.45359237;

const MANUAL_TITLE_MAP = {
  'back squat': 'core-back-squat',
  'front squat': 'core-front-squat',
  'bench press': 'core-bench-press',
  deadlift: 'core-deadlift',
  'romanian deadlift': 'core-romanian-deadlift',
  rdl: 'core-romanian-deadlift',
  'db rdl': 'core-romanian-deadlift',
  'single leg rdl': 'core-romanian-deadlift',
  'sumo deadlift': 'core-sumo-deadlift',
  'overhead press': 'core-overhead-press',
  'strict press': 'core-overhead-press',
  'standing arnold press': 'core-arnold-press',
  'arnold press': 'core-arnold-press',
  'push press': 'core-push-press',
  'pull-up': 'core-pull-up',
  'pull up': 'core-pull-up',
  pullup: 'core-pull-up',
  'chin-up': 'core-pull-up',
  'chin up': 'core-pull-up',
  'wide grip pull-up': 'core-pull-up',
  'wide grip pull up': 'core-pull-up',
  'feet elevated chin-ups': 'core-pull-up',
  'lat pulldown': 'core-lat-pulldown',
  'lateral raise': 'core-lateral-raise',
  'db lateral raise': 'core-lateral-raise',
  'dumbbell lateral raise': 'core-lateral-raise',
  'cable lateral raise': 'core-cable-lateral-raise',
  'barbell row': 'core-barbell-row',
  'barbell curl': 'core-barbell-curl',
  'dumbbell curl': 'core-dumbbell-curl',
  'db curl': 'core-dumbbell-curl',
  'nordic curl': 'core-nordic-curl',
  'glute-ham raise': 'core-nordic-curl',
  'split squat': 'core-split-squat',
  'bulgarian split squat': 'core-bulgarian-split-squat',
  'farmer walk': 'core-farmer-walk',
  'farmer carry': 'core-farmer-walk',
  'trap bar deadlift': 'core-trap-bar-deadlift',
  'hang clean': 'core-hang-clean',
  'power clean': 'core-power-clean',
  'bar dips': 'core-dip',
  dip: 'core-dip',
  dips: 'core-dip',
};

const SKIP_SESSION_TITLES =
  /^(parasympathetic breathing|full body warm-up|world'?s greatest stretch|conditioning warm up|warm up|warm-up|bike|airdyne|air bike|assault bike|run|row erg|ski erg|jump rope|cycling|tabata|breathing|stretch|mobility|prep|cooldown|finisher|recovery)/i;

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function slug(s) {
  return norm(s).replace(/\s+/g, '-').slice(0, 48);
}

function loadExerciseSearch() {
  const sandbox = { window: {}, console };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(
    readFileSync(join(repoRoot, 'apps/coach/exercise-search-index.js'), 'utf8'),
    sandbox,
  );
  vm.runInContext(
    readFileSync(join(repoRoot, 'apps/coach/exercise-search.js'), 'utf8'),
    sandbox,
  );
  return { ExerciseSearch: sandbox.ExerciseSearch, index: sandbox.EXERCISE_SEARCH_INDEX || [] };
}

function loadIndexById() {
  const lib = JSON.parse(
    readFileSync(
      join(
        repoRoot,
        'apps/coach/data/exercise-library.json',
      ),
      'utf8',
    ),
  );
  return new Map(lib.exercises.map((e) => [e.exercise_id, { name: e.name, category: e.category }]));
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      q = !q;
      continue;
    }
    if (c === ',' && !q) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}

function readTrainingCsv(sourcePath) {
  let text;
  if (sourcePath.endsWith('.zip')) {
    text = execFileSync('unzip', ['-p', sourcePath, 'training_data.csv'], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
  } else {
    text = readFileSync(sourcePath, 'utf8');
  }
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = parseCsvLine(lines[0]);
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    rows.push({
      workoutTitle: cols[idx.WorkoutTitle] || '',
      scheduledDate: cols[idx.ScheduledDate] || '',
      exerciseTitle: cols[idx.ExerciseTitle] || '',
      exerciseData: cols[idx.ExerciseData] || '',
    });
  }
  return rows;
}

function parseExerciseData(data) {
  const d = String(data || '').trim();
  if (!d || /rep x\s*pound\s*$/i.test(d)) return null;

  const m = d.match(/^(.+?)\s+x\s+(.+)$/i);
  if (!m) return null;

  const left = m[1].trim();
  const right = m[2].trim().toLowerCase();

  if (right.includes('percent') && !/\d/.test(left)) return null;

  const repsParts = left.split(',').map((x) => x.trim()).filter(Boolean);
  const reps = repsParts.map((p) => {
    const n = parseFloat(p.replace(/[^\d.]/g, ''));
    return Number.isFinite(n) ? n : 0;
  });

  if (right.includes('pound') || right.includes('kilogram') || right.includes('kg')) {
    const loads = right
      .replace(/pound|kilogram|kg/gi, '')
      .split(',')
      .map((x) => parseFloat(x.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
    const isKg = right.includes('kilogram') || /\bkg\b/.test(right);
    const rows = [];
    const n = Math.max(reps.length, loads.length);
    for (let i = 0; i < n; i++) {
      const r = reps[i] || reps[reps.length - 1] || 0;
      let w = loads[i] ?? loads[loads.length - 1] ?? 0;
      if (!isKg) w *= LB_TO_KG;
      if (r > 0) rows.push({ reps: r, weight: Math.round(w * 4) / 4 });
    }
    return rows.length ? { kind: 'load_reps', rows } : null;
  }

  if (right === '' || right === 'pound' || right === 'kilogram') {
    const rows = reps.filter((r) => r > 0).map((r) => ({ reps: r, weight: 0 }));
    return rows.length ? { kind: 'reps_only', rows } : null;
  }

  return null;
}

function resolveTitle(title, ExerciseSearch, indexById) {
  const n = norm(title);
  if (MANUAL_TITLE_MAP[n]) {
    const id = MANUAL_TITLE_MAP[n];
    const entry = indexById.get(id);
    if (entry) return { exerciseId: id, name: entry.name, category: entry.category, source: 'manual' };
  }

  const hits = ExerciseSearch.search(title, 5);
  if (hits.length) {
    const top = hits[0];
    const topNorm = norm(top.name);
    if (topNorm === n || topNorm.includes(n) || n.includes(topNorm)) {
      return { exerciseId: top.exerciseId, name: top.name, category: top.category, source: 'search' };
    }
    if (hits.length === 1) {
      return { exerciseId: top.exerciseId, name: top.name, category: top.category, source: 'search_single' };
    }
  }

  return null;
}

function sessionId(date, workoutTitle) {
  return `th-${date}-${slug(workoutTitle)}`.slice(0, 80);
}

function rowId(prefix, n) {
  return `${prefix}-r${n}`;
}

function main() {
  const sourcePath = process.argv[2];
  if (!sourcePath || !existsSync(sourcePath)) {
    console.error('Usage: node scripts/import-trainheroic-history.mjs <export.zip|training_data.csv>');
    process.exit(1);
  }

  const { ExerciseSearch } = loadExerciseSearch();
  const indexById = loadIndexById();
  const csvRows = readTrainingCsv(sourcePath);

  const useCounts = new Map();
  for (const row of csvRows) {
    const t = row.exerciseTitle.trim();
    if (!t) continue;
    useCounts.set(t, (useCounts.get(t) || 0) + 1);
  }

  const frequentTitles = [...useCounts.entries()]
    .filter(([, c]) => c > MIN_USES)
    .sort((a, b) => b[1] - a[1]);

  console.log(`Titles with >${MIN_USES} uses: ${frequentTitles.length}`);

  const titleResolution = new Map();
  const customExercises = [];
  const titleAliases = {};

  for (const [title] of frequentTitles) {
    const resolved = resolveTitle(title, ExerciseSearch, indexById);
    if (resolved) {
      titleResolution.set(title, resolved);
      titleAliases[title] = resolved.exerciseId;
    } else {
      const id = `th-custom-${slug(title)}`;
      customExercises.push({
        id,
        name: title,
        category: 'TrainHeroic import',
        builtIn: false,
        source: 'THE-trainheroic',
        percentCalc: false,
      });
      titleResolution.set(title, {
        exerciseId: id,
        name: title,
        category: 'TrainHeroic import',
        source: 'custom',
      });
      titleAliases[title] = id;
    }
  }

  const workouts = new Map();
  let parsedRows = 0;

  for (const row of csvRows) {
    const title = row.exerciseTitle.trim();
    if (!title || (useCounts.get(title) || 0) <= MIN_USES) continue;
    if (SKIP_SESSION_TITLES.test(title)) continue;

    const res = titleResolution.get(title);
    if (!res) continue;

    const parsed = parseExerciseData(row.exerciseData);
    if (!parsed) continue;

    const date = String(row.scheduledDate || '').slice(0, 10);
    if (!date) continue;

    const wkey = `${date}::${row.workoutTitle.trim() || 'Workout'}`;
    if (!workouts.has(wkey)) {
      workouts.set(wkey, {
        id: sessionId(date, row.workoutTitle || 'Workout'),
        status: 'completed',
        date,
        name: row.workoutTitle.trim() || 'TrainHeroic session',
        completedAt: Date.parse(`${date}T12:00:00Z`) || Date.now(),
        source: 'THE-trainheroic',
        tasks: [],
        _taskByExercise: new Map(),
      });
    }

    const session = workouts.get(wkey);
    let task = session._taskByExercise.get(res.exerciseId);
    if (!task) {
      task = {
        id: `${session.id}-${res.exerciseId}`,
        kind: 'strength',
        exerciseId: res.exerciseId,
        name: res.name,
        category: res.category,
        rows: [],
      };
      session._taskByExercise.set(res.exerciseId, task);
      session.tasks.push(task);
    }

    parsed.rows.forEach((r) => {
      task.rows.push({
        id: rowId(task.id, task.rows.length + 1),
        n: task.rows.length + 1,
        weight: r.weight || '',
        reps: r.reps,
        rir: '',
        done: true,
        extra: false,
      });
    });
    parsedRows++;
  }

  const sessions = [...workouts.values()]
    .map((s) => {
      delete s._taskByExercise;
      return s;
    })
    .filter((s) => s.tasks.length > 0);

  const loadHints = {};
  const latestByExercise = new Map();

  for (const session of sessions.sort((a, b) => (a.completedAt || 0) - (b.completedAt || 0))) {
    for (const task of session.tasks) {
      const doneRows = (task.rows || []).filter((r) => r.done && num(r.weight) > 0);
      if (!doneRows.length) continue;
      const best = doneRows.reduce((a, b) => (num(b.weight) > num(a.weight) ? b : a));
      latestByExercise.set(task.exerciseId, {
        loadKg: num(best.weight),
        updatedAt: new Date(session.completedAt).toISOString(),
      });
    }
  }

  for (const [exerciseId, hint] of latestByExercise) {
    loadHints[exerciseId] = { loadKg: hint.loadKg, updatedAt: hint.updatedAt, source: 'trainheroic_import' };
  }

  const outPath = join(repoRoot, process.env.TH_IMPORT_OUT || 'THE-trainheroic-import.json');
  const payload = {
    backupVersion: 2,
    exportedAt: new Date().toISOString(),
    app: 'THE — TrainHeroic history import',
    build: 'trainheroic-import-v1',
    meta: {
      source: sourcePath.split('/').pop(),
      minUses: MIN_USES,
      frequentTitleCount: frequentTitles.length,
      mappedCanonical: [...titleResolution.values()].filter((r) => r.source !== 'custom').length,
      customExerciseCount: customExercises.length,
      sessionCount: sessions.length,
      parsedLogRows: parsedRows,
      titleAliases,
    },
    state: {
      sessions,
      exercises: customExercises,
      strengthState: {
        workingMaxEvents: [],
        prEvents: [],
        loadHints,
      },
      meta: {
        thTitleAliases: titleAliases,
        thImportAt: new Date().toISOString(),
      },
    },
  };

  writeFileSync(outPath, JSON.stringify(payload, null, 2));
  console.log('Wrote', outPath);
  console.log({
    sessions: sessions.length,
    customExercises: customExercises.length,
    loadHints: Object.keys(loadHints).length,
    canonicalMappings: payload.meta.mappedCanonical,
  });
}

main();
