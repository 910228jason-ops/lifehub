// ===================== 共用工具 =====================
const state = { user: null, prefs: null, watchlist: ['2330', '2317', '0050'] };

// ===================== 深色模式 =====================
// theme 存的是使用者「選擇」：'light' / 'dark' / 'auto' (跟著系統)。
// 還沒登入 (登入畫面) 或帳號設定還沒抓回來之前，沒有帳號層級的偏好可以參考，先跟著系統。
function computeEffectiveTheme(pref) {
  if (pref === 'dark') return 'dark';
  if (pref === 'light') return 'light';
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
}
function applyTheme(pref) {
  const effective = computeEffectiveTheme(pref);
  if (effective === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  else document.documentElement.removeAttribute('data-theme');
}
applyTheme('auto'); // 登入畫面先跟著系統偏好，登入後會再套用這個帳號自己存的設定
if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    // 只有選「自動」的人需要跟著系統即時切換；已經手動選了淺色/深色的人不應該被打擾
    if (!state.prefs || state.prefs.theme === 'auto' || !state.prefs.theme) applyTheme('auto');
  });
}
async function setThemePref(pref) {
  applyTheme(pref);
  if (!state.prefs) return;
  state.prefs.theme = pref;
  try { await api('/prefs', { method: 'PUT', body: state.prefs }); } catch (e) {}
  renderSettings();
}

// ===================== 側欄收合 =====================
function toggleSidebar() {
  const sb = $('#sidebar');
  const collapsed = sb.classList.toggle('collapsed');
  $('#sidebarToggle').textContent = collapsed ? '▸' : '◂';
  try { localStorage.setItem('lifehub_sidebar_collapsed', collapsed ? '1' : '0'); } catch (e) {}
}
function restoreSidebarState() {
  try {
    if (localStorage.getItem('lifehub_sidebar_collapsed') === '1') {
      $('#sidebar').classList.add('collapsed');
      $('#sidebarToggle').textContent = '▸';
    }
  } catch (e) {}
}

// ===================== 星空背景 =====================
function initStarfield() {
  const canvas = $('#starfield');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let stars = [];
  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const count = Math.round((canvas.width * canvas.height) / 9000);
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.3 + 0.3,
      base: Math.random() * 0.5 + 0.25,
      speed: Math.random() * 0.015 + 0.004,
      phase: Math.random() * Math.PI * 2,
    }));
  }
  function draw(t) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#eaf0fb';
    stars.forEach((s) => {
      const twinkle = reduceMotion ? s.base : s.base + Math.sin(t * s.speed + s.phase) * 0.35;
      ctx.globalAlpha = Math.max(0.08, Math.min(1, twinkle));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    if (!reduceMotion) requestAnimationFrame(draw);
  }
  window.addEventListener('resize', resize);
  resize();
  draw(0);
}

function $(sel) { return document.querySelector(sel); }
function el(tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  // 像 checked/selected/disabled 這種布林屬性，HTML 只看「有沒有這個屬性」不看值，
  // 所以 setAttribute(k, false) 還是會被瀏覽器當成「有設定」而顯示成 checked/selected/disabled，
  // 這裡特別處理：值是 false 就整個不設定，值是 true 就設成空字串。
  const BOOLEAN_ATTRS = new Set(['checked', 'selected', 'disabled', 'readonly', 'required', 'multiple']);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (BOOLEAN_ATTRS.has(k)) { if (v) e.setAttribute(k, ''); }
    else e.setAttribute(k, v);
  });
  // 防呆：children 只要不是「已經是 DOM Node」的東西 (例如不小心直接塞了數字、布林值)，
  // 一律轉成文字節點，不要讓 appendChild 直接炸掉 (之前選股工具的漲跌欄位就是踩到這個)。
  (Array.isArray(children) ? children : [children]).forEach((c) => {
    if (c == null) return;
    e.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  });
  return e;
}
// 骨架屏 (skeleton) 載入佔位：取代單純的「載入中...」文字，用會閃爍的灰色色塊模擬
// 內容大概的形狀，視覺上比較不會有「卡住了」的感覺，也更像原生 App 常見的載入手感。
function skeletonLines(n = 2) {
  const wrap = el('div', { class: 'skeleton-wrap' });
  for (let i = 0; i < n; i++) {
    wrap.appendChild(el('div', { class: 'skeleton-line' + (i === n - 1 ? ' short' : '') }));
  }
  return wrap;
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
// 旅遊分帳可能不是台幣計價 (例如整趟旅程用日圓結算)，這裡不能寫死 NT$，要照旅程的 base_currency 顯示
function fmtCurrency(n, currency) { return `${currency || 'TWD'} ${Number(n || 0).toLocaleString('zh-Hant-TW')}`; }

// ===================== Auth =====================
function toggleAuth(showRegister) {
  $('#loginForm').style.display = showRegister ? 'none' : 'block';
  $('#registerForm').style.display = showRegister ? 'block' : 'none';
  $('#forgotPasswordForm').style.display = 'none';
}
function toggleForgotPassword(show) {
  $('#loginForm').style.display = show ? 'none' : 'block';
  $('#registerForm').style.display = 'none';
  $('#forgotPasswordForm').style.display = show ? 'block' : 'none';
  $('#fpError').textContent = '';
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
    await onAuthed(user);
    // 這組備用重設碼只會在這次回應出現一次，之後就只存雜湊值、拿不回明碼了，
    // 一定要在進到首頁之後馬上跳出來提醒使用者記下來。要等 onAuthed 回傳的 promise
    // 完成 (代表 switchTab('dashboard') 也跑完了)，不然彈窗會被 switchTab 內建的
    // closeSheet() 立刻關掉。
    if (user.recoveryCode) showRecoveryCodeModal(user.recoveryCode, true);
  } catch (e) { $('#regError').textContent = e.message; }
}
async function doForgotPassword() {
  $('#fpError').textContent = '';
  const email = $('#fpEmail').value.trim();
  const recoveryCode = $('#fpCode').value.trim();
  const newPassword = $('#fpNewPassword').value;
  if (!email || !recoveryCode || !newPassword) { $('#fpError').textContent = '請填寫全部欄位'; return; }
  try {
    await api('/auth/forgot-password', { method: 'POST', body: { email, recoveryCode, newPassword } });
    showToast('密碼已重設，請用新密碼登入');
    $('#loginEmail').value = email;
    $('#fpEmail').value = ''; $('#fpCode').value = ''; $('#fpNewPassword').value = '';
    toggleForgotPassword(false);
  } catch (e) { $('#fpError').textContent = e.message; }
}

// 顯示備用重設碼的彈窗 (共用底部彈窗元件)。isNew=true 代表這是「剛註冊/剛重新產生」的
// 第一次顯示，文案會特別強調「只會顯示這一次」。
function showRecoveryCodeModal(code, isNew) {
  openSheet('備用重設碼', () => {
    const wrap = el('div', { class: 'recovery-code-modal' });
    wrap.appendChild(el('p', { class: 'hint' },
      isNew
        ? '請把下面這組重設碼記下來 (截圖或存到密碼管理器)，之後忘記密碼時要用它 + email 才能自己重設密碼。這組碼「只會顯示這一次」，離開這個畫面後就看不到明碼了。'
        : '這是剛剛重新產生的新重設碼，一樣只會顯示這一次，請立刻記下來。舊的重設碼已經失效。'
    ));
    const codeBox = el('div', { class: 'recovery-code-box' }, code);
    wrap.appendChild(codeBox);
    wrap.appendChild(el('button', {
      class: 'btn btn-ghost recovery-copy-btn',
      onclick: async () => {
        try { await navigator.clipboard.writeText(code); showToast('已複製到剪貼簿'); }
        catch (e) { showToast('複製失敗，請手動選取文字'); }
      },
    }, '📋 複製'));
    wrap.appendChild(el('button', { class: 'btn btn-primary recovery-confirm-btn', onclick: () => closeSheet() }, '我已經記下來了'));
    return wrap;
  });
}
async function doLogout() {
  await api('/auth/logout', { method: 'POST' });
  state.user = null;
  $('#shell').style.display = 'none';
  $('#authScreen').style.display = 'flex';
  toggleAuth(false); // 回到登入畫面，不要停留在登出前剛好開著的註冊/忘記密碼表單
}
function onAuthed(user) {
  state.user = user;
  $('#authScreen').style.display = 'none';
  $('#shell').style.display = 'flex';
  $('#userName').textContent = user.name;
  $('#userAvatar').textContent = (user.name || '?').slice(0, 1).toUpperCase();
  restoreSidebarState();
  // 回傳這個 promise 是為了讓呼叫的地方 (例如註冊後要跳出備用重設碼彈窗) 可以先
  // await 到「首頁真的載入完成、switchTab('dashboard') 也跑完」之後再開自己的彈窗——
  // 不然 switchTab 內建會呼叫 closeSheet()，時間點沒抓好的話，剛開的彈窗會立刻被關掉。
  return loadPrefsAndBoot();
}
initStarfield();

async function loadPrefsAndBoot() {
  try {
    state.prefs = await api('/prefs');
    if (state.prefs.watchlist && state.prefs.watchlist.length) state.watchlist = state.prefs.watchlist;
  } catch (e) { /* 忽略，用預設值 */ }
  applyTheme(state.prefs && state.prefs.theme);
  currentTab = null; // 確保登入後第一次進首頁也會正確設定網址列 hash
  try { history.replaceState({ tab: 'dashboard' }, '', '#dashboard'); } catch (e) {}
  switchTab('dashboard'); // switchTab 現在會自己呼叫 renderDashboard()，這裡不用再手動呼叫一次
  try {
    const health = await api('/health');
    $('#appVersion').textContent = health.version;
  } catch (e) {}
  checkMoodReminder();
  checkGeneralReminders();
  registerPushServiceWorker();
}

// 如果是從別的地方帶著 hash 網址進來 (或按了瀏覽器上一頁/下一頁)，切到對應分頁。
// 注意：LifeHub 切分頁本身不會往 history 疊新的一筆 (見 switchTab 內的說明)，
// 所以這個監聽平常幾乎不會被自己的分頁切換觸發到，只處理「真的有網址列 history 變化」的情況。
window.addEventListener('popstate', (ev) => {
  if (!state.user) return; // 還沒登入時 (auth 畫面) 不處理，避免誤動作
  const tab = (ev.state && ev.state.tab) || 'dashboard';
  switchTab(tab, { fromPopstate: true });
});

// ---------- 站內提醒強化 ----------
// 除了首頁/心情頁面上的關心 banner，這裡再加兩層：
//   1) 側邊欄「心情陪伴」旁邊的小紅點，不管現在在哪個分頁都看得到，不用特地點進心情頁才知道。
//   2) 瀏覽器原生通知 (需要使用者自己按同意)，一天最多提醒一次，避免打擾。
async function checkMoodReminder() {
  try {
    const summary = await api('/mood/summary?days=7');
    const navItem = $('#navMoodItem');
    if (navItem) {
      const existingDot = navItem.querySelector('.nav-alert-dot');
      if (summary.careMessage) {
        if (!existingDot) navItem.appendChild(el('span', { class: 'nav-alert-dot' }));
      } else if (existingDot) {
        existingDot.remove();
      }
    }
    if (summary.careMessage && 'Notification' in window && Notification.permission === 'granted') {
      const lastNotified = localStorage.getItem('lifehub_mood_reminder_date');
      const today = todayStr();
      if (lastNotified !== today) {
        new Notification('LifeHub 心情陪伴', { body: summary.careMessage, icon: undefined });
        localStorage.setItem('lifehub_mood_reminder_date', today);
      }
    }
  } catch (e) { /* 提醒功能失敗不影響主要功能，安靜跳過 */ }
}

async function enableMoodBrowserNotification() {
  if (!('Notification' in window)) { showToast('這個瀏覽器不支援通知功能'); return; }
  const perm = await Notification.requestPermission();
  if (perm === 'granted') {
    showToast('已開啟瀏覽器通知，心情需要關心時會提醒你');
    checkMoodReminder();
    checkGeneralReminders();
  } else {
    showToast('沒有開啟通知權限，之後可以在瀏覽器設定裡再打開');
  }
}

// ---------- 主動式提醒：側欄紅點 + 瀏覽器通知 ----------
// 跟上面的心情提醒是同一套機制、同一組瀏覽器通知權限，這裡把範圍擴大到帳單/待辦/預算。
// 注意：這裡用的是 Notification API 的「前景通知」，只有在這個分頁/App 開著的時候才會跳出來，
// 手機螢幕熄滅或 App 被關掉時不會收到——這需要 Service Worker + Web Push 才做得到，是完全
// 不同的機制 (見 sidebar 個人化設定頁的說明)，目前還沒做。
async function checkGeneralReminders() {
  try {
    const data = await api('/insights/reminders');
    const items = data.items || [];
    const byTab = {};
    items.forEach((it) => { byTab[it.tab] = (byTab[it.tab] || 0) + 1; });
    ['bills', 'tasks'].forEach((tabKey) => {
      const navItem = document.querySelector(`.nav-item[data-tab="${tabKey}"]`);
      if (!navItem) return;
      const existingDot = navItem.querySelector('.nav-alert-dot');
      if (byTab[tabKey]) {
        if (!existingDot) navItem.appendChild(el('span', { class: 'nav-alert-dot' }));
      } else if (existingDot) {
        existingDot.remove();
      }
    });

    if (items.length && 'Notification' in window && Notification.permission === 'granted') {
      const lastNotified = localStorage.getItem('lifehub_general_reminder_date');
      const today = todayStr();
      if (lastNotified !== today) {
        const top = items[0];
        const extra = items.length > 1 ? `，還有 ${items.length - 1} 件其他提醒` : '';
        new Notification('LifeHub 提醒', { body: `${top.text}${extra}` });
        localStorage.setItem('lifehub_general_reminder_date', today);
      }
    }
  } catch (e) { /* 提醒功能失敗不影響主要功能，安靜跳過 */ }
}

// ---------- 背景推播通知 (Web Push) ----------
// 跟上面 checkGeneralReminders() 的差異：那個是「前景通知」，只有分頁開著才有用；
// 這裡是真的 Service Worker + Push 訂閱，螢幕熄滅、App 沒開著也收得到 (iOS 需要先
// 「加入主畫面」變成 PWA、iOS 16.4 以上才支援)。伺服器端邏輯見 src/routes/push.js
// 的背景排程 + src/services/webpush.js 的加密/簽章實作。
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

async function registerPushServiceWorker() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  try {
    await navigator.serviceWorker.register('/sw.js');
  } catch (e) { /* 註冊失敗不影響其他功能，安靜跳過 */ }
  updatePushStatusUI();
}

// 目前訂閱狀態，給設定頁顯示用；不強迫使用者一定要開，純粹告知現況。
// `serviceWorker.ready` 在極少數情況 (例如註冊被瀏覽器擴充功能擋掉) 可能永遠不會
// resolve，這裡加一個 5 秒逾時保護，避免設定頁的「檢查中...」卡住不會消失。
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

async function getPushSubscriptionStatus() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported';
  try {
    const reg = await withTimeout(navigator.serviceWorker.ready, 5000);
    const sub = await reg.pushManager.getSubscription();
    return sub ? 'subscribed' : 'unsubscribed';
  } catch (e) {
    // 注意：這裡刻意回傳 'unsubscribed' 而不是 'unsupported'——瀏覽器明明支援 Push API，
    // 只是這次檢查逾時或暫時出錯，回傳 'unsupported' 會把按鈕整個藏起來，讓使用者沒辦法
    // 再按一次重試，體驗更差。
    return 'unsubscribed';
  }
}

async function updatePushStatusUI() {
  const el2 = $('#pushStatusText');
  if (!el2) return; // 不在設定頁時不用管
  const status = await getPushSubscriptionStatus();
  const labels = {
    unsupported: '這個瀏覽器不支援背景推播通知',
    unsubscribed: '目前未開啟',
    subscribed: '已開啟：螢幕熄滅或 App 沒開著時也會收到提醒',
  };
  el2.textContent = labels[status] || '';
  const btn = $('#pushToggleBtn');
  if (btn) {
    if (status === 'unsupported') { btn.style.display = 'none'; }
    else { btn.style.display = ''; btn.textContent = status === 'subscribed' ? '關閉背景推播' : '開啟背景推播通知'; }
  }
  const testBtn = $('#pushTestBtn');
  if (testBtn) testBtn.style.display = status === 'subscribed' ? '' : 'none';
}

// 立刻送一則測試通知，不用等背景排程 (最長 30 分鐘) 才能確認手機/電腦真的收得到。
async function sendTestPush() {
  try {
    const res = await api('/push/test', { method: 'POST' });
    if (res.ok) {
      showToast('測試通知已送出，注意看看手機/電腦有沒有跳出通知');
    } else {
      showToast('送出了，但推播服務回應失敗，可能要重新開啟一次背景推播');
    }
  } catch (e) {
    showToast('送出失敗：' + e.message);
  }
}

async function togglePushSubscription() {
  const status = await getPushSubscriptionStatus();
  if (status === 'subscribed') {
    await disablePushNotifications();
  } else {
    await enablePushNotifications();
  }
}

async function enablePushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    showToast('這個瀏覽器不支援背景推播通知');
    return;
  }
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      showToast('沒有開啟通知權限，之後可以在瀏覽器設定裡再打開');
      return;
    }
    const reg = await withTimeout(navigator.serviceWorker.ready, 8000);
    const { publicKey } = await api('/push/vapid-public-key');
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
    const subJson = sub.toJSON();
    await api('/push/subscribe', { method: 'POST', body: { endpoint: subJson.endpoint, keys: subJson.keys } });
    showToast('已開啟背景推播通知');
  } catch (e) {
    showToast('開啟失敗：' + e.message);
  }
  updatePushStatusUI();
}

async function disablePushNotifications() {
  try {
    const reg = await withTimeout(navigator.serviceWorker.ready, 8000);
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await api('/push/unsubscribe', { method: 'POST', body: { endpoint: sub.endpoint } });
      await sub.unsubscribe();
    }
    showToast('已關閉背景推播通知');
  } catch (e) {
    showToast('關閉失敗：' + e.message);
  }
  updatePushStatusUI();
}

