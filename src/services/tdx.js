// 交通資料服務：串接 TDX (運輸資料流通服務, 交通部) 取得台鐵(TRA) / 高鐵(THSR) 時刻與即時動態。
//
// 重要限制 (務必讓使用者理解)：
//   - TDX 提供的是「時刻表、即時到離站/誤點狀態」等公開運輸資料，屬於免費申請、
//     需要 TDX 會員帳號 + API 金鑰 (Client ID/Secret) 才能呼叫。
//   - TDX **並不提供「訂票、選位、付款」**的功能，這一段目前沒有對一般開發者開放的
//     官方 API。真正的線上訂票，使用者仍需導向台鐵/高鐵官方售票網站或官方 App。
//   - 若沒有在 .env 設定 TDX_CLIENT_ID / TDX_CLIENT_SECRET，本服務會自動改回傳
//     「示範資料」，並在資料中標記 isDemo: true，前端會用明顯的樣式提示使用者。
//
// 機票的即時時刻/比價目前沒有免費、完整、穩定的公開 API，正式上線需另外申請
// 商業合作 (如 Amadeus for Developers)，架構已預留 FLIGHT_API_* 設定，見 travel.js。

// 使用 Node.js 18+ 內建的全域 fetch()，不依賴 node-fetch 套件。
const logger = require('./logger');

const TOKEN_URL =
  'https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token';
const TRA_BASE = 'https://tdx.transportdata.tw/api/basic/v3/Rail/TRA';
const THSR_BASE = 'https://tdx.transportdata.tw/api/basic/v3/Rail/THSR';

let tokenCache = { token: null, expireAt: 0 };

function isConfigured() {
  return Boolean(process.env.TDX_CLIENT_ID && process.env.TDX_CLIENT_SECRET);
}

async function fetchWithTimeout(url, opts = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function getToken() {
  if (tokenCache.token && Date.now() < tokenCache.expireAt - 60_000) return tokenCache.token;

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: process.env.TDX_CLIENT_ID,
    client_secret: process.env.TDX_CLIENT_SECRET,
  });
  const res = await fetchWithTimeout(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`TDX 取得 token 失敗: HTTP ${res.status}`);
  const json = await res.json();
  tokenCache = {
    token: json.access_token,
    expireAt: Date.now() + (json.expires_in || 86400) * 1000,
  };
  return tokenCache.token;
}

async function tdxGet(path) {
  const token = await getToken();
  const res = await fetchWithTimeout(`${path}${path.includes('?') ? '&' : '?'}$format=JSON`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`TDX API 錯誤: HTTP ${res.status} (${path})`);
  return res.json();
}

// 產生一整天(06:00~22:00)的示範班次，每班次間隔依模式不同 (高鐵較密集/台鐵較疏)，
// 並依 from/to 站名算一個「看起來合理」的行車時間與票價區間 (票價僅供參考，
// 實際請以官方訂票網站/官方 App 顯示金額為準，示範資料不代表真實票價)。
function seededRand(seed) {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}
function demoSchedule(mode, from, to, opts = {}) {
  const rand = seededRand((from + to).split('').reduce((a, c) => a + c.charCodeAt(0), 0) || 1);
  const intervalMin = mode === 'THSR' ? 40 : 55;
  const durationMin = mode === 'THSR' ? 60 + Math.round(rand() * 40) : 120 + Math.round(rand() * 90);
  const fareBase = mode === 'THSR' ? 700 : 300;
  const fare = fareBase + Math.round(rand() * fareBase * 0.6);

  const date = opts.date || todayISO();
  const trains = [];
  let idCounter = mode === 'THSR' ? 601 : 100;
  for (let mins = 6 * 60; mins <= 22 * 60; mins += intervalMin) {
    const depH = String(Math.floor(mins / 60)).padStart(2, '0');
    const depM = String(mins % 60).padStart(2, '0');
    const arrMins = mins + durationMin;
    const arrH = String(Math.floor(arrMins / 60) % 24).padStart(2, '0');
    const arrM = String(arrMins % 60).padStart(2, '0');
    trains.push({
      trainNo: String(idCounter++),
      from, to,
      date,
      departure: `${depH}:${depM}`,
      arrival: `${arrH}:${arrM}`,
      durationMin,
      fare,
      status: rand() > 0.92 ? '誤點約5分' : '準點',
      isDemo: true,
    });
  }

  let filtered = trains;
  if (opts.timeFrom) filtered = filtered.filter((t) => t.departure >= opts.timeFrom);
  if (opts.timeTo) filtered = filtered.filter((t) => t.departure <= opts.timeTo);
  if (opts.trainNo) filtered = filtered.filter((t) => t.trainNo.includes(opts.trainNo));

  return {
    mode, from, to, date,
    isDemo: true,
    notice: '未設定 TDX 金鑰，以下為示範資料 (含推估票價)，非即時真實班次與真實票價。請於 .env 設定 TDX_CLIENT_ID/SECRET 以啟用真實資料。',
    trains: filtered.slice(0, 30),
  };
}
function todayISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

// 取得台鐵/高鐵時刻查詢，opts: { to, date, timeFrom, timeTo, trainNo }
// stationName 為出發站名(中文)；opts.to 為目的地站名(選填，示範資料模式下用來估算行車時間/票價)
async function getRealtimeBoard(mode, stationName, opts = {}) {
  if (!isConfigured()) return demoSchedule(mode, stationName, opts.to || '', opts);

  try {
    if (mode === 'THSR') {
      const data = await tdxGet(
        `${THSR_BASE}/DailyTimetable/Today?$filter=contains(StartingStationName/Zh_tw,'${stationName}')`
      );
      return { mode, isDemo: false, raw: data };
    }
    const data = await tdxGet(
      `${TRA_BASE}/DailyTrainTimetable/Today?$filter=contains(StationName/Zh_tw,'${stationName}')`
    );
    return { mode, isDemo: false, raw: data };
  } catch (e) {
    logger.warn('TDX 即時資料取得失敗，改用示範資料', { mode, stationName, error: e.message });
    return demoSchedule(mode, stationName, opts.to || '', opts);
  }
}

async function healthcheck() {
  if (!isConfigured()) return { ok: false, reason: '未設定 TDX_CLIENT_ID / TDX_CLIENT_SECRET (使用示範資料)' };
  try {
    await getToken();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = { isConfigured, getRealtimeBoard, healthcheck };
