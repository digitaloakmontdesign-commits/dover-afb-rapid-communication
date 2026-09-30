/*
 * Dover AFB Rapid Communication Framework
 * app.js: the interface. Reads the registry that engine.js and the content libraries build.
 *
 * No network access. Events and remembered content packs live in this
 * browser's local storage on this computer only.
 */
(function () {
  'use strict';

  const R = window.RCF;
  if (!R) return;

  /* ------------------------------------------------------------------ */
  /* Utilities                                                           */
  /* ------------------------------------------------------------------ */

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
  const esc = R.util.escapeHTML;
  const pad = n => String(n).padStart(2, '0');
  const cssId = s => (window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/[^\w-]/g, '\\$&'));
  const reduceMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const capFirst = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const hhmm = iso => { const d = new Date(iso); return pad(d.getHours()) + pad(d.getMinutes()); };
  const stampOf = iso => `${R.util.milDate(isoDate(new Date(iso)))} ${hhmm(iso)}`;
  const minutesBetween = (a, b) => Math.max(0, Math.round((new Date(b) - new Date(a)) / 60000));
  const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const fileStamp = () => { const d = new Date(); return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`; };

  const KEYS = { events: 'rcf.events.v1', packs: 'rcf.packs.v1', showDemo: 'rcf.showDemo.v1' };
  const MAX_EVENTS = 40;
  const store = {
    get(key, fallback) {
      try { const raw = window.localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
      catch (e) { return fallback; }
    },
    set(key, value) {
      try { window.localStorage.setItem(key, JSON.stringify(value)); return true; }
      catch (e) { return false; }
    }
  };

  const LOG_TYPES = [
    { id: 'decision', label: 'Decision received' },
    { id: 'rfi', label: 'RFI sent' },
    { id: 'info', label: 'Information received' },
    { id: 'draft', label: 'Draft ready' },
    { id: 'review', label: 'Sent for approval' },
    { id: 'approved', label: 'Approved' },
    { id: 'released', label: 'Released' },
    { id: 'update', label: 'Update issued' },
    { id: 'note', label: 'Note' }
  ];
  const LOG_LABEL = {};
  LOG_TYPES.forEach(l => { LOG_LABEL[l.id] = l.label; });
  // Any of these ends a "waiting on other offices" window.
  const PA_ACTIONS = new Set(['draft', 'review', 'approved', 'released', 'update']);
  const SOURCE_LABEL = {
    bundled: 'built in',
    local: 'local folder',
    imported: 'loaded from a file',
    remembered: 'remembered on this computer'
  };

  const state = {
    view: 'situation',
    categoryId: null,
    event: null,
    product: null,
    editing: null,
    query: '',
    rfiDirty: false,
    showDemo: false
  };

  /* ------------------------------------------------------------------ */
  /* Registry helpers                                                    */
  /* ------------------------------------------------------------------ */

  const office = () => R.registry.office || 'Public Affairs';
  const tplOf = ev => (ev ? R.registry.templates[ev.templateId] || null : null);
  const fieldOf = id => R.registry.fields[id] ||
    { id, label: id, owner: 'PA', type: 'text', options: [], suggestions: [], standard: '', standards: [], autofill: false, help: '' };
  const ownerOf = code => R.registry.owners[code] || { code, name: code, order: 999 };
  const categories = () => Object.values(R.registry.categories).sort((a, b) => a.order - b.order);
  // In any category where the office library has its own messages, the demo
  // messages are hidden unless asked for, so sample language is not released by accident.
  const hasLive = () => R.registry.libraries.some(l => !l.demo);
  const allTemplates = () => {
    const all = Object.values(R.registry.templates);
    const liveCats = new Set(all.filter(t => !t.demo).map(t => t.category));
    return all.filter(t => !t.demo || state.showDemo || !liveCats.has(t.category));
  };
  const templatesIn = id => allTemplates().filter(t => t.category === id);
  const sortedLog = ev => ev.log.slice().sort((a, b) => new Date(a.at) - new Date(b.at));

  // Not-applicable only counts for optional fields of the current message.
  function ctxOf(ev, t) {
    const na = {};
    (t ? t.optional : []).forEach(id => { if (ev.na[id]) na[id] = true; });
    return { values: ev.values, na, fields: R.registry.fields, now: new Date() };
  }

  function readiness(t, ev) {
    const ctx = ctxOf(ev, t);
    const groups = new Map();
    const group = code => {
      if (!groups.has(code)) {
        const o = ownerOf(code);
        groups.set(code, {
          code, name: o.name, order: o.order,
          reqIn: 0, reqTotal: 0, optIn: 0, optNA: 0, optOpen: 0, missing: [], open: []
        });
      }
      return groups.get(code);
    };
    t.required.forEach(id => {
      const g = group(fieldOf(id).owner);
      g.reqTotal += 1;
      if (R.present(ctx, id)) g.reqIn += 1; else g.missing.push(id);
    });
    t.optional.forEach(id => {
      const g = group(fieldOf(id).owner);
      if (ctx.na[id]) g.optNA += 1;
      else if (R.present(ctx, id)) g.optIn += 1;
      else { g.optOpen += 1; g.open.push(id); }
    });
    const list = Array.from(groups.values()).sort((a, b) => a.order - b.order);
    const total = key => list.reduce((n, g) => n + g[key], 0);
    return { groups: list, reqIn: total('reqIn'), reqTotal: total('reqTotal'), optOpen: total('optOpen') };
  }

  /* ------------------------------------------------------------------ */
  /* Persistence                                                         */
  /* ------------------------------------------------------------------ */

  let saveTimer = null;
  function persist(immediate) {
    clearTimeout(saveTimer);
    if (immediate) saveNow();
    else saveTimer = setTimeout(saveNow, 250);
  }

  function saveNow() {
    const ev = state.event;
    if (!ev) return;
    ev.updatedAt = new Date().toISOString();
    const list = store.get(KEYS.events, []).filter(e => e && e.id !== ev.id);
    list.unshift(ev);
    store.set(KEYS.events, list.slice(0, MAX_EVENTS));
  }

  /* ------------------------------------------------------------------ */
  /* Top-level rendering                                                 */
  /* ------------------------------------------------------------------ */

  function canGo(view) {
    return { situation: true, decision: !!state.categoryId, build: !!state.event, record: !!state.event }[view];
  }

  function render() {
    renderSteps();
    renderChip();
    const view = $('#view');
    view.innerHTML = state.view === 'decision' ? viewDecision()
      : state.view === 'build' ? viewBuild()
        : state.view === 'record' ? viewRecord()
          : viewSituation();
    if (state.view === 'build') refreshBuild();
    const t = tplOf(state.event);
    document.title = (state.view === 'build' || state.view === 'record') && t
      ? `${t.title} | Rapid Communication Framework`
      : 'Rapid Communication Framework';
  }

  function go(view) {
    if (!canGo(view)) return;
    if (state.editing) finishEdit();
    state.view = view;
    render();
    window.scrollTo(0, 0);
    const h = $('#view h1');
    if (h) h.focus({ preventScroll: true });
  }

  function renderSteps() {
    const steps = [['situation', 'Situation'], ['decision', 'Decision'], ['build', 'Build'], ['record', 'Record']];
    $('#steps').innerHTML = steps.map(([id, label], i) => {
      const cur = state.view === id;
      return `<li><button type="button" class="step${cur ? ' is-current' : ''}" data-action="go" data-view="${id}"` +
        `${canGo(id) ? '' : ' disabled'}${cur ? ' aria-current="step"' : ''}>` +
        `<span class="step-num">${i + 1}</span>${label}</button></li>`;
    }).join('');
  }

  function renderChip() {
    const chip = $('#library-chip');
    const live = R.registry.libraries.filter(l => !l.demo);
    if (live.length) {
      chip.className = 'lib-chip lib-chip--live';
      chip.textContent = live.length === 1
        ? `${live[0].name}${live[0].version ? ` v${live[0].version}` : ''}`
        : `${live.length} libraries loaded`;
    } else {
      chip.className = 'lib-chip lib-chip--demo';
      chip.textContent = R.registry.libraries.length ? 'Demo library' : 'No library loaded';
    }
  }

  /* ------------------------------------------------------------------ */
  /* Step 1: Situation                                                   */
  /* ------------------------------------------------------------------ */

  function viewSituation() {
    return `<section class="situation" aria-labelledby="h-situation">
      <h1 id="h-situation" tabindex="-1">What's happening?</h1>
      <div class="find">
        <label for="find" class="visually-hidden">Find a message</label>
        <input type="search" id="find" placeholder="Find a message, for example: closure" value="${esc(state.query)}" autocomplete="off" spellcheck="false">
      </div>
      <div id="situation-body">${situationBody()}</div>
    </section>
    ${recentHTML()}`;
  }

  function situationBody() {
    const q = state.query.trim().toLowerCase();
    if (q) {
      const hits = allTemplates().filter(t => {
        const c = R.registry.categories[t.category];
        return `${t.title} ${t.summary} ${c ? c.name : ''}`.toLowerCase().includes(q);
      });
      return hits.length
        ? `<ul class="template-list">${hits.map(templateRow).join('')}</ul>`
        : `<p class="empty">No messages match "${esc(state.query)}". Try a hazard or an action, like snow or closure.</p>`;
    }
    const cats = categories();
    if (!cats.length) return '<p class="empty">No message library is loaded. Open the library menu to load a content pack.</p>';
    return `<div class="category-grid">${cats.map(c => {
      const n = templatesIn(c.id).length;
      return `<button type="button" class="tile${c.tone === 'urgent' ? ' tile--urgent' : ''}" data-action="category" data-id="${esc(c.id)}"${n ? '' : ' disabled'}>
        <span class="tile-name">${esc(c.name)}</span>
        <span class="tile-summary">${esc(c.summary)}</span>
        <span class="tile-count">${n ? plural(n, 'message', 'messages') : 'No messages yet'}</span>
      </button>`;
    }).join('')}</div>`;
  }

  function templateRow(t) {
    const meta = [plural(t.required.length, 'required fact', 'required facts')];
    if (t.posture === 'rtq') meta.push('response to query');
    return `<li><button type="button" class="template-row" data-action="template" data-id="${esc(t.id)}">
      <span class="template-title">${esc(t.title)}</span>
      <span class="template-summary">${esc(t.summary)}</span>
      <span class="template-meta">${esc(capFirst(meta.join(', ')))}${t.demo ? ' <span class="badge badge--demo">Demo</span>' : ''}${t.draft ? ' <span class="badge badge--draft">Draft</span>' : ''}</span>
    </button></li>`;
  }

  function recentHTML() {
    const list = store.get(KEYS.events, []).filter(e => e && e.id);
    if (!list.length) return '';
    return `<section class="recent" aria-labelledby="h-recent">
      <h2 id="h-recent">Recent events on this computer</h2>
      <ul class="recent-list">${list.slice(0, 12).map(ev => {
        const t = tplOf(ev);
        const released = (ev.log || []).some(e => e.type === 'released');
        return `<li class="recent-row">
          <span class="recent-when">${esc(stampOf(ev.createdAt))}</span>
          <span class="recent-title">${t ? esc(t.title) : `Library not loaded <span class="muted">(${esc(ev.templateId)})</span>`}</span>
          <span class="status status--${released ? 'released' : 'open'}">${released ? 'Released' : 'In progress'}</span>
          <span class="recent-actions">
            <button type="button" class="btn btn--small" data-action="open-event" data-id="${esc(ev.id)}"${t ? '' : ' disabled'}>Open</button>
            <button type="button" class="btn btn--small btn--quiet" data-action="delete-event" data-id="${esc(ev.id)}">Delete</button>
          </span>
        </li>`;
      }).join('')}</ul>
    </section>`;
  }

  /* ------------------------------------------------------------------ */
  /* Step 2: Decision                                                    */
  /* ------------------------------------------------------------------ */

  function viewDecision() {
    const c = R.registry.categories[state.categoryId];
    if (!c) { state.view = 'situation'; return viewSituation(); }
    const cur = tplOf(state.event);
    const carry = cur
      ? `<label class="carry"><input type="checkbox" id="carry" checked> Carry the facts over from the current event (${esc(cur.title)})</label>`
      : '';
    return `<section aria-labelledby="h-decision">
      <p class="crumb"><button type="button" class="link" data-action="go" data-view="situation">Situations</button><span aria-hidden="true"> / </span>${esc(c.name)}</p>
      <h1 id="h-decision" tabindex="-1">What did command decide?</h1>
      ${carry}
      <ul class="template-list">${templatesIn(c.id).map(templateRow).join('')}</ul>
    </section>`;
  }

  function startEvent(tid, from) {
    const t = R.registry.templates[tid];
    if (!t) return;
    if (from && from.templateId === tid) { go('build'); return; }
    if (state.editing) finishEdit();
    if (state.event) saveNow();
    const now = new Date();
    const ev = {
      id: `evt-${now.getTime().toString(36)}`,
      templateId: tid,
      categoryId: t.category,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      values: {}, na: {}, edits: {}, log: []
    };
    if (from) {
      ev.values = JSON.parse(JSON.stringify(from.values || {}));
      t.optional.forEach(id => { if (from.na && from.na[id]) ev.na[id] = true; });
      ev.follows = from.id;
      ev.followsTitle = (tplOf(from) || {}).title || '';
    }
    state.event = ev;
    state.categoryId = t.category;
    state.product = t.products[0].id;
    state.editing = null;
    persist(true);
    go('build');
  }

  function openEvent(id) {
    const ev = store.get(KEYS.events, []).find(e => e && e.id === id);
    if (!ev) return;
    const t = tplOf(ev);
    if (!t) { toast('Load the library this event came from, then open it again.'); return; }
    ev.values = ev.values || {};
    ev.na = ev.na || {};
    ev.edits = ev.edits || {};
    ev.log = ev.log || [];
    if (state.editing) finishEdit();
    if (state.event) saveNow();
    state.event = ev;
    state.categoryId = ev.categoryId || t.category;
    state.product = t.products[0].id;
    state.editing = null;
    go('build');
  }

  function deleteEvent(id) {
    if (!window.confirm('Delete this event from this computer? Export the record first if you need it.')) return;
    store.set(KEYS.events, store.get(KEYS.events, []).filter(e => e && e.id !== id));
    if (state.event && state.event.id === id) state.event = null;
    render();
    toast('Event deleted.');
  }

  function newEvent() {
    if (state.editing) finishEdit();
    if (state.event) saveNow();
    state.event = null;
    state.categoryId = null;
    state.product = null;
    state.query = '';
    go('situation');
  }

  /* ------------------------------------------------------------------ */
  /* Step 3: Build                                                       */
  /* ------------------------------------------------------------------ */

  function viewBuild() {
    const ev = state.event;
    const t = tplOf(ev);
    if (!t) {
      return `<section><h1 tabindex="-1">Library not loaded</h1>
        <p class="lede">This event uses a message (${esc(ev ? ev.templateId : '')}) from a library that is not loaded on this computer. Load the content pack it came from, then open the event again.</p></section>`;
    }
    const c = R.registry.categories[t.category];
    const posture = t.posture === 'rtq' ? 'Response to query only. Do not post proactively.' : 'Active release.';
    return `<section class="build" aria-labelledby="h-build">
      <div class="build-head">
        <p class="crumb"><button type="button" class="link" data-action="go" data-view="decision">${esc(c ? c.name : 'Decision')}</button><span aria-hidden="true"> / </span>Build</p>
        <h1 id="h-build" tabindex="-1">${esc(t.title)}</h1>
        <p class="build-meta"><span class="posture posture--${t.posture}">${posture}</span>${t.approval ? `<span>Approval: ${esc(t.approval)}.</span>` : ''}${t.demo ? '<span class="badge badge--demo">Demo content, not for release</span>' : ''}${t.draft ? '<span class="badge badge--draft">Draft: get approval before first use</span>' : ''}</p>
        ${t.basis ? `<p class="build-meta basis">${esc(t.basis)}</p>` : ''}
        ${ev.follows ? `<p class="build-meta">Follows the ${esc(ev.followsTitle || 'previous')} event. Facts were carried over; confirm each one is still true.</p>` : ''}
      </div>
      <div class="board" id="board" role="group" aria-label="Facts by owning office"></div>
      <div class="readiness" id="readiness"></div>
      <div class="workbench">
        <div class="facts" id="facts">${factsHTML(t, ev)}</div>
        <section class="products" id="products" aria-label="Products"></section>
      </div>
    </section>`;
  }

  function factsHTML(t, ev) {
    const groups = new Map();
    const add = (id, required) => {
      const code = fieldOf(id).owner;
      if (!groups.has(code)) groups.set(code, []);
      groups.get(code).push({ id, required });
    };
    t.required.forEach(id => add(id, true));
    t.optional.forEach(id => add(id, false));
    return Array.from(groups.keys())
      .sort((a, b) => ownerOf(a).order - ownerOf(b).order)
      .map(code => `<fieldset class="owner-group" id="grp-${esc(code)}">
        <legend><span class="owner-code">${esc(code)}</span> ${esc(ownerOf(code).name)}</legend>
        ${groups.get(code).map(i => fieldHTML(i.id, i.required, ev)).join('')}
      </fieldset>`).join('');
  }

  function fieldHTML(id, required, ev) {
    const f = fieldOf(id);
    const v = ev.values[id];
    const na = !required && !!ev.na[id];
    const dis = na ? ' disabled' : '';
    const iid = `f-${id}`;
    const described = f.help ? ` aria-describedby="${iid}-help"` : '';
    const data = `data-field="${esc(id)}"`;
    let label = `<label for="${iid}">${esc(f.label)}</label>`;
    let control;
    switch (f.type) {
      case 'textarea':
        control = `<textarea id="${iid}" ${data} rows="3"${described}${dis}>${esc(v || '')}</textarea>`;
        break;
      case 'date':
        control = `<div class="inline">
          <input type="date" id="${iid}" ${data} value="${esc(v || '')}"${described}${dis}>
          <button type="button" class="chip" data-action="date" data-offset="0" ${data}${dis}>Today</button>
          <button type="button" class="chip" data-action="date" data-offset="1" ${data}${dis}>Tomorrow</button>
        </div>`;
        break;
      case 'time':
        control = `<input type="text" class="time" id="${iid}" ${data} inputmode="numeric" autocomplete="off" spellcheck="false" maxlength="9" placeholder="HHMM" value="${esc(v ? R.util.milTime(v) : '')}"${described}${dis}>`;
        break;
      case 'select':
        control = `<select id="${iid}" ${data}${described}${dis}><option value="">Choose one</option>${f.options.map(o =>
          `<option value="${esc(o)}"${o === v ? ' selected' : ''}>${esc(capFirst(o))}</option>`).join('')}</select>`;
        break;
      case 'multiselect': {
        const chosen = Array.isArray(v) ? v : [];
        label = `<span class="label" id="${iid}-label">${esc(f.label)}</span>`;
        control = `<div class="checks" role="group" aria-labelledby="${iid}-label"${described}>${f.options.map(o =>
          `<label class="check"><input type="checkbox" ${data} value="${esc(o)}"${chosen.includes(o) ? ' checked' : ''}${dis}> ${esc(capFirst(o))}</label>`).join('')}</div>`;
        break;
      }
      default: {
        const list = f.suggestions.length ? ` list="dl-${esc(id)}"` : '';
        control = `<input type="text" id="${iid}" ${data} value="${esc(v || '')}" autocomplete="off"${list}${described}${dis}>` +
          (f.suggestions.length
            ? `<datalist id="dl-${esc(id)}">${f.suggestions.map(s => `<option value="${esc(s)}"></option>`).join('')}</datalist>`
            : '');
      }
    }
    const tools = [];
    const stds = f.standards || [];
    if (stds.length === 1 && f.autofill) {
      tools.push(`<button type="button" class="link" data-action="standard" data-index="0" ${data}${dis}>Insert standard language</button>`);
    } else if (stds.length) {
      tools.push(`<span class="std-group"><span class="std-label">Insert:</span>${stds.map((x, i) =>
        `<button type="button" class="link" data-action="standard" data-index="${i}" ${data}${dis}>${esc(x.label)}</button>`).join('')}</span>`);
    }
    if (!required) tools.push(`<label class="na"><input type="checkbox" data-action="na" ${data}${na ? ' checked' : ''}> Not applicable</label>`);
    return `<div class="field${required ? ' is-required' : ''}${na ? ' is-na' : ''}" data-wrap="${esc(id)}">
      <div class="field-head">${label}<span class="need">${required ? 'Required' : 'Optional'}</span></div>
      ${control}
      ${f.help ? `<p class="help" id="${iid}-help">${esc(f.help)}</p>` : ''}
      ${tools.length ? `<div class="field-tools">${tools.join('')}</div>` : ''}
    </div>`;
  }

  function refreshBuild() {
    const ev = state.event;
    const t = tplOf(ev);
    if (!t || !$('#board')) return;
    const r = readiness(t, ev);
    $('#board').innerHTML = boardHTML(r);
    $('#board').style.setProperty('--n', String(r.groups.length));
    $('#readiness').innerHTML = readinessHTML(r);
    const ctx = ctxOf(ev, t);
    t.required.forEach(id => {
      const w = $(`[data-wrap="${cssId(id)}"]`);
      if (w) w.classList.toggle('is-missing', !R.present(ctx, id));
    });
    renderProducts();
  }

  let refreshQueued = false;
  function scheduleRefresh() {
    if (refreshQueued) return;
    refreshQueued = true;
    requestAnimationFrame(() => { refreshQueued = false; refreshBuild(); });
  }

  function boardHTML(r) {
    return r.groups.map(g => {
      let st;
      let line;
      if (g.reqTotal && g.reqIn < g.reqTotal) { st = 'missing'; line = `${g.reqIn} of ${g.reqTotal} in`; }
      else if (g.reqTotal) { st = 'in'; line = 'All in'; }
      else { st = 'optional'; line = g.optOpen ? 'Optional' : 'Confirmed'; }
      const extra = g.optOpen && g.reqTotal ? `<span class="cell-extra">+${g.optOpen} optional</span>` : '';
      const spoken = `${g.name}: ${line}${g.optOpen ? `, ${plural(g.optOpen, 'optional item', 'optional items')} open` : ''}. Go to these facts.`;
      return `<button type="button" class="cell cell--${st}" data-action="jump" data-owner="${esc(g.code)}" aria-label="${esc(spoken)}">
        <span class="cell-code">${esc(g.code)}</span>
        <span class="cell-name">${esc(g.name)}</span>
        <span class="cell-state">${line}${extra}</span>
      </button>`;
    }).join('');
  }

  function readinessHTML(r) {
    const done = r.reqIn === r.reqTotal;
    const pct = r.reqTotal ? Math.round((r.reqIn / r.reqTotal) * 100) : 100;
    const opt = r.optOpen ? ` ${plural(r.optOpen, 'optional item', 'optional items')} not confirmed.` : '';
    const text = done ? `All required facts are in.${opt}` : `${r.reqIn} of ${r.reqTotal} required facts in.${opt}`;
    const fill = fillableFields(tplOf(state.event), state.event).length;
    return `<p class="readiness-text">${text}</p>
      <div class="meter" role="progressbar" aria-label="Required facts in" aria-valuemin="0" aria-valuemax="${r.reqTotal}" aria-valuenow="${r.reqIn}"><span style="width:${pct}%"></span></div>
      <div class="readiness-actions">
        <button type="button" class="btn" data-action="fill-standard"${fill ? '' : ' disabled'}>Insert standard language${fill ? ` (${fill})` : ''}</button>
        <button type="button" class="btn" data-action="rfi"${!done || r.optOpen ? '' : ' disabled'}>Draft RFI</button>
        <button type="button" class="btn${done ? ' btn--primary' : ''}" data-action="go" data-view="record">Open record</button>
      </div>`;
  }

  /* Products ----------------------------------------------------------- */

  // Gaps copy out as [[REPORT TIME]]. Double brackets keep subject tags like [INFO] from counting.
  const BRACKETS = /\[\[[^\[\]\n]{1,80}\]\]/g;
  const countBrackets = s => (String(s).match(BRACKETS) || []).length;
  const markBracketsHTML = html => html.replace(/\[\[([^\[\]<>\n]{1,80})\]\]/g, '<mark class="gap">$1</mark>');
  const markBrackets = s => markBracketsHTML(esc(s));

  function productState(p, ev, ctx) {
    const gen = R.render(p.text, ctx);
    const genPlain = R.toPlain(gen.raw);
    const edit = ev.edits[p.id];
    const text = edit ? edit.text : genPlain;
    return {
      p, gen, genPlain, edit, text,
      html: edit ? markBrackets(edit.text) : markBracketsHTML(R.toHTML(gen.raw)),
      gaps: countBrackets(text),
      stale: !!edit && edit.base !== genPlain
    };
  }

  function currentProduct() {
    const ev = state.event;
    const t = tplOf(ev);
    const p = t.products.find(x => x.id === state.product) || t.products[0];
    return productState(p, ev, ctxOf(ev, t));
  }

  function renderProducts() {
    const host = $('#products');
    const ev = state.event;
    const t = tplOf(ev);
    if (!host || !t) return;
    const ctx = ctxOf(ev, t);
    const all = t.products.map(p => productState(p, ev, ctx));
    let cur = all.find(s => s.p.id === state.product);
    if (!cur) { cur = all[0]; state.product = cur.p.id; }
    const editing = state.editing === cur.p.id;

    // While the text is being edited, leave the textarea alone.
    if (editing && $('#product-edit')) {
      $('#product-tabs').innerHTML = tabsHTML(all);
      $('#product-notice').innerHTML = noticeHTML(cur);
      updateCount(cur);
      return;
    }

    host.innerHTML = `<div class="tabs" id="product-tabs" role="tablist" aria-label="Products">${tabsHTML(all)}</div>
      <div class="product-panel" role="tabpanel" aria-labelledby="tab-${esc(cur.p.id)}">
        <div class="product-head">
          <span class="audience audience--${cur.p.audience}">${cur.p.audience === 'public' ? 'Public' : 'Internal'}</span>
          <span class="count" id="product-count"></span>
        </div>
        <div id="product-notice">${noticeHTML(cur)}</div>
        ${editing
          ? `<textarea class="product-edit" id="product-edit" aria-label="${esc(cur.p.label)} text">${esc(cur.text)}</textarea>`
          : `<div class="product-text" id="product-text">${cur.html}</div>`}
        <div class="product-actions">
          <button type="button" class="btn btn--primary" data-action="copy">Copy text</button>
          ${editing
            ? '<button type="button" class="btn" data-action="done-edit">Done editing</button>'
            : '<button type="button" class="btn" data-action="edit">Edit text</button>'}
          ${cur.edit ? '<button type="button" class="btn btn--quiet" data-action="reset-edit">Reset to generated</button>' : ''}
        </div>
      </div>`;
    updateCount(cur);
  }

  function tabsHTML(all) {
    return all.map(s => {
      const sel = s.p.id === state.product;
      return `<button type="button" role="tab" id="tab-${esc(s.p.id)}" class="tab" aria-selected="${sel}" data-action="tab" data-id="${esc(s.p.id)}">` +
        `${esc(s.p.label)}` +
        `${s.gaps ? `<span class="tab-gaps">${s.gaps}<span class="visually-hidden"> ${s.gaps === 1 ? 'gap' : 'gaps'}</span></span>` : ''}` +
        `${s.edit ? '<span class="tab-edited">Edited</span>' : ''}</button>`;
    }).join('');
  }

  function noticeHTML(s) {
    if (s.stale) return '<p class="notice">Facts changed after you edited this text. Your edits are kept. Reset to generated to pick up the new facts.</p>';
    if (!s.edit && s.gaps) return `<p class="gap-note">${plural(s.gaps, 'gap', 'gaps')}. Highlighted items fill in as the facts come in.</p>`;
    return '';
  }

  function updateCount(s) {
    const el = $('#product-count');
    if (!el) return;
    const ta = state.editing === s.p.id ? $('#product-edit') : null;
    const len = (ta ? ta.value : s.text).length;
    if (s.p.limit) {
      el.textContent = `${len} of ${s.p.limit} characters`;
      el.classList.toggle('over', len > s.p.limit);
    } else {
      el.textContent = plural(len, 'character', 'characters');
      el.classList.remove('over');
    }
  }

  function startEdit() {
    const s = currentProduct();
    if (!state.event.edits[s.p.id]) state.event.edits[s.p.id] = { text: s.genPlain, base: s.genPlain };
    state.editing = s.p.id;
    renderProducts();
    const ta = $('#product-edit');
    if (ta) { ta.focus(); ta.setSelectionRange(0, 0); ta.scrollTop = 0; }
  }

  function finishEdit() {
    const id = state.editing;
    const e = id && state.event ? state.event.edits[id] : null;
    if (e && e.text === e.base) delete state.event.edits[id];
    state.editing = null;
    persist();
  }

  async function copyProduct() {
    const s = currentProduct();
    const ta = state.editing === s.p.id ? $('#product-edit') : null;
    const text = ta ? ta.value : s.text;
    const ok = await copyText(text);
    const gaps = countBrackets(text);
    toast(!ok ? 'Copy was blocked. Select the text and copy it manually.'
      : gaps ? `Copied. The text still has ${plural(gaps, 'gap', 'gaps')} in brackets.` : 'Copied.');
  }

  /* Field actions ------------------------------------------------------- */

  function onFact(el) {
    const ev = state.event;
    if (!ev) return;
    const id = el.dataset.field;
    const f = fieldOf(id);
    if (f.type === 'multiselect') {
      ev.values[id] = $$(`input[type="checkbox"][data-field="${cssId(id)}"]:not([data-action])`)
        .filter(x => x.checked).map(x => x.value);
    } else if (f.type === 'time') {
      ev.values[id] = R.normalizeTime(el.value) || '';
      el.classList.remove('invalid');
      el.removeAttribute('aria-invalid');
    } else {
      ev.values[id] = el.value;
    }
    persist();
    scheduleRefresh();
  }

  function onNA(el) {
    const ev = state.event;
    const id = el.dataset.field;
    if (el.checked) ev.na[id] = true; else delete ev.na[id];
    const wrap = el.closest('.field');
    $$('input:not([data-action]), textarea, select, button', wrap).forEach(x => { x.disabled = el.checked; });
    wrap.classList.toggle('is-na', el.checked);
    persist();
    scheduleRefresh();
  }

  function insertStandard(id, index) {
    const f = fieldOf(id);
    const std = (f.standards || [])[index || 0];
    const el = document.getElementById(`f-${id}`);
    if (!std || !el) return;
    el.value = std.text;
    state.event.values[id] = std.text;
    persist();
    scheduleRefresh();
    el.focus();
    // Put the cursor on the first [[placeholder]], if the standard text has one.
    const at = std.text.indexOf('[[');
    if (at >= 0 && el.setSelectionRange) el.setSelectionRange(at, std.text.indexOf(']]', at) + 2);
  }

  // Empty fields that have exactly one standard text. Lists of options are left to a person.
  function fillableFields(t, ev) {
    const ctx = ctxOf(ev, t);
    return t.required.concat(t.optional).filter(id => {
      const f = fieldOf(id);
      return f.autofill && !ctx.na[id] && !R.present(ctx, id);
    });
  }

  function fillStandard() {
    const ev = state.event;
    const t = tplOf(ev);
    if (!t) return;
    const ids = fillableFields(t, ev);
    ids.forEach(id => {
      const text = fieldOf(id).standards[0].text;
      ev.values[id] = text;
      const el = document.getElementById(`f-${id}`);
      if (el) el.value = text;
    });
    persist();
    scheduleRefresh();
    toast(ids.length ? `Standard language inserted in ${plural(ids.length, 'field', 'fields')}. Review it before release.` : 'Every field with standard language is already filled.');
  }

  function setDate(id, offset) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const el = document.getElementById(`f-${id}`);
    if (el) el.value = isoDate(d);
    state.event.values[id] = isoDate(d);
    persist();
    scheduleRefresh();
  }

  function jumpTo(code) {
    const g = document.getElementById(`grp-${code}`);
    if (!g) return;
    g.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
    const target = g.querySelector('.field.is-missing input:not([data-action]):not(:disabled), .field.is-missing textarea, .field.is-missing select') ||
      g.querySelector('input:not([data-action]):not(:disabled), textarea:not(:disabled), select:not(:disabled)');
    if (target) target.focus({ preventScroll: true });
  }

  /* RFI ----------------------------------------------------------------- */

  function rfiText(t, ev, by) {
    const r = readiness(t, ev);
    const need = r.groups.filter(g => g.missing.length);
    const open = r.groups.filter(g => g.open.length);
    const name = t.title.toLowerCase();
    const L = [`RFI: ${t.title}`, `From: ${office()}`];
    if (by) L.push(`Needed by: ${R.util.milTime(by)}`);
    if (need.length) {
      L.push('', `We need the following to release the ${name} message.`);
      need.forEach(g => {
        L.push('', `${g.name} (${g.code}):`);
        g.missing.forEach(id => L.push(`- ${fieldOf(id).label}`));
      });
    }
    if (open.length) {
      L.push('', need.length ? 'Please also confirm, if applicable:' : `Please confirm, if applicable, for the ${name} message:`);
      open.forEach(g => g.open.forEach(id => L.push(`- ${fieldOf(id).label} (${g.code})`)));
    }
    L.push('', 'Reply with the information, or "not applicable," for each item.');
    return L.join('\n');
  }

  function rfiOwners() {
    const r = readiness(tplOf(state.event), state.event);
    return r.groups.filter(g => g.missing.length || g.open.length).map(g => g.code);
  }

  function openRfi() {
    const t = tplOf(state.event);
    if (!t) return;
    $('#rfi-text').value = rfiText(t, state.event, R.normalizeTime($('#rfi-by').value));
    state.rfiDirty = false;
    $('#rfi-dialog').showModal();
  }

  async function copyRfi(andLog) {
    const ok = await copyText($('#rfi-text').value);
    if (!ok) { toast('Copy was blocked. Select the text and copy it manually.'); return; }
    if (!andLog) { toast('Copied.'); return; }
    const owners = rfiOwners();
    addLog('rfi', owners.length ? `To ${owners.join(', ')}` : '');
    $('#rfi-dialog').close();
    toast('Copied and logged as sent.');
  }

  /* ------------------------------------------------------------------ */
  /* Step 4: Record                                                      */
  /* ------------------------------------------------------------------ */

  function summarize(ev) {
    const log = sortedLog(ev);
    const start = log.find(e => e.type === 'decision');
    const rel = log.find(e => e.type === 'released');
    // A waiting window opens at the first RFI and runs to the last information
    // received before PA's next action.
    let waiting = 0;
    let open = null;
    let lastInfo = null;
    const close = () => {
      if (open && lastInfo) waiting += minutesBetween(open, lastInfo);
      open = null;
      lastInfo = null;
    };
    log.forEach(e => {
      if (e.type === 'rfi') { if (!open) { open = e.at; lastInfo = null; } }
      else if (e.type === 'info') { if (open) lastInfo = e.at; }
      else if (PA_ACTIONS.has(e.type)) close();
    });
    const pending = !!open && !lastInfo;
    close();
    return { start, rel, waiting, pending, total: start && rel ? minutesBetween(start.at, rel.at) : null };
  }

  function summaryText(s) {
    if (!s.start) {
      return 'Log when the decision reached PA and when you released. The record shows the time in between, including time spent waiting on other offices.';
    }
    if (!s.rel) {
      return `Decision reached PA at ${hhmm(s.start.at)}. Not released yet.` +
        `${s.pending ? ' An RFI is open.' : ''}` +
        `${s.waiting ? ` ${plural(s.waiting, 'minute', 'minutes')} spent waiting on other offices so far.` : ''}`;
    }
    return `Decision reached PA at ${hhmm(s.start.at)}. Released at ${hhmm(s.rel.at)}. ` +
      `${plural(s.total, 'minute', 'minutes')} total${s.waiting ? `, ${s.waiting} of them waiting on other offices` : ''}.`;
  }

  function viewRecord() {
    const ev = state.event;
    const t = tplOf(ev);
    if (!t) return viewBuild();
    const ctx = ctxOf(ev, t);
    return `<section class="record" aria-labelledby="h-record">
      <p class="crumb"><button type="button" class="link" data-action="go" data-view="build">${esc(t.title)}</button><span aria-hidden="true"> / </span>Record</p>
      <h1 id="h-record" tabindex="-1">Event record</h1>
      <p class="summary" id="summary">${esc(summaryText(summarize(ev)))}</p>
      <div class="stamps" role="group" aria-labelledby="stamps-label">
        <span class="stamps-label" id="stamps-label">Log it now:</span>
        ${LOG_TYPES.map(l => `<button type="button" class="btn btn--small" data-action="stamp" data-type="${l.id}">${l.label}</button>`).join('')}
      </div>
      <ol class="log" id="log">${logHTML(sortedLog(ev))}</ol>
      <div class="exports">
        <button type="button" class="btn btn--primary" data-action="export-txt">Export record (.txt)</button>
        <button type="button" class="btn" data-action="export-csv">Export timeline (.csv)</button>
      </div>
      <p class="help">Exports save to this computer. File them with the office's official records.</p>
      <h2>Products as they stand</h2>
      <div class="final-list">${t.products.map(p => {
        const st = productState(p, ev, ctx);
        return `<article class="final">
          <header class="final-head">
            <h3>${esc(p.label)}</h3>
            ${st.edit ? '<span class="tab-edited">Edited</span>' : ''}
            ${st.gaps ? `<span class="tab-gaps">${plural(st.gaps, 'gap', 'gaps')}</span>` : ''}
            <button type="button" class="btn btn--small" data-action="copy-final" data-id="${esc(p.id)}">Copy text</button>
          </header>
          <div class="product-text">${st.html}</div>
        </article>`;
      }).join('')}</div>
    </section>`;
  }

  function logHTML(log) {
    if (!log.length) return '<li class="log-empty">Nothing logged yet. Start with Decision received when the decision reaches PA.</li>';
    return log.map(e => {
      const label = LOG_LABEL[e.type] || e.type;
      return `<li class="log-row" data-id="${esc(e.id)}">
        <input type="text" class="time log-time" data-log="time" value="${hhmm(e.at)}" inputmode="numeric" maxlength="9" autocomplete="off" aria-label="Time for ${esc(label)}">
        <span class="log-type log-type--${esc(e.type)}">${esc(label)}</span>
        <input type="text" class="log-note" data-log="note" value="${esc(e.note || '')}" placeholder="Who and what" autocomplete="off" aria-label="Note for ${esc(label)}">
        <button type="button" class="btn btn--small btn--quiet" data-action="log-delete">Remove</button>
      </li>`;
    }).join('');
  }

  const findLog = el => {
    const row = el.closest('.log-row');
    return row && state.event ? state.event.log.find(x => x.id === row.dataset.id) : null;
  };

  function addLog(type, note) {
    state.event.log.push({
      id: `l${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      type,
      at: new Date().toISOString(),
      note: note || ''
    });
    persist(true);
  }

  function rerenderLog(focusNewest) {
    const ev = state.event;
    if (!$('#log')) return;
    const active = document.activeElement;
    const row = active && active.closest ? active.closest('.log-row') : null;
    const keep = row ? { id: row.dataset.id, part: active.dataset.log } : null;
    $('#log').innerHTML = logHTML(sortedLog(ev));
    $('#summary').textContent = summaryText(summarize(ev));
    let target = null;
    if (focusNewest) {
      const newest = ev.log[ev.log.length - 1];
      target = newest && $(`.log-row[data-id="${cssId(newest.id)}"] [data-log="note"]`);
    } else if (keep && keep.part) {
      target = $(`.log-row[data-id="${cssId(keep.id)}"] [data-log="${keep.part}"]`);
    }
    if (target) target.focus();
  }

  function stampNow(type) {
    addLog(type, '');
    rerenderLog(true);
    toast(`${LOG_LABEL[type]} logged at ${hhmm(new Date().toISOString())}.`);
  }

  function onLogTime(el) {
    const e = findLog(el);
    if (!e) return;
    const n = R.normalizeTime(el.value);
    if (!n) { el.value = hhmm(e.at); toast('Enter a time like 0842.'); return; }
    const d = new Date(e.at);
    d.setHours(+n.slice(0, 2), +n.slice(3, 5), 0, 0);
    el.value = hhmm(d.toISOString());
    if (d.toISOString() === e.at) return;
    e.at = d.toISOString();
    persist(true);
    setTimeout(() => rerenderLog(false), 0);
  }

  function deleteLog(id) {
    state.event.log = state.event.log.filter(e => e.id !== id);
    persist(true);
    rerenderLog(false);
  }

  /* Exports ------------------------------------------------------------- */

  function download(filename, text, mime) {
    const blob = new Blob([text], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function factDisplay(id, ev, t) {
    const ctx = ctxOf(ev, t);
    if (ctx.na[id]) return 'Not applicable';
    if (!R.present(ctx, id)) return 'Not provided';
    const f = fieldOf(id);
    const v = ev.values[id];
    if (f.type === 'date') return R.util.milDate(v);
    if (f.type === 'time') return R.util.milTime(v);
    if (Array.isArray(v)) return R.util.apList(v);
    return String(v).trim();
  }

  function recordText(ev) {
    const t = tplOf(ev);
    const c = R.registry.categories[t.category];
    const lib = R.registry.libraries.find(l => l.id === t.libraryId);
    const s = summarize(ev);
    const ctx = ctxOf(ev, t);
    const log = sortedLog(ev);
    const L = [
      'EVENT RECORD',
      `Office: ${office()}`,
      `Event: ${t.title} (${c ? c.name : t.category})`,
      `Started: ${stampOf(ev.createdAt)}`
    ];
    if (ev.follows) L.push(`Follows: ${ev.followsTitle || ev.follows}`);
    L.push(`Library: ${lib ? `${lib.name}${lib.version ? ` v${lib.version}` : ''}` : t.libraryId}${t.demo ? ' (demo content, not for release)' : ''}`);
    L.push(`Exported: ${stampOf(new Date().toISOString())}`, '', 'TIMELINE');
    if (!log.length) L.push('Nothing logged.');
    log.forEach(e => L.push(`${hhmm(e.at)}  ${(LOG_LABEL[e.type] || e.type).padEnd(21)} ${e.note || ''}`.trimEnd()));
    L.push('', s.start ? summaryText(s) : 'Decision time not logged.', '', 'FACTS');
    readiness(t, ev).groups.forEach(g => {
      L.push('', `${g.name} (${g.code})`);
      t.required.concat(t.optional)
        .filter(id => fieldOf(id).owner === g.code)
        .forEach(id => L.push(`  ${fieldOf(id).label}: ${factDisplay(id, ev, t)}`));
    });
    L.push('', 'PRODUCTS');
    t.products.forEach(p => {
      const st = productState(p, ev, ctx);
      const flags = [st.edit ? 'edited' : '', st.gaps ? plural(st.gaps, 'gap', 'gaps') : ''].filter(Boolean).join(', ');
      L.push('', `[${p.label}]${flags ? ` (${flags})` : ''}`, st.text);
    });
    return L.join('\n').replace(/\r?\n/g, '\r\n');
  }

  function csvCell(v) {
    let s = String(v === undefined || v === null ? '' : v);
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function timelineCSV(ev) {
    const t = tplOf(ev);
    const rows = [['event_id', 'event', 'date', 'time', 'entry', 'note']];
    sortedLog(ev).forEach(e => {
      const d = new Date(e.at);
      rows.push([ev.id, t.title, isoDate(d), `${pad(d.getHours())}:${pad(d.getMinutes())}`, LOG_LABEL[e.type] || e.type, e.note || '']);
    });
    return '\uFEFF' + rows.map(r => r.map(csvCell).join(',')).join('\r\n');
  }

  /* ------------------------------------------------------------------ */
  /* Library and content packs                                          */
  /* ------------------------------------------------------------------ */

  function openLibrary() {
    renderLibraryDialog();
    const d = $('#library-dialog');
    if (!d.open) d.showModal();
  }

  function renderLibraryDialog() {
    const libs = R.registry.libraries;
    $('#library-list').innerHTML = libs.length ? libs.map(l => `<li>
      <span class="lib-name">${esc(l.name)}${l.version ? ` <span class="muted">v${esc(l.version)}</span>` : ''}</span>
      ${l.demo ? '<span class="badge badge--demo">Demo</span>' : ''}
      <span class="lib-meta">${plural(l.templateIds.length, 'message', 'messages')}, ${esc(SOURCE_LABEL[l.source] || l.source)}</span>
      ${l.note ? `<span class="lib-note">${esc(l.note)}</span>` : ''}
    </li>`).join('') : '<li>No library loaded.</li>';
    const toggle = $('#show-demo-row');
    toggle.hidden = !hasLive();
    $('#show-demo').checked = state.showDemo;
    const w = R.check();
    $('#library-warnings').innerHTML = w.length
      ? `<details><summary>${plural(w.length, 'authoring warning', 'authoring warnings')}</summary><ul>${w.map(x =>
        `<li><code>${esc(x.template)}</code> ${esc(x.message)}</li>`).join('')}</ul></details>`
      : '<p class="muted">No authoring warnings.</p>';
  }

  function loadPack(file) {
    const reader = new FileReader();
    reader.onload = () => {
      let data;
      try { data = JSON.parse(String(reader.result)); }
      catch (err) { toast('That file is not valid JSON. Check it in a JSON validator, then try again.'); return; }
      let rec;
      try { rec = R.registerLibrary(data, 'imported'); }
      catch (err) { toast(err.message); return; }
      let msg = `Loaded ${rec.name}: ${plural(rec.templateIds.length, 'message', 'messages')}.`;
      const remember = $('#remember-pack');
      if (remember && remember.checked) {
        const packs = store.get(KEYS.packs, []).filter(p => p && p.id !== rec.id);
        packs.push({ id: rec.id, json: String(reader.result) });
        if (!store.set(KEYS.packs, packs)) msg += ' This browser would not remember it, so load it again next time.';
      }
      if (rec.notes.length) msg += ` ${plural(rec.notes.length, 'warning', 'warnings')}; see the library.`;
      render();
      if ($('#library-dialog').open) renderLibraryDialog();
      toast(msg);
    };
    reader.onerror = () => toast('That file could not be read.');
    reader.readAsText(file);
  }

  function loadRememberedPacks() {
    store.get(KEYS.packs, []).forEach(p => {
      try { R.registerLibrary(JSON.parse(p.json), 'remembered'); } catch (e) { /* skip a damaged pack */ }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Clipboard and toast                                                 */
  /* ------------------------------------------------------------------ */

  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) { /* fall back below */ }
    // Inside a modal dialog, the fallback textarea must live in the dialog.
    const host = document.querySelector('dialog[open]') || document.body;
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    host.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  }

  let toastTimer = null;
  function toast(msg) {
    const el = $('#toast');
    const host = document.querySelector('dialog[open]') || document.body;
    if (el.parentNode !== host) host.appendChild(el);
    el.textContent = msg;
    el.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-on'), 3400);
  }

  /* ------------------------------------------------------------------ */
  /* Events                                                              */
  /* ------------------------------------------------------------------ */

  function onClick(e) {
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled) return;
    const ev = state.event;
    switch (el.dataset.action) {
      case 'go': go(el.dataset.view); break;
      case 'category': state.categoryId = el.dataset.id; go('decision'); break;
      case 'template': {
        const carry = $('#carry');
        startEvent(el.dataset.id, carry && carry.checked ? state.event : null);
        break;
      }
      case 'open-event': openEvent(el.dataset.id); break;
      case 'delete-event': deleteEvent(el.dataset.id); break;
      case 'new-event': newEvent(); break;
      case 'jump': jumpTo(el.dataset.owner); break;
      case 'standard': insertStandard(el.dataset.field, Number(el.dataset.index) || 0); break;
      case 'fill-standard': fillStandard(); break;
      case 'date': setDate(el.dataset.field, Number(el.dataset.offset) || 0); break;
      case 'tab': {
        if (state.editing) finishEdit();
        state.product = el.dataset.id;
        renderProducts();
        const tab = $(`#tab-${cssId(state.product)}`);
        if (tab) tab.focus();
        break;
      }
      case 'copy': copyProduct(); break;
      case 'edit': startEdit(); break;
      case 'done-edit': finishEdit(); renderProducts(); break;
      case 'reset-edit':
        if (ev) {
          delete ev.edits[state.product];
          state.editing = null;
          persist();
          renderProducts();
          toast('Reset to the generated text.');
        }
        break;
      case 'rfi': openRfi(); break;
      case 'rfi-copy': copyRfi(false); break;
      case 'rfi-copy-log': copyRfi(true); break;
      case 'stamp': stampNow(el.dataset.type); break;
      case 'log-delete': deleteLog(el.closest('.log-row').dataset.id); break;
      case 'copy-final': {
        const t = tplOf(ev);
        const p = t.products.find(x => x.id === el.dataset.id);
        copyText(productState(p, ev, ctxOf(ev, t)).text)
          .then(ok => toast(ok ? 'Copied.' : 'Copy was blocked. Select the text and copy it manually.'));
        break;
      }
      case 'export-txt': {
        const t = tplOf(ev);
        download(`rcf-${slug(t.title)}-${fileStamp()}.txt`, recordText(ev), 'text/plain');
        toast('Record exported.');
        break;
      }
      case 'export-csv': {
        const t = tplOf(ev);
        download(`rcf-${slug(t.title)}-${fileStamp()}-timeline.csv`, timelineCSV(ev), 'text/csv');
        toast('Timeline exported.');
        break;
      }
      case 'library': openLibrary(); break;
      case 'load-pack': $('#pack-input').click(); break;
      case 'forget-packs':
        store.set(KEYS.packs, []);
        toast('Remembered packs cleared. They stay loaded until you reload the page.');
        break;
      case 'close-dialog': el.closest('dialog').close(); break;
      default: break;
    }
  }

  function onInput(e) {
    const el = e.target;
    if (el.id === 'find') {
      state.query = el.value;
      $('#situation-body').innerHTML = situationBody();
      return;
    }
    if (el.id === 'product-edit') {
      const edit = state.event.edits[state.editing];
      if (edit) { edit.text = el.value; persist(); }
      renderProducts();
      return;
    }
    if (el.id === 'rfi-text') { state.rfiDirty = true; return; }
    if (el.id === 'rfi-by') {
      if (!state.rfiDirty) $('#rfi-text').value = rfiText(tplOf(state.event), state.event, R.normalizeTime(el.value));
      return;
    }
    if (el.dataset && el.dataset.log === 'note') {
      const entry = findLog(el);
      if (entry) { entry.note = el.value; persist(); }
      return;
    }
    if (el.matches('[data-field]:not([data-action])') && el.type !== 'checkbox') onFact(el);
  }

  function onChange(e) {
    const el = e.target;
    if (el.matches('input[type="checkbox"][data-action="na"]')) { onNA(el); return; }
    if (el.matches('input[type="checkbox"][data-field]')) { onFact(el); return; }
    if (el.id === 'show-demo') {
      state.showDemo = el.checked;
      store.set(KEYS.showDemo, state.showDemo);
      render();
      return;
    }
    if (el.id === 'pack-input') {
      const f = el.files && el.files[0];
      if (f) loadPack(f);
      el.value = '';
    }
  }

  function onFocusOut(e) {
    const el = e.target;
    if (!el.matches) return;
    if (el.matches('input.time[data-field]')) {
      const raw = el.value.trim();
      const n = R.normalizeTime(raw);
      if (raw && !n) {
        el.classList.add('invalid');
        el.setAttribute('aria-invalid', 'true');
        toast('Enter a time like 0930 or 1530.');
      } else if (n) {
        el.value = R.util.milTime(n);
      }
      return;
    }
    if (el.matches('input[data-log="time"]')) onLogTime(el);
  }

  function init() {
    state.showDemo = !!store.get(KEYS.showDemo, false);
    loadRememberedPacks();
    const warnings = R.check();
    if (warnings.length && window.console) console.warn('[RCF] Library authoring warnings:', warnings);
    document.addEventListener('click', onClick);
    document.addEventListener('input', onInput);
    document.addEventListener('change', onChange);
    document.addEventListener('focusout', onFocusOut);
    window.addEventListener('pagehide', saveNow);
    render();
  }

  init();
})();
