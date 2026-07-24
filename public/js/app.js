// ===================== 共用工具 =====================
const state = { user: null, prefs: null, watchlist: ['2330', '2317', '0050'] };

function $(sel) { return document.querySelector(sel); }
function el(tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  });
  (Array.isArray(children) ? children : [children]).forEach((c) => {
    if (c == null) return;
    e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return e;
}
function showToast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}
async function api(path, opts = {}) {
  const res = await fetch('/api' + path, {
    headers: { 'content-type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}
function fmtNum(n) { return Number(n || 0).toLocaleString('zh-Hant-TW'); }
function fmtMoney(n) { return 'NT$ ' + Number(n || 0).toLocaleString('zh-Hant-TW'); }

// ===================== Auth =====================
function toggleAuth(showRegister) {
  $('#loginForm').style.display = showRegister ? 'none' : 'block';
  $('#registerForm').style.display = showRegister ? 'block' : 'none';
}

async function doLogin() {
  try {
    const user = await api('/auth/login', {
      method: 'POST',
      body: { email: $('#loginEmail').value.trim(), password: $('#loginPassword').value },
    });
    onAuthed(user);
  } catch (e) { $('#loginError').textContent = e.message; }
}
async function doRegister() {
  try {
    const user = await api('/auth/register', {
      method: 'POST',
      body: { name: $('#regName').value.trim(), email: $('#regEmail').value.trim(), password: $('#regPassword').value },
    });
    onAuthed(user);
  } catch (e) { $('#regError').textContent = e.message; }
}
async function doLogout() {
  await api('/auth/logout', { method: 'POST' });
  state.user = null;
  $('#shell').style.display = 'none';
  $('#authScreen').style.display = 'flex';
}
function onAuthed(user) {
  state.user = user;
  $('#authScreen').style.display = 'none';
  $('#shell').style.display = 'flex';
  $('#userName').textContent = user.name;
  $('#userAvatar').textContent = (user.name || '?').slice(0, 1).toUpperCase();
  loadPrefsAndBoot();
}

async function loadPrefsAndBoot() {
  try {
    state.prefs = await api('/prefs');
    if (state.prefs.watchlist && state.prefs.watchlist.length) state.watchlist = state.prefs.watchlist;
  } catch (e) { /* 忽略，用預設值 */ }
  renderDashboard();
  switchTab('dashboard');
  try {
    const health = await api('/health');
    $('#appVersion').textContent = health.version;
  } catch (e) {}
}

// ===================== Tab 切換 =====================
const TAB_TITLES = { dashboard: '我的首頁', stocks: '股票', travel: '交通與旅遊', diary: '日記', finance: '記帳', calendar: '行事曆', assistant: 'AI 助理', settings: '個人化設定' };
function switchTab(tab) {
  document.querySelectorAll('.nav-item').forEach((n) => n.classList.toggle('active', n.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach((p) => (p.style.display = 'none'));
  $(`#tab-${tab}`).style.display = 'block';
  $('#pageTitle').textContent = TAB_TITLES[tab];
  if (tab === 'stocks') renderStocks();
  if (tab === 'travel') renderTravel();
  if (tab === 'diary') renderDiary();
  if (tab === 'finance') renderFinance();
  if (tab === 'calendar') renderCalendar();
  if (tab === 'assistant') renderAssistant();
  if (tab === 'settings') renderSettings();
}

// ===================== SVG 圖表小工具 =====================
// 依 dataviz 規範：細線條、圓角端點、2px 間距、淺色 gridline、tooltip 互動
function svgEl(tag, attrs) {
  const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
  return e;
}

// 水平長條圖 (用於記帳分類金額) — 類別色依固定順序指派
const CATEGORICAL = ['--series-blue', '--series-orange', '--series-aqua', '--series-yellow', '--series-magenta', '--series-green', '--series-violet', '--series-red'];
function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

function renderBarChart(container, data, opts = {}) {
  // data: [{label, value}]
  container.innerHTML = '';
  if (!data.length) { container.appendChild(el('div', { class: 'empty-state' }, opts.emptyText || '目前沒有資料')); return; }
  const width = container.clientWidth || 400;
  const rowH = 30;
  const height = data.length * rowH + 10;
  const max = Math.max(...data.map((d) => d.value), 1);
  const svg = svgEl('svg', { width: '100%', height, viewBox: `0 0 ${width} ${height}` });

  data.forEach((d, i) => {
    const y = i * rowH + 6;
    // 預留右側 90px 給數值標籤，避免最大值那一列的長條把標籤擠出容器外
    const barW = Math.max(4, (d.value / max) * (width - 140 - 90));
    const color = cssVar(CATEGORICAL[i % CATEGORICAL.length]);
    svg.appendChild(svgEl('rect', { x: 110, y, width: barW, height: 14, rx: 4, fill: color }));
    const label = svgEl('text', { x: 0, y: y + 11, 'font-size': 12, fill: cssVar('--text-secondary') });
    label.textContent = d.label.length > 10 ? d.label.slice(0, 10) + '…' : d.label;
    svg.appendChild(label);
    const val = svgEl('text', { x: 110 + barW + 8, y: y + 11, 'font-size': 12, fill: cssVar('--text-primary') });
    val.textContent = opts.money ? fmtMoney(d.value) : fmtNum(d.value);
    svg.appendChild(val);

    const hit = svgEl('rect', { x: 110, y, width: Math.max(barW, 4), height: 14, fill: 'transparent' });
    hit.addEventListener('mousemove', (ev) => showTooltip(ev, `${d.label}: ${opts.money ? fmtMoney(d.value) : fmtNum(d.value)}`));
    hit.addEventListener('mouseleave', hideTooltip);
    svg.appendChild(hit);
  });
  container.appendChild(svg);
}

// 發散長條圖 (法人買賣超: 正值買超=blue, 負值賣超=red, 0軸=灰色基準線)
function renderDivergingChart(container, data) {
  container.innerHTML = '';
  if (!data.length) { container.appendChild(el('div', { class: 'empty-state' }, '目前沒有可用的法人買賣超資料')); return; }
  const width = container.clientWidth || 500;
  const height = 180;
  const padL = 10, padR = 10, padTop = 10, padBottom = 24;
  const plotW = width - padL - padR;
  const plotH = height - padTop - padBottom;
  const max = Math.max(...data.map((d) => Math.abs(d.netBuySell)), 1);
  const barW = Math.max(6, plotW / data.length - 6);
  const midY = padTop + plotH / 2;

  const svg = svgEl('svg', { width: '100%', height, viewBox: `0 0 ${width} ${height}` });
  svg.appendChild(svgEl('line', { x1: padL, x2: width - padR, y1: midY, y2: midY, stroke: cssVar('--baseline'), 'stroke-width': 1 }));

  data.forEach((d, i) => {
    const x = padL + i * (plotW / data.length) + (plotW / data.length - barW) / 2;
    const h = (Math.abs(d.netBuySell) / max) * (plotH / 2 - 4);
    const isBuy = d.netBuySell >= 0;
    const y = isBuy ? midY - h : midY;
    const color = isBuy ? cssVar('--series-blue') : cssVar('--series-red');
    svg.appendChild(svgEl('rect', { x, y, width: barW, height: Math.max(h, 1), rx: 3, fill: color }));

    const hit = svgEl('rect', { x, y: padTop, width: barW, height: plotH, fill: 'transparent' });
    hit.addEventListener('mousemove', (ev) => showTooltip(ev, `${d.date}: ${isBuy ? '買超' : '賣超'} ${fmtNum(Math.abs(d.netBuySell))} 股`));
    hit.addEventListener('mouseleave', hideTooltip);
    svg.appendChild(hit);

    if (i % Math.ceil(data.length / 6 || 1) === 0) {
      const lbl = svgEl('text', { x: x + barW / 2, y: height - 6, 'font-size': 10, 'text-anchor': 'middle', fill: cssVar('--text-muted') });
      lbl.textContent = (d.date || '').slice(4);
      svg.appendChild(lbl);
    }
  });
  container.appendChild(svg);
  container.appendChild(el('div', { class: 'legend' }, [
    el('div', { class: 'legend-item' }, [el('div', { class: 'legend-dot', style: `background:${cssVar('--series-blue')}` }), '買超 (法人淨買進)']),
    el('div', { class: 'legend-item' }, [el('div', { class: 'legend-dot', style: `background:${cssVar('--series-red')}` }), '賣超 (法人淨賣出)']),
  ]));
}

// 折線圖 (記帳月趨勢: 收入 vs 支出 兩條線)
function renderLineChart(container, series) {
  // series: [{name, color, points:[{x,y}]}]
  container.innerHTML = '';
  const allPoints = series.flatMap((s) => s.points);
  if (!allPoints.length) { container.appendChild(el('div', { class: 'empty-state' }, '目前沒有可用的趨勢資料')); return; }
  const width = container.clientWidth || 500;
  const height = 200;
  const padL = 40, padR = 16, padTop = 16, padBottom = 26;
  const plotW = width - padL - padR;
  const plotH = height - padTop - padBottom;
  const xs = [...new Set(allPoints.map((p) => p.x))];
  const maxY = Math.max(...allPoints.map((p) => p.y), 1);

  const svg = svgEl('svg', { width: '100%', height, viewBox: `0 0 ${width} ${height}` });
  for (let g = 0; g <= 4; g++) {
    const y = padTop + (plotH / 4) * g;
    svg.appendChild(svgEl('line', { x1: padL, x2: width - padR, y1: y, y2: y, stroke: cssVar('--grid-line'), 'stroke-width': 1 }));
    const val = svgEl('text', { x: 4, y: y + 4, 'font-size': 10, fill: cssVar('--text-muted') });
    val.textContent = fmtNum(Math.round(maxY - (maxY / 4) * g));
    svg.appendChild(val);
  }

  series.forEach((s) => {
    const pts = xs.map((x) => {
      const p = s.points.find((pt) => pt.x === x);
      return { x, y: p ? p.y : 0 };
    });
    const path = pts.map((p, i) => {
      const px = padL + (xs.indexOf(p.x) / Math.max(xs.length - 1, 1)) * plotW;
      const py = padTop + plotH - (p.y / maxY) * plotH;
      return `${i === 0 ? 'M' : 'L'}${px},${py}`;
    }).join(' ');
    svg.appendChild(svgEl('path', { d: path, fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-linecap': 'round' }));

    pts.forEach((p) => {
      const px = padL + (xs.indexOf(p.x) / Math.max(xs.length - 1, 1)) * plotW;
      const py = padTop + plotH - (p.y / maxY) * plotH;
      const dot = svgEl('circle', { cx: px, cy: py, r: 4, fill: s.color });
      dot.addEventListener('mousemove', (ev) => showTooltip(ev, `${s.name} ${p.x}: ${fmtMoney(p.y)}`));
      dot.addEventListener('mouseleave', hideTooltip);
      svg.appendChild(dot);
    });
  });

  xs.forEach((x, i) => {
    const px = padL + (i / Math.max(xs.length - 1, 1)) * plotW;
    const lbl = svgEl('text', { x: px, y: height - 6, 'font-size': 10, 'text-anchor': 'middle', fill: cssVar('--text-muted') });
    lbl.textContent = x;
    svg.appendChild(lbl);
  });

  container.appendChild(svg);
  container.appendChild(el('div', { class: 'legend' }, series.map((s) =>
    el('div', { class: 'legend-item' }, [el('div', { class: 'legend-dot', style: `background:${s.color}` }), s.name])
  )));
}

// 股價走勢圖 (收盤價 + MA5 + MA20)：y 軸依價格範圍縮放 (不從 0 開始，股價圖慣例)
function renderPriceChart(container, points) {
  container.innerHTML = '';
  if (!points || points.length < 2) { container.appendChild(el('div', { class: 'empty-state' }, '歷史資料不足，無法繪製走勢圖')); return; }
  const width = container.clientWidth || 600;
  const height = 220;
  const padL = 48, padR = 14, padTop = 12, padBottom = 26;
  const plotW = width - padL - padR, plotH = height - padTop - padBottom;
  const vals = points.flatMap((p) => [p.close, p.ma5, p.ma20]).filter((v) => v != null);
  const vMin = Math.min(...vals), vMax = Math.max(...vals);
  const span = vMax - vMin || vMax * 0.02 || 1;
  const lo = vMin - span * 0.08, hi = vMax + span * 0.08;
  const xAt = (i) => padL + (i / Math.max(points.length - 1, 1)) * plotW;
  const yAt = (v) => padTop + plotH - ((v - lo) / (hi - lo)) * plotH;

  const svg = svgEl('svg', { width: '100%', height, viewBox: `0 0 ${width} ${height}` });
  for (let g = 0; g <= 4; g++) {
    const y = padTop + (plotH / 4) * g;
    const v = hi - ((hi - lo) / 4) * g;
    svg.appendChild(svgEl('line', { x1: padL, x2: width - padR, y1: y, y2: y, stroke: cssVar('--grid-line'), 'stroke-width': 1 }));
    const lbl = svgEl('text', { x: 4, y: y + 4, 'font-size': 10, fill: cssVar('--text-muted') });
    lbl.textContent = v >= 1000 ? Math.round(v).toLocaleString() : v.toFixed(1);
    svg.appendChild(lbl);
  }

  const series = [
    { key: 'close', name: '收盤價', color: cssVar('--series-blue'), w: 2 },
    { key: 'ma5', name: 'MA5', color: cssVar('--series-orange'), w: 1.5 },
    { key: 'ma20', name: 'MA20', color: cssVar('--series-aqua'), w: 1.5 },
  ];
  series.forEach((s) => {
    let d = '';
    points.forEach((p, i) => {
      const v = p[s.key];
      if (v == null) return;
      d += `${d ? 'L' : 'M'}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)} `;
    });
    if (d) svg.appendChild(svgEl('path', { d: d.trim(), fill: 'none', stroke: s.color, 'stroke-width': s.w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
  });

  const colW = plotW / points.length;
  points.forEach((p, i) => {
    const hit = svgEl('rect', { x: xAt(i) - colW / 2, y: padTop, width: colW, height: plotH, fill: 'transparent' });
    hit.addEventListener('mousemove', (ev) => showTooltip(ev,
      `${p.date} 收盤 ${p.close}${p.ma5 != null ? ' · MA5 ' + p.ma5 : ''}${p.ma20 != null ? ' · MA20 ' + p.ma20 : ''}`));
    hit.addEventListener('mouseleave', hideTooltip);
    svg.appendChild(hit);
  });

  const step = Math.max(1, Math.ceil(points.length / 5));
  points.forEach((p, i) => {
    if (i % step !== 0 && i !== points.length - 1) return;
    const lbl = svgEl('text', { x: xAt(i), y: height - 6, 'font-size': 10, 'text-anchor': 'middle', fill: cssVar('--text-muted') });
    lbl.textContent = String(p.date || '').slice(-5);
    svg.appendChild(lbl);
  });

  container.appendChild(svg);
  container.appendChild(el('div', { class: 'legend' }, series.map((s) =>
    el('div', { class: 'legend-item' }, [el('div', { class: 'legend-dot', style: `background:${s.color}` }), s.name])
  )));
}

function showTooltip(ev, text) {
  const tip = $('#tooltip');
  tip.textContent = text;
  tip.style.left = ev.pageX + 12 + 'px';
  tip.style.top = ev.pageY + 12 + 'px';
  tip.style.opacity = '1';
}
function hideTooltip() { $('#tooltip').style.opacity = '0'; }

// ===================== Dashboard =====================
function renderDashboard() {
  const c = $('#tab-dashboard');
  c.innerHTML = '';
  c.appendChild(el('div', { class: 'hero' }, [
    el('h3', {}, `哈囉，${state.user ? state.user.name : ''} 👋`),
    el('p', {}, '你的個人生活整合中心 — 股票、交通旅遊、日記、記帳、行事曆與 AI 助理，手機與電腦資料同步。到「個人化設定」可調整首頁模組。'),
  ]));
  c.appendChild(el('div', { class: 'grid-3' }, [
    quickLink('📈 股票', '大盤/費半指數、自選股、法人分項與新聞', () => switchTab('stocks')),
    quickLink('🚄 交通與旅遊', '台鐵/高鐵時刻、機票訂房連結、智慧行程', () => switchTab('travel')),
    quickLink('💰 記帳', '快速記一筆，看本月收支與趨勢圖', () => switchTab('finance')),
    quickLink('📅 行事曆', '安排幾點做什麼，不漏掉重要行程', () => switchTab('calendar')),
    quickLink('🤖 AI 助理', '聊天、規劃、翻譯、解讀你的資料', () => switchTab('assistant')),
    quickLink('📔 日記', '記下今天，也可匯入本機文字檔', () => switchTab('diary')),
  ]));
}
function quickLink(title, hint, onClick) {
  return el('div', { class: 'card clickable', style: 'margin-bottom:0', onclick: onClick }, [
    el('h3', {}, title), el('p', { class: 'hint', style: 'margin-bottom:0' }, hint),
  ]);
}

// ===================== 股票 =====================
async function renderStocks() {
  const c = $('#tab-stocks');
  c.innerHTML = '';
  c.appendChild(el('div', { class: 'disclaimer' }, '股票資訊來自台灣證券交易所公開資料 (每日盤後更新)，均線指標僅為統計描述、SOX 指數為非官方資料源，皆僅供參考整理，不構成任何投資建議，買賣決策請自行判斷並留意風險。'));

  c.appendChild(el('div', { class: 'grid-2', style: 'margin-bottom:16px' }, [
    el('div', { class: 'card', id: 'taiexCard', style: 'margin-bottom:0' }, [el('div', {}, '台股加權指數載入中...')]),
    el('div', { class: 'card', id: 'soxCard', style: 'margin-bottom:0' }, [el('div', {}, '費半指數 (SOX) 載入中...')]),
  ]));
  loadTaiexCard();
  loadSoxCard();

  const watchCard = el('div', { class: 'card' }, [
    el('h3', {}, '自選股'),
    el('div', { class: 'form-row' }, [
      el('input', { id: 'newStockCode', placeholder: '輸入股票代號，如 2330' }),
      el('button', { class: 'btn btn-primary', onclick: addWatchStock }, '加入自選'),
    ]),
    el('div', { id: 'watchlistArea' }),
  ]);
  c.appendChild(watchCard);
  await renderWatchlist();
}

function indexCardContent(name, value, change, badgeText, extraLabel) {
  const changeColor = change > 0 ? 'delta-up' : change < 0 ? 'delta-down' : '';
  return el('div', { class: 'index-card' }, [
    el('div', {}, [
      el('div', { class: 'idx-name' }, name),
      el('div', { class: 'stat-tile' }, [
        el('span', { class: 'value' }, value != null ? Number(value).toLocaleString('zh-Hant-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--'),
        el('span', { class: changeColor, style: 'margin-left:8px' }, change != null ? `${change > 0 ? '▲+' : change < 0 ? '▼' : ''}${change}` : ''),
      ]),
      extraLabel ? el('div', { class: 'label' }, extraLabel) : null,
    ]),
    el('span', { class: 'badge badge-neutral' }, badgeText),
  ]);
}

async function loadTaiexCard() {
  const card = $('#taiexCard');
  try {
    const t = await api('/stocks/index/taiex');
    card.innerHTML = '';
    card.appendChild(indexCardContent(t.symbol, t.index, t.change, '證交所官方資料',
      t.tradeValue != null ? `資料日期 ${t.date || '--'} · 成交金額 ${fmtNum(Math.round(t.tradeValue / 100000000))} 億` : `資料日期 ${t.date || '--'}`));
  } catch (e) {
    card.innerHTML = '';
    card.appendChild(el('div', { style: 'font-size:12px;color:var(--text-muted)' }, `加權指數暫時無法取得 (${e.message})`));
  }
}

async function loadSoxCard() {
  const card = $('#soxCard');
  try {
    const sox = await api('/stocks/index/sox');
    card.innerHTML = '';
    card.appendChild(indexCardContent(sox.symbol, sox.price, sox.change, '非官方資料源', null));
  } catch (e) {
    card.innerHTML = '';
    card.appendChild(el('div', { style: 'font-size:12px;color:var(--text-muted)' }, `費半指數暫時無法取得 (${e.message})`));
  }
}

async function addWatchStock() {
  const code = $('#newStockCode').value.trim();
  if (!code) return;
  if (!state.watchlist.includes(code)) state.watchlist.push(code);
  $('#newStockCode').value = '';
  await savePrefsWatchlist();
  renderWatchlist();
}
async function removeWatchStock(code) {
  state.watchlist = state.watchlist.filter((c) => c !== code);
  await savePrefsWatchlist();
  renderWatchlist();
}
async function savePrefsWatchlist() {
  try {
    await api('/prefs', { method: 'PUT', body: { ...state.prefs, watchlist: state.watchlist } });
  } catch (e) {}
}

async function renderWatchlist() {
  const area = $('#watchlistArea');
  area.innerHTML = '';
  if (!state.watchlist.length) { area.appendChild(el('div', { class: 'empty-state' }, '尚未加入自選股')); return; }

  for (const code of state.watchlist) {
    const box = el('div', { class: 'card', style: 'margin-bottom:12px' }, [el('div', {}, `載入 ${code} 中...`)]);
    area.appendChild(box);
    loadStockCard(code, box);
  }
}

function sectionTitle(text) {
  return el('div', { style: 'font-size:12.5px;font-weight:700;color:var(--text-secondary);margin-bottom:8px' }, text);
}

async function loadStockCard(code, box) {
  try {
    const [quote, inst, indicatorRes, newsRes, valuation, historyRes] = await Promise.all([
      api(`/stocks/quote/${code}`).catch((e) => ({ error: e.message })),
      api(`/stocks/institutional/${code}?days=15`).catch((e) => ({ error: e.message })),
      api(`/stocks/indicator/${code}`).catch((e) => ({ error: e.message })),
      api(`/stocks/news/${code}`).catch((e) => ({ error: e.message })),
      api(`/stocks/valuation/${code}`).catch((e) => ({ error: e.message })),
      api(`/stocks/history/${code}`).catch((e) => ({ error: e.message })),
    ]);
    box.innerHTML = '';
    if (quote.error) {
      box.appendChild(el('div', {}, [el('b', {}, code), ` — ${quote.error}`]));
      return;
    }
    const changeColor = quote.change > 0 ? 'delta-up' : quote.change < 0 ? 'delta-down' : '';
    const prevClose = quote.closingPrice != null ? quote.closingPrice - quote.change : null;
    const changePct = prevClose ? (quote.change / prevClose) * 100 : null;
    const header = el('div', { style: 'display:flex;justify-content:space-between;align-items:flex-start' }, [
      el('div', {}, [
        el('div', { style: 'font-weight:800;font-size:16px' }, `${quote.name || code} (${code})`),
        el('div', { class: 'stat-tile' }, [
          el('span', { class: 'value' }, quote.closingPrice != null ? quote.closingPrice.toFixed(2) : '--'),
          el('span', { class: changeColor, style: 'margin-left:8px' },
            `${quote.change > 0 ? '▲+' : quote.change < 0 ? '▼' : ''}${quote.change}${changePct != null ? ` (${changePct > 0 ? '+' : ''}${changePct.toFixed(2)}%)` : ''}`),
        ]),
        el('div', { class: 'label' }, `收盤日期 ${quote.date || '--'} (每日盤後更新)`),
      ]),
      el('button', { class: 'btn btn-ghost', onclick: () => removeWatchStock(code) }, '移除'),
    ]);
    box.appendChild(header);

    // ---- 詳細數據格 (開高低量 + 估值) ----
    const kv = (k, v) => el('div', { class: 'kv' }, [el('div', { class: 'k' }, k), el('div', { class: 'v' }, v)]);
    const kvs = [
      kv('開盤', quote.openingPrice != null ? quote.openingPrice.toFixed(2) : '--'),
      kv('最高', quote.highestPrice != null ? quote.highestPrice.toFixed(2) : '--'),
      kv('最低', quote.lowestPrice != null ? quote.lowestPrice.toFixed(2) : '--'),
      kv('成交量', fmtNum(quote.tradeVolume) + ' 股'),
    ];
    if (!valuation.error && valuation && (valuation.peRatio != null || valuation.dividendYield != null || valuation.pbRatio != null)) {
      kvs.push(kv('本益比', valuation.peRatio != null ? valuation.peRatio.toFixed(2) : '--'));
      kvs.push(kv('殖利率', valuation.dividendYield != null ? valuation.dividendYield.toFixed(2) + '%' : '--'));
      kvs.push(kv('股價淨值比', valuation.pbRatio != null ? valuation.pbRatio.toFixed(2) : '--'));
      kvs.push(kv('振幅',
        quote.highestPrice != null && quote.lowestPrice != null && prevClose
          ? (((quote.highestPrice - quote.lowestPrice) / prevClose) * 100).toFixed(2) + '%' : '--'));
    }
    box.appendChild(el('div', { class: 'kv-grid' }, kvs));

    // ---- 股價走勢 + 均線圖 ----
    if (!historyRes.error && historyRes.points && historyRes.points.length >= 5) {
      const sec = el('div', { style: 'margin-top:14px;padding-top:12px;border-top:1px solid var(--grid-line)' }, [
        sectionTitle(`近 ${historyRes.points.length} 個交易日收盤走勢與均線`),
      ]);
      const chartDiv = el('div');
      sec.appendChild(chartDiv);
      box.appendChild(sec);
      renderPriceChart(chartDiv, historyRes.points);
    }

    // ---- 均線位置描述 (非預測) ----
    if (!indicatorRes.error && indicatorRes.indicator && indicatorRes.indicator.available) {
      const ind = indicatorRes.indicator;
      const badgeClass = ind.tone === 'positive' ? 'badge-positive' : ind.tone === 'negative' ? 'badge-negative' : 'badge-neutral';
      box.appendChild(el('div', { style: 'margin-top:10px' }, [
        el('span', { class: `badge ${badgeClass}` }, `均線位置：${ind.label}`),
        el('span', { style: 'margin-left:8px;font-size:12px;color:var(--text-muted)' }, `MA5 ${ind.ma5} / MA20 ${ind.ma20} (${ind.diffPct > 0 ? '+' : ''}${ind.diffPct}%)`),
        el('div', { style: 'font-size:11px;color:var(--text-muted);margin-top:4px' }, ind.disclaimer),
      ]));
    } else if (indicatorRes.indicator) {
      box.appendChild(el('div', { style: 'margin-top:10px;font-size:12px;color:var(--text-muted)' }, indicatorRes.indicator.reason || ''));
    }

    // ---- 法人動向 (合計圖 + 外資/投信/自營商 分項) ----
    if (!inst.error) {
      const badgeClass = inst.signal.tone === 'positive' ? 'badge-positive' : inst.signal.tone === 'negative' ? 'badge-negative' : 'badge-neutral';
      box.appendChild(el('div', { style: 'margin-top:14px;padding-top:12px;border-top:1px solid var(--grid-line)' }, [
        sectionTitle('三大法人買賣超 (近15個交易日)'),
        el('div', {}, [
          el('span', { class: `badge ${badgeClass}` }, inst.signal.label),
          el('span', { style: 'margin-left:8px;font-size:12px;color:var(--text-muted)' }, inst.signal.detail),
        ]),
      ]));
      const chartDiv = el('div', { style: 'margin-top:10px' });
      box.appendChild(chartDiv);
      renderDivergingChart(chartDiv, inst.trend);

      const last = inst.trend[inst.trend.length - 1];
      if (last && last.foreign != null) {
        const sum = (k) => inst.trend.reduce((s, t) => s + (t[k] || 0), 0);
        const chip = (label, today, cum) => el('div', { class: 'inst-chip' }, [
          el('div', { class: 'k' }, `${label} (最新交易日)`),
          el('div', { class: 'v', style: today >= 0 ? 'color:var(--series-blue)' : 'color:var(--series-red)' },
            `${today >= 0 ? '買超 +' : '賣超 '}${fmtNum(today)} 股`),
          el('div', { class: 'k' }, `近${inst.trend.length}日累計 ${cum >= 0 ? '+' : ''}${fmtNum(cum)}`),
        ]);
        box.appendChild(el('div', { class: 'inst-chips' }, [
          chip('外資', last.foreign, sum('foreign')),
          chip('投信', last.trust, sum('trust')),
          chip('自營商', last.dealer, sum('dealer')),
        ]));
      }
    }

    // ---- 相關新聞 ----
    if (!newsRes.error && newsRes.items && newsRes.items.length) {
      const newsBox = el('div', { style: 'margin-top:14px;padding-top:12px;border-top:1px solid var(--grid-line)' }, [
        sectionTitle('相關新聞 (來源: Yahoo奇摩股市)'),
      ]);
      newsRes.items.slice(0, 5).forEach((n) => {
        newsBox.appendChild(el('a', { href: n.link, target: '_blank', rel: 'noopener', style: 'display:block;font-size:12.5px;color:var(--series-blue);margin-bottom:5px;text-decoration:none' }, '· ' + n.title));
      });
      box.appendChild(newsBox);
    }
  } catch (e) {
    box.innerHTML = '';
    box.appendChild(el('div', {}, `${code} 載入失敗: ${e.message}`));
  }
}

// ===================== 交通與旅遊 =====================
const TRAVEL_SUB_TABS = [
  { key: 'train', label: '🚄 台鐵 / 高鐵' },
  { key: 'flight', label: '✈️ 機票' },
  { key: 'hotel', label: '🏨 住宿' },
  { key: 'itinerary', label: '🗺️ 行程規劃' },
];
let travelSubTab = 'train';

function switchTravelSub(key) {
  travelSubTab = key;
  renderTravel();
}

function renderTravel() {
  const c = $('#tab-travel');
  c.innerHTML = '';

  // 次分頁：把「火車 / 機票 / 住宿 / 行程規劃」分開，一次只看一個，不要全部塞在同一畫面
  c.appendChild(el('div', { class: 'subnav' }, TRAVEL_SUB_TABS.map((t) =>
    el('div', {
      class: `subnav-item${travelSubTab === t.key ? ' active' : ''}`,
      onclick: () => switchTravelSub(t.key),
    }, t.label)
  )));

  const panel = (key, children) => el('div', { class: `subpanel${travelSubTab === key ? ' active' : ''}` }, children);

  c.appendChild(panel('train', [
    el('div', { class: 'card' }, [
      el('h3', {}, '台鐵 / 高鐵 時刻搜尋'),
      el('p', { class: 'hint' }, '資料來源：交通部 TDX 運輸資料流通服務。僅提供時刻/誤點/票價區間查詢，實際訂票請至官方售票網站。'),
      el('div', { class: 'form-row' }, [
        el('select', { id: 'trainMode' }, [el('option', { value: 'tra' }, '台鐵 TRA'), el('option', { value: 'thsr' }, '高鐵 THSR')]),
        el('input', { id: 'stationName', placeholder: '出發站，如 台北' }),
        el('input', { id: 'stationTo', placeholder: '目的站，如 台中' }),
        el('input', { id: 'trainDate', type: 'date', value: todayStr() }),
      ]),
      el('div', { class: 'form-row' }, [
        el('input', { id: 'timeFrom', type: 'time', value: '06:00' }),
        el('span', { style: 'align-self:center;color:var(--text-muted)' }, '～'),
        el('input', { id: 'timeTo', type: 'time', value: '22:00' }),
        el('input', { id: 'trainNoSearch', placeholder: '搜尋車次號碼 (選填)' }),
        el('button', { class: 'btn btn-primary', onclick: searchTrain }, '查詢'),
      ]),
      el('div', { id: 'trainResult' }),
    ]),
    el('div', { class: 'card' }, [
      el('h3', {}, '⭐ 我的收藏車次'),
      el('p', { class: 'hint' }, '收藏常搭的車次，下次不用重新查詢。'),
      el('div', { id: 'favoriteTrainsArea' }),
    ]),
  ]));

  c.appendChild(panel('flight', [
    el('div', { class: 'card' }, [
      el('h3', {}, '機票 — 各家航空公司/比價網站'),
      el('p', { class: 'hint' }, '目前沒有免費即時比價 API，這裡改用「深連結」方式：點下去會直接跳到該網站，並幫你帶入出發地/目的地/日期。真正一頁比全部價格需要另外申請商業合作 API。'),
      el('div', { class: 'form-row' }, [
        el('input', { id: 'flyFrom', placeholder: '出發地，如 台北' }),
        el('input', { id: 'flyTo', placeholder: '目的地，如 大阪' }),
        el('input', { id: 'flyDate', type: 'date' }),
        el('button', { class: 'btn btn-primary', onclick: searchFlightProviders }, '列出各家連結' ),
      ]),
      el('div', { id: 'flightResult' }),
    ]),
  ]));

  c.appendChild(panel('hotel', [
    el('div', { class: 'card' }, [
      el('h3', {}, '住宿 — 各家訂房網站'),
      el('div', { class: 'form-row' }, [
        el('input', { id: 'hotelCity', placeholder: '城市，如 大阪' }),
        el('input', { id: 'hotelCheckin', type: 'date' }),
        el('input', { id: 'hotelCheckout', type: 'date' }),
        el('button', { class: 'btn btn-primary', onclick: searchHotelProviders }, '列出各家連結'),
      ]),
      el('div', { id: 'hotelResult' }),
    ]),
  ]));

  c.appendChild(panel('itinerary', [
    el('div', { class: 'card' }, [
      el('h3', {}, '智慧行程規劃'),
      el('p', { class: 'hint' }, '輸入出發地、目的地與天數，產生行程草案；若目的地或出發地是已收錄城市 (目前：台中、新北)，會額外附上精選景點/美食/休閒推薦。'),
      el('div', { class: 'form-row' }, [
        el('input', { id: 'tripFrom', placeholder: '出發地' }),
        el('input', { id: 'tripTo', placeholder: '目的地' }),
        el('input', { id: 'tripDays', type: 'number', value: 3, min: 1, max: 14 }),
        el('button', { class: 'btn btn-primary', onclick: generateItinerary }, '產生行程'),
      ]),
      el('div', { id: 'itineraryResult' }),
    ]),
  ]));

  if (travelSubTab === 'train') loadFavoriteTrains();
}

const PROVIDER_COLORS = ['--series-blue', '--series-orange', '--series-aqua', '--series-violet', '--series-magenta', '--series-yellow'];
function providerList(providers) {
  return el('div', {}, providers.map((p, i) => el('a', { href: p.url, target: '_blank', rel: 'noopener', class: 'provider-item' }, [
    el('div', { class: 'p-left' }, [
      el('div', { class: 'p-avatar', style: `background:${cssVar(PROVIDER_COLORS[i % PROVIDER_COLORS.length])}` }, p.name.replace(/^[^一-龥A-Za-z]*/, '').slice(0, 1).toUpperCase()),
      el('div', {}, [
        el('div', { class: 'p-name' }, [
          p.name,
          el('span', { class: p.prefill ? 'tag tag-fill' : 'tag tag-manual' }, p.prefill ? '已帶入條件' : '需自行輸入'),
        ]),
        el('div', { class: 'p-note' }, p.note),
      ]),
    ]),
    el('span', { class: 'p-go' }, '前往 →'),
  ])));
}

async function searchTrain() {
  const mode = $('#trainMode').value;
  const station = $('#stationName').value.trim();
  const to = $('#stationTo').value.trim();
  const date = $('#trainDate').value;
  const timeFrom = $('#timeFrom').value;
  const timeTo = $('#timeTo').value;
  const trainNo = $('#trainNoSearch').value.trim();
  const resultBox = $('#trainResult');
  if (!station) return;
  resultBox.innerHTML = '查詢中...';
  try {
    const qs = new URLSearchParams({ station, to, date, timeFrom, timeTo, trainNo }).toString();
    const data = await api(`/travel/train/${mode}/board?${qs}`);
    resultBox.innerHTML = '';
    if (data.isDemo) resultBox.appendChild(el('div', { class: 'disclaimer' }, data.notice));
    if (data.trains) {
      if (!data.trains.length) { resultBox.appendChild(el('div', { class: 'empty-state' }, '這個時間範圍沒有符合的車次')); return; }
      const rows = data.trains.map((t) => el('tr', {}, [
        el('td', {}, t.trainNo),
        el('td', {}, t.departure),
        el('td', {}, t.arrival || '--'),
        el('td', {}, t.fare != null ? fmtMoney(t.fare) : '--'),
        el('td', {}, t.status),
        el('td', {}, el('button', { class: 'btn btn-ghost', onclick: () => favoriteTrain(mode, t, station, to) }, '⭐ 收藏')),
      ]));
      resultBox.appendChild(el('table', {}, [
        el('thead', {}, el('tr', {}, [el('th', {}, '車次'), el('th', {}, '出發'), el('th', {}, '到達'), el('th', {}, '票價(估)'), el('th', {}, '狀態'), el('th', {}, '')])),
        el('tbody', {}, rows),
      ]));
    } else if (data.raw) {
      resultBox.appendChild(el('pre', { style: 'font-size:11px;white-space:pre-wrap' }, JSON.stringify(data.raw, null, 2).slice(0, 3000)));
    }
  } catch (e) { resultBox.innerHTML = `查詢失敗: ${e.message}`; }
}

async function favoriteTrain(mode, train, fromStation, toStation) {
  try {
    await api('/travel/train/favorites', {
      method: 'POST',
      body: { mode, trainNo: train.trainNo, fromStation, toStation, departureTime: train.departure },
    });
    showToast('已收藏車次');
    loadFavoriteTrains();
  } catch (e) { showToast('收藏失敗: ' + e.message); }
}

async function loadFavoriteTrains() {
  const area = $('#favoriteTrainsArea');
  if (!area) return;
  try {
    const rows = await api('/travel/train/favorites');
    area.innerHTML = '';
    if (!rows.length) { area.appendChild(el('div', { class: 'empty-state' }, '還沒有收藏的車次')); return; }
    rows.forEach((r) => {
      area.appendChild(el('div', { style: 'display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--grid-line)' }, [
        el('div', { style: 'font-size:13px' }, `${r.mode === 'THSR' ? '高鐵' : '台鐵'} ${r.train_no} · ${r.from_station}${r.to_station ? ' → ' + r.to_station : ''} · ${r.departure_time || ''}`),
        el('button', { class: 'btn btn-ghost', onclick: () => deleteFavoriteTrain(r.id) }, '移除'),
      ]));
    });
  } catch (e) { area.innerHTML = ''; }
}
async function deleteFavoriteTrain(id) {
  await api(`/travel/train/favorites/${id}`, { method: 'DELETE' });
  loadFavoriteTrains();
}

async function searchFlightProviders() {
  const from = $('#flyFrom').value.trim(), to = $('#flyTo').value.trim(), date = $('#flyDate').value;
  const box = $('#flightResult');
  if (!from || !to) return;
  box.innerHTML = '載入中...';
  try {
    const data = await api(`/travel/flights/providers?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&date=${date || ''}`);
    box.innerHTML = '';
    box.appendChild(providerList(data.providers));
  } catch (e) { box.innerHTML = `載入失敗: ${e.message}`; }
}

async function searchHotelProviders() {
  const city = $('#hotelCity').value.trim();
  const checkin = $('#hotelCheckin').value, checkout = $('#hotelCheckout').value;
  const box = $('#hotelResult');
  if (!city) return;
  box.innerHTML = '載入中...';
  try {
    const data = await api(`/travel/hotels/providers?city=${encodeURIComponent(city)}&checkin=${checkin || ''}&checkout=${checkout || ''}`);
    box.innerHTML = '';
    box.appendChild(providerList(data.providers));
  } catch (e) { box.innerHTML = `載入失敗: ${e.message}`; }
}

async function generateItinerary() {
  const from = $('#tripFrom').value.trim(), to = $('#tripTo').value.trim(), days = $('#tripDays').value;
  const box = $('#itineraryResult');
  if (!from || !to) return;
  box.innerHTML = '規劃中...';
  try {
    const data = await api('/travel/itinerary', { method: 'POST', body: { from, to, days } });
    box.innerHTML = '';
    box.appendChild(el('p', { class: 'hint' }, data.disclaimer));
    data.plan.forEach((d) => {
      box.appendChild(el('div', { style: 'margin-bottom:10px' }, [el('b', {}, d.title), el('div', { style: 'font-size:13px;color:var(--text-secondary)' }, d.suggestion)]));
    });
    if (data.curated) {
      box.appendChild(el('div', { style: 'margin-top:14px;padding-top:14px;border-top:1px solid var(--grid-line)' }, [
        el('div', { style: 'font-weight:700;margin-bottom:4px' }, `📍 ${data.curated.city} 精選推薦`),
        el('p', { class: 'hint' }, data.curated.sourceNote),
      ]));
      Object.entries(data.curated.categories).forEach(([cat, items]) => {
        const wrap = el('div', { style: 'margin-bottom:10px' }, [el('div', { style: 'font-size:13px;font-weight:600;margin-bottom:4px' }, cat)]);
        items.forEach((it) => {
          wrap.appendChild(el('div', { style: 'font-size:13px;margin-bottom:4px' }, [
            el('b', {}, it.name), el('span', { style: 'color:var(--text-muted)' }, ` — ${it.note}`),
          ]));
        });
        box.appendChild(wrap);
      });
    }
  } catch (e) { box.innerHTML = `規劃失敗: ${e.message}`; }
}

// ===================== 日記 =====================
function todayStr() { return new Date().toISOString().slice(0, 10); }
function renderDiary() {
  const c = $('#tab-diary');
  c.innerHTML = '';
  c.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, '寫日記'),
    el('div', { class: 'form-row' }, [
      el('input', { id: 'diaryDate', type: 'date', value: todayStr(), onchange: loadDiaryForDate }),
      el('label', { class: 'btn btn-ghost', style: 'cursor:pointer' }, [
        '📂 從本機檔案匯入文字',
        el('input', { type: 'file', accept: '.txt,.md', style: 'display:none', onchange: importDiaryFile }),
      ]),
    ]),
    el('textarea', { id: 'diaryContent', rows: 10, placeholder: '今天發生了什麼事...' }),
    el('div', { style: 'margin-top:10px' }, el('button', { class: 'btn btn-primary', onclick: saveDiary }, '儲存')),
  ]));
  c.appendChild(el('div', { class: 'card' }, [el('h3', {}, '最近的日記'), el('div', { id: 'diaryList' })]));
  loadDiaryForDate();
  loadDiaryList();
}
async function loadDiaryForDate() {
  const date = $('#diaryDate').value;
  try {
    const row = await api(`/diary/${date}`);
    $('#diaryContent').value = row ? row.content : '';
  } catch (e) { $('#diaryContent').value = ''; }
}
async function saveDiary() {
  const date = $('#diaryDate').value;
  const content = $('#diaryContent').value;
  try {
    await api(`/diary/${date}`, { method: 'PUT', body: { content } });
    showToast('已儲存');
    loadDiaryList();
  } catch (e) { showToast('儲存失敗: ' + e.message); }
}
function importDiaryFile(ev) {
  const file = ev.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => { $('#diaryContent').value = reader.result; };
  reader.readAsText(file, 'utf-8');
}
async function loadDiaryList() {
  const list = $('#diaryList');
  list.innerHTML = '載入中...';
  try {
    const rows = await api('/diary');
    list.innerHTML = '';
    if (!rows.length) { list.appendChild(el('div', { class: 'empty-state' }, '還沒有日記')); return; }
    rows.slice(0, 10).forEach((r) => {
      list.appendChild(el('div', { style: 'padding:8px 0;border-bottom:1px solid var(--grid-line)' }, [
        el('b', {}, r.entry_date), el('div', { style: 'font-size:13px;color:var(--text-secondary)' }, (r.content || '').slice(0, 80)),
      ]));
    });
  } catch (e) { list.innerHTML = '載入失敗'; }
}

// ===================== 記帳 =====================
function renderFinance() {
  const c = $('#tab-finance');
  c.innerHTML = '';
  c.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, '新增一筆記帳'),
    el('p', { class: 'hint' }, '目前為手動輸入金額；即時銀行帳戶餘額串接屬於台灣「Open Banking」範疇，需金融機構/金管會核准的第三方資格，暫未開放，詳見規劃書說明。'),
    el('div', { class: 'form-row' }, [
      el('input', { id: 'txDate', type: 'date', value: todayStr() }),
      el('select', { id: 'txType' }, [el('option', { value: 'expense' }, '支出'), el('option', { value: 'income' }, '收入')]),
      el('input', { id: 'txCategory', placeholder: '分類，如 餐飲/交通/娛樂' }),
      el('input', { id: 'txAmount', type: 'number', placeholder: '金額' }),
    ]),
    el('div', { class: 'form-row' }, [el('input', { id: 'txNote', placeholder: '備註 (選填)' })]),
    el('button', { class: 'btn btn-primary', onclick: addTransaction }, '新增'),
  ]));

  c.appendChild(el('div', { class: 'grid-2' }, [
    el('div', { class: 'card' }, [el('h3', {}, '本月支出分類'), el('div', { id: 'financeBarChart' })]),
    el('div', { class: 'card' }, [el('h3', {}, '近12個月收支趨勢'), el('div', { id: 'financeLineChart' })]),
  ]));

  c.appendChild(el('div', { class: 'card' }, [el('h3', {}, '本月明細'), el('div', { id: 'txTable' })]));

  loadFinance();
}

async function addTransaction() {
  const body = {
    tx_date: $('#txDate').value,
    type: $('#txType').value,
    category: $('#txCategory').value.trim() || '未分類',
    amount: Number($('#txAmount').value),
    note: $('#txNote').value.trim(),
  };
  if (!body.amount) { showToast('請輸入金額'); return; }
  try {
    await api('/finance/transactions', { method: 'POST', body });
    $('#txCategory').value = ''; $('#txAmount').value = ''; $('#txNote').value = '';
    showToast('已新增');
    loadFinance();
  } catch (e) { showToast('新增失敗: ' + e.message); }
}
async function deleteTransaction(id) {
  await api(`/finance/transactions/${id}`, { method: 'DELETE' });
  loadFinance();
}

async function loadFinance() {
  try {
    const summary = await api('/finance/summary');
    const expenseByCat = summary.byCategory.filter((r) => r.type === 'expense').map((r) => ({ label: r.category, value: r.total }));
    renderBarChart($('#financeBarChart'), expenseByCat, { money: true, emptyText: '本月尚無支出紀錄' });

    const months = [...new Set(summary.monthlyTrend.map((r) => r.ym))];
    const income = months.map((m) => ({ x: m, y: (summary.monthlyTrend.find((r) => r.ym === m && r.type === 'income') || {}).total || 0 }));
    const expense = months.map((m) => ({ x: m, y: (summary.monthlyTrend.find((r) => r.ym === m && r.type === 'expense') || {}).total || 0 }));
    renderLineChart($('#financeLineChart'), [
      { name: '收入', color: cssVar('--series-blue'), points: income },
      { name: '支出', color: cssVar('--series-red'), points: expense },
    ]);

    const rows = await api('/finance/transactions?month=' + new Date().toISOString().slice(0, 7));
    const table = $('#txTable');
    table.innerHTML = '';
    if (!rows.length) { table.appendChild(el('div', { class: 'empty-state' }, '本月尚無紀錄')); return; }
    const trs = rows.map((r) => el('tr', {}, [
      el('td', {}, r.tx_date), el('td', {}, r.type === 'income' ? '收入' : '支出'), el('td', {}, r.category),
      el('td', { style: r.type === 'income' ? 'color:var(--good)' : 'color:var(--critical)' }, fmtMoney(r.amount)),
      el('td', {}, r.note || ''),
      el('td', {}, el('button', { class: 'btn btn-ghost', onclick: () => deleteTransaction(r.id) }, '刪除')),
    ]));
    table.appendChild(el('table', {}, [
      el('thead', {}, el('tr', {}, [el('th', {}, '日期'), el('th', {}, '類型'), el('th', {}, '分類'), el('th', {}, '金額'), el('th', {}, '備註'), el('th', {}, '')])),
      el('tbody', {}, trs),
    ]));
  } catch (e) { showToast('載入記帳資料失敗: ' + e.message); }
}

// ===================== 行事曆 =====================
function renderCalendar() {
  const c = $('#tab-calendar');
  c.innerHTML = '';
  c.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, '新增行程'),
    el('div', { class: 'form-row' }, [
      el('input', { id: 'calDate', type: 'date', value: todayStr() }),
      el('input', { id: 'calTime', type: 'time' }),
      el('input', { id: 'calTitle', placeholder: '要做什麼事？' }),
    ]),
    el('div', { class: 'form-row' }, [el('input', { id: 'calNote', placeholder: '備註 (選填)' })]),
    el('button', { class: 'btn btn-primary', onclick: addCalendarEvent }, '新增'),
  ]));
  c.appendChild(el('div', { class: 'card' }, [el('h3', {}, '未來的行程'), el('div', { id: 'calendarList' })]));
  loadCalendarEvents();
}
async function addCalendarEvent() {
  const body = {
    event_date: $('#calDate').value,
    start_time: $('#calTime').value,
    title: $('#calTitle').value.trim(),
    note: $('#calNote').value.trim(),
  };
  if (!body.event_date || !body.title) { showToast('請至少填日期與事項'); return; }
  try {
    await api('/calendar', { method: 'POST', body });
    $('#calTitle').value = ''; $('#calNote').value = ''; $('#calTime').value = '';
    showToast('已新增行程');
    loadCalendarEvents();
  } catch (e) { showToast('新增失敗: ' + e.message); }
}
async function deleteCalendarEvent(id) {
  await api(`/calendar/${id}`, { method: 'DELETE' });
  loadCalendarEvents();
}
async function loadCalendarEvents() {
  const list = $('#calendarList');
  list.innerHTML = '載入中...';
  try {
    const rows = await api('/calendar');
    list.innerHTML = '';
    if (!rows.length) { list.appendChild(el('div', { class: 'empty-state' }, '還沒有安排任何行程')); return; }
    const byDate = {};
    rows.forEach((r) => { (byDate[r.event_date] = byDate[r.event_date] || []).push(r); });
    Object.keys(byDate).sort().forEach((date) => {
      list.appendChild(el('div', { style: 'font-weight:700;margin:10px 0 4px' }, date));
      byDate[date].forEach((r) => {
        list.appendChild(el('div', { style: 'display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--grid-line)' }, [
          el('div', {}, [
            el('span', { style: 'color:var(--series-blue);font-weight:600;margin-right:8px' }, r.start_time || '全天'),
            el('span', {}, r.title),
            r.note ? el('div', { style: 'font-size:12px;color:var(--text-muted)' }, r.note) : null,
          ]),
          el('button', { class: 'btn btn-ghost', onclick: () => deleteCalendarEvent(r.id) }, '刪除'),
        ]));
      });
    });
  } catch (e) { list.innerHTML = '載入失敗'; }
}

// ===================== AI 助理 =====================
if (!state.assistantHistory) state.assistantHistory = [];
function renderAssistant() {
  const c = $('#tab-assistant');
  c.innerHTML = '';
  c.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, '💬 AI 助理'),
    el('p', { class: 'hint' }, '可以問生活規劃、旅遊行程、記帳建議、股票資訊解讀、翻譯、食譜、單位換算等任何問題。需要在伺服器 .env 設定 ANTHROPIC_API_KEY 才能真正對話。'),
    el('div', { id: 'assistantMessages', class: 'chat-box' }),
    el('div', { class: 'form-row' }, [
      el('input', { id: 'assistantInput', placeholder: '輸入訊息，按 Enter 送出', onkeydown: (ev) => { if (ev.key === 'Enter') sendAssistantMessage(); } }),
      el('button', { class: 'btn btn-primary', onclick: sendAssistantMessage }, '送出'),
    ]),
  ]));
  renderAssistantMessages();
}
function renderAssistantMessages() {
  const box = $('#assistantMessages');
  if (!box) return;
  box.innerHTML = '';
  if (!state.assistantHistory.length) {
    box.appendChild(el('div', { class: 'empty-state' }, '還沒有對話，輸入訊息開始聊天吧'));
    return;
  }
  state.assistantHistory.forEach((m) => {
    box.appendChild(el('div', { class: 'chat-msg ' + (m.role === 'user' ? 'chat-user' : 'chat-ai') }, m.content));
  });
  box.scrollTop = box.scrollHeight;
}
async function sendAssistantMessage() {
  const input = $('#assistantInput');
  const text = input.value.trim();
  if (!text) return;
  state.assistantHistory.push({ role: 'user', content: text });
  input.value = '';
  renderAssistantMessages();
  try {
    const res = await api('/assistant/chat', { method: 'POST', body: { history: state.assistantHistory } });
    state.assistantHistory.push({ role: 'assistant', content: res.reply });
    renderAssistantMessages();
  } catch (e) {
    state.assistantHistory.push({ role: 'assistant', content: '發生錯誤: ' + e.message });
    renderAssistantMessages();
  }
}