// ===================== Tab 切換 =====================
const TAB_TITLES = { dashboard: '我的首頁', stocks: '股票', travel: '交通與旅遊', diary: '日記', mood: '心情陪伴', finance: '記帳', bills: '帳單提醒', calendar: '行事曆', tasks: '待辦事項', health: '健康紀錄', relationships: '人際關係', partnerCare: '陪伴另一半', assistant: 'AI 助理', settings: '個人化設定' };
let currentTab = null;
// v0.16.1 曾經讓每次切分頁都往 history 疊一筆新紀錄，想讓「側滑返回上一頁」在 Safari
// 分頁裡變成「回到上一個分頁」而不是直接離開網站。但實際在真的 iPhone 上測試後發現：
// WebKit 的側滑返回手勢預覽動畫，是設計給「真的換了一個網頁」的情境用的，對這種完全
// 靠 JS pushState 疊出來的同頁分頁切換，動畫沒有正確的「上一頁畫面」可以顯示，側滑到
// 一半常常會卡住、畫面整個往右歪掉/裁切一塊 (使用者實測回報過兩次)。這個問題比「側滑
// 可以換分頁」這個小方便更嚴重，所以改回不疊新的 history 紀錄；只用 replaceState 讓網址
// 列的 hash 跟著目前分頁換 (重新整理網頁還是會停在正確分頁)，不會製造側滑手勢可以卡住的
// 「假的上一頁」。iOS「加入主畫面」的獨立視窗模式本來就沒有側滑返回手勢 (蘋果系統限制)，
// 這裡完全不影響那個情境。
function switchTab(tab, opts = {}) {
  if (!TAB_TITLES[tab]) tab = 'dashboard'; // history 裡存到不合法的分頁名稱時，安全回到首頁
  if (!opts.fromPopstate && tab !== currentTab) {
    try { history.replaceState({ tab }, '', '#' + tab); } catch (e) {}
  }
  currentTab = tab;
  document.querySelectorAll('.nav-item').forEach((n) => n.classList.toggle('active', n.dataset.tab === tab));
  document.querySelectorAll('.bn-item').forEach((n) => n.classList.toggle('active', n.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach((p) => (p.style.display = 'none'));
  closeSheet(); // 切換分頁時，如果「更多」選單還開著就一起收起來
  // 心情頁、行事曆頁是鎖住視窗高度的固定版面 (flex column)，其他頁維持一般區塊排版。
  const activePanel = $(`#tab-${tab}`);
  activePanel.style.display = (tab === 'mood' || tab === 'calendar') ? 'flex' : 'block';
  // 切換分頁時加一個很輕的淡入位移動畫，感覺比「直接跳」滑順、比較不生硬；
  // 用移除再加回 class 的方式強制重新觸發動畫 (不然同一個 class 已經在身上，瀏覽器不會重播)。
  activePanel.classList.remove('tab-anim-in');
  void activePanel.offsetWidth;
  activePanel.classList.add('tab-anim-in');
  $('#pageTitle').textContent = TAB_TITLES[tab];
  // 首頁 (dashboard) 原本沒有被列在這裡——第一次登入時是靠 loadPrefsAndBoot() 自己另外呼叫
  // renderDashboard()，但這代表「切去別的分頁、再切回首頁」永遠不會重新整理，帳單/待辦/行事曆
  // 這些摘要卡片會停在剛登入當下的舊資料，即使背後資料已經改變也不會更新，要整頁重新整理才會恢復。
  // 這裡補上，讓首頁跟其他分頁一樣「每次切過去就重新抓最新資料」。
  if (tab === 'dashboard') renderDashboard();
  if (tab === 'stocks') renderStocks();
  if (tab === 'travel') renderTravel();
  if (tab === 'diary') renderDiary();
  if (tab === 'mood') renderMood();
  if (tab === 'finance') renderFinance();
  if (tab === 'bills') renderBills();
  if (tab === 'calendar') renderCalendar();
  if (tab === 'tasks') renderTasks();
  if (tab === 'health') renderHealth();
  if (tab === 'relationships') renderRelationships();
  if (tab === 'partnerCare') renderPartnerCare();
  if (tab === 'assistant') renderAssistant();
  if (tab === 'settings') renderSettings();
}

// ===================== 手機底部導覽：更多選單 / 首頁自訂 (共用同一個底部彈出面板) =====================
// 側欄選單放不進手機底部，這裡把「首頁、股票、記帳、待辦」留在底部常駐，其餘 10 個分頁
// 收進「更多」彈出選單；同一個面板也拿來給首頁小工具拼貼的「自訂」用，不用另外做兩套殼。
const MORE_NAV_ITEMS = [
  { icon: '🚄', label: '交通與旅遊', tab: 'travel' },
  { icon: '📔', label: '日記', tab: 'diary' },
  { icon: '💗', label: '心情陪伴', tab: 'mood' },
  { icon: '🧾', label: '帳單提醒', tab: 'bills' },
  { icon: '📅', label: '行事曆', tab: 'calendar' },
  { icon: '🩺', label: '健康紀錄', tab: 'health' },
  { icon: '🤝', label: '人際關係', tab: 'relationships' },
  { icon: '🌷', label: '陪伴另一半', tab: 'partnerCare' },
  { icon: '🤖', label: 'AI 助理', tab: 'assistant' },
  { icon: '⚙️', label: '個人化設定', tab: 'settings' },
];

function openSheet(title, bodyBuilder) {
  $('#sheetTitle').textContent = title;
  const body = $('#sheetBody');
  body.innerHTML = '';
  body.appendChild(bodyBuilder());
  $('#sheetOverlay').classList.add('show');
}
function closeSheet(ev) {
  if (ev && ev.target !== ev.currentTarget) return; // 點面板內容不應該關閉，只有點背景遮罩或明確呼叫才關
  const overlay = $('#sheetOverlay');
  if (overlay) overlay.classList.remove('show');
}
function toggleMoreSheet() {
  const overlay = $('#sheetOverlay');
  if (overlay && overlay.classList.contains('show')) { closeSheet(); return; }
  openSheet('更多功能', () => {
    const wrap = el('div', {});
    const grid = el('div', { class: 'widget-grid shortcuts' });
    MORE_NAV_ITEMS.forEach((s) => {
      grid.appendChild(el('div', { class: 'widget wshort light shortcut', onclick: () => switchTab(s.tab) }, [
        el('div', { class: 'ic' }, s.icon),
        el('div', { class: 'lb' }, s.label),
      ]));
    });
    wrap.appendChild(grid);
    // 側欄的版本號 (#appVersion) 在手機版整個側欄都是 display:none，手機上完全看不到，
    // 這裡把同一個值再顯示一次，「更多」選單是手機上唯一固定找得到的地方。
    const versionText = ($('#appVersion') && $('#appVersion').textContent) || '-';
    wrap.appendChild(el('div', { class: 'hint', style: 'text-align:center;margin-top:16px' }, [
      `v${versionText} · `,
      el('a', { style: 'color:var(--series-blue);cursor:pointer', onclick: () => showDebug() }, '系統狀態'),
    ]));
    return wrap;
  });
}

// ===================== 下拉重新整理 (手機 App 殼模式) =====================
// 桌面版是整個網頁自己捲動，手機獨立視窗模式下改成「外殼固定、只有 .main 內部捲動」
// (見 style.css 的 app-shell 區塊)，所以下拉手勢也只需要盯著 .main 這個容器，
// 拉到頂端 (scrollTop<=0) 再繼續往下拉超過門檻，放開就重新整理「目前這個分頁」的資料。
(function setupPullToRefresh() {
  const mainEl = document.querySelector('.main');
  const indicator = document.getElementById('pullRefreshIndicator');
  if (!mainEl || !indicator) return;
  const THRESHOLD = 70;
  // 螢幕最右邊這一小塊寬度是 iOS 原生「捲軸提示條」會出現、也可以直接拖曳的地方，這裡故意
  // 不去接手這個區域的觸控事件，避免我們自己的下拉重新整理邏輯跟原生捲軸的拖曳手勢同時
  // 搶著移動畫面 (使用者回報「滑到某個角度、靠右邊一點往右滑」有機率讓畫面跳動，這是目前
  // 排查下來最吻合的成因：兩邊各自用自己的方式在同一時間更新畫面位置，才會看起來在晃)。
  const RIGHT_EDGE_GUARD = 24;
  let startX = null, startY = null, pulling = false, refreshing = false;
  const isMobileLayout = () => window.matchMedia('(max-width: 760px)').matches;

  const CURRENT_TAB_RENDERERS = {
    dashboard: renderDashboard, stocks: renderStocks, travel: renderTravel, diary: renderDiary,
    mood: renderMood, finance: renderFinance, bills: renderBills, calendar: renderCalendar,
    tasks: renderTasks, health: renderHealth, relationships: renderRelationships,
    partnerCare: renderPartnerCare, assistant: renderAssistant, settings: renderSettings,
  };

  mainEl.addEventListener('touchstart', (e) => {
    if (!isMobileLayout() || !state.user || refreshing) { pulling = false; return; }
    const touchX = e.touches[0].clientX;
    const nearRightEdge = touchX >= mainEl.getBoundingClientRect().right - RIGHT_EDGE_GUARD;
    if (mainEl.scrollTop <= 0 && !nearRightEdge) {
      startY = e.touches[0].clientY; startX = touchX; pulling = true;
    } else {
      startY = null; startX = null; pulling = false;
    }
  }, { passive: true });

  mainEl.addEventListener('touchmove', (e) => {
    if (!pulling || startY == null) return;
    const dy = e.touches[0].clientY - startY;
    const dx = Math.abs(e.touches[0].clientX - startX);
    // 這個手勢橫向位移比縱向位移還大，代表不是單純的下拉手勢 (可能是原生捲軸拖曳或其他
    // 手勢)，直接放棄這次下拉重新整理，避免繼續寫入 indicator 樣式跟原生手勢搶畫面。
    if (dx > Math.abs(dy)) { pulling = false; indicator.style.transform = ''; indicator.style.opacity = ''; indicator.classList.remove('ready'); return; }
    if (dy <= 0) { indicator.style.transform = ''; indicator.style.opacity = ''; indicator.classList.remove('ready'); return; }
    const pull = Math.min(dy * 0.5, 90);
    indicator.style.transform = `translateY(${pull}px)`;
    indicator.style.opacity = String(Math.min(pull / THRESHOLD, 1));
    const ready = pull >= THRESHOLD;
    indicator.classList.toggle('ready', ready);
    indicator.textContent = ready ? '⬆️ 放開重新整理' : '⬇️ 下拉重新整理';
  }, { passive: true });

  mainEl.addEventListener('touchend', () => {
    if (!pulling) return;
    pulling = false;
    const shouldRefresh = indicator.classList.contains('ready');
    indicator.classList.remove('ready');
    indicator.style.transform = '';
    indicator.style.opacity = '';
    startY = null; startX = null;
    if (shouldRefresh) doPullRefresh();
    else indicator.textContent = '⬇️ 下拉重新整理';
  });

  async function doPullRefresh() {
    refreshing = true;
    indicator.classList.add('spinning');
    indicator.style.opacity = '1';
    indicator.textContent = '🔄 重新整理中...';
    try {
      const fn = CURRENT_TAB_RENDERERS[currentTab];
      if (fn) await fn();
    } catch (e) { /* 個別分頁自己的 API 已經有錯誤處理，這裡不用重複跳錯誤訊息 */ }
    indicator.classList.remove('spinning');
    indicator.textContent = '✅ 已更新';
    setTimeout(() => {
      indicator.style.opacity = '0';
      indicator.textContent = '⬇️ 下拉重新整理';
      refreshing = false;
    }, 700);
  }
})();

// ===================== 防止畫面卡在橫向位移 (保險機制) =====================
// 查出來的根本原因：`.main` 原本只設定了 overflow-y，CSS 規則會讓它「順便」變成一個
// 獨立的水平捲動容器；只要任何原因讓它的 scrollLeft 被推離 0 (即使現在已經補上
// overflow-x: hidden，很多瀏覽器對 overflow:hidden 的容器還是可以用程式/系統行為
// 把 scrollLeft 設成非 0，只是使用者自己滑不動而已)，畫面就會一直卡在偏移的狀態，因為
// 之前完全沒有任何地方會把它拉回來。這裡加一個保險：只要偵測到 `.main` 或它的祖先
// (#app / body / html) 的 scrollLeft 不是 0，就立刻拉回 0，不管是什麼原因造成的。
(function guardAgainstStuckHorizontalScroll() {
  const targets = [document.documentElement, document.body, document.getElementById('app'), document.querySelector('.main')].filter(Boolean);
  const resetIfNeeded = (el) => { if (el.scrollLeft !== 0) el.scrollLeft = 0; };
  targets.forEach((el) => {
    el.addEventListener('scroll', () => resetIfNeeded(el), { passive: true });
  });
  // 切換分頁、視窗尺寸變化 (例如螢幕旋轉、鍵盤彈出) 時也順手檢查一次。
  window.addEventListener('resize', () => targets.forEach(resetIfNeeded));
  const origSwitchTab = window.switchTab;
  if (typeof origSwitchTab === 'function') {
    window.switchTab = function (...args) {
      const ret = origSwitchTab.apply(this, args);
      targets.forEach(resetIfNeeded);
      return ret;
    };
  }
})();

// ===================== 意見回饋 =====================
// 右上角 💬 按鈕，app 跟電腦版網頁共用同一顆按鈕、同一個彈窗 (共用底部彈窗元件)，
// 送出後只有管理者帳號看得到列表 (見 renderSettings 裡的「所有回饋」區塊)。
const FEEDBACK_CATEGORIES = [
  { key: 'bug', label: '🐛 問題回報' },
  { key: 'suggestion', label: '💡 建議' },
  { key: 'other', label: '💬 其他' },
];
function openFeedbackModal() {
  let selectedCategory = 'suggestion';
  openSheet('意見回饋', () => {
    const wrap = el('div', { class: 'feedback-form' });
    wrap.appendChild(el('p', { class: 'hint' }, '有任何想法、卡住的地方、或希望新增的功能，都可以直接寫在這裡，我會看到。'));

    const catRow = el('div', { class: 'feedback-cat-row' });
    const catBtns = {};
    FEEDBACK_CATEGORIES.forEach((c) => {
      const btn = el('button', {
        class: 'feedback-cat-btn' + (c.key === selectedCategory ? ' active' : ''),
        onclick: () => {
          selectedCategory = c.key;
          Object.entries(catBtns).forEach(([k, b]) => b.classList.toggle('active', k === selectedCategory));
        },
      }, c.label);
      catBtns[c.key] = btn;
      catRow.appendChild(btn);
    });
    wrap.appendChild(catRow);

    const textarea = el('textarea', {
      class: 'feedback-textarea',
      placeholder: '想說什麼都可以寫在這裡...',
      rows: 5,
    });
    wrap.appendChild(textarea);

    const submitBtn = el('button', {
      class: 'btn btn-primary feedback-submit-btn',
      onclick: async () => {
        const message = textarea.value.trim();
        if (!message) { showToast('請先輸入內容再送出'); return; }
        submitBtn.disabled = true;
        submitBtn.textContent = '送出中...';
        try {
          await api('/feedback', { method: 'POST', body: { message, category: selectedCategory } });
          showToast('謝謝你的回饋！已經收到了 🙏');
          closeSheet();
        } catch (e) {
          showToast(e.message || '送出失敗，請稍後再試');
          submitBtn.disabled = false;
          submitBtn.textContent = '送出回饋';
        }
      },
    }, '送出回饋');
    wrap.appendChild(submitBtn);

    return wrap;
  });
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
  // 支援負值 (例如淨資產累計結餘可能是負的)：用實際的 min/max 範圍縮放，不假設一定從 0 開始
  const rawMin = Math.min(...allPoints.map((p) => p.y), 0);
  const rawMax = Math.max(...allPoints.map((p) => p.y), 0);
  const span = rawMax - rawMin || Math.abs(rawMax) * 0.2 || 1;
  // 全部都是非負值時維持原本「從 0 開始」的畫法，只有真的出現負值時才往下留白，
  // 不然本來就從 0 起跳的圖表 (例如收支金額) 會無緣無故變成從負數開始
  const yMin = rawMin < 0 ? rawMin - span * 0.05 : 0;
  const yMax = rawMax + span * 0.05;
  const yAt = (v) => padTop + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  const svg = svgEl('svg', { width: '100%', height, viewBox: `0 0 ${width} ${height}` });
  for (let g = 0; g <= 4; g++) {
    const y = padTop + (plotH / 4) * g;
    const v = yMax - ((yMax - yMin) / 4) * g;
    svg.appendChild(svgEl('line', { x1: padL, x2: width - padR, y1: y, y2: y, stroke: cssVar('--grid-line'), 'stroke-width': 1 }));
    const val = svgEl('text', { x: 4, y: y + 4, 'font-size': 10, fill: cssVar('--text-muted') });
    val.textContent = fmtNum(Math.round(v));
    svg.appendChild(val);
  }
  // 0 這條基準線如果落在圖表範圍內，特別標出來，負值時比較看得出「虧」跟「賺」的分界
  if (yMin < 0 && yMax > 0) {
    const zeroY = yAt(0);
    svg.appendChild(svgEl('line', { x1: padL, x2: width - padR, y1: zeroY, y2: zeroY, stroke: cssVar('--text-muted'), 'stroke-width': 1, 'stroke-dasharray': '3,3' }));
  }

  series.forEach((s) => {
    const pts = xs.map((x) => {
      const p = s.points.find((pt) => pt.x === x);
      return { x, y: p ? p.y : 0 };
    });
    const path = pts.map((p, i) => {
      const px = padL + (xs.indexOf(p.x) / Math.max(xs.length - 1, 1)) * plotW;
      const py = yAt(p.y);
      return `${i === 0 ? 'M' : 'L'}${px},${py}`;
    }).join(' ');
    svg.appendChild(svgEl('path', { d: path, fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-linecap': 'round' }));

    pts.forEach((p) => {
      const px = padL + (xs.indexOf(p.x) / Math.max(xs.length - 1, 1)) * plotW;
      const py = yAt(p.y);
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
// 首頁的樣貌會依當下時段變化 (早晨/午後/傍晚/深夜)，不會永遠都是「晨間簡報」那一種形式，
// 每個時段有自己的徽章文字、問候語、跟摘要按鈕的語氣。
const DASH_PERIODS = {
  morning: {
    icon: '☀️', label: '晨間', badgeSuffix: '晨間時光',
    greetings: [
      '新的一天，先深呼吸一口再開始 🌿',
      '不用急，先把自己準備好就好 ✨',
      '今天想做的事，先做一件小小的就好 🌤️',
    ],
    briefBtn: '產生晨間摘要',
  },
  afternoon: {
    icon: '🌤️', label: '午後', badgeSuffix: '午後時光',
    greetings: [
      '午後了，休息一下再繼續也可以 🍃',
      '不管上午過得如何，下半天重新開始就好 💫',
      '喝口水、動一動，替下午充個電 ☕',
    ],
    briefBtn: '產生午後摘要',
  },
  evening: {
    icon: '🌇', label: '傍晚', badgeSuffix: '傍晚時光',
    greetings: [
      '今天也辛苦了，慢慢收尾就好 🌿',
      '不管今天過得如何，你都做得很好 ✨',
      '晚餐前，先鬆口氣吧 🌆',
    ],
    briefBtn: '產生傍晚摘要',
  },
  night: {
    icon: '🌙', label: '深夜', badgeSuffix: '深夜時光',
    greetings: [
      '累的時候，休息也是一種前進 🍃',
      '慢慢來也沒關係，你的步調就是最好的步調 🌙',
      '有你在乎的事情，本身就是一件很棒的事 💫',
    ],
    briefBtn: '產生深夜摘要',
  },
};

function getDayPeriod() {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return 'morning';
  if (h >= 11 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}

// v0.28.0 首頁重新設計：不分桌面版/手機版兩套版面，統一用單欄「以 app 為主」的排版，
// 全程沒有左右並排的欄位，天生就不會有橫向捲動的問題。待辦事項跟行事曆合併成一條清單
// (依「離現在最近」排序)，取代原本兩張各自獨立、內容還會重複的卡片；心情可以直接在首頁打卡；
// 問候語下面固定會有一句隨機的正向話語 (沿用 DASH_PERIODS 既有的語句庫，每個時段各自一組)。
function renderDashboard() {
  const c = $('#tab-dashboard');
  c.innerHTML = '';
  const period = getDayPeriod();
  const meta = DASH_PERIODS[period];
  const quote = meta.greetings[Math.floor(Math.random() * meta.greetings.length)];

  const WEEKDAY_LABEL = ['日', '一', '二', '三', '四', '五', '六'];
  const now = new Date();
  const dateLabel = `${now.getMonth() + 1}月${now.getDate()}日 星期${WEEKDAY_LABEL[now.getDay()]} · ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const enabled = (state.prefs && state.prefs.enabledModules) || {};
  const isOn = (key) => enabled[key] !== false;

  const wrap = el('div', { class: 'dash-unified' });

  wrap.appendChild(el('div', { class: 'dash-hero-eyebrow' }, `${meta.icon} ${dateLabel}`));
  wrap.appendChild(el('div', { class: 'dash-hero-name' }, `哈囉，${state.user ? state.user.name : ''}`));
  wrap.appendChild(el('div', { id: 'dashHeroSub', class: 'dash-hero-sub' }, skeletonLines(1)));
  wrap.appendChild(el('div', { class: 'dash-hero-quote' }, quote));

  wrap.appendChild(el('div', { class: 'dash-hero-ask' }, [
    el('input', { id: 'dashAskInput', placeholder: '想問 AI 什麼呢？', onkeydown: (ev) => { if (ev.key === 'Enter') dashAskAI(); } }),
    el('button', { class: 'btn btn-primary', onclick: () => dashAskAI() }, '送出'),
  ]));
  wrap.appendChild(el('div', { class: 'dash-hero-hint' }, '按 Enter 直接與 AI 助理對話，資料與對話記錄都會同步保存'));
  wrap.appendChild(el('div', { class: 'dash-brief-box dash-hero-brief' }, [
    el('button', { class: 'btn btn-ghost dash-brief-btn', onclick: () => generateDashBriefing(period) }, `📋 ${meta.briefBtn}`),
    el('div', { id: 'dashBriefResult', class: 'dash-brief-result', style: 'display:none' }),
  ]));

  // 主動式提醒：帳單快到期、待辦逾期、好幾天沒記心情，集中顯示在最上面，沒有提醒事項時整個區塊不顯示。
  wrap.appendChild(el('div', { id: 'dashRemindersWrap' }));

  wrap.appendChild(el('div', { id: 'dashStatStrip', class: 'dash-stat-strip' }));

  if (isOn('tasks')) {
    wrap.appendChild(el('div', { class: 'dash-section-title-row' }, [
      el('div', { class: 'dash-section-title' }, '待辦事項 · 依「離現在最近」排序'),
      el('div', {}, [
        el('button', { class: 'dash-section-action', onclick: (ev) => { ev.stopPropagation(); dashUnifiedSort = dashUnifiedSort === 'time' ? 'priority' : 'time'; loadDashUnifiedTasks(); } }, dashUnifiedSort === 'time' ? '排序：時間' : '排序：優先度'),
      ]),
    ]));
    wrap.appendChild(el('div', { id: 'dashUnifiedList', class: 'dash-unified-list' }, skeletonLines(3)));
  }

  if (isOn('mood')) {
    wrap.appendChild(el('div', { class: 'dash-section-title-row' }, [el('div', { class: 'dash-section-title' }, '今天的心情')]));
    wrap.appendChild(el('div', { id: 'moodSummaryBody', class: 'dash-mood-inline' }, skeletonLines(2)));
  }

  wrap.appendChild(el('div', { class: 'dash-section-title-row' }, [
    el('div', { class: 'dash-section-title' }, '更多'),
    el('button', { class: 'dash-section-action', onclick: () => openCustomizeSheet() }, '✏️ 自訂'),
  ]));
  const moreList = el('div', { class: 'dash-more-list' });
  if (isOn('stocks')) moreList.appendChild(dashMoreRow('📈', '股市摘要', 'stocksSummaryBody', () => switchTab('stocks')));
  if (isOn('finance')) moreList.appendChild(dashMoreRow('💰', '記帳流水', 'financeSummaryBody', () => switchTab('finance')));
  if (isOn('bills')) moreList.appendChild(dashMoreRow('🧾', '帳單提醒', 'billsSummaryBody', () => switchTab('bills')));
  moreList.appendChild(dashMoreRow('📔', '日記隨筆', 'diarySummaryBody', () => switchTab('diary')));
  moreList.appendChild(dashMoreRow('🚄', '交通與旅遊', null, () => switchTab('travel'), '台鐵/高鐵時刻、機票訂房連結、智慧行程規劃，點這裡前往'));
  moreList.appendChild(dashMoreRow('📊', '本週動態', 'weeklyDigestBody', null));
  wrap.appendChild(moreList);

  wrap.appendChild(el('div', { class: 'dash-section-title-row' }, [el('div', { class: 'dash-section-title' }, '全部功能')]));
  const shortcutGrid = el('div', { class: 'widget-grid shortcuts' });
  MORE_NAV_ITEMS.forEach((s) => {
    shortcutGrid.appendChild(el('div', { class: 'widget wshort light shortcut', onclick: () => switchTab(s.tab) }, [
      el('div', { class: 'ic' }, s.icon),
      el('div', { class: 'lb' }, s.label),
    ]));
  });
  wrap.appendChild(shortcutGrid);

  c.appendChild(wrap);

  if (isOn('tasks')) loadDashUnifiedTasks(); else loadDashHeroSubFallback();
  if (isOn('stocks')) loadDashStockSummary();
  if (isOn('finance')) loadDashFinanceSummary();
  loadDashDiarySummary();
  if (isOn('bills')) loadDashBillsSummary();
  if (isOn('mood')) loadDashMoodSummary();
  loadDashReminders();
  loadDashWeeklyDigest();
}

function dashMoreRow(icon, title, bodyId, onClick, staticHint) {
  const body = staticHint
    ? el('div', { class: 'dash-more-content hint' }, staticHint)
    : el('div', { id: bodyId, class: 'dash-more-content' }, skeletonLines(1));
  return el('div', { class: `dash-more-row${onClick ? '' : ' no-click'}`, onclick: onClick || undefined }, [
    el('div', { class: 'dash-more-icon' }, icon),
    el('div', { class: 'dash-more-body' }, [
      el('div', { class: 'dash-more-title' }, title),
      body,
    ]),
  ]);
}

// 首頁待辦清單看的時候要「依時間 (離現在最近)」還是「依優先度」排序——只是這次看的當下想怎麼看，
// 不用跨裝置記住，用一般變數就好。
let dashUnifiedSort = 'time';

// tasks 關掉時 (isOn('tasks') === false) 上面的問候語副標題沒有待辦統計可以用，改顯示日期本身就好。
function loadDashHeroSubFallback() {
  const sub = $('#dashHeroSub');
  if (sub) sub.textContent = '祝你有美好的一天 🌿';
}

// 把「離現在這個時間點」的距離算出來，讓待辦事項跟行事曆事件可以合併排序——不論是剛好快到期
// 還是即將發生，越接近現在這個時刻的事情，就越應該排在使用者一打開首頁就看得到的最上面。
function dashItemTimestamp(item) {
  if (item.utype === 'task') {
    if (!item.due_date) return null;
    return new Date(`${item.due_date}T23:59:59`).getTime();
  }
  const time = item.start_time || '23:59';
  return new Date(`${item.event_date}T${time}:00`).getTime();
}

async function loadDashUnifiedTasks() {
  const listBody = $('#dashUnifiedList');
  const statStrip = $('#dashStatStrip');
  if (!listBody) return;
  try {
    const today = todayStr();
    const enabled = (state.prefs && state.prefs.enabledModules) || {};
    const includeCalendar = enabled.calendar !== false;
    const fromD = new Date(); const toD = new Date(); toD.setDate(toD.getDate() + 14);
    const [pending, done, calEvents] = await Promise.all([
      api('/tasks?status=pending'),
      api('/tasks?status=completed'),
      includeCalendar ? api(`/calendar?from=${fromD.toISOString().slice(0, 10)}&to=${toD.toISOString().slice(0, 10)}`) : Promise.resolve([]),
    ]);
    const calFiltered = calEvents.filter((ev) => ev.category !== 'auto-task');

    // 副標題跟統計條：完成度、已逾期件數、來自行事曆的件數。
    const overdueCount = pending.filter((t) => t.due_date && t.due_date < today).length;
    const totalForPct = pending.length + done.length;
    const sub = $('#dashHeroSub');
    if (sub) sub.textContent = (pending.length + calFiltered.length) ? `今天有 ${pending.length + calFiltered.length} 件事在等你，慢慢來也沒關係。` : '目前沒有待辦或行程，好好休息一下吧 🌿';
    if (statStrip) {
      statStrip.innerHTML = '';
      const block = (icon, num, desc) => el('div', { class: 'dash-stat-block' }, [
        el('div', { class: 'dash-stat-icon' }, icon),
        el('div', { class: 'dash-stat-num' }, num),
        el('div', { class: 'dash-stat-desc' }, desc),
      ]);
      statStrip.appendChild(block('✅', `${done.length} / ${totalForPct || 0}`, '今日完成度'));
      statStrip.appendChild(block('⏰', `${overdueCount} 件`, '已逾期'));
      statStrip.appendChild(block('📅', `${calFiltered.length} 件`, '來自行事曆'));
    }

    const items = [
      ...pending.map((t) => ({ ...t, utype: 'task' })),
      ...calFiltered.map((e) => ({ ...e, utype: 'calendar' })),
    ];

    const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };
    let sorted;
    if (dashUnifiedSort === 'priority') {
      sorted = [...items].sort((a, b) => {
        const ra = a.utype === 'task' ? (PRIORITY_RANK[a.priority] ?? 1) : 1;
        const rb = b.utype === 'task' ? (PRIORITY_RANK[b.priority] ?? 1) : 1;
        return ra - rb;
      });
    } else {
      const nowMs = Date.now();
      sorted = [...items].sort((a, b) => {
        const ta = dashItemTimestamp(a);
        const tb = dashItemTimestamp(b);
        if (ta === null && tb === null) return 0;
        if (ta === null) return 1;
        if (tb === null) return -1;
        return Math.abs(ta - nowMs) - Math.abs(tb - nowMs);
      });
    }

    listBody.innerHTML = '';
    if (!sorted.length) {
      listBody.appendChild(el('div', { class: 'dash-unified-empty' }, '目前沒有待辦事項或近期行程 🎉'));
      return;
    }
    const nowMs = Date.now();
    sorted.slice(0, 8).forEach((item) => {
      listBody.appendChild(buildDashUnifiedRow(item, today, nowMs));
    });
    if (sorted.length > 8) {
      listBody.appendChild(el('div', { class: 'dash-unified-empty', style: 'cursor:pointer', onclick: () => switchTab('tasks') }, `還有 ${sorted.length - 8} 件，點這裡查看全部`));
    }
  } catch (e) {
    listBody.innerHTML = '';
    listBody.appendChild(el('div', { class: 'dash-unified-empty' }, '待辦/行事曆資料暫時無法取得'));
  }
}

function buildDashUnifiedRow(item, today, nowMs) {
  if (item.utype === 'calendar') {
    const ts = dashItemTimestamp(item);
    const soon = ts !== null && ts >= nowMs && ts - nowMs <= 3 * 60 * 60 * 1000;
    const dateLabel = item.event_date === today ? (item.start_time || '今天') : (item.event_date < today ? item.event_date.slice(5) : item.event_date.slice(5));
    return el('div', { class: 'utask-row', onclick: () => switchTab('calendar') }, [
      el('span', { class: 'utask-prio cal' }),
      el('span', { class: 'utask-dot' }, '●'),
      el('span', { class: 'utask-title' }, item.title),
      el('span', { class: 'utask-badge cal' }, '行事曆'),
      soon ? el('span', { class: 'utask-badge soon' }, '即將') : null,
      el('span', { class: `utask-meta${soon ? ' soon' : ''}` }, dateLabel),
    ].filter(Boolean));
  }
  const isOverdue = item.due_date && item.due_date < today;
  const ts = dashItemTimestamp(item);
  const soon = !isOverdue && ts !== null && ts >= nowMs && ts - nowMs <= 3 * 60 * 60 * 1000;
  const dateLabel = !item.due_date ? '未排定' : (isOverdue ? item.due_date.slice(5) : (item.due_date === today ? '今天' : item.due_date.slice(5)));
  return el('div', { class: 'utask-row' }, [
    el('span', { class: `utask-prio ${item.priority || 'low'}` }),
    el('input', { type: 'checkbox', class: 'utask-check', onclick: (ev) => ev.stopPropagation(), onchange: (ev) => dashCompleteUnifiedTask(item.id, ev) }),
    el('span', { class: 'utask-title' }, item.title),
    isOverdue ? el('span', { class: 'utask-badge overdue' }, '逾期') : (soon ? el('span', { class: 'utask-badge soon' }, '即將') : null),
    el('span', { class: `utask-meta${isOverdue ? ' overdue' : (soon ? ' soon' : '')}` }, dateLabel),
    isOverdue ? el('button', { class: 'utask-snooze', title: '延到今天', onclick: (ev) => dashSnoozeUnifiedTask(item.id, ev) }, '⏩') : null,
    el('button', { class: 'utask-del', title: '刪除', onclick: (ev) => dashDeleteUnifiedTask(item.id, ev) }, '×'),
  ].filter(Boolean));
}

async function dashCompleteUnifiedTask(id, ev) {
  if (ev) ev.stopPropagation();
  try {
    await api(`/tasks/${id}/complete`, { method: 'PUT', body: { completed: true } });
    loadDashUnifiedTasks();
  } catch (e) { showToast('更新失敗：' + e.message); }
}
async function dashDeleteUnifiedTask(id, ev) {
  if (ev) ev.stopPropagation();
  try {
    await api(`/tasks/${id}`, { method: 'DELETE' });
    loadDashUnifiedTasks();
  } catch (e) { showToast('刪除失敗：' + e.message); }
}
async function dashSnoozeUnifiedTask(id, ev) {
  if (ev) ev.stopPropagation();
  try {
    await api(`/tasks/${id}`, { method: 'PUT', body: { dueDate: todayStr() } });
    showToast('已延到今天');
    loadDashUnifiedTasks();
  } catch (e) { showToast('延期失敗：' + e.message); }
}

// ===================== 手機版首頁：小工具拼貼 =====================
// 每個小工具對應一個 enabledModules 的 key，跟桌面版首頁卡片共用同一份「自訂」設定。
// 注意：這裡故意不幫每個小工具寫死 size (大小/形狀)。之前的做法是「股票永遠是大方塊、
// 待辦永遠是小方塊」，使用者自己拖曳排序把小工具往前移動之後，因為大小還是跟著原本的
// 身分走，常常會排出「一個小方塊獨自卡在最上面」這種視覺上比例失衡、看起來很奇怪的版面。
// 現在改成：大小交給 widgetSizeForIndex() 依照「排在第幾個」決定 (見下面)，每個小工具的
// 內容 (數字 + 一行說明文字) 本來就很單純，放大方塊、小方塊、長條都看得下去，所以不管
// 使用者怎麼排序，版面永遠照著同一套「大、小、小、長」的節奏走，排起來都會是好看的。
const MOBILE_WIDGETS = [
  { key: 'stocks', label: '📈 股票', color: 'emerald', bodyId: 'wStockBody', tab: 'stocks', loader: (size) => loadMobileStockWidget(size) },
  { key: 'tasks', label: '✅ 待辦', color: 'amber', bodyId: 'wTasksBody', tab: 'tasks', loader: (size) => loadMobileTasksWidget(size) },
  { key: 'mood', label: '💗 心情', color: 'sky', bodyId: 'wMoodBody', tab: 'mood', loader: (size) => loadMobileMoodWidget(size) },
  { key: 'finance', label: '💰 記帳', color: 'indigo', bodyId: 'wFinanceBody', tab: 'finance', loader: (size) => loadMobileFinanceWidget(size) },
  { key: 'bills', label: '🧾 帳單提醒', color: 'light', bodyId: 'wBillsBody', tab: 'bills', loader: (size) => loadMobileBillsWidget(size) },
  { key: 'calendar', label: '📅 行事曆', color: 'rose', bodyId: 'wCalendarBody', tab: 'calendar', loader: (size) => loadMobileCalendarWidget(size) },
];
// 排到「大方塊」(w2x2) 這個比較寬敞、垂直空間也夠的形狀時，心情/待辦這兩個小工具會顯示
// 比較完整的互動內容 (心情：可以直接點分數記錄；待辦：多顯示 1-2 筆待辦事項)。「長條」
// (w4x1) 雖然寬，但只有一列的高度塞不下 10 個評分按鈕，所以只有大方塊才會展開；排到小方塊
// /長條時空間不夠，維持原本精簡的摘要文字就好——桌面版本來就有這些完整內容，這裡是讓
// 手機版排到夠大的位置時也能對齊，而不是任何情況都只能點進去才看得到。
const WIDGET_SPACIOUS_SIZES = ['w2x2'];

// 版型節奏：大方塊 (2x2) → 小方塊 (1x1) → 小方塊 (1x1) → 長條 (4x1)，每 4 個一輪循環。
// 不管使用者把哪個小工具排到第幾個，都是照這個節奏決定形狀，所以排序永遠不會排出
// 「比例失衡」的版面 (例如原本只有一個小方塊卡在整排的開頭)。
const WIDGET_SIZE_PATTERN = ['w2x2', 'w1x1', 'w1x1', 'w4x1'];
function widgetSizeForIndex(index) {
  return WIDGET_SIZE_PATTERN[index % WIDGET_SIZE_PATTERN.length];
}

function buildMobileDashboard(period, meta, dateLabel) {
  const enabled = (state.prefs && state.prefs.enabledModules) || {};
  const isOn = (key) => enabled[key] !== false;
  const wrap = el('div', { class: 'dash-mobile-widgets' });

  wrap.appendChild(el('div', { class: 'dash-mobile-topline' }, [
    el('div', { class: 'dash-mobile-greet' }, [
      el('div', { class: 'hi' }, `${meta.icon} ${dateLabel}`),
      el('div', { class: 'name' }, `哈囉，${state.user ? state.user.name : ''}`),
    ]),
    el('button', { class: 'dash-customize-btn', onclick: openCustomizeSheet }, '✏️ 自訂'),
  ]));

  const activeWidgets = orderedMobileWidgets().filter((w) => isOn(w.key));
  if (activeWidgets.length) {
    const grid = el('div', { class: 'widget-grid' });
    activeWidgets.forEach((w, i) => {
      grid.appendChild(el('div', { class: `widget ${widgetSizeForIndex(i)} ${w.color}`, onclick: () => switchTab(w.tab) }, [
        el('div', { class: 'wt' }, w.label),
        el('div', { id: w.bodyId }, skeletonLines(1)),
      ]));
    });
    wrap.appendChild(grid);
  } else {
    wrap.appendChild(el('div', { class: 'empty-state' }, '首頁小工具都關掉了，按右上角「自訂」重新打開'));
  }

  wrap.appendChild(el('div', { class: 'section-label' }, '全部功能'));
  const shortcutGrid = el('div', { class: 'widget-grid shortcuts' });
  MORE_NAV_ITEMS.forEach((s) => {
    shortcutGrid.appendChild(el('div', { class: 'widget wshort light shortcut', onclick: () => switchTab(s.tab) }, [
      el('div', { class: 'ic' }, s.icon),
      el('div', { class: 'lb' }, s.label),
    ]));
  });
  wrap.appendChild(shortcutGrid);
  return wrap;
}

// 小工具的資料要等 buildMobileDashboard() 回傳的 DOM 真的被插進頁面之後才能抓，
// 所以獨立成一個函式，由呼叫端在 appendChild 之後再呼叫 (見 renderDashboard())。
function loadMobileWidgetsData() {
  const enabled = (state.prefs && state.prefs.enabledModules) || {};
  const isOn = (key) => enabled[key] !== false;
  // 把「這個小工具排在第幾個、所以會是什麼形狀」一起傳給 loader，讓內容可以自己決定要
  // 顯示精簡摘要還是比較完整的互動內容 (例如心情卡排到夠寬的位置時，直接顯示評分按鈕)。
  orderedMobileWidgets().filter((w) => isOn(w.key)).forEach((w, i) => w.loader(widgetSizeForIndex(i)));
}

// 依照 state.prefs.moduleOrder (存的是 widget key 陣列) 排序 MOBILE_WIDGETS；
// 這個欄位在 prefs API 裡本來就存在，只是之前完全沒有前端功能在用，這次拿來做
// 「首頁小工具拖曳排序」剛好用得上，不用另外加新的資料庫欄位。沒排過序 (或有新
// 小工具還沒被排進去) 的項目，就照 MOBILE_WIDGETS 原本定義的順序排在後面。
function orderedMobileWidgets() {
  const order = (state.prefs && state.prefs.moduleOrder) || [];
  const orderIndex = new Map(order.map((k, i) => [k, i]));
  return [...MOBILE_WIDGETS].sort((a, b) => {
    const ia = orderIndex.has(a.key) ? orderIndex.get(a.key) : 1000 + MOBILE_WIDGETS.indexOf(a);
    const ib = orderIndex.has(b.key) ? orderIndex.get(b.key) : 1000 + MOBILE_WIDGETS.indexOf(b);
    return ia - ib;
  });
}

function openCustomizeSheet() {
  openSheet('自訂首頁小工具', () => {
    const wrap = el('div', {});
    wrap.appendChild(el('p', { class: 'hint', style: 'margin:0 0 12px' }, '關掉的項目暫時不會出現在首頁，隨時可以再打開；一般選單裡還是找得到，資料也不會被刪除。按住左邊的 ⠿ 拖曳可以調整首頁小工具的排列順序。'));
    const enabled = (state.prefs && state.prefs.enabledModules) || {};
    const listEl = el('div', { class: 'widget-order-list' });
    orderedMobileWidgets().forEach((w) => {
      listEl.appendChild(el('div', { class: 'module-toggle-row widget-order-row', 'data-key': w.key }, [
        el('span', { class: 'widget-drag-handle' }, '⠿'),
        el('span', { class: 'widget-order-label' }, w.label),
        el('label', { class: 'switch' }, [
          el('input', { type: 'checkbox', checked: enabled[w.key] !== false, onchange: (ev) => toggleDashWidget(w.key, ev.target.checked) }),
          el('span', { class: 'slider' }),
        ]),
      ]));
    });
    wrap.appendChild(listEl);
    setupWidgetDragReorder(listEl);
    return wrap;
  });
}

// 拖曳排序：用 Pointer Events (滑鼠/觸控通用同一套邏輯，不用分開寫兩份)。
// 拖曳過程中直接搬動 DOM 節點順序 (insertBefore)，放開時把目前的順序存回 prefs。
function setupWidgetDragReorder(listEl) {
  let dragRow = null, startY = 0, rowHeight = 1;
  listEl.querySelectorAll('.widget-drag-handle').forEach((handle) => {
    handle.addEventListener('pointerdown', (e) => {
      dragRow = handle.closest('.widget-order-row');
      if (!dragRow) return;
      startY = e.clientY;
      rowHeight = dragRow.offsetHeight || 1;
      dragRow.classList.add('dragging');
      try { handle.setPointerCapture(e.pointerId); } catch (err) {}
      e.preventDefault();
    });
  });
  listEl.addEventListener('pointermove', (e) => {
    if (!dragRow) return;
    const dy = e.clientY - startY;
    dragRow.style.transform = `translateY(${dy}px)`;
    const rows = Array.from(listEl.querySelectorAll('.widget-order-row'));
    const dragIndex = rows.indexOf(dragRow);
    const targetIndex = Math.max(0, Math.min(rows.length - 1, dragIndex + Math.round(dy / rowHeight)));
    if (targetIndex !== dragIndex) {
      const targetRow = rows[targetIndex];
      if (dy > 0) listEl.insertBefore(dragRow, targetRow.nextSibling);
      else listEl.insertBefore(dragRow, targetRow);
      startY = e.clientY;
      dragRow.style.transform = '';
    }
  });
  function endDrag() {
    if (!dragRow) return;
    dragRow.classList.remove('dragging');
    dragRow.style.transform = '';
    const finishedRow = dragRow;
    dragRow = null;
    const newOrder = Array.from(listEl.querySelectorAll('.widget-order-row')).map((r) => r.dataset.key);
    saveWidgetOrder(newOrder);
    void finishedRow; // 只是避免 lint 警告未使用變數，實際上不需要再對這個節點做事
  }
  listEl.addEventListener('pointerup', endDrag);
  listEl.addEventListener('pointercancel', endDrag);
}
async function saveWidgetOrder(order) {
  state.prefs.moduleOrder = order;
  try {
    await api('/prefs', { method: 'PUT', body: state.prefs });
  } catch (e) { showToast('排序儲存失敗：' + e.message); }
  renderDashboard();
}

async function toggleDashWidget(key, val) {
  state.prefs.enabledModules = { ...(state.prefs.enabledModules || {}), [key]: val };
  try {
    await api('/prefs', { method: 'PUT', body: state.prefs });
  } catch (e) { showToast('儲存失敗：' + e.message); }
  renderDashboard();
  // 首頁重新畫過之後，把「自訂」面板重新打開、停在同一個畫面，這樣連續關好幾個小工具不用一直重新點「自訂」
  openCustomizeSheet();
}

async function loadMobileStockWidget() {
  const body = $('#wStockBody');
  if (!body) return;
  try {
    const t = await api('/stocks/index/taiex');
    body.innerHTML = '';
    const changeColor = t.change > 0 ? 'delta-up' : t.change < 0 ? 'delta-down' : '';
    body.appendChild(el('div', { class: 'wv' }, t.index != null ? Number(t.index).toLocaleString('zh-Hant-TW', { maximumFractionDigits: 0 }) : '--'));
    body.appendChild(el('div', { class: `w-sub ${changeColor}` }, t.change != null ? `${t.change > 0 ? '▲+' : t.change < 0 ? '▼' : ''}${t.change} · 加權指數` : '加權指數'));
  } catch (e) {
    body.innerHTML = '';
    body.appendChild(el('div', { class: 'w-sub' }, '暫時無法取得'));
  }
}
async function loadMobileTasksWidget(size) {
  const body = $('#wTasksBody');
  if (!body) return;
  try {
    const pending = await api('/tasks?status=pending');
    body.innerHTML = '';
    const overdue = pending.filter((t) => t.due_date && t.due_date < todayStr()).length;
    body.appendChild(el('div', { class: 'wv small' }, `${pending.length} 件`));
    body.appendChild(el('div', { class: 'w-sub' }, overdue ? `${overdue} 件已過期` : '待完成'));
    // 排到大方塊時，比照桌面版多顯示 1~2 筆待辦事項的標題，不用點進去才看得到內容是什麼；
    // 排到小方塊/長條時空間不夠，維持上面的精簡數字就好。
    if (WIDGET_SPACIOUS_SIZES.includes(size) && pending.length) {
      const list = el('div', { class: 'w-mini-list' });
      pending.slice(0, 2).forEach((t) => {
        list.appendChild(el('div', { class: 'w-mini-list-item' }, `${PRIORITY_LABEL[t.priority] || ''} ${t.title}`));
      });
      body.appendChild(list);
    }
  } catch (e) {
    body.innerHTML = '';
    body.appendChild(el('div', { class: 'w-sub' }, '暫時無法取得'));
  }
}

// 手機版心情小工具的快速評分狀態，跟桌面版 (dashMoodQuickScore 等) 分開一份，避免同一個
// 分頁裡桌面/手機兩份 DOM 同時存在時 (CSS 只是用 display:none 切換、兩份其實都在) 互相干擾。
let mobileMoodQuickScore = null;
async function loadMobileMoodWidget(size) {
  const body = $('#wMoodBody');
  if (!body) return;
  try {
    const today = todayStr();
    const rows = await api(`/mood/entries?from=${today}&to=${today}`);
    body.innerHTML = '';
    mobileMoodQuickScore = rows.length ? rows[0].score : null;

    // 排到大方塊時，直接比照桌面版放一排 1-10 分快速評分按鈕，不用點進心情頁才能記錄；
    // 排到小方塊/長條時空間放不下 10 個按鈕 (長條只有一列高度)，維持精簡摘要 + 點擊進頁面。
    if (WIDGET_SPACIOUS_SIZES.includes(size)) {
      body.appendChild(el('div', { class: 'w-sub' }, rows.length ? `今天已記錄 ${rows[0].score} 分` : '今天還沒記錄，點個分數快速記一下：'));
      const quickRow = el('div', { class: 'mood-score-row sm mobile-widget-mood-row', id: 'wMoodQuickRow' });
      for (let i = 1; i <= 10; i++) {
        quickRow.appendChild(el('button', {
          class: 'mood-score-btn sm' + (mobileMoodQuickScore === i ? ' selected' : ''),
          'data-score': i,
          onclick: (ev) => { ev.stopPropagation(); mobileQuickMoodPick(i); },
        }, String(i)));
      }
      body.appendChild(quickRow);
    } else {
      if (rows.length) {
        body.appendChild(el('div', { class: 'wv small' }, `${rows[0].score} 分`));
        body.appendChild(el('div', { class: 'w-sub' }, '今天已記錄'));
      } else {
        body.appendChild(el('div', { class: 'wv small' }, '😊'));
        body.appendChild(el('div', { class: 'w-sub' }, '點擊記錄心情'));
      }
    }
  } catch (e) {
    body.innerHTML = '';
    body.appendChild(el('div', { class: 'w-sub' }, '暫時無法取得'));
  }
}
async function mobileQuickMoodPick(score) {
  mobileMoodQuickScore = score;
  document.querySelectorAll('#wMoodQuickRow .mood-score-btn').forEach((b) => b.classList.toggle('selected', Number(b.dataset.score) === score));
  try {
    await api(`/mood/entries/${todayStr()}`, { method: 'PUT', body: { score, tags: [], note: '' } });
    showToast('已記錄今天的心情 💗');
  } catch (e) { showToast('儲存失敗：' + e.message); }
}
async function loadMobileFinanceWidget() {
  const body = $('#wFinanceBody');
  if (!body) return;
  try {
    const summary = await api('/finance/summary');
    const expense = (summary.totals || []).find((t) => t.type === 'expense')?.total || 0;
    body.innerHTML = '';
    body.appendChild(el('div', { class: 'wv' }, fmtMoney(expense)));
    body.appendChild(el('div', { class: 'w-sub' }, '本月支出'));
  } catch (e) {
    body.innerHTML = '';
    body.appendChild(el('div', { class: 'w-sub' }, '暫時無法取得'));
  }
}
async function loadMobileBillsWidget() {
  const body = $('#wBillsBody');
  if (!body) return;
  try {
    const res = await api('/bills/upcoming');
    const unpaid = res.bills.filter((b) => !b.paid);
    body.innerHTML = '';
    if (!res.bills.length) {
      body.appendChild(el('div', { class: 'wv small' }, '尚未加入'));
      body.appendChild(el('div', { class: 'w-sub' }, '點擊新增帳單'));
    } else if (!unpaid.length) {
      body.appendChild(el('div', { class: 'wv small' }, '都繳完了 🎉'));
    } else {
      body.appendChild(el('div', { class: 'wv small' }, unpaid[0].name));
      body.appendChild(el('div', { class: 'w-sub' }, `每月${unpaid[0].due_day}號・還有${unpaid.length}筆`));
    }
  } catch (e) {
    body.innerHTML = '';
    body.appendChild(el('div', { class: 'w-sub' }, '暫時無法取得'));
  }
}
async function loadMobileCalendarWidget() {
  const body = $('#wCalendarBody');
  if (!body) return;
  try {
    const today = new Date();
    const from = today.toISOString().slice(0, 10);
    const toD = new Date(today); toD.setDate(toD.getDate() + 14);
    const to = toD.toISOString().slice(0, 10);
    // 行事曆 API 會自動把待辦截止日整合進來 (方便在行事曆分頁一次看到全部行程)，但首頁/手機拼貼
    // 已經有獨立的「待辦事項」卡片在顯示同一批資料——兩邊都出現同一件事會讓人覺得重複、雜亂，
    // 這裡把 auto-task 類別濾掉，只保留真的行事曆行程跟帳單/生日這種待辦卡片不會顯示的類別。
    const events = (await api(`/calendar?from=${from}&to=${to}`)).filter((ev) => ev.category !== 'auto-task');
    body.innerHTML = '';
    if (!events.length) {
      body.appendChild(el('div', { class: 'wv small' }, '沒有排程'));
      body.appendChild(el('div', { class: 'w-sub' }, '接下來兩週'));
    } else {
      body.appendChild(el('div', { class: 'wv small' }, events[0].title.length > 8 ? events[0].title.slice(0, 8) + '…' : events[0].title));
      body.appendChild(el('div', { class: 'w-sub' }, `${events[0].event_date}${events.length > 1 ? ` 等${events.length}項` : ''}`));
    }
  } catch (e) {
    body.innerHTML = '';
    body.appendChild(el('div', { class: 'w-sub' }, '暫時無法取得'));
  }
}

function dashCard(icon, title, bodyId, onClick, staticHint) {
  const children = [el('h3', {}, [el('div', { class: 'hex-badge' }, icon), title])];
  if (staticHint) {
    children.push(el('p', { class: 'hint', style: 'margin-bottom:0' }, staticHint));
  } else if (bodyId) {
    children.push(el('div', { id: bodyId }, skeletonLines(2)));
  }
  return el('div', { class: `card dash-card${onClick ? ' clickable' : ''}`, onclick: onClick || undefined }, children);
}

// 主動式提醒：帳單快到期、預算超支、待辦逾期、好幾天沒記心情，集中列在首頁最上面，
// 不用自己一個一個分頁點進去才會發現。沒有任何提醒事項時，這個區塊直接不顯示 (不留空白卡片)。
async function loadDashReminders() {
  const wrap = $('#dashRemindersWrap');
  if (!wrap) return;
  try {
    const data = await api('/insights/reminders');
    wrap.innerHTML = '';
    if (!data.items || !data.items.length) return;
    const box = el('div', { class: 'dash-reminders-box' });
    data.items.forEach((item) => {
      box.appendChild(el('div', { class: `dash-reminder-item ${item.severity}`, onclick: () => switchTab(item.tab) }, [
        el('span', { class: 'dash-reminder-icon' }, item.icon),
        el('span', { class: 'dash-reminder-text' }, item.text),
      ]));
    });
    wrap.appendChild(box);
  } catch (e) { /* 靜默失敗，不影響首頁其他內容 */ }
}

// 本週動態：純程式算出來的幾句話 (心情/記帳/待辦/行事曆/日記)，不是 AI 寫的，資料就是資料。
async function loadDashWeeklyDigest() {
  const body = $('#weeklyDigestBody');
  if (!body) return;
  try {
    const data = await api('/insights/weekly');
    body.innerHTML = '';
    if (!data.lines || !data.lines.length) {
      body.appendChild(el('p', { class: 'hint', style: 'margin:0' }, '這週還沒有足夠的資料可以整理'));
      return;
    }
    const list = el('ul', { class: 'dash-mini-list' });
    data.lines.forEach((line) => list.appendChild(el('li', {}, [el('span', {}, line)])));
    body.appendChild(list);
  } catch (e) {
    body.innerHTML = '';
    body.appendChild(el('p', { class: 'hint', style: 'margin:0' }, '本週動態暫時無法取得'));
  }
}

// 首頁快速心情打卡：有些人比較懶，不想特地點進心情頁才能記錄，
// 所以直接在首頁的卡片裡放一列小分數按鈕 + 選填備註，點兩下就能存。
// 注意這裡的每個互動元件都要 stopPropagation()，不然點下去會被外層卡片的
// onclick 攔截、直接跳轉到心情頁而不是選分數。
let dashMoodQuickScore = null;

async function loadDashMoodSummary() {
  const body = $('#moodSummaryBody');
  if (!body) return;
  try {
    const today = todayStr();
    const [todayRows, summary] = await Promise.all([
      api(`/mood/entries?from=${today}&to=${today}`),
      api('/mood/summary?days=7'),
    ]);
    body.innerHTML = '';
    dashMoodQuickScore = todayRows.length ? todayRows[0].score : null;

    if (summary.careMessage) {
      body.appendChild(el('div', { class: 'dash-care-banner' }, `💌 ${summary.careMessage}`));
    }
    if (todayRows.length) {
      body.appendChild(el('div', { class: 'stat-big' }, `${todayRows[0].score} 分`));
      body.appendChild(el('p', { class: 'hint', style: 'margin:4px 0 8px' }, `今天已記錄 · 近 7 天平均 ${summary.average != null ? summary.average : '--'} 分`));
    } else {
      body.appendChild(el('p', { class: 'hint', style: 'margin:0 0 6px' }, '今天還沒記錄，點個分數快速記一下：'));
    }

    const quickRow = el('div', { class: 'mood-score-row sm', id: 'dashMoodQuickRow' });
    for (let i = 1; i <= 10; i++) {
      quickRow.appendChild(el('button', {
        class: 'mood-score-btn sm' + (dashMoodQuickScore === i ? ' selected' : ''),
        'data-score': i,
        onclick: (ev) => { ev.stopPropagation(); dashQuickMoodPick(i); },
      }, String(i)));
    }
    body.appendChild(quickRow);

    body.appendChild(el('div', { class: 'dash-mood-quick-note', id: 'dashMoodQuickNoteRow', style: todayRows.length ? 'display:none' : 'display:flex' }, [
      el('input', { id: 'dashMoodQuickNote', placeholder: '想補充一句嗎？(選填)', value: todayRows.length ? (todayRows[0].note || '') : '', onclick: (ev) => ev.stopPropagation(), onkeydown: (ev) => ev.stopPropagation() }),
      el('button', { class: 'btn btn-primary', style: 'font-size:12px;padding:6px 10px', onclick: (ev) => { ev.stopPropagation(); saveDashQuickMood(); } }, '儲存'),
    ]));
  } catch (e) {
    body.innerHTML = '';
    body.appendChild(el('p', { class: 'hint', style: 'margin-bottom:0' }, '心情資料暫時無法取得'));
  }
}

function dashQuickMoodPick(score) {
  dashMoodQuickScore = score;
  document.querySelectorAll('#dashMoodQuickRow .mood-score-btn').forEach((b) => b.classList.toggle('selected', Number(b.dataset.score) === score));
  const noteRow = $('#dashMoodQuickNoteRow');
  if (noteRow) noteRow.style.display = 'flex';
}

async function saveDashQuickMood() {
  if (!dashMoodQuickScore) { showToast('先選一個 1-10 的分數'); return; }
  try {
    const noteEl = $('#dashMoodQuickNote');
    await api(`/mood/entries/${todayStr()}`, {
      method: 'PUT',
      body: { score: dashMoodQuickScore, tags: [], note: noteEl ? noteEl.value.trim() : '' },
    });
    showToast('已記錄今天的心情 💗');
    loadDashMoodSummary();
  } catch (e) { showToast('儲存失敗：' + e.message); }
}

async function loadDashStockSummary() {
  const body = $('#stocksSummaryBody');
  if (!body) return;
  try {
    const t = await api('/stocks/index/taiex');
    body.innerHTML = '';
    const changeColor = t.change > 0 ? 'delta-up' : t.change < 0 ? 'delta-down' : '';
    body.appendChild(el('div', { class: 'stat-big' }, [
      t.index != null ? Number(t.index).toLocaleString('zh-Hant-TW', { maximumFractionDigits: 2 }) : '--',
      el('span', { class: changeColor, style: 'font-size:13px;margin-left:8px' }, t.change != null ? `${t.change > 0 ? '▲+' : t.change < 0 ? '▼' : ''}${t.change}` : ''),
    ]));
    body.appendChild(el('p', { class: 'hint', style: 'margin:6px 0 0' }, `加權指數 · 台灣證交所公開資料`));
    if (state.watchlist.length) {
      const list = el('ul', { class: 'dash-mini-list' });
      state.watchlist.slice(0, 4).forEach((code) => {
        list.appendChild(el('li', {}, [el('span', { class: 'lbl' }, code), el('span', {}, '點卡片查看報價')]));
      });
      body.appendChild(list);
      if (state.watchlist.length > 4) body.appendChild(el('p', { class: 'hint', style: 'margin:6px 0 0' }, `還有 ${state.watchlist.length - 4} 檔自選股`));
    } else {
      body.appendChild(el('p', { class: 'hint', style: 'margin:6px 0 0' }, '還沒有加入自選股，點卡片前往設定'));
    }
  } catch (e) {
    body.innerHTML = '';
    body.appendChild(el('p', { class: 'hint', style: 'margin-bottom:0' }, '股市資料暫時無法取得'));
  }
}

async function loadDashCalendarSummary() {
  const body = $('#calendarSummaryBody');
  if (!body) return;
  try {
    const today = new Date();
    const from = today.toISOString().slice(0, 10);
    const toDate = new Date(today); toDate.setDate(toDate.getDate() + 14);
    const to = toDate.toISOString().slice(0, 10);
    // 行事曆 API 會自動把待辦截止日整合進來 (方便在行事曆分頁一次看到全部行程)，但首頁/手機拼貼
    // 已經有獨立的「待辦事項」卡片在顯示同一批資料——兩邊都出現同一件事會讓人覺得重複、雜亂，
    // 這裡把 auto-task 類別濾掉，只保留真的行事曆行程跟帳單/生日這種待辦卡片不會顯示的類別。
    const events = (await api(`/calendar?from=${from}&to=${to}`)).filter((ev) => ev.category !== 'auto-task');
    body.innerHTML = '';
    if (!events.length) {
      body.appendChild(el('p', { class: 'hint', style: 'margin-bottom:0' }, '接下來兩週沒有安排的行程'));
    } else {
      const list = el('ul', { style: 'list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:6px' });
      events.slice(0, 3).forEach((ev) => {
        list.appendChild(el('li', { style: 'font-size:12.5px;color:var(--text-secondary)' }, `${ev.event_date}${ev.start_time ? ' ' + ev.start_time : ''} · ${ev.title}`));
      });
      body.appendChild(list);
      if (events.length > 3) body.appendChild(el('p', { class: 'hint', style: 'margin:6px 0 0' }, `還有 ${events.length - 3} 項行程，點卡片查看完整行事曆`));
    }
  } catch (e) {
    body.innerHTML = '';
    body.appendChild(el('p', { class: 'hint', style: 'margin-bottom:0' }, '行事曆資料暫時無法取得'));
  }
}

async function loadDashFinanceSummary() {
  const body = $('#financeSummaryBody');
  if (!body) return;
  try {
    const summary = await api('/finance/summary');
    const income = (summary.totals || []).find((t) => t.type === 'income')?.total || 0;
    const expense = (summary.totals || []).find((t) => t.type === 'expense')?.total || 0;
    body.innerHTML = '';
    body.appendChild(el('div', { class: 'stat-big' }, fmtMoney(expense)));
    body.appendChild(el('p', { class: 'hint', style: 'margin:4px 0 0' }, `本月支出 · 收入 ${fmtMoney(income)}`));
    const byExpense = (summary.byCategory || []).filter((c) => c.type === 'expense').slice(0, 4);
    if (byExpense.length) {
      const list = el('ul', { class: 'dash-mini-list' });
      byExpense.forEach((c) => {
        list.appendChild(el('li', {}, [el('span', { class: 'lbl' }, c.category), el('span', {}, fmtMoney(c.total))]));
      });
      body.appendChild(list);
    } else {
      body.appendChild(el('p', { class: 'hint', style: 'margin:8px 0 0' }, '本月還沒有記帳紀錄，點卡片新增一筆'));
    }
  } catch (e) {
    body.innerHTML = '';
    body.appendChild(el('p', { class: 'hint', style: 'margin-bottom:0' }, '記帳資料暫時無法取得'));
  }
}

async function loadDashDiarySummary() {
  const body = $('#diarySummaryBody');
  if (!body) return;
  try {
    const entries = await api('/diary?from=0001-01-01&to=9999-12-31');
    body.innerHTML = '';
    if (!entries.length) {
      body.appendChild(el('p', { class: 'hint', style: 'margin-bottom:0' }, '還沒有日記，點卡片開始寫下今天'));
    } else {
      body.appendChild(el('p', { class: 'hint', style: 'margin-bottom:8px' }, `共 ${entries.length} 篇日記，最近寫的：`));
      const list = el('div', { style: 'display:flex;flex-direction:column;gap:10px' });
      entries.slice(0, 3).forEach((entry) => {
        const snippet = (entry.content || '').slice(0, 34);
        list.appendChild(el('div', {}, [
          el('div', { style: 'font-size:11.5px;color:var(--text-muted)' }, entry.entry_date),
          el('div', { style: 'font-size:12.5px;color:var(--text-secondary)' }, snippet + (entry.content && entry.content.length > 34 ? '…' : '')),
        ]));
      });
      body.appendChild(list);
    }
  } catch (e) {
    body.innerHTML = '';
    body.appendChild(el('p', { class: 'hint', style: 'margin-bottom:0' }, '日記資料暫時無法取得'));
  }
}

// ---- 首頁「待辦事項」卡片：3 種可切換的呈現樣式 (使用者自己在卡片上選、立刻看到效果並記住選擇) ----
// grouped=分組統計條 (已過期/今天/全部待完成三個彩色泡泡＋清單)；progress=完成進度環 (圓環百分比＋
// 可直接勾選完成)；focus=今日焦點 (只列今天+已過期、字級加大，其餘收成一行連結)。
const TASK_WIDGET_STYLE_LABELS = { grouped: '樣式A：分組統計', progress: '樣式B：進度環', focus: '樣式C：今日焦點' };

function buildTasksDashCard() {
  const style = (state.prefs && state.prefs.taskWidgetStyle) || 'progress';
  const header = el('h3', {}, [
    el('div', { class: 'hex-badge' }, '✅'),
    '待辦事項',
    el('select', {
      style: 'margin-left:auto;font-size:11px;padding:3px 6px;width:auto;border-radius:6px;',
      onclick: (ev) => ev.stopPropagation(),
      onchange: (ev) => { ev.stopPropagation(); setTaskWidgetStyle(ev.target.value); },
    }, Object.entries(TASK_WIDGET_STYLE_LABELS).map(([val, label]) => el('option', { value: val, selected: val === style }, label))),
  ]);
  return el('div', { class: 'card dash-card clickable', onclick: () => switchTab('tasks') }, [
    header,
    el('div', { id: 'tasksSummaryBody' }, skeletonLines(2)),
  ]);
}

// 進度環用 SVG 畫 (而不是 CSS conic-gradient)，這樣邊緣可以用 round linecap 收圓角、視覺上更精緻，
// 也留了轉場動畫的空間 (雖然目前每次都整個重建 DOM、動畫不會真的播放，但保留這個做法方便未來局部更新時直接受益)。
function buildProgressRingSvg(pct, size, strokeWidth) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(100, pct)) / 100);
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  const bg = document.createElementNS(NS, 'circle');
  bg.setAttribute('cx', size / 2); bg.setAttribute('cy', size / 2); bg.setAttribute('r', radius);
  bg.setAttribute('fill', 'none'); bg.setAttribute('stroke', 'var(--surface-2)'); bg.setAttribute('stroke-width', strokeWidth);
  const fg = document.createElementNS(NS, 'circle');
  fg.setAttribute('cx', size / 2); fg.setAttribute('cy', size / 2); fg.setAttribute('r', radius);
  fg.setAttribute('fill', 'none'); fg.setAttribute('stroke', 'var(--accent)'); fg.setAttribute('stroke-width', strokeWidth);
  fg.setAttribute('stroke-linecap', 'round');
  fg.setAttribute('stroke-dasharray', String(circumference));
  fg.setAttribute('stroke-dashoffset', String(offset));
  fg.setAttribute('transform', `rotate(-90 ${size / 2} ${size / 2})`);
  fg.style.transition = 'stroke-dashoffset 0.5s ease';
  svg.appendChild(bg);
  svg.appendChild(fg);
  const wrap = el('div', { style: `position:relative;width:${size}px;height:${size}px;flex-shrink:0` }, [svg]);
  wrap.appendChild(el('div', {
    style: 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800',
  }, `${pct}%`));
  return wrap;
}

async function setTaskWidgetStyle(style) {
  state.prefs = state.prefs || {};
  state.prefs.taskWidgetStyle = style;
  try { await api('/prefs', { method: 'PUT', body: state.prefs }); } catch (e) {}
  loadDashTasksSummary();
}

// 首頁待辦卡片這次看的時候要「依時間」還是「依優先度」排序——只是當下想怎麼看，不用跨裝置記住，
// 所以用一般變數就好，不用存進 prefs。
let dashTaskSortMode = 'time';

// 從首頁卡片直接勾選完成，不用先跳去待辦事項頁——跟 tasks.js 分頁的 completeTask 呼叫同一支 API，
// 完成後只重新整理這張卡片本身 (不用整個首頁重繪)，動作更輕、也不會打斷使用者正在看的其他卡片。
async function completeTaskFromDash(id, ev) {
  if (ev) ev.stopPropagation();
  try {
    await api(`/tasks/${id}/complete`, { method: 'PUT', body: { completed: true } });
    loadDashTasksSummary();
  } catch (e) { showToast('更新失敗：' + e.message); }
}

// 首頁直接刪除，不用先跳去待辦事項頁——這是使用者明確要求的「取消」功能，跟卡片本身的
// onclick (點卡片跳去待辦事項頁) 用 stopPropagation 隔開，不然點到 × 會先跳頁。
async function deleteTaskFromDash(id, ev) {
  if (ev) ev.stopPropagation();
  try {
    await api(`/tasks/${id}`, { method: 'DELETE' });
    loadDashTasksSummary();
  } catch (e) { showToast('刪除失敗：' + e.message); }
}

async function loadDashTasksSummary() {
  const body = $('#tasksSummaryBody');
  if (!body) return;
  const style = (state.prefs && state.prefs.taskWidgetStyle) || 'progress';
  try {
    const pending = await api('/tasks?status=pending');
    body.innerHTML = '';
    if (!pending.length) {
      body.appendChild(el('p', { class: 'hint', style: 'margin-bottom:0' }, '目前沒有待完成的任務 🎉'));
      return;
    }
    const today = todayStr();
    if (style === 'progress') {
      const done = await api('/tasks?status=completed');
      const total = pending.length + done.length;
      const pct = total ? Math.round((done.length / total) * 100) : 0;
      const overdue = pending.filter((t) => t.due_date && t.due_date < today).length;
      const wrap = el('div', { style: 'display:flex;gap:16px;align-items:center;margin-bottom:12px' }, [
        buildProgressRingSvg(pct, 72, 7),
        el('div', {}, [
          el('div', { style: 'font-size:15px;font-weight:800' }, `還有 ${pending.length} 件待完成`),
          el('div', { class: 'hint', style: 'margin:2px 0 0' }, [
            `已完成 ${done.length} / ${total} 件`,
            overdue ? el('span', { style: 'color:var(--critical);font-weight:700' }, ` · ${overdue} 件已過期`) : null,
          ]),
        ]),
      ]);
      body.appendChild(wrap);

      // 排序方式：預設跟到期日一樣 (API 本來就是這樣排)，也可以切成依優先度——存在模組變數
      // 而不是 prefs，這只是「這次看的時候想怎麼排」，不需要跨裝置記住。
      const sortRow = el('div', { style: 'display:flex;gap:6px;margin-bottom:8px' }, [
        el('button', {
          class: `dash-sort-btn${dashTaskSortMode === 'time' ? ' active' : ''}`,
          onclick: (ev) => { ev.stopPropagation(); dashTaskSortMode = 'time'; loadDashTasksSummary(); },
        }, '🕐 依時間'),
        el('button', {
          class: `dash-sort-btn${dashTaskSortMode === 'priority' ? ' active' : ''}`,
          onclick: (ev) => { ev.stopPropagation(); dashTaskSortMode = 'priority'; loadDashTasksSummary(); },
        }, '🔥 依優先度'),
      ]);
      body.appendChild(sortRow);

      const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };
      const priorityDotColor = { high: 'var(--critical)', medium: 'var(--warning)', low: 'var(--good)' };
      const sorted = dashTaskSortMode === 'priority'
        ? [...pending].sort((a, b) => (PRIORITY_RANK[a.priority] ?? 1) - (PRIORITY_RANK[b.priority] ?? 1))
        : pending;
      const list = el('div', { class: 'dash-mini-list dash-task-mini-list' });
      sorted.slice(0, 4).forEach((t) => {
        const isOverdue = t.due_date && t.due_date < today;
        const dateLabel = !t.due_date ? '' : (isOverdue ? '已過期' : (t.due_date === today ? '今天' : t.due_date.slice(5)));
        list.appendChild(el('div', { class: 'dash-task-row' }, [
          el('input', { type: 'checkbox', class: 'dash-check', onclick: (ev) => ev.stopPropagation(), onchange: (ev) => completeTaskFromDash(t.id, ev) }),
          el('span', { class: 'dash-task-dot', style: `background:${priorityDotColor[t.priority] || 'var(--text-muted)'}` }),
          el('span', { class: 'dash-task-title' }, t.title),
          dateLabel ? el('span', { class: `dash-task-date${isOverdue ? ' overdue' : ''}` }, dateLabel) : null,
          el('button', { class: 'dash-task-del', onclick: (ev) => deleteTaskFromDash(t.id, ev), title: '刪除' }, '×'),
        ]));
      });
      body.appendChild(list);
    } else if (style === 'focus') {
      const focus = pending.filter((t) => t.due_date && t.due_date <= today);
      const rest = pending.length - focus.length;
      body.appendChild(el('div', { style: 'font-size:16px;font-weight:800;margin-bottom:8px' }, focus.length ? `今天有 ${focus.length} 件事要處理` : '今天沒有急著要做的事 🎉'));
      focus.slice(0, 4).forEach((t) => {
        const isOverdue = t.due_date < today;
        body.appendChild(el('label', { style: `display:flex;align-items:center;gap:10px;padding:6px 0;font-size:14px;${isOverdue ? 'color:var(--critical)' : ''}` }, [
          el('input', { type: 'checkbox', style: 'width:16px;height:16px;flex:0 0 auto', onclick: (ev) => ev.stopPropagation(), onchange: (ev) => completeTaskFromDash(t.id, ev) }),
          el('span', {}, `${t.title}${isOverdue ? ' · 已過期' : ''}`),
        ]));
      });
      if (rest > 0) body.appendChild(el('div', { class: 'hint', style: 'margin-top:8px' }, `還有 ${rest} 件之後的待辦，點卡片查看全部`));
    } else {
      // grouped (預設)：已過期/今天/全部待完成三個彩色統計泡泡＋清單，過期的項目用紅字凸顯
      const overdue = pending.filter((t) => t.due_date && t.due_date < today).length;
      const dueToday = pending.filter((t) => t.due_date === today).length;
      const pill = (label, count, color) => el('span', { style: `font-size:13px;font-weight:700;padding:5px 12px;border-radius:999px;background:color-mix(in srgb, ${color} 16%, transparent);color:${color}` }, `${label} ${count}`);
      body.appendChild(el('div', { style: 'display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap' }, [
        overdue ? pill('⚠️ 已過期', overdue, 'var(--critical)') : null,
        pill('📍 今天', dueToday, 'var(--warning)'),
        pill('📋 全部待完成', pending.length, 'var(--text-secondary)'),
      ]));
      const list = el('div', { class: 'dash-mini-list' });
      pending.slice(0, 4).forEach((t) => {
        const isOverdue = t.due_date && t.due_date < today;
        list.appendChild(el('div', { style: `display:flex;justify-content:space-between;gap:8px;${isOverdue ? 'color:var(--critical);font-weight:600' : ''}` }, [
          el('span', {}, `${PRIORITY_LABEL[t.priority] || ''} ${t.title}`),
          el('span', { style: 'font-size:11.5px;opacity:0.75' }, t.due_date || ''),
        ]));
      });
      body.appendChild(list);
    }
  } catch (e) {
    body.innerHTML = '';
    body.appendChild(el('p', { class: 'hint', style: 'margin-bottom:0' }, '待辦資料暫時無法取得'));
  }
}

async function loadDashBillsSummary() {
  const body = $('#billsSummaryBody');
  if (!body) return;
  try {
    const res = await api('/bills/upcoming');
    body.innerHTML = '';
    const unpaid = res.bills.filter((b) => !b.paid);
    if (!res.bills.length) {
      body.appendChild(el('p', { class: 'hint', style: 'margin-bottom:0' }, '還沒有加入任何帳單'));
    } else if (!unpaid.length) {
      body.appendChild(el('p', { class: 'hint', style: 'margin-bottom:0' }, '這個月的帳單都繳完了 🎉'));
    } else {
      body.appendChild(el('p', { class: 'hint', style: 'margin-bottom:8px' }, `這個月還有 ${unpaid.length} 筆未繳，共 NT$ ${Math.round(res.totalUnpaid)}`));
      const list = el('div', { class: 'dash-mini-list' });
      unpaid.slice(0, 3).forEach((b) => list.appendChild(el('div', {}, `${b.name}（每月 ${b.due_day} 號）`)));
      body.appendChild(list);
    }
  } catch (e) {
    body.innerHTML = '';
    body.appendChild(el('p', { class: 'hint', style: 'margin-bottom:0' }, '帳單資料暫時無法取得'));
  }
}

function dashAskAI() {
  const input = $('#dashAskInput');
  const text = input ? input.value.trim() : '';
  if (!text) { switchTab('assistant'); return; }
  switchTab('assistant');
  state.assistantHistory = state.assistantHistory || [];
  const target = $('#assistantInput');
  if (target) { target.value = text; sendAssistantMessage(); }
}

// 手動觸發首頁摘要 (不是每次載入首頁就自動打 AI，避免不必要的 API 用量)
async function generateDashBriefing(period) {
  const box = $('#dashBriefResult');
  const btn = document.querySelector('.dash-brief-btn');
  if (!box) return;
  box.style.display = 'block';
  box.innerHTML = '';
  box.appendChild(el('p', { class: 'hint', style: 'margin:0' }, '整理中...'));
  if (btn) btn.disabled = true;
  try {
    const result = await api('/assistant/briefing', { method: 'POST', body: { period } });
    box.innerHTML = '';
    box.appendChild(el('p', { style: 'margin:0;white-space:pre-wrap' }, result.reply || '目前沒有特別的內容'));
  } catch (e) {
    box.innerHTML = '';
    box.appendChild(el('p', { class: 'hint', style: 'margin:0' }, '摘要暫時無法產生：' + e.message));
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ===================== 股票 =====================
const STOCK_SUB_TABS = [
  { key: 'watchlist', label: '⭐ 自選股' },
  { key: 'portfolio', label: '💼 我的持股' },
  { key: 'alerts', label: '🔔 到價提醒' },
  { key: 'screener', label: '🔍 選股工具' },
];
let stockSubTab = 'watchlist';
function switchStockSub(key) {
  stockSubTab = key;
  renderStocks();
}

async function renderStocks() {
  const c = $('#tab-stocks');
  c.innerHTML = '';
  c.appendChild(el('div', { class: 'disclaimer' }, '股票資訊來自台灣證券交易所公開資料 (每日盤後更新)，所有技術指標、選股工具皆為統計描述/資料整理，SOX 指數為非官方資料源，均不構成任何投資建議，買賣決策請自行判斷並留意風險。'));

  c.appendChild(el('div', { class: 'grid-2', style: 'margin-bottom:16px' }, [
    el('div', { class: 'card', id: 'taiexCard', style: 'margin-bottom:0' }, [skeletonLines(2)]),
    el('div', { class: 'card', id: 'soxCard', style: 'margin-bottom:0' }, [skeletonLines(2)]),
  ]));
  loadTaiexCard();
  loadSoxCard();

  c.appendChild(el('div', { class: 'subnav' }, STOCK_SUB_TABS.map((t) =>
    el('div', { class: `subnav-item${stockSubTab === t.key ? ' active' : ''}`, onclick: () => switchStockSub(t.key) }, t.label)
  )));
  const panel = (key, children) => el('div', { class: `subpanel${stockSubTab === key ? ' active' : ''}` }, children);

  if (stockSubTab === 'watchlist') {
    if (stockDetailCode && state.watchlist.includes(stockDetailCode)) {
      // ---- 個股詳細頁 (master-detail)：點列表進來看單一個股的完整資料，不用整頁滑很長 ----
      const detailWrap = el('div', { id: 'watchlistArea' });
      c.appendChild(panel('watchlist', [detailWrap]));
      loadStockDetail(stockDetailCode, detailWrap);
    } else {
      const watchCard = el('div', { class: 'card' }, [
        el('h3', {}, '自選股'),
        el('p', { class: 'hint' }, '點股票列查看該股完整資訊 (估值、均線、KD/RSI/MACD、法人動向、新聞)；按 📌 可同時釘選多檔只看關鍵數字比較。'),
        el('div', { class: 'form-row' }, [
          el('input', { id: 'newStockCode', placeholder: '輸入股票代號或公司名稱，如 2330 或 台積電' }),
          el('button', { class: 'btn btn-primary', onclick: addWatchStock }, '加入自選'),
        ]),
        el('div', { id: 'watchlistArea' }),
      ]);
      c.appendChild(panel('watchlist', [watchCard]));
      await renderWatchlist();
    }
  } else if (stockSubTab === 'portfolio') {
    c.appendChild(panel('portfolio', [renderPortfolioPanel()]));
    loadPortfolio();
  } else if (stockSubTab === 'alerts') {
    c.appendChild(panel('alerts', [renderAlertsPanel()]));
    loadAlerts();
  } else if (stockSubTab === 'screener') {
    c.appendChild(panel('screener', [renderScreenerPanel()]));
  }
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
  const raw = $('#newStockCode').value.trim();
  if (!raw) return;
  try {
    const resolved = await api(`/stocks/resolve/${encodeURIComponent(raw)}`);
    if (!state.watchlist.includes(resolved.code)) state.watchlist.push(resolved.code);
    $('#newStockCode').value = '';
    await savePrefsWatchlist();
    renderWatchlist();
    showToast(`已加入 ${resolved.name} (${resolved.code})`);
  } catch (e) {
    showToast(`加入失敗：${e.message}`);
  }
}
async function removeWatchStock(code) {
  state.watchlist = state.watchlist.filter((c) => c !== code);
  await savePrefsWatchlist();
  pinnedStocks.delete(code);
  if (stockDetailCode === code) stockDetailCode = null;
  if (stockDetailCode) renderStocks(); else renderWatchlist();
}
async function savePrefsWatchlist() {
  try {
    await api('/prefs', { method: 'PUT', body: { ...state.prefs, watchlist: state.watchlist } });
  } catch (e) {}
}

// ---- Master-detail 導覽狀態：點列表跳轉到單一個股的詳細頁，而不是原地展開一長串 ----
let stockDetailCode = null;
const pinnedStocks = new Set(); // 同時釘選多檔時，只顯示精簡數字比較，不用一次攤開全部細節

function openStockDetail(code) {
  stockDetailCode = code;
  renderStocks();
}
function closeStockDetail() {
  stockDetailCode = null;
  renderStocks();
}
function togglePinStock(code, ev) {
  if (ev) ev.stopPropagation();
  if (pinnedStocks.has(code)) pinnedStocks.delete(code);
  else pinnedStocks.add(code);
  renderWatchlist();
}

function sectionTitle(text) {
  return el('div', { style: 'font-size:12.5px;font-weight:700;color:var(--text-secondary);margin-bottom:8px' }, text);
}

function miniStat(label, value) {
  return el('span', { class: 'mini-stat' }, [label + ' ', el('b', {}, value)]);
}
function miniBadge(tone, text) {
  const cls = tone === 'positive' ? 'badge-positive' : tone === 'negative' ? 'badge-negative' : 'badge-neutral';
  return el('span', { class: `badge ${cls}`, style: 'font-size:11px;padding:2px 8px' }, text);
}

async function renderWatchlist() {
  const area = $('#watchlistArea');
  area.innerHTML = '';
  if (!state.watchlist.length) { area.appendChild(el('div', { class: 'empty-state' }, '尚未加入自選股')); return; }

  // ---- 釘選比較區：同時釘選多檔時，只顯示精簡數字，不用整排都攤開 ----
  const pinned = state.watchlist.filter((c) => pinnedStocks.has(c));
  if (pinned.length) {
    const compareGrid = el('div', { class: 'stock-compare-grid' });
    area.appendChild(el('div', { style: 'margin-bottom:14px' }, [
      sectionTitle(`📌 已釘選比較 (${pinned.length})`),
      compareGrid,
    ]));
    pinned.forEach((code) => {
      const cardBox = el('div', { class: 'stock-compare-card' }, [el('div', { class: 'label' }, `載入 ${code} 中...`)]);
      compareGrid.appendChild(cardBox);
      loadCompareCard(code, cardBox);
    });
  }

  const listBox = el('div', { class: 'stock-row-list' });
  area.appendChild(listBox);
  for (const code of state.watchlist) {
    const row = el('div', { class: 'stock-row' }, [el('div', { class: 'label' }, `載入 ${code} 中...`)]);
    listBox.appendChild(row);
    loadWatchlistRow(code, row);
  }
}

async function loadCompareCard(code, box) {
  try {
    const [quote, valuation] = await Promise.all([
      api(`/stocks/quote/${code}`).catch((e) => ({ error: e.message })),
      api(`/stocks/valuation/${code}`).catch((e) => ({ error: e.message })),
    ]);
    box.innerHTML = '';
    if (quote.error) {
      box.appendChild(el('div', { class: 'label' }, `${code} — ${quote.error}`));
      return;
    }
    const changeColor = quote.change > 0 ? 'delta-up' : quote.change < 0 ? 'delta-down' : '';
    box.appendChild(el('div', { style: 'display:flex;justify-content:space-between;align-items:flex-start' }, [
      el('div', { style: 'font-weight:800;font-size:13.5px;cursor:pointer', onclick: () => openStockDetail(code) }, `${quote.name || code} (${code})`),
      el('span', { style: 'cursor:pointer;font-size:13px', onclick: (ev) => togglePinStock(code, ev), title: '取消釘選' }, '📌'),
    ]));
    box.appendChild(el('div', { class: 'stat-tile', style: 'margin-top:4px' }, [
      el('span', { class: 'value', style: 'font-size:16px' }, quote.closingPrice != null ? quote.closingPrice.toFixed(2) : '--'),
      el('span', { class: changeColor, style: 'margin-left:6px;font-size:12px' }, `${quote.change > 0 ? '▲+' : quote.change < 0 ? '▼' : ''}${quote.change}`),
    ]));
    if (!valuation.error && valuation) {
      box.appendChild(el('div', { style: 'margin-top:6px;display:flex;flex-wrap:wrap;gap:6px' }, [
        valuation.peRatio != null ? miniStat('本益比', valuation.peRatio.toFixed(2)) : null,
        valuation.dividendYield != null ? miniStat('殖利率', valuation.dividendYield.toFixed(2) + '%') : null,
      ]));
    }
  } catch (e) {
    box.innerHTML = '';
    box.appendChild(el('div', { class: 'label' }, `${code} 載入失敗`));
  }
}

async function loadWatchlistRow(code, row) {
  try {
    const [quote, inst, indicatorRes, valuation, technicals] = await Promise.all([
      api(`/stocks/quote/${code}`).catch((e) => ({ error: e.message })),
      api(`/stocks/institutional/${code}?days=15`).catch((e) => ({ error: e.message })),
      api(`/stocks/indicator/${code}`).catch((e) => ({ error: e.message })),
      api(`/stocks/valuation/${code}`).catch((e) => ({ error: e.message })),
      api(`/stocks/technicals/${code}`).catch((e) => ({ error: e.message })),
    ]);
    row.innerHTML = '';
    if (quote.error) {
      row.appendChild(el('div', { style: 'display:flex;justify-content:space-between;align-items:center' }, [
        el('div', {}, [el('b', {}, code), ` — ${quote.error}`]),
        el('button', { class: 'btn btn-ghost', onclick: () => removeWatchStock(code) }, '移除'),
      ]));
      return;
    }
    const changeColor = quote.change > 0 ? 'delta-up' : quote.change < 0 ? 'delta-down' : '';
    const prevClose = quote.closingPrice != null ? quote.closingPrice - quote.change : null;
    const changePct = prevClose ? (quote.change / prevClose) * 100 : null;

    // ---- 精簡數字列：只看這排就好，點列進入詳細頁，不用原地展開一長串 ----
    const summaryChips = [];
    if (!valuation.error && valuation && valuation.peRatio != null) summaryChips.push(miniStat('本益比', valuation.peRatio.toFixed(2)));
    if (!valuation.error && valuation && valuation.dividendYield != null) summaryChips.push(miniStat('殖利率', valuation.dividendYield.toFixed(2) + '%'));
    if (!indicatorRes.error && indicatorRes.indicator && indicatorRes.indicator.available) {
      summaryChips.push(miniBadge(indicatorRes.indicator.tone, `均線 ${indicatorRes.indicator.label}`));
    }
    if (!inst.error && inst.signal) summaryChips.push(miniBadge(inst.signal.tone, `法人 ${inst.signal.label}`));
    if (!technicals.error && technicals.kd && technicals.kd.available) summaryChips.push(miniBadge(technicals.kd.tone, `KD ${technicals.kd.k}`));

    row.className = 'stock-row';
    row.onclick = () => openStockDetail(code);
    row.appendChild(el('div', { class: 'stock-row-left' }, [
      el('div', { style: 'font-weight:800;font-size:15px' }, `${quote.name || code} (${code})`),
      summaryChips.length ? el('div', { class: 'stock-summary-chips' }, summaryChips) : el('div', { class: 'label', style: 'margin-top:4px' }, `收盤日期 ${quote.date || '--'}`),
    ]));
    row.appendChild(el('div', { class: 'stock-row-right' }, [
      el('div', { class: 'stat-tile' }, [
        el('span', { class: 'value', style: 'font-size:18px' }, quote.closingPrice != null ? quote.closingPrice.toFixed(2) : '--'),
        el('span', { class: changeColor, style: 'margin-left:6px;font-size:12.5px' },
          `${quote.change > 0 ? '▲+' : quote.change < 0 ? '▼' : ''}${quote.change}${changePct != null ? ` (${changePct > 0 ? '+' : ''}${changePct.toFixed(2)}%)` : ''}`),
      ]),
      el('span', {
        class: `stock-pin-btn${pinnedStocks.has(code) ? ' active' : ''}`,
        title: pinnedStocks.has(code) ? '取消釘選比較' : '釘選比較 (數字檢視)',
        onclick: (ev) => togglePinStock(code, ev),
      }, '📌'),
      el('button', {
        class: 'btn btn-ghost',
        style: 'padding:5px 10px;font-size:12px',
        onclick: (ev) => { ev.stopPropagation(); removeWatchStock(code); },
      }, '移除'),
    ]));
  } catch (e) {
    row.innerHTML = '';
    row.appendChild(el('div', {}, `${code} 載入失敗: ${e.message}`));
  }
}

async function loadStockDetail(code, box) {
  try {
    const [quote, inst, indicatorRes, newsRes, valuation, historyRes, technicals, instVolTrend] = await Promise.all([
      api(`/stocks/quote/${code}`).catch((e) => ({ error: e.message })),
      api(`/stocks/institutional/${code}?days=15`).catch((e) => ({ error: e.message })),
      api(`/stocks/indicator/${code}`).catch((e) => ({ error: e.message })),
      api(`/stocks/news/${code}`).catch((e) => ({ error: e.message })),
      api(`/stocks/valuation/${code}`).catch((e) => ({ error: e.message })),
      api(`/stocks/history/${code}`).catch((e) => ({ error: e.message })),
      api(`/stocks/technicals/${code}`).catch((e) => ({ error: e.message })),
      api(`/stocks/institutional/${code}/volume-trend`).catch((e) => ({ error: e.message })),
    ]);
    box.innerHTML = '';
    const backBtn = el('button', { class: 'btn btn-ghost stock-detail-back', onclick: closeStockDetail }, '← 返回自選股列表');
    if (quote.error) {
      box.appendChild(el('div', { class: 'card' }, [
        backBtn,
        el('div', { style: 'margin-top:10px' }, [el('b', {}, code), ` — ${quote.error}`]),
      ]));
      return;
    }
    const changeColor = quote.change > 0 ? 'delta-up' : quote.change < 0 ? 'delta-down' : '';
    const prevClose = quote.closingPrice != null ? quote.closingPrice - quote.change : null;
    const changePct = prevClose ? (quote.change / prevClose) * 100 : null;

    box.appendChild(el('div', { class: 'stock-detail-topline' }, [
      backBtn,
      el('span', {
        class: `stock-pin-btn${pinnedStocks.has(code) ? ' active' : ''}`,
        style: 'font-size:18px',
        title: pinnedStocks.has(code) ? '取消釘選比較' : '釘選比較 (數字檢視)',
        onclick: () => togglePinStock(code),
      }, '📌'),
    ]));

    // ---- 主要區塊：左欄大字報價+基本數據，右欄圖表/技術指標/法人/新聞，兩欄各自呈現，減少整頁往下滑 ----
    const detail = el('div', { class: 'stock-detail-grid' });
    box.appendChild(detail);

    const colLeft = el('div', { class: 'stock-detail-col stock-detail-col-left' });
    const colRight = el('div', { class: 'stock-detail-col stock-detail-col-right' });
    detail.appendChild(colLeft);
    detail.appendChild(colRight);

    // ---- 左欄：主角級大字報價 ----
    colLeft.appendChild(el('div', { class: 'card stock-hero-card' }, [
      el('div', { style: 'font-size:13px;font-weight:700;color:var(--text-secondary)' }, `${quote.name || code} (${code})`),
      el('div', { class: 'stock-hero-price' }, quote.closingPrice != null ? quote.closingPrice.toFixed(2) : '--'),
      el('div', { class: changeColor, style: 'font-size:16px;font-weight:700' },
        `${quote.change > 0 ? '▲ +' : quote.change < 0 ? '▼ ' : ''}${quote.change}${changePct != null ? ` (${changePct > 0 ? '+' : ''}${changePct.toFixed(2)}%)` : ''}`),
      el('div', { class: 'label', style: 'margin-top:6px' }, `收盤日期 ${quote.date || '--'} (每日盤後更新)`),
    ]));

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
    colLeft.appendChild(el('div', { class: 'card' }, [sectionTitle('關鍵數據'), el('div', { class: 'kv-grid' }, kvs)]));

    // ---- 均線位置描述 (非預測) ----
    if (!indicatorRes.error && indicatorRes.indicator && indicatorRes.indicator.available) {
      const ind = indicatorRes.indicator;
      const badgeClass = ind.tone === 'positive' ? 'badge-positive' : ind.tone === 'negative' ? 'badge-negative' : 'badge-neutral';
      colLeft.appendChild(el('div', { class: 'card' }, [
        sectionTitle('均線位置'),
        el('span', { class: `badge ${badgeClass}` }, ind.label),
        el('span', { style: 'margin-left:8px;font-size:12px;color:var(--text-muted)' }, `MA5 ${ind.ma5} / MA20 ${ind.ma20} (${ind.diffPct > 0 ? '+' : ''}${ind.diffPct}%)`),
        el('div', { style: 'font-size:11px;color:var(--text-muted);margin-top:4px' }, ind.disclaimer),
      ]));
    } else if (indicatorRes.indicator) {
      colLeft.appendChild(el('div', { class: 'card' }, [sectionTitle('均線位置'), el('div', { style: 'font-size:12px;color:var(--text-muted)' }, indicatorRes.indicator.reason || '')]));
    }

    // ---- 右欄：股價走勢 + 均線圖 ----
    if (!historyRes.error && historyRes.points && historyRes.points.length >= 5) {
      const sec = el('div', { class: 'card' }, [sectionTitle(`近 ${historyRes.points.length} 個交易日收盤走勢與均線`)]);
      const chartDiv = el('div');
      sec.appendChild(chartDiv);
      colRight.appendChild(sec);
      renderPriceChart(chartDiv, historyRes.points);
    }

    // ---- 更多技術指標 (RSI / KD / MACD / 成交量趨勢) ----
    if (!technicals.error) {
      const techBadges = [];
      if (technicals.rsi && technicals.rsi.available) techBadges.push(miniBadge(technicals.rsi.tone, `RSI ${technicals.rsi.value}`));
      if (technicals.kd && technicals.kd.available) techBadges.push(miniBadge(technicals.kd.tone, `KD K${technicals.kd.k} D${technicals.kd.d}`));
      if (technicals.macd && technicals.macd.available) techBadges.push(miniBadge(technicals.macd.tone, `MACD 柱狀 ${technicals.macd.histogram}`));
      if (technicals.volumeTrend && technicals.volumeTrend.available) techBadges.push(miniBadge(technicals.volumeTrend.tone, technicals.volumeTrend.label));
      if (techBadges.length) {
        const techSec = el('div', { class: 'card' }, [
          sectionTitle('更多技術指標 (統計描述，非預測)'),
          el('div', { style: 'display:flex;flex-wrap:wrap;gap:6px' }, techBadges),
        ]);
        if (technicals.rsi && technicals.rsi.available) techSec.appendChild(el('div', { class: 'label', style: 'margin-top:6px' }, `RSI(${technicals.rsi.period})：${technicals.rsi.label}`));
        if (technicals.kd && technicals.kd.available) techSec.appendChild(el('div', { class: 'label', style: 'margin-top:2px' }, `KD：${technicals.kd.label} · ${technicals.kd.crossNote}`));
        if (technicals.macd && technicals.macd.available) techSec.appendChild(el('div', { class: 'label', style: 'margin-top:2px' }, `MACD：${technicals.macd.label}`));
        if (!instVolTrend.error && instVolTrend.available) techSec.appendChild(el('div', { class: 'label', style: 'margin-top:2px' }, `法人力道：${instVolTrend.label}`));
        colRight.appendChild(techSec);
      }
    }

    // ---- 法人動向 (合計圖 + 外資/投信/自營商 分項) ----
    if (!inst.error) {
      const badgeClass = inst.signal.tone === 'positive' ? 'badge-positive' : inst.signal.tone === 'negative' ? 'badge-negative' : 'badge-neutral';
      const instSec = el('div', { class: 'card' }, [
        sectionTitle('三大法人買賣超 (近15個交易日)'),
        el('div', {}, [
          el('span', { class: `badge ${badgeClass}` }, inst.signal.label),
          el('span', { style: 'margin-left:8px;font-size:12px;color:var(--text-muted)' }, inst.signal.detail),
        ]),
      ]);
      const chartDiv = el('div', { style: 'margin-top:10px' });
      instSec.appendChild(chartDiv);
      colRight.appendChild(instSec);
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
        instSec.appendChild(el('div', { class: 'inst-chips' }, [
          chip('外資', last.foreign, sum('foreign')),
          chip('投信', last.trust, sum('trust')),
          chip('自營商', last.dealer, sum('dealer')),
        ]));
      }
    }

    // ---- 相關新聞 ----
    if (!newsRes.error && newsRes.items && newsRes.items.length) {
      const newsBox = el('div', { class: 'card' }, [sectionTitle('相關新聞 (來源: Yahoo奇摩股市)')]);
      newsRes.items.slice(0, 5).forEach((n) => {
        newsBox.appendChild(el('a', { href: n.link, target: '_blank', rel: 'noopener', style: 'display:block;font-size:12.5px;color:var(--series-blue);margin-bottom:5px;text-decoration:none' }, '· ' + n.title));
      });
      colRight.appendChild(newsBox);
    }
  } catch (e) {
    box.innerHTML = '';
    box.appendChild(el('div', { class: 'card' }, [el('button', { class: 'btn btn-ghost', onclick: closeStockDetail }, '← 返回自選股列表'), el('div', { style: 'margin-top:10px' }, `${code} 載入失敗: ${e.message}`)]));
  }
}

// ---------- 我的持股 (庫存損益追蹤) ----------
function renderPortfolioPanel() {
  return el('div', {}, [
    el('div', { class: 'card' }, [
      el('h3', {}, '➕ 新增交易紀錄'),
      el('p', { class: 'hint' }, '記下買賣進出，損益 (含已實現/未實現) 會自動用移動加權平均成本法算給你看，不用自己拿計算機算。'),
      el('div', { class: 'form-row' }, [
        el('input', { id: 'stxCode', list: 'stxCodeList', placeholder: '股票代號，如 2330' }),
        el('datalist', { id: 'stxCodeList' }),
        el('input', { id: 'stxDate', type: 'date', value: todayStr() }),
        el('select', { id: 'stxSide' }, [el('option', { value: 'buy' }, '買進'), el('option', { value: 'sell' }, '賣出')]),
      ]),
      el('div', { class: 'form-row', style: 'margin-top:8px' }, [
        el('input', { id: 'stxShares', type: 'number', placeholder: '股數' }),
        el('input', { id: 'stxPrice', type: 'number', placeholder: '成交價' }),
        el('input', { id: 'stxFee', type: 'number', placeholder: '手續費 (選填)' }),
        el('input', { id: 'stxTax', type: 'number', placeholder: '證交稅 (賣出，選填)' }),
      ]),
      el('button', { class: 'btn btn-primary', style: 'margin-top:10px', onclick: addStockTransaction }, '新增交易'),
    ]),
    el('div', { class: 'card' }, [
      el('h3', {}, '💰 股利紀錄'),
      el('div', { class: 'form-row' }, [
        el('input', { id: 'stxDivCode', list: 'stxCodeList', placeholder: '股票代號' }),
        el('input', { id: 'stxDivDate', type: 'date', value: todayStr() }),
        el('input', { id: 'stxDivAmount', type: 'number', placeholder: '發放金額' }),
      ]),
      el('button', { class: 'btn btn-ghost', style: 'margin-top:8px', onclick: addStockDividend }, '新增股利紀錄'),
      el('div', { id: 'stxDividendList', style: 'margin-top:10px' }),
    ]),
    el('div', { class: 'card' }, [
      el('h3', {}, '📊 庫存損益總覽'),
      el('div', { id: 'stxPortfolioSummary' }, el('div', { class: 'empty-state' }, '載入中...')),
      el('div', { id: 'stxPortfolioList', style: 'margin-top:10px' }),
    ]),
    el('div', { class: 'card' }, [
      el('h3', {}, '📜 交易紀錄'),
      el('div', { id: 'stxTransactionList' }, el('div', { class: 'empty-state' }, '載入中...')),
    ]),
  ]);
}

async function addStockTransaction() {
  const code = $('#stxCode').value.trim();
  const shares = Number($('#stxShares').value);
  const price = Number($('#stxPrice').value);
  if (!code || !shares || shares <= 0 || price == null || Number.isNaN(price)) { showToast('請填寫代號、股數、成交價'); return; }
  try {
    await api('/stocks/transactions', {
      method: 'POST',
      body: {
        code, tradeDate: $('#stxDate').value, side: $('#stxSide').value,
        shares, price, fee: Number($('#stxFee').value) || 0, tax: Number($('#stxTax').value) || 0,
      },
    });
    $('#stxCode').value = ''; $('#stxShares').value = ''; $('#stxPrice').value = ''; $('#stxFee').value = ''; $('#stxTax').value = '';
    showToast('已新增交易紀錄');
    loadPortfolio();
  } catch (e) { showToast('新增失敗：' + e.message); }
}

async function addStockDividend() {
  const code = $('#stxDivCode').value.trim();
  const amount = Number($('#stxDivAmount').value);
  if (!code || !amount || amount < 0) { showToast('請填寫代號與金額'); return; }
  try {
    await api('/stocks/dividends', { method: 'POST', body: { code, payDate: $('#stxDivDate').value, amount } });
    $('#stxDivCode').value = ''; $('#stxDivAmount').value = '';
    showToast('已記錄股利');
    loadPortfolio();
    loadStockDividendList();
  } catch (e) { showToast('新增失敗：' + e.message); }
}

async function loadStockDividendList() {
  const box = $('#stxDividendList');
  if (!box) return;
  try {
    const rows = await api('/stocks/dividends');
    box.innerHTML = '';
    if (!rows.length) { box.appendChild(el('div', { class: 'empty-state' }, '還沒有股利紀錄')); return; }
    rows.slice(0, 10).forEach((r) => {
      box.appendChild(el('div', { class: 'coping-note-item' }, [
        el('div', { class: 'content' }, `${r.pay_date} · ${r.name || r.code} (${r.code}) · ${fmtMoney(r.amount)}`),
        el('button', { class: 'del-btn', onclick: () => deleteStockDividend(r.id) }, '✕'),
      ]));
    });
  } catch (e) { box.innerHTML = ''; box.appendChild(el('div', { class: 'empty-state' }, '股利紀錄暫時無法取得')); }
}
async function deleteStockDividend(id) {
  await api(`/stocks/dividends/${id}`, { method: 'DELETE' });
  loadStockDividendList();
  loadPortfolio();
}

async function loadPortfolio() {
  const summaryBox = $('#stxPortfolioSummary');
  const listBox = $('#stxPortfolioList');
  const txBox = $('#stxTransactionList');
  if (!summaryBox) return;
  try {
    const [portfolio, transactions] = await Promise.all([api('/stocks/portfolio'), api('/stocks/transactions')]);
    populateStockCodeDatalist(transactions);
    loadStockDividendList();

    summaryBox.innerHTML = '';
    const t = portfolio.totals;
    summaryBox.appendChild(el('div', { class: 'stx-stat-strip' }, [
      el('div', { class: 'stx-stat' }, [el('div', { class: 'k' }, '總市值'), el('div', { class: 'v num' }, t.totalMarketValue != null ? fmtMoney(t.totalMarketValue) : '部分報價暫缺')]),
      el('div', { class: 'stx-stat' }, [el('div', { class: 'k' }, '未實現損益'), el('div', { class: 'v num', style: t.totalUnrealizedPL > 0 ? 'color:var(--series-red)' : t.totalUnrealizedPL < 0 ? 'color:var(--series-green)' : '' }, t.totalUnrealizedPL != null ? fmtMoney(t.totalUnrealizedPL) : '部分報價暫缺')]),
      el('div', { class: 'stx-stat' }, [el('div', { class: 'k' }, '已實現損益'), el('div', { class: 'v num', style: t.totalRealizedPL > 0 ? 'color:var(--series-red)' : t.totalRealizedPL < 0 ? 'color:var(--series-green)' : '' }, fmtMoney(t.totalRealizedPL))]),
      el('div', { class: 'stx-stat' }, [el('div', { class: 'k' }, '累計股利收入'), el('div', { class: 'v num' }, fmtMoney(t.totalDividendIncome))]),
    ]));
    summaryBox.appendChild(el('p', { class: 'hint', style: 'margin-top:8px' }, portfolio.disclaimer));

    listBox.innerHTML = '';
    if (!portfolio.positions.length) {
      listBox.appendChild(el('div', { class: 'empty-state' }, '還沒有任何交易紀錄'));
    } else {
      portfolio.positions.forEach((p) => {
        listBox.appendChild(el('div', { class: 'coping-note-item', style: 'flex-direction:column;align-items:stretch;gap:4px' }, [
          el('div', { style: 'display:flex;justify-content:space-between;font-weight:700' }, [
            el('div', {}, `${p.name || p.code} (${p.code})`),
            el('div', {}, p.shares > 0 ? `${fmtNum(p.shares)} 股` : '已全數賣出'),
          ]),
          el('div', { class: 'hint', style: 'margin:0' },
            p.shares > 0
              ? `均價 ${p.avgCost} · 現價 ${p.currentPrice != null ? p.currentPrice : '暫缺'} · 未實現 ${p.unrealizedPL != null ? fmtMoney(p.unrealizedPL) : '暫缺'}`
              : `已實現損益 ${fmtMoney(p.realizedPL)}`),
        ]));
      });
    }

    txBox.innerHTML = '';
    if (!transactions.length) {
      txBox.appendChild(el('div', { class: 'empty-state' }, '還沒有交易紀錄'));
    } else {
      transactions.slice(0, 30).forEach((t2) => {
        txBox.appendChild(el('div', { class: 'coping-note-item' }, [
          el('div', { class: 'content' }, `${t2.trade_date} · ${t2.side === 'buy' ? '買進' : '賣出'} ${t2.name || t2.code} (${t2.code}) ${fmtNum(t2.shares)} 股 @ ${t2.price}`),
          el('button', { class: 'del-btn', onclick: () => deleteStockTransaction(t2.id) }, '✕'),
        ]));
      });
    }
  } catch (e) {
    summaryBox.innerHTML = '';
    summaryBox.appendChild(el('div', { class: 'empty-state' }, '持股資料暫時無法取得'));
  }
}
async function deleteStockTransaction(id) {
  await api(`/stocks/transactions/${id}`, { method: 'DELETE' });
  loadPortfolio();
}
function populateStockCodeDatalist(transactions) {
  const list = $('#stxCodeList');
  if (!list) return;
  const codes = [...new Map(transactions.map((t) => [t.code, t.name])).entries()];
  list.innerHTML = '';
  codes.forEach(([code, name]) => list.appendChild(el('option', { value: code }, name || '')));
}

// ---------- 到價提醒 ----------
function renderAlertsPanel() {
  return el('div', {}, [
    el('div', { class: 'card' }, [
      el('h3', {}, '🔔 新增到價提醒'),
      el('p', { class: 'hint' }, '沒有背景推播機制，是「打開 App 或首頁摘要時檢查一次」的方式，不是即時通知。'),
      el('div', { class: 'form-row' }, [
        el('input', { id: 'alertCode', placeholder: '股票代號，如 2330' }),
        el('select', { id: 'alertDirection' }, [el('option', { value: 'above' }, '漲到 (≥)'), el('option', { value: 'below' }, '跌到 (≤)')]),
        el('input', { id: 'alertPrice', type: 'number', placeholder: '目標價' }),
      ]),
      el('button', { class: 'btn btn-primary', style: 'margin-top:10px', onclick: addStockAlert }, '新增提醒'),
    ]),
    el('div', { class: 'card' }, [
      el('h3', {}, '📋 提醒清單'),
      el('button', { class: 'btn btn-ghost', style: 'font-size:12px', onclick: checkStockAlerts }, '立即檢查是否到價'),
      el('div', { id: 'alertCheckResult', style: 'margin-top:8px' }),
      el('div', { id: 'alertListArea', style: 'margin-top:10px' }, el('div', { class: 'empty-state' }, '載入中...')),
    ]),
  ]);
}
async function addStockAlert() {
  const code = $('#alertCode').value.trim();
  const targetPrice = Number($('#alertPrice').value);
  if (!code || !targetPrice) { showToast('請填寫代號與目標價'); return; }
  try {
    await api('/stocks/alerts', { method: 'POST', body: { code, targetPrice, direction: $('#alertDirection').value } });
    $('#alertCode').value = ''; $('#alertPrice').value = '';
    showToast('已新增提醒');
    loadAlerts();
  } catch (e) { showToast('新增失敗：' + e.message); }
}
async function loadAlerts() {
  const area = $('#alertListArea');
  if (!area) return;
  try {
    const rows = await api('/stocks/alerts');
    area.innerHTML = '';
    if (!rows.length) { area.appendChild(el('div', { class: 'empty-state' }, '還沒有設定到價提醒')); return; }
    rows.forEach((r) => {
      area.appendChild(el('div', { class: 'coping-note-item' }, [
        el('div', { class: 'content' }, `${r.name || r.code} (${r.code}) ${r.direction === 'above' ? '漲到' : '跌到'} ${r.target_price}${r.triggered_at ? ' · ✅ 已到價' : ''}`),
        el('button', { class: 'del-btn', onclick: () => deleteStockAlert(r.id) }, '✕'),
      ]));
    });
  } catch (e) { area.innerHTML = ''; area.appendChild(el('div', { class: 'empty-state' }, '提醒清單暫時無法取得')); }
}
async function deleteStockAlert(id) {
  await api(`/stocks/alerts/${id}`, { method: 'DELETE' });
  loadAlerts();
}
async function checkStockAlerts() {
  const box = $('#alertCheckResult');
  box.innerHTML = '';
  box.appendChild(el('p', { class: 'hint', style: 'margin:0' }, '檢查中...'));
  try {
    const res = await api('/stocks/alerts/check');
    box.innerHTML = '';
    if (!res.triggered.length) {
      box.appendChild(el('p', { class: 'hint', style: 'margin:0' }, '目前沒有已到價的提醒'));
    } else {
      res.triggered.forEach((t) => {
        box.appendChild(el('div', { class: 'mood-signal-item' }, `🎯 ${t.name || t.code} (${t.code}) 已${t.direction === 'above' ? '漲到' : '跌到'} ${t.currentPrice} (目標 ${t.target_price})`));
      });
    }
    loadAlerts();
  } catch (e) { box.innerHTML = ''; box.appendChild(el('p', { class: 'hint', style: 'margin:0' }, '檢查失敗：' + e.message)); }
}

// ---------- 簡易選股/篩選 ----------
function renderScreenerPanel() {
  return el('div', {}, [
    el('div', { class: 'card' }, [
      el('h3', {}, '🔍 簡易選股工具'),
      el('p', { class: 'hint' }, '用證交所公開的全市場估值資料做排序整理，是資料篩選工具，不是選股建議。'),
      el('div', { class: 'form-row' }, [
        el('select', { id: 'screenerSortBy' }, [
          el('option', { value: 'dividendYield' }, '依殖利率排序'),
          el('option', { value: 'peRatio' }, '依本益比排序'),
          el('option', { value: 'pbRatio' }, '依股價淨值比排序'),
          el('option', { value: 'change' }, '依今日漲跌排序'),
          el('option', { value: 'tradeVolume' }, '依成交量排序'),
        ]),
        el('select', { id: 'screenerOrder' }, [el('option', { value: 'desc' }, '由高到低'), el('option', { value: 'asc' }, '由低到高')]),
      ]),
      el('div', { class: 'form-row', style: 'margin-top:8px' }, [
        el('input', { id: 'screenerMinYield', type: 'number', placeholder: '最低殖利率 % (選填)' }),
        el('input', { id: 'screenerMaxPE', type: 'number', placeholder: '最高本益比 (選填)' }),
        el('button', { class: 'btn btn-primary', onclick: runScreener }, '篩選') ,
      ]),
      el('div', { id: 'screenerResult', style: 'margin-top:14px' }),
    ]),
  ]);
}
async function runScreener() {
  const box = $('#screenerResult');
  box.innerHTML = '';
  box.appendChild(el('div', { class: 'empty-state' }, '搜尋中...'));
  try {
    const params = new URLSearchParams({
      sortBy: $('#screenerSortBy').value,
      order: $('#screenerOrder').value,
    });
    const minYield = $('#screenerMinYield').value;
    const maxPE = $('#screenerMaxPE').value;
    if (minYield) params.set('minDividendYield', minYield);
    if (maxPE) params.set('maxPE', maxPE);
    const res = await api(`/stocks/screener?${params.toString()}`);
    box.innerHTML = '';
    box.appendChild(el('p', { class: 'hint', style: 'margin-bottom:10px' }, `${res.disclaimer} (共 ${res.count} 檔符合，顯示前 ${res.results.length} 檔)`));
    if (!res.results.length) { box.appendChild(el('div', { class: 'empty-state' }, '沒有符合條件的股票，試試放寬篩選條件')); return; }
    const table = el('table', { class: 'stx-table' }, [
      el('thead', {}, el('tr', {}, [
        el('th', {}, '股票'),
        el('th', {}, '收盤價'),
        el('th', {}, '漲跌'),
        el('th', {}, '本益比'),
        el('th', {}, '殖利率'),
        el('th', {}, '股價淨值比'),
      ])),
    ]);
    const tbody = el('tbody', {});
    res.results.forEach((r) => {
      const changeText = r.change > 0 ? `▲+${r.change}` : r.change < 0 ? `▼${r.change}` : '持平';
      tbody.appendChild(el('tr', {}, [
        el('td', {}, `${r.name} (${r.code})`),
        el('td', { class: 'num' }, r.closingPrice != null ? r.closingPrice.toFixed(2) : '--'),
        el('td', { class: `num ${r.change > 0 ? 'delta-up' : r.change < 0 ? 'delta-down' : ''}` }, changeText),
        el('td', { class: 'num' }, r.peRatio != null ? r.peRatio.toFixed(2) : '--'),
        el('td', { class: 'num' }, r.dividendYield != null ? r.dividendYield.toFixed(2) + '%' : '--'),
        el('td', { class: 'num' }, r.pbRatio != null ? r.pbRatio.toFixed(2) : '--'),
      ]));
    });
    table.appendChild(tbody);
    box.appendChild(el('div', { style: 'overflow-x:auto' }, table));
  } catch (e) {
    box.innerHTML = '';
    box.appendChild(el('div', { class: 'empty-state' }, '篩選失敗：' + e.message));
  }
}

// ===================== 交通與旅遊 =====================
const TRAVEL_SUB_TABS = [
  { key: 'train', label: '🚄 台鐵 / 高鐵' },
  { key: 'flight', label: '✈️ 機票' },
  { key: 'hotel', label: '🏨 住宿' },
  { key: 'itinerary', label: '🗺️ 行程規劃' },
  { key: 'packing', label: '🎒 行前打包' },
  { key: 'split', label: '💸 旅遊分帳' },
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

  c.appendChild(panel('packing', [
    el('div', { class: 'card' }, [
      el('h3', {}, '🎒 行前打包清單'),
      el('p', { class: 'hint' }, '常用清單，跟旅程無關的通用版；下面「旅遊分帳」建立旅程後，也可以在旅程裡建立專屬的打包清單。'),
      el('div', { class: 'form-row' }, [
        el('select', { id: 'packingTemplate' }, [
          el('option', { value: '' }, '套用範本...'),
          el('option', { value: 'general' }, '通用'),
          el('option', { value: 'beach' }, '海島/沙灘'),
          el('option', { value: 'cold' }, '寒冷天氣'),
          el('option', { value: 'business' }, '商務出差'),
        ]),
        el('button', { class: 'btn btn-ghost', onclick: applyPackingTemplate }, '套用'),
      ]),
      el('div', { class: 'form-row', style: 'margin-top:8px' }, [
        el('input', { id: 'packingItem', placeholder: '要帶的東西，如：護照' }),
        el('input', { id: 'packingCategory', placeholder: '分類 (選填)，如：證件' }),
        el('button', { class: 'btn btn-primary', onclick: addPackingItem }, '新增'),
      ]),
      el('div', { id: 'packingList', style: 'margin-top:12px' }, el('div', { class: 'empty-state' }, '載入中...')),
    ]),
  ]));

  c.appendChild(panel('split', renderTripSplitPanel()));

  if (travelSubTab === 'train') loadFavoriteTrains();
  if (travelSubTab === 'packing') loadPackingList();
  if (travelSubTab === 'split') loadTrips();
}

// ---------- 行前打包清單 ----------
async function applyPackingTemplate() {
  const type = $('#packingTemplate').value;
  if (!type) return;
  const res = await api(`/travel/packing/template/${type}`);
  for (const item of res.items) {
    await api('/travel/packing', { method: 'POST', body: { item, category: '範本' } });
  }
  showToast('已套用範本');
  loadPackingList();
}
async function addPackingItem() {
  const item = $('#packingItem').value.trim();
  if (!item) { showToast('請填寫項目'); return; }
  await api('/travel/packing', { method: 'POST', body: { item, category: $('#packingCategory').value.trim() || '其他' } });
  $('#packingItem').value = ''; $('#packingCategory').value = '';
  loadPackingList();
}
async function loadPackingList() {
  const box = $('#packingList');
  if (!box) return;
  try {
    const rows = await api('/travel/packing');
    box.innerHTML = '';
    if (!rows.length) { box.appendChild(el('div', { class: 'empty-state' }, '還沒有打包項目，套用範本或自行新增')); return; }
    const byCategory = {};
    rows.forEach((r) => { (byCategory[r.category || '其他'] = byCategory[r.category || '其他'] || []).push(r); });
    Object.entries(byCategory).forEach(([cat, items]) => {
      box.appendChild(el('div', { class: 'label', style: 'margin:10px 0 4px;font-weight:700' }, cat));
      items.forEach((r) => {
        box.appendChild(el('div', { class: 'coping-note-item' }, [
          el('label', { class: 'content', style: 'display:flex;align-items:center;gap:8px;cursor:pointer' }, [
            el('input', { type: 'checkbox', checked: !!r.checked, onchange: (e) => togglePackingItem(r.id, e.target.checked) }),
            el('span', { style: r.checked ? 'text-decoration:line-through;color:var(--flat-sub)' : '' }, r.item),
          ]),
          el('button', { class: 'del-btn', onclick: () => deletePackingItem(r.id) }, '✕'),
        ]));
      });
    });
  } catch (e) { box.innerHTML = ''; box.appendChild(el('div', { class: 'empty-state' }, '清單暫時無法取得')); }
}
async function togglePackingItem(id, checked) {
  await api(`/travel/packing/${id}`, { method: 'PUT', body: { checked } });
}
async function deletePackingItem(id) {
  await api(`/travel/packing/${id}`, { method: 'DELETE' });
  loadPackingList();
}

// ---------- 旅遊分帳 ----------
let currentTripId = null;
function renderTripSplitPanel() {
  return el('div', {}, [
    el('div', { class: 'card' }, [
      el('h3', {}, '💸 建立新旅程'),
      el('p', { class: 'hint' }, '記下這趟旅程有誰、誰墊了什麼，最後自動算出最少筆數的轉帳建議——不管是一人先墊全部、還是大家輪流出都可以。'),
      el('div', { class: 'form-row' }, [
        el('input', { id: 'tripName', placeholder: '旅程名稱，如：東京五日遊' }),
        el('select', { id: 'tripCurrency' }, ['TWD', 'JPY', 'USD', 'KRW', 'EUR', 'HKD'].map((c) => el('option', { value: c }, c))),
        el('input', { id: 'tripParticipants', placeholder: '參與者，用逗號分隔，如：我,小明,小華' }),
      ]),
      el('button', { class: 'btn btn-primary', style: 'margin-top:10px', onclick: addTrip }, '建立旅程'),
    ]),
    el('div', { class: 'card' }, [
      el('h3', {}, '📋 旅程列表'),
      el('div', { id: 'tripList' }, el('div', { class: 'empty-state' }, '載入中...')),
    ]),
    el('div', { id: 'tripDetail' }),
  ]);
}

async function addTrip() {
  const name = $('#tripName').value.trim();
  if (!name) { showToast('請填寫旅程名稱'); return; }
  const names = $('#tripParticipants').value.split(',').map((s) => s.trim()).filter(Boolean);
  await api('/travel/trips', { method: 'POST', body: { name, baseCurrency: $('#tripCurrency').value, participantNames: names.length ? names : ['我'] } });
  $('#tripName').value = ''; $('#tripParticipants').value = '';
  showToast('已建立旅程');
  loadTrips();
}

async function loadTrips() {
  const box = $('#tripList');
  if (!box) return;
  try {
    const rows = await api('/travel/trips');
    box.innerHTML = '';
    if (!rows.length) { box.appendChild(el('div', { class: 'empty-state' }, '還沒有建立任何旅程')); return; }
    rows.forEach((t) => {
      box.appendChild(el('div', { class: 'coping-note-item', style: 'cursor:pointer', onclick: () => openTripDetail(t.id) }, [
        el('div', { class: 'content' }, [
          `${t.name} `,
          el('span', { class: `badge ${t.settled ? 'badge-neutral' : 'badge-positive'}` }, t.settled ? '已結清' : '進行中'),
          el('span', { class: 'hint', style: 'margin:0;margin-left:8px' }, t.base_currency),
        ]),
        el('button', { class: 'del-btn', onclick: (e) => { e.stopPropagation(); deleteTrip(t.id); } }, '✕'),
      ]));
    });
    if (currentTripId && rows.some((t) => t.id === currentTripId)) openTripDetail(currentTripId);
  } catch (e) { box.innerHTML = ''; box.appendChild(el('div', { class: 'empty-state' }, '旅程清單暫時無法取得')); }
}
async function deleteTrip(id) {
  await api(`/travel/trips/${id}`, { method: 'DELETE' });
  if (currentTripId === id) { currentTripId = null; $('#tripDetail').innerHTML = ''; }
  loadTrips();
}

async function openTripDetail(tripId) {
  currentTripId = tripId;
  const box = $('#tripDetail');
  box.innerHTML = '';
  const [participants, expenses, settlement] = await Promise.all([
    api(`/travel/trips/${tripId}/participants`),
    api(`/travel/trips/${tripId}/expenses`),
    api(`/travel/trips/${tripId}/settlement`),
  ]);

  box.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, '➕ 新增花費'),
    el('div', { class: 'form-row' }, [
      el('select', { id: 'expPayer' }, participants.map((p) => el('option', { value: p.id }, p.name))),
      el('input', { id: 'expDesc', placeholder: '花費說明，如：晚餐' }),
      el('input', { id: 'expAmount', type: 'number', placeholder: '金額' }),
    ]),
    el('div', { class: 'form-row', style: 'margin-top:8px' }, [
      el('input', { id: 'expCurrency', placeholder: '幣別，如 JPY (預設同旅程幣別)' }),
      el('input', { id: 'expRate', type: 'number', placeholder: '匯率換算 (1 單位 = 多少旅程幣別，預設1)' }),
      el('input', { id: 'expDate', type: 'date', value: todayStr() }),
    ]),
    el('p', { class: 'hint', style: 'margin-top:8px' }, '預設由所有參與者均分，之後可以擴充自訂分攤比例。'),
    el('button', { class: 'btn btn-primary', style: 'margin-top:6px', onclick: () => addTripExpense(tripId) }, '新增花費'),
    el('div', { style: 'margin-top:10px' }, [
      el('input', { id: 'newParticipantName', placeholder: '新增參與者名字' }),
      el('button', { class: 'btn btn-ghost', onclick: () => addTripParticipant(tripId) }, '加入旅伴'),
    ]),
  ]));

  box.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, '⚖️ 結算結果'),
    el('div', { class: 'stat-strip' }, settlement.balances.map((b) => el('div', { class: 'stat-item' }, [
      el('div', { class: 'k' }, b.name),
      el('div', { class: 'v num', style: b.net > 0 ? 'color:var(--good)' : b.net < 0 ? 'color:var(--critical)' : '' }, `${b.net > 0 ? '+' : ''}${fmtCurrency(b.net, settlement.baseCurrency)}`),
    ]))),
    el('p', { class: 'hint', style: 'margin-top:8px' }, settlement.disclaimer),
    settlement.transfers.length
      ? el('div', {}, settlement.transfers.map((t) => el('div', { class: 'mood-signal-item' }, `💰 ${t.from} → ${t.to}：${fmtCurrency(t.amount, settlement.baseCurrency)}`)))
      : el('div', { class: 'empty-state' }, '目前帳務已經打平，不需要轉帳'),
    !settlement.transfers.length && !expenses.length ? null : el('button', { class: 'btn btn-ghost', style: 'margin-top:8px', onclick: () => markTripSettled(tripId) }, '標記這趟旅程已結清'),
  ]));

  box.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, '📜 花費紀錄'),
    !expenses.length
      ? el('div', { class: 'empty-state' }, '還沒有花費紀錄')
      : el('div', {}, expenses.map((e) => el('div', { class: 'coping-note-item' }, [
          el('div', { class: 'content' }, `${e.expense_date || ''} · ${e.description || '花費'} · ${e.payer_name} 墊付 ${fmtCurrency(e.amount, e.currency)}${e.exchange_rate !== 1 ? ` (≈${fmtCurrency(Math.round(e.amount * e.exchange_rate), settlement.baseCurrency)})` : ''}`),
          el('button', { class: 'del-btn', onclick: () => deleteTripExpense(tripId, e.id) }, '✕'),
        ]))),
  ]));
}

async function addTripParticipant(tripId) {
  const name = $('#newParticipantName').value.trim();
  if (!name) return;
  await api(`/travel/trips/${tripId}/participants`, { method: 'POST', body: { name } });
  $('#newParticipantName').value = '';
  openTripDetail(tripId);
}

async function addTripExpense(tripId) {
  const payerId = Number($('#expPayer').value);
  const amount = Number($('#expAmount').value);
  if (!payerId || !amount || amount <= 0) { showToast('請填寫墊款人與金額'); return; }
  try {
    await api(`/travel/trips/${tripId}/expenses`, {
      method: 'POST',
      body: {
        payerId, description: $('#expDesc').value.trim(), amount,
        currency: $('#expCurrency').value.trim() || undefined,
        exchangeRate: Number($('#expRate').value) || 1,
        expenseDate: $('#expDate').value,
      },
    });
    showToast('已新增花費');
    openTripDetail(tripId);
  } catch (e) { showToast('新增失敗：' + e.message); }
}
async function deleteTripExpense(tripId, expenseId) {
  await api(`/travel/trips/${tripId}/expenses/${expenseId}`, { method: 'DELETE' });
  openTripDetail(tripId);
}
async function markTripSettled(tripId) {
  await api(`/travel/trips/${tripId}`, { method: 'PUT', body: { settled: true } });
  showToast('已標記為結清');
  loadTrips();
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
      const dateInputId = `favTrainDate-${r.id}`;
      area.appendChild(el('div', { style: 'display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--grid-line);flex-wrap:wrap;gap:8px' }, [
        el('div', { style: 'font-size:13px' }, `${r.mode === 'THSR' ? '高鐵' : '台鐵'} ${r.train_no} · ${r.from_station}${r.to_station ? ' → ' + r.to_station : ''} · ${r.departure_time || ''}`),
        el('div', { style: 'display:flex;gap:6px;align-items:center' }, [
          el('input', { id: dateInputId, type: 'date', style: 'width:132px;padding:6px 8px;font-size:12px' }),
          el('button', { class: 'btn btn-ghost', style: 'font-size:12px', onclick: () => addFavoriteTrainToCalendar(r, dateInputId) }, '📅 加入行事曆'),
          el('button', { class: 'btn btn-ghost', onclick: () => deleteFavoriteTrain(r.id) }, '移除'),
        ]),
      ]));
    });
  } catch (e) { area.innerHTML = ''; }
}
async function deleteFavoriteTrain(id) {
  await api(`/travel/train/favorites/${id}`, { method: 'DELETE' });
  loadFavoriteTrains();
}
async function addFavoriteTrainToCalendar(r, dateInputId) {
  const date = $(`#${dateInputId}`).value;
  if (!date) { showToast('請先選擇日期'); return; }
  try {
    await api('/calendar', {
      method: 'POST',
      body: {
        event_date: date,
        start_time: r.departure_time || null,
        title: `🚄 ${r.mode === 'THSR' ? '高鐵' : '台鐵'} ${r.train_no} ${r.from_station}${r.to_station ? '→' + r.to_station : ''}`,
        category: 'travel',
      },
    });
    showToast('已加入行事曆');
  } catch (e) { showToast('加入失敗: ' + e.message); }
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

// ===================== 日期/月曆共用工具 =====================
// 用本地時區組字串，不要用 toISOString()（那是 UTC，半夜時段會跟「今天」差一天）
function fmtYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function todayStr() { return fmtYMD(new Date()); }
// 產生月曆格子 (含前後補空白，湊滿整週)，month 是 0-11
function monthGridDates(year, month) {
  const first = new Date(year, month, 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// ===================== 日記 =====================
let diaryCalCursor = null;

function renderDiary() {
  const c = $('#tab-diary');
  c.innerHTML = '';
  const now = new Date();
  if (!diaryCalCursor) diaryCalCursor = { year: now.getFullYear(), month: now.getMonth() };

  c.appendChild(el('div', { class: 'grid-2' }, [
    el('div', { class: 'card', style: 'margin-bottom:0' }, [
      el('h3', {}, '寫日記'),
      el('div', { class: 'form-row' }, [
        el('input', { id: 'diaryDate', type: 'date', value: todayStr(), onchange: loadDiaryForDate }),
        el('label', { class: 'btn btn-ghost', style: 'cursor:pointer' }, [
          '📂 匯入文字',
          el('input', { type: 'file', accept: '.txt,.md', style: 'display:none', onchange: importDiaryFile }),
        ]),
      ]),
      el('textarea', { id: 'diaryContent', rows: 10, placeholder: '今天發生了什麼事...' }),
      el('div', { style: 'margin-top:10px' }, el('button', { class: 'btn btn-primary', onclick: saveDiary }, '儲存')),
    ]),
    el('div', { class: 'card', style: 'margin-bottom:0' }, [
      el('h3', {}, '月曆瀏覽'),
      el('p', { class: 'hint' }, '藍色圓點代表當天有寫日記，點日期直接跳過去看/編輯。'),
      el('div', { id: 'diaryCalendar' }),
    ]),
  ]));

  c.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, '搜尋日記'),
    el('div', { class: 'form-row' }, [
      el('input', { id: 'diarySearchInput', placeholder: '輸入關鍵字搜尋內容...', onkeydown: (ev) => { if (ev.key === 'Enter') searchDiary(); } }),
      el('button', { class: 'btn btn-primary', onclick: searchDiary }, '搜尋'),
      el('button', { class: 'btn btn-ghost', onclick: clearDiarySearch }, '清除'),
    ]),
  ]));

  c.appendChild(el('div', { class: 'card' }, [el('h3', {}, '日記列表'), el('div', { id: 'diaryList' })]));

  loadDiaryForDate();
  loadDiaryList();
  renderDiaryCalendar();
}

async function renderDiaryCalendar() {
  const box = $('#diaryCalendar');
  if (!box) return;
  const { year, month } = diaryCalCursor;
  const from = fmtYMD(new Date(year, month, 1));
  const to = fmtYMD(new Date(year, month + 1, 0));
  let marked = new Set();
  try {
    const rows = await api(`/diary?from=${from}&to=${to}`);
    marked = new Set(rows.map((r) => r.entry_date));
  } catch (e) { /* 忽略，當作沒有標記 */ }

  const cells = monthGridDates(year, month);
  const weekdayLabels = ['日', '一', '二', '三', '四', '五', '六'];
  box.innerHTML = '';
  box.appendChild(el('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px' }, [
    el('button', { class: 'btn btn-ghost', style: 'padding:4px 10px', onclick: () => shiftDiaryMonth(-1) }, '‹'),
    el('div', { style: 'font-weight:700;font-size:13.5px' }, `${year} 年 ${month + 1} 月`),
    el('button', { class: 'btn btn-ghost', style: 'padding:4px 10px', onclick: () => shiftDiaryMonth(1) }, '›'),
  ]));
  const grid = el('div', { class: 'mini-cal-grid' });
  weekdayLabels.forEach((w) => grid.appendChild(el('div', { class: 'mini-cal-weekday' }, w)));
  cells.forEach((d) => {
    if (!d) { grid.appendChild(el('div', { class: 'mini-cal-cell empty' })); return; }
    const dateStr = fmtYMD(d);
    const isToday = dateStr === todayStr();
    const hasEntry = marked.has(dateStr);
    grid.appendChild(el('div', {
      class: `mini-cal-cell${isToday ? ' today' : ''}${hasEntry ? ' has-mark' : ''}`,
      onclick: () => { $('#diaryDate').value = dateStr; loadDiaryForDate(); },
    }, [String(d.getDate()), hasEntry ? el('span', { class: 'mini-cal-dot' }) : null]));
  });
  box.appendChild(grid);
}
function shiftDiaryMonth(delta) {
  let { year, month } = diaryCalCursor;
  month += delta;
  if (month < 0) { month = 11; year -= 1; }
  if (month > 11) { month = 0; year += 1; }
  diaryCalCursor = { year, month };
  renderDiaryCalendar();
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
    renderDiaryCalendar();
  } catch (e) { showToast('儲存失敗: ' + e.message); }
}
function importDiaryFile(ev) {
  const file = ev.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => { $('#diaryContent').value = reader.result; };
  reader.readAsText(file, 'utf-8');
}
function searchDiary() {
  loadDiaryList($('#diarySearchInput').value.trim());
}
function clearDiarySearch() {
  $('#diarySearchInput').value = '';
  loadDiaryList();
}
async function loadDiaryList(q) {
  const list = $('#diaryList');
  list.innerHTML = '載入中...';
  try {
    const rows = await api(q ? `/diary?q=${encodeURIComponent(q)}` : '/diary');
    list.innerHTML = '';
    if (!rows.length) { list.appendChild(el('div', { class: 'empty-state' }, q ? '沒有符合的日記' : '還沒有日記')); return; }
    rows.slice(0, 30).forEach((r) => {
      list.appendChild(el('div', {
        style: 'padding:8px 0;border-bottom:1px solid var(--grid-line);cursor:pointer',
        onclick: () => { $('#diaryDate').value = r.entry_date; loadDiaryForDate(); },
      }, [
        el('b', {}, r.entry_date), el('div', { style: 'font-size:13px;color:var(--text-secondary)' }, (r.content || '').slice(0, 80)),
      ]));
    });
  } catch (e) { list.innerHTML = '載入失敗'; }
}

// ===================== 記帳 =====================
const FINANCE_CATEGORIES = ['餐飲', '交通', '娛樂', '購物', '居家', '醫療', '教育', '其他'];
let financeBudgets = [];
let financeSummaryCache = null;

function renderFinance() {
  const c = $('#tab-finance');
  c.innerHTML = '';
  c.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, '新增一筆記帳'),
    el('p', { class: 'hint' }, '目前為手動輸入金額；即時銀行帳戶餘額串接屬於台灣「Open Banking」範疇，需金融機構/金管會核准的第三方資格，暫未開放，詳見規劃書說明。'),
    el('div', { class: 'form-row' }, [
      el('input', { id: 'txDate', type: 'date', value: todayStr() }),
      el('select', { id: 'txType' }, [el('option', { value: 'expense' }, '支出'), el('option', { value: 'income' }, '收入')]),
      el('select', { id: 'txCategory', onchange: onTxCategoryChange }, [
        ...FINANCE_CATEGORIES.map((cat) => el('option', { value: cat }, cat)),
        el('option', { value: '__custom__' }, '✏️ 自訂分類...'),
      ]),
      el('input', { id: 'txAmount', type: 'number', placeholder: '金額' }),
    ]),
    el('div', { class: 'form-row' }, [
      el('input', { id: 'txCategoryCustom', placeholder: '輸入自訂分類名稱', style: 'display:none' }),
    ]),
    el('label', { style: 'display:block;font-size:13px;color:var(--text-secondary,#666);margin:10px 0 4px' }, '📝 這筆消費原因/備註 (選填，自己打字寫也可以)'),
    el('input', { id: 'txNote', list: 'txNoteList', placeholder: '例如：跟朋友聚餐、幫家人買日用品、加油...', style: 'width:100%' }),
    el('datalist', { id: 'txNoteList' }),
    el('button', { class: 'btn btn-primary', onclick: addTransaction, style: 'margin-top:10px' }, '新增'),
  ]));

  c.appendChild(el('div', { class: 'grid-2' }, [
    el('div', { class: 'card' }, [el('h3', {}, '本月支出分類'), el('div', { id: 'financeBarChart' })]),
    el('div', { class: 'card' }, [el('h3', {}, '近12個月收支趨勢'), el('div', { id: 'financeLineChart' })]),
  ]));

  c.appendChild(el('div', { class: 'grid-2' }, [
    el('div', { class: 'card' }, [
      el('h3', {}, '🔁 可能的固定支出/訂閱'),
      el('p', { class: 'hint' }, '依「備註+分類」找出在多個月份都出現、金額相近的支出，幫你整理成一份清單，是猜測不是保證。'),
      el('div', { id: 'subscriptionsArea' }, el('div', { class: 'empty-state' }, '載入中...')),
    ]),
    el('div', { class: 'card' }, [
      el('h3', {}, '📈 淨資產趨勢 (累計結餘)'),
      el('p', { class: 'hint' }, '每月收支的累計結餘隨時間的變化，不含股票等投資部位市值 (投資市值請看股票頁)。'),
      el('div', { id: 'networthChart' }),
    ]),
  ]));

  c.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, '🎯 財務目標'),
    el('p', { class: 'hint' }, '不用自己算存了多少，系統會用「設定目標之後的實際收入減支出」自動算進度，並用你的儲蓄速度推算大概什麼時候能達成。'),
    el('div', { class: 'form-row' }, [
      el('input', { id: 'goalName', placeholder: '目標名稱，例如：日本旅遊基金' }),
      el('input', { id: 'goalAmount', type: 'number', placeholder: '目標金額' }),
      el('input', { id: 'goalTargetDate', type: 'date', placeholder: '希望達成日 (選填)' }),
    ]),
    el('button', { class: 'btn btn-primary', onclick: addGoal, style: 'margin-top:6px' }, '新增目標'),
    el('div', { id: 'goalsArea', style: 'margin-top:14px' }),
  ]));

  c.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, '📊 預算設定'),
    el('p', { class: 'hint' }, '設定每個分類的每月預算上限，超支會用顏色提醒 (不會擋你記帳，只是提醒)。'),
    el('div', { id: 'budgetArea' }),
  ]));

  c.appendChild(el('div', { class: 'card' }, [el('h3', {}, '本月明細'), el('div', { id: 'txTable' })]));

  loadFinance();
  loadBudgets();
  loadGoals();
  loadSubscriptions();
  loadNetworthTrend();
}

