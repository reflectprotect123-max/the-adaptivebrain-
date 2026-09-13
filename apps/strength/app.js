const BRAIN_BUILD = 'THE-brain-v1';
const STORAGE_KEY = 'THE-brain-v1';
const APP_BUILD = 'THE-brain-v9';

let otaInfo = { status: '', current: '', next: '', latest: '' };

const defaultState = () => ({
  build: BRAIN_BUILD,
  tab: 'home',
  selectedDate: today(),
  checkin: {},
  settings: { whoop: { connected: false, lastSyncAt: null, email: null } },
  coachHistory: [],
  published: {},
  goals: [],
  fabOpen: false,
  session: null,
  timer: null,
  loggerOpen: false,
  library: null,
  sessions: {},
  planSync: { acks: { template: {}, session: {} }, snapshotRev: 0, lastPlan: null },
  libUi: { screen: 'list', tid: null, tab: 'exercises', q: '', selected: [], draft: {}, date: '', bid: null },
  notifications: 0,
  chatUnread: 0,
});

function resetBlankSlate(keepAuth = true) {
  const whoop = keepAuth && S.settings?.whoop
    ? { ...S.settings.whoop }
    : { connected: false, lastSyncAt: null, email: null };
  S.published = {};
  S.goals = [];
  S.coachHistory = [];
  S.checkin = {};
  S.notifications = 0;
  S.chatUnread = 0;
  S.fabOpen = false;
  S.session = null;
  S.timer = null;
  S.loggerOpen = false;
  S.libUi = { screen: 'list', tid: null, tab: 'exercises', q: '', selected: [], draft: {}, date: '', bid: null };
  S.selectedDate = today();
  S.settings = { whoop };
  save();
}

let S = load();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.build !== BRAIN_BUILD) return defaultState();
    return {
      ...defaultState(),
      ...parsed,
      published: parsed.published || {},
      settings: { ...defaultState().settings, ...parsed.settings },
    };
  } catch {
    return defaultState();
  }
}

function save() {
  if (S.session && S.session.date) {
    S.sessions = S.sessions || {};
    S.sessions[S.session.date] = S.session;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(S));
  window.S = S;
  if (window.PlanSync && typeof PlanSync.schedulePush === 'function') PlanSync.schedulePush();
}

function today() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

function addDays(iso, n) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function parseDate(iso) {
  return new Date(iso + 'T12:00:00');
}

