(function (root) {
  function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function lib() {
    const Lib = root.HybridLibrary;
    root.S.library = Lib.ensure(root.S.library);
    root.S.libUi = root.S.libUi || { screen: 'list', tid: null, tab: 'exercises', q: '', selected: [], draft: {}, date: '', bid: null };
    return root.S.library;
  }

  function ui() {
    lib();
    return root.S.libUi;
  }

  function save(opts) {
    if (typeof root.save === 'function') root.save();
    if (opts && opts.paint === false) {
      refreshResults();
      return;
    }
    if (typeof root.render === 'function') root.render();
  }

  function refreshResults() {
    const doc = typeof document !== 'undefined' ? document : root.document;
    const el = doc && doc.getElementById && doc.getElementById('libResults');
    if (!el) return;
    const screen = ui().screen;
    if (screen === 'picker' || screen === 'newEx' || screen === 'newCirc') el.innerHTML = pickerRowsHtml();
    else if (screen === 'list') el.innerHTML = listCardsHtml();
  }

  function setLib(next) {
    root.S.library = next;
    save();
  }

  function go(screen, extra) {
    root.S.libUi = { ...ui(), screen, ...(extra || {}) };
    save();
  }

  function trackOptions(selected) {
    const skip = new Set(['for_completion']);
    return ['none', ...root.HybridLibrary.TRACK.filter((t) => !skip.has(t.key)).map((t) => t.key)]
      .map((k) => {
        const label = k === 'none' ? 'None' : root.HybridLibrary.trackLabel(k);
        return `<option value="${esc(k)}" ${k === selected ? 'selected' : ''}>${esc(label)}</option>`;
      })
      .join('');
  }

  function listCardsHtml() {
    const st = lib();
    const q = String(ui().q || '').toLowerCase();
    const rows = st.templates.filter((t) => !q || t.title.toLowerCase().includes(q) || t.blocks.some((b) => (b.title || '').toLowerCase().includes(q)));
    if (!rows.length) {
      return `<div class="lib-empty"><b>No session templates yet</b><p>Create one, then drop it on a Training day.</p></div>`;
    }
    return rows.map((t) => {
      const names = root.HybridLibrary.lettered(t).map((b) => b.title).join(', ') || 'Empty template';
      return `<article class="lib-card">
          <button type="button" style="text-align:left;width:100%" onclick="LibraryView.open('${esc(t.id)}')">
            <h2>${esc(t.title)}</h2>
            <p>${esc(names)}</p>
          </button>
          <div class="lib-card-actions">
            <button type="button" class="lib-chip" onclick="LibraryView.calendar('${esc(t.id)}')">Add to calendar</button>
            <button type="button" class="lib-danger" onclick="LibraryView.removeTpl('${esc(t.id)}')">Delete</button>
          </div>
        </article>`;
    }).join('');
  }

  function listHtml() {
    return `
      <div class="shell-screen shell-screen--library">
        <div class="lib-top">
          <p class="lib-kicker">Library</p>
          <h1 class="lib-title">Sessions</h1>
        </div>
        <div class="lib-search">
          <input value="${esc(ui().q || '')}" placeholder="Search sessions" oninput="LibraryView.search(this.value)" aria-label="Search sessions">
        </div>
        <button type="button" class="lib-create" onclick="LibraryView.create()"><span class="lib-plus">+</span> Create Session Template</button>
        <div id="libResults">${listCardsHtml()}</div>
      </div>`;
  }

  function editorHtml() {
    const st = lib();
    const t = root.HybridLibrary.template(st, ui().tid);
    if (!t) return listHtml();
    const blocks = root.HybridLibrary.lettered(t);
    let body = '';
    blocks.forEach((b, i) => {
      const prev = blocks[i - 1];
      if (prev && prev.kind === 'lift' && b.kind === 'lift' && prev.groupId && prev.groupId === b.groupId) {
        body += `<div class="lib-ss">− Superset</div>`;
      }
      const meta = b.kind === 'circuit' ? 'For Completion' : `${b.setCount || 3} sets`;
      body += `<article class="lib-block">
        <div class="lib-block-top">
          <span class="lib-letter">${esc(b.letter)}</span>
          <div style="flex:1">
            <h3>${esc(b.title)}</h3>
            <div class="meta">${esc(meta)}</div>
          </div>
          <button type="button" class="lib-text-btn" onclick="LibraryView.editBlock('${esc(b.id)}')">Edit</button>
          <button type="button" class="lib-danger" onclick="LibraryView.removeBlock('${esc(b.id)}')">Delete</button>
        </div>
      </article>`;
    });
    return `
      <div class="shell-screen shell-screen--library">
        <div class="lib-head-row">
          <button type="button" class="lib-back" onclick="LibraryView.goList()">←</button>
          <h1>Session Template</h1>
          <button type="button" class="lib-text-btn" onclick="LibraryView.reorder()">Reorder</button>
        </div>
        <div class="lib-field">
          <label>Title</label>
          <input value="${esc(t.title)}" onchange="LibraryView.patchTpl({title:this.value})">
        </div>
        <div class="lib-field">
          <label>Session instructions</label>
          <textarea placeholder="Coach notes for Start Session" onchange="LibraryView.patchTpl({instructions:this.value})">${esc(t.instructions)}</textarea>
        </div>
        ${body}
        <div class="lib-row-btns">
          <button type="button" onclick="LibraryView.picker('exercises')">+ Add Exercise</button>
          <button type="button" onclick="LibraryView.picker('circuits')">+ Add Circuit</button>
        </div>
        ${editSheetHtml()}
      </div>`;
  }

  function editSheetHtml() {
    const u = ui();
    if (u.screen !== 'edit' || !u.bid) return '';
    const t = root.HybridLibrary.template(lib(), u.tid);
    const b = t && t.blocks.find((x) => x.id === u.bid);
    if (!b) return '';
    if (b.kind === 'circuit') {
      return `<div class="lib-sheet" onclick="if(event.target===this)LibraryView.closeSheet()">
        <div class="lib-sheet-card">
          <h2>Edit circuit</h2>
          <div class="lib-field"><label>Title</label><input value="${esc(b.title)}" onchange="LibraryView.patchBlock({title:this.value})"></div>
          <div class="lib-field"><label>Instructions</label><textarea onchange="LibraryView.patchBlock({instructions:this.value})">${esc(b.instructions || '')}</textarea></div>
          <button type="button" class="lib-primary" onclick="LibraryView.closeSheet()">Done</button>
        </div></div>`;
    }
    const c1 = (b.columns && b.columns[0]) || 'reps';
    const c2 = (b.columns && b.columns[1]) || 'none';
    return `<div class="lib-sheet" onclick="if(event.target===this)LibraryView.closeSheet()">
      <div class="lib-sheet-card">
        <h2>Edit exercise</h2>
        <div class="lib-field"><label>Title</label><input value="${esc(b.title)}" onchange="LibraryView.patchBlock({title:this.value})"></div>
        <div class="lib-field"><label>Sets</label>
          <input type="number" min="1" max="12" value="${esc(b.setCount || 3)}" onchange="LibraryView.patchBlock({setCount:Number(this.value)})">
        </div>
        <div class="lib-field"><label>What do you want to track?</label>
          <div class="lib-cols">
            <select onchange="LibraryView.setCols(this.value, document.getElementById('libCol2').value)">
              ${trackOptions(c1)}
            </select>
            <select id="libCol2" onchange="LibraryView.setCols('${esc(c1)}', this.value)">
              ${trackOptions(c2)}
            </select>
          </div>
        </div>
        <div class="lib-field"><label>Notes</label><textarea onchange="LibraryView.patchBlock({notes:this.value.split('\\n').filter(Boolean)})">${esc((b.notes || []).join('\n'))}</textarea></div>
        <button type="button" class="lib-primary" onclick="LibraryView.closeSheet()">Done</button>
      </div></div>`;
  }

  function pickerHtml() {
    const u = ui();
    const tab = u.tab || 'exercises';
    const selected = new Set(u.selected || []);
    const create = tab === 'circuits'
      ? `<button type="button" class="lib-create" onclick="LibraryView.newCirc()"><span class="lib-plus">+</span> Create New Circuit</button>`
      : `<button type="button" class="lib-create" onclick="LibraryView.newEx()"><span class="lib-plus">+</span> Create New Exercise</button>`;
    const n = selected.size;
    return `
      <div class="shell-screen shell-screen--library">
        <div class="lib-head-row">
          <button type="button" class="lib-back" onclick="LibraryView.open('${esc(u.tid)}')">←</button>
          <h1>${tab === 'circuits' ? 'Circuits' : 'Exercises'}</h1>
          <button type="button" class="lib-text-btn" ${n < 2 ? 'disabled' : ''} onclick="LibraryView.addPicked(true)">Superset</button>
          <button type="button" class="lib-text-btn" ${n < 1 ? 'disabled' : ''} onclick="LibraryView.addPicked(false)">Add${n ? ' (' + n + ')' : ''}</button>
        </div>
        <div class="lib-search"><input value="${esc(u.q || '')}" placeholder="Search exercises and circuits" oninput="LibraryView.search(this.value)"></div>
        <div class="lib-tabs">
          <button type="button" class="${tab === 'exercises' ? 'on' : ''}" onclick="LibraryView.picker('exercises')">Exercises</button>
          <button type="button" class="${tab === 'circuits' ? 'on' : ''}" onclick="LibraryView.picker('circuits')">Circuits</button>
        </div>
        ${create}
        <div id="libResults">${pickerRowsHtml()}</div>
        ${createSheetHtml()}
      </div>`;
  }

  function pickerRowsHtml() {
    const u = ui();
    const tab = u.tab || 'exercises';
    const hits = root.HybridLibrary.searchCatalog(lib(), tab, u.q);
    const selected = new Set(u.selected || []);
    return hits.map((h) => `
      <button type="button" class="lib-pick-row" onclick="LibraryView.togglePick('${esc(h.id)}')">
        <b>${esc(h.title)}</b>
        <span class="lib-radio${selected.has(h.id) ? ' on' : ''}"></span>
      </button>`).join('') || `<div class="lib-empty">No results. Create something new.</div>`;
  }

  function createSheetHtml() {
    const u = ui();
    if (u.screen === 'newEx') {
      const d = u.draft || {};
      return `<div class="lib-sheet" onclick="if(event.target===this)LibraryView.closeCreate()">
        <div class="lib-sheet-card">
          <h2>New Exercise</h2>
          <div class="lib-field"><label>Title</label><input id="libNewTitle" value="${esc(d.title || '')}" placeholder="Title"></div>
          <div class="lib-field"><label>What do you want to track?</label>
            <div class="lib-cols">
              <select id="libNewC1">${trackOptions(d.c1 || 'reps')}</select>
              <select id="libNewC2">${trackOptions(d.c2 || 'none')}</select>
            </div>
          </div>
          <button type="button" class="lib-primary" onclick="LibraryView.saveNewEx()">Create</button>
        </div></div>`;
    }
    if (u.screen === 'newCirc') {
      const d = u.draft || {};
      return `<div class="lib-sheet" onclick="if(event.target===this)LibraryView.closeCreate()">
        <div class="lib-sheet-card">
          <h2>New Circuit</h2>
          <div class="lib-field"><label>Title</label><input id="libNewTitle" value="${esc(d.title || '')}"></div>
          <div class="lib-field"><label>What do you want to track?</label>
            <select disabled><option>For Completion</option></select>
          </div>
          <div class="lib-field"><label>Instructions</label><textarea id="libNewInstr" placeholder="Ex. 3 rounds for time">${esc(d.instructions || '')}</textarea></div>
          <button type="button" class="lib-primary" onclick="LibraryView.saveNewCirc()">Create</button>
        </div></div>`;
    }
    return '';
  }

  function calendarHtml() {
    const u = ui();
    const t = root.HybridLibrary.template(lib(), u.tid);
    const date = u.date || (typeof root.today === 'function' ? root.today() : '');
    return `
      <div class="shell-screen shell-screen--library">
        <div class="lib-head-row">
          <button type="button" class="lib-back" onclick="LibraryView.goList()">←</button>
          <h1>Add to calendar</h1>
        </div>
        <div class="lib-field">
          <label>Date</label>
          <input type="date" value="${esc(date)}" onchange="LibraryView.setDate(this.value)">
        </div>
        <p class="lib-empty" style="text-align:left;padding:0 16px 12px">Lands on your Training tab only — no other athletes.</p>
        <div style="padding:0 16px">
          <button type="button" class="lib-primary" onclick="LibraryView.confirmDate()">Add to calendar</button>
        </div>
        <p class="lib-empty">${esc(t && t.title)}</p>
      </div>`;
  }

  function html() {
    const s = ui().screen;
    if (s === 'edit' || s === 'editBlock') return editorHtml();
    if (s === 'picker' || s === 'newEx' || s === 'newCirc') return pickerHtml();
    if (s === 'calendar') return calendarHtml();
    return listHtml();
  }

  const LibraryView = {
    html,
    search(q) {
      root.S.libUi.q = String(q || '');
      save({ paint: false });
    },
    goList() { go('list', { tid: null, q: '', selected: [], bid: null }); },
    create() {
      const next = root.HybridLibrary.createTemplate(lib(), {});
      root.S.library = next;
      go('edit', { tid: next.templates[0].id, bid: null });
    },
    open(tid) { go('edit', { tid, bid: null, q: '' }); },
    patchTpl(patch) { setLib(root.HybridLibrary.patchTemplate(lib(), ui().tid, patch)); },
    removeTpl(tid) {
      if (!window.confirm('Delete this session template?')) return;
      setLib(root.HybridLibrary.deleteTemplate(lib(), tid));
      go('list', { tid: null });
    },
    picker(tab) { go('picker', { tab, q: '', selected: [] }); },
    togglePick(id) {
      const cur = new Set(ui().selected || []);
      if (cur.has(id)) cur.delete(id);
      else cur.add(id);
      root.S.libUi.selected = [...cur];
      save();
    },
    addPicked(asSuperset) {
      const u = ui();
      const ids = u.selected || [];
      if (!ids.length) return;
      let st = lib();
      const added = [];
      for (const id of ids) {
        if (u.tab === 'circuits') st = root.HybridLibrary.addCircuit(st, u.tid, { catalogId: id });
        else st = root.HybridLibrary.addExercise(st, u.tid, { catalogId: id });
        added.push(st.templates.find((t) => t.id === u.tid).blocks.slice(-1)[0].id);
      }
      if (asSuperset && u.tab !== 'circuits') {
        for (let i = 1; i < added.length; i++) st = root.HybridLibrary.linkSuperset(st, u.tid, added[i - 1], added[i]);
      }
      root.S.library = st;
      go('edit', { tid: u.tid, selected: [], bid: null });
    },
    newEx() { go('newEx', { draft: { c1: 'reps', c2: 'none' } }); },
    newCirc() { go('newCirc', { draft: {} }); },
    closeCreate() { go('picker'); },
    saveNewEx() {
      const title = (document.getElementById('libNewTitle') || {}).value;
      const c1 = (document.getElementById('libNewC1') || {}).value || 'reps';
      const c2 = (document.getElementById('libNewC2') || {}).value || 'none';
      const cols = [c1, c2].filter((k) => k && k !== 'none');
      let st = root.HybridLibrary.createCatalogExercise(lib(), { title, columns: cols });
      const id = st.catalog.exercises[0].id;
      st = root.HybridLibrary.addExercise(st, ui().tid, { catalogId: id });
      root.S.library = st;
      go('edit', { tid: ui().tid, bid: null });
    },
    saveNewCirc() {
      const title = (document.getElementById('libNewTitle') || {}).value;
      const instructions = (document.getElementById('libNewInstr') || {}).value;
      let st = root.HybridLibrary.createCatalogCircuit(lib(), { title, instructions });
      const id = st.catalog.circuits[0].id;
      st = root.HybridLibrary.addCircuit(st, ui().tid, { catalogId: id });
      root.S.library = st;
      go('edit', { tid: ui().tid, bid: null });
    },
    editBlock(bid) { root.S.libUi.bid = bid; save(); },
    closeSheet() { root.S.libUi.bid = null; save(); },
    patchBlock(patch) { setLib(root.HybridLibrary.patchBlock(lib(), ui().tid, ui().bid, patch)); },
    setCols(c1, c2) {
      const cols = [c1, c2].filter((k) => k && k !== 'none');
      setLib(root.HybridLibrary.patchBlock(lib(), ui().tid, ui().bid, { columns: cols.length ? cols : ['reps'] }));
    },
    removeBlock(bid) { setLib(root.HybridLibrary.removeBlock(lib(), ui().tid, bid)); },
    reorder() {
      const t = root.HybridLibrary.template(lib(), ui().tid);
      if (!t || t.blocks.length < 2) return;
      const names = t.blocks.map((b, i) => `${i + 1}. ${b.title}`).join('\n');
      const raw = window.prompt('Move a block. Enter from-to like 3-1\n' + names);
      if (!raw) return;
      const m = String(raw).match(/(\d+)\s*[-to]+\s*(\d+)/i);
      if (!m) return;
      const from = Number(m[1]) - 1;
      const to = Number(m[2]) - 1;
      let st = lib();
      const tpl = root.HybridLibrary.template(st, ui().tid);
      const id = tpl.blocks[from] && tpl.blocks[from].id;
      if (!id) return;
      const dir = to < from ? -1 : 1;
      let steps = Math.abs(to - from);
      while (steps--) st = root.HybridLibrary.moveBlock(st, ui().tid, id, dir);
      setLib(st);
    },
    calendar(tid) {
      go('calendar', { tid, date: typeof root.today === 'function' ? root.today() : '' });
    },
    setDate(d) { root.S.libUi.date = d; save(); },
    confirmDate() {
      const date = ui().date || (typeof root.today === 'function' ? root.today() : '');
      setLib(root.HybridLibrary.assignDate(lib(), ui().tid, date));
      if (typeof root.selectDate === 'function') root.selectDate(date);
      root.S.tab = 'training';
      go('list', { tid: null });
    },
  };

  root.LibraryView = LibraryView;
})(typeof window !== 'undefined' ? window : globalThis);
