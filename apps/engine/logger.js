(function (root) {
  const QUOTE = 'You can’t do in a race what you haven’t prepared for.';
  const COACH = 'Hold the talk-test. Log every bout. Rest as prescribed — the clock comes next.';

  let pad = null;
  let sheet = null;
  let toast = '';
  let toastTimer = 0;
  let clockTimer = 0;
  let lastBeep = '';

  function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function session() {
    return root.S && root.S.session;
  }

  function persist(next) {
    root.S.session = next;
    root.S.loggerOpen = true;
    if (typeof root.save === 'function') root.save();
    paint();
  }

  function elapsed() {
    const s = session();
    if (!s || !s.startedAt) return '0:00';
    const sec = Math.max(0, Math.floor((Date.now() - s.startedAt) / 1000));
    const m = Math.floor(sec / 60);
    const r = sec % 60;
    return `${m}:${String(r).padStart(2, '0')}`;
  }

  function open({ date, letter, plan } = {}) {
    const HS = root.HybridSession;
    const d = date || (root.S && root.S.selectedDate);
    const p = plan || (typeof root.trainingPlanForDate === 'function' ? root.trainingPlanForDate(d) : null);
    if (!p || !HS) return;
    const existing = root.S.session && root.S.session.date === d && root.S.session.phase !== 'summary'
      ? root.S.session
      : null;
    if (letter && existing) {
      root.S.session = HS.goToLetter(HS.startSession({ date: d, plan: p, existing }), letter);
    } else if (letter) {
      root.S.session = HS.startSession({ date: d, plan: p, letter });
    } else {
      root.S.session = HS.startSession({ date: d, plan: p, existing });
    }
    root.S.loggerOpen = true;
    if (typeof root.save === 'function') root.save();
    document.getElementById('logger').classList.remove('hidden');
    document.getElementById('shell').classList.add('logger-open');
    if (typeof root.syncFab === 'function') root.syncFab();
    startClock();
    paint();
  }

  function close() {
    root.S.loggerOpen = false;
    pad = null;
    sheet = null;
    if (typeof root.save === 'function') root.save();
    const el = document.getElementById('logger');
    if (el) el.classList.add('hidden');
    const shell = document.getElementById('shell');
    if (shell) shell.classList.remove('logger-open');
    stopClock();
    if (typeof root.syncFab === 'function') root.syncFab();
    if (typeof root.render === 'function') root.render();
  }

  function timerState() {
    if (!root.S.timer) root.S.timer = HybridTimer.create();
    return root.S.timer;
  }

  function persistTimer(next) {
    if (typeof window !== 'undefined' && window.matchMedia) {
      next.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    root.S.timer = next;
    if (typeof root.save === 'function') root.save();
    paint();
  }

  let audioCtx = null;
  function beep(kind) {
    if (lastBeep === kind) return;
    lastBeep = kind;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audioCtx = audioCtx || new AC();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.connect(g);
      g.connect(audioCtx.destination);
      o.frequency.value = kind === 'go' || kind === 'done' ? 880 : 660;
      g.gain.value = 0.06;
      o.start();
      o.stop(audioCtx.currentTime + 0.08);
    } catch (_) { /* no audio */ }
  }

  function startClock() {
    stopClock();
    clockTimer = setInterval(() => {
      const clock = document.getElementById('logClock');
      if (clock) clock.textContent = elapsed();
      const t = timerState();
      const now = Date.now();
      const s = session();
      if (s && s.phase === 'block' && root.HybridEngine) {
        const page = HybridSession.currentPage(s);
        const log = page && s.logs[page.id];
        if (page && page.logMode === 'engine' && log && log.engine) {
          const next = HybridEngine.tick(log, now);
          if (next !== log) {
            persistEngine(next);
            return;
          }
          const clock = document.getElementById('engClock');
          if (clock) {
            const ends = log.engine.phase === 'work' ? log.engine.workEndsAt : log.engine.restEndsAt;
            if (ends) clock.textContent = remainLabel(ends, now);
          }
        }
      }
      const next = HybridTimer.tick(t, now);
      if (next !== t) {
        if (next.view === 'idle' && t.view !== 'idle') beep('done');
        lastBeep = '';
        persistTimer(next);
        return;
      }
      const snap = HybridTimer.snapshot(t, now);
      if (snap.countInLabel && snap.countInLabel !== lastBeep) {
        beep(snap.countInLabel === 'GO!' ? 'go' : snap.countInLabel);
      } else if (snap.roundLabel && snap.roundLabel !== lastBeep) {
        beep(snap.roundLabel);
      }
      patchLiveTimer(snap);
    }, 100);
  }

  function patchLiveTimer(snap) {
    if (snap.view !== 'countIn' && snap.view !== 'running') return;
    if (snap.display === 'docked') {
      const dock = document.getElementById('logTimerDock');
      if (!dock) return;
      const wrap = document.createElement('div');
      wrap.innerHTML = timerDockHtml();
      const node = wrap.firstElementChild;
      if (node) dock.replaceWith(node);
      return;
    }
    const full = document.getElementById('logTimerFull');
    if (!full) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = runHtml(snap);
    const node = wrap.firstElementChild;
    if (node) full.replaceWith(node);
  }

  function stopClock() {
    if (clockTimer) clearInterval(clockTimer);
    clockTimer = 0;
  }

  function dotsHtml(s) {
    return s.pages.map((p, i) => {
      const ids = HybridSession.logIdsForPage(p);
      const done = p.logMode === 'complete' || p.logMode === 'engine'
        ? !!(s.logs[p.id] && s.logs[p.id].completed)
        : p.logMode === 'doneHub' ? false
        : ids.some((id) => s.logs[id] && s.logs[id].sets && s.logs[id].sets.some((r) => r.logged));
      const cur = s.phase === 'block' && i === s.blockIndex;
      return `<span class="log-dot${cur ? ' current' : done ? ' done' : ''}"></span>`;
    }).join('');
  }

  function headerHtml(s) {
    const page = s.phase === 'block' ? HybridSession.currentPage(s) : null;
    if (page && page.logMode === 'engine') {
      return `
      <div class="log-top">
        <button type="button" class="log-back-x" onclick="Logger.chevron()" aria-label="Close">⌄</button>
        <div class="log-dots">${dotsHtml(s)}</div>
        <div class="log-clock" id="logClock">${elapsed()}</div>
      </div>
      <div class="log-totals log-totals--engine">
        <div class="eng-eyebrow">The Engine</div>
      </div>`;
    }
    const t = HybridSession.totals(s);
    return `
      <div class="log-top">
        <button type="button" class="log-back-x" onclick="Logger.chevron()" aria-label="Close">⌄</button>
        <div class="log-dots">${dotsHtml(s)}</div>
        <div class="log-clock" id="logClock">${elapsed()}</div>
      </div>
      <div class="log-totals">
        <div><b>${t.reps}</b><span>REPS</span></div>
        <div><b>${t.kg}</b><span>KG</span></div>
      </div>`;
  }

  function ringSvg(progress, inner) {
    const c = 2 * Math.PI * 46;
    const off = c * (1 - Math.max(0, Math.min(1, progress || 0)));
    return `<svg class="tm-ring" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="5"/>
      <circle cx="50" cy="50" r="46" fill="none" stroke="#16ec06" stroke-width="5"
        stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"
        transform="rotate(-90 50 50)"/>
    </svg>${inner}`;
  }

  function timerDockHtml() {
    const snap = HybridTimer.snapshot(timerState(), Date.now());
    if (snap.view === 'countIn' && snap.display === 'docked') {
      return `<div class="tm-dock-copy" id="logTimerDock">${esc(snap.countInLabel)}</div>`;
    }
    if (snap.view === 'running' && snap.display === 'docked') {
      return `<button type="button" class="tm-dock-run" id="logTimerDock" onclick="Logger.timerTapDock()">${ringSvg(snap.progress, `<span>${esc(snap.clock)}</span>`)}</button>`;
    }
    if (snap.chrome === 'select') {
      return `<button type="button" class="tm-select" onclick="Logger.timerOpen()" aria-label="Select Timer">${icoSwitch()} Select Timer</button>`;
    }
    return `<button type="button" class="log-play" onclick="Logger.timerPlay()" aria-label="Start last timer">▶</button>`;
  }

  function barHtml(s) {
    const atStart = s.blockIndex === 0;
    const atEnd = s.blockIndex === s.pages.length - 1;
    const snap = HybridTimer.snapshot(timerState(), Date.now());
    const hideSides = snap.stopSheet;
    return `
      <div class="log-bar">
        <button type="button" class="log-bar-btn" onclick="Logger.prev()" ${atStart || hideSides ? 'disabled' : ''}>← Back</button>
        ${timerDockHtml()}
        <button type="button" class="log-bar-btn" onclick="Logger.next()" ${atEnd || hideSides ? 'disabled style="opacity:.35"' : ''}>Next →</button>
      </div>`;
  }

  function switchBtn() {
    return `<button type="button" class="tm-switch" onclick="Logger.timerSwitch()">${icoSwitch()} Switch</button>`;
  }

  function modeTitle(mode) {
    if (mode === 'tabata') return 'Tabata Timer';
    if (mode === 'emom') return 'EMOM Timer';
    return (HybridTimer.PICKER.find((p) => p.id === mode) || {}).label || mode;
  }

  function pickerIcon(id) {
    const g = '#16ec06';
    const w = '#fff';
    if (id === 'rest') {
      return `<svg viewBox="0 0 72 72" class="tm-ico">${circ()}<text x="36" y="44" text-anchor="middle" fill="${g}" font-size="22" font-weight="700" font-family="Barlow Condensed,sans-serif">Zzz</text></svg>`;
    }
    if (id === 'stopwatch') {
      return `<svg viewBox="0 0 72 72" class="tm-ico">${circ()}<circle cx="36" cy="38" r="16" fill="none" stroke="${w}" stroke-width="2.5"/><path d="M36 38 L36 26" stroke="${g}" stroke-width="2.5" stroke-linecap="round"/><rect x="32" y="12" width="8" height="6" rx="1" fill="${w}"/></svg>`;
    }
    if (id === 'amrap') {
      return `<svg viewBox="0 0 72 72" class="tm-ico"><path d="M14 50 A24 24 0 1 1 58 50" fill="none" stroke="${w}" stroke-width="2.5"/><path d="M36 50 L52 28" stroke="${g}" stroke-width="2.5" stroke-linecap="round"/></svg>`;
    }
    if (id === 'forTime') {
      return `<svg viewBox="0 0 72 72" class="tm-ico">${circ()}<path d="M36 20 A16 16 0 1 1 20 36" fill="none" stroke="${g}" stroke-width="8"/><circle cx="36" cy="36" r="3" fill="${w}"/></svg>`;
    }
    if (id === 'tabata') {
      return `<svg viewBox="0 0 72 72" class="tm-ico"><text x="36" y="46" text-anchor="middle" fill="${g}" font-size="28" font-weight="700" font-family="Barlow Condensed,sans-serif">:20</text></svg>`;
    }
    if (id === 'custom') {
      return `<svg viewBox="0 0 72 72" class="tm-ico">${circ()}<path d="M36 20 A16 16 0 0 1 52 36 L36 36 Z" fill="${g}"/></svg>`;
    }
    return `<svg viewBox="0 0 72 72" class="tm-ico"><text x="36" y="46" text-anchor="middle" fill="${g}" font-size="22" font-weight="700" font-family="Barlow Condensed,sans-serif">1:00</text></svg>`;
  }

  function circ() {
    return `<circle cx="36" cy="36" r="26" fill="none" stroke="#fff" stroke-width="2.5"/>`;
  }

  function icoSwitch() {
    return `<svg viewBox="0 0 20 20" width="16" height="16"><circle cx="10" cy="11" r="6" fill="none" stroke="#1ba3ff" stroke-width="1.6"/><path d="M10 7 v4" stroke="#1ba3ff" stroke-width="1.6"/></svg>`;
  }

  function fieldBox(key, value, label) {
    return `<label class="tm-field"><span>${esc(label)}</span><input inputmode="numeric" value="${esc(value)}" onchange="Logger.timerField('${esc(key)}', this.value)"></label>`;
  }

  function pairBoxes(aKey, aVal, bKey, bVal, label) {
    return `<div class="tm-pair">
      <input inputmode="numeric" value="${esc(aVal)}" onchange="Logger.timerField('${esc(aKey)}', this.value)">
      <i>:</i>
      <input inputmode="numeric" value="${esc(bVal)}" onchange="Logger.timerField('${esc(bKey)}', this.value)">
      <span>${esc(label)}</span>
    </div>`;
  }

  function setupHtml(snap) {
    const mode = snap.mode;
    const c = snap.config || {};
    const title = modeTitle(mode);
    let body = '';
    if (mode === 'rest') {
      const m = Math.floor((c.restMs || 0) / 60000);
      const s = Math.floor(((c.restMs || 0) % 60000) / 1000);
      body = `
        <p class="tm-kicker">Quick Start</p>
        <div class="tm-quick">${[30000, 45000, 60000, 90000, 120000].map((ms) => {
          const clock = HybridTimer.formatClock(ms, false);
          return `<button type="button" onclick="Logger.timerQuick(${ms})">${clock}</button>`;
        }).join('')}</div>
        <hr class="tm-rule">
        <p class="tm-kicker">Customize</p>
        <div class="tm-custom">
          <button type="button" onclick="Logger.timerNudge(-1)">−</button>
          <div class="tm-ms"><b>${m}</b><span>m</span></div>
          <div class="tm-ms"><b>${String(s).padStart(2, '0')}</b><span>s</span></div>
          <button type="button" onclick="Logger.timerNudge(1)">+</button>
        </div>
        <button type="button" class="tm-start" onclick="Logger.timerStart()"><span>▶</span>Start</button>`;
    } else if (mode === 'stopwatch' || mode === 'forTime') {
      body = `
        <button type="button" class="tm-giant" onclick="Logger.timerStart()">▶</button>
        <div class="tm-countin-row">${fieldBox('countInSec', Math.round((c.countInMs || 0) / 1000), 'Count In')}</div>
        <div class="tm-run-btns">
          <button type="button" class="tm-reset" onclick="Logger.timerReset()">Reset</button>
          <button type="button" class="tm-pause" onclick="Logger.timerPause()">Pause</button>
        </div>`;
    } else if (mode === 'amrap') {
      body = `
        ${pairBoxes('totalMin', Math.floor((c.totalMs || 0) / 60000), 'totalSec', String(Math.floor(((c.totalMs || 0) % 60000) / 1000)).padStart(2, '0'), 'Total Time')}
        <div class="tm-countin-row">${fieldBox('countInSec', Math.round((c.countInMs || 0) / 1000), 'Count In')}</div>
        <button type="button" class="tm-start" onclick="Logger.timerStart()"><span>▶</span>Start</button>`;
    } else if (mode === 'tabata' || mode === 'custom') {
      const work = c.workMs || 0;
      const rest = c.restMs || 0;
      const blurb = mode === 'tabata'
        ? `${c.rounds} rounds of ${Math.round(work / 1000)} seconds work, ${Math.round(rest / 1000)} seconds rest`
        : `${c.rounds} rounds of: ${HybridTimer.formatClock(work, false)} work / ${HybridTimer.formatClock(rest, false)} rest`;
      body = `
        <p class="tm-blurb">${esc(blurb)}</p>
        ${fieldBox('rounds', c.rounds, 'Rounds')}
        ${mode === 'tabata'
          ? `${fieldBox('workSec', Math.round(work / 1000), 'Work')}${fieldBox('restSec', Math.round(rest / 1000), 'Rest')}`
          : `${pairBoxes('workMin', Math.floor(work / 60000), 'workSec', String(Math.floor((work % 60000) / 1000)).padStart(2, '0'), 'Work')}
             ${pairBoxes('restMin', Math.floor(rest / 60000), 'restSec', String(Math.floor((rest % 60000) / 1000)).padStart(2, '0'), 'Rest')}`}
        <div class="tm-countin-row">${fieldBox('countInSec', Math.round((c.countInMs || 0) / 1000), 'Count In')}</div>
        <button type="button" class="tm-start" onclick="Logger.timerStart()"><span>▶</span>Start</button>`;
    } else if (mode === 'emom') {
      body = `
        ${pairBoxes('everyMin', Math.floor((c.everyMs || 0) / 60000), 'everySec', String(Math.floor(((c.everyMs || 0) % 60000) / 1000)).padStart(2, '0'), 'Every')}
        ${fieldBox('rounds', c.rounds, 'Rounds')}
        <div class="tm-countin-row">${fieldBox('countInSec', Math.round((c.countInMs || 0) / 1000), 'Count In')}</div>
        <button type="button" class="tm-start" onclick="Logger.timerStart()"><span>▶</span>Start</button>`;
    }
    return `
      <div class="tm-full" id="logTimerFull">
        <div class="tm-head">
          <h2>${esc(title)}</h2>
          ${switchBtn()}
        </div>
        <div class="tm-setup">${body}</div>
      </div>`;
  }

  function pickerHtml() {
    const tiles = HybridTimer.PICKER.map((m) => `<button type="button" class="tm-tile" onclick="Logger.timerChoose('${m.id}')">${pickerIcon(m.id)}<span>${esc(m.label)}</span></button>`).join('');
    return `<div class="tm-full tm-picker" id="logTimerFull">
      <button type="button" class="tm-x" onclick="Logger.timerClosePicker()" aria-label="Close">×</button>
      <div class="tm-grid">${tiles}</div>
    </div>`;
  }

  function runHtml(snap) {
    const title = modeTitle(snap.mode);
    if (snap.view === 'countIn') {
      return `<div class="tm-full" id="logTimerFull">
        <div class="tm-head"><h2>${esc(title)}</h2>${switchBtn()}</div>
        <div class="tm-countin">${esc(snap.countInLabel)}</div>
      </div>`;
    }
    const inner = `<div class="tm-face">
      ${snap.roundFraction ? `<small>${esc(snap.roundFraction)}</small>` : ''}
      <strong>${esc(snap.clock || '')}</strong>
      ${snap.roundLabel ? `<em>${esc(snap.roundLabel)}</em>` : ''}
    </div>`;
    return `<div class="tm-full" id="logTimerFull">
      <div class="tm-head"><h2>${esc(title)}</h2>${switchBtn()}</div>
      <div class="tm-run">${ringSvg(snap.progress == null ? 1 : snap.progress, inner)}</div>
      ${snap.mode !== 'rest' ? `<div class="tm-run-btns"><button type="button" class="tm-reset" onclick="Logger.timerReset()">Reset</button>${snap.mode === 'stopwatch' || snap.mode === 'forTime' ? `<button type="button" class="tm-pause" onclick="Logger.timerPause()">Pause</button>` : ''}</div>` : ''}
    </div>`;
  }

  function timerOverlayHtml() {
    const t = timerState();
    const snap = HybridTimer.snapshot(t, Date.now());
    let extra = '';
    if (snap.view === 'picker') extra = pickerHtml();
    else if (snap.view === 'setup') extra = setupHtml(snap);
    else if ((snap.view === 'running' || snap.view === 'countIn') && snap.display === 'fullscreen') extra = runHtml(snap);
    if (snap.stopSheet) {
      extra += `<div class="tm-stop" onclick="if(event.target===this)Logger.timerCancelStop()">
        <div class="tm-stop-card">
          <button type="button" class="tm-stop-go" onclick="Logger.timerStop()">Stop Timer</button>
          <button type="button" onclick="Logger.timerCancelStop()">Cancel</button>
        </div>
      </div>`;
    }
    return extra;
  }

  function quoteHtml() {
    return `<div class="log-quote"><p>${esc(QUOTE)}</p></div>`;
  }

  function coachHtml() {
    const s = session();
    const copy = (s && s.instructions && String(s.instructions).trim()) ? s.instructions : COACH;
    return `
      <div class="log-coach">
        <h1>Coach Instructions</h1>
        <p>${esc(copy).replace(/\n/g, '<br>')}</p>
        <button type="button" class="log-primary" onclick="Logger.gotCoach()">Got It</button>
      </div>`;
  }

  function remainLabel(endsAt, now) {
    const sec = Math.max(0, Math.ceil(((endsAt || now) - now) / 1000));
    const m = Math.floor(sec / 60);
    const r = sec % 60;
    return `${m}:${String(r).padStart(2, '0')}`;
  }

  function persistEngine(nextLog) {
    const s = JSON.parse(JSON.stringify(session()));
    const page = HybridSession.currentPage(s);
    s.logs[page.id] = nextLog;
    if (nextLog.engine && nextLog.engine.phase === 'done' && root.HybridEngine) {
      const closed = HybridEngine.closePiece(nextLog, root.HybridAdaptive);
      s.engineAnchors = s.engineAnchors || {};
      if (page.machine) s.engineAnchors[page.machine] = closed;
      root.S.engineAnchors = { ...(root.S.engineAnchors || {}), ...(s.engineAnchors || {}) };
    }
    persist(s);
  }

  function engineHtml(s, page, log) {
    const e = log.engine;
    if (!e || !root.HybridEngine) return `<p class="log-kicker">Engine bundle missing</p>`;
    const now = Date.now();
    const target = HybridEngine.formatTarget(e.target, e.modality) || (e.skipped ? 'No invented pace' : 'Type the first number');
    const shown = Math.min(e.rounds, e.phase === 'ready' || e.phase === 'rest' ? e.roundIndex + 1 : e.roundIndex + 1);
    const kicker = `${page.letter}. The Engine · ${(e.structure || 'intervals').toUpperCase()}`;
    let stage = '';
    if (e.phase === 'ready') {
      stage = `
        <p class="eng-target" id="engTarget">${esc(target)}</p>
        ${e.skipped ? '' : `<label class="eng-first">First number
          <input inputmode="decimal" value="${esc(e.modality === 'split' ? (e.target.splitSec || '') : e.modality === 'rpm' ? (e.target.rpm || '') : (e.target.watts || ''))}" onchange="Logger.engineTyped(this.value)">
        </label>`}
        <button type="button" class="log-primary eng-go" onclick="Logger.engineStart()">Start work</button>`;
    } else if (e.phase === 'work') {
      stage = `
        <p class="eng-phase">Work ${shown}/${e.rounds}</p>
        <p class="eng-clock" id="engClock">${esc(remainLabel(e.workEndsAt, now))}</p>
        <p class="eng-target">${esc(target)}</p>
        <button type="button" class="eng-early" onclick="Logger.engineEnd()">End interval early</button>`;
    } else if (e.phase === 'rest') {
      const nextTarget = HybridEngine.formatTarget(e.target, e.modality) || target;
      const restClock = e.restEndsAt != null ? `<p class="eng-clock" id="engClock">${esc(remainLabel(e.restEndsAt, now))}</p>` : '';
      const effortBlock = e.needsEffort ? `
        <p class="log-emh-label">How was that interval?</p>
        <div class="log-intensity">
          <button type="button" onclick="Logger.engineEffort('easy')">Easy</button>
          <button type="button" onclick="Logger.engineEffort('medium')">Medium</button>
          <button type="button" onclick="Logger.engineEffort('hard')">Hard</button>
        </div>` : '';
      const skipBtn = e.needsEffort ? '' : `<button type="button" class="log-primary" onclick="Logger.engineSkipRest()">Skip · start work</button>`;
      const upNextBlock = e.needsEffort ? '' : `<p class="eng-target">Up next · ${esc(nextTarget)}</p>`;
      stage = `
        <p class="eng-phase">Rest</p>
        ${restClock}
        <p class="eng-up">Last interval · ${esc(target)}</p>
        ${effortBlock}
        ${upNextBlock}
        ${skipBtn}`;
    } else {
      stage = `
        <p class="eng-phase">Piece done</p>
        <p class="eng-target">${esc(target)}</p>
        <button type="button" class="log-complete is-done" onclick="Logger.next()">Next</button>`;
    }
    return `
      <p class="log-kicker">${esc(kicker)}</p>
      <h2 class="log-title">${esc(page.title)}</h2>
      <p class="log-rx">${esc(page.prescription || '')}</p>
      <div class="eng-stage">${stage}</div>`;
  }

  function completeHtml(s, page, log) {
    const items = (page.items || []).map((it) => `
      <li><strong>${it.n}.</strong> ${esc(it.text)}
        ${it.note ? `<p class="log-note"><em>*${esc(it.note)}</em></p>` : ''}
      </li>`).join('');
    const bullets = (page.bullets || []).map((b) => `<li>${esc(b)}</li>`).join('');
    return `
      <p class="log-kicker">${esc(page.letter)}. ${esc(page.section)}</p>
      <h2 class="log-title">${esc(page.title)}</h2>
      ${items ? `<ol class="log-list">${items}</ol>` : ''}
      ${bullets ? `<ul class="log-bullets">${bullets}</ul>` : ''}
      ${page.note ? `<p class="log-note"><em>*${esc(page.note)}</em></p>` : ''}
      ${page.goal ? `<p>${esc(page.goal)}</p>` : ''}
      <button type="button" class="log-complete${log.completed ? ' is-done' : ''}" onclick="Logger.complete()">
        ${log.completed ? 'Completed' : 'Mark As Completed'}
      </button>
      <input class="log-ex-note" placeholder="Add circuit note" value="${esc(log.note || '')}" onchange="Logger.note('${esc(page.id)}',this.value)">`;
  }

  function sideHtml(s, page) {
    const wm = (s.workingMax && s.workingMax[page.id]) || '';
    return `
      <div class="log-meta-row">
        <div class="log-thumb">▶</div>
        <div class="log-side">
          <div class="log-side-row"><span>WORKING MAX</span><button type="button" class="log-add" onclick="Logger.sheet('wm')">${wm ? esc(wm) + ' >' : 'Add >'}</button></div>
          <div class="log-side-row"><span>LAST</span><span>${wm ? esc(wm) : 'None'}</span></div>
        </div>
      </div>`;
  }

  function colField(key) {
    if (key === 'reps' || key === 'reps_range') return 'reps';
    if (key === 'weight_kg' || key === 'weight_lb' || key === 'weight_pct' || key === 'lwp') return 'kg';
    return key;
  }

  function columnsFor(page) {
    if (page.columns && page.columns.length) return page.columns;
    if (page.logMode === 'kg') return ['reps', 'weight_kg'];
    return ['reps'];
  }

  function cellVal(row, field) {
    if (field === 'reps') return row.reps == null ? 'MAX' : row.reps;
    if (field === 'kg') return row.kg == null || row.kg === '' ? '' : row.kg;
    const v = row.cells && row.cells[field];
    return v == null ? '' : v;
  }

  function tableHtml(s, page, log) {
    const cols = columnsFor(page);
    const mid = esc(page.id);
    const heads = cols.map((k) => `<th>${esc((root.HybridLibrary && HybridLibrary.trackLabel(k)) || k)}</th>`).join('');
    const rows = (log.sets || []).map((row, i) => {
      const tds = cols.map((k) => {
        const field = colField(k);
        const focus = pad && pad.memberId === page.id && pad.setIndex === i && pad.field === field;
        const val = cellVal(row, field);
        const ph = field === 'reps' && row.reps == null;
        return `<td><button type="button" class="log-cell${focus ? ' focus' : ''}${ph ? ' ph' : ''}" onclick="Logger.focusPad('${mid}',${i},'${esc(field)}')">${esc(val)}</button></td>`;
      }).join('');
      return `<tr>
        <td>${i + 1}</td>
        ${tds}
        <td><button type="button" class="log-check${row.logged ? ' on' : ''}" onclick="Logger.check('${mid}',${i})">${row.logged ? '✓' : ''}</button></td>
      </tr>`;
    }).join('');
    return `
      <p class="log-rx">${esc(page.prescription)}</p>
      ${page.notes && page.notes.length ? `<ul class="log-notes">${page.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
      <table class="log-table">
        <thead><tr><th>Sets</th>${heads}<th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="log-set-ctrl">
        <button type="button" onclick="Logger.nudgeSets('${mid}',-1)">−</button>
        <span>Set</span>
        <button type="button" onclick="Logger.nudgeSets('${mid}',1)">+</button>
      </div>
      <input class="log-ex-note" placeholder="Add exercise note" value="${esc(log.note || '')}" onchange="Logger.note('${mid}',this.value)">`;
  }

  function hubHtml() {
    return `
      <div class="log-hub">
        <img src="assets/hpp-logo.jpg" alt="Hybrid Power Project">
        <button type="button" class="log-primary" onclick="Logger.doneTraining()">Done Training</button>
        <p class="log-or">OR</p>
        <p>Want to add more?</p>
        <button type="button" class="log-link" onclick="Logger.addExercise()">Add Exercise</button>
      </div>`;
  }

  function feelHtml(s) {
    const f = s.feel || {};
    const n = f.durationMin || 1;
    return `
      <div class="log-feel">
        <h1>How did this session feel?</h1>
        <div class="log-intensity">
          ${[1, 2, 3, 4, 5].map((i) => `<button type="button" class="${f.intensity === i ? 'on' : ''}" onclick="Logger.feelIntensity(${i})">${i}</button>`).join('')}
        </div>
        <div class="eyebrow">Training Duration</div>
        <div class="log-dur">
          <button type="button" onclick="Logger.feelMins(-1)">−</button>
          <strong>${n} min</strong>
          <button type="button" onclick="Logger.feelMins(1)">+</button>
        </div>
        <input class="log-ex-note" placeholder="Session reflection" value="${esc(f.note || '')}" onchange="Logger.feelNote(this.value)">
        <button type="button" class="log-primary" onclick="Logger.finish()">Finish Session</button>
      </div>`;
  }

  function summaryHtml(s) {
    const st = HybridSession.summaryStats(s);
    return `
      <div class="log-sum">
        <p class="log-kicker">${esc(s.date)}</p>
        <h2 class="log-title">Heavy Lower</h2>
        <div class="log-stat"><span>Exercises</span><b>${st.exercises}</b></div>
        <div class="log-stat"><span>Sets</span><b>${st.sets}</b></div>
        <div class="log-stat"><span>Reps</span><b>${st.reps}</b></div>
        <div class="log-stat"><span>Blocks</span><b>${st.blocksDone}/${st.blocksTotal}</b></div>
        <div class="log-stat"><span>Minutes</span><b>${st.minutes}</b></div>
        <button type="button" class="log-primary" onclick="Logger.close()">Close</button>
      </div>`;
  }

  function padHtml() {
    if (!pad) return '';
    const unit = (session().unit || 'kg') === 'lb' ? 'lb' : 'kg';
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];
    const keyBtns = keys.map((k) => `<button type="button" onclick="Logger.padKey('${k}')">${k}</button>`).join('');
    return `
      <div class="log-pad">
        <div class="log-pad-head">
          <div>
            <span class="log-pad-val">${esc(pad.buffer || '0')}</span>
            ${pad.field === 'kg' ? `<span class="log-unit">
              <button type="button" class="${unit === 'kg' ? 'on' : ''}" onclick="Logger.unit('kg')">Kg</button>
              <button type="button" class="${unit === 'lb' ? 'on' : ''}" onclick="Logger.unit('lb')">Lb</button>
            </span>` : `<span style="margin-left:8px;opacity:.6">${esc((root.HybridLibrary && HybridLibrary.trackLabel(pad.field)) || pad.field).toUpperCase()}</span>`}
          </div>
          <button type="button" onclick="Logger.closePad()">⌄</button>
        </div>
        <div class="log-keys">
          ${keyBtns}
          <div class="log-pad-side" style="grid-column:4;grid-row:1 / span 4">
            <button type="button" class="blue" onclick="Logger.padLog()">Log</button>
            <button type="button" class="blue" onclick="Logger.padAutofill()">Autofill</button>
            <button type="button" class="log-miss${pad.miss ? ' on' : ''}" onclick="Logger.padMiss()">Miss</button>
          </div>
        </div>
      </div>`;
  }

  function sheetHtml(s) {
    if (!sheet) return '';
    if (sheet === 'goal') {
      return `
        <div class="log-sheet" onclick="if(event.target===this)Logger.sheet(null)">
          <div class="log-sheet-card">
            <h2>Set a new goal</h2>
            <p>Track a target for this lift. Hybrid keeps this on the phone for now.</p>
            <button type="button" class="log-primary" onclick="Logger.sheet(null)">Got it</button>
          </div>
        </div>`;
    }
    const page = HybridSession.currentPage(s);
    const cur = (s.workingMax && s.workingMax[page.id]) || '';
    return `
      <div class="log-sheet" onclick="if(event.target===this)Logger.sheet(null)">
        <div class="log-sheet-card">
          <h2>Working max</h2>
          <input id="wmInput" type="number" inputmode="decimal" value="${esc(cur)}" placeholder="kg">
          <button type="button" class="log-primary" onclick="Logger.saveWm()">Save</button>
        </div>
      </div>`;
  }

  function blockHtml(s) {
    const page = HybridSession.currentPage(s);
    const log = s.logs[page.id] || { completed: false, sets: [], note: '' };
    let body = '';
    if (page.logMode === 'complete') body = completeHtml(s, page, log);
    else if (page.logMode === 'engine') body = engineHtml(s, page, log);
    else if (page.logMode === 'doneHub') body = hubHtml();
    else if (page.logMode === 'superset') {
      const members = (page.members || []).map((m) => `
        <section class="log-ss-member">
          <h2 class="log-title">${esc(m.letter)}. ${esc(m.title)}</h2>
          ${m.logMode === 'kg' ? sideHtml(s, m) : ''}
          ${tableHtml(s, m, s.logs[m.id] || { sets: [], note: '' })}
        </section>`).join('');
      body = `
        <p class="log-kicker">${esc(page.letter)}. ${esc(page.section)}</p>
        <div class="log-ss">${members}</div>`;
    } else {
      body = `
        <p class="log-kicker">${esc(page.letter)}. ${esc(page.section)}</p>
        <h2 class="log-title">${esc(page.title)}</h2>
        ${page.logMode === 'kg' ? sideHtml(s, page) : ''}
        ${tableHtml(s, page, log)}`;
    }
    return `${headerHtml(s)}<div class="log-body">${body}</div>${barHtml(s)}${padHtml()}${sheetHtml(s)}${timerOverlayHtml()}`;
  }

  function paint() {
    const el = document.getElementById('logger');
    if (!el) return;
    const s = session();
    if (!s || !root.S.loggerOpen) {
      el.classList.add('hidden');
      return;
    }
    el.classList.remove('hidden');
    document.getElementById('shell').classList.add('logger-open');
    let inner = '';
    if (s.phase === 'quote') inner = quoteHtml();
    else if (s.phase === 'coach') inner = coachHtml();
    else if (s.phase === 'feel') inner = feelHtml(s);
    else if (s.phase === 'summary') inner = summaryHtml(s);
    else inner = blockHtml(s);
    el.innerHTML = `<div class="log-screen">${toast ? `<div class="log-toast">${esc(toast)}</div>` : ''}${inner}</div>`;
    startClock();
    if (s.phase === 'quote') {
      el.querySelector('.log-quote')?.addEventListener('click', () => Logger.gotQuote());
      if (!Logger._quoteTimer) {
        Logger._quoteTimer = setTimeout(() => {
          Logger._quoteTimer = 0;
          const cur = session();
          if (cur && cur.phase === 'quote') persist(HybridSession.ackQuote(cur));
        }, 1600);
      }
    }
  }

  const Logger = {
    open,
    close,
    paint,
    gotQuote() {
      if (Logger._quoteTimer) { clearTimeout(Logger._quoteTimer); Logger._quoteTimer = 0; }
      persist(HybridSession.ackQuote(session()));
    },
    gotCoach() { persist(HybridSession.ackCoach(session())); },
    next() { pad = null; persist(HybridSession.nextPage(session())); },
    prev() { pad = null; persist(HybridSession.prevPage(session())); },
    complete() { persist(HybridSession.completeCurrent(session())); },
    engineStart() {
      const s = session();
      const page = HybridSession.currentPage(s);
      persistEngine(HybridEngine.startWork(s.logs[page.id], Date.now()));
    },
    engineEnd() {
      const s = session();
      const page = HybridSession.currentPage(s);
      persistEngine(HybridEngine.endWork(s.logs[page.id], Date.now(), true));
    },
    engineEffort(effort) {
      const s = session();
      const page = HybridSession.currentPage(s);
      const log = s.logs[page.id];
      if (!log.engine || !log.engine.needsEffort) return;
      persistEngine(HybridEngine.recordEffort(log, effort, root.HybridAdaptive, Date.now()));
    },
    engineSkipRest() {
      const s = session();
      const page = HybridSession.currentPage(s);
      persistEngine(HybridEngine.skipRestAndStart(s.logs[page.id], Date.now()));
    },
    engineTyped(raw) {
      const n = Number(raw);
      const s = JSON.parse(JSON.stringify(session()));
      const page = HybridSession.currentPage(s);
      const e = s.logs[page.id].engine;
      if (!Number.isFinite(n) || n <= 0) return;
      if (e.modality === 'split') e.target.splitSec = n;
      else if (e.modality === 'rpm') e.target.rpm = n;
      else e.target.watts = n;
      e.skipped = false;
      persist(s);
    },
    note(memberId, v) {
      const s = JSON.parse(JSON.stringify(session()));
      const page = HybridSession.currentPage(s);
      const id = page.logMode === 'superset' ? memberId : page.id;
      s.logs[id].note = v;
      persist(s);
    },
    focusPad(memberId, setIndex, field) {
      const s = session();
      const page = HybridSession.currentPage(s);
      const lift = page.logMode === 'superset' ? HybridSession.memberOf(page, memberId) : page;
      const row = s.logs[lift.id].sets[setIndex];
      const seed = field === 'kg' ? row.kg : field === 'reps' ? row.reps : (row.cells && row.cells[field]);
      pad = { memberId: lift.id, setIndex, field, buffer: seed == null ? '' : String(seed), miss: !!row.miss };
      paint();
    },
    closePad() { pad = null; paint(); },
    padKey(k) {
      if (!pad) return;
      if (k === '⌫') pad.buffer = String(pad.buffer || '').slice(0, -1);
      else pad.buffer = `${pad.buffer || ''}${k}`.replace(/^0+(\d)/, '$1');
      paint();
    },
    padMiss() { if (pad) { pad.miss = !pad.miss; paint(); } },
    padLog() {
      if (!pad) return;
      const n = Number(pad.buffer);
      const patch = { miss: pad.miss };
      if (pad.field === 'kg') patch.kg = n;
      else if (pad.field === 'reps') patch.reps = n;
      else patch.cells = { [pad.field]: n };
      let s = HybridSession.logSet(session(), pad.setIndex, patch, pad.memberId);
      if (pad.field === 'kg' && n > 0) {
        const page = HybridSession.currentPage(s);
        const lift = page.logMode === 'superset' ? HybridSession.memberOf(page, pad.memberId) : page;
        const prev = Math.max(0, ...s.logs[lift.id].sets.filter((r, i) => i !== pad.setIndex && r.logged).map((r) => r.kg || 0));
        if (n >= prev && lift.targetReps) {
          toast = `New ${lift.targetReps} Rep Max!`;
          clearTimeout(toastTimer);
          toastTimer = setTimeout(() => { toast = ''; paint(); }, 2200);
        }
      }
      pad = null;
      persist(s);
    },
    padAutofill() {
      if (!pad) return;
      const idx = pad.setIndex;
      const n = Number(pad.buffer);
      const patch = { miss: pad.miss };
      if (pad.field === 'kg') patch.kg = n;
      else if (pad.field === 'reps') patch.reps = n;
      else patch.cells = { [pad.field]: n };
      let s = HybridSession.logSet(session(), idx, patch, pad.memberId);
      s = HybridSession.autofillFrom(s, idx, pad.memberId);
      pad = null;
      persist(s);
    },
    check(memberId, i) {
      const s = session();
      const page = HybridSession.currentPage(s);
      const lift = page.logMode === 'superset' ? HybridSession.memberOf(page, memberId) : page;
      const row = s.logs[lift.id].sets[i];
      if (!row.logged) persist(HybridSession.logSet(s, i, {}, lift.id));
      else persist(HybridSession.toggleLogged(s, i, lift.id));
    },
    unit(u) {
      const s = JSON.parse(JSON.stringify(session()));
      s.unit = u;
      persist(s);
    },
    nudgeSets(memberId, dir) {
      const s = JSON.parse(JSON.stringify(session()));
      const page = HybridSession.currentPage(s);
      const lift = page.logMode === 'superset' ? HybridSession.memberOf(page, memberId) : page;
      const log = s.logs[lift.id];
      if (dir > 0) {
        log.sets.push({
          reps: lift.logMode === 'max' ? null : lift.targetReps,
          kg: null,
          cells: {},
          logged: false,
          miss: false,
        });
      } else if (log.sets.length > 1) log.sets.pop();
      persist(s);
    },
    sheet(kind) { sheet = kind; paint(); },
    saveWm() {
      const input = document.getElementById('wmInput');
      const page = HybridSession.currentPage(session());
      persist(HybridSession.setWorkingMax(session(), page.id, input && input.value));
      sheet = null;
      paint();
    },
    doneTraining() { pad = null; persist(HybridSession.openSummary(session())); },
    addExercise() {
      close();
      if (typeof root.openLibraryForDay === 'function') root.openLibraryForDay();
    },
    feelIntensity(n) { persist(HybridSession.setFeel(session(), { intensity: n })); },
    feelMins(d) {
      const cur = (session().feel && session().feel.durationMin) || 1;
      persist(HybridSession.setFeel(session(), { durationMin: Math.max(1, cur + d) }));
    },
    feelNote(v) { persist(HybridSession.setFeel(session(), { note: v })); },
    finish() { persist(HybridSession.finishToSummary(session())); },
    chevron() {
      const t = timerState();
      const snap = HybridTimer.snapshot(t, Date.now());
      if ((snap.view === 'running' || snap.view === 'countIn') && snap.display === 'fullscreen') persistTimer(HybridTimer.collapse(t));
      else if (snap.view === 'picker') persistTimer(HybridTimer.closePicker(t));
      else if (snap.view === 'setup') persistTimer(HybridTimer.stop(t));
      else close();
    },
    timerOpen() { persistTimer(HybridTimer.openPicker(timerState())); },
    timerPlay() { persistTimer(HybridTimer.play(timerState(), Date.now())); },
    timerChoose(id) { persistTimer(HybridTimer.choose(timerState(), id)); },
    timerClosePicker() { persistTimer(HybridTimer.closePicker(timerState())); },
    timerSwitch() { persistTimer(HybridTimer.openPicker(HybridTimer.stop(timerState()))); },
    timerQuick(ms) { persistTimer(HybridTimer.quickStart(timerState(), ms)); },
    timerNudge(dir) { persistTimer(HybridTimer.nudgeRest(timerState(), dir)); },
    timerStart() { persistTimer(HybridTimer.start(timerState(), Date.now())); },
    timerReset() { persistTimer(HybridTimer.reset(timerState(), Date.now())); },
    timerPause() { persistTimer(HybridTimer.togglePause(timerState(), Date.now())); },
    timerTapDock() { persistTimer(HybridTimer.openStopSheet(timerState())); },
    timerStop() { persistTimer(HybridTimer.stop(timerState())); },
    timerCancelStop() { persistTimer(HybridTimer.cancelStopSheet(timerState())); },
    timerField(key, raw) {
      const n = Number(raw);
      if (!Number.isFinite(n)) return;
      const t = timerState();
      const c = { ...(t.config || {}) };
      if (key === 'countInSec') c.countInMs = Math.max(0, n) * 1000;
      if (key === 'rounds') c.rounds = Math.max(1, n);
      if (key === 'workMin') c.workMs = Math.max(0, n) * 60000 + ((c.workMs || 0) % 60000);
      if (key === 'restMin') c.restMs = Math.max(0, n) * 60000 + ((c.restMs || 0) % 60000);
      if (key === 'workSec') {
        c.workMs = t.mode === 'tabata' ? Math.max(1, n) * 1000
          : Math.floor((c.workMs || 0) / 60000) * 60000 + Math.max(0, n) * 1000;
      }
      if (key === 'restSec') {
        c.restMs = t.mode === 'tabata' ? Math.max(0, n) * 1000
          : Math.floor((c.restMs || 0) / 60000) * 60000 + Math.max(0, n) * 1000;
      }
      if (key === 'totalMin') c.totalMs = n * 60000 + ((c.totalMs || 0) % 60000);
      if (key === 'totalSec') c.totalMs = Math.floor((c.totalMs || 0) / 60000) * 60000 + n * 1000;
      if (key === 'everyMin') c.everyMs = n * 60000 + ((c.everyMs || 0) % 60000);
      if (key === 'everySec') c.everyMs = Math.floor((c.everyMs || 0) / 60000) * 60000 + n * 1000;
      persistTimer(HybridTimer.patch(t, c));
    },
  };

  root.Logger = Logger;
})(typeof window !== 'undefined' ? window : globalThis);