function monthLabel(iso) {
  const d = parseDate(iso);
  const mon = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const yr = String(d.getFullYear()).slice(-2);
  return `${mon} '${yr}`;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function metricsFromCheckin(c = {}) {
  return {
    recovery: num(c.whoopRecovery) || null,
    strain: num(c.whoopStrain) || null,
    sleepScore: num(c.whoopSleepPerformance) || null,
    hrvMs: num(c.hrv) || null,
    restingHr: num(c.restingHr) || null,
  };
}

function checkinSlice(c = {}) {
  return {
    sleepQuality: num(c.sleepQuality) || null,
    energy: num(c.energy) || null,
    muscleSoreness: num(c.muscleSoreness) || null,
    jointStress: num(c.jointStress) || null,
    mentalStress: num(c.mentalStress) || null,
  };
}

function packet() {
  const c = S.checkin[S.selectedDate] || S.checkin[today()] || {};
  return HybridBrain.buildBrainPacket({
    date: S.selectedDate,
    room: 'engine',
    metrics: metricsFromCheckin(c),
    checkin: checkinSlice(c),
    connected: { whoop: !!S.settings.whoop.connected, concept2: false },
  });
}

function dailyCheckin(date = today(), create = true) {
  S.checkin = S.checkin || {};
  if (!S.checkin[date] && create) {
    S.checkin[date] = {
      date,
      whoopRecovery: '',
      whoopStrain: '',
      hrv: '',
      restingHr: '',
      whoopSleepPerformance: '',
    };
  }
  return S.checkin[date];
}

function readinessScore(c) {
  return HybridBrain.scoreReadiness(metricsFromCheckin(c), checkinSlice(c));
}

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function weekDays(centerIso) {
  const c = parseDate(centerIso);
  const day = c.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = new Date(c);
  start.setDate(c.getDate() + mondayOffset);
  const out = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function athClamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

/** WHOOP recovery zones — green ≥67, yellow 34–66, red ≤33 (brand guidelines). */
function whoopRecoveryColor(recovery) {
  const v = num(recovery);
  if (!v) return '#16ec06';
  if (v >= 67) return '#16ec06';
  if (v >= 34) return '#ffde00';
  return '#ff0026';
}

function whoopDialSvg(opts = {}) {
  const size = opts.size || 104;
  const stroke = size >= 100 ? 7 : 6;
  const c = size / 2;
  const r = c - stroke / 2 - 1.5;
  const max = num(opts.max) || 100;
  const raw = opts.value;
  const has = raw != null && raw !== '' && Number.isFinite(Number(raw));
  const prog = has ? athClamp(num(raw) / max, 0, 1) : 0;
  const circ = 2 * Math.PI * r;
  const color = opts.color || '#9db4c8';
  const label = opts.label || '';
  const unit = opts.unit || '';
  const fid = `wg${Math.round(c)}${String(color).replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)}`;
  const valHtml = has
    ? unit === '%'
      ? `<span class="ath-whoop-n">${Math.round(num(raw))}</span><small>%</small>`
      : Math.abs(num(raw) % 1) > 0.001
        ? num(raw).toFixed(1)
        : String(Math.round(num(raw)))
    : '—';
  const glow = has
    ? `<defs><filter id="${fid}" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`
    : '';
  const arc = has
    ? `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${circ}" stroke-dashoffset="${circ * (1 - prog)}" filter="url(#${fid})" style="filter:drop-shadow(0 0 6px ${color})"/>`
    : '';
  return `
    <div class="ath-whoop-dial">
      <div class="ath-whoop-dial-ring">
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
          ${glow}
          <g transform="rotate(-90 ${c} ${c})">
            <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="#111113" stroke-width="${stroke}"/>
            ${arc}
          </g>
        </svg>
        <div class="ath-whoop-dial-val">${valHtml}</div>
      </div>
      <div class="ath-whoop-dial-lab">${esc(label)}</div>
    </div>`;
}

function longDateLabel(iso) {
  return parseDate(iso).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function topBarHtml() {
  return `
    <header class="home-top">
      <div class="home-brand">
        <span class="home-mark" aria-hidden="true">TH</span>
        <div class="home-brand-text">
          <b>HYBRID</b>
          <small>Athlete</small>
        </div>
      </div>
      <div class="home-top-actions">
        <button type="button" class="month-btn" aria-label="Month">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h10M4 18h6"/></svg>
          <span>${esc(monthLabel(S.selectedDate))}</span>
        </button>
        <button type="button" class="today-btn" onclick="goToday()">Today</button>
        <button type="button" class="bell-btn" aria-label="Notifications">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a5 5 0 0 0-5 5v2.6c0 .8-.3 1.6-.8 2.2L4.5 15.5h15l-1.7-2.7a3.5 3.5 0 0 1-.8-2.2V8a5 5 0 0 0-5-5z"/><path d="M10 18a2 2 0 0 0 4 0"/></svg>
          <em class="bell-badge">${S.notifications || 0}</em>
        </button>
      </div>
    </header>`;
}

function gaugeRowHtml() {
  const c = dailyCheckin(S.selectedDate, false) || dailyCheckin(today(), false) || {};
  const m = metricsFromCheckin(c);
  return `
    <section class="ath-module-whoop" aria-label="WHOOP">
      <span class="ath-label">WHOOP</span>
      <div class="ath-whoop-wrap">
        <div class="ath-whoop-dials gauge-row">
          ${whoopDialSvg({ label: 'Sleep', value: m.sleepScore, max: 100, color: '#9db4c8', unit: '%', size: 104 })}
          ${whoopDialSvg({ label: 'Recovery', value: m.recovery, max: 100, color: whoopRecoveryColor(m.recovery), unit: '%', size: 104 })}
          ${whoopDialSvg({ label: 'Strain', value: m.strain, max: 21, color: '#1ba3ff', unit: '', size: 104 })}
        </div>
        ${todayCallHtml()}
      </div>
    </section>`;
}

function todayCallHtml() {
  const p = packet();
  return `
    <div class="today-call">
      <p class="eyebrow">${esc(p.label || 'Today')}</p>
      <p class="title">${esc(p.todayCall || 'Train with intent')}</p>
      <p class="meta">${esc(p.reason || 'Connect WHOOP under Me for live readiness.')}</p>
    </div>`;
}

function athleteRowHtml() {
  const items = S.published[S.selectedDate] || S.published[today()] || [];
  const first = items[0];
  const workout = first ? first.title : 'No session scheduled';
  return `
    <div class="ath-athlete">
      <div class="ath-avatar" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/></svg>
      </div>
      <div>
        <p class="ath-name">Today</p>
        <p class="ath-workout">${esc(workout)}</p>
      </div>
    </div>`;
}

function calendarHtml() {
  const days = weekDays(S.selectedDate);
  return `
    <div class="cal-strip" role="tablist" aria-label="Published calendar">
      ${days
        .map((iso) => {
          const d = parseDate(iso);
          const published = S.published[iso] || [];
          const active = iso === S.selectedDate ? ' active' : '';
          const dots = published
            .map((p) => `<span class="cal-dot ${esc(p.type)}" title="${esc(p.title)}"></span>`)
            .join('');
          return `
            <button type="button" class="cal-day${active}" onclick="selectDate('${iso}')" aria-selected="${iso === S.selectedDate}">
              <b>${d.getDate()}</b>
              <div class="cal-dots">${dots}</div>
            </button>`;
        })
        .join('')}
    </div>`;
}

function publishedListHtml() {
  const items = S.published[S.selectedDate] || [];
  if (!items.length) {
    return `<p class="empty-day">Nothing scheduled for this day yet.</p>`;
  }
  return `
    <div class="published-list">
      ${items
        .map(
          (p) => `
        <button type="button" class="published-item" onclick="fabAction('session')">
          <span class="pub-dot ${esc(p.type)}" aria-hidden="true"></span>
          <div>
            <strong>${esc(p.title)}</strong>
            <small>${esc(p.type)}</small>
          </div>
          <span class="chev" aria-hidden="true">›</span>
        </button>`,
        )
        .join('')}
    </div>`;
}

function trainingHomeHtml() {
  const count = (S.published[S.selectedDate] || []).length;
  return `
    <div class="shell-screen shell-screen--oled">
      ${topBarHtml()}
      <div class="ath-date">${esc(longDateLabel(S.selectedDate))}</div>
      ${calendarHtml()}
      ${athleteRowHtml()}
      ${gaugeRowHtml()}
      <section class="home-brief">
        <div class="home-brief-header">
          <p class="eyebrow">Scheduled</p>
          ${count ? `<span class="home-pill">${count} session${count === 1 ? '' : 's'}</span>` : ''}
        </div>
        ${publishedListHtml()}
        <div class="home-cta">
          <button type="button" class="btn oled-cta create-session-btn" onclick="fabAction('session')">Create session</button>
        </div>
      </section>
    </div>`;
}

const homeHtml = trainingHomeHtml;

/** Reference plan from HPP training screen (screenshot match). */
const TRAINING_DEMO = {
  dots: { '2026-09-07': true, '2026-09-09': true, '2026-09-11': true },
  blocks: [
    {
      kind: 'warmup',
      letter: 'A',
      title: 'Deadlift Warm-Up',
      items: [
        { n: 1, text: 'Foam Roll Hamstrings x 60s each side – small 1-2” motion', note: 'All foam rolling should be non-painful so remove pressure as needed' },
        { n: 2, text: 'Active Straight Leg Raises x 10 reps each side' },
        { n: 3, text: 'Bird Dogs: 3 x 3-5 each' },
        { n: 4, text: 'BW Glute Bridge: 3 x 5 with a 1 count at top of each rep. Rest as needed.' },
        { n: 5, text: 'KB RDLs: 3 x 5. Rest 60s.' },
        { n: 6, text: 'Box Jump Variation (your choice): 3 x 3. Rest 45-60s.', note: 'Jump for maximal height to a moderate height box.' },
      ],
      footer: 'For Completion',
    },
    {
      kind: 'section',
      label: 'STRENGTH/POWER',
      badge: { icon: 'trophy', text: 'For Weight' },
    },
    { kind: 'lift', letter: 'B', title: 'Snatch Grip Rack Deadlift', prescription: '6 x 3', notes: ['increase weight each set', 'set at mid shin', 'straps are acceptable'] },
    { kind: 'section', label: 'STRENGTH/POWER' },
    { kind: 'lift', letter: 'C', title: 'Barbell Lateral Squat', prescription: '3 x 8' },
    { kind: 'section', label: 'STRENGTH/POWER' },
    { kind: 'lift', letter: 'D', title: 'Goblet Box Squat', prescription: '3 x 12' },
    { kind: 'section', label: 'STRENGTH/POWER' },
    { kind: 'lift', letter: 'E', title: 'Reverse Hypers', prescription: '4 x 25' },
    { kind: 'section', label: 'STRENGTH/POWER' },
    { kind: 'lift', letter: 'F1', title: 'Double Leg Banded Leg Curls', prescription: '4 x 25' },
    { kind: 'lift', letter: 'F2', title: 'Garhammer Raises', prescription: '4 x MAX' },
    { kind: 'section', label: 'STRENGTH/POWER' },
    {
      kind: 'recovery',
      letter: 'G',
      title: 'Recovery Breathing',
      bullets: [
        '10 Nasal Breaths',
        '5 second inhale',
        '1-second hold at the top',
        '5 second exhale',
        '1-second pause at the bottom',
      ],
      note: 'Turn off the music and make sure you’re in a relaxing state.',
      goal: 'The goal is to start the recovery process before leaving the gym',
      footer: 'For Completion',
    },
  ],
};

function trainingPlanForDate(iso) {
  if (window.HybridLibrary) {
    S.library = HybridLibrary.ensure(S.library);
    const fromLib = HybridLibrary.planForDate(S.library, iso, null);
    if (fromLib) return fromLib;
  }
  if (S.trainingPlans && S.trainingPlans[iso]) return S.trainingPlans[iso];
  if (iso >= '2026-09-07' && iso <= '2026-09-13') return TRAINING_DEMO;
  return null;
}

function trainingTopBarHtml() {
  const badge = S.notifications || 7;
  return `
    <header class="trn-top">
      <div class="trn-top-left">
        <img class="trn-logo" src="assets/hpp-logo.jpg" width="36" height="36" alt="Hybrid Power Project">
        <button type="button" class="trn-icon-btn" aria-label="Program menu">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2"/></svg>
        </button>
        <button type="button" class="trn-icon-btn" aria-label="Filter">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M6 12h12M9 17h6" fill="none" stroke="currentColor" stroke-width="2"/></svg>
        </button>
      </div>
      <div class="trn-top-right">
        <button type="button" class="trn-month" aria-label="Month">
          <span>${esc(monthLabel(S.selectedDate))}</span>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2"/></svg>
        </button>
        <button type="button" class="today-btn trn-today" onclick="goToday()">Today</button>
        <button type="button" class="bell-btn trn-bell" aria-label="Notifications">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a5 5 0 0 0-5 5v2.6c0 .8-.3 1.6-.8 2.2L4.5 15.5h15l-1.7-2.7a3.5 3.5 0 0 1-.8-2.2V8a5 5 0 0 0-5-5z"/><path d="M10 18a2 2 0 0 0 4 0"/></svg>
          ${badge ? `<em class="bell-badge trn-bell-badge">${badge}</em>` : ''}
        </button>
      </div>
    </header>`;
}

function trainingCalendarHtml() {
  const days = weekDays(S.selectedDate);
  const plan = trainingPlanForDate(S.selectedDate);
  const libDots = (S.library && S.library.assignments)
    ? Object.fromEntries(Object.keys(S.library.assignments).map((d) => [d, true]))
    : {};
  const dotMap = { ...((TRAINING_DEMO && TRAINING_DEMO.dots) || {}), ...libDots, ...((plan && plan.dots) || {}) };
  return `
    <div class="cal-strip cal-strip--training" role="tablist" aria-label="Training calendar">
      ${days
        .map((iso) => {
          const d = parseDate(iso);
          const active = iso === S.selectedDate ? ' active' : '';
          const dot = dotMap[iso] ? '<span class="cal-dot"></span>' : '';
          return `
            <button type="button" class="cal-day${active}" onclick="selectDate('${iso}')" aria-selected="${iso === S.selectedDate}">
              <b>${d.getDate()}</b>
              <div class="cal-dots">${dot}</div>
            </button>`;
        })
        .join('')}
    </div>`;
}

function trnWarmupHtml(block) {
  const items = (block.items || [])
    .map((item) => {
      const note = item.note
        ? `<p class="trn-note"><em>*${esc(item.note)}</em></p>`
        : '';
      return `<li><span class="trn-num">${item.n}</span><span class="trn-item-text">${esc(item.text)}${note}</span></li>`;
    })
    .join('');
  return `
    <article class="trn-block trn-block--warmup" onclick="startTrainingSession('${esc(block.letter)}')">
      <div class="trn-block-head">
        <span class="trn-letter">${esc(block.letter)}</span>
        <h2 class="trn-block-title">${esc(block.title)}</h2>
      </div>
      <ol class="trn-warmup-list">${items}</ol>
      ${block.footer ? `<button type="button" class="trn-link">${esc(block.footer)}</button>` : ''}
    </article>`;
}

function trnSectionHtml(block) {
  const badge = block.badge
    ? `<span class="trn-section-badge"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8l1 3 3 1v6l-3 1-1 3H8l-1-3-3-1V8l3-1 1-3z"/></svg>${esc(block.badge.text)}</span>`
    : '';
  return `
    <div class="trn-section">
      <span class="trn-section-label">${esc(block.label)}</span>
      ${badge}
    </div>`;
}

function trnLiftHtml(block, opts = {}) {
  const ss = opts.superset
    ? `<div class="trn-ss">− Superset</div>`
    : '';
  return `
    <article class="trn-block trn-block--lift" onclick="startTrainingSession('${esc(block.letter)}')">
      <span class="trn-letter">${esc(block.letter)}</span>
      <div class="trn-lift-body">
        <h3 class="trn-lift-title">${esc(block.title)}</h3>
        <p class="trn-lift-rx">${esc(block.prescription)}</p>
      </div>
    </article>${ss}`;
}

function trnRecoveryHtml(block) {
  const bullets = (block.bullets || []).map((b) => `<li>${esc(b)}</li>`).join('');
  return `
    <article class="trn-block trn-block--recovery" onclick="startTrainingSession('${esc(block.letter)}')">
      <div class="trn-block-head">
        <span class="trn-letter">${esc(block.letter)}</span>
        <h2 class="trn-block-title">${esc(block.title)}</h2>
      </div>
      <ul class="trn-recovery-list">${bullets}</ul>
      ${block.note ? `<p class="trn-note"><em>*${esc(block.note)}</em></p>` : ''}
      ${block.goal ? `<p class="trn-recovery-goal">${esc(block.goal)}</p>` : ''}
      ${block.footer ? `<button type="button" class="trn-link">${esc(block.footer)}</button>` : ''}
    </article>`;
}

function trainingBlocksHtml(iso) {
  const plan = trainingPlanForDate(iso);
  if (!plan || !plan.blocks || !plan.blocks.length) {
    return `<p class="trn-empty">Nothing scheduled for this day yet.</p>
    <button type="button" class="trn-add-exercise" onclick="openLibraryForDay()">
      <span class="trn-add-icon" aria-hidden="true">+</span>
      <span>Add Exercise</span>
    </button>`;
  }
  const head = plan.title
    ? `<div class="trn-session-name">${esc(plan.title)}</div>`
    : '';
  const body = plan.blocks
    .map((block, i) => {
      if (block.kind === 'warmup') return trnWarmupHtml(block);
      if (block.kind === 'section') return trnSectionHtml(block);
      if (block.kind === 'lift') {
        const next = plan.blocks[i + 1];
        const a = String(block.letter || '').match(/^([A-Za-z]+)(\d+)$/);
        const b = next && String(next.letter || '').match(/^([A-Za-z]+)(\d+)$/);
        const superset = !!(a && b && a[1] === b[1] && Number(b[2]) === Number(a[2]) + 1);
        return trnLiftHtml(block, { superset });
      }
      if (block.kind === 'recovery') return trnRecoveryHtml(block);
      return '';
    })
    .join('');
  return `
    ${head}
    ${body}
    <button type="button" class="trn-add-exercise" onclick="openLibraryForDay()">
      <span class="trn-add-icon" aria-hidden="true">+</span>
      <span>Add Exercise</span>
    </button>`;
}

function trainingTabHtml() {
  return `
    <div class="shell-screen shell-screen--training">
      ${trainingTopBarHtml()}
      ${trainingCalendarHtml()}
      <div class="trn-scroll">${trainingBlocksHtml(S.selectedDate)}
        <div class="trn-start-bar">
          <button type="button" class="log-primary" onclick="startTrainingSession()">Start Session</button>
        </div>
      </div>
    </div>`;
}

function startTrainingSession(letter) {
  if (window.Logger) Logger.open({ date: S.selectedDate, letter, plan: trainingPlanForDate(S.selectedDate) });
}

function libraryHtml() {
  if (window.LibraryView) return LibraryView.html();
  return `<div class="page"><h1>Library</h1></div>`;
}

function openLibraryForDay() {
  S.tab = 'library';
  S.library = window.HybridLibrary ? HybridLibrary.ensure(S.library) : S.library;
  const tid = S.library && S.library.assignments && S.library.assignments[S.selectedDate];
  if (tid && window.LibraryView) LibraryView.open(tid);
  else if (window.LibraryView) LibraryView.create();
  else render();
}

function meAppSectionHtml() {
  const otaLine = otaInfo.current ? `Channel ${esc(otaInfo.current)}` : `Build ${esc(APP_BUILD)}`;
  return `
    ${otaBannerHtml()}
    <div class="card account-compact">
      <div class="eyebrow">App</div>
      <p class="stub">${otaLine} · ${esc(APP_BUILD)}</p>
      <div class="account-actions">
        <button type="button" class="btn" onclick="lookForAppUpdate()">Look for app update</button>
      </div>
    </div>`;
}

function otaBannerHtml() {
  const s = otaInfo && otaInfo.status;
  if (s !== 'ready' && s !== 'available') return '';
  const ver = esc(otaInfo.next || otaInfo.latest || '');
  if (s === 'ready') {
    return `
      <div class="ota-banner" id="otaBanner" role="status">
        <div class="ota-copy">
          <div class="ota-kicker">App update</div>
          <div class="ota-title">Version ${ver} is ready</div>
          <div class="ota-meta">Restart to load it. Workouts stay on this phone.</div>
        </div>
        <button type="button" class="btn oled-cta" onclick="applyOtaUpdate()">Restart now</button>
      </div>`;
  }
  return `
    <div class="ota-banner ota-wait" id="otaBanner" role="status">
      <div class="ota-copy">
        <div class="ota-kicker">App update</div>
        <div class="ota-title">Version ${ver} is downloading</div>
        <div class="ota-meta">Restart now appears when the file is on the phone.</div>
      </div>
    </div>`;
}

async function refreshOtaStatus(force) {
  if (!window.NativeBridge || typeof NativeBridge.probeLiveUpdate !== 'function') return;
  try {
    otaInfo = (await NativeBridge.probeLiveUpdate(force ? { refresh: true } : {})) || otaInfo;
  } catch (_) {
    return;
  }
  if (S.tab === 'me') render();
}

async function applyOtaUpdate() {
  if (!window.NativeBridge || typeof NativeBridge.applyLiveUpdate !== 'function') return;
  const r = await NativeBridge.applyLiveUpdate();
  if (r === 'error' || r === 'unavailable') {
    window.alert('Could not restart into the update. Close the app fully and open it again.');
  }
}

async function lookForAppUpdate() {
  await refreshOtaStatus(true);
  if (otaInfo.status === 'ready' || otaInfo.status === 'available') {
    if (S.tab === 'me') render();
    return;
  }
  if (otaInfo.status === 'browser') {
    window.alert('App updates run on the phone install — not in the browser.');
    return;
  }
  window.alert(`You're on ${otaInfo.current || APP_BUILD}. No new version is ready.`);
}

function meHtml() {
  const w = S.settings.whoop || {};
  if (w.email) {
    return `
      <div class="page">
        <div class="eyebrow">Me</div>
        <h1>Profile</h1>
        ${meAppSectionHtml()}
        <div class="card account-compact">
          <p class="account-email">${esc(w.email)}</p>
          <p class="stub">WHOOP · ${w.connected ? 'Connected' : 'Not linked yet'}</p>
          <div class="account-actions">
            ${w.connected
              ? '<button type="button" class="btn" onclick="Whoop.syncAll()">Sync WHOOP</button>'
              : '<button type="button" class="btn" onclick="Whoop.connect()">Connect WHOOP</button>'}
            <button type="button" class="btn" onclick="Whoop.signOut()">Sign out</button>
          </div>
        </div>
      </div>`;
  }
  return `
    <div class="page page-signin">
      <div class="eyebrow">Account</div>
      <h1>Sign in</h1>
      ${meAppSectionHtml()}
      <p class="stub page-lead">Same email and password as THE Hybrid Engine. After sign-in you land on a blank slate — no demo sessions.</p>
      <div id="whoopCard"></div>
    </div>`;
}

function setTab(tab) {
  S.tab = tab === 'chat' ? 'home' : tab;
  S.fabOpen = false;
  save();
  render();
}

function selectDate(iso) {
  S.selectedDate = iso;
  save();
  render();
}

function goToday() {
  S.selectedDate = today();
  save();
  render();
}

function toggleFab(ev) {
  if (ev) ev.stopPropagation();
  S.fabOpen = !S.fabOpen;
  save();
  syncFab();
}

function closeFab() {
  S.fabOpen = false;
  save();
  syncFab();
}

function syncFab() {
  const layer = document.getElementById('fabLayer');
  if (!layer) return;
  const show = !S.loggerOpen;
  layer.classList.toggle('hidden', !show);
  layer.classList.toggle('open', !!S.fabOpen);
  layer.classList.toggle('fab-layer--training', S.tab === 'training');
}

function fabAction(kind) {
  S.fabOpen = false;
  save();
  syncFab();
  if (kind === 'goal') {
    const title = window.prompt('Goal title');
    if (title && title.trim()) {
      S.goals.push({ id: String(Date.now()), title: title.trim(), created: today() });
      save();
      render();
    }
    return;
  }
  if (kind === 'session') {
    S.tab = 'library';
    if (window.LibraryView) LibraryView.create();
    else render();
    return;
  }
  if (kind === 'coach') {
    openCoachSheet();
  }
}

function openCoachSheet() {
  const sheet = document.getElementById('coachSheet');
  if (!sheet) return;
  sheet.classList.remove('hidden');
  sheet.setAttribute('aria-hidden', 'false');
  renderCoachSheetLog();
}

function closeCoachSheet() {
  const sheet = document.getElementById('coachSheet');
  if (!sheet) return;
  sheet.classList.add('hidden');
  sheet.setAttribute('aria-hidden', 'true');
}

function renderCoachSheetLog() {
  const log = document.getElementById('coachSheetLog');
  if (!log) return;
  log.innerHTML = (S.coachHistory || [])
    .map((m) => `<div class="msg ${m.role}">${esc(m.content)}</div>`)
    .join('');
  log.scrollTop = log.scrollHeight;
}

function render() {
  const root = document.getElementById('app');
  const map = {
    home: homeHtml,
    training: trainingTabHtml,
    library: libraryHtml,
    me: meHtml,
    settings: meHtml,
  };
  if (S.tab === 'chat') S.tab = 'home';
  root.innerHTML = (map[S.tab] || homeHtml)();

  document.querySelectorAll('[data-tab]').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === S.tab);
  });

  const shell = document.getElementById('shell');
  if (shell) shell.classList.toggle('shell--training', S.tab === 'training');

  syncFab();
  renderCoachSheetLog();
  if (window.Logger && S.loggerOpen) Logger.paint();

  if (window.Whoop) {
    if (S.tab === 'me' && !(S.settings.whoop && S.settings.whoop.email)) {
      Whoop.renderPanels();
    }
    if (S.tab === 'home' || S.tab === 'training') Whoop.autoSyncIfPossible();
  }
}

