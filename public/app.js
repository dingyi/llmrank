/* llmrank — filterable, sortable benchmark table. No dependencies. */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);

  // ---------- column definitions ----------
  const fmtMoney = (v, d) => '$' + v.toFixed(d);
  const COLUMNS = [
    { key: 'model', label: 'Model', always: true },
    { key: 'intelligence', label: 'Intelligence', on: true, fmt: (v) => v.toFixed(1) },
    { key: 'costPerTask', label: 'Cost / task', on: true, fmt: (v) => fmtMoney(v, v >= 1 ? 2 : 4) },
    { key: 'timePerTask', label: 'Time / task', on: true, fmt: (v) => (v >= 100 ? Math.round(v) : v.toFixed(1)) + ' s' },
    { key: 'speed', label: 'Output tok/s', on: true, fmt: (v) => v.toFixed(1) },
    { key: 'inputPrice', label: 'Input $/M', on: true, fmt: (v) => fmtMoney(v, 2) },
    { key: 'outputPrice', label: 'Output $/M', on: true, fmt: (v) => fmtMoney(v, 2) },
    { key: 'cacheHitPrice', label: 'Cache-hit $/M', on: true, fmt: (v) => fmtMoney(v, 3) },
    { key: 'cacheWritePrice', label: 'Cache-write $/M', on: false, fmt: (v) => fmtMoney(v, 2) },
    { key: 'context', label: 'Context', on: false, fmt: fmtContext },
    { key: 'releaseDate', label: 'Released', on: false, fmt: (v) => v },
  ];
  function fmtContext(v) {
    if (v >= 1e6) return (v / 1e6).toFixed(v % 1e6 ? 1 : 0).replace(/\.0$/, '') + 'M';
    return Math.round(v / 1e3) + 'K';
  }

  // Creators surfaced as quick filters; everything else lands under "Other".
  const FEATURED = [
    'Anthropic', 'OpenAI', 'Google', 'Meta', 'Alibaba', 'DeepSeek', 'Kimi',
    'Z AI', 'Mistral', 'NVIDIA', 'Amazon', 'Microsoft', 'MiniMax', 'Baidu',
    'Tencent', 'StepFun', 'Xiaomi',
  ];

  // ---------- state ----------
  const state = {
    search: '',
    creators: new Set(), // empty = all
    minInt: 0, // 0 = any
    costPos: 1000, // slider position; 1000 = any
    timePos: 1000,
    sortKey: 'intelligence',
    sortDir: 'desc',
    cols: new Set(COLUMNS.filter((c) => c.on).map((c) => c.key)),
  };
  let DATA = null;
  let maxCost = 1;
  let maxTime = 1;

  function saveState() {
    try {
      localStorage.setItem('llmrank-state', JSON.stringify({
        creators: [...state.creators],
        minInt: state.minInt,
        costPos: state.costPos,
        timePos: state.timePos,
        sortKey: state.sortKey,
        sortDir: state.sortDir,
        cols: [...state.cols],
      }));
    } catch {}
  }
  function loadState() {
    try {
      const s = JSON.parse(localStorage.getItem('llmrank-state'));
      if (!s) return;
      state.creators = new Set(s.creators || []);
      state.minInt = s.minInt || 0;
      state.costPos = s.costPos ?? 1000;
      state.timePos = s.timePos ?? 1000;
      if (COLUMNS.some((c) => c.key === s.sortKey)) state.sortKey = s.sortKey;
      if (s.sortDir === 'asc' || s.sortDir === 'desc') state.sortDir = s.sortDir;
      if (Array.isArray(s.cols) && s.cols.length)
        state.cols = new Set(s.cols.filter((k) => COLUMNS.some((c) => c.key === k)));
    } catch {}
  }

  // Log-mapped slider positions give fine control over cheap/fast models.
  const posToValue = (pos, max) =>
    pos >= 1000 ? Infinity : Math.expm1((pos / 1000) * Math.log(max + 1));

  // ---------- filtering & sorting ----------
  function visibleModels() {
    const q = state.search.trim().toLowerCase();
    const maxCostV = posToValue(state.costPos, maxCost);
    const maxTimeV = posToValue(state.timePos, maxTime);
    const featured = new Set(FEATURED);
    const rows = DATA.models.filter((m) => {
      if (q && !(m.name.toLowerCase().includes(q) || m.creator.toLowerCase().includes(q))) return false;
      if (state.creators.size) {
        const bucket = featured.has(m.creator) ? m.creator : 'Other';
        if (!state.creators.has(bucket)) return false;
      }
      if (state.minInt > 0 && (m.intelligence == null || m.intelligence < state.minInt)) return false;
      if (maxCostV !== Infinity && (m.costPerTask == null || m.costPerTask > maxCostV)) return false;
      if (maxTimeV !== Infinity && (m.timePerTask == null || m.timePerTask > maxTimeV)) return false;
      return true;
    });
    const { sortKey, sortDir } = state;
    const dir = sortDir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return a.name.localeCompare(b.name);
      if (av == null) return 1; // missing values always last
      if (bv == null) return -1;
      const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
      return cmp ? cmp * dir : a.name.localeCompare(b.name);
    });
    return rows;
  }

  // ---------- rendering ----------
  function activeColumns() {
    return COLUMNS.filter((c) => c.always || state.cols.has(c.key));
  }

  function renderHead() {
    const tr = document.createElement('tr');
    for (const col of activeColumns()) {
      const th = document.createElement('th');
      th.scope = 'col';
      if (state.sortKey === col.key)
        th.setAttribute('aria-sort', state.sortDir === 'asc' ? 'ascending' : 'descending');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.append(col.label);
      const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      arrow.setAttribute('viewBox', '0 0 10 10');
      arrow.setAttribute('class', 'sort-arrow');
      arrow.setAttribute('aria-hidden', 'true');
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', 'M2 3.5 5 6.5 8 3.5');
      arrow.append(p);
      btn.append(arrow);
      btn.addEventListener('click', () => {
        if (state.sortKey === col.key) {
          state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          state.sortKey = col.key;
          state.sortDir = col.key === 'model' || col.key === 'releaseDate' ? 'asc' : 'desc';
        }
        saveState();
        render();
      });
      th.append(btn);
      tr.append(th);
    }
    $('thead').replaceChildren(tr);
  }

  function renderBody(rows) {
    const cols = activeColumns();
    const frag = document.createDocumentFragment();
    for (const m of rows) {
      const tr = document.createElement('tr');
      for (const col of cols) {
        const td = document.createElement('td');
        if (col.key === 'model') {
          td.className = 'model-cell';
          const name = document.createElement('span');
          name.className = 'model-name';
          name.textContent = m.name;
          name.title = m.name;
          const sub = document.createElement('span');
          sub.className = 'model-sub';
          const dot = document.createElement('span');
          dot.className = 'dot';
          dot.style.background = m.creatorColor || 'var(--text-3)';
          sub.append(dot, m.creator);
          if (m.openWeights) {
            const b = document.createElement('span');
            b.className = 'badge';
            b.textContent = 'open weights';
            sub.append(b);
          }
          td.append(name, sub);
        } else {
          const v = m[col.key];
          td.className = 'num';
          if (v == null) {
            td.classList.add('null');
            td.textContent = '—';
          } else if (col.key === 'intelligence') {
            td.classList.add('intelligence');
            const bar = document.createElement('span');
            bar.className = 'bar';
            bar.style.setProperty('--w', Math.min(100, (v / 70) * 100).toFixed(1));
            const span = document.createElement('span');
            span.textContent = col.fmt(v);
            td.append(bar, span);
          } else {
            td.textContent = col.fmt(v);
          }
        }
        tr.append(td);
      }
      frag.append(tr);
    }
    $('tbody').replaceChildren(frag);
    $('empty').hidden = rows.length > 0;
    $('table-scroll').style.display = rows.length ? '' : 'none';
  }

  function renderMeta(shown) {
    const scored = DATA.models.filter((m) => m.intelligence != null).length;
    const updated = new Date(DATA.generatedAt).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
    $('meta-line').innerHTML =
      `Showing <strong>${shown}</strong> of <strong>${DATA.count}</strong> models · ` +
      `${scored} with intelligence index · updated ${updated}`;
    $('footer-updated').textContent =
      `Snapshot generated ${new Date(DATA.generatedAt).toISOString().replace('T', ' ').slice(0, 16)} UTC · ` +
      `refresh with “node scripts/update-data.mjs”`;
  }

  function render() {
    const rows = visibleModels();
    renderHead();
    renderBody(rows);
    renderMeta(rows.length);
  }

  // ---------- controls ----------
  function buildCreatorChips() {
    const counts = new Map();
    for (const m of DATA.models) counts.set(m.creator, (counts.get(m.creator) || 0) + 1);
    const featured = FEATURED.filter((c) => counts.has(c));
    const otherCount = DATA.models.filter((m) => !FEATURED.includes(m.creator)).length;
    const wrap = $('creator-chips');
    const make = (label, count, color) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.setAttribute('aria-pressed', String(state.creators.has(label)));
      if (color) {
        const dot = document.createElement('span');
        dot.className = 'dot';
        dot.style.background = color;
        b.append(dot);
      }
      b.append(label);
      const c = document.createElement('span');
      c.className = 'count';
      c.textContent = count;
      b.append(c);
      b.addEventListener('click', () => {
        if (state.creators.has(label)) state.creators.delete(label);
        else state.creators.add(label);
        b.setAttribute('aria-pressed', String(state.creators.has(label)));
        saveState();
        render();
      });
      return b;
    };
    const colorOf = (name) => DATA.models.find((m) => m.creator === name)?.creatorColor;
    for (const c of featured) wrap.append(make(c, counts.get(c), colorOf(c)));
    if (otherCount) wrap.append(make('Other', otherCount, null));
  }

  function buildColumnChips() {
    const wrap = $('column-chips');
    for (const col of COLUMNS.filter((c) => !c.always)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = col.label;
      b.setAttribute('aria-pressed', String(state.cols.has(col.key)));
      b.addEventListener('click', () => {
        if (state.cols.has(col.key)) state.cols.delete(col.key);
        else state.cols.add(col.key);
        b.setAttribute('aria-pressed', String(state.cols.has(col.key)));
        saveState();
        render();
      });
      wrap.append(b);
    }
  }

  function setSliderFill(input) {
    input.style.setProperty('--fill', (input.value / input.max) * 100 + '%');
  }

  function bindSlider(id, outId, apply, format) {
    const input = $(id);
    const out = $(outId);
    const update = () => {
      setSliderFill(input);
      out.textContent = format(+input.value);
    };
    input.addEventListener('input', () => {
      apply(+input.value);
      update();
      saveState();
      render();
    });
    update();
    return update;
  }

  function resetFilters() {
    state.search = '';
    state.creators.clear();
    state.minInt = 0;
    state.costPos = 1000;
    state.timePos = 1000;
    $('search').value = '';
    $('min-intelligence').value = 0;
    $('max-cost').value = 1000;
    $('max-time').value = 1000;
    for (const b of $('creator-chips').querySelectorAll('.chip'))
      b.setAttribute('aria-pressed', 'false');
    syncSliderOutputs();
    saveState();
    render();
  }

  let syncSliderOutputs = () => {};

  function bindControls() {
    let t;
    $('search').addEventListener('input', (e) => {
      clearTimeout(t);
      t = setTimeout(() => {
        state.search = e.target.value;
        render();
      }, 120);
    });
    $('reset').addEventListener('click', resetFilters);
    $('empty-reset').addEventListener('click', resetFilters);

    $('min-intelligence').value = state.minInt;
    $('max-cost').value = state.costPos;
    $('max-time').value = state.timePos;
    const u1 = bindSlider('min-intelligence', 'min-intelligence-value',
      (v) => { state.minInt = v; },
      (v) => (v === 0 ? 'any' : String(v)));
    const u2 = bindSlider('max-cost', 'max-cost-value',
      (v) => { state.costPos = v; },
      (v) => (v >= 1000 ? 'any' : fmtMoney(posToValue(v, maxCost), 2)));
    const u3 = bindSlider('max-time', 'max-time-value',
      (v) => { state.timePos = v; },
      (v) => (v >= 1000 ? 'any' : Math.round(posToValue(v, maxTime)) + ' s'));
    syncSliderOutputs = () => { u1(); u2(); u3(); };
  }

  function bindTheme() {
    const label = $('theme-label');
    const sync = () => {
      label.textContent = document.documentElement.dataset.theme === 'dark' ? 'Light' : 'Dark';
    };
    $('theme-toggle').addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      localStorage.setItem('llmrank-theme', next);
      sync();
    });
    sync();
  }

  // ---------- boot ----------
  async function boot() {
    bindTheme();
    try {
      const res = await fetch('data/models.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      DATA = await res.json();
    } catch (err) {
      $('meta-line').textContent = 'Failed to load model data. Refresh the page to retry.';
      console.error(err);
      return;
    }
    maxCost = Math.ceil(Math.max(...DATA.models.map((m) => m.costPerTask ?? 0)));
    maxTime = Math.ceil(Math.max(...DATA.models.map((m) => m.timePerTask ?? 0)));
    loadState();
    buildCreatorChips();
    buildColumnChips();
    bindControls();
    render();
  }

  boot();
})();