// ===================== 個人化設定 =====================
function renderSettings() {
  const c = $('#tab-settings');
  c.innerHTML = '';
  const modules = ['stocks', 'travel', 'diary', 'finance'];
  const labels = { stocks: '股票', travel: '交通與旅遊', diary: '日記', finance: '記帳' };
  const enabled = (state.prefs && state.prefs.enabledModules) || {};

  const rows = modules.map((m) => el('div', { class: 'module-toggle-row' }, [
    el('span', {}, labels[m]),
    el('label', { class: 'switch' }, [
      el('input', { type: 'checkbox', checked: enabled[m] !== false, onchange: (ev) => toggleModule(m, ev.target.checked) }),
      el('span', { class: 'slider' }),
    ]),
  ]));
  c.appendChild(el('div', { class: 'card' }, [el('h3', {}, '首頁模組顯示設定'), el('p', { class: 'hint' }, '關閉的模組仍可從左側選單進入，只是不會出現在首頁摘要。'), ...rows]));
}
async function toggleModule(name, val) {
  state.prefs.enabledModules = { ...(state.prefs.enabledModules || {}), [name]: val };
  await api('/prefs', { method: 'PUT', body: state.prefs });
  showToast('已更新設定');
}

// ===================== Debug 面板 =====================
async function showDebug() {
  const token = prompt('輸入 Debug Token (見伺服器 .env 的 DEBUG_TOKEN)：');
  if (token == null) return;
  try {
    const res = await fetch('/api/debug', { headers: { 'X-Debug-Token': token } });
    const data = await res.json();
    if (!res.ok) { showToast(data.error || '驗證失敗'); return; }
    alert(JSON.stringify(data, null, 2).slice(0, 4000));
  } catch (e) { showToast('取得系統狀態失敗'); }
}

// ===================== 啟動 =====================
(async function boot() {
  try {
    const { user } = await api('/auth/me');
    if (user) onAuthed(user);
    else {
      const health = await api('/health');
      $('#appVersion').textContent = health.version;
    }
  } catch (e) {}
})();
