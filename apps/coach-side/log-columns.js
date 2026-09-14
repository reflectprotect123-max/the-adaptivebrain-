/**
 * Builder log columns — one metric type per column.
 * Builder sheet mirrors the logger set-row chrome; column headers are dropdowns.
 * Logger: hard labels only.
 */
(function (global) {
  const KINDS = [
    { key: 'reps', label: 'Reps', loggerLabel: 'Reps', field: 'reps', targetKind: 'reps' },
    { key: 'reps_range', label: 'Reps (min–max)', loggerLabel: 'Reps', field: 'reps', targetKind: 'reps', placeholder: '8-12' },
    { key: 'weight_kg', label: 'Weight (kg)', loggerLabel: 'Weight', field: 'weight', targetKind: 'reps' },
    { key: 'weight_pct_wm', label: 'Weight % (of WM)', loggerLabel: 'Weight', field: 'weight', targetKind: 'reps', placeholder: '70' },
    { key: 'weight_lwp', label: 'Weight (LWP)', loggerLabel: 'Weight', field: 'weight', targetKind: 'reps', placeholder: '+2.5' },
    { key: 'time_sec', label: 'Time (seconds)', loggerLabel: 'Seconds', field: 'reps', targetKind: 'seconds', placeholder: '30' },
    { key: 'distance_m', label: 'Distance (metres)', loggerLabel: 'Metres', field: 'reps', targetKind: 'reps', placeholder: '100' },
  ];

  const KIND_MAP = Object.fromEntries(KINDS.map((k) => [k.key, k]));

  function newId() {
    return 'col_' + Math.random().toString(36).slice(2, 9);
  }

  function kindMeta(key) {
    return KIND_MAP[key] || KIND_MAP.reps;
  }

  function isLoadKind(kind) {
    return kind === 'weight_kg' || kind === 'weight_pct_wm' || kind === 'weight_lwp';
  }

  function isEffortKind(kind) {
    return kind === 'reps' || kind === 'reps_range' || kind === 'time_sec' || kind === 'distance_m';
  }

  function effortKindsOptionsHtml(selected) {
    return KINDS.filter((k) => isEffortKind(k.key))
      .map((k) => `<option value="${k.key}" ${k.key === selected ? 'selected' : ''}>${k.label}</option>`)
      .join('');
  }

  function loadKindsOptionsHtml(selected) {
    return KINDS.filter((k) => isLoadKind(k.key))
      .map((k) => `<option value="${k.key}" ${k.key === selected ? 'selected' : ''}>${k.label}</option>`)
      .join('');
  }

  function effortColumn(cols) {
    return (cols || sheet.columns).find((c) => isEffortKind(c.kind));
  }

  function loadColumn(cols) {
    return (cols || sheet.columns).find((c) => isLoadKind(c.kind));
  }

  function hasPinnedLoad(cols) {
    const col = loadColumn(cols);
    if (!col) return false;
    const v = String((col.values || [])[0] ?? col.value ?? '').trim();
    if (!v) return false;
    if (col.kind === 'weight_pct_wm') return Number(v) >= 1 && Number(v) <= 100;
    if (col.kind === 'weight_lwp') return !Number.isNaN(Number(v));
    return true;
  }

  function isAutopilotVolume(ex) {
    if (ex && ex.autopilotVolume === true) return true;
    if (ex && ex.autopilotVolume === false) return false;
    const noSets = ex && (ex.sets == null || ex.sets === '');
    const noReps = ex && (ex.reps == null || String(ex.reps).trim() === '');
    return !!(noSets && noReps);
  }

  function coachDefaultColumns(ex) {
    const setCount = Math.max(1, Number(ex && ex.sets) || 3);
    const reps = String((ex && ex.reps) || '8');
    const looksTime = /s(ec(onds?)?)?$/i.test(reps.split(',')[0].trim()) || (ex && ex.targetKind === 'seconds');
    const effortRaw = reps.replace(/s(ec(onds?)?)?$/i, '').trim() || reps;
    let effortKind = 'reps';
    if (looksTime) effortKind = 'time_sec';
    else if (/^\d+\s*[-–]\s*\d+$/.test(effortRaw.trim())) effortKind = 'reps_range';
    else if (ex && ex.logColumns) {
      const saved = ex.logColumns.find((c) => isEffortKind(c.kind));
      if (saved) effortKind = saved.kind;
    }
    const cols = [
      {
        id: newId(),
        kind: effortKind,
        value: effortRaw,
        values: splitValues(effortRaw, setCount),
      },
    ];
    if (ex && ex.loadExpr && ex.loadExpr.exprKind === 'pct_of_max') {
      const pct = String(Math.round(Number(ex.loadExpr.exprArg) * 100) || '');
      cols.unshift({ id: newId(), kind: 'weight_pct_wm', value: pct, values: splitValues(pct, setCount) });
    } else if (ex && ex.loadExpr && ex.loadExpr.exprKind === 'lwp_delta') {
      const d = String(ex.loadExpr.exprArg ?? '');
      cols.unshift({ id: newId(), kind: 'weight_lwp', value: d, values: splitValues(d, setCount) });
    } else if (ex && String(ex.load || '').trim()) {
      cols.unshift({
        id: newId(),
        kind: 'weight_kg',
        value: String(ex.load),
        values: splitValues(ex.load, setCount),
      });
    }
    return cols;
  }

  function coachNormalizeColumns(ex) {
    const setCount = Math.max(1, Number(ex && ex.sets) || 3);
    if (ex && Array.isArray(ex.logColumns) && ex.logColumns.length) {
      return ex.logColumns.map((c) => {
        const kind = KIND_MAP[c.kind] ? c.kind : 'reps';
        const value = c.value == null ? '' : String(c.value);
        const values =
          Array.isArray(c.values) && c.values.length
            ? splitValues(c.values.join(','), setCount)
            : splitValues(value, setCount);
        return { id: c.id || newId(), kind, value: joinValues(values), values };
      });
    }
    return coachDefaultColumns(ex || {});
  }

  function splitValues(raw, setCount) {
    const n = Math.max(1, setCount | 0);
    let parts = String(raw == null ? '' : raw)
      .split(',')
      .map((x) => x.trim())
      .filter((x, i, a) => a.length > 1 || x !== '' || i === 0);
    if (!parts.length) parts = [''];
    if (parts.length === 1) parts = Array.from({ length: n }, () => parts[0]);
    while (parts.length < n) parts.push(parts[parts.length - 1] || '');
    return parts.slice(0, n);
  }

  function joinValues(values) {
    const parts = (values || []).map((v) => String(v == null ? '' : v).trim());
    if (!parts.length) return '';
    const allSame = parts.every((p) => p === parts[0]);
    return allSame ? parts[0] : parts.join(', ');
  }

  function defaultColumns(ex) {
    const setCount = Math.max(1, Number(ex && ex.sets) || 3);
    const reps = String((ex && ex.reps) || '8');
    const cols = [];
    if (ex && ex.loadExpr && ex.loadExpr.exprKind === 'pct_of_max') {
      const pct = String(Math.round(Number(ex.loadExpr.exprArg) * 100) || '');
      cols.push({ id: newId(), kind: 'weight_pct_wm', value: pct, values: splitValues(pct, setCount) });
    } else if (ex && ex.loadExpr && ex.loadExpr.exprKind === 'lwp_delta') {
      const d = String(ex.loadExpr.exprArg ?? '');
      cols.push({ id: newId(), kind: 'weight_lwp', value: d, values: splitValues(d, setCount) });
    } else {
      cols.push({ id: newId(), kind: 'weight_kg', value: '', values: splitValues('', setCount) });
    }
    const looksTime = /s(ec(onds?)?)?$/i.test(reps.split(',')[0].trim()) || (ex && ex.targetKind === 'seconds');
    const effortRaw = reps.replace(/s(ec(onds?)?)?$/i, '').trim() || reps;
    cols.push({
      id: newId(),
      kind: looksTime ? 'time_sec' : 'reps',
      value: effortRaw,
      values: splitValues(effortRaw, setCount),
    });
    return cols;
  }

  function normalizeColumns(ex) {
    const setCount = Math.max(1, Number(ex && ex.sets) || 3);
    if (ex && Array.isArray(ex.logColumns) && ex.logColumns.length) {
      return ex.logColumns.map((c) => {
        const kind = KIND_MAP[c.kind] ? c.kind : 'reps';
        const value = c.value == null ? '' : String(c.value);
        const values = Array.isArray(c.values) && c.values.length ? splitValues(c.values.join(','), setCount) : splitValues(value, setCount);
        return { id: c.id || newId(), kind, value: joinValues(values), values };
      });
    }
    return defaultColumns(ex || {});
  }

  function optionsHtml(selected) {
    return KINDS.map(
      (k) => `<option value="${k.key}" ${k.key === selected ? 'selected' : ''}>${k.label}</option>`,
    ).join('');
  }

  function syncLegacyFromColumns(ex, columns, setCount) {
    let cols = (columns || coachNormalizeColumns(ex)).map((c) => {
      const values = Array.isArray(c.values) ? c.values : splitValues(c.value, setCount || ex.sets || 1);
      return { id: c.id || newId(), kind: c.kind, value: joinValues(values), values };
    });
    cols = cols.filter((c) => !isLoadKind(c.kind) || hasPinnedLoad([c]) || sheet.athleteMode || sheet.autopilotVolume);
    ex.logColumns = cols;
    if (setCount) ex.sets = Math.max(1, setCount);
    const effort = effortColumn(cols);
    const loadCol = loadColumn(cols);
    if (effort) ex.reps = String(effort.value || '').trim() || ex.reps || '8';
    if (sheet.autopilotVolume) {
      ex.autopilotVolume = true;
      ex.sets = null;
      ex.reps = null;
    } else {
      ex.autopilotVolume = false;
      if (setCount) ex.sets = Math.max(1, setCount);
      if (effort) ex.reps = String(effort.value || '').trim() || '8';
    }
    delete ex.loadExpr;
    delete ex.load;
    if (loadCol && hasPinnedLoad(cols)) {
      if (loadCol.kind === 'weight_pct_wm') {
        const pct = Number(String(loadCol.values?.[0] ?? loadCol.value).split(',')[0]);
        if (pct >= 1 && pct <= 100) ex.loadExpr = { exprKind: 'pct_of_max', exprArg: pct / 100 };
      } else if (loadCol.kind === 'weight_lwp') {
        const delta = Number(String(loadCol.values?.[0] ?? loadCol.value).split(',')[0]);
        if (!Number.isNaN(delta)) ex.loadExpr = { exprKind: 'lwp_delta', exprArg: delta };
      } else if (loadCol.kind === 'weight_kg') {
        const vals = loadCol.values || splitValues(loadCol.value, setCount || ex.sets || 1);
        ex.load = joinValues(vals);
      }
    }
    return ex;
  }

  function columnsMeta(ex) {
    const cols = normalizeColumns(ex);
    return cols
      .map((c) => {
        const meta = kindMeta(c.kind);
        const v = String(c.value || '').trim();
        if (c.kind === 'weight_pct_wm' && v) return `${v}% WM`;
        if (c.kind === 'weight_lwp' && v) return `LWP ${v}`;
        if (c.kind === 'weight_kg' && v) return `${v} kg`;
        if (v) return `${meta.loggerLabel} ${v}`;
        return meta.label;
      })
      .join(' · ');
  }

  function fmtRest(sec) {
    const s = Math.max(0, Number(sec) || 0);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return String(m).padStart(2, '0') + ':' + String(r).padStart(2, '0');
  }

  /** Sheet draft while Edit lift is open */
  let sheet = { sets: 3, restSec: 120, targetRir: null, autopilotVolume: true, athleteMode: false, showOverrides: false, columns: [] };
  let changeHandler = null;

  function setChangeHandler(fn) {
    changeHandler = typeof fn === 'function' ? fn : null;
  }

  function notifyChange() {
    if (typeof changeHandler === 'function') changeHandler();
  }

  function beginSheet(ex) {
    const autopilotVolume = isAutopilotVolume(ex);
    const sets = autopilotVolume ? 3 : Math.max(1, Number(ex && ex.sets) || 3);
    const restSec = Math.max(0, Number(ex && ex.restSec) || 120);
    const targetRir =
      ex && ex.targetRir != null && Number.isFinite(Number(ex.targetRir)) ? Math.round(Number(ex.targetRir)) : null;
    sheet = {
      sets,
      restSec,
      targetRir,
      autopilotVolume,
      athleteMode: false,
      showOverrides: !!(ex && ex.logColumns && ex.logColumns.some((c) => perSetOverrideActive(c.values, sets))),
      columns: coachNormalizeColumns({ ...(ex || {}), sets }),
    };
    return sheet;
  }

  function resolveProfileExerciseId(ex) {
    if (global.ExerciseLoadProfiles && ExerciseLoadProfiles.resolveAthleteExerciseId) {
      return ExerciseLoadProfiles.resolveAthleteExerciseId(ex);
    }
    return ex && (ex.exerciseId || ex.id);
  }

  /** Saved reps-only columns that contradict the exercise load profile. */
  function savedLogColumnsStale(ex, cols) {
    if (!cols || !cols.length) return false;
    var exerciseId = resolveProfileExerciseId(ex);
    if (global.ExerciseLoadProfiles && ExerciseLoadProfiles.loggerRepOnly) {
      if (exerciseId) {
        var repOnly = ExerciseLoadProfiles.loggerRepOnly(exerciseId);
        if (repOnly === true) return false;
        if (repOnly === false && cols.length === 1 && cols[0].kind === 'reps') return true;
        if (repOnly === null && cols.length === 1 && cols[0].kind === 'reps') return true;
      }
    }
    if (cols.length === 1 && cols[0].kind === 'reps' && !exerciseId) return true;
    return false;
  }

  function repOnlyAthleteColumns(ex) {
    var exerciseId = resolveProfileExerciseId(ex);
    if (
      exerciseId &&
      global.ExerciseLoadProfiles &&
      ExerciseLoadProfiles.loggerRepOnly
    ) {
      var profileRepOnly = ExerciseLoadProfiles.loggerRepOnly(exerciseId);
      if (profileRepOnly === true) return true;
      if (profileRepOnly === false) return false;
    }
    return false;
  }

  function defaultAthleteColumns(ex) {
    var exerciseId = resolveProfileExerciseId(ex);
    if (
      exerciseId &&
      global.ExerciseLoadProfiles &&
      ExerciseLoadProfiles.defaultLogColumns
    ) {
      var profileCols = ExerciseLoadProfiles.defaultLogColumns(exerciseId);
      if (profileCols && profileCols.length) {
        return profileCols.map(function (c) {
          return {
            id: c.id || newId(),
            kind: c.kind,
            value: '',
            values: splitValues('', sheet.sets),
          };
        });
      }
    }
    return [
      { id: newId(), kind: 'weight_kg', value: '', values: splitValues('', sheet.sets) },
      { id: newId(), kind: 'reps', value: '', values: splitValues('', sheet.sets) },
    ];
  }

  function ensureAthleteColumnCount() {
    sheet.autopilotVolume = true;
    if (!sheet.columns.length) sheet.columns = defaultAthleteColumns(sheet._exercise || {});
    while (sheet.columns.length < 2) {
      sheet.columns.push({
        id: newId(),
        kind: 'reps',
        value: '',
        values: splitValues('', sheet.sets),
      });
    }
    if (sheet.columns.length > 3) sheet.columns = sheet.columns.slice(0, 3);
  }

  function ensureAthleteLogColumns(ex) {
    let cols =
      ex && Array.isArray(ex.logColumns) && ex.logColumns.length
        ? coachNormalizeColumns(ex)
        : defaultAthleteColumns(ex);
    const repOnly = repOnlyAthleteColumns(ex);
    const explicitSingle =
      cols.length === 1 && ex && Array.isArray(ex.logColumns) && ex.logColumns.length === 1;
    const minCols = repOnly ? 1 : explicitSingle ? 1 : 2;
    const maxCols = repOnly ? 1 : Math.min(3, Math.max(minCols, cols.length));
    cols = cols.slice(0, maxCols);
    while (cols.length < minCols) {
      cols.push({ id: newId(), kind: 'reps', value: '', values: splitValues('', 3) });
    }
    return cols.slice(0, maxCols).map((c) => ({
      id: c.id || newId(),
      kind: KIND_MAP[c.kind] ? c.kind : 'reps',
      value: '',
      values: splitValues('', 3),
    }));
  }

  function columnLayout(ex) {
    const cols = ensureAthleteLogColumns(ex || {});
    const loadCol = loadColumn(cols);
    const effortCols = cols.filter((c) => isEffortKind(c.kind));
    if (cols.length === 1) return { cols, loadCol: null, effortCols, layout: 'single' };
    if (cols.length === 3) return { cols, loadCol, effortCols, layout: 'triple' };
    return { cols, loadCol, effortCols, layout: 'load_x_effort' };
  }

  function athleteColumnOptionsHtml(selected) {
    return optionsHtml(selected);
  }

  function beginAthleteSheet(ex) {
    beginSheet({ ...(ex || {}), autopilotVolume: true, sets: null, reps: null });
    sheet.athleteMode = true;
    sheet.autopilotVolume = true;
    sheet._exercise = ex || {};
    sheet.columns = ensureAthleteLogColumns(ex || {});
    return sheet;
  }

  function setAutopilotVolume(on) {
    sheet.autopilotVolume = !!on;
    if (sheet.autopilotVolume) {
      sheet.showOverrides = false;
    }
    refreshPrescription();
    notifyChange();
  }

  function pinVolume(sets, reps) {
    sheet.autopilotVolume = false;
    sheet.sets = Math.max(1, Math.min(12, Number(sets) || 3));
    onSimpleReps(reps || '8');
    resizeSets(sheet.sets);
    refreshPrescription();
    notifyChange();
  }

  function clearPinnedVolume() {
    sheet.autopilotVolume = true;
    onSimpleReps('8');
    refreshPrescription();
    notifyChange();
  }

  function effortColumnIndex() {
    return sheet.columns.findIndex((c) => isEffortKind(c.kind));
  }

  function loadColumnIndex() {
    return sheet.columns.findIndex((c) => isLoadKind(c.kind));
  }

  function onSimpleEffortKind(kind) {
    const idx = effortColumnIndex();
    if (idx < 0) return;
    onKindChange(idx, kind);
  }

  function onSimpleReps(value) {
    const idx = effortColumnIndex();
    if (idx < 0) return;
    onPrescriptionChange(idx, value);
  }

  function ensureLoadColumn(kind) {
    let idx = loadColumnIndex();
    if (idx < 0) {
      sheet.columns.unshift({
        id: newId(),
        kind: isLoadKind(kind) ? kind : 'weight_kg',
        value: '',
        values: splitValues('', sheet.sets),
      });
      idx = 0;
    }
    return idx;
  }

  function onPinLoadKind(kind) {
    const idx = ensureLoadColumn(kind);
    sheet.columns[idx].kind = isLoadKind(kind) ? kind : 'weight_kg';
    refreshPrescription();
    notifyChange();
  }

  function onPinLoadValue(value) {
    const idx = ensureLoadColumn(loadColumn()?.kind || 'weight_kg');
    onPrescriptionChange(idx, value);
  }

  function clearPinnedLoad() {
    sheet.columns = sheet.columns.filter((c) => !isLoadKind(c.kind));
    refreshPrescription();
    notifyChange();
  }

  /** True when any set after 1 differs from set 1 (coach authored per-set overrides). */
  function perSetOverrideActive(values, setCount) {
    const vals = values || [];
    const first = String(vals[0] == null ? '' : vals[0]).trim();
    for (let i = 1; i < setCount; i++) {
      const v = String(vals[i] == null ? '' : vals[i]).trim();
      if (v !== first && v !== '') return true;
    }
    return false;
  }

  function toggleOverrides(on) {
    sheet.showOverrides = !!on;
    if (!sheet.showOverrides) {
      sheet.columns.forEach((c) => {
        const base = (c.values || [])[0] == null ? '' : c.values[0];
        if (shouldForwardFillColumn(c.kind)) {
          c.values = splitValues(base, sheet.sets);
        } else {
          c.values = [base, ...Array.from({ length: Math.max(0, sheet.sets - 1) }, () => '')];
        }
        c.value = joinValues(c.values);
      });
    }
    refreshPrescription();
    notifyChange();
  }

  function setTargetRir(v) {
    const n = String(v == null ? '' : v).trim();
    sheet.targetRir = n === '' || !Number.isFinite(Number(n)) ? null : Math.max(0, Math.min(10, Math.round(Number(n))));
    refreshPrescription();
  }

  function getSheetColumns() {
    return sheet.columns.map((c) => ({
      id: c.id,
      kind: c.kind,
      values: (c.values || []).slice(),
      value: joinValues(c.values),
    }));
  }

  function getSetCount() {
    return sheet.sets;
  }

  function getRestSec() {
    return sheet.restSec;
  }

  function onRestChange(v) {
    sheet.restSec = Math.max(0, Number(v) || 0);
    const btn = global.document && global.document.getElementById('builderRestBtn');
    if (btn) btn.textContent = 'Rest ' + fmtRest(sheet.restSec);
    refreshPrescription();
    notifyChange();
  }

  function onKindChange(colIdx, kind) {
    if (!sheet.columns[colIdx]) return;
    sheet.columns[colIdx].kind = KIND_MAP[kind] ? kind : 'reps';
    refreshBuilderUi();
    notifyChange();
  }

  function shouldForwardFillColumn(kind) {
    return kind === 'reps' || kind === 'reps_range';
  }

  function onPrescriptionChange(colIdx, value) {
    const col = sheet.columns[colIdx];
    if (!col) return;
    if (!Array.isArray(col.values)) col.values = splitValues(col.value, sheet.sets);
    col.values[0] = value;
    if (shouldForwardFillColumn(col.kind)) {
      for (let i = 1; i < sheet.sets; i++) col.values[i] = value;
    } else if (!sheet.showOverrides) {
      for (let i = 1; i < sheet.sets; i++) col.values[i] = '';
    }
    col.value = joinValues(col.values);
    refreshPrescription();
    notifyChange();
  }

  function onCellChange(colIdx, setIdx, value) {
    const col = sheet.columns[colIdx];
    if (!col) return;
    if (!Array.isArray(col.values)) col.values = splitValues(col.value, sheet.sets);
    col.values[setIdx] = value;
    if (shouldForwardFillColumn(col.kind) && !sheet.showOverrides) {
      // Forward-fill reps column only — never backfill earlier sets.
      for (let i = setIdx + 1; i < sheet.sets; i++) col.values[i] = value;
      syncForwardColumnInputs(colIdx, setIdx, value);
      for (let i = setIdx; i < sheet.sets; i++) {
        const chip = global.document && global.document.querySelector(`.builder-setrow[data-set="${i}"] .target`);
        if (chip) chip.textContent = String(value || '').trim() || '—';
      }
    } else {
      const effortIdx = sheet.columns.findIndex((c) => shouldForwardFillColumn(c.kind));
      if (colIdx === effortIdx) {
        const chip = global.document && global.document.querySelector(`.builder-setrow[data-set="${setIdx}"] .target`);
        if (chip) chip.textContent = String(value || '').trim() || '—';
      }
    }
    col.value = joinValues(col.values);
    refreshPrescription();
    notifyChange();
  }

  function syncForwardColumnInputs(colIdx, setIdx, value) {
    const card = global.document && global.document.getElementById('builderLoggerCard');
    if (!card) return;
    card.querySelectorAll('.builder-setrow').forEach((row) => {
      const rowSet = Number(row.dataset.set);
      if (!Number.isFinite(rowSet) || rowSet <= setIdx) return;
      const input = row.querySelectorAll('input:not([disabled])')[colIdx];
      if (input) input.value = value;
    });
  }

  function resizeSets(n) {
    const next = Math.max(1, Math.min(12, n | 0));
    sheet.sets = next;
    sheet.columns.forEach((c) => {
      c.values = splitValues(joinValues(c.values || splitValues(c.value, next)), next);
      if (!sheet.showOverrides && !shouldForwardFillColumn(c.kind)) {
        const base = c.values[0] == null ? '' : c.values[0];
        c.values = [base, ...Array.from({ length: Math.max(0, next - 1) }, () => '')];
      }
      c.value = joinValues(c.values);
    });
    const setsInput = global.document && global.document.getElementById('exSets');
    if (setsInput) setsInput.value = String(next);
    refreshPrescription();
  }

  function addSet() {
    resizeSets(sheet.sets + 1);
    notifyChange();
  }

  function removeSet() {
    if (sheet.sets <= 1) return;
    resizeSets(sheet.sets - 1);
    notifyChange();
  }

  function addColumn() {
    if (sheet.columns.length >= 3) {
      if (global.alert) global.alert('Max 3 log columns.');
      return;
    }
    sheet.columns.push({
      id: newId(),
      kind: 'reps',
      value: '',
      values: splitValues('', sheet.sets),
    });
    refreshBuilderUi();
    notifyChange();
  }

  function removeColumn(idx) {
    const min = sheet.athleteMode ? 2 : 1;
    if (sheet.columns.length <= min) return;
    sheet.columns.splice(idx, 1);
    refreshBuilderUi();
    notifyChange();
  }

  function effortTarget(setIdx) {
    const effort = sheet.columns.find((c) => c.kind === 'reps' || c.kind === 'reps_range' || c.kind === 'time_sec' || c.kind === 'distance_m');
    if (!effort) return '—';
    const v = (effort.values || [])[setIdx];
    return String(v == null || v === '' ? '—' : v);
  }

  function builderPinLoadHtml() {
    const pinned = hasPinnedLoad();
    const load = loadColumn();
    const loadKind = load ? load.kind : 'weight_kg';
    const loadVal = load ? (load.values || [])[0] == null ? '' : load.values[0] : '';
    if (!pinned) {
      return `<details class="rx-overrides rx-advanced"><summary>Pin opening load (optional)</summary>
        <p class="muted" style="margin:8px 0;font-size:11px;line-height:1.45">Leave blank — the engine sets load from working max, progression, and in-session autoreg. Only pin if you need a fixed kg, % WM, or LWP delta on set 1.</p>
        <div class="rx-grid cols-2" style="margin-top:8px">
          <div class="field"><label>Load type</label>
            <select class="logcol-kind" onchange="LogColumns.onPinLoadKind(this.value)">${loadKindsOptionsHtml(loadKind)}</select></div>
          <div class="field"><label>Set 1 value</label>
            <input value="${String(loadVal).replace(/"/g, '&quot;')}" placeholder="e.g. 100 or 70" onchange="LogColumns.onPinLoadValue(this.value)" oninput="LogColumns.onPinLoadValue(this.value)"></div>
        </div>
      </details>`;
    }
    return `<details class="rx-overrides rx-advanced" open><summary>Pin opening load (optional)</summary>
      <div class="rx-grid cols-2" style="margin-top:8px">
        <div class="field"><label>Load type</label>
          <select class="logcol-kind" onchange="LogColumns.onPinLoadKind(this.value)">${loadKindsOptionsHtml(loadKind)}</select></div>
        <div class="field"><label>Set 1 value</label>
          <input value="${String(loadVal).replace(/"/g, '&quot;')}" onchange="LogColumns.onPinLoadValue(this.value)" oninput="LogColumns.onPinLoadValue(this.value)"></div>
      </div>
      <button type="button" class="btn ghost small" style="margin-top:8px" onclick="LogColumns.clearPinnedLoad()">Clear — use autopilot load</button>
    </details>`;
  }

  function builderPinVolumeHtml() {
    if (sheet.autopilotVolume) {
      return `<details class="rx-overrides rx-advanced"><summary>Pin sets &amp; reps (optional)</summary>
        <p class="muted" style="margin:8px 0;font-size:11px;line-height:1.45">Leave on autopilot — engine picks sets × reps from history, calibration, and recovery. Pin only when you need a fixed prescription.</p>
        <div class="rx-grid cols-2" style="margin-top:8px">
          <div class="field"><label>Sets</label>
            <input id="pinSetsVal" type="number" min="1" max="12" placeholder="3" onchange="LogColumns.pinVolume(Number(this.value), document.getElementById('pinRepsVal').value)"></div>
          <div class="field"><label>Reps</label>
            <input id="pinRepsVal" placeholder="8 or 6-8" onchange="LogColumns.pinVolume(document.getElementById('pinSetsVal')?.value || 3, this.value)"></div>
        </div>
      </details>`;
    }
    const effort = effortColumn() || { kind: 'reps', values: ['8'] };
    const meta = kindMeta(effort.kind);
    const repsVal = (effort.values || [])[0] == null ? '' : effort.values[0];
    return `<details class="rx-overrides rx-advanced" open><summary>Pin sets &amp; reps (optional)</summary>
      <div class="rx-grid cols-2" style="margin-top:8px">
        <div class="field"><label>Sets</label>
          <input type="number" min="1" max="12" value="${sheet.sets}" onchange="LogColumns.resizeSets(Number(this.value)); LogColumns.setAutopilotVolume(false)"></div>
        <div class="field"><label>${meta.loggerLabel}</label>
          <input value="${String(repsVal).replace(/"/g, '&quot;')}" onchange="LogColumns.onSimpleReps(this.value); LogColumns.setAutopilotVolume(false)"></div>
      </div>
      <button type="button" class="btn ghost small" style="margin-top:8px" onclick="LogColumns.clearPinnedVolume()">Clear — use autopilot volume</button>
    </details>`;
  }

  function builderPrescriptionGridHtml(opts = {}) {
    const compact = !!opts.compact;
    const effort = effortColumn() || { kind: 'reps', values: ['8'] };
    const meta = kindMeta(effort.kind);
    const repsVal = (effort.values || [])[0] == null ? '' : effort.values[0];
    const ph = meta.placeholder || '8 or 6-8';
    const pinnedLoad = hasPinnedLoad();
    const loadLabel = pinnedLoad ? kindMeta(loadColumn().kind).label : 'Autopilot';
    const volumeLabel = sheet.autopilotVolume ? 'Autopilot' : `${sheet.sets} × ${repsVal || '—'}`;
    const effortFields = sheet.autopilotVolume
      ? ''
      : `<div class="rx-grid cols-2" style="margin-top:12px">
        <div class="field"><label>Target</label>
          <select class="logcol-kind" aria-label="Target type" onchange="LogColumns.onSimpleEffortKind(this.value)">${effortKindsOptionsHtml(effort.kind)}</select></div>
        <div class="field"><label>${meta.loggerLabel}</label>
          <input value="${String(repsVal).replace(/"/g, '&quot;')}" placeholder="${ph}" aria-label="Target reps or effort" onchange="LogColumns.onSimpleReps(this.value)" oninput="LogColumns.onSimpleReps(this.value)"></div>
      </div>`;
    const overrideSection = sheet.autopilotVolume || compact
      ? ''
      : `<details class="rx-overrides" ${sheet.showOverrides ? 'open' : ''} ontoggle="LogColumns.toggleOverrides(this.open)">
        <summary>Per-set rep overrides (optional)</summary>
        ${builderOverridesTableHtml()}
      </details>`;
    const cardClass = compact ? 'card rx-prescription-card compact' : 'card rx-prescription-card';
    const cardMeta = compact ? 'Engine handles volume and load.' : 'Engine handles volume + load · in-session autoreg after set 1';
    const pinVolume = compact ? '' : builderPinVolumeHtml();
    const pinLoad = compact ? '' : builderPinLoadHtml();
    return `<div class="${cardClass}" id="builderPrescriptionCard" style="margin-top:10px">
      <div class="title">Prescription</div>
      <div class="meta">${cardMeta}</div>
      <div class="autopilot-strip"><span class="autopilot-label">Volume</span><span class="autopilot-value">${volumeLabel}</span>${compact ? '' : '<span class="autopilot-note">History, calibration, recovery — you do not enter sets × reps here</span>'}</div>
      ${effortFields}
      <div class="autopilot-strip"><span class="autopilot-label">Load</span><span class="autopilot-value">${loadLabel}</span>${compact ? '' : '<span class="autopilot-note">Working max + progression — you do not enter kg here</span>'}</div>
      ${pinVolume}
      ${pinLoad}
      ${overrideSection}
    </div>`;
  }

  function builderOverridesTableHtml() {
    const effort = effortColumn();
    if (!effort) return '';
    const ci = sheet.columns.indexOf(effort);
    const meta = kindMeta(effort.kind);
    const head = `<tr><th>Set</th><th>${meta.loggerLabel}</th></tr>`;
    const body = Array.from({ length: sheet.sets }, (_, i) => {
      const val = (effort.values || [])[i] == null ? '' : effort.values[i];
      const ph = i === 0 ? meta.placeholder || '' : 'same as set 1';
      return `<tr><td>${i + 1}</td><td><input value="${String(val).replace(/"/g, '&quot;')}" placeholder="${ph}" onchange="LogColumns.onCellChange(${ci},${i},this.value)" oninput="LogColumns.onCellChange(${ci},${i},this.value)"></td></tr>`;
    }).join('');
    return `<table class="set-table rx-override-table"><thead>${head}</thead><tbody>${body}</tbody></table>`;
  }

  function escTwin(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
    });
  }

  function builderTargetRir(ex) {
    const n = ex && ex.targetRir;
    if (n != null && Number.isFinite(Number(n))) return Math.max(0, Math.min(4, Math.round(Number(n))));
    return 2;
  }

  function builderTargetRirLabel(rir) {
    return (
      { 4: 'Very easy', 3: 'Easy', 2: 'Medium', 1: 'Hard', 0: 'Max effort' }[rir] || 'Medium'
    );
  }

  /** Builder calibration — target effort feeds session-start load and logger baseline RIR. */
  function builderTargetEffortHtml(ex, bi, ei) {
    const rir = builderTargetRir(ex);
    const sliderVal = 4 - rir;
    return (
      '<div class="slider-card ath-builder-calibration">' +
      '<div class=sliderhead><b>How should this feel?</b>' +
      `<span id="athTargetRirLabel_${bi}_${ei}" class=slidervalue>${escTwin(builderTargetRirLabel(rir))} · RIR ~${rir}</span></div>` +
      `<input type="range" id="athTargetRir_${bi}_${ei}" min="0" max="4" step="1" value="${sliderVal}" aria-label="Target effort" oninput="setAthleteLiftTargetRir(${bi},${ei},this.value)">` +
      '<div class=sliderlabels><span>Very easy</span><span>Easy</span><span>Medium</span><span>Hard</span><span>Max</span></div>' +
      '<div class=slider-hint>Session start uses this target. During training, the logger slider adjusts load set to set.</div></div>'
    );
  }

  function builderSideModeHtml(ex, bi, ei) {
    const mode = (ex && ex.sideMode) || 'none';
    return (
      '<div class="side-mode-row rest-row">' +
      `<label for="athSideMode_${bi}_${ei}">Sides</label>` +
      `<select id="athSideMode_${bi}_${ei}" aria-label="Side mode" onchange="setAthleteLiftSideMode(${bi},${ei},this.value)">` +
      `<option value="none"${mode === 'none' ? ' selected' : ''}>None</option>` +
      `<option value="both_per_round"${mode === 'both_per_round' ? ' selected' : ''}>L+R per round</option>` +
      '</select></div>'
    );
  }

  function builderLiftMetricsHtml(ex, bi, ei) {
    const { cols, loadCol, layout } = columnLayout(ex || {});
    const effortCol = effortColumn(cols) || cols[0];
    const effortCi = effortCol ? cols.indexOf(effortCol) : 0;
    if (layout === 'single') {
      return (
        '<div class=hero-metrics><div class="metric-col metric-col-single">' +
        '<div class="metric-val metric-dash">—</div>' +
        `<select class="builder-metric-select logcol-kind" aria-label="Effort metric" onchange="setAthleteLiftColumnKind(${bi},${ei},${effortCi},this.value)">` +
        effortKindsOptionsHtml(effortCol.kind) +
        '</select></div></div>'
      );
    }
    if (layout === 'triple') {
      let html = '<div class=hero-metrics>';
      cols.forEach((col, ci) => {
        if (ci > 0) html += '<div class=metric-sep>·</div>';
        const options = isLoadKind(col.kind) ? loadKindsOptionsHtml(col.kind) : effortKindsOptionsHtml(col.kind);
        const ariaLabel = isLoadKind(col.kind) ? 'Load metric' : 'Effort metric';
        html +=
          '<div class=metric-col><div class="metric-val metric-dash">—</div>' +
          `<select class="builder-metric-select logcol-kind" aria-label="${ariaLabel}" onchange="setAthleteLiftColumnKind(${bi},${ei},${ci},this.value)">` +
          options +
          '</select></div>';
      });
      html += '</div>';
      return html;
    }
    const loadCi = loadCol ? cols.indexOf(loadCol) : -1;
    if (!loadCol) {
      return (
        '<div class=hero-metrics><div class="metric-col metric-col-single">' +
        '<div class="metric-val metric-dash">—</div>' +
        `<select class="builder-metric-select logcol-kind" aria-label="Effort metric" onchange="setAthleteLiftColumnKind(${bi},${ei},${effortCi},this.value)">` +
        effortKindsOptionsHtml(effortCol.kind) +
        '</select></div></div>'
      );
    }
    return (
      '<div class=hero-metrics>' +
      '<div class=metric-col><div class="metric-val metric-dash">—</div>' +
      `<select class="builder-metric-select logcol-kind" aria-label="Load metric" onchange="setAthleteLiftColumnKind(${bi},${ei},${loadCi},this.value)">` +
      loadKindsOptionsHtml(loadCol.kind) +
      '</select></div>' +
      '<div class=metric-sep>×</div>' +
      '<div class=metric-col><div class="metric-val metric-dash">—</div>' +
      `<select class="builder-metric-select logcol-kind" aria-label="Effort metric" onchange="setAthleteLiftColumnKind(${bi},${ei},${effortCi},this.value)">` +
      effortKindsOptionsHtml(effortCol.kind) +
      '</select></div></div>'
    );
  }

  function builderLiftPanelHtml(ex, opts) {
    opts = opts || {};
    const bi = Number(opts.bi) || 0;
    const ei = Number(opts.ei) || 0;
    const letter = opts.letter ? String(opts.letter) : '';
    const restSec = Math.max(0, Number(ex && ex.restSec) || 120);
    const name = escTwin(ex && ex.name ? ex.name : '');
    const suggestHtml = opts.suggestHtml || '';
    const letterHtml = letter
      ? `<div class=ath-ss-panel-letter>${escTwin(letter)}</div>`
      : '';
    return (
      `<div class="ath-ss-lift${letter ? ' ath-ss-lift-' + letter.toLowerCase() : ''}">` +
      letterHtml +
      `<input id="athLiftName_${bi}_${ei}" class="ath-builder-ex-name" type="text" value="${name}" autocomplete="off" placeholder="Exercise name" aria-label="Exercise name" oninput="setAthleteLiftName(${bi},${ei},this.value)" onfocus="refreshAthleteLiftSuggest(${bi},${ei},this.value)">` +
      `<div id="athSuggest_${bi}_${ei}" class="ath-suggest-host">${suggestHtml}</div>` +
      '<div class=hero>' +
      '<div class=hero-label>Load & effort · session start fills numbers</div>' +
      builderLiftMetricsHtml(ex, bi, ei) +
      builderSideModeHtml(ex, bi, ei) +
      `<div class=rest-row><label for="athRest_${bi}_${ei}">Rest (seconds)</label>` +
      `<input id="athRest_${bi}_${ei}" type="number" min="0" step="5" value="${restSec}" aria-label="Rest seconds" oninput="setAthleteLiftRest(${bi},${ei},this.value,this)"></div></div>` +
      builderTargetEffortHtml(ex, bi, ei) +
      '</div>'
    );
  }

  /** Merged superset builder card — one card for a linked A/B pair. */
  function builderSupersetTwinHtml(exA, exB, opts) {
    opts = opts || {};
    const bi = Number(opts.bi) || 0;
    const eiA = Number(opts.eiA) || 0;
    const eiB = Number(opts.eiB) || eiA + 1;
    return (
      `<div class="logger-screen dial-strength ath-builder-twin ath-builder-superset">` +
      '<div class=eyebrow>Superset · builder</div>' +
      builderLiftPanelHtml(exA, { bi: bi, ei: eiA, letter: 'A', suggestHtml: opts.suggestHtmlA || '' }) +
      builderLiftPanelHtml(exB, { bi: bi, ei: eiB, letter: 'B', suggestHtml: opts.suggestHtmlB || '' }) +
      '</div>'
    );
  }

  /** Athlete strength builder — full logger card per lift (no rest timer). */
  function builderAthleteTwinHtml(ex, opts) {
    opts = opts || {};
    const bi = Number(opts.bi) || 0;
    const ei = Number(opts.ei) || 0;
    const restSec = Math.max(0, Number(ex && ex.restSec) || 120);
    const name = escTwin(ex && ex.name ? ex.name : '');
    const suggestHtml = opts.suggestHtml || '';
    return (
      `<div class="logger-screen dial-strength ath-builder-twin">` +
      '<div class=eyebrow>Hybrid Strength · builder</div>' +
      `<input id="athLiftName_${bi}_${ei}" class="ath-builder-ex-name" type="text" value="${name}" autocomplete="off" placeholder="Exercise name" aria-label="Exercise name" oninput="setAthleteLiftName(${bi},${ei},this.value)" onfocus="refreshAthleteLiftSuggest(${bi},${ei},this.value)">` +
      `<div id="athSuggest_${bi}_${ei}" class="ath-suggest-host">${suggestHtml}</div>` +
      '<div class=hero>' +
      '<div class=hero-label>Load & effort · session start fills numbers</div>' +
      builderLiftMetricsHtml(ex, bi, ei) +
      builderSideModeHtml(ex, bi, ei) +
      `<div class=rest-row><label for="athRest_${bi}_${ei}">Rest (seconds)</label>` +
      `<input id="athRest_${bi}_${ei}" type="number" min="0" step="5" value="${restSec}" aria-label="Rest seconds" oninput="setAthleteLiftRest(${bi},${ei},this.value,this)"></div></div>` +
      builderTargetEffortHtml(ex, bi, ei) +
      '</div>'
    );
  }

  function builderLoggerTwinHtml() {
    const effort = effortColumn();
    const meta = effort ? kindMeta(effort.kind) : kindMeta('reps');
    const rir = sheet.targetRir != null ? sheet.targetRir : 2;
    const loadDisplay = hasPinnedLoad()
      ? String((loadColumn().values || [])[0] || '').trim()
      : '—';
    const effortVal = String((effort && effort.values || [])[0] ?? (effort && effort.value) ?? '').trim() || '—';
    const restLabel = fmtRest(sheet.restSec);
    return `<div class="logger-screen dial-strength" id="builderLoggerCard" style="min-height:0;margin-top:14px;padding:16px;border:1px solid var(--line);border-radius:20px;background:var(--panel)">
      <div class=eyebrow>Athlete logger preview</div>
      <div class=task>This lift</div>
      <div class=progressline>One set at a time · Rest ${restLabel} after Next</div>
      <div class=setchip>Set <b>1</b> / ${sheet.sets || 3}</div>
      <div class="hero">
        <div class=hero-label>Tap to edit</div>
        <div class=hero-metrics>
          <div><div class=metric-val>${escTwin(loadDisplay)}</div><span class=metric-unit>kg</span></div>
          <div class=metric-sep>×</div>
          <div><div class=metric-val>${escTwin(effortVal)}</div><span class=metric-unit>${escTwin(meta.loggerLabel.toLowerCase())}</span></div>
        </div>
        <div class=hero-target>Target: <b>RIR ${rir}</b> · next set adjusts from slider</div>
      </div>
      <div class="slider-card">
        <div class=sliderhead><b>How hard was that set?</b><span class=slidervalue>Medium · RIR ~${rir}</span></div>
        <input type="range" disabled min="0" max="5" step="1" value="2" aria-label="Difficulty slider preview">
        <div class=sliderlabels>
          <span>Very easy</span><span>Easy</span><span>Medium</span><span>Hard</span><span>Max</span><span>Didn't finish</span>
        </div>
      </div>
      <div class=next-wrap>
        <button type="button" class="btn primary" disabled>Next set</button>
        <button type="button" class="btn ghost" disabled>+ Extra set</button>
      </div>
    </div>`;
  }

  function builderAthleteColumnsHtml() {
    ensureAthleteColumnCount();
    const cols = sheet.columns.slice(0, 2);
    const heads = cols
      .map((c, i) => {
        return `<div class="builder-colhead"><label>Column ${i + 1}</label><select class="logcol-kind" aria-label="Column ${i + 1}" onchange="LogColumns.onKindChange(${i}, this.value)">${optionsHtml(c.kind)}</select></div>`;
      })
      .join('');
    return `<div class="ath-builder-cols" id="builderAthleteCols"><div class="builder-colhead-row cols-2">${heads}</div></div>`;
  }

  function refreshAthleteColumns() {
    const el = global.document && global.document.getElementById('builderAthleteCols');
    if (!el) return;
    const wrap = global.document.createElement('div');
    wrap.innerHTML = builderAthleteColumnsHtml();
    el.replaceWith(wrap.firstChild);
  }

  function refreshBuilderUi() {
    if (sheet.athleteMode) refreshAthleteColumns();
    else refreshPrescription();
  }

  function builderPrescriptionHtml(opts = {}) {
    const compact = !!opts.compact;
    const grid = builderPrescriptionGridHtml({ compact });
    return compact ? grid : `${grid}${builderLoggerTwinHtml()}`;
  }

  function builderColumnsHtml() {
    return builderPrescriptionHtml();
  }

  function refreshPrescription() {
    const presc = global.document && global.document.getElementById('builderPrescriptionCard');
    if (presc) {
      const compact = presc.classList.contains('compact');
      const wrap = global.document.createElement('div');
      wrap.innerHTML = builderPrescriptionGridHtml({ compact });
      presc.replaceWith(wrap.firstChild);
      if (!compact) refreshTwin();
    }
  }

  function refreshTwin() {
    const card = global.document && global.document.getElementById('builderLoggerCard');
    if (!card) return;
    const wrap = global.document.createElement('div');
    wrap.innerHTML = builderLoggerTwinHtml();
    card.replaceWith(wrap.firstChild);
  }

  function loggerCellsHtml(row, rowIndex, columns, isLast) {
    const cols = columns && columns.length ? columns : defaultColumns({});
    const cells = cols
      .map((c) => {
        const meta = kindMeta(c.kind);
        const field = meta.field;
        const val = row[field] == null ? '' : row[field];
        return `<div><span class="mini">${meta.loggerLabel}</span><input type="number" value="${val}" onchange="updateSet(${rowIndex},'${field}',this.value)"></div>`;
      })
      .join('');
    const rirLabel = isLast ? 'RIR · counts' : 'RIR';
    const rir = `<div><span class="mini">${rirLabel}</span><input type="number" min="0" max="10" value="${row.rir || ''}" onchange="updateSet(${rowIndex},'rir',this.value)" aria-label="${isLast ? 'RIR on last set for progression' : 'RIR set ' + row.n}"></div>`;
    return cells + rir;
  }

  function rowFieldForKind(kind) {
    if (isLoadKind(kind)) return 'weight';
    if (kind === 'distance_m') return 'distance';
    return 'reps';
  }

  function rowMetricValue(row, kind) {
    const field = rowFieldForKind(kind);
    const val = row && row[field];
    return val == null ? '' : String(val);
  }

  function supersetMetricFieldHtml(ex, row, opts) {
    opts = opts || {};
    const layout = columnLayout(ex || {});
    return layout.cols
      .map((col) => {
        const meta = kindMeta(col.kind);
        const field = rowFieldForKind(col.kind);
        const val = rowMetricValue(row, col.kind);
        const onchange =
          opts.mode === 'edit'
            ? `editSupersetValue(${opts.ei},${opts.ri},'${field}',this.value)`
            : opts.mode === 'completed'
              ? `editCompletedRow('${opts.sessionId}','${opts.taskId}','${opts.exId}','${opts.rowId}','${field}',this.value)`
              : `setSupersetValue('${field}',this.value)`;
        if (opts.legacyCard) {
          return (
            `<div class=field><label>${escTwin(meta.label)}</label>` +
            `<input type="number" value="${escTwin(val)}" onchange="${onchange}" aria-label="${escTwin(meta.label)}"></div>`
          );
        }
        return (
          `<div><span class=mini>${escTwin(meta.label)}</span>` +
          `<input type="number" value="${escTwin(val)}" onchange="${onchange}" aria-label="${escTwin(meta.label)}"></div>`
        );
      })
      .join('');
  }

  function supersetEditRowHtml(ex, row, ei, ri) {
    const target =
      typeof global.targetLabel === 'function'
        ? global.targetLabel(row)
        : row.target == null
          ? ''
          : String(row.target);
    const esc =
      typeof global.esc === 'function'
        ? global.esc
        : (s) =>
            String(s ?? '').replace(/[&<>"']/g, (m) =>
              ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m],
            );
    return (
      `<div class=setrow><div class=setnum>${row.n}<span class=target>${esc(target)}</span></div>` +
      supersetMetricFieldHtml(ex, row, { mode: 'edit', ei: ei, ri: ri }) +
      `<div><span class=mini>RIR</span><input type="number" min="0" max="10" value="${esc(
        row.rir || '',
      )}" onchange="editSupersetValue(${ei},${ri},'rir',this.value)"></div>` +
      `<button class="btn small ${row.done ? '' : 'primary'}" onclick="toggleSupersetDone(${ei},${ri})">${
        row.done ? 'Logged' : 'Log'
      }</button></div>`
    );
  }

  function supersetEditSheetHtml(task) {
    const esc =
      typeof global.esc === 'function'
        ? global.esc
        : (s) =>
            String(s ?? '').replace(/[&<>"']/g, (m) =>
              ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m],
            );
    const exercises = (task && task.exercises) || [];
    return (
      '<h2>Edit superset sets</h2><div class=stack>' +
      exercises
        .map(
          (ex, ei) =>
            `<div class=card><div class=title>${esc(ex.name || 'Exercise')}</div>${(ex.rows || [])
              .map((r, ri) => supersetEditRowHtml(ex, r, ei, ri))
              .join('')}</div>`,
        )
        .join('') +
      '</div><button class="btn primary block" style="margin-top:12px" onclick="closeSheet();train()">Done</button>'
    );
  }

  function completedRowsHtml(sessionId, task, ex) {
    const esc =
      typeof global.esc === 'function'
        ? global.esc
        : (s) =>
            String(s ?? '').replace(/[&<>"']/g, (m) =>
              ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m],
            );
    const owner = ex || task || {};
    const rows = ex ? ex.rows : task ? task.rows : [];
    const exId = ex ? ex.id : '';
    const taskId = task ? task.id : '';
    return (
      `<div class=editgrid>${(rows || [])
        .map((r) => {
          const target =
            typeof global.targetLabel === 'function'
              ? global.targetLabel(r)
              : r.target == null
                ? ''
                : String(r.target);
          const e1rm =
            typeof global.rowE1rmHint === 'function' ? global.rowE1rmHint(r) : '';
          return (
            `<div class=editrow><div class=setnum>${r.extra ? 'EX' : r.n}<span class=target>${esc(
              target,
            )}</span></div>` +
            supersetMetricFieldHtml(owner, r, {
              mode: 'completed',
              sessionId: sessionId,
              taskId: taskId,
              exId: exId,
              rowId: r.id,
            }) +
            `<div><span class=mini>RIR</span><input type="number" min="0" max="10" value="${esc(
              r.rir || '',
            )}" onchange="editCompletedRow('${sessionId}','${taskId}','${exId}','${r.id}','rir',this.value)"></div>` +
            `<button class="btn small ${r.extra ? 'danger' : ''}" onclick="${
              r.extra
                ? `deleteCompletedRow('${sessionId}','${taskId}','${exId}','${r.id}')`
                : `toggleCompletedDone('${sessionId}','${taskId}','${exId}','${r.id}')`
            }">${r.extra ? '×' : r.done ? 'Logged' : 'Log'}</button>${e1rm}</div>`
          );
        })
        .join('')}</div>` +
      `<button class="btn small" style="margin-top:8px" onclick="addCompletedRow('${sessionId}','${taskId}','${exId}')">Add extra set</button>`
    );
  }

  function validateAthleteRow(ex, row) {
    const layout = columnLayout(ex || {});
    for (const col of layout.cols) {
      const meta = kindMeta(col.kind);
      const field = rowFieldForKind(col.kind);
      const raw = row[field];
      if (field === 'weight') {
        const weight = String(raw ?? '').trim() === '' ? null : Number(raw);
        if (weight !== null && (!Number.isFinite(weight) || weight < 0 || weight > 2000)) {
          return 'Enter a weight between 0 and 2000 kg.';
        }
        continue;
      }
      const n = Number(raw);
      const label = (meta.loggerLabel || meta.label || field).toLowerCase();
      if (!Number.isFinite(n) || n <= 0 || n > 1000) {
        return `Enter ${label} between 1 and 1000.`;
      }
    }
    return '';
  }

  function applyColumnTargetKinds(ex, rows) {
    const cols = normalizeColumns(ex);
    const effort = cols.find((c) => c.kind === 'time_sec') || cols.find((c) => c.kind === 'reps' || c.kind === 'reps_range' || c.kind === 'distance_m');
    const tk = effort ? kindMeta(effort.kind).targetKind : 'reps';
    (rows || []).forEach((r) => {
      if (!r.extra) r.targetKind = tk;
    });
    return rows;
  }

  global.LogColumns = {
    KINDS,
    kindMeta,
    normalizeColumns,
    coachNormalizeColumns,
    defaultColumns,
    syncLegacyFromColumns,
    columnsMeta,
    hasPinnedLoad,
    builderColumnsHtml,
    builderAthleteColumnsHtml,
    builderPrescriptionHtml,
    builderPrescriptionGridHtml,
    builderLoggerTwinHtml,
    builderAthleteTwinHtml,
    builderSupersetTwinHtml,
    builderSideModeHtml,
    ensureAthleteLogColumns,
    savedLogColumnsStale,
    columnLayout,
    athleteColumnOptionsHtml,
    beginSheet,
    beginAthleteSheet,
    getSheetColumns,
    getSetCount,
    getRestSec,
    onRestChange,
    setTargetRir,
    onKindChange,
    onPrescriptionChange,
    onCellChange,
    onValueChange: onCellChange,
    onSimpleReps,
    onSimpleEffortKind,
    onPinLoadKind,
    onPinLoadValue,
    clearPinnedLoad,
    setAutopilotVolume,
    pinVolume,
    clearPinnedVolume,
    isAutopilotVolume,
    setChangeHandler,
    addColumn,
    removeColumn,
    addSet,
    removeSet,
    resizeSets,
    toggleOverrides,
    loggerCellsHtml,
    applyColumnTargetKinds,
    rowFieldForKind,
    supersetMetricFieldHtml,
    supersetEditRowHtml,
    supersetEditSheetHtml,
    completedRowsHtml,
    validateAthleteRow,
    fmtRest,
  };
})(typeof window !== 'undefined' ? window : globalThis);