async function loadSubscriptions() {
  const area = $('#subscriptionsArea');
  if (!area) return;
  try {
    const res = await api('/finance/subscriptions');
    area.innerHTML = '';
    if (!res.candidates.length) { area.appendChild(el('div', { class: 'empty-state' }, '目前資料還看不出明顯的固定支出模式')); return; }
    res.candidates.slice(0, 10).forEach((c) => {
      area.appendChild(el('div', { class: 'coping-note-item' }, [
        el('div', { class: 'content' }, [
          el('div', { style: 'font-weight:700' }, `${c.note} (${c.category})`),
          el('div', { class: 'hint', style: 'margin:2px 0 0' }, `約 ${fmtMoney(c.avgAmount)}／次 · 出現在 ${c.monthsSeen} 個月 · 最近一次 ${c.lastDate}`),
        ]),
      ]));
    });
  } catch (e) { area.innerHTML = ''; area.appendChild(el('div', { class: 'empty-state' }, '暫時無法分析')); }
}

async function loadNetworthTrend() {
  const box = $('#networthChart');
  if (!box) return;
  try {
    const res = await api('/finance/networth-trend');
    if (!res.trend.length) { box.innerHTML = ''; box.appendChild(el('div', { class: 'empty-state' }, '目前沒有可用的趨勢資料')); return; }
    renderLineChart(box, [
      { name: '累計結餘', color: cssVar('--series-violet'), points: res.trend.map((t) => ({ x: t.ym, y: t.cumulativeBalance })) },
    ]);
  } catch (e) { box.innerHTML = ''; box.appendChild(el('div', { class: 'empty-state' }, '暫時無法取得趨勢')); }
}

