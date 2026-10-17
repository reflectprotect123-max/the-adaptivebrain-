/**
 * Build test/fixtures/exercise-load-profiles.json from the 120-exercise library
 * plus profile-resolution rules. Run: node scripts/gen-exercise-load-profiles.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const libraryPath = join(
  repoRoot,
  'apps/coach/data/exercise-library.json',
);
const outPath = join(repoRoot, 'test/fixtures/exercise-load-profiles.json');
const seedJsonPath = join(
  repoRoot,
  'apps/coach/exercise-load-profiles.seed.json',
);
const runtimeJsPath = join(
  repoRoot,
  'apps/coach/exercise-load-profiles.js',
);

const library = JSON.parse(readFileSync(libraryPath, 'utf8'));

const MAIN_LIFT =
  /(back squat|front squat|squat|bench press|deadlift|romanian deadlift|rdl|overhead press|shoulder press|strict press|military press|push press|clean|snatch|jerk)/i;
const BW_REP =
  /(pull[- ]?up|chin[- ]?up|\bdip\b|push[- ]?up|nordic|handstand|ab wheel|l[- ]?sit)/i;
const SELF_SCALED = /(trx|suspension)/i;
const EXTERNAL_LOAD =
  /(barbell|dumbbell|\bdb\b|cable|machine|ez[- ]?bar|e[- ]?z[- ]?bar|kettlebell|\bkb\b|smith|leg press|pec deck|hack squat)/i;

function resolveProfile(ex) {
  const name = ex.name || '';
  const mode = ex.tracking_mode;
  const n = name.toLowerCase();
  const equip = (ex.equipment || []).join(' ').toLowerCase();

  if (mode === 'duration_distance') return 'cardio_duration_distance';
  if (mode === 'distance_time_load') return 'carry_distance_load';
  if (mode === 'time_or_reps' || mode === 'reps_or_time') return 'isometric_time_or_reps';

  if (mode === 'reps_load') {
    if (SELF_SCALED.test(n) || SELF_SCALED.test(equip)) return 'self_scaled_reps';
    if (BW_REP.test(n) && !EXTERNAL_LOAD.test(n) && !EXTERNAL_LOAD.test(equip)) return 'bodyweight_reps';
    if (MAIN_LIFT.test(n) && !/(curl|raise|pushdown|row|pulldown|face pull|leg curl)/i.test(n)) {
      return 'main_pct_wm';
    }
    return 'accessory_kg_reps';
  }

  return 'accessory_kg_reps';
}

const fixture = {
  version: 2,
  updated: '2026-09-02',
  purpose:
    'Reference: which logger columns each exercise uses. Derived from hybrid-engine-exercise-library-120 plus profile rules. Core S&C engines deleted 2026-09-03 — this fixture is UI/column metadata only.',
  sources: [
    'apps/coach/log-columns.js',
    'evidence-platform/.../hybrid-engine-exercise-library-120.json',
    'https://www.strongerbyscience.com/progressive-overload-strategies/',
    'https://doi.org/10.4172/2324-9080.1000184',
  ],
  engine_metrics: {
    load: {
      label: 'Load',
      unit: 'kg',
      is_load_bearing: true,
      when: 'External mass on the bar, stack, belt, or carry. Stored on performed_set as load.',
    },
    reps: {
      label: 'Reps',
      unit: 'rep',
      is_load_bearing: false,
      when: 'Completed repetitions per set.',
    },
    rpe: {
      label: 'RPE',
      unit: 'rpe',
      is_load_bearing: false,
      when: 'Derived from logger RIR on the last planned set (RPE = 10 − RIR). Drives load progression.',
    },
    rir: {
      label: 'RIR',
      unit: 'rep',
      is_load_bearing: false,
      when: 'Logger UI field on last set; converted to rpe for engine storage.',
    },
    duration: {
      label: 'Duration',
      unit: 's',
      is_load_bearing: false,
      when: 'Cardio intervals, planks, carries — time under work.',
    },
    distance: {
      label: 'Distance',
      unit: 'm',
      is_load_bearing: false,
      when: 'Rowing, running, carries — metres covered.',
    },
    rest: {
      label: 'Rest',
      unit: 's',
      is_load_bearing: false,
      when: 'Prescribed rest between sets (builder), not always logged per set.',
    },
    pain: {
      label: 'Pain',
      unit: 'flag',
      is_load_bearing: false,
      when: 'Safety flag on exposure; blocks calibration when pain_blocked.',
    },
    tempo: { label: 'Tempo', unit: 's', when: 'Prescription metadata; rarely logged per set today.' },
    watts: { label: 'Watts', unit: 'W', when: 'Cardio machines (future); not in strength logger yet.' },
    calories: { label: 'Calories', unit: 'kcal', when: 'Conditioning summary (future).' },
    height: { label: 'Height', unit: 'm', when: 'Jump metrics (future).' },
  },
  log_column_kinds: {
    reps: { label: 'Reps', maps_to: ['reps'], logger_field: 'reps' },
    reps_range: { label: 'Reps (min–max)', maps_to: ['reps'], logger_field: 'reps' },
    weight_kg: { label: 'Weight (kg)', maps_to: ['load'], logger_field: 'weight' },
    weight_pct_wm: { label: 'Weight % (of WM)', maps_to: ['load'], resolves_via: 'working_max' },
    weight_lwp: { label: 'Weight (LWP)', maps_to: ['load'], resolves_via: 'last_working_prescription' },
    time_sec: { label: 'Time (seconds)', maps_to: ['duration'], logger_field: 'reps' },
    distance_m: { label: 'Distance (metres)', maps_to: ['distance'], logger_field: 'reps' },
  },
  tracking_modes: {
    reps_load: {
      count_in_library: 100,
      description: 'Strength sets — reps plus optional external load or %WM.',
      default_log_columns: ['weight_kg', 'reps'],
      metrics_per_set: ['load', 'reps'],
      metrics_last_set: ['rir'],
      profile_resolution: 'profile_rules.reps_load',
    },
    duration_distance: {
      count_in_library: 7,
      description: 'Cardio — time and/or distance (Assault bike, rower, jump rope).',
      default_log_columns: ['time_sec', 'distance_m'],
      metrics_per_set: ['duration', 'distance'],
      metrics_last_set: [],
      default_profile: 'cardio_duration_distance',
    },
    distance_time_load: {
      count_in_library: 7,
      description:
        'Loaded carries — load + distance only (non-timed). Library mode name is legacy; no prescribed time column.',
      default_log_columns: ['weight_kg', 'distance_m'],
      metrics_per_set: ['load', 'distance'],
      metrics_last_set: [],
      default_profile: 'carry_distance_load',
    },
    time_or_reps: {
      count_in_library: 4,
      description: 'Isometrics — hold for time or log reps (planks).',
      default_log_columns: ['time_sec'],
      metrics_per_set: ['duration'],
      metrics_last_set: [],
      default_profile: 'isometric_time_or_reps',
    },
    reps_or_time: {
      count_in_library: 2,
      description: 'Prep / mobility — reps or timed drill.',
      default_log_columns: ['reps'],
      metrics_per_set: ['reps', 'duration'],
      metrics_last_set: [],
      default_profile: 'isometric_time_or_reps',
    },
  },
  profiles: {
    main_pct_wm: {
      label: 'Main lift — % working max',
      log_columns: ['weight_pct_wm', 'reps'],
      metrics_per_set: ['load', 'reps'],
      metrics_last_set: ['rir'],
      metrics_progression: ['load', 'rpe'],
      progression: 'working_max_calibration_then_pct_wm',
    },
    accessory_kg_reps: {
      label: 'Accessory — kg + reps',
      log_columns: ['weight_kg', 'reps'],
      metrics_per_set: ['load', 'reps'],
      metrics_last_set: ['rir'],
      metrics_progression: ['load'],
      progression: 'load_hint_double_progression',
    },
    bodyweight_reps: {
      label: 'Bodyweight — reps only',
      log_columns: ['reps'],
      metrics_per_set: ['reps'],
      metrics_last_set: ['rir'],
      metrics_progression: ['reps'],
      progression: 'rep_volume_hint',
    },
    added_load_bw: {
      label: 'Bodyweight + added load',
      log_columns: ['weight_kg', 'reps'],
      metrics_per_set: ['load', 'reps'],
      metrics_last_set: ['rir'],
      metrics_progression: ['load', 'reps'],
      progression: 'added_load_wm_when_enabled',
    },
    self_scaled_reps: {
      label: 'Self-scaled — reps + difficulty',
      log_columns: ['reps'],
      metrics_per_set: ['reps'],
      metrics_last_set: ['rir'],
      metrics_progression: ['reps'],
      progression: 'rep_volume_hint',
      note: 'TRX / suspension: resistance from body angle, not kg.',
    },
    isometric_time_or_reps: {
      label: 'Isometric / prep — time or reps',
      log_columns: ['time_sec'],
      metrics_per_set: ['duration'],
      metrics_last_set: [],
      metrics_progression: ['duration'],
      progression: 'rep_or_duration_hint',
    },
    cardio_duration_distance: {
      label: 'Cardio — duration + distance',
      log_columns: ['time_sec', 'distance_m'],
      metrics_per_set: ['duration', 'distance'],
      metrics_last_set: [],
      metrics_progression: ['duration', 'distance'],
      progression: 'cond_engine_not_strength',
      note: 'Logged via conditioning logger, not strength one-set logger.',
    },
    carry_distance_load: {
      label: 'Carry — load + distance (non-timed)',
      log_columns: ['weight_kg', 'distance_m'],
      metrics_per_set: ['load', 'distance'],
      metrics_last_set: [],
      metrics_progression: ['load', 'distance'],
      progression: 'sealed_from_adaptive',
      note:
        'Distance effort only — no prescribed time. Adaptive Open/Next/Close must not touch carries (same seal as timed holds).',
    },
  },
  profile_rules: {
    reps_load: [
      'If name/equipment matches TRX/suspension → self_scaled_reps',
      'If bodyweight calisthenic (pull-up, dip, push-up, nordic, …) without external equipment → bodyweight_reps',
      'If main barbell compound (squat, bench, deadlift, press, oly) → main_pct_wm',
      'Else → accessory_kg_reps (rows, curls, machines, unilateral work)',
    ],
  },
  exercises: library.exercises.map((ex) => ({
    exercise_id: ex.exercise_id,
    name: ex.name,
    category: ex.category,
    tracking_mode: ex.tracking_mode,
    profile: resolveProfile(ex),
  })),
  adapter_divergences: [
    {
      exercise_pattern: 'curl',
      issue: 'REP_PROGRESSION_NAME matches curl → misclassified as bodyweight rep on main',
      intended_profile: 'accessory_kg_reps',
      fixed_in: 'cursor/engine-session-start-rx-84a0',
    },
    {
      exercise_pattern: 'row|pulldown|leg press|carry',
      issue: 'Adapter rep-progression regex includes rows/carries; many should log kg',
      intended_profile: 'accessory_kg_reps or carry_distance_load',
    },
    {
      exercise_pattern: 'Nordic Curl',
      issue: 'library tracking_mode reps_load but movement is bodyweight-dominant',
      intended_profile: 'bodyweight_reps',
    },
  ],
  anti_patterns: [
    {
      mistake: 'Use one regex for all reps_load exercises',
      correct: 'Resolve profile from movement + equipment; map to metrics explicitly',
    },
    {
      mistake: 'Prescribe TRX or suspension work in kg',
      correct_profile: 'self_scaled_reps',
      metrics: ['reps'],
    },
    {
      mistake: 'Store RIR as rir metric in engine',
      correct: 'Logger rir → performed measurement rpe (10 − RIR)',
    },
  ],
};

// Second pass: attach metrics from profiles
for (const entry of fixture.exercises) {
  const prof = fixture.profiles[entry.profile];
  entry.metrics_per_set = prof.metrics_per_set;
  entry.metrics_last_set = prof.metrics_last_set;
  entry.log_columns = prof.log_columns;
}

// Profile counts for sanity
const profileCounts = {};
for (const e of fixture.exercises) {
  profileCounts[e.profile] = (profileCounts[e.profile] || 0) + 1;
}
fixture.profile_counts = profileCounts;
fixture.exercise_count = fixture.exercises.length;

writeFileSync(outPath, JSON.stringify(fixture, null, 2) + '\n');
console.log('Wrote', outPath, '—', fixture.exercise_count, 'exercises');
console.log('Profile counts:', profileCounts);

const seed = Object.fromEntries(
  fixture.exercises.map((e) => [e.exercise_id, e.log_columns]),
);

// Athlete HTML seed uses *-carry ids; library uses farmer-walk / rebuilt-*.
const carryDistanceCols = ['weight_kg', 'distance_m'];
for (const aliasId of [
  'core-farmer-carry',
  'core-suitcase-carry',
  'core-front-rack-carry',
  'core-overhead-carry',
  'core-sandbag-carry',
  'core-bear-hug-carry',
  'core-yoke-carry',
  'core-zercher-carry',
  'core-backpack-carry',
]) {
  seed[aliasId] = carryDistanceCols.slice();
}

writeFileSync(seedJsonPath, JSON.stringify(seed, null, 2) + '\n');
console.log('Wrote', seedJsonPath, '—', Object.keys(seed).length, 'exercise ids');

const runtimeJs = `/* Generated by scripts/gen-exercise-load-profiles.mjs — do not edit by hand. */
(function (global) {
  const SEED = ${JSON.stringify(seed)};

  /** Legacy program template ids → canonical library ids. */
  const PROGRAM_ALIASES = {
    'program-strict-bar-dip': 'core-strict-bar-dip',
    'program-nordic-curl': 'core-nordic-curl',
    'program-barbell-curl': 'core-barbell-curl',
    'program-cable-tricep-pushdown': 'core-cable-tricep-pushdown',
  };

  function resolveExerciseId(exerciseId) {
    const key = String(exerciseId || '').trim();
    return PROGRAM_ALIASES[key] || key;
  }

  function defaultLogColumns(exerciseId) {
    const key = resolveExerciseId(exerciseId);
    const kinds = SEED[key];
    if (!kinds || !kinds.length) return null;
    const slug = key.replace(/\\W+/g, '_');
    return kinds.map((kind, i) => ({
      kind,
      id: 'col_' + slug + '_' + i,
      value: '',
      values: [],
    }));
  }

  /** Logger UI: true = reps-only column, false = load + effort, null = unknown id. */
  function loggerRepOnly(exerciseId) {
    const defs = defaultLogColumns(exerciseId);
    if (!defs || !defs.length) return null;
    return defs.length === 1 && defs[0].kind === 'reps';
  }

  /** Resolve canonical library id from exerciseId/id or exact exercise name. */
  function resolveAthleteExerciseId(ex) {
    const raw = ex && (ex.exerciseId || ex.id);
    const fromId = resolveExerciseId(raw);
    if (fromId && SEED[fromId]) return fromId;
    if (raw) return fromId || raw;
    const name = ex && ex.name;
    if (name && global.ExerciseSearch && ExerciseSearch.search && ExerciseSearch.norm) {
      const hits = ExerciseSearch.search(name, 1);
      if (hits.length && ExerciseSearch.norm(hits[0].name) === ExerciseSearch.norm(name)) {
        const fromName = resolveExerciseId(hits[0].exerciseId);
        if (SEED[fromName]) return fromName;
      }
    }
    return fromId || null;
  }

  global.ExerciseLoadProfiles = {
    defaultLogColumns,
    loggerRepOnly,
    resolveExerciseId,
    resolveAthleteExerciseId,
  };
})(typeof window !== 'undefined' ? window : globalThis);
`;
writeFileSync(runtimeJsPath, runtimeJs);
console.log('Wrote', runtimeJsPath);
