/*
 * Dover AFB Rapid Communication Framework
 * engine.js: library registry, template rendering, formatting and validation.
 *
 * No dependencies and no network access. Runs from a local folder (file://)
 * or any static host. Exposes one global: RCF.
 */
(function (global) {
  'use strict';

  const GAP_OPEN = '\u0001';
  const GAP_CLOSE = '\u0002';
  const OMIT = '\u0003';
  const GAP_RE = new RegExp(GAP_OPEN + '([^' + GAP_CLOSE + ']*)' + GAP_CLOSE, 'g');
  const FIELD_TYPES = ['text', 'textarea', 'date', 'time', 'select', 'multiselect'];
  const TYPE_FORMATS = ['ap', 'apday', 'day', 'mil', 'milshort', 'milyy'];
  // Values the engine supplies itself. {{today}} is the date the text is built.
  const BUILTIN_FIELDS = {
    today: { id: 'today', label: 'Today', owner: '', type: 'date', options: [], suggestions: [], standard: '', standards: [], help: '' }
  };

  const registry = {
    office: '',
    libraries: [],
    owners: {},
    fields: {},
    categories: {},
    templates: {}
  };
  let ownerSeq = 0;
  let categorySeq = 0;
  const listeners = [];

  /* ------------------------------------------------------------------ */
  /* Registration                                                        */
  /* ------------------------------------------------------------------ */

  function detectSource() {
    try {
      const s = global.document && global.document.currentScript;
      if (s && /\/content\/local\//.test(s.src || '')) return 'local';
    } catch (e) { /* not in a browser */ }
    return 'bundled';
  }

  function registerLibrary(lib, source) {
    if (!lib || typeof lib !== 'object' || Array.isArray(lib)) {
      throw new Error('A content pack must be a single JSON object.');
    }
    if (!lib.id || !lib.name) throw new Error('A content pack needs an "id" and a "name".');
    if (!Array.isArray(lib.templates)) throw new Error('A content pack needs a "templates" list.');

    const libId = String(lib.id);
    const notes = [];
    const src = source || detectSource();

    // Loading a library again replaces the templates it registered before.
    const prior = registry.libraries.findIndex(l => l.id === libId);
    if (prior >= 0) {
      registry.libraries[prior].templateIds.forEach(id => {
        if (registry.templates[id] && registry.templates[id].libraryId === libId) delete registry.templates[id];
      });
      registry.libraries.splice(prior, 1);
    }

    if (lib.office) registry.office = String(lib.office);

    const live = !lib.demo;
    // An office (non-demo) library sets the order of the inputs board for the owners it lists.
    // Demo content never overrides an owner, category or field an office library defined.
    Object.keys(lib.owners || {}).forEach((code, i) => {
      const def = lib.owners[code];
      const d = typeof def === 'string' ? { name: def } : (def || {});
      const existing = registry.owners[code];
      if (existing && existing.live && !live) return;
      registry.owners[code] = {
        code,
        name: d.name || (existing && existing.name) || code,
        order: live ? i - 10000 : (existing ? existing.order : ownerSeq++),
        live: live || !!(existing && existing.live)
      };
    });

    (lib.categories || []).forEach(c => {
      if (!c || !c.id) return;
      const existing = registry.categories[c.id];
      if (existing && existing.live && !live) return;
      registry.categories[c.id] = {
        live: live || !!(existing && existing.live),
        id: String(c.id),
        name: c.name || (existing && existing.name) || String(c.id),
        summary: c.summary || (existing && existing.summary) || '',
        tone: c.tone || (existing && existing.tone) || 'standard',
        order: existing ? existing.order : categorySeq++
      };
    });

    Object.keys(lib.fields || {}).forEach(id => {
      const d = lib.fields[id] || {};
      if (d.type && !FIELD_TYPES.includes(d.type)) {
        notes.push(`Field "${id}" has unknown type "${d.type}"; treated as text.`);
      }
      const existing = registry.fields[id];
      if (existing && existing.live && !live) return;
      const standards = normStandards(d.standard);
      registry.fields[id] = {
        live,
        standards,
        // One plain standard text can be inserted with the "insert all" button.
        // A list of options always needs a person to pick one.
        autofill: typeof d.standard === 'string' && d.standard.trim() !== '' && d.autofill !== false,
        id,
        label: d.label || id,
        owner: d.owner || 'PA',
        type: FIELD_TYPES.includes(d.type) ? d.type : 'text',
        help: d.help ? String(d.help) : '',
        options: Array.isArray(d.options) ? d.options.map(String) : [],
        suggestions: Array.isArray(d.suggestions) ? d.suggestions.map(String) : [],
        standard: standards.length ? standards[0].text : ''
      };
    });

    const templateIds = [];
    lib.templates.forEach((t, i) => {
      const products = t && Array.isArray(t.products)
        ? t.products.filter(p => p && p.id && typeof p.text === 'string')
        : [];
      if (!t || !t.id || !t.title || !t.category || !products.length) {
        notes.push(`Template ${t && t.id ? `"${t.id}"` : `#${i + 1}`} skipped: it needs id, title, category and at least one product with text.`);
        return;
      }
      if (!registry.categories[t.category]) {
        registry.categories[t.category] = {
          id: String(t.category), name: String(t.category), summary: '', tone: 'standard', order: categorySeq++
        };
        notes.push(`Template "${t.id}" uses category "${t.category}", which is not defined. It was created with a plain name.`);
      }
      registry.templates[t.id] = {
        id: String(t.id),
        category: String(t.category),
        title: String(t.title),
        summary: t.summary ? String(t.summary) : '',
        posture: t.posture === 'rtq' ? 'rtq' : 'active',
        approval: t.approval ? String(t.approval) : '',
        basis: t.basis ? String(t.basis) : '',
        draft: !!t.draft,
        required: Array.isArray(t.required) ? t.required.map(String) : [],
        optional: Array.isArray(t.optional) ? t.optional.map(String) : [],
        products: products.map(p => ({
          id: String(p.id),
          label: p.label ? String(p.label) : String(p.id),
          audience: p.audience === 'public' ? 'public' : 'internal',
          limit: Number(p.limit) > 0 ? Number(p.limit) : 0,
          text: p.text
        })),
        libraryId: libId,
        demo: !!lib.demo
      };
      templateIds.push(String(t.id));
    });

    const record = {
      id: libId,
      name: String(lib.name),
      version: lib.version ? String(lib.version) : '',
      demo: !!lib.demo,
      note: lib.note ? String(lib.note) : '',
      source: src,
      templateIds,
      notes
    };
    registry.libraries.push(record);
    listeners.forEach(fn => { try { fn(record); } catch (e) { /* keep going */ } });
    return record;
  }

  function normStandards(v) {
    if (!v) return [];
    if (typeof v === 'string') return v.trim() ? [{ label: 'Standard language', text: v }] : [];
    if (!Array.isArray(v)) return [];
    return v.map((x, i) => {
      if (typeof x === 'string') return x.trim() ? { label: `Option ${i + 1}`, text: x } : null;
      return x && x.text ? { label: String(x.label || `Option ${i + 1}`), text: String(x.text) } : null;
    }).filter(Boolean);
  }

  function onChange(fn) { listeners.push(fn); }

  /* ------------------------------------------------------------------ */
  /* Template parsing                                                    */
  /*   {{field}}  {{field|fmt|fmt}}  {{#if field}}..{{else}}..{{/if}}   */
  /*   {{#if !field}}  {{#unless field}}..{{/unless}}                   */
  /*   {{#if a or b or c}}: true when any of them has a value            */
  /* ------------------------------------------------------------------ */

  const TAG = /\{\{\s*([\s\S]*?)\s*\}\}/g;
  const parseCache = new Map();

  function parse(text) {
    const key = String(text);
    if (parseCache.has(key)) return parseCache.get(key);
    const root = { t: 'root', then: [], else: null };
    const stack = [root];
    const errors = [];
    const branch = node => (node.else !== null ? node.else : node.then);
    let last = 0;
    let m;
    TAG.lastIndex = 0;
    while ((m = TAG.exec(key)) !== null) {
      const top = stack[stack.length - 1];
      if (m.index > last) branch(top).push({ t: 'text', v: key.slice(last, m.index) });
      last = TAG.lastIndex;
      const inner = m[1].trim();
      let mm;
      if ((mm = inner.match(/^#if\s+(!?)\s*([\w-]+(?:\s+or\s+[\w-]+)*)$/))) {
        const fields = mm[2].split(/\s+or\s+/);
        const node = { t: 'if', neg: mm[1] === '!', field: fields[0], fields, then: [], else: null };
        branch(top).push(node);
        stack.push(node);
      } else if ((mm = inner.match(/^#unless\s+([\w-]+)$/))) {
        const node = { t: 'if', neg: true, field: mm[1], then: [], else: null };
        branch(top).push(node);
        stack.push(node);
      } else if (inner === 'else') {
        if (top.t === 'if' && top.else === null) top.else = [];
        else { errors.push('Stray {{else}} outside an {{#if}} block.'); branch(top).push({ t: 'text', v: m[0] }); }
      } else if (inner === '/if' || inner === '/unless') {
        if (stack.length > 1) stack.pop();
        else errors.push(`Stray {{${inner}}} with no matching opening tag.`);
      } else if (/^[\w-]+(\s*\|\s*[\w-]+)*$/.test(inner)) {
        const parts = inner.split('|').map(s => s.trim());
        branch(top).push({ t: 'var', field: parts[0], fmts: parts.slice(1) });
      } else {
        errors.push(`Unreadable tag {{${inner}}}.`);
        branch(top).push({ t: 'text', v: m[0] });
      }
    }
    if (last < key.length) branch(stack[stack.length - 1]).push({ t: 'text', v: key.slice(last) });
    if (stack.length > 1) errors.push(`${stack.length - 1} {{#if}} block(s) never closed.`);
    const out = { nodes: root.then, errors };
    parseCache.set(key, out);
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* Rendering                                                           */
  /* ------------------------------------------------------------------ */

  function builtinValue(id, ctx) {
    if (id !== 'today') return undefined;
    const d = (ctx && ctx.now) || new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function hasValue(v) {
    if (Array.isArray(v)) return v.some(x => String(x).trim() !== '');
    return v !== undefined && v !== null && String(v).trim() !== '';
  }

  function present(ctx, id) {
    if (ctx.na && ctx.na[id]) return false;
    if (BUILTIN_FIELDS[id] && !hasValue(ctx.values ? ctx.values[id] : undefined)) return true;
    const v = ctx.values ? ctx.values[id] : undefined;
    if (Array.isArray(v)) return v.some(x => String(x).trim() !== '');
    return v !== undefined && v !== null && String(v).trim() !== '';
  }

  function render(text, ctx) {
    const parsed = parse(text || '');
    const gaps = [];
    const raw = tidy(walk(parsed.nodes, ctx, gaps));
    return { raw, gaps: Array.from(new Set(gaps)), errors: parsed.errors };
  }

  function walk(nodes, ctx, gaps) {
    let s = '';
    nodes.forEach(n => {
      if (n.t === 'text') s += n.v;
      else if (n.t === 'var') s += renderVar(n, ctx, gaps);
      else if (n.t === 'if') {
        const on = (n.fields || [n.field]).some(f => present(ctx, f)) !== n.neg;
        const r = walk(on ? n.then : (n.else || []), ctx, gaps);
        s += r === '' ? OMIT : r;
      }
    });
    return s;
  }

  function renderVar(n, ctx, gaps) {
    const fields = ctx.fields || registry.fields;
    const f = fields[n.field] || BUILTIN_FIELDS[n.field];
    if (!present(ctx, n.field)) {
      gaps.push(n.field);
      return GAP_OPEN + (f ? f.label : n.field) + GAP_CLOSE;
    }
    const given = ctx.values ? ctx.values[n.field] : undefined;
    const value = hasValue(given) ? given : builtinValue(n.field, ctx);
    return formatValue(value, f ? f.type : 'text', n.fmts, ctx);
  }

  // Drops lines that held only an omitted block, then cleans spacing.
  function tidy(s) {
    const out = [];
    s.split('\n').forEach(line => {
      if (line.indexOf(OMIT) !== -1 && line.split(OMIT).join('').trim() === '') return;
      out.push(line.split(OMIT).join('')
        .replace(/(\S)[ \t]{2,}/g, '$1 ')
        .replace(/[ \t]+([.,;:!?])/g, '$1')
        .replace(/(^|[^.])\.\.(?!\.)/g, '$1.') // "10 a.m.." becomes "10 a.m." (ellipses survive)
        .replace(/([!?])\.(?!\.)/g, '$1')
        .replace(/^[ \t]+/, '')
        .replace(/[ \t]+$/, ''));
    });
    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  function toPlain(raw) {
    return String(raw).replace(GAP_RE, (_, label) => `[[${label.toUpperCase()}]]`);
  }

  function toHTML(raw) {
    return escapeHTML(raw).replace(GAP_RE, (_, label) => `<mark class="gap">${label}</mark>`);
  }

  /* ------------------------------------------------------------------ */
  /* Formatting: AP style for public products, military for internal    */
  /* ------------------------------------------------------------------ */

  const AP_MONTHS = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];
  const MIL_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  function parseDate(v) {
    const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    return isNaN(d.getTime()) ? null : d;
  }

  function parseTime(v) {
    const m = String(v).match(/^(\d{2}):(\d{2})$/);
    return m ? { h: +m[1], m: +m[2] } : null;
  }

  function apDate(v, withDay, ctx) {
    const d = parseDate(v);
    if (!d) return String(v);
    const now = (ctx && ctx.now) || new Date();
    let s = `${AP_MONTHS[d.getMonth()]} ${d.getDate()}`;
    if (d.getFullYear() !== now.getFullYear()) s += `, ${d.getFullYear()}`;
    return withDay ? `${DAYS[d.getDay()]}, ${s}` : s;
  }

  function dayName(v) {
    const d = parseDate(v);
    return d ? DAYS[d.getDay()] : String(v);
  }

  function milDate(v) {
    const d = parseDate(v);
    return d ? `${d.getDate()} ${MIL_MONTHS[d.getMonth()]} ${d.getFullYear()}` : String(v);
  }

  function milShort(v) {
    const d = parseDate(v);
    return d ? `${d.getDate()} ${MIL_MONTHS[d.getMonth()]}` : String(v);
  }

  function milYY(v) {
    const d = parseDate(v);
    return d ? `${d.getDate()} ${MIL_MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}` : String(v);
  }

  function apTime(v) {
    const t = parseTime(v);
    if (!t) return String(v);
    if (t.h === 12 && t.m === 0) return 'noon';
    if (t.h === 0 && t.m === 0) return 'midnight';
    const h = t.h % 12 || 12;
    const suffix = t.h < 12 ? 'a.m.' : 'p.m.';
    return t.m ? `${h}:${String(t.m).padStart(2, '0')} ${suffix}` : `${h} ${suffix}`;
  }

  function milTime(v) {
    const t = parseTime(v);
    return t ? String(t.h).padStart(2, '0') + String(t.m).padStart(2, '0') : String(v);
  }

  // AP style: no serial comma.
  function apList(arr) {
    const a = arr.map(x => String(x).trim()).filter(Boolean);
    if (a.length <= 1) return a.join('');
    if (a.length === 2) return `${a[0]} and ${a[1]}`;
    return `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`;
  }

  const asText = v => (Array.isArray(v) ? apList(v) : String(v));

  const FORMATS = {
    ap: (v, t, ctx) => (t === 'date' ? apDate(v, false, ctx) : t === 'time' ? apTime(v) : v),
    apday: (v, t, ctx) => (t === 'date' ? apDate(v, true, ctx) : v),
    day: (v, t) => (t === 'date' ? dayName(v) : v),
    mil: (v, t) => (t === 'date' ? milDate(v) : t === 'time' ? milTime(v) : v),
    milshort: (v, t) => (t === 'date' ? milShort(v) : v),
    milyy: (v, t) => (t === 'date' ? milYY(v) : v),
    list: v => (Array.isArray(v) ? apList(v) : v),
    cap: v => { const s = asText(v); return s.charAt(0).toUpperCase() + s.slice(1); },
    lower: v => asText(v).toLowerCase(),
    upper: v => asText(v).toUpperCase(),
    sentence: v => {
      const s = asText(v).trim();
      return !s || /[.!?]["'\u201d\u2019)\]]?$/.test(s) ? s : s + '.';
    }
  };

  function formatValue(value, type, fmts, ctx) {
    let v = Array.isArray(value) ? value.filter(x => String(x).trim() !== '') : String(value).trim();
    let t = type;
    (fmts || []).forEach(name => {
      const fn = FORMATS[name];
      if (!fn) return;
      v = fn(v, t, ctx);
      if (TYPE_FORMATS.includes(name) && (t === 'date' || t === 'time')) t = 'text';
    });
    if (t === 'date') v = apDate(v, false, ctx);
    else if (t === 'time') v = apTime(v);
    return asText(v);
  }

  // Accepts 0930, 930, 09:30, 0930L, 9:30 pm, 9p, noon, midnight. Returns "HH:MM" or null.
  function normalizeTime(input) {
    if (input === undefined || input === null) return null;
    let s = String(input).trim().toLowerCase().replace(/\s+/g, '').replace(/\./g, '');
    if (!s) return null;
    if (s === 'noon') return '12:00';
    if (s === 'midnight') return '00:00';
    s = s.replace(/(\d)l$/, '$1');
    let ampm = null;
    const suffix = s.match(/^(.*?)(am|pm|a|p)$/);
    if (suffix) { s = suffix[1]; ampm = suffix[2][0]; }
    let h;
    let m;
    let mm;
    if ((mm = s.match(/^(\d{1,2}):(\d{2})$/))) { h = +mm[1]; m = +mm[2]; }
    else if ((mm = s.match(/^(\d{3,4})$/))) { const d = mm[1].padStart(4, '0'); h = +d.slice(0, 2); m = +d.slice(2); }
    else if ((mm = s.match(/^(\d{1,2})$/)) && ampm) { h = +mm[1]; m = 0; }
    else return null;
    if (ampm) {
      if (h < 1 || h > 12) return null;
      h = ampm === 'a' ? h % 12 : (h % 12) + 12;
    }
    if (h > 23 || m > 59) return null;
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }

  function escapeHTML(s) {
    return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  /* ------------------------------------------------------------------ */
  /* Validation: warnings for content authors                           */
  /* ------------------------------------------------------------------ */

  function scan(nodes, guards, acc) {
    nodes.forEach(n => {
      if (n.t === 'var') acc.push({ field: n.field, fmts: n.fmts, guarded: guards.has(n.field) });
      else if (n.t === 'if') {
        const conds = n.fields || [n.field];
        conds.forEach(f => acc.push({ field: f, cond: true }));
        const g = new Set(guards);
        if (!n.neg && conds.length === 1) g.add(n.field);
        scan(n.then, g, acc);
        if (n.else) scan(n.else, guards, acc);
      }
    });
    return acc;
  }

  function check() {
    const out = [];
    const warn = (template, message) => out.push({ template, message });
    const ownerWarned = new Set();
    Object.values(registry.templates).forEach(t => {
      const asked = new Set(t.required.concat(t.optional));
      const optional = new Set(t.optional);
      const used = new Set();
      t.required.filter(id => optional.has(id)).forEach(id => warn(t.id, `lists "${id}" as both required and optional.`));
      asked.forEach(id => {
        const f = registry.fields[id];
        if (!f) { warn(t.id, `asks for field "${id}", which is not defined in any library.`); return; }
        if (!registry.owners[f.owner] && !ownerWarned.has(f.owner)) {
          ownerWarned.add(f.owner);
          warn(t.id, `field "${id}" belongs to owner "${f.owner}", which is not defined.`);
        }
      });
      t.products.forEach(p => {
        const parsed = parse(p.text);
        parsed.errors.forEach(e => warn(t.id, `${p.label}: ${e}`));
        scan(parsed.nodes, new Set(), []).forEach(u => {
          (u.fmts || []).forEach(fm => { if (!FORMATS[fm]) warn(t.id, `${p.label}: unknown format "${fm}" on {{${u.field}}}.`); });
          if (BUILTIN_FIELDS[u.field] && !registry.fields[u.field]) return;
          used.add(u.field);
          if (!registry.fields[u.field]) warn(t.id, `${p.label}: {{${u.field}}} is not a defined field.`);
          else if (!asked.has(u.field)) warn(t.id, `${p.label}: uses {{${u.field}}}, but the form never asks for it, so it will always be a gap.`);
          if (!u.cond && optional.has(u.field) && !u.guarded) {
            warn(t.id, `${p.label}: optional field {{${u.field}}} is used outside {{#if ${u.field}}}, so it shows as a gap when left blank.`);
          }
        });
      });
      t.required.forEach(id => { if (!used.has(id)) warn(t.id, `requires "${id}", but no product uses it.`); });
    });
    registry.libraries.forEach(l => l.notes.forEach(n => warn(l.id, n)));
    return out;
  }

  global.RCF = {
    registry,
    registerLibrary,
    onChange,
    parse,
    render,
    present,
    toPlain,
    toHTML,
    formatValue,
    normalizeTime,
    check,
    util: { apDate, apTime, milDate, milShort, milYY, milTime, apList, dayName, escapeHTML }
  };
})(typeof window !== 'undefined' ? window : globalThis);