async function addGoal() {
  const name = $('#goalName').value.trim();
  const target_amount = Number($('#goalAmount').value);
  const target_date = $('#goalTargetDate').value || null;
  if (!name || !target_amount || target_amount <= 0) { showToast('請輸入目標名稱與大於 0 的金額'); return; }
  try {
    await api('/finance/goals', { method: 'POST', body: { name, target_amount, target_date } });
    $('#goalName').value = ''; $('#goalAmount').value = ''; $('#goalTargetDate').value = '';
    showToast('已新增目標');
    loadGoals();
  } catch (e) { showToast('新增失敗: ' + e.message); }
}

async function deleteGoal(id) {
  await api(`/finance/goals/${id}`, { method: 'DELETE' });
  loadGoals();
}

async function loadGoals() {
  const area = $('#goalsArea');
  if (!area) return;
  try {
    const goals = await api('/finance/goals');
    area.innerHTML = '';
    if (!goals.length) { area.appendChild(el('div', { class: 'empty-state' }, '還沒有設定財務目標')); return; }
    goals.forEach((g) => {
      const pct = Math.max(0, Math.min(100, g.progressPct));
      const barColor = pct >= 100 ? 'var(--good)' : pct >= 60 ? 'var(--series-blue)' : 'var(--warning)';
      let statusLine;
      if (g.projectedDate === 'reached') {
        statusLine = '🎉 已達成目標金額！';
      } else if (g.projectedDate) {
        statusLine = `依目前儲蓄速度，預估 ${g.projectedDate} 左右可達成` + (g.target_date ? (g.onTrack ? '（在預定日期內）' : '（可能會晚於預定日期，僅供參考）') : '');
      } else {
        statusLine = '目前還沒有明顯的淨儲蓄，先累積一些記帳紀錄';
      }
      area.appendChild(el('div', { style: 'padding:12px 0;border-bottom:1px solid var(--grid-line)' }, [
        el('div', { style: 'display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:6px' }, [
          el('div', { style: 'font-weight:700;font-size:14px' }, g.name),
          el('div', { style: 'display:flex;gap:8px;align-items:center' }, [
            el('span', { style: 'font-size:12px;color:var(--text-muted)' }, `${fmtMoney(g.netSaved)} / ${fmtMoney(g.target_amount)} (${pct}%)`),
            el('button', { class: 'btn btn-ghost', style: 'padding:5px 10px;font-size:12px', onclick: () => deleteGoal(g.id) }, '刪除'),
          ]),
        ]),
        el('div', { style: 'height:6px;background:var(--gray-mid);border-radius:999px;overflow:hidden' }, [
          el('div', { style: `height:100%;width:${pct}%;background:${barColor}` }),
        ]),
        el('p', { class: 'hint', style: 'margin:6px 0 0' }, statusLine),
      ]));
    });
  } catch (e) { area.innerHTML = ''; area.appendChild(el('div', { class: 'hint' }, '目標載入失敗')); }
}