async function askCoach() {
  const input = document.getElementById('coachSheetInput');
  const status = document.getElementById('coachSheetStatus');
  const message = (input && input.value || '').trim();
  if (!message) return;
  if (!window.Whoop || !(await Whoop.token())) {
    if (status) status.textContent = 'Sign in under Me before using the coach.';
    return;
  }
  if (status) status.textContent = 'Thinking…';
  S.coachHistory = S.coachHistory || [];
  S.coachHistory.push({ role: 'user', content: message });
  input.value = '';
  render();
  renderCoachSheetLog();
  try {
    const coachUrl = (window.Whoop && typeof Whoop.fnUrl === 'function')
      ? Whoop.fnUrl('/.netlify/functions/brain-coach')
      : 'https://thehybridsystem.netlify.app/.netlify/functions/brain-coach';
    const res = await fetch(coachUrl, {
      method: 'POST',
      headers: {
        authorization: 'Bearer ' + (await Whoop.token()),
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        message,
        packet: HybridBrain.coachContextFromPacket(packet()),
        history: S.coachHistory.filter((m) => m.content !== '(empty reply)').slice(-8),
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Coach request failed');
    const reply = String(body.reply || '').trim();
    if (!reply) throw new Error('Coach returned no text. Try again.');
    S.coachHistory.push({ role: 'assistant', content: reply });
    if (status) status.textContent = '';
    S.chatUnread = Math.max(0, (S.chatUnread || 0) - 1);
  } catch (err) {
    if (status) status.textContent = err.message || 'Coach failed';
  }
  save();
  render();
  renderCoachSheetLog();
}

window.S = S;
window.save = save;
window.today = today;
window.dailyCheckin = dailyCheckin;
window.readinessScore = readinessScore;
window.touchRecord = function () {
  if (window.PlanSync) PlanSync.schedulePush();
};
window.num = num;
window.resetBlankSlate = resetBlankSlate;
window.setTab = setTab;
window.selectDate = selectDate;
window.goToday = goToday;
window.toggleFab = toggleFab;
window.closeFab = closeFab;
window.fabAction = fabAction;
window.openCoachSheet = openCoachSheet;
window.closeCoachSheet = closeCoachSheet;
window.askCoach = askCoach;
window.applyOtaUpdate = applyOtaUpdate;
window.lookForAppUpdate = lookForAppUpdate;
window.startTrainingSession = startTrainingSession;
window.trainingPlanForDate = trainingPlanForDate;
window.openLibraryForDay = openLibraryForDay;
window.render = render;

document.addEventListener('DOMContentLoaded', async () => {
  if (window.NativeBridge && typeof NativeBridge.onLiveUpdateStatus === 'function') {
    NativeBridge.onLiveUpdateStatus((info) => {
      otaInfo = info || otaInfo;
      if (S.tab === 'me') render();
    });
  }
  if (window.Whoop && typeof Whoop.hydrateAuth === 'function') {
    try { await Whoop.hydrateAuth(); } catch (_) { /* offline / SDK */ }
  }
  if (window.PlanSync && typeof PlanSync.syncNow === 'function') {
    try { await PlanSync.syncNow(); } catch (_) { /* offline / unsigned */ }
  }
  await refreshOtaStatus(false);
  render();
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js').catch(() => {});
}