function onTxCategoryChange() {
  $('#txCategoryCustom').style.display = $('#txCategory').value === '__custom__' ? 'block' : 'none';
}

async function addTransaction() {
  const sel = $('#txCategory').value;
  const category = sel === '__custom__' ? ($('#txCategoryCustom').value.trim() || '未分類') : sel;
  const body = {
    tx_date: $('#txDate').value,
    type: $('#txType').value,
    category,
    amount: Number($('#txAmount').value),
    note: $('#txNote').value.trim(),
  };
  if (!body.amount) { showToast('請輸入金額'); return; }
  try {
    await api('/finance/transactions', { method: 'POST', body });
    $('#txCategoryCustom').value = ''; $('#txAmount').value = ''; $('#txNote').value = '';
    showToast('已新增');
    loadFinance();
    loadSubscriptions();
    loadNetworthTrend();
  } catch (e) { showToast('新增失敗: ' + e.message); }
}
async function deleteTransaction(id) {
  await api(`/finance/transactions/${id}`, { method: 'DELETE' });
  loadFinance();
  loadSubscriptions();
  loadNetworthTrend();
}

// 表單自動記憶：用之前打過的備註填 <datalist>，保留自由輸入的同時提供建議，減少重複打字
function populateTxNoteDatalist(rows) {
  const list = $('#txNoteList');
  if (!list) return;
  const notes = [...new Set(rows.map((r) => (r.note || '').trim()).filter(Boolean))];
  list.innerHTML = '';
  notes.slice(0, 50).forEach((n) => list.appendChild(el('option', { value: n })));
}

async function loadFinance() {
  try {
    const summary = await api('/finance/summary');
    // 用最近 200 筆全部紀錄 (不限本月) 來準備備註自動完成的建議清單，這樣過去打過的字都記得住
    api('/finance/transactions').then(populateTxNoteDatalist).catch(() => {});
    financeSummaryCache = summary;
    const expenseByCat = summary.byCategory.filter((r) => r.type === 'expense').map((r) => ({ label: r.category, value: r.total }));
    renderBarChart($('#financeBarChart'), expenseByCat, { money: true, emptyText: '本月尚無支出紀錄' });

    const months = [...new Set(summary.monthlyTrend.map((r) => r.ym))];
    const income = months.map((m) => ({ x: m, y: (summary.monthlyTrend.find((r) => r.ym === m && r.type === 'income') || {}).total || 0 }));
    const expense = months.map((m) => ({ x: m, y: (summary.monthlyTrend.find((r) => r.ym === m && r.type === 'expense') || {}).total || 0 }));
    renderLineChart($('#financeLineChart'), [
      { name: '收入', color: cssVar('--series-blue'), points: income },
      { name: '支出', color: cssVar('--series-red'), points: expense },
    ]);

    const rows = await api('/finance/transactions?month=' + todayStr().slice(0, 7));
    populateTxNoteDatalist(rows);
    const table = $('#txTable');
    table.innerHTML = '';
    renderBudgetArea();
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

async function loadBudgets() {
  try { financeBudgets = await api('/finance/budgets'); } catch (e) { financeBudgets = []; }
  renderBudgetArea();
}

function renderBudgetArea() {
  const area = $('#budgetArea');
  if (!area) return;
  area.innerHTML = '';

  const spentByCategory = {};
  if (financeSummaryCache) {
    financeSummaryCache.byCategory.filter((r) => r.type === 'expense').forEach((r) => { spentByCategory[r.category] = r.total; });
  }
  const allCats = new Set(FINANCE_CATEGORIES);
  financeBudgets.forEach((b) => allCats.add(b.category));
  Object.keys(spentByCategory).forEach((cat) => allCats.add(cat));

  [...allCats].forEach((cat) => {
    const budget = financeBudgets.find((b) => b.category === cat);
    const limit = budget ? budget.monthly_limit : null;
    const spent = spentByCategory[cat] || 0;
    const pct = limit ? Math.round((spent / limit) * 100) : null;
    const barColor = pct == null ? 'var(--series-blue)' : pct >= 100 ? 'var(--critical)' : pct >= 70 ? 'var(--warning)' : 'var(--good)';
    const inputId = `budgetInput-${cat}`;

    area.appendChild(el('div', { style: 'padding:10px 0;border-bottom:1px solid var(--grid-line)' }, [
      el('div', { style: 'display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:6px' }, [
        el('div', { style: 'font-weight:600;font-size:13.5px' }, cat),
        el('div', { style: 'display:flex;gap:8px;align-items:center' }, [
          el('span', { style: 'font-size:12px;color:var(--text-muted)' }, limit != null ? `${fmtMoney(spent)} / ${fmtMoney(limit)}` : `已花 ${fmtMoney(spent)}`),
          el('input', { id: inputId, type: 'number', placeholder: '預算上限', value: limit != null ? limit : '', style: 'width:100px;padding:5px 8px;font-size:12px' }),
          el('button', { class: 'btn btn-ghost', style: 'padding:5px 10px;font-size:12px', onclick: () => saveBudget(cat, inputId) }, '儲存'),
        ]),
      ]),
      limit != null ? el('div', { style: 'height:6px;background:var(--gray-mid);border-radius:999px;overflow:hidden' }, [
        el('div', { style: `height:100%;width:${Math.min(100, pct)}%;background:${barColor}` }),
      ]) : null,
    ]));
  });
}

async function saveBudget(cat, inputId) {
  const val = Number($(`#${inputId}`).value);
  if (!val || val <= 0) { showToast('請輸入有效的預算金額'); return; }
  try {
    await api(`/finance/budgets/${encodeURIComponent(cat)}`, { method: 'PUT', body: { monthly_limit: val } });
    showToast('已儲存預算');
    loadBudgets();
  } catch (e) { showToast('儲存失敗: ' + e.message); }
}

// ===================== 行事曆 =====================
const CALENDAR_CATEGORIES = [
  { key: 'meal', label: '🍜 飲食', colorVar: '--series-orange' },
  { key: 'movie', label: '🎬 電影', colorVar: '--series-violet' },
  { key: 'sport', label: '🏃 運動', colorVar: '--series-aqua' },
  { key: 'work', label: '💼 工作', colorVar: '--series-blue' },
  { key: 'date', label: '💗 約會', colorVar: '--series-magenta' },
  { key: 'travel', label: '🚄 交通旅遊', colorVar: '--series-green' },
  { key: 'other', label: '📌 其他', colorVar: '--series-yellow' },
];
// 跨模組自動整合進來的唯讀項目 (帳單到期/待辦截止/人際關係重要日子)，不會出現在
// 「新增行程」的分類選單裡 (使用者不能手動選這幾個)，只用來查顏色/圖示標籤。
const AUTO_CATEGORIES = [
  { key: 'auto-bill', label: '🧾 帳單到期', colorVar: '--critical' },
  { key: 'auto-task', label: '✅ 待辦截止', colorVar: '--series-blue' },
  { key: 'auto-date', label: '🎉 重要日子', colorVar: '--series-magenta' },
];
function calCategoryInfo(key) {
  return CALENDAR_CATEGORIES.find((c) => c.key === key) || AUTO_CATEGORIES.find((c) => c.key === key) || CALENDAR_CATEGORIES[CALENDAR_CATEGORIES.length - 1];
}
const RECURRENCE_LABELS = { '': '不重複', daily: '每天', weekly: '每週', monthly: '每月', yearly: '每年 (適合生日/紀念日)' };

let calCursor = null;
let calEventsCache = [];
let calLunarCache = {}; // { 'YYYY-MM-DD': { label, solarTerm } }
let selectedCalDate = null;
let calEditingId = null; // 目前正在編輯哪一筆行程 (null = 新增模式)

function renderCalendar() {
  const c = $('#tab-calendar');
  c.innerHTML = '';
  const now = new Date();
  if (!calCursor) calCursor = { year: now.getFullYear(), month: now.getMonth() };
  if (!selectedCalDate) selectedCalDate = todayStr();

  // 月曆放左邊 (畫面主體)，新增行程表單 + 選定日期行程放右邊直向排一起，
  // 桌面/大螢幕上這樣一畫面就能看到全部功能，不用再往下滑。
  // 手機版則完全是另一套邏輯 (見 CSS `@media (max-width:760px)` 底下 `#tab-calendar` 那段)：
  // 右邊「新增行程」「選定日期行程」這兩張卡片直接隱藏不會疊到下面去，改成點日期時用
  // 底部彈出面板 (openCalDaySheet) 呈現同樣的功能，月曆本體固定鎖住可視高度，一整頁看到
  // 完整月份、不需要再往下滑——這是使用者實際傳了 iPhone 內建行事曆的畫面來要求比照的。
  c.appendChild(el('div', { class: 'grid-cal' }, [
    el('div', { class: 'card' }, [
      el('div', { id: 'calMonthNav' }),
      // 手機版專用的快速操作列：「今天」跳回本月並選到今天、「＋」直接開啟新增行程面板，
      // 對應使用者參考截圖右上角「今天／＋」那兩個常駐按鈕，不用像桌面版一樣得往下滑到
      // 側邊欄位置才能新增行程。
      el('div', { class: 'cal-mobile-actions' }, [
        el('button', { class: 'btn btn-ghost', onclick: calJumpToday }, '📍 今天'),
        el('button', { class: 'btn btn-primary', onclick: () => openCalDaySheet(selectedCalDate) }, '＋ 新增行程'),
      ]),
      el('div', { id: 'calMonthGrid' }),
      el('div', { class: 'legend', style: 'margin-top:12px' }, [...CALENDAR_CATEGORIES, ...AUTO_CATEGORIES].map((cat) => el('div', { class: 'legend-item' }, [
        el('span', { class: 'legend-dot', style: `background:${cssVar(cat.colorVar)}` }), cat.label,
      ]))),
      el('p', { class: 'hint', style: 'margin-top:6px' }, '🧾/✅/🎉 這幾類是自動整合帳單到期日、待辦截止日、人際關係重要日子，唯讀顯示，要改請到原本的分頁。'),
    ]),
    el('div', { class: 'cal-side' }, [
      el('div', { class: 'card' }, [
        el('h3', { id: 'calFormTitle' }, '新增行程'),
        el('div', { class: 'form-row' }, [
          el('input', { id: 'calDate', type: 'date', value: todayStr() }),
          el('input', { id: 'calTime', type: 'time' }),
        ]),
        el('input', { id: 'calTitle', placeholder: '要做什麼事？', style: 'width:100%;margin-top:8px' }),
        el('div', { class: 'form-row', style: 'margin-top:8px' }, [
          el('select', { id: 'calCategory' }, CALENDAR_CATEGORIES.map((cat) => el('option', { value: cat.key }, cat.label))),
          el('select', { id: 'calRecurrence' }, Object.entries(RECURRENCE_LABELS).map(([k, v]) => el('option', { value: k }, v))),
        ]),
        el('input', { id: 'calNote', placeholder: '備註 (選填)', style: 'width:100%;margin-top:8px' }),
        el('div', { style: 'display:flex;gap:8px;margin-top:10px' }, [
          el('button', { id: 'calSubmitBtn', class: 'btn btn-primary', style: 'flex:1', onclick: addCalendarEvent }, '新增'),
          el('button', { id: 'calCancelEditBtn', class: 'btn btn-ghost', style: 'display:none', onclick: () => cancelEditCalEvent('') }, '取消編輯'),
        ]),
      ]),
      el('div', { class: 'card' }, [el('h3', { id: 'calDayTitle' }, '選定日期的行程'), el('div', { id: 'calDayDetail' })]),
    ]),
  ]));

  loadCalendarMonth();
}

async function loadCalendarMonth() {
  const { year, month } = calCursor;
  const from = fmtYMD(new Date(year, month, 1));
  const to = fmtYMD(new Date(year, month + 1, 0));
  try {
    calEventsCache = await api(`/calendar?from=${from}&to=${to}`);
  } catch (e) { calEventsCache = []; }
  try {
    calLunarCache = await api(`/calendar/lunar-info?from=${from}&to=${to}`);
  } catch (e) { calLunarCache = {}; } // 農曆/節氣是點綴用途，拿不到不影響其他功能
  renderCalMonthNav();
  renderCalMonthGrid();
  renderCalDayDetail(selectedCalDate);
}

function renderCalMonthNav() {
  const nav = $('#calMonthNav');
  if (!nav) return;
  const { year, month } = calCursor;
  nav.innerHTML = '';
  nav.appendChild(el('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px' }, [
    el('button', { class: 'btn btn-ghost', onclick: () => shiftCalMonth(-1) }, '‹ 上個月'),
    el('div', { style: 'font-weight:800;font-size:16px' }, `${year} 年 ${month + 1} 月`),
    el('button', { class: 'btn btn-ghost', onclick: () => shiftCalMonth(1) }, '下個月 ›'),
  ]));
}
function shiftCalMonth(delta) {
  let { year, month } = calCursor;
  month += delta;
  if (month < 0) { month = 11; year -= 1; }
  if (month > 11) { month = 0; year += 1; }
  calCursor = { year, month };
  loadCalendarMonth();
}

function renderCalMonthGrid() {
  const grid = $('#calMonthGrid');
  if (!grid) return;
  grid.innerHTML = '';
  const { year, month } = calCursor;
  const cells = monthGridDates(year, month);
  const weekdayLabels = ['日', '一', '二', '三', '四', '五', '六'];
  const weekRows = cells.length / 7; // 4~6 週不等
  // 手機版鎖高度顯示整月不用滑動：週數不固定 (4~6 週)，用行內 style 動態指定
  // grid-template-rows (weekday 標題列固定高度、其餘週數平分剩餘空間)，這樣週數少的
  // 月份每格會自動長高一點，不會留一大塊空白；桌面版沒有鎖高度，這個 style 不影響版面。
  const wrap = el('div', { class: 'cal-grid', style: `grid-template-rows: auto repeat(${weekRows}, 1fr)` });
  weekdayLabels.forEach((w) => wrap.appendChild(el('div', { class: 'cal-weekday' }, w)));

  const byDate = {};
  calEventsCache.forEach((ev) => { (byDate[ev.event_date] = byDate[ev.event_date] || []).push(ev); });

  cells.forEach((d) => {
    if (!d) { wrap.appendChild(el('div', { class: 'cal-cell empty' })); return; }
    const dateStr = fmtYMD(d);
    const isToday = dateStr === todayStr();
    const isSelected = dateStr === selectedCalDate;
    const dayEvents = byDate[dateStr] || [];
    // 桌面版：完整文字小方塊，最多顯示 3 筆。
    const chips = dayEvents.slice(0, 3).map((ev) => {
      const info = calCategoryInfo(ev.category);
      return el('div', { class: 'cal-chip', style: `background:color-mix(in srgb, ${cssVar(info.colorVar)} 18%, transparent);color:${cssVar(info.colorVar)}` }, ev.title.slice(0, 8));
    });
    // 手機版：原本只顯示色點 (看得出「有幾件事」但看不出是什麼事)，改成比照使用者提供的
    // iPhone 內建行事曆截圖，直接顯示 1 筆事項的精簡文字色塊 (更全面，一眼看到內容)，
    // 超過 1 筆再疊一個「+N」小標籤，點進格子一樣能在底部彈出面板看到當天完整清單。
    const mobileChips = dayEvents.slice(0, 1).map((ev) => {
      const info = calCategoryInfo(ev.category);
      return el('div', { class: 'cal-chip-m', style: `background:color-mix(in srgb, ${cssVar(info.colorVar)} 22%, transparent);color:${cssVar(info.colorVar)}` }, ev.title.slice(0, 5));
    });
    const mobileMore = dayEvents.length > 1 ? el('div', { class: 'cal-more-m' }, `+${dayEvents.length - 1}`) : null;
    // 農曆日期／節氣，比照使用者提供的 iPhone 內建行事曆截圖：節氣是獨立的小標籤，
    // 農曆日期是數字旁邊的小字 (初一/十五/廿三這種)，農曆初一那天顯示月份名而不是「初一」，
    // 這樣掃過去比較容易看出「這個月什麼時候換了新的農曆月份」。
    const lunar = calLunarCache[dateStr];
    wrap.appendChild(el('div', {
      class: `cal-cell${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}`,
      onclick: () => selectCalDate(dateStr),
    }, [
      el('div', { class: 'cal-daynum-row' }, [
        el('div', { class: 'cal-daynum' }, String(d.getDate())),
        lunar && lunar.label ? el('div', { class: 'cal-lunar-label' }, lunar.label) : null,
      ]),
      lunar && lunar.solarTerm ? el('div', { class: 'cal-solarterm-tag' }, lunar.solarTerm) : null,
      el('div', { class: 'cal-chips-desktop' }, [
        ...chips,
        dayEvents.length > 3 ? el('div', { class: 'cal-more' }, `+${dayEvents.length - 3}`) : null,
      ]),
      (mobileChips.length || mobileMore) ? el('div', { class: 'cal-chips-mobile' }, [...mobileChips, mobileMore]) : null,
    ]));
  });
  grid.appendChild(wrap);
}

// 事件清單本體抽成共用函式，桌面版側邊卡片、手機版底部彈出面板都用這份，
// 避免同樣的清單畫法維護兩份、之後改版容易兩邊漏改不一致。
// onEdit 可省略 (例如唯讀情境完全不給編輯功能)。跨模組自動整合進來的項目 (r.readonly)
// 不能刪除/編輯 (資料本體在帳單/待辦/人際關係分頁，這裡只是顯示)，改成一顆「前往查看」
// 按鈕直接切過去那個分頁。
function buildCalDayEventsList(dateStr, onDelete, onEdit) {
  const wrap = el('div', {});
  const events = calEventsCache
    .filter((ev) => ev.event_date === dateStr)
    .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
  if (!events.length) {
    wrap.appendChild(el('div', { class: 'empty-state' }, '這天還沒有安排行程'));
    return wrap;
  }
  events.forEach((r) => {
    const info = calCategoryInfo(r.category);
    const actions = r.readonly
      ? [el('button', { class: 'btn btn-ghost', onclick: () => switchTab(r.sourceTab) }, '前往查看')]
      : [
          onEdit ? el('button', { class: 'btn btn-ghost', onclick: () => onEdit(r) }, '編輯') : null,
          el('button', { class: 'btn btn-ghost', onclick: () => onDelete(r.id) }, '刪除'),
        ];
    wrap.appendChild(el('div', { style: 'display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--grid-line)' }, [
      el('div', {}, [
        el('span', { class: 'badge', style: `background:color-mix(in srgb, ${cssVar(info.colorVar)} 16%, transparent);color:${cssVar(info.colorVar)};margin-right:8px` }, info.label),
        el('span', { style: 'color:var(--series-blue);font-weight:600;margin-right:8px' }, r.start_time || '全天'),
        el('span', {}, r.title),
        r.recurrence ? el('span', { style: 'font-size:11px;color:var(--text-muted);margin-left:6px' }, `🔁 ${RECURRENCE_LABELS[r.recurrence] || ''}`) : null,
        r.note ? el('div', { style: 'font-size:12px;color:var(--text-muted);margin-top:2px' }, r.note) : null,
      ]),
      el('div', { style: 'display:flex;gap:4px' }, actions),
    ]));
  });
  return wrap;
}

function renderCalDayDetail(dateStr) {
  const title = $('#calDayTitle');
  if (title) title.textContent = `${dateStr} 的行程`;
  const box = $('#calDayDetail');
  if (!box) return;
  box.innerHTML = '';
  box.appendChild(buildCalDayEventsList(dateStr, deleteCalendarEvent, (ev) => startEditCalEvent(ev, '')));
}

// 手機版：點格子或按「＋新增行程」時，用既有的底部彈出面板 (openSheet，跟「更多功能」
// 選單同一套) 呈現「當天清單 + 新增表單」，取代桌面版固定顯示在側邊的那兩張卡片——
// 這樣月曆本體才能鎖住高度、一整頁看完整個月，不用再往下滑。
function isMobileCalendarViewport() {
  return window.matchMedia('(max-width: 760px)').matches;
}

function selectCalDate(dateStr) {
  selectedCalDate = dateStr;
  renderCalMonthGrid();
  renderCalDayDetail(dateStr);
  if (isMobileCalendarViewport()) openCalDaySheet(dateStr);
}

function calJumpToday() {
  const now = new Date();
  calCursor = { year: now.getFullYear(), month: now.getMonth() };
  selectedCalDate = todayStr();
  loadCalendarMonth();
}

function openCalDaySheet(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const weekday = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  openSheet(`${d.getMonth() + 1}月${d.getDate()}日（${weekday}）`, () => buildCalDaySheetBody(dateStr));
}

function buildCalDaySheetBody(dateStr) {
  const wrap = el('div', {}, [
    buildCalDayEventsList(dateStr, (id) => deleteCalendarEventFromSheet(id, dateStr), (ev) => startEditCalEvent(ev, 'sheet', dateStr)),
    el('div', { style: 'margin-top:16px;padding-top:14px;border-top:1px solid var(--border)' }, [
      el('div', { id: 'sheetCalFormTitle', style: 'font-weight:700;margin-bottom:8px;font-size:13px' }, '➕ 新增行程'),
      el('div', { class: 'form-row' }, [
        el('input', { id: 'sheetCalDate', type: 'date', value: dateStr }),
        el('input', { id: 'sheetCalTime', type: 'time' }),
      ]),
      el('input', { id: 'sheetCalTitle', placeholder: '要做什麼事？', style: 'width:100%;margin-top:8px' }),
      el('div', { class: 'form-row', style: 'margin-top:8px' }, [
        el('select', { id: 'sheetCalCategory' }, CALENDAR_CATEGORIES.map((cat) => el('option', { value: cat.key }, cat.label))),
        el('select', { id: 'sheetCalRecurrence' }, Object.entries(RECURRENCE_LABELS).map(([k, v]) => el('option', { value: k }, v))),
      ]),
      el('input', { id: 'sheetCalNote', placeholder: '備註 (選填)', style: 'width:100%;margin-top:8px' }),
      el('div', { style: 'display:flex;gap:8px;margin-top:10px' }, [
        el('button', { id: 'sheetCalSubmitBtn', class: 'btn btn-primary', style: 'flex:1', onclick: () => addCalendarEventFromSheet(dateStr) }, '新增'),
        el('button', { id: 'sheetCalCancelEditBtn', class: 'btn btn-ghost', style: 'display:none', onclick: () => cancelEditCalEvent('sheet', dateStr) }, '取消編輯'),
      ]),
    ]),
  ]);
  return wrap;
}

// ---- 編輯行程：把既有行程的內容載入表單、切換成「更新」模式，兩邊 (桌面側欄／手機
// 底部面板) 共用同一套邏輯，用 idPrefix 區分要操作哪一組表單元素。 ----
function startEditCalEvent(ev, idPrefix) {
  calEditingId = ev.id;
  const pfx = idPrefix; // '' (桌面) 或 'sheet' (手機)
  const idOf = (base) => (pfx ? `${pfx}${base.charAt(0).toUpperCase()}${base.slice(1)}` : base);
  $(`#${idOf('calDate')}`).value = ev.event_date;
  $(`#${idOf('calTime')}`).value = ev.start_time || '';
  $(`#${idOf('calTitle')}`).value = ev.title;
  $(`#${idOf('calCategory')}`).value = ev.category;
  $(`#${idOf('calRecurrence')}`).value = ev.recurrence || '';
  $(`#${idOf('calNote')}`).value = ev.note || '';
  const submitBtn = $(`#${idOf('calSubmitBtn')}`);
  if (submitBtn) submitBtn.textContent = '更新行程';
  const cancelBtn = $(`#${idOf('calCancelEditBtn')}`);
  if (cancelBtn) cancelBtn.style.display = '';
  const formTitle = $(`#${idOf('calFormTitle')}`);
  if (formTitle) formTitle.textContent = '✏️ 編輯行程';
  if (pfx === 'sheet') showToast('已載入這筆行程，改好後按「更新行程」');
}

function cancelEditCalEvent(idPrefix) {
  calEditingId = null;
  const pfx = idPrefix;
  const idOf = (base) => (pfx ? `${pfx}${base.charAt(0).toUpperCase()}${base.slice(1)}` : base);
  const submitBtn = $(`#${idOf('calSubmitBtn')}`);
  if (submitBtn) submitBtn.textContent = '新增';
  const cancelBtn = $(`#${idOf('calCancelEditBtn')}`);
  if (cancelBtn) cancelBtn.style.display = 'none';
  const formTitle = $(`#${idOf('calFormTitle')}`);
  if (formTitle) formTitle.textContent = pfx === 'sheet' ? '➕ 新增行程' : '新增行程';
  [`${idOf('calTitle')}`, `${idOf('calNote')}`, `${idOf('calTime')}`].forEach((id) => { const elx = $(`#${id}`); if (elx) elx.value = ''; });
  const recEl = $(`#${idOf('calRecurrence')}`);
  if (recEl) recEl.value = '';
}

async function addCalendarEventFromSheet(dateStr) {
  const body = {
    event_date: $('#sheetCalDate').value,
    start_time: $('#sheetCalTime').value,
    title: $('#sheetCalTitle').value.trim(),
    note: $('#sheetCalNote').value.trim(),
    category: $('#sheetCalCategory').value,
    recurrence: $('#sheetCalRecurrence').value || undefined,
  };
  if (!body.event_date || !body.title) { showToast('請至少填日期與事項'); return; }
  try {
    if (calEditingId) {
      await api(`/calendar/${calEditingId}`, { method: 'PUT', body });
      showToast('已更新行程');
      calEditingId = null;
    } else {
      await api('/calendar', { method: 'POST', body });
      showToast('已新增行程');
    }
    if (body.event_date.slice(0, 7) === fmtYMD(new Date(calCursor.year, calCursor.month, 1)).slice(0, 7)) {
      selectedCalDate = body.event_date;
    }
    await loadCalendarMonth();
    openCalDaySheet(selectedCalDate); // 重新整理面板內容，順便切到剛新增/編輯那天
  } catch (e) { showToast((calEditingId ? '更新失敗: ' : '新增失敗: ') + e.message); }
}

async function deleteCalendarEventFromSheet(id, dateStr) {
  await api(`/calendar/${id}`, { method: 'DELETE' });
  await loadCalendarMonth();
  openCalDaySheet(dateStr);
}

async function addCalendarEvent() {
  const body = {
    event_date: $('#calDate').value,
    start_time: $('#calTime').value,
    title: $('#calTitle').value.trim(),
    note: $('#calNote').value.trim(),
    category: $('#calCategory').value,
    recurrence: $('#calRecurrence').value || undefined,
  };
  if (!body.event_date || !body.title) { showToast('請至少填日期與事項'); return; }
  try {
    if (calEditingId) {
      await api(`/calendar/${calEditingId}`, { method: 'PUT', body });
      showToast('已更新行程');
      cancelEditCalEvent('');
    } else {
      await api('/calendar', { method: 'POST', body });
      $('#calTitle').value = ''; $('#calNote').value = ''; $('#calTime').value = ''; $('#calRecurrence').value = '';
      showToast('已新增行程');
    }
    if (body.event_date.slice(0, 7) === fmtYMD(new Date(calCursor.year, calCursor.month, 1)).slice(0, 7)) {
      selectedCalDate = body.event_date;
    }
    loadCalendarMonth();
  } catch (e) { showToast((calEditingId ? '更新失敗: ' : '新增失敗: ') + e.message); }
}
async function deleteCalendarEvent(id) {
  if (calEditingId === id) cancelEditCalEvent('');
  await api(`/calendar/${id}`, { method: 'DELETE' });
  loadCalendarMonth();
}

// ---------- 行事曆訂閱 (.ics)：讓 Apple/Google 行事曆可以直接訂閱 ----------
function icsUrlFromToken(token) {
  return `${location.origin}/api/calendar/export.ics?token=${token}`;
}

async function loadIcsTokenStatus() {
  const box = $('#icsUrlBox');
  if (!box) return;
  try {
    const { token } = await api('/calendar/ics-token');
    renderIcsTokenUI(token);
  } catch (e) {
    box.textContent = '載入失敗：' + e.message;
  }
}

function renderIcsTokenUI(token) {
  const box = $('#icsUrlBox');
  const genBtn = $('#icsGenBtn');
  const copyBtn = $('#icsCopyBtn');
  const revokeBtn = $('#icsRevokeBtn');
  if (!box) return;
  if (token) {
    box.textContent = icsUrlFromToken(token);
    box.style.wordBreak = 'break-all';
    if (genBtn) genBtn.style.display = 'none';
    if (copyBtn) copyBtn.style.display = '';
    if (revokeBtn) revokeBtn.style.display = '';
  } else {
    box.textContent = '目前還沒有產生訂閱網址';
    if (genBtn) genBtn.style.display = '';
    if (copyBtn) copyBtn.style.display = 'none';
    if (revokeBtn) revokeBtn.style.display = 'none';
  }
}

async function generateIcsToken() {
  try {
    const { token } = await api('/calendar/ics-token', { method: 'POST' });
    renderIcsTokenUI(token);
    showToast('已產生訂閱網址，按下面「複製網址」貼到行事曆 App 裡');
  } catch (e) { showToast('產生失敗：' + e.message); }
}

async function copyIcsUrl() {
  const box = $('#icsUrlBox');
  if (!box) return;
  try {
    await navigator.clipboard.writeText(box.textContent);
    showToast('已複製到剪貼簿');
  } catch (e) { showToast('複製失敗，請手動選取文字複製'); }
}

async function revokeIcsToken() {
  try {
    await api('/calendar/ics-token/revoke', { method: 'POST' });
    renderIcsTokenUI(null);
    showToast('已停用這組訂閱網址');
  } catch (e) { showToast('停用失敗：' + e.message); }
}

// ===================== AI 助理 =====================
// 對話記錄改存資料庫 (見 /api/assistant/history)，重新整理頁面或換裝置登入都還在，
// 不再只是瀏覽器記憶體裡的暫時變數。
if (!state.assistantHistory) state.assistantHistory = [];
const ASSISTANT_SUGGESTIONS = ['幫我規劃這週的行程', '推薦一道今晚的晚餐食譜', '把這段文字翻譯成英文', '解釋一下這筆記帳該歸哪個分類'];
function renderAssistant() {
  const c = $('#tab-assistant');
  c.innerHTML = '';
  c.appendChild(el('div', { class: 'assistant-wrap' }, [
    el('div', { class: 'assistant-card' }, [
      el('div', { class: 'assistant-header' }, [
        el('div', { class: 'assistant-orb' }),
        el('div', {}, [
          el('h3', {}, 'AI 助理'),
          el('p', { class: 'hint' }, '生活規劃、旅遊行程、記帳建議、股票資訊解讀、翻譯、食譜、單位換算——什麼都可以問，對話記錄會保存在你的帳號裡，換裝置登入也看得到。'),
        ]),
        el('div', { class: 'assistant-header-right' }, [
          el('button', { class: 'btn btn-ghost', style: 'font-size:12px', onclick: clearAssistantHistory }, '🗑️ 清除對話'),
        ]),
      ]),
      el('div', { class: 'assistant-suggest-row' }, ASSISTANT_SUGGESTIONS.map((s) =>
        el('span', { class: 'assistant-suggest-chip', onclick: () => { $('#assistantInput').value = s; $('#assistantInput').focus(); } }, s)
      )),
      el('div', { id: 'assistantMessages', class: 'chat-box' }, el('div', { class: 'empty-state' }, '載入中...')),
      el('div', { class: 'form-row' }, [
        el('input', { id: 'assistantInput', placeholder: '輸入訊息，按 Enter 送出', onkeydown: (ev) => { if (ev.key === 'Enter') sendAssistantMessage(); } }),
        el('button', { class: 'btn btn-primary', onclick: sendAssistantMessage }, '送出'),
      ]),
    ]),
  ]));
  loadAssistantHistory();
}
async function loadAssistantHistory() {
  try {
    state.assistantHistory = await api('/assistant/history');
  } catch (e) {
    state.assistantHistory = [];
  }
  renderAssistantMessages();
}
async function clearAssistantHistory() {
  try {
    await api('/assistant/history', { method: 'DELETE' });
    state.assistantHistory = [];
    renderAssistantMessages();
    showToast('已清除對話記錄');
  } catch (e) { showToast('清除失敗: ' + e.message); }
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
    // AI 判斷使用者提到一件值得記錄的具體待辦事項時 (見 src/services/assistant.js 的
    // TASK_SUGGESTION 標記機制)，在這則訊息底下加一張確認卡片——一定要使用者自己按
    // 「加入待辦」才會真的呼叫建立任務的 API，AI 本身沒有能力直接幫忙新增任何東西。
    if (m.suggestedTask) {
      box.appendChild(renderTaskSuggestionCard(m));
    }
  });
  box.scrollTop = box.scrollHeight;
}

// 把「距離現在 X 秒」轉成人看得懂的敘述 (幾秒/幾分鐘/幾小時後)，給提醒確認卡片跟 toast 用。
function formatRelativeReminder(remindAtIso) {
  const diffMs = new Date(remindAtIso).getTime() - Date.now();
  const secs = Math.max(1, Math.round(diffMs / 1000));
  if (secs < 60) return `${secs} 秒後`;
  if (secs < 3600) return `${Math.round(secs / 60)} 分鐘後`;
  return `${Math.round(secs / 3600)} 小時後`;
}

function renderTaskSuggestionCard(m) {
  const t = m.suggestedTask;
  const parts = [`📌 要不要把這件事加入待辦事項：「${t.title}」`];
  if (t.remindAt) parts.push(`，並在 ${formatRelativeReminder(t.remindAt)}推播提醒你`);
  else if (t.dueDate) parts.push(`（${t.dueDate}）`);
  return el('div', { class: 'task-suggestion-card' }, [
    el('div', { class: 'task-suggestion-text' }, parts.join('')),
    t.remindAt ? el('div', { class: 'hint', style: 'margin-top:2px' }, '⏰ 如果還沒開啟背景推播通知，提醒可能不會準時跳出，可以去「個人化設定」開啟。') : null,
    el('div', { class: 'task-suggestion-actions' }, [
      el('button', { class: 'btn btn-primary', style: 'font-size:12px', onclick: () => confirmSuggestedTask(m) }, '✅ 加入待辦'),
      el('button', { class: 'btn btn-ghost', style: 'font-size:12px', onclick: () => dismissSuggestedTask(m) }, '不用了'),
    ]),
  ]);
}

async function confirmSuggestedTask(m) {
  try {
    await api('/tasks', { method: 'POST', body: { title: m.suggestedTask.title, dueDate: m.suggestedTask.dueDate || null, remindAt: m.suggestedTask.remindAt || null } });
    showToast(m.suggestedTask.remindAt ? `已加入待辦事項，${formatRelativeReminder(m.suggestedTask.remindAt)}會提醒你` : '已加入待辦事項');
  } catch (e) {
    showToast('加入失敗：' + e.message);
  }
  m.suggestedTask = null;
  renderAssistantMessages();
}

function dismissSuggestedTask(m) {
  m.suggestedTask = null;
  renderAssistantMessages();
}

async function sendAssistantMessage() {
  const input = $('#assistantInput');
  const text = input.value.trim();
  if (!text) return;
  state.assistantHistory.push({ role: 'user', content: text });
  input.value = '';
  renderAssistantMessages();
  try {
    const res = await api('/assistant/chat', { method: 'POST', body: { message: text } });
    state.assistantHistory.push({ role: 'assistant', content: res.reply, suggestedTask: res.suggestedTask || null });
    renderAssistantMessages();
  } catch (e) {
    state.assistantHistory.push({ role: 'assistant', content: '發生錯誤: ' + e.message });
    renderAssistantMessages();
  }
}

// ===================== 心情陪伴 =====================
const MOOD_TAGS = ['焦慮', '疲憊', '開心', '平靜', '煩躁', '難過', '有動力', '孤單'];
const moodState = { selectedScore: null, selectedTags: new Set(), chatHistory: null };
// 把「深度工具」區捲到看得到的地方並聚焦到指定欄位，取代舊版分頁籤切換。
function scrollMoodToolsIntoView(focusId) {
  const col = $('#moodDashRight');
  const target = focusId ? $('#' + focusId) : null;
  if (target && col) {
    col.scrollTo({ top: Math.max(0, target.offsetTop - 12), behavior: 'smooth' });
    target.focus();
  } else if (col) {
    col.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function renderMood() {
  const c = $('#tab-mood');
  c.innerHTML = '';
  moodState.selectedScore = null;
  moodState.selectedTags = new Set();

  const checkinCard = el('div', { class: 'card' }, [
    el('h3', {}, [el('div', { class: 'hex-badge' }, '💗'), '今天的你感覺怎麼樣？']),
    el('p', { class: 'hint' }, '點一個最貼近現在的分數，標籤跟備註都是選填。'),
    el('div', { class: 'mood-score-row', id: 'moodScoreRow' }),
    el('div', { class: 'mood-tag-row', id: 'moodTagRow' }),
    el('input', { id: 'moodNote', placeholder: '想多寫一點也可以，這裡沒有人會評論你 (選填)' }),
    el('div', { style: 'margin-top:12px;display:flex;gap:8px;flex-wrap:wrap' }, [
      el('button', { class: 'btn btn-primary', onclick: saveMoodEntry }, '儲存今天的紀錄'),
      el('button', { class: 'btn btn-ghost', onclick: suggestMoodTechnique }, '給我一個因應技巧'),
    ]),
    el('div', { id: 'moodTechniqueBody' }),
  ]);

  const cycleCard = el('div', { class: 'card', style: 'margin-bottom:0' }, [
    el('h3', {}, '🌙 生理週期（選填）'),
    el('p', { class: 'hint' }, '記錄經期開始日，讓關心訊息跟模式分析也能考慮經前階段（選填）。'),
    el('div', { id: 'cycleStatusBody' }, el('div', { class: 'empty-state' }, '載入中...')),
    el('div', { class: 'form-row', style: 'margin-top:10px' }, [
      el('input', { id: 'cycleStartDate', type: 'date', value: todayStr() }),
      el('select', { id: 'cycleTrackingFor' }, [
        el('option', { value: 'self' }, '記錄自己的'),
        el('option', { value: 'partner' }, '幫另一半記錄'),
      ]),
    ]),
    el('input', { id: 'cycleNote', placeholder: '想順便記點什麼嗎？(選填，例如：這次經痛比較明顯)', style: 'width:100%;margin-top:8px' }),
    el('button', { class: 'btn btn-ghost', style: 'margin-top:8px', onclick: saveCycleEntry }, '記錄這次月經開始'),
    el('p', { class: 'hint', style: 'margin-top:6px' }, '選「幫另一半記錄」的話，這筆資料只會用來提醒/整理，不會被拿去分析你自己的心情關聯，會顯示在「陪伴另一半」分頁。'),
    el('button', { class: 'btn btn-ghost', style: 'font-size:12px;margin-top:8px', onclick: toggleCycleHistory }, '查看/管理紀錄'),
    el('div', { id: 'cycleHistoryList', style: 'display:none;margin-top:8px' }),
  ]);

  const patternsCard = el('div', { class: 'card mood-insight-card', style: 'margin-bottom:0' }, [
    el('h3', {}, '🧩 跨模塊深層模式'),
    el('p', { class: 'hint' }, '把心情、行程、記帳、日記的資料放在一起，長期累積後幫你找出屬於你自己的規律。'),
    el('button', { class: 'btn btn-ghost', onclick: refreshMoodPatterns }, '重新分析'),
    el('div', { id: 'moodPatternsBody', style: 'margin-top:10px' }, el('div', { class: 'empty-state' }, '載入中...')),
  ]);

  const monthlyReviewCard = el('div', { class: 'card', style: 'margin-bottom:0' }, [
    el('h3', {}, '📅 這個月的 AI 回顧'),
    el('p', { class: 'hint' }, '把這個月的心情紀錄交給 AI，寫一段完整一點的月度回顧。'),
    el('button', { class: 'btn btn-ghost', onclick: generateMoodMonthlyReview }, '產生本月回顧'),
    el('div', { id: 'moodMonthlyReviewBody' }),
  ]);

  const thoughtRecordCard = el('div', { class: 'card thought-record-card', style: 'margin-bottom:0' }, [
    el('h3', {}, '🧠 卡住的時候：想法重塑練習'),
    el('p', { class: 'hint' }, '寫下念頭，AI 可幫你想一個更平衡的角度（自助練習，非心理治療）。'),
    el('div', { class: 'thought-record-form' }, [
      el('div', { class: 'thought-record-row2' }, [
        el('input', { id: 'trSituation', list: 'trSituationList', placeholder: '情境 (選填)' }),
        el('input', { id: 'trEmotion', list: 'trEmotionList', placeholder: '情緒 (選填，例如：焦慮)' }),
      ]),
      el('datalist', { id: 'trSituationList' }),
      el('datalist', { id: 'trEmotionList' }),
      el('textarea', { id: 'trThought', rows: 1, placeholder: '腦中出現的念頭是什麼？(例如：他一定討厭我了)' }),
      el('div', { class: 'thought-record-row2' }, [
        el('textarea', { id: 'trEvidenceFor', rows: 1, placeholder: '支持這個念頭的證據 (選填)' }),
        el('textarea', { id: 'trEvidenceAgainst', rows: 1, placeholder: '不支持的證據 (選填)' }),
      ]),
      el('div', { class: 'thought-record-row2' }, [
        el('textarea', { id: 'trReframe', rows: 1, placeholder: '可能更平衡的想法 (可自己寫或請 AI 幫忙)' }),
        el('div', { class: 'thought-record-intensity-row' }, [
          el('span', { class: 'hint', style: 'margin:0' }, '強度：'),
          el('input', { id: 'trIntensity', type: 'number', min: '1', max: '10', placeholder: '1-10', style: 'width:66px;padding:6px 4px;text-align:center' }),
        ]),
      ]),
      el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;margin-top:2px' }, [
        el('button', { class: 'btn btn-ghost', onclick: suggestThoughtReframe }, '請 AI 幫我想一句'),
        el('button', { class: 'btn btn-primary', onclick: saveThoughtRecord }, '儲存這筆記錄'),
      ]),
    ]),
    el('div', { id: 'thoughtRecordList', class: 'coping-note-list', style: 'margin-top:12px' }, el('div', { class: 'empty-state' }, '載入中...')),
  ]);

  const trendCard = el('div', { class: 'card', style: 'margin-bottom:0' }, [
    el('h3', {}, '📈 心情趨勢 (近 30 天)'),
    el('div', { id: 'moodTrendChart' }, el('div', { class: 'empty-state' }, '載入中...')),
  ]);

  const insightsCard = el('div', { class: 'card mood-insight-card', style: 'margin-bottom:0' }, [
    el('h3', {}, '🔎 心情 × 行程 洞察'),
    el('div', { id: 'moodInsightBody' }, el('div', { class: 'empty-state' }, '載入中...')),
  ]);

  const weeklyReviewCard = el('div', { class: 'card', style: 'margin-bottom:0' }, [
    el('h3', {}, '🗓️ 這週的 AI 回顧'),
    el('p', { class: 'hint' }, '把這週的心情紀錄交給 AI，寫一段像朋友一樣的小卡片給你。'),
    el('button', { class: 'btn btn-ghost', onclick: generateMoodWeeklyReview }, '產生本週回顧'),
    el('div', { id: 'moodWeeklyReviewBody' }),
  ]);

  const toolboxCard = el('div', { class: 'card', style: 'margin-bottom:0' }, [
    el('h3', {}, '🧰 我的因應工具箱'),
    el('p', { class: 'hint' }, '根據你給過的回饋，整理出對你最有效的技巧。'),
    el('div', { id: 'moodToolboxBody' }, el('div', { class: 'empty-state' }, '載入中...')),
  ]);

  const copingNotesCard = el('div', { class: 'card', style: 'margin-bottom:0' }, [
    el('h3', {}, '🍃 安心小卡'),
    el('p', { class: 'hint' }, '收藏對自己有用的一句話，心情不好的時候可以回來看看。'),
    el('div', { class: 'coping-note-add-row' }, [
      el('input', { id: 'copingNoteInput', placeholder: '寫一句想留給自己的話...', onkeydown: (ev) => { if (ev.key === 'Enter') addCopingNote(); } }),
      el('button', { class: 'btn btn-primary', onclick: addCopingNote }, '新增'),
    ]),
    el('div', { id: 'copingNoteList', class: 'coping-note-list' }, el('div', { class: 'empty-state' }, '載入中...')),
  ]);

  const chatCard = el('div', { class: 'card mood-chat-card mood-chat-companion' }, [
    el('div', { class: 'mood-chat-avatar' }, '🌱'),
    el('div', { style: 'text-align:center;margin-bottom:4px' }, [
      el('h3', { style: 'justify-content:center;margin-bottom:2px' }, 'AI 心靈對話室'),
      el('p', { class: 'hint', style: 'margin-bottom:0' }, '隨時可以聊聊，這裡是陪伴傾聽，不是正式的心理治療'),
    ]),
    el('div', { id: 'moodChatMessages', class: 'chat-box', style: 'margin-top:10px' }, el('div', { class: 'empty-state' }, '載入中...')),
    el('div', { class: 'form-row' }, [
      el('input', { id: 'moodChatInput', placeholder: '想說什麼都可以，按 Enter 送出', onkeydown: (ev) => { if (ev.key === 'Enter') sendMoodChatMessage(); } }),
      el('button', { class: 'btn btn-primary', onclick: sendMoodChatMessage }, '送出'),
    ]),
    el('div', { style: 'text-align:center;margin-top:8px' }, [
      el('button', { class: 'btn btn-ghost', style: 'font-size:12px', onclick: clearMoodChatHistory }, '🗑️ 清除對話'),
    ]),
  ]);

  const statsCard = el('div', { class: 'card', style: 'margin-bottom:0' }, [
    el('h3', {}, '📊 情緒健康報告'),
    el('div', { id: 'moodStatsGrid', class: 'mood-stat-grid', style: 'max-height:320px;overflow-y:auto' }, el('div', { class: 'empty-state' }, '載入中...')),
  ]);
  const diaryCard = el('div', { class: 'card', style: 'margin-bottom:0' }, [
    el('h3', {}, '📔 今天的日記'),
    el('div', { id: 'moodDiaryLink' }, el('div', { class: 'empty-state' }, '載入中...')),
  ]);

  // 一畫面儀表板：整個心情頁鎖在螢幕高度內、不需要滑整頁。
  // 左欄：今天的打卡 + 安心小卡 + 生理週期 (輕量、常用的東西)。
  // 中欄：AI 陪伴對話室 (這個模塊的主軸，維持最大最顯眼)。
  // 右欄：比較「深」的工具跟資料 (想法重塑、趨勢、報告、洞察、回顧…)，這欄位內部自己捲動，
  //       其他兩欄跟整體畫面都不會被它撐高——這樣「巨型表單」跟「所有資料」才能真的並存在同一面。
  // 求助專線移進最上面的窄狀態列，永遠看得到，不需要額外捲動或切換。
  c.appendChild(el('div', { class: 'mood-dash-topline' }, [
    el('div', { class: 'mood-dash-topline-title' }, [
      el('span', { class: 'mood-dash-sky-badge' }, '🌤️ 晴空手札 · 今天也要給自己一個微笑'),
      el('div', { id: 'moodCareBanner', class: 'mood-dash-care' }),
    ]),
    el('div', { class: 'mood-dash-topline-right' }, [
      el('button', { class: 'btn btn-ghost', style: 'font-size:11.5px', onclick: enableMoodBrowserNotification }, '🔔 開啟瀏覽器提醒'),
      el('div', { class: 'mood-dash-crisis-badge', title: '安心專線 1925（24小時）／生命線 1995（24小時）／張老師專線 1980（日間）' }, [
        el('span', {}, '🚨 需要協助？'),
        el('span', { class: 'mood-dash-crisis-num' }, '安心專線 1925'),
      ]),
    ]),
  ]));

  c.appendChild(el('div', { class: 'mood-dash-grid', id: 'moodDashGrid' }, [
    el('section', { class: 'mood-dash-col mood-dash-col-left' }, [checkinCard, copingNotesCard, cycleCard]),
    el('section', { class: 'mood-dash-col mood-dash-col-mid' }, [chatCard]),
    el('section', { class: 'mood-dash-col mood-dash-col-right', id: 'moodDashRight' }, [
      thoughtRecordCard, trendCard, statsCard, insightsCard, patternsCard, toolboxCard, diaryCard, weeklyReviewCard, monthlyReviewCard,
    ]),
  ]));

  const scoreRow = $('#moodScoreRow');
  for (let i = 1; i <= 10; i++) {
    scoreRow.appendChild(el('button', { class: 'mood-score-btn', 'data-score': i, onclick: () => selectMoodScore(i) }, String(i)));
  }
  const tagRow = $('#moodTagRow');
  MOOD_TAGS.forEach((tag) => {
    tagRow.appendChild(el('button', { class: 'mood-tag-chip', 'data-tag': tag, onclick: () => toggleMoodTag(tag) }, tag));
  });

  loadMoodToday();
  loadMoodTrend();
  loadMoodDiaryLink();
  loadMoodChatHistory();
  loadMoodInsights();
  loadCopingNotes();
  loadMoodPatterns();
  loadThoughtRecords();
  loadMoodToolbox();
  loadCycleStatus();
}

// ---------- 生理週期 (選填) ----------
const CYCLE_PHASE_LABEL = { menstrual: '月經期', follicular: '濾泡期', ovulation: '排卵期', luteal: '黃體期' };
async function loadCycleStatus() {
  const area = $('#cycleStatusBody');
  if (!area) return;
  try {
    const status = await api('/mood/cycle/status');
    area.innerHTML = '';
    if (!status.hasData) {
      area.appendChild(el('div', { class: 'empty-state' }, '還沒有紀錄，記一次經期開始日就能開始估算'));
      return;
    }
    const phaseLabel = CYCLE_PHASE_LABEL[status.phase] || status.phase;
    const pmsNote = status.isPmsWindow ? '（經前觀察窗）' : '';
    area.appendChild(el('p', {}, `目前估計在「${phaseLabel}」${pmsNote} · 距離下次月經約 ${status.daysUntilNextPeriod} 天`));
    if (!status.hasEnoughDataForAvg) {
      area.appendChild(el('p', { class: 'hint', style: 'margin-top:4px' }, '目前用預設 28 天週期估算，多記錄幾次會愈來愈準。'));
    }
  } catch (e) {
    area.innerHTML = '';
    area.appendChild(el('div', { class: 'empty-state' }, '週期資料暫時無法取得'));
  }
}
async function saveCycleEntry() {
  const date = $('#cycleStartDate').value;
  if (!date) { showToast('請選擇日期'); return; }
  const trackingFor = $('#cycleTrackingFor') ? $('#cycleTrackingFor').value : 'self';
  const note = $('#cycleNote') ? $('#cycleNote').value.trim() : '';
  try {
    await api('/mood/cycle', { method: 'POST', body: { periodStartDate: date, trackingFor, symptoms: note || null } });
    $('#cycleNote').value = '';
    showToast('已記錄');
    loadCycleStatus();
    if ($('#cycleHistoryList').style.display !== 'none') loadCycleHistory();
  } catch (e) { showToast('儲存失敗：' + e.message); }
}
function toggleCycleHistory() {
  const box = $('#cycleHistoryList');
  const show = box.style.display === 'none';
  box.style.display = show ? 'block' : 'none';
  if (show) loadCycleHistory();
}
async function loadCycleHistory() {
  const box = $('#cycleHistoryList');
  box.innerHTML = '';
  try {
    const rows = await api('/mood/cycle');
    if (!rows.length) {
      box.appendChild(el('div', { class: 'empty-state' }, '還沒有紀錄'));
      return;
    }
    rows.forEach((r) => {
      box.appendChild(el('div', { class: 'coping-note-item' }, [
        el('div', { class: 'content' }, [
          el('div', {}, `${r.period_start_date}${r.tracking_for === 'partner' ? '（幫另一半記錄）' : ''}`),
          r.symptoms ? el('div', { class: 'hint', style: 'margin:2px 0 0' }, r.symptoms) : null,
        ]),
        el('button', { class: 'del-btn', onclick: () => deleteCycleEntry(r.id) }, '✕'),
      ]));
    });
  } catch (e) {
    box.appendChild(el('div', { class: 'empty-state' }, '紀錄暫時無法取得'));
  }
}
async function deleteCycleEntry(id) {
  try {
    await api(`/mood/cycle/${id}`, { method: 'DELETE' });
    loadCycleHistory();
    loadCycleStatus();
  } catch (e) { showToast('刪除失敗：' + e.message); }
}

async function loadMoodToolbox() {
  const area = $('#moodToolboxBody');
  if (!area) return;
  try {
    const rows = await api('/mood/techniques/stats');
    area.innerHTML = '';
    if (!rows.length) {
      area.appendChild(el('div', { class: 'empty-state' }, '還沒有累積技巧回饋，選標籤後點「給我一個因應技巧」，用完給個回饋，這裡就會開始累積屬於你的工具箱。'));
      return;
    }
    rows.forEach((r) => {
      area.appendChild(el('div', { class: 'mood-signal-item' }, `${r.tag}：${r.best.title}（${r.best.helped}/${r.best.total} 次覺得有幫助）`));
    });
  } catch (e) {
    area.innerHTML = '';
    area.appendChild(el('div', { class: 'empty-state' }, '工具箱資料暫時無法取得'));
  }
}

function selectMoodScore(score) {
  moodState.selectedScore = score;
  document.querySelectorAll('.mood-score-btn').forEach((b) => b.classList.toggle('selected', Number(b.dataset.score) === score));
}
function toggleMoodTag(tag) {
  if (moodState.selectedTags.has(tag)) moodState.selectedTags.delete(tag);
  else moodState.selectedTags.add(tag);
  document.querySelectorAll('.mood-tag-chip').forEach((b) => b.classList.toggle('selected', moodState.selectedTags.has(b.dataset.tag)));
}

async function loadMoodToday() {
  try {
    const today = todayStr();
    const rows = await api(`/mood/entries?from=${today}&to=${today}`);
    if (rows.length) {
      const entry = rows[0];
      selectMoodScore(entry.score);
      (entry.tags || '').split(',').filter(Boolean).forEach((t) => { moodState.selectedTags.add(t); });
      document.querySelectorAll('.mood-tag-chip').forEach((b) => b.classList.toggle('selected', moodState.selectedTags.has(b.dataset.tag)));
      if (entry.note) $('#moodNote').value = entry.note;
    }
  } catch (e) { /* 忽略，當作今天還沒記錄 */ }
}

async function saveMoodEntry() {
  if (!moodState.selectedScore) { showToast('先選一個 1-10 的分數'); return; }
  try {
    await api(`/mood/entries/${todayStr()}`, {
      method: 'PUT',
      body: { score: moodState.selectedScore, tags: [...moodState.selectedTags], note: $('#moodNote').value.trim() },
    });
    showToast('已記錄今天的心情 💗');
    loadMoodTrend();
    // 分數偏低又有選標籤時，直接主動問要不要看技巧建議或寫想法記錄，
    // 不用讓使用者自己想到要去別的卡片找，把整個流程串起來。
    if (moodState.selectedScore <= 4 && moodState.selectedTags.size) {
      showCheckinFollowupPrompt();
    } else {
      const followup = $('#moodCheckinFollowup');
      if (followup) followup.innerHTML = '';
    }
  } catch (e) { showToast('儲存失敗：' + e.message); }
}

function showCheckinFollowupPrompt() {
  let followup = $('#moodCheckinFollowup');
  if (!followup) {
    followup = el('div', { id: 'moodCheckinFollowup', style: 'margin-top:10px' });
    $('#moodTechniqueBody').after(followup);
  }
  followup.innerHTML = '';
  followup.appendChild(el('div', { class: 'mood-technique-box' }, [
    el('div', {}, '這幾天感覺不太容易，要不要看一個可能有幫助的技巧，或寫一筆想法記錄整理一下？'),
    el('div', { style: 'display:flex;gap:8px;margin-top:8px;flex-wrap:wrap' }, [
      el('button', { class: 'btn btn-ghost', style: 'font-size:12px', onclick: () => { suggestMoodTechnique(); followup.innerHTML = ''; } }, '看技巧建議'),
      el('button', { class: 'btn btn-ghost', style: 'font-size:12px', onclick: () => { scrollMoodToolsIntoView('trThought'); followup.innerHTML = ''; } }, '寫想法記錄'),
      el('button', { class: 'btn btn-ghost', style: 'font-size:12px', onclick: () => { followup.innerHTML = ''; } }, '先不用了'),
    ]),
  ]));
}

async function loadMoodTrend() {
  const chartArea = $('#moodTrendChart');
  const statsGrid = $('#moodStatsGrid');
  if (!chartArea) return;
  try {
    const summary = await api('/mood/summary?days=30');
    if (!summary.series.length) {
      chartArea.innerHTML = '';
      chartArea.appendChild(el('div', { class: 'empty-state' }, '還沒有心情紀錄，記錄第一筆之後這裡就會出現趨勢圖'));
    } else {
      renderMoodChart(chartArea, summary.series);
    }
    if (statsGrid) renderMoodStats(statsGrid, summary);
    const banner = $('#moodCareBanner');
    if (banner) {
      banner.innerHTML = '';
      if (summary.careMessage) {
        banner.appendChild(el('div', { class: 'mood-care-banner' }, `💌 ${summary.careMessage}`));
      }
    }
  } catch (e) {
    chartArea.innerHTML = '';
    chartArea.appendChild(el('div', { class: 'empty-state' }, '心情資料暫時無法取得'));
    if (statsGrid) { statsGrid.innerHTML = ''; statsGrid.appendChild(el('div', { class: 'empty-state' }, '心情資料暫時無法取得')); }
  }
}

async function loadMoodInsights() {
  const area = $('#moodInsightBody');
  if (!area) return;
  try {
    const insight = await api('/mood/insights');
    area.innerHTML = '';
    if (!insight.available) {
      area.appendChild(el('div', { class: 'empty-state' }, insight.message));
    } else {
      area.appendChild(el('p', {}, insight.message));
    }
  } catch (e) {
    area.innerHTML = '';
    area.appendChild(el('div', { class: 'empty-state' }, '洞察資料暫時無法取得'));
  }
}

async function generateMoodWeeklyReview() {
  const area = $('#moodWeeklyReviewBody');
  if (!area) return;
  area.innerHTML = '';
  area.appendChild(el('div', { class: 'empty-state' }, '正在為你寫這週的回顧...'));
  try {
    const result = await api('/mood/weekly-review', { method: 'POST' });
    area.innerHTML = '';
    area.appendChild(el('div', { class: 'mood-weekly-review-box' }, result.reply));
  } catch (e) {
    area.innerHTML = '';
    area.appendChild(el('div', { class: 'empty-state' }, '這週回顧暫時無法產生：' + e.message));
  }
}

async function loadCopingNotes() {
  const list = $('#copingNoteList');
  if (!list) return;
  try {
    const notes = await api('/mood/coping-notes');
    list.innerHTML = '';
    if (!notes.length) {
      list.appendChild(el('div', { class: 'empty-state' }, '還沒有安心小卡，寫一句想留給自己的話吧'));
      return;
    }
    notes.forEach((n) => {
      list.appendChild(el('div', { class: 'coping-note-item' }, [
        el('div', { class: 'content' }, n.content),
        el('button', { class: 'del-btn', onclick: () => deleteCopingNote(n.id) }, '✕'),
      ]));
    });
  } catch (e) {
    list.innerHTML = '';
    list.appendChild(el('div', { class: 'empty-state' }, '小卡資料暫時無法取得'));
  }
}

async function addCopingNote() {
  const input = $('#copingNoteInput');
  const text = input.value.trim();
  if (!text) return;
  try {
    await api('/mood/coping-notes', { method: 'POST', body: { content: text } });
    input.value = '';
    loadCopingNotes();
  } catch (e) { showToast('新增失敗：' + e.message); }
}

async function deleteCopingNote(id) {
  try {
    await api(`/mood/coping-notes/${id}`, { method: 'DELETE' });
    loadCopingNotes();
  } catch (e) { showToast('刪除失敗：' + e.message); }
}

// ---------- 這個月 AI 回顧 ----------
async function generateMoodMonthlyReview() {
  const area = $('#moodMonthlyReviewBody');
  if (!area) return;
  area.innerHTML = '';
  area.appendChild(el('div', { class: 'empty-state' }, '正在為你寫這個月的回顧...'));
  try {
    const month = todayStr().slice(0, 7);
    const result = await api('/mood/monthly-review', { method: 'POST', body: { month } });
    area.innerHTML = '';
    area.appendChild(el('div', { class: 'mood-weekly-review-box' }, result.reply));
  } catch (e) {
    area.innerHTML = '';
    area.appendChild(el('div', { class: 'empty-state' }, '這個月的回顧暫時無法產生：' + e.message));
  }
}

// ---------- 會學習的因應技巧庫 ----------
async function suggestMoodTechnique() {
  const area = $('#moodTechniqueBody');
  if (!area) return;
  const tag = [...moodState.selectedTags][0];
  if (!tag) {
    showToast('先選一個標籤，AI 才知道要給哪種技巧');
    return;
  }
  area.innerHTML = '';
  area.appendChild(el('div', { class: 'empty-state' }, '載入中...'));
  try {
    const res = await api(`/mood/techniques/suggest?tag=${encodeURIComponent(tag)}`);
    const t = res.technique;
    area.innerHTML = '';
    area.appendChild(el('div', { class: 'mood-technique-box' }, [
      el('div', { class: 'mood-technique-title' }, `💡 ${t.title}`),
      el('p', { style: 'margin:6px 0 10px' }, t.text),
      el('div', { style: 'display:flex;gap:8px;align-items:center' }, [
        el('span', { class: 'hint', style: 'margin:0' }, '這個方法有幫助嗎？'),
        el('button', { class: 'btn btn-ghost', style: 'font-size:12px;padding:4px 10px', onclick: () => giveTechniqueFeedback(tag, t.key, true) }, '👍 有幫助'),
        el('button', { class: 'btn btn-ghost', style: 'font-size:12px;padding:4px 10px', onclick: () => giveTechniqueFeedback(tag, t.key, false) }, '👎 沒有幫助'),
      ]),
    ]));
  } catch (e) {
    area.innerHTML = '';
    area.appendChild(el('div', { class: 'empty-state' }, '技巧建議暫時無法取得'));
  }
}
async function giveTechniqueFeedback(tag, techniqueKey, helped) {
  try {
    await api('/mood/techniques/feedback', { method: 'POST', body: { tag, techniqueKey, helped } });
    showToast('謝謝你的回饋，下次會愈推薦愈準');
    loadMoodToolbox();
  } catch (e) { showToast('回饋送出失敗：' + e.message); }
}

// ---------- 跨模塊深層模式識別 ----------
async function loadMoodPatterns() {
  const area = $('#moodPatternsBody');
  if (!area) return;
  try {
    const res = await api('/mood/patterns');
    renderMoodPatterns(area, res);
  } catch (e) {
    area.innerHTML = '';
    area.appendChild(el('div', { class: 'empty-state' }, '模式分析資料暫時無法取得'));
  }
}
async function refreshMoodPatterns() {
  const area = $('#moodPatternsBody');
  if (!area) return;
  area.innerHTML = '';
  area.appendChild(el('div', { class: 'empty-state' }, '正在分析中，資料量比較大的話可能要幾秒鐘...'));
  try {
    const res = await api('/mood/patterns/refresh', { method: 'POST' });
    renderMoodPatterns(area, res);
  } catch (e) {
    area.innerHTML = '';
    area.appendChild(el('div', { class: 'empty-state' }, '分析暫時無法完成：' + e.message));
  }
}
function renderMoodPatterns(area, res) {
  area.innerHTML = '';
  if (!res.available) {
    area.appendChild(el('div', { class: 'empty-state' }, res.message));
    return;
  }
  area.appendChild(el('p', {}, res.insights));
  if (res.signals && res.signals.length) {
    const list = el('div', { class: 'mood-signal-list' });
    res.signals.forEach((s) => {
      list.appendChild(el('div', { class: 'mood-signal-item' }, `${s.label}：${s.groupAName} ${s.avgA} 分 vs ${s.groupBName} ${s.avgB} 分`));
    });
    area.appendChild(list);
  }
  if (res.generatedAt) {
    area.appendChild(el('p', { class: 'hint', style: 'margin-top:8px' }, `上次分析時間：${new Date(res.generatedAt).toLocaleString('zh-TW')}`));
  }
}

// ---------- CBT 式思考記錄 ----------
async function suggestThoughtReframe() {
  const thought = $('#trThought').value.trim();
  if (!thought) { showToast('先寫下腦中出現的念頭'); return; }
  try {
    const result = await api('/mood/thought-records/reframe-suggest', {
      method: 'POST',
      body: {
        situation: $('#trSituation').value.trim(),
        thought,
        evidenceFor: $('#trEvidenceFor').value.trim(),
        evidenceAgainst: $('#trEvidenceAgainst').value.trim(),
      },
    });
    $('#trReframe').value = result.reply;
  } catch (e) { showToast('建議暫時無法產生：' + e.message); }
}
async function saveThoughtRecord() {
  const thought = $('#trThought').value.trim();
  if (!thought) { showToast('先寫下腦中出現的念頭'); return; }
  try {
    await api('/mood/thought-records', {
      method: 'POST',
      body: {
        situation: $('#trSituation').value.trim(),
        thought,
        emotion: $('#trEmotion').value.trim(),
        intensity: $('#trIntensity').value ? Number($('#trIntensity').value) : null,
        evidenceFor: $('#trEvidenceFor').value.trim(),
        evidenceAgainst: $('#trEvidenceAgainst').value.trim(),
        reframe: $('#trReframe').value.trim(),
      },
    });
    ['trSituation', 'trThought', 'trEmotion', 'trIntensity', 'trEvidenceFor', 'trEvidenceAgainst', 'trReframe'].forEach((id) => { $('#' + id).value = ''; });
    showToast('已儲存這筆思考記錄');
    loadThoughtRecords();
  } catch (e) { showToast('儲存失敗：' + e.message); }
}
async function loadThoughtRecords() {
  const list = $('#thoughtRecordList');
  if (!list) return;
  try {
    const rows = await api('/mood/thought-records');
    populateThoughtRecordDatalists(rows);
    list.innerHTML = '';
    if (!rows.length) {
      list.appendChild(el('div', { class: 'empty-state' }, '還沒有紀錄，卡住的時候可以試著寫一筆'));
      return;
    }
    rows.forEach((r) => {
      const parts = [];
      if (r.situation) parts.push(el('div', { class: 'hint', style: 'margin:0' }, `情境：${r.situation}`));
      parts.push(el('div', { style: 'font-weight:600' }, `念頭：${r.thought}`));
      if (r.emotion || r.intensity) parts.push(el('div', { class: 'hint', style: 'margin:0' }, `情緒：${r.emotion || ''}${r.intensity ? ` (強度 ${r.intensity}/10)` : ''}`));
      if (r.reframe) parts.push(el('div', { style: 'margin-top:4px;color:var(--series-aqua)' }, `→ ${r.reframe}`));
      list.appendChild(el('div', { class: 'coping-note-item' }, [
        el('div', { class: 'content' }, parts),
        el('button', { class: 'del-btn', onclick: () => deleteThoughtRecord(r.id) }, '✕'),
      ]));
    });
  } catch (e) {
    list.innerHTML = '';
    list.appendChild(el('div', { class: 'empty-state' }, '思考記錄暫時無法取得'));
  }
}
// 表單自動記憶：情境/情緒欄位常常是重複的字眼，記住之前打過的就好，之後用選的比較快，也可以繼續自己打字
function populateThoughtRecordDatalists(rows) {
  const situationList = $('#trSituationList');
  const emotionList = $('#trEmotionList');
  if (situationList) {
    situationList.innerHTML = '';
    [...new Set(rows.map((r) => (r.situation || '').trim()).filter(Boolean))].slice(0, 50).forEach((v) => situationList.appendChild(el('option', { value: v })));
  }
  if (emotionList) {
    emotionList.innerHTML = '';
    [...new Set(rows.map((r) => (r.emotion || '').trim()).filter(Boolean))].slice(0, 50).forEach((v) => emotionList.appendChild(el('option', { value: v })));
  }
}
async function deleteThoughtRecord(id) {
  try {
    await api(`/mood/thought-records/${id}`, { method: 'DELETE' });
    loadThoughtRecords();
  } catch (e) { showToast('刪除失敗：' + e.message); }
}

function moodStatTile(value, label) {
  return el('div', { class: 'mood-stat-tile' }, [
    el('div', { class: 'mood-stat-value' }, value),
    el('div', { class: 'mood-stat-label' }, label),
  ]);
}

function renderMoodStats(container, summary) {
  container.innerHTML = '';
  const series = summary.series || [];
  if (!series.length) {
    container.appendChild(el('div', { class: 'empty-state' }, '還沒有資料'));
    return;
  }
  const thisMonth = todayStr().slice(0, 7);
  const monthCount = series.filter((r) => r.entry_date.startsWith(thisMonth)).length;

  // 連續記錄天數：從今天往回算，只要中間斷一天就停止
  const dateSet = new Set(series.map((r) => r.entry_date));
  let streak = 0;
  let cursor = new Date();
  while (true) {
    const ds = cursor.toISOString().slice(0, 10);
    if (!dateSet.has(ds)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  // 情緒穩定度：分數波動愈小，數值愈高 (僅供參考，不是精確的醫學指標)
  let stability = null;
  if (series.length >= 2 && summary.average != null) {
    const variance = series.reduce((s, r) => s + Math.pow(r.score - summary.average, 2), 0) / series.length;
    const stdev = Math.sqrt(variance);
    stability = Math.max(0, Math.round(100 - (stdev / 4.5) * 100));
  }

  container.appendChild(moodStatTile(summary.average != null ? `${summary.average} 分` : '--', '近 30 天平均分數'));
  container.appendChild(moodStatTile(String(monthCount), '本月已記錄天數'));
  container.appendChild(moodStatTile(`${streak} 天`, '連續記錄天數'));
  container.appendChild(moodStatTile(stability != null ? `${stability}%` : '--', '情緒穩定度 (僅供參考)'));
  if (summary.topTags && summary.topTags.length) {
    const tagsBox = el('div', { style: 'grid-column:1/-1;margin-top:4px' }, [
      el('div', { class: 'mood-stat-label', style: 'margin-bottom:6px' }, '常見標籤'),
      el('div', { class: 'mood-tag-row', style: 'margin:0' }, summary.topTags.map((t) => el('span', { class: 'mood-tag-chip selected' }, `${t.tag} ×${t.count}`))),
    ]);
    container.appendChild(tagsBox);
  }

  const heatmapBox = el('div', { style: 'grid-column:1/-1;margin-top:14px' }, [
    el('div', { class: 'mood-stat-label', style: 'margin-bottom:6px' }, '近 30 天一覽'),
  ]);
  const grid = el('div', { class: 'mood-heatmap' });
  const byDate = {};
  series.forEach((r) => { byDate[r.entry_date] = r.score; });
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  days.forEach((ds) => {
    const score = byDate[ds];
    const cell = el('div', { class: 'mood-heatmap-cell' });
    if (score != null) {
      cell.style.background = `color-mix(in srgb, ${cssVar('--series-magenta')} ${Math.round((score / 10) * 85 + 15)}%, var(--surface-2))`;
      cell.addEventListener('mousemove', (ev) => showTooltip(ev, `${ds}：${score} 分`));
      cell.addEventListener('mouseleave', hideTooltip);
    }
    grid.appendChild(cell);
  });
  heatmapBox.appendChild(grid);
  container.appendChild(heatmapBox);
}

function renderMoodChart(container, series) {
  container.innerHTML = '';
  const width = container.clientWidth || 460;
  const height = 180;
  const padL = 28, padR = 12, padTop = 14, padBottom = 26;
  const plotW = width - padL - padR;
  const plotH = height - padTop - padBottom;
  const svg = svgEl('svg', { width: '100%', height, viewBox: `0 0 ${width} ${height}` });

  for (const gv of [1, 4, 7, 10]) {
    const y = padTop + plotH - ((gv - 1) / 9) * plotH;
    svg.appendChild(svgEl('line', { x1: padL, x2: width - padR, y1: y, y2: y, stroke: cssVar('--grid-line'), 'stroke-width': 1 }));
    const lbl = svgEl('text', { x: 2, y: y + 4, 'font-size': 10, fill: cssVar('--text-muted') });
    lbl.textContent = String(gv);
    svg.appendChild(lbl);
  }

  const n = series.length;
  const coords = series.map((p, i) => ({
    px: padL + (n > 1 ? (i / (n - 1)) * plotW : plotW / 2),
    py: padTop + plotH - ((p.score - 1) / 9) * plotH,
  }));
  const pathD = coords.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.px},${p.py}`).join(' ');

  const gradId = 'moodAreaGrad';
  const defs = svgEl('defs', {});
  const grad = svgEl('linearGradient', { id: gradId, x1: '0', y1: '0', x2: '0', y2: '1' });
  const stop1 = svgEl('stop', { offset: '0%', 'stop-color': cssVar('--series-magenta'), 'stop-opacity': '0.35' });
  const stop2 = svgEl('stop', { offset: '100%', 'stop-color': cssVar('--series-magenta'), 'stop-opacity': '0' });
  grad.appendChild(stop1); grad.appendChild(stop2); defs.appendChild(grad); svg.appendChild(defs);

  const areaD = `${pathD} L${coords[coords.length - 1].px},${padTop + plotH} L${coords[0].px},${padTop + plotH} Z`;
  svg.appendChild(svgEl('path', { d: areaD, fill: `url(#${gradId})`, stroke: 'none' }));
  svg.appendChild(svgEl('path', { d: pathD, fill: 'none', stroke: cssVar('--series-magenta'), 'stroke-width': 2, 'stroke-linecap': 'round' }));

  series.forEach((p, i) => {
    const px = padL + (n > 1 ? (i / (n - 1)) * plotW : plotW / 2);
    const py = padTop + plotH - ((p.score - 1) / 9) * plotH;
    const dot = svgEl('circle', { cx: px, cy: py, r: 3.5, fill: cssVar('--series-magenta') });
    dot.addEventListener('mousemove', (ev) => showTooltip(ev, `${p.entry_date}：${p.score} 分`));
    dot.addEventListener('mouseleave', hideTooltip);
    svg.appendChild(dot);
    if (n <= 10 || i === 0 || i === n - 1 || i % Math.ceil(n / 6) === 0) {
      const lbl = svgEl('text', { x: px, y: height - 6, 'font-size': 9, 'text-anchor': 'middle', fill: cssVar('--text-muted') });
      lbl.textContent = p.entry_date.slice(5);
      svg.appendChild(lbl);
    }
  });

  container.appendChild(svg);
}

async function loadMoodDiaryLink() {
  const area = $('#moodDiaryLink');
  if (!area) return;
  try {
    const today = todayStr();
    const entries = await api(`/diary?from=${today}&to=${today}`);
    area.innerHTML = '';
    if (!entries.length) {
      area.appendChild(el('div', { class: 'empty-state' }, '今天還沒寫日記'));
      area.appendChild(el('button', { class: 'btn btn-ghost', style: 'margin-top:8px', onclick: () => switchTab('diary') }, '前往寫日記'));
    } else {
      const snippet = (entries[0].content || '').slice(0, 80);
      area.appendChild(el('p', { style: 'font-size:13px;color:var(--text-secondary)' }, snippet + (entries[0].content.length > 80 ? '…' : '')));
      area.appendChild(el('button', { class: 'btn btn-ghost', style: 'margin-top:4px', onclick: () => switchTab('diary') }, '查看完整日記'));
    }
  } catch (e) {
    area.innerHTML = '';
    area.appendChild(el('div', { class: 'empty-state' }, '日記資料暫時無法取得'));
  }
}

async function loadMoodChatHistory() {
  try {
    moodState.chatHistory = await api('/mood/chat/history');
  } catch (e) {
    moodState.chatHistory = [];
  }
  moodState.opener = null;
  // 只有「目前沒有對話紀錄，但之前留有長期記憶摘要」時，才會拿到主動開場白，
  // 這樣使用者清過對話畫面之後，AI 還是會像記得之前聊過的內容一樣主動先開口。
  if (!moodState.chatHistory.length) {
    try {
      const opener = await api('/mood/chat/opener');
      if (opener.available) moodState.opener = opener.reply;
    } catch (e) { /* 開場白失敗不影響主要功能 */ }
  }
  renderMoodChatMessages();
}
async function clearMoodChatHistory() {
  try {
    await api('/mood/chat/history', { method: 'DELETE' });
    moodState.chatHistory = [];
    renderMoodChatMessages();
    showToast('已清除陪伴對話記錄');
  } catch (e) { showToast('清除失敗: ' + e.message); }
}
function renderMoodChatMessages() {
  const box = $('#moodChatMessages');
  if (!box) return;
  box.innerHTML = '';
  if (!moodState.chatHistory || !moodState.chatHistory.length) {
    if (moodState.opener) {
      box.appendChild(el('div', { class: 'chat-msg chat-ai' }, moodState.opener));
    } else {
      box.appendChild(el('div', { class: 'empty-state' }, '還沒有對話，想聊聊嗎？隨時都可以開始'));
    }
    return;
  }
  moodState.chatHistory.forEach((m) => {
    box.appendChild(el('div', { class: 'chat-msg ' + (m.role === 'user' ? 'chat-user' : 'chat-ai') }, m.content));
  });
  box.scrollTop = box.scrollHeight;
}
async function sendMoodChatMessage() {
  const input = $('#moodChatInput');
  const text = input.value.trim();
  if (!text) return;
  moodState.chatHistory = moodState.chatHistory || [];
  moodState.chatHistory.push({ role: 'user', content: text });
  input.value = '';
  renderMoodChatMessages();
  try {
    const res = await api('/mood/chat', { method: 'POST', body: { message: text } });
    moodState.chatHistory.push({ role: 'assistant', content: res.reply });
    renderMoodChatMessages();
  } catch (e) {
    moodState.chatHistory.push({ role: 'assistant', content: '發生錯誤: ' + e.message });
    renderMoodChatMessages();
  }
}

// ===================== 健康紀錄 (睡眠 / 服藥) =====================
function renderHealth() {
  const c = $('#tab-health');
  c.innerHTML = '';

  const sleepCard = el('div', { class: 'card' }, [
    el('h3', {}, '😴 睡眠紀錄'),
    el('p', { class: 'hint' }, '記錄每天的睡眠時數，看看這幾天/這個月平均睡多少。'),
    el('div', { class: 'form-row' }, [
      el('input', { id: 'sleepDate', type: 'date', value: todayStr() }),
      el('input', { id: 'sleepHours', type: 'number', step: '0.5', min: '0', max: '24', placeholder: '睡眠時數 (小時)' }),
    ]),
    el('input', { id: 'sleepNote', placeholder: '備註 (選填)', style: 'width:100%;margin-top:8px' }),
    el('button', { class: 'btn btn-primary', style: 'margin-top:10px', onclick: saveSleepEntry }, '儲存'),
    el('div', { id: 'sleepChart', style: 'margin-top:16px' }, el('div', { class: 'empty-state' }, '載入中...')),
  ]);

  const medsCard = el('div', { class: 'card' }, [
    el('h3', {}, '💊 服藥提醒'),
    el('p', { class: 'hint' }, '把需要每天吃的藥加進來，每天打勾記錄有沒有吃。'),
    el('div', { class: 'form-row' }, [
      el('input', { id: 'medName', placeholder: '藥品名稱' }),
      el('input', { id: 'medDose', placeholder: '劑量 (選填)' }),
      el('input', { id: 'medTime', placeholder: '服用時間 (選填，例如 08:00)' }),
    ]),
    el('button', { class: 'btn btn-primary', style: 'margin-top:8px', onclick: addMed }, '新增藥品'),
    el('div', { id: 'medTodayList', style: 'margin-top:16px' }, el('div', { class: 'empty-state' }, '載入中...')),
  ]);

  c.appendChild(el('div', { class: 'grid-2' }, [sleepCard, medsCard]));

  loadSleepChart();
  loadMedsToday();
}

async function saveSleepEntry() {
  const date = $('#sleepDate').value || todayStr();
  const hours = $('#sleepHours').value;
  if (!hours) { showToast('請填寫睡眠時數'); return; }
  try {
    await api(`/health-track/sleep/${date}`, { method: 'PUT', body: { hours: Number(hours), note: $('#sleepNote').value.trim() } });
    showToast('已儲存睡眠紀錄');
    loadSleepChart();
  } catch (e) { showToast('儲存失敗：' + e.message); }
}
async function loadSleepChart() {
  const area = $('#sleepChart');
  if (!area) return;
  try {
    const summary = await api('/health-track/sleep/summary?days=30');
    area.innerHTML = '';
    if (!summary.series.length) {
      area.appendChild(el('div', { class: 'empty-state' }, '還沒有睡眠紀錄'));
      return;
    }
    area.appendChild(el('p', { class: 'hint' }, `近 30 天平均睡眠時數：${summary.average} 小時`));
    const svg = svgEl('svg', { width: '100%', height: 140, viewBox: '0 0 460 140' });
    const padL = 28, padR = 12, padTop = 10, padBottom = 20;
    const plotW = 460 - padL - padR, plotH = 140 - padTop - padBottom;
    const n = summary.series.length;
    const maxHours = Math.max(10, ...summary.series.map((r) => r.hours));
    const coords = summary.series.map((p, i) => ({
      px: padL + (n > 1 ? (i / (n - 1)) * plotW : plotW / 2),
      py: padTop + plotH - (p.hours / maxHours) * plotH,
    }));
    const pathD = coords.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.px},${p.py}`).join(' ');
    svg.appendChild(svgEl('path', { d: pathD, fill: 'none', stroke: cssVar('--series-blue'), 'stroke-width': 2, 'stroke-linecap': 'round' }));
    summary.series.forEach((p, i) => {
      const dot = svgEl('circle', { cx: coords[i].px, cy: coords[i].py, r: 3, fill: cssVar('--series-blue') });
      dot.addEventListener('mousemove', (ev) => showTooltip(ev, `${p.entry_date}：${p.hours} 小時`));
      dot.addEventListener('mouseleave', hideTooltip);
      svg.appendChild(dot);
    });
    area.appendChild(svg);
  } catch (e) {
    area.innerHTML = '';
    area.appendChild(el('div', { class: 'empty-state' }, '睡眠資料暫時無法取得'));
  }
}

async function addMed() {
  const name = $('#medName').value.trim();
  if (!name) { showToast('請填寫藥品名稱'); return; }
  try {
    await api('/health-track/meds', { method: 'POST', body: { name, dose: $('#medDose').value.trim(), scheduleTime: $('#medTime').value.trim() } });
    $('#medName').value = ''; $('#medDose').value = ''; $('#medTime').value = '';
    loadMedsToday();
  } catch (e) { showToast('新增失敗：' + e.message); }
}
async function loadMedsToday() {
  const list = $('#medTodayList');
  if (!list) return;
  try {
    const meds = await api('/health-track/meds/today');
    list.innerHTML = '';
    if (!meds.length) {
      list.appendChild(el('div', { class: 'empty-state' }, '還沒有加入任何藥品'));
      return;
    }
    meds.forEach((m) => {
      const checkbox = el('input', { type: 'checkbox', onchange: (ev) => toggleMedTaken(m.id, ev.target.checked) });
      checkbox.checked = !!m.takenToday;
      list.appendChild(el('div', { class: 'coping-note-item' }, [
        el('label', { style: 'display:flex;align-items:center;gap:8px;flex:1;cursor:pointer' }, [
          checkbox,
          el('div', { class: 'content' }, `${m.name}${m.dose ? `（${m.dose}）` : ''}${m.schedule_time ? ` · ${m.schedule_time}` : ''}`),
        ]),
        el('button', { class: 'del-btn', onclick: () => deleteMed(m.id) }, '✕'),
      ]));
    });
  } catch (e) {
    list.innerHTML = '';
    list.appendChild(el('div', { class: 'empty-state' }, '服藥資料暫時無法取得'));
  }
}
async function toggleMedTaken(id, taken) {
  try {
    await api(`/health-track/meds/${id}/log`, { method: 'PUT', body: { taken, date: todayStr() } });
  } catch (e) { showToast('更新失敗：' + e.message); }
}
async function deleteMed(id) {
  try {
    await api(`/health-track/meds/${id}`, { method: 'DELETE' });
    loadMedsToday();
  } catch (e) { showToast('刪除失敗：' + e.message); }
}

// ===================== 帳單提醒 =====================
function renderBills() {
  const c = $('#tab-bills');
  c.innerHTML = '';

  const formCard = el('div', { class: 'card' }, [
    el('h3', {}, '🧾 新增固定帳單'),
    el('p', { class: 'hint' }, '記錄每月固定要繳的錢 (房租、保險、訂閱等)，到期前可以提醒自己還沒繳。'),
    el('div', { class: 'form-row' }, [
      el('input', { id: 'billName', placeholder: '帳單名稱' }),
      el('input', { id: 'billAmount', type: 'number', placeholder: '金額' }),
      el('input', { id: 'billDueDay', type: 'number', min: '1', max: '31', placeholder: '每月幾號到期' }),
    ]),
    el('input', { id: 'billCategory', placeholder: '分類 (選填，例如：居住、保險、訂閱)', style: 'width:100%;margin-top:8px' }),
    el('button', { class: 'btn btn-primary', style: 'margin-top:10px', onclick: addBill }, '新增帳單'),
  ]);

  const listCard = el('div', { class: 'card' }, [
    el('h3', {}, '📋 這個月的帳單'),
    el('div', { id: 'billsListArea' }, el('div', { class: 'empty-state' }, '載入中...')),
  ]);

  c.appendChild(formCard);
  c.appendChild(listCard);
  loadBills();
}
async function addBill() {
  const name = $('#billName').value.trim();
  const amount = $('#billAmount').value;
  const dueDay = $('#billDueDay').value;
  if (!name || !amount || !dueDay) { showToast('請填寫名稱、金額、到期日'); return; }
  try {
    await api('/bills', { method: 'POST', body: { name, amount: Number(amount), dueDay: Number(dueDay), category: $('#billCategory').value.trim() } });
    $('#billName').value = ''; $('#billAmount').value = ''; $('#billDueDay').value = ''; $('#billCategory').value = '';
    showToast('已新增帳單');
    loadBills();
  } catch (e) { showToast('新增失敗：' + e.message); }
}
async function loadBills() {
  const area = $('#billsListArea');
  if (!area) return;
  try {
    const res = await api('/bills/upcoming');
    area.innerHTML = '';
    if (!res.bills.length) {
      area.appendChild(el('div', { class: 'empty-state' }, '還沒有加入任何帳單'));
      return;
    }
    area.appendChild(el('p', { class: 'hint' }, `這個月還沒繳的總金額：NT$ ${Math.round(res.totalUnpaid)}`));
    res.bills.forEach((b) => {
      const dueText = b.paid ? '已繳' : (b.daysUntilDue < 0 ? `已過期 ${Math.abs(b.daysUntilDue)} 天` : b.daysUntilDue === 0 ? '今天到期' : `還有 ${b.daysUntilDue} 天到期`);
      area.appendChild(el('div', { class: 'coping-note-item', style: b.paid ? '' : (b.daysUntilDue <= 3 ? 'border-color:var(--series-magenta)' : '') }, [
        el('div', { class: 'content' }, [
          el('div', { style: 'font-weight:700' }, `${b.name}　NT$ ${Math.round(b.amount)}`),
          el('div', { class: 'hint', style: 'margin:2px 0 0' }, `每月 ${b.due_day} 號到期 · ${dueText}${b.category ? ` · ${b.category}` : ''}`),
        ]),
        el('div', { style: 'display:flex;gap:6px;align-items:center' }, [
          el('button', { class: 'btn btn-ghost', style: 'font-size:12px;padding:4px 10px', onclick: () => toggleBillPaid(b.id, !b.paid) }, b.paid ? '取消已繳' : '標記已繳'),
          el('button', { class: 'del-btn', onclick: () => deleteBill(b.id) }, '✕'),
        ]),
      ]));
    });
  } catch (e) {
    area.innerHTML = '';
    area.appendChild(el('div', { class: 'empty-state' }, '帳單資料暫時無法取得'));
  }
}
async function toggleBillPaid(id, paid) {
  try {
    await api(`/bills/${id}/${paid ? 'mark-paid' : 'mark-unpaid'}`, { method: 'POST' });
    loadBills();
  } catch (e) { showToast('更新失敗：' + e.message); }
}
async function deleteBill(id) {
  try {
    await api(`/bills/${id}`, { method: 'DELETE' });
    loadBills();
  } catch (e) { showToast('刪除失敗：' + e.message); }
}

// ===================== 待辦事項 =====================
// ---- 待辦事項頁面狀態 (編輯中的任務 id、表單進階選項是否展開、清單分頁籤/篩選/批次模式) ----
let taskEditingId = null;
let taskFormExpanded = false;
let taskViewTab = 'pending'; // 'pending' | 'done'
let taskFilterText = '';
let taskFilterPriority = '';
let taskBatchMode = false;
const taskSelectedIds = new Set();
let taskDataPending = [];
let taskDataDone = [];

function renderTasks() {
  const c = $('#tab-tasks');
  c.innerHTML = '';
  taskEditingId = null;
  taskBatchMode = false;
  taskSelectedIds.clear();

  const formCard = el('div', { class: 'card', id: 'taskFormCard' }, [
    el('h3', { id: 'taskFormTitle' }, '➕ 新增任務'),
    el('input', { id: 'taskTitle', placeholder: '要做什麼事？', style: 'width:100%' }),
    el('div', { class: 'form-row', style: 'margin-top:8px' }, [
      el('input', { id: 'taskDueDate', type: 'date' }),
      el('select', { id: 'taskPriority' }, [
        el('option', { value: 'high' }, '🔴 高優先'),
        el('option', { value: 'medium', selected: true }, '🟡 中優先'),
        el('option', { value: 'low' }, '🟢 低優先'),
      ]),
    ]),
    el('span', { id: 'taskAdvancedToggle', class: 'task-advanced-toggle', onclick: toggleTaskAdvanced }, '▸ 更多選項 (精力／備註／重複／準時提醒)'),
    el('div', { id: 'taskAdvancedFields', style: 'display:none;margin-top:8px' }, [
      el('select', { id: 'taskEnergy' }, [
        el('option', { value: '' }, '⚡ 所需精力 (選填)'),
        el('option', { value: 'low' }, '🔋 低精力 (輕鬆就能做)'),
        el('option', { value: 'medium' }, '🔋🔋 中精力'),
        el('option', { value: 'high' }, '🔋🔋🔋 高精力 (需要專注/體力)'),
      ]),
      el('input', { id: 'taskNote', list: 'taskNoteList', placeholder: '備註 (選填)', style: 'width:100%;margin-top:8px' }),
      el('datalist', { id: 'taskNoteList' }),
      el('div', { class: 'form-row', style: 'margin-top:8px' }, [
        el('select', { id: 'taskRecurrence' }, [
          el('option', { value: '' }, '🔁 不重複'),
          el('option', { value: 'daily' }, '每天'),
          el('option', { value: 'weekly' }, '每週'),
          el('option', { value: 'monthly' }, '每月'),
        ]),
      ]),
      el('p', { class: 'hint', style: 'margin-top:4px' }, '設定重複的話，完成這筆任務時會自動照週期產生下一筆，不用重新輸入。'),
      el('div', { class: 'form-row', style: 'margin-top:8px;align-items:center' }, [
        el('select', { id: 'taskRemindQuick', onchange: applyTaskRemindQuickPick }, [
          el('option', { value: '' }, '🔔 準時提醒 (選填)'),
          el('option', { value: '300' }, '5 分鐘後'),
          el('option', { value: '900' }, '15 分鐘後'),
          el('option', { value: '1800' }, '30 分鐘後'),
          el('option', { value: '3600' }, '1 小時後'),
          el('option', { value: 'custom' }, '自訂時間…'),
        ]),
        el('input', { id: 'taskRemindAt', type: 'datetime-local', style: 'display:none' }),
      ]),
      el('p', { class: 'hint', style: 'margin-top:4px' }, '設定的話，時間一到會準時跳出背景推播通知 (需要先在「個人化設定」開啟背景推播)。'),
    ]),
    el('div', { class: 'form-row', style: 'margin-top:10px' }, [
      el('button', { class: 'btn btn-primary', id: 'taskSubmitBtn', onclick: submitTaskForm }, '新增任務'),
      el('button', { class: 'btn btn-ghost', id: 'taskCancelEditBtn', style: 'display:none', onclick: () => cancelEditTask() }, '取消編輯'),
    ]),
  ]);

  const reviewCard = el('div', { class: 'card', id: 'taskReviewCard' }, [
    el('h3', {}, '🗓️ 這週回顧'),
    el('div', { id: 'taskReviewArea' }, el('div', { class: 'empty-state' }, '載入中...')),
  ]);

  const suggestCard = el('div', { class: 'card', id: 'taskSuggestCard' }, [
    el('h3', {}, '💡 今天建議先做'),
    el('div', { id: 'taskSuggestArea' }, el('div', { class: 'empty-state' }, '載入中...')),
  ]);

  const listCard = el('div', { class: 'card' }, [
    el('div', { class: 'task-view-tabs' }, [
      el('button', { id: 'taskTabPending', class: 'task-view-tab active', onclick: () => switchTaskViewTab('pending') }, '📌 待完成'),
      el('button', { id: 'taskTabDone', class: 'task-view-tab', onclick: () => switchTaskViewTab('done') }, '✅ 已完成'),
      el('button', { id: 'taskBatchToggleBtn', class: 'btn btn-ghost', style: 'margin-left:auto;font-size:11.5px;padding:5px 10px', onclick: toggleTaskBatchMode }, '☑️ 批次'),
    ]),
    el('div', { class: 'task-filter-row' }, [
      el('input', { id: 'taskFilterText', type: 'text', placeholder: '🔍 搜尋標題／備註', oninput: (ev) => { taskFilterText = ev.target.value; renderTaskListArea(); } }),
      el('select', { id: 'taskFilterPriority', onchange: (ev) => { taskFilterPriority = ev.target.value; renderTaskListArea(); } }, [
        el('option', { value: '' }, '全部優先度'),
        el('option', { value: 'high' }, '🔴 高優先'),
        el('option', { value: 'medium' }, '🟡 中優先'),
        el('option', { value: 'low' }, '🟢 低優先'),
      ]),
    ]),
    el('div', { id: 'taskBatchBar', class: 'task-batch-bar', style: 'display:none' }, [
      el('span', { id: 'taskBatchCount' }, '已選 0 筆'),
      el('button', { class: 'btn btn-ghost', style: 'font-size:12px', onclick: () => batchCompleteTasks() }, '✅ 標記完成'),
      el('button', { class: 'btn btn-ghost', style: 'font-size:12px', onclick: () => batchDeleteTasks() }, '🗑️ 刪除'),
    ]),
    el('div', { id: 'taskListArea' }, el('div', { class: 'empty-state' }, '載入中...')),
  ]);

  c.appendChild(formCard);
  c.appendChild(reviewCard);
  c.appendChild(suggestCard);
  c.appendChild(listCard);
  loadTasks();
  loadTaskSuggestions();
  loadTaskReview();
}

// 「更多選項」收合區塊：預設收合只留最常用的標題/日期/優先度，避免手機版表單一次展開太多欄位要滑很久。
function toggleTaskAdvanced(forceOpen) {
  taskFormExpanded = forceOpen === true ? true : !taskFormExpanded;
  const box = $('#taskAdvancedFields');
  const toggle = $('#taskAdvancedToggle');
  if (box) box.style.display = taskFormExpanded ? '' : 'none';
  if (toggle) toggle.textContent = taskFormExpanded ? '▾ 收合更多選項' : '▸ 更多選項 (精力／備註／重複／準時提醒)';
}

// 「準時提醒」下拉選單：選相對時間 (5分鐘後等) 就直接算出對應的 datetime-local 值填進隱藏的
// 自訂時間欄位；選「自訂時間…」則把欄位顯示出來讓使用者自己挑日期時間。
function applyTaskRemindQuickPick() {
  const quick = $('#taskRemindQuick').value;
  const input = $('#taskRemindAt');
  if (!quick) { input.style.display = 'none'; input.value = ''; return; }
  if (quick === 'custom') { input.style.display = ''; return; }
  const target = new Date(Date.now() + Number(quick) * 1000);
  // datetime-local 要的是「本地時間」字串 (無時區資訊)，用 getTimezoneOffset 校正成本地時間再切片
  const local = new Date(target.getTime() - target.getTimezoneOffset() * 60000);
  input.value = local.toISOString().slice(0, 16);
  input.style.display = '';
}

// datetime-local 輸入框給的值沒有時區資訊，瀏覽器會當作「使用者當地時區」解讀，
// new Date(value) 剛好就是照當地時區轉換，直接轉成 ISO 字串送給後端即可。
function taskRemindAtIso() {
  const val = $('#taskRemindAt').value;
  if (!val) return null;
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function resetTaskForm() {
  $('#taskTitle').value = ''; $('#taskDueDate').value = ''; $('#taskPriority').value = 'medium';
  $('#taskEnergy').value = ''; $('#taskNote').value = ''; $('#taskRecurrence').value = '';
  $('#taskRemindQuick').value = ''; $('#taskRemindAt').value = ''; $('#taskRemindAt').style.display = 'none';
}

// 表單同時負責「新增」跟「編輯」——編輯時 taskEditingId 有值就改呼叫 PUT，其餘欄位收集邏輯完全共用，
// 這樣桌面版跟手機版不用維護兩套表單邏輯。
async function submitTaskForm() {
  const title = $('#taskTitle').value.trim();
  if (!title) { showToast('請填寫任務標題'); return; }
  const body = {
    title,
    dueDate: $('#taskDueDate').value || null,
    priority: $('#taskPriority').value,
    energyLevel: $('#taskEnergy').value || null,
    note: $('#taskNote').value.trim(),
    recurrence: $('#taskRecurrence').value || null,
    remindAt: taskRemindAtIso(),
  };
  try {
    if (taskEditingId != null) {
      await api(`/tasks/${taskEditingId}`, { method: 'PUT', body });
      showToast('已更新任務');
      cancelEditTask();
    } else {
      await api('/tasks', { method: 'POST', body });
      showToast('已新增任務');
      resetTaskForm();
    }
    loadTasks();
    loadTaskSuggestions();
  } catch (e) { showToast('儲存失敗：' + e.message); }
}

// 點任務的「✏️ 編輯」按鈕：把表單填成這筆任務目前的內容、切換成編輯模式，並捲動到表單讓使用者看得到。
function startEditTask(t) {
  taskEditingId = t.id;
  $('#taskFormTitle').textContent = '✏️ 編輯任務';
  $('#taskTitle').value = t.title || '';
  $('#taskDueDate').value = t.due_date || '';
  $('#taskPriority').value = t.priority || 'medium';
  $('#taskEnergy').value = t.energy_level || '';
  $('#taskNote').value = t.note || '';
  $('#taskRecurrence').value = t.recurrence || '';
  if (t.remind_at) {
    const d = new Date(t.remind_at);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    $('#taskRemindQuick').value = 'custom';
    $('#taskRemindAt').value = local.toISOString().slice(0, 16);
    $('#taskRemindAt').style.display = '';
  } else {
    $('#taskRemindQuick').value = '';
    $('#taskRemindAt').value = '';
    $('#taskRemindAt').style.display = 'none';
  }
  toggleTaskAdvanced(true); // 編輯時直接展開進階選項，不然使用者會以為精力/重複/提醒設定不見了
  $('#taskSubmitBtn').textContent = '更新任務';
  $('#taskCancelEditBtn').style.display = '';
  $('#taskFormCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function cancelEditTask() {
  taskEditingId = null;
  $('#taskFormTitle').textContent = '➕ 新增任務';
  $('#taskSubmitBtn').textContent = '新增任務';
  $('#taskCancelEditBtn').style.display = 'none';
  resetTaskForm();
}

const RECURRENCE_LABEL = { daily: '每天', weekly: '每週', monthly: '每月' };

async function loadTaskReview() {
  const area = $('#taskReviewArea');
  if (!area) return;
  try {
    const res = await api('/tasks/review/week');
    area.innerHTML = '';
    area.appendChild(el('p', { class: 'hint', style: 'margin:0 0 8px' }, `${res.rangeFrom} ～ ${res.rangeTo}，完成了 ${res.completedCount} 件，目前還有 ${res.stillPendingCount} 件待完成。`));
    if (res.longPendingTasks.length) {
      area.appendChild(el('div', { style: 'font-size:12.5px;font-weight:700;margin-bottom:4px' }, `已經過期 3 天以上、還沒完成 (${res.longPendingTasks.length})`));
      res.longPendingTasks.slice(0, 5).forEach((t) => {
        area.appendChild(el('div', { class: 'mood-signal-item' }, `${t.title}（到期：${t.due_date}）`));
      });
    }
  } catch (e) { area.innerHTML = ''; area.appendChild(el('div', { class: 'empty-state' }, '這週回顧暫時無法取得')); }
}
const PRIORITY_LABEL = { high: '🔴 高', medium: '🟡 中', low: '🟢 低' };
const ENERGY_LABEL = { low: '🔋 低精力', medium: '🔋🔋 中精力', high: '🔋🔋🔋 高精力' };

async function loadTaskSuggestions() {
  const area = $('#taskSuggestArea');
  if (!area) return;
  try {
    const res = await api('/tasks/suggest-today');
    area.innerHTML = '';
    if (!res.moodLogged) {
      area.appendChild(el('p', { class: 'hint', style: 'margin:0 0 8px' }, res.note || '今天還沒記錄心情，先依優先度排序。'));
    } else {
      area.appendChild(el('p', { class: 'hint', style: 'margin:0 0 8px' }, `今天心情 ${res.todayScore} 分，${res.usedHistory ? '依你過去在類似心情下的完成狀況排序：' : '先用一般的建議順序排序 (累積更多紀錄後會更準)：'}`));
    }
    if (!res.tasks.length) {
      area.appendChild(el('div', { class: 'empty-state' }, '目前沒有待完成的任務'));
      return;
    }
    res.tasks.slice(0, 5).forEach((t) => {
      area.appendChild(el('div', { class: 'mood-signal-item' }, `${PRIORITY_LABEL[t.priority] || ''} ${t.title}${t.energy_level ? ` · ${ENERGY_LABEL[t.energy_level]}` : ''}`));
    });
  } catch (e) {
    area.innerHTML = '';
    area.appendChild(el('div', { class: 'empty-state' }, '建議清單暫時無法取得'));
  }
}
// 依到期日把待完成任務分組——「已過期／今天／本週／之後／沒有期限」，比單純依日期攤平排序更容易
// 一眼看出「今天真的該做的是哪幾件」，不用自己在一長串清單裡面找。
const TASK_GROUP_ORDER = ['overdue', 'today', 'week', 'later', 'none'];
const TASK_GROUP_LABELS = { overdue: '⚠️ 已過期', today: '📍 今天', week: '📅 本週內', later: '🗓️ 之後', none: '🗂️ 沒有設定到期日' };

function taskDueBucket(dueDate) {
  if (!dueDate) return 'none';
  const todayStr = new Date().toISOString().slice(0, 10);
  if (dueDate < todayStr) return 'overdue';
  if (dueDate === todayStr) return 'today';
  const diffDays = Math.round((new Date(dueDate + 'T00:00:00') - new Date(todayStr + 'T00:00:00')) / 86400000);
  return diffDays <= 7 ? 'week' : 'later';
}

async function loadTasks() {
  const area = $('#taskListArea');
  if (!area) return;
  try {
    const [pending, done] = await Promise.all([api('/tasks?status=pending'), api('/tasks?status=completed')]);
    taskDataPending = pending;
    taskDataDone = done;
    populateTaskNoteDatalist([...pending, ...done]);
    renderTaskListArea();
  } catch (e) {
    area.innerHTML = '';
    area.appendChild(el('div', { class: 'empty-state' }, '任務資料暫時無法取得'));
  }
}

function applyTaskFilters(rows) {
  let out = rows;
  const q = taskFilterText.trim().toLowerCase();
  if (q) out = out.filter((t) => (t.title || '').toLowerCase().includes(q) || (t.note || '').toLowerCase().includes(q));
  if (taskFilterPriority) out = out.filter((t) => t.priority === taskFilterPriority);
  return out;
}

// 分頁籤/篩選/批次模式只是「怎麼呈現已經拿到的資料」，不需要重打 API，切換時直接重畫這個函式就好，
// 手感比每次都重新 fetch 快很多。
function renderTaskListArea() {
  const area = $('#taskListArea');
  if (!area) return;
  $('#taskTabPending').classList.toggle('active', taskViewTab === 'pending');
  $('#taskTabDone').classList.toggle('active', taskViewTab === 'done');
  area.innerHTML = '';

  if (taskViewTab === 'pending') {
    const filtered = applyTaskFilters(taskDataPending);
    if (!taskDataPending.length) {
      area.appendChild(el('div', { class: 'empty-state' }, '目前沒有待完成的任務'));
    } else if (!filtered.length) {
      area.appendChild(el('div', { class: 'empty-state' }, '沒有符合篩選條件的任務'));
    } else {
      const grouped = {};
      filtered.forEach((t) => {
        const b = taskDueBucket(t.due_date);
        (grouped[b] = grouped[b] || []).push(t);
      });
      TASK_GROUP_ORDER.forEach((bucket) => {
        const rows = grouped[bucket];
        if (!rows || !rows.length) return;
        area.appendChild(el('div', { class: 'task-group-header', style: 'display:flex;align-items:center;gap:8px' }, [
          el('span', {}, `${TASK_GROUP_LABELS[bucket]} (${rows.length})`),
          // 過期任務常常一堆一堆卡在那裡沒人處理，這裡加一顆「全選」捷徑，直接把整組帶進批次模式，
          // 不用一筆一筆手動勾選才能批次完成/刪除。
          bucket === 'overdue' ? el('button', {
            class: 'btn btn-ghost', style: 'font-size:10.5px;padding:2px 8px;margin-left:auto;font-weight:600',
            onclick: () => selectOverdueForBatch(rows.map((r) => r.id)),
          }, '☑️ 全選批次處理') : null,
        ]));
        rows.forEach((t) => area.appendChild(buildTaskRow(t)));
      });
    }
  } else {
    const filtered = applyTaskFilters(taskDataDone);
    if (!taskDataDone.length) {
      area.appendChild(el('div', { class: 'empty-state' }, '還沒有完成的任務'));
    } else if (!filtered.length) {
      area.appendChild(el('div', { class: 'empty-state' }, '沒有符合篩選條件的任務'));
    } else {
      filtered.forEach((t) => {
        area.appendChild(el('div', { class: 'coping-note-item' }, [
          el('div', { class: 'content', style: 'text-decoration:line-through;opacity:0.6' }, t.title),
          el('button', { class: 'btn btn-ghost', style: 'font-size:12px', onclick: () => completeTask(t.id, false) }, '取消完成'),
        ]));
      });
    }
  }
  updateTaskBatchBar();
}

function switchTaskViewTab(tab) {
  taskViewTab = tab;
  renderTaskListArea();
}

function buildTaskRow(t) {
  const hasSubtasks = t.totalSubtasks > 0;
  const pct = hasSubtasks ? Math.round((t.completedSubtasks / t.totalSubtasks) * 100) : 0;
  const subtaskPanel = el('div', { class: 'task-subtask-panel', style: 'display:none' });
  const bucket = taskDueBucket(t.due_date);
  const isOverdue = bucket === 'overdue';
  const row = el('div', { class: `task-row-wrap priority-${t.priority || 'medium'}${isOverdue ? ' overdue' : ''}` }, [
    el('div', { class: 'coping-note-item' }, [
      taskBatchMode ? el('input', {
        type: 'checkbox', style: 'margin-top:3px', checked: taskSelectedIds.has(t.id),
        onchange: (ev) => { if (ev.target.checked) taskSelectedIds.add(t.id); else taskSelectedIds.delete(t.id); updateTaskBatchBar(); },
      }) : null,
      el('label', { style: 'display:flex;align-items:flex-start;gap:8px;flex:1;cursor:pointer' }, [
        el('input', { type: 'checkbox', style: 'margin-top:3px', onchange: () => completeTask(t.id, true) }),
        el('div', { class: 'content' }, [
          el('div', {}, [
            `${PRIORITY_LABEL[t.priority] || ''} ${t.title}${t.energy_level ? ` · ${ENERGY_LABEL[t.energy_level]}` : ''} `,
            t.recurrence ? el('span', { class: 'badge badge-neutral' }, `🔁 ${RECURRENCE_LABEL[t.recurrence]}`) : null,
          ]),
          el('div', { class: 'hint', style: 'margin:2px 0 0' }, [
            isOverdue
              ? el('span', { class: 'task-overdue-badge' }, `⚠️ 已過期 (${t.due_date})`)
              : (t.due_date ? `到期：${t.due_date}` : '沒有設定到期日'),
            t.note ? ` · ${t.note}` : '',
          ]),
          t.remind_at ? el('div', { class: 'hint', style: 'margin:2px 0 0' }, [
            el('span', {}, t.remind_sent_at ? `🔔 已於 ${formatDateTimeShort(t.remind_at)} 提醒過` : `🔔 將於 ${formatDateTimeShort(t.remind_at)} 提醒`),
            !t.remind_sent_at ? el('button', { class: 'btn btn-ghost', style: 'font-size:10px;padding:1px 6px;margin-left:6px', onclick: (ev) => { ev.stopPropagation(); cancelTaskReminder(t.id); } }, '取消提醒') : null,
          ]) : null,
          hasSubtasks ? el('div', { class: 'task-subtask-progress-wrap' }, [
            el('div', { class: 'task-subtask-progress-bar' }, [el('div', { class: 'task-subtask-progress-fill', style: `width:${pct}%` })]),
            el('span', { class: 'task-subtask-progress-label' }, `${t.completedSubtasks}/${t.totalSubtasks} 小任務`),
          ]) : null,
        ]),
      ]),
      isOverdue ? el('button', { class: 'btn btn-ghost', style: 'font-size:11px;padding:4px 8px;flex-shrink:0', onclick: () => snoozeTaskToToday(t.id) }, '⏩ 延到今天') : null,
      el('button', { class: 'btn btn-ghost', style: 'font-size:11px;padding:4px 8px;flex-shrink:0', onclick: () => startEditTask(t) }, '✏️'),
      el('button', { class: 'btn btn-ghost', style: 'font-size:11px;padding:4px 8px;flex-shrink:0', onclick: () => toggleSubtaskPanel(t.id, subtaskPanel) }, hasSubtasks ? '拆解' : '➕ 拆小任務'),
      el('button', { class: 'del-btn', onclick: () => deleteTask(t.id) }, '✕'),
    ]),
    subtaskPanel,
  ]);
  // 重新整理清單 (例如新增/勾選小任務後) 會整個重建 DOM，這裡讓「已經展開過」的
  // 小任務面板保持展開狀態，不然每次操作完面板都會被重建成收合狀態，看起來像沒生效。
  if (expandedTaskSubtasks.has(t.id)) {
    subtaskPanel.style.display = 'block';
    renderSubtaskPanel(t.id, subtaskPanel);
  }
  return row;
}

// 過期任務不自動刪除 (過期通常只是日期沒抓準，不代表這件事不重要了，悄悄刪掉會讓使用者以為
// 資料不見)——改成兩個使用者自己按的快速處理：單筆「延到今天」直接把到期日改成今天，
// 或者下面的「全選批次處理」一次把整組過期任務帶進批次模式，自己決定要完成還是刪除。
async function snoozeTaskToToday(id) {
  try {
    await api(`/tasks/${id}`, { method: 'PUT', body: { dueDate: todayStr() } });
    showToast('已延到今天');
    loadTasks();
    loadTaskSuggestions();
  } catch (e) { showToast('延期失敗：' + e.message); }
}

function selectOverdueForBatch(ids) {
  taskBatchMode = true;
  ids.forEach((id) => taskSelectedIds.add(id));
  const btn = $('#taskBatchToggleBtn');
  if (btn) btn.classList.add('btn-primary');
  renderTaskListArea();
  showToast(`已選取 ${ids.length} 筆已過期任務，可以在下面按批次完成或刪除`);
}

function toggleTaskBatchMode() {
  taskBatchMode = !taskBatchMode;
  if (!taskBatchMode) taskSelectedIds.clear();
  const btn = $('#taskBatchToggleBtn');
  if (btn) btn.classList.toggle('btn-primary', taskBatchMode);
  renderTaskListArea();
}

function updateTaskBatchBar() {
  const bar = $('#taskBatchBar');
  if (!bar) return;
  bar.style.display = taskBatchMode && taskSelectedIds.size > 0 ? '' : 'none';
  const countEl = $('#taskBatchCount');
  if (countEl) countEl.textContent = `已選 ${taskSelectedIds.size} 筆`;
}

async function batchCompleteTasks() {
  const ids = [...taskSelectedIds];
  if (!ids.length) return;
  try {
    await Promise.all(ids.map((id) => api(`/tasks/${id}/complete`, { method: 'PUT', body: { completed: true } })));
    showToast(`已完成 ${ids.length} 筆任務`);
    taskSelectedIds.clear();
    loadTasks();
    loadTaskSuggestions();
    loadTaskReview();
  } catch (e) { showToast('批次完成失敗：' + e.message); }
}

async function batchDeleteTasks() {
  const ids = [...taskSelectedIds];
  if (!ids.length) return;
  try {
    await Promise.all(ids.map((id) => api(`/tasks/${id}`, { method: 'DELETE' })));
    showToast(`已刪除 ${ids.length} 筆任務`);
    taskSelectedIds.clear();
    loadTasks();
    loadTaskSuggestions();
  } catch (e) { showToast('批次刪除失敗：' + e.message); }
}

function populateTaskNoteDatalist(rows) {
  const list = $('#taskNoteList');
  if (!list) return;
  const notes = [...new Set(rows.map((r) => (r.note || '').trim()).filter(Boolean))];
  list.innerHTML = '';
  notes.slice(0, 50).forEach((n) => list.appendChild(el('option', { value: n })));
}

async function completeTask(id, completed) {
  try {
    const res = await api(`/tasks/${id}/complete`, { method: 'PUT', body: { completed } });
    if (res.nextTaskId) showToast('已完成，下一次的重複任務已自動建立');
    loadTasks();
    loadTaskSuggestions();
    loadTaskReview();
  } catch (e) { showToast('更新失敗：' + e.message); }
}
async function deleteTask(id) {
  try {
    await api(`/tasks/${id}`, { method: 'DELETE' });
    loadTasks();
    loadTaskSuggestions();
  } catch (e) { showToast('刪除失敗：' + e.message); }
}

// 把 ISO 時間戳記轉成「07/30 14:05」這種簡短的本地時間顯示，任務清單上的提醒時間用這個格式。
function formatDateTimeShort(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${mm}/${dd} ${hh}:${mi}`;
}

async function cancelTaskReminder(id) {
  try {
    await api(`/tasks/${id}`, { method: 'PUT', body: { remindAt: null } });
    loadTasks();
  } catch (e) { showToast('取消提醒失敗：' + e.message); }
}

// ---- 小任務 (待辦拆解成子項目 + 進度追蹤) ----
const expandedTaskSubtasks = new Set();

async function toggleSubtaskPanel(taskId, panelEl) {
  if (expandedTaskSubtasks.has(taskId)) {
    expandedTaskSubtasks.delete(taskId);
    panelEl.style.display = 'none';
    panelEl.innerHTML = '';
    return;
  }
  expandedTaskSubtasks.add(taskId);
  panelEl.style.display = 'block';
  await renderSubtaskPanel(taskId, panelEl);
}

async function renderSubtaskPanel(taskId, panelEl) {
  panelEl.innerHTML = '';
  panelEl.appendChild(el('div', { class: 'empty-state' }, '載入中...'));
  try {
    const subs = await api(`/tasks/${taskId}/subtasks`);
    panelEl.innerHTML = '';
    if (subs.length) {
      const list = el('div', { class: 'task-subtask-list' });
      subs.forEach((s) => {
        list.appendChild(el('div', { class: 'task-subtask-item' }, [
          el('label', { style: 'display:flex;align-items:center;gap:6px;flex:1;cursor:pointer' }, [
            el('input', { type: 'checkbox', checked: !!s.completed, onchange: (ev) => toggleSubtask(s.id, ev.target.checked, taskId, panelEl) }),
            el('span', { style: s.completed ? 'text-decoration:line-through;opacity:0.55' : '' }, s.title),
          ]),
          el('button', { class: 'del-btn', onclick: () => deleteSubtask(s.id, taskId, panelEl) }, '✕'),
        ]));
      });
      panelEl.appendChild(list);
    }
    panelEl.appendChild(el('div', { class: 'task-subtask-add-row' }, [
      el('input', { id: `subtaskInput-${taskId}`, placeholder: '新增小任務...', onkeydown: (ev) => { if (ev.key === 'Enter') addSubtask(taskId, panelEl); } }),
      el('button', { class: 'btn btn-ghost', onclick: () => addSubtask(taskId, panelEl) }, '新增'),
    ]));
  } catch (e) {
    panelEl.innerHTML = '';
    panelEl.appendChild(el('div', { class: 'empty-state' }, '小任務暫時無法取得'));
  }
}

async function addSubtask(taskId, panelEl) {
  const input = $(`#subtaskInput-${taskId}`);
  const title = input ? input.value.trim() : '';
  if (!title) return;
  try {
    await api(`/tasks/${taskId}/subtasks`, { method: 'POST', body: { title } });
    await renderSubtaskPanel(taskId, panelEl);
    loadTasks();
  } catch (e) { showToast('新增小任務失敗：' + e.message); }
}

async function toggleSubtask(subId, completed, taskId, panelEl) {
  try {
    await api(`/tasks/subtasks/${subId}`, { method: 'PUT', body: { completed } });
    await renderSubtaskPanel(taskId, panelEl);
    loadTasks();
  } catch (e) { showToast('更新失敗：' + e.message); }
}

async function deleteSubtask(subId, taskId, panelEl) {
  try {
    await api(`/tasks/subtasks/${subId}`, { method: 'DELETE' });
    await renderSubtaskPanel(taskId, panelEl);
    loadTasks();
  } catch (e) { showToast('刪除失敗：' + e.message); }
}

// ===================== 人際關係 =====================
function renderRelationships() {
  const c = $('#tab-relationships');
  c.innerHTML = '';

  const formCard = el('div', { class: 'card' }, [
    el('h3', {}, '➕ 新增聯絡人'),
    el('div', { class: 'form-row' }, [
      el('input', { id: 'relName', placeholder: '姓名' }),
      el('input', { id: 'relType', list: 'relTypeList', placeholder: '關係 (選填，例如：家人、朋友)' }),
      el('datalist', { id: 'relTypeList' }, ['家人', '朋友', '同事', '其他'].map((v) => el('option', { value: v }))),
      el('input', { id: 'relBirthday', placeholder: '生日 MM-DD (選填)' }),
    ]),
    el('button', { class: 'btn btn-primary', style: 'margin-top:10px', onclick: addRelationship }, '新增'),
  ]);

  const birthdayCard = el('div', { class: 'card' }, [
    el('h3', {}, '🎂 未來 30 天內的生日'),
    el('div', { id: 'relBirthdayList' }, el('div', { class: 'empty-state' }, '載入中...')),
  ]);

  const importantDatesCard = el('div', { class: 'card' }, [
    el('h3', {}, '📌 重要日期'),
    el('p', { class: 'hint' }, '不只是生日，紀念日、對方的特殊日子都可以記，每年會自動重複提醒。'),
    el('div', { class: 'form-row' }, [
      el('input', { id: 'impDateLabel', placeholder: '名稱，如：交往紀念日' }),
      el('input', { id: 'impDateMonthDay', placeholder: 'MM-DD，例如 08-15' }),
      el('select', { id: 'impDateRel' }, [el('option', { value: '' }, '不綁定聯絡人 (選填)')]),
    ]),
    el('button', { class: 'btn btn-primary', style: 'margin-top:8px', onclick: addImportantDate }, '新增日期'),
    el('div', { id: 'impDateUpcoming', style: 'margin-top:12px' }, el('div', { class: 'empty-state' }, '載入中...')),
    el('div', { id: 'impDateList', style: 'margin-top:8px' }),
  ]);

  const overdueCard = el('div', { class: 'card' }, [
    el('h3', {}, '🕰️ 好一陣子沒特別聯繫'),
    el('p', { class: 'hint' }, '只是時間上的小提醒，純參考用，要不要聯絡、什麼時候聯絡都由你自己決定；每個人可以在下方設定自己的提醒週期，或乾脆不設。'),
    el('div', { id: 'relOverdueArea' }, el('div', { class: 'empty-state' }, '載入中...')),
  ]);

  const listCard = el('div', { class: 'card' }, [
    el('h3', {}, '👥 聯絡人列表'),
    el('div', { id: 'relListArea' }, el('div', { class: 'empty-state' }, '載入中...')),
  ]);

  c.appendChild(formCard);
  c.appendChild(overdueCard);
  c.appendChild(el('div', { class: 'grid-2' }, [birthdayCard, importantDatesCard]));
  c.appendChild(listCard);
  loadRelationships();
  loadUpcomingBirthdays();
  loadOverdueContacts();
  loadImportantDates();
}

async function addImportantDate() {
  const label = $('#impDateLabel').value.trim();
  const monthDay = $('#impDateMonthDay').value.trim();
  if (!label) { showToast('請填寫日期名稱'); return; }
  if (!/^\d{2}-\d{2}$/.test(monthDay)) { showToast('日期請用 MM-DD 格式，例如 08-15'); return; }
  try {
    await api('/relationships/important-dates', { method: 'POST', body: { label, monthDay, relationshipId: $('#impDateRel').value || null } });
    $('#impDateLabel').value = ''; $('#impDateMonthDay').value = '';
    loadImportantDates();
  } catch (e) { showToast('新增失敗：' + e.message); }
}
async function deleteImportantDate(id) {
  await api(`/relationships/important-dates/${id}`, { method: 'DELETE' });
  loadImportantDates();
}
async function loadImportantDates() {
  const upcomingBox = $('#impDateUpcoming');
  const listBox = $('#impDateList');
  const relSelect = $('#impDateRel');
  if (!upcomingBox) return;
  try {
    const [upcoming, all, rels] = await Promise.all([
      api('/relationships/important-dates/upcoming'),
      api('/relationships/important-dates'),
      api('/relationships'),
    ]);
    if (relSelect) {
      relSelect.innerHTML = '';
      relSelect.appendChild(el('option', { value: '' }, '不綁定聯絡人 (選填)'));
      rels.forEach((r) => relSelect.appendChild(el('option', { value: r.id }, r.name)));
    }
    upcomingBox.innerHTML = '';
    if (!upcoming.length) {
      upcomingBox.appendChild(el('div', { class: 'empty-state' }, '未來 30 天內沒有重要日期'));
    } else {
      upcoming.forEach((r) => {
        upcomingBox.appendChild(el('div', { class: 'mood-signal-item' }, `${r.label}${r.relationship_name ? `（${r.relationship_name}）` : ''} · ${r.daysUntil === 0 ? '就是今天！' : `還有 ${r.daysUntil} 天`}`));
      });
    }
    listBox.innerHTML = '';
    all.forEach((r) => {
      listBox.appendChild(el('div', { class: 'coping-note-item' }, [
        el('div', { class: 'content' }, `${r.label}${r.relationship_name ? `（${r.relationship_name}）` : ''} · ${r.month_day}`),
        el('button', { class: 'del-btn', onclick: () => deleteImportantDate(r.id) }, '✕'),
      ]));
    });
  } catch (e) { upcomingBox.innerHTML = ''; upcomingBox.appendChild(el('div', { class: 'empty-state' }, '資料暫時無法取得')); }
}
async function addRelationship() {
  const name = $('#relName').value.trim();
  if (!name) { showToast('請填寫姓名'); return; }
  const birthday = $('#relBirthday').value.trim();
  if (birthday && !/^\d{2}-\d{2}$/.test(birthday)) { showToast('生日請用 MM-DD 格式，例如 03-15'); return; }
  try {
    await api('/relationships', { method: 'POST', body: { name, relationType: $('#relType').value.trim(), birthday: birthday || null } });
    $('#relName').value = ''; $('#relType').value = ''; $('#relBirthday').value = '';
    loadRelationships();
    loadUpcomingBirthdays();
    loadOverdueContacts();
  } catch (e) { showToast('新增失敗：' + e.message); }
}
async function loadOverdueContacts() {
  const area = $('#relOverdueArea');
  if (!area) return;
  try {
    const rows = await api('/relationships/overdue');
    area.innerHTML = '';
    if (!rows.length) {
      area.appendChild(el('div', { class: 'empty-state' }, '目前沒有特別要標記的' ));
      return;
    }
    rows.forEach((r) => {
      const timeText = r.daysSinceContact == null ? '目前還沒有互動紀錄' : `距離上次記錄的互動 ${r.daysSinceContact} 天`;
      area.appendChild(el('div', { class: 'mood-signal-item' }, `${r.name}${r.relation_type ? `（${r.relation_type}）` : ''} · ${timeText}`));
    });
  } catch (e) {
    area.innerHTML = '';
    area.appendChild(el('div', { class: 'empty-state' }, '資料暫時無法取得'));
  }
}
async function loadUpcomingBirthdays() {
  const area = $('#relBirthdayList');
  if (!area) return;
  try {
    const rows = await api('/relationships/upcoming-birthdays');
    area.innerHTML = '';
    if (!rows.length) {
      area.appendChild(el('div', { class: 'empty-state' }, '未來 30 天內沒有生日'));
      return;
    }
    rows.forEach((r) => {
      area.appendChild(el('div', { class: 'mood-signal-item' }, `${r.name}${r.relation_type ? `（${r.relation_type}）` : ''} · ${r.daysUntil === 0 ? '就是今天！' : `還有 ${r.daysUntil} 天`}`));
    });
  } catch (e) {
    area.innerHTML = '';
    area.appendChild(el('div', { class: 'empty-state' }, '生日資料暫時無法取得'));
  }
}
async function loadRelationships() {
  const area = $('#relListArea');
  if (!area) return;
  try {
    const rows = await api('/relationships');
    area.innerHTML = '';
    if (!rows.length) {
      area.appendChild(el('div', { class: 'empty-state' }, '還沒有加入任何聯絡人'));
      return;
    }
    rows.forEach((r) => {
      const item = el('div', { class: 'coping-note-item', style: 'flex-direction:column;align-items:stretch;gap:6px' }, []);
      item.appendChild(el('div', { style: 'display:flex;justify-content:space-between;align-items:center' }, [
        el('div', { class: 'content' }, `${r.name}${r.relation_type ? `（${r.relation_type}）` : ''}${r.birthday ? ` · 生日 ${r.birthday}` : ''}`),
        el('button', { class: 'del-btn', onclick: () => deleteRelationship(r.id) }, '✕'),
      ]));
      item.appendChild(el('div', { class: 'form-row' }, [
        el('input', { id: `relNote_${r.id}`, list: 'relNoteList', placeholder: '記一筆互動 (例如：一起吃了晚餐)', style: 'flex:1' }),
        el('button', { class: 'btn btn-ghost', style: 'font-size:12px', onclick: () => addInteraction(r.id) }, '新增互動'),
      ]));
      item.appendChild(el('div', { class: 'form-row' }, [
        el('input', {
          id: `relInterval_${r.id}`, type: 'number', min: '0',
          placeholder: '提醒週期 (天，選填)',
          value: r.reminder_interval_days != null ? r.reminder_interval_days : '',
          style: 'flex:1',
        }),
        el('button', { class: 'btn btn-ghost', style: 'font-size:12px', onclick: () => saveReminderInterval(r) }, '儲存提醒週期'),
      ]));
      area.appendChild(item);
    });
    area.appendChild(el('datalist', { id: 'relNoteList' }));
    populateRelNoteDatalist(rows);
  } catch (e) {
    area.innerHTML = '';
    area.appendChild(el('div', { class: 'empty-state' }, '聯絡人資料暫時無法取得'));
  }
}
async function addInteraction(relId) {
  const input = $(`#relNote_${relId}`);
  const note = input.value.trim();
  if (!note) return;
  try {
    await api(`/relationships/${relId}/interactions`, { method: 'POST', body: { note } });
    input.value = '';
    showToast('已記錄這筆互動');
    loadOverdueContacts();
  } catch (e) { showToast('新增失敗：' + e.message); }
}
async function deleteRelationship(id) {
  try {
    await api(`/relationships/${id}`, { method: 'DELETE' });
    loadRelationships();
    loadUpcomingBirthdays();
    loadOverdueContacts();
  } catch (e) { showToast('刪除失敗：' + e.message); }
}
async function saveReminderInterval(r) {
  const input = $(`#relInterval_${r.id}`);
  const val = input.value.trim();
  try {
    await api(`/relationships/${r.id}`, {
      method: 'PUT',
      body: { reminderIntervalDays: val === '' ? null : Number(val) },
    });
    showToast('已儲存提醒週期');
    loadOverdueContacts();
  } catch (e) { showToast('儲存失敗：' + e.message); }
}
// 表單自動記憶：把之前記錄過的互動內容整理成建議清單 (最多抓最近幾位聯絡人的紀錄，避免一次打太多 API)
async function populateRelNoteDatalist(rels) {
  const list = $('#relNoteList');
  if (!list || !rels.length) return;
  try {
    const results = await Promise.all(rels.slice(0, 15).map((r) => api(`/relationships/${r.id}/interactions`).catch(() => [])));
    const notes = [...new Set(results.flat().map((i) => (i.note || '').trim()).filter(Boolean))];
    list.innerHTML = '';
    notes.slice(0, 50).forEach((n) => list.appendChild(el('option', { value: n })));
  } catch (e) { /* 自動完成失敗不影響主要功能，靜默略過 */ }
}

// ===================== 陪伴另一半 =====================
// 給「幫另一半記錄生理週期」的使用者一個獨立的頁面：目前大概在哪個階段、可以怎麼體貼地陪伴，
// 以及一份簡單的紀錄日誌 (每次記錄可以順便寫一句觀察，例如「她今天說有點累」)。
// 所有描述都刻意用「有些人可能」這種保留語氣，不做斷言、不做醫療建議，把最終判斷留給使用者自己觀察。
const PARTNER_PHASE_TIPS = {
  menstrual: {
    label: '月經期',
    tip: '這幾天她的身體可能會比較不舒服，像是經痛、疲倦感增加。可以主動問問她需不需要什麼 (熱敷、止痛藥、清淡一點的食物)，安靜地陪伴通常比講道理更有幫助。',
  },
  follicular: {
    label: '濾泡期',
    tip: '這段時間精神狀態通常相對穩定，是規劃活動、聊比較需要專注的事情的好時機。不過每個人狀況不同，還是以她當下的感覺為主。',
  },
  ovulation: {
    label: '排卵期',
    tip: '這段時間精神狀態通常不錯，沒有特別需要注意的地方，維持平常的相處步調就好。',
  },
  luteal: {
    label: '黃體期',
    tip: '身體可能開始有變化，留意她有沒有提到不舒服或情緒上的起伏，多一點觀察就好，不用特別緊張。',
  },
};
const PARTNER_PMS_TIP = '這幾天正好在「經前」這個常見比較敏感的時間窗，有些人在這階段容易累、情緒起伏比較大，這是常見的生理反應，不代表她怎麼了、也不代表你們之間有什麼問題。這時候少一點講道理、多一點耐心和空間，通常會比較有幫助。';

function renderPartnerCare() {
  const c = $('#tab-partnerCare');
  c.innerHTML = '';
  c.appendChild(el('div', { class: 'disclaimer' }, '這裡的階段推算跟提示，是根據你記錄的經期開始日做統計上的估算，僅供理解與陪伴參考，不是醫療建議，每個人狀況不同，最準確的還是直接問她的感受和需求。'));

  c.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, '🌷 目前狀態'),
    el('div', { id: 'partnerStatusBody' }, el('div', { class: 'empty-state' }, '載入中...')),
  ]));

  c.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, '📝 記一筆'),
    el('p', { class: 'hint' }, '記錄這次月經開始日，也可以順便寫點觀察 (例如：她說這幾天特別累)，會變成下面的日誌。'),
    el('div', { class: 'form-row' }, [
      el('input', { id: 'partnerCycleDate', type: 'date', value: todayStr() }),
      el('button', { class: 'btn btn-primary', onclick: addPartnerCycleEntry }, '記錄這次月經開始'),
    ]),
    el('input', { id: 'partnerCycleNote', placeholder: '想記點什麼嗎？(選填)', style: 'width:100%;margin-top:8px' }),
  ]));

  c.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, '📔 陪伴日誌'),
    el('p', { class: 'hint' }, '你幫她記錄過的經期跟觀察備註，依時間排列。'),
    el('div', { id: 'partnerLogArea' }, el('div', { class: 'empty-state' }, '載入中...')),
  ]));

  loadPartnerStatus();
  loadPartnerLog();
}

async function loadPartnerStatus() {
  const box = $('#partnerStatusBody');
  if (!box) return;
  try {
    const status = await api('/mood/cycle/partner-status');
    box.innerHTML = '';
    if (!status.hasData) {
      box.appendChild(el('div', { class: 'empty-state' }, '還沒有幫她記錄過經期，記一次開始日就能開始估算階段。'));
      return;
    }
    const phaseInfo = PARTNER_PHASE_TIPS[status.phase] || { label: status.phase, tip: '' };
    box.appendChild(el('div', { style: 'display:flex;align-items:center;gap:10px;flex-wrap:wrap' }, [
      el('span', { class: 'badge badge-neutral' }, `目前估計：${phaseInfo.label}`),
      status.isPmsWindow ? el('span', { class: 'badge', style: 'background:color-mix(in srgb, var(--warning) 18%, transparent);color:var(--warning)' }, '經前觀察窗') : null,
      el('span', { class: 'hint', style: 'margin:0' }, `距離下次月經約 ${status.daysUntilNextPeriod} 天`),
    ]));
    box.appendChild(el('p', { style: 'margin-top:10px;line-height:1.7' }, status.isPmsWindow ? PARTNER_PMS_TIP : phaseInfo.tip));
    if (!status.hasEnoughDataForAvg) {
      box.appendChild(el('p', { class: 'hint', style: 'margin-top:6px' }, '目前用預設 28 天週期估算，多記錄幾次會愈來愈準。'));
    }
  } catch (e) {
    box.innerHTML = '';
    box.appendChild(el('div', { class: 'empty-state' }, '狀態資料暫時無法取得'));
  }
}

async function addPartnerCycleEntry() {
  const date = $('#partnerCycleDate').value;
  if (!date) { showToast('請選擇日期'); return; }
  const note = $('#partnerCycleNote').value.trim();
  try {
    await api('/mood/cycle', { method: 'POST', body: { periodStartDate: date, trackingFor: 'partner', symptoms: note || null } });
    $('#partnerCycleNote').value = '';
    showToast('已記錄');
    loadPartnerStatus();
    loadPartnerLog();
  } catch (e) { showToast('儲存失敗：' + e.message); }
}

async function loadPartnerLog() {
  const area = $('#partnerLogArea');
  if (!area) return;
  try {
    const rows = (await api('/mood/cycle')).filter((r) => r.tracking_for === 'partner');
    area.innerHTML = '';
    if (!rows.length) { area.appendChild(el('div', { class: 'empty-state' }, '還沒有紀錄')); return; }
    rows.forEach((r) => {
      area.appendChild(el('div', { class: 'coping-note-item' }, [
        el('div', { class: 'content' }, [
          el('div', { style: 'font-weight:700' }, r.period_start_date),
          r.symptoms ? el('div', { class: 'hint', style: 'margin:2px 0 0' }, r.symptoms) : null,
        ]),
        el('button', { class: 'del-btn', onclick: () => deletePartnerCycleEntry(r.id) }, '✕'),
      ]));
    });
  } catch (e) {
    area.innerHTML = '';
    area.appendChild(el('div', { class: 'empty-state' }, '日誌暫時無法取得'));
  }
}
async function deletePartnerCycleEntry(id) {
  try {
    await api(`/mood/cycle/${id}`, { method: 'DELETE' });
    loadPartnerStatus();
    loadPartnerLog();
  } catch (e) { showToast('刪除失敗：' + e.message); }
}

// ===================== 個人化設定 =====================
function renderSettings() {
  const c = $('#tab-settings');
  c.innerHTML = '';
  // 跟首頁小工具拼貼 (手機版) / 星系版面 (桌面版) 共用同一份 enabledModules 設定，
  // 這裡列出全部可以自訂的項目，不只是原本的 4 個 (有些人比較常用的股票，另一些人完全用不到)。
  const labels = { stocks: '📈 股票', finance: '💰 記帳', tasks: '✅ 待辦事項', mood: '💗 心情陪伴', bills: '🧾 帳單提醒', calendar: '📅 行事曆' };
  const modules = Object.keys(labels);
  const enabled = (state.prefs && state.prefs.enabledModules) || {};

  const rows = modules.map((m) => el('div', { class: 'module-toggle-row' }, [
    el('span', {}, labels[m]),
    el('label', { class: 'switch' }, [
      el('input', { type: 'checkbox', checked: enabled[m] !== false, onchange: (ev) => toggleModule(m, ev.target.checked) }),
      el('span', { class: 'slider' }),
    ]),
  ]));
  const themePref = (state.prefs && state.prefs.theme) || 'auto';
  const THEME_OPTIONS = [
    { key: 'light', label: '☀️ 淺色' },
    { key: 'dark', label: '🌙 深色' },
    { key: 'auto', label: '🖥️ 自動 (跟系統)' },
  ];
  c.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, '🎨 外觀'),
    el('p', { class: 'hint' }, '選「自動」的話，會跟著手機/電腦目前的深色模式設定即時切換；選淺色或深色則固定用那個模式，不受系統設定影響。'),
    el('div', { class: 'feedback-cat-row' }, THEME_OPTIONS.map((t) =>
      el('button', {
        class: 'feedback-cat-btn' + (t.key === themePref ? ' active' : ''),
        onclick: () => setThemePref(t.key),
      }, t.label)
    )),
  ]));

  c.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, '首頁模組顯示設定'),
    el('p', { class: 'hint' }, '關閉的項目仍可從選單/底部導覽進入，只是不會出現在首頁摘要或小工具拼貼裡；在首頁按「✏️ 自訂」也可以調整同一份設定。'),
    ...rows,
  ]));

  c.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, '🔔 背景推播通知'),
    el('p', { class: 'hint' }, '開啟後，帳單快到期、預算超支、待辦逾期、好幾天沒記心情這幾類提醒，就算螢幕熄滅或 App 沒開著也能收到系統通知 (跟前面「開啟瀏覽器提醒」的差異：那個只有分頁開著時才有用)。iPhone 需要先把這個網站「加入主畫面」變成 App，且系統版本 iOS 16.4 以上才支援。'),
    el('p', { id: 'pushStatusText', class: 'hint' }, '檢查中...'),
    el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' }, [
      el('button', { id: 'pushToggleBtn', class: 'btn btn-primary', onclick: togglePushSubscription }, '開啟背景推播通知'),
      el('button', { id: 'pushTestBtn', class: 'btn btn-ghost', style: 'display:none', onclick: sendTestPush }, '📨 傳送測試通知'),
    ]),
  ]));
  updatePushStatusUI();

  c.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, '📅 訂閱到手機原生行事曆'),
    el('p', { class: 'hint' }, '產生一組專屬網址，貼到 iPhone「行事曆」App (設定 → 帳號 → 新增訂閱的行事曆) 或 Google 日曆 (透過網址新增)，之後在 LifeHub 新增的行程 (含帳單到期日、待辦截止日、人際關係重要日子) 會自動同步過去，不用兩邊各記一次。這組網址知道的人就能看到你的行程標題，請不要分享給不信任的人；想收回就按「停用」重新產生一組新的。'),
    el('div', { id: 'icsUrlBox', class: 'hint' }, '檢查中...'),
    el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;margin-top:8px' }, [
      el('button', { id: 'icsGenBtn', class: 'btn btn-primary', onclick: generateIcsToken }, '產生訂閱網址'),
      el('button', { id: 'icsCopyBtn', class: 'btn btn-ghost', style: 'display:none', onclick: copyIcsUrl }, '📋 複製網址'),
      el('button', { id: 'icsRevokeBtn', class: 'btn btn-ghost', style: 'display:none', onclick: revokeIcsToken }, '停用'),
    ]),
  ]));
  loadIcsTokenStatus();

  c.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, '🔑 帳號安全'),
    el('p', { class: 'hint' }, '忘記密碼時可以用 email + 備用重設碼自己重設密碼，不用等人幫忙。如果是這次更新之前就註冊的帳號，或是重設碼已經用掉／忘記存在哪，按下面按鈕就能拿到一組新的 (舊的會失效)。'),
    el('button', { class: 'btn btn-primary', onclick: regenerateRecoveryCode }, '重新產生備用重設碼'),
  ]));

  c.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, '📦 資料匯出／備份'),
    el('p', { class: 'hint' }, '把股票自選、日記、記帳、行事曆、心情陪伴（含安心小卡、思考記錄）等全部模組的資料，打包成一份 JSON 檔下載下來，可以自己留一份備份，或之後想搬到別的地方使用。'),
    el('button', { class: 'btn btn-primary', onclick: exportAllData }, '匯出全部資料'),
  ]));

  // 只有管理者帳號 (見伺服器 src/services/admin.js 的 ADMIN_EMAIL) 登入時才看得到，
  // 其他使用者連這個卡片本身都不會出現，不是「看得到但打不開」。
  if (state.user && state.user.isAdmin) {
    const feedbackCard = el('div', { class: 'card' }, [
      el('h3', {}, '📨 所有回饋'),
      el('p', { class: 'hint' }, '使用者從右上角 💬 按鈕送出的意見回饋，只有這個帳號看得到。'),
      el('div', { id: 'adminFeedbackList' }, el('p', { class: 'hint' }, '載入中...')),
    ]);
    c.appendChild(feedbackCard);
    loadAdminFeedbackList();
  }
}
async function loadAdminFeedbackList() {
  const listEl = $('#adminFeedbackList');
  if (!listEl) return;
  try {
    const { items } = await api('/feedback');
    listEl.innerHTML = '';
    if (!items.length) {
      listEl.appendChild(el('p', { class: 'hint' }, '目前還沒有人送出回饋。'));
      return;
    }
    const catLabels = { bug: '🐛 問題回報', suggestion: '💡 建議', other: '💬 其他' };
    items.forEach((f) => {
      const t = new Date(f.created_at);
      const timeLabel = isNaN(t.getTime()) ? f.created_at : t.toLocaleString('zh-Hant-TW');
      listEl.appendChild(el('div', { class: 'feedback-item' }, [
        el('div', { class: 'feedback-item-meta' }, [
          el('span', { class: 'feedback-item-cat' }, catLabels[f.category] || f.category),
          el('span', { class: 'feedback-item-user' }, `${f.user_name} (${f.user_email})`),
          el('span', { class: 'feedback-item-time' }, timeLabel),
          el('button', { class: 'feedback-item-del', title: '刪除這筆回饋', onclick: () => deleteFeedbackItem(f.id) }, '🗑'),
        ]),
        el('div', { class: 'feedback-item-msg' }, f.message),
      ]));
    });
  } catch (e) {
    listEl.innerHTML = '';
    listEl.appendChild(el('p', { class: 'hint' }, '載入回饋失敗：' + e.message));
  }
}
async function deleteFeedbackItem(id) {
  try {
    await api(`/feedback/${id}`, { method: 'DELETE' });
    showToast('已刪除這筆回饋');
    loadAdminFeedbackList();
  } catch (e) {
    showToast('刪除失敗：' + e.message);
  }
}
function exportAllData() {
  window.open('/api/export/all', '_blank');
}
async function regenerateRecoveryCode() {
  try {
    const { recoveryCode } = await api('/auth/recovery-code', { method: 'POST' });
    showRecoveryCodeModal(recoveryCode, false);
  } catch (e) { showToast(e.message || '產生失敗'); }
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
