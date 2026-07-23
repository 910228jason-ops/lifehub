// 台股資料服務
// 資料來源皆為「公開、免申請金鑰」的官方/準官方資料源：
//   1. 上市個股每日收盤行情：openapi.twse.com.tw (臺灣證券交易所 OpenAPI，官方)
//   2. 三大法人買賣超：www.twse.com.tw/rwd/zh/fund/T86 (證交所網站資料，業界廣泛使用)
// 限制：以上兩者都是「每日盤後」更新一次(通常約下午2:30~4點後才有當日資料)，
// 並非逐筆撮合的「盤中即時」報價。若要真正的盤中即時報價，需要額外申請
// 券商/資訊供應商的「即時報價授權」(通常需付費且需簽署合約)，本原型先以
// 「每日資料 + 明確標示更新時間」的方式呈現，避免誤導使用者以為是逐秒跳動的報價。

// 使用 Node.js 18+ 內建的全域 fetch()，不依賴 node-fetch 套件。
const logger = require('./logger');

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 分鐘快取，避免對證交所頻繁請求
const cache = new Map();

async function fetchWithTimeout(url, opts = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function cachedFetchJson(url) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

  const res = await fetchWithTimeout(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (LifeHub prototype; contact: user)' },
  });
  if (!res.ok) throw new Error(`TWSE 回應錯誤: HTTP ${res.status}`);
  const data = await res.json();
  cache.set(url, { data, at: Date.now() });
  return data;
}

// 全上市股票每日收盤資料 (欄位: Code, Name, ClosingPrice, Change, TradeVolume ...)
async function getAllDailyQuotes() {
  const url = 'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL';
  return cachedFetchJson(url);
}

async function getQuote(code) {
  const all = await getAllDailyQuotes();
  const row = all.find((r) => r.Code === code);
  if (!row) return null;
  return {
    code: row.Code,
    name: row.Name,
    closingPrice: Number(row.ClosingPrice) || null,
    change: Number(row.Change) || 0,
    openingPrice: Number(row.OpeningPrice) || null,
    highestPrice: Number(row.HighestPrice) || null,
    lowestPrice: Number(row.LowestPrice) || null,
    tradeVolume: Number(row.TradeVolume) || 0,
    date: row.Date,
  };
}

// 三大法人買賣超 (指定日期，格式 YYYYMMDD；不帶日期則為最近一個交易日)
// 除了三大法人「合計」，也拆解出 外資(外陸資)/投信/自營商 三個分項，
// 這樣前端可以像 Yahoo 股市一樣顯示「今天是誰在買、誰在賣」。
async function getInstitutionalDaily(dateStr) {
  const url = dateStr
    ? `https://www.twse.com.tw/rwd/zh/fund/T86?date=${dateStr}&selectType=ALL&response=json`
    : `https://www.twse.com.tw/rwd/zh/fund/T86?selectType=ALL&response=json`;
  const json = await cachedFetchJson(url);
  if (!json || !json.data) return { date: dateStr || null, rows: [] };

  // fields 順序依證交所回傳為準，這裡用 fields 陣列動態對應，避免欄位順序改變時程式壞掉
  const fields = json.fields || [];
  const idx = (name) => fields.indexOf(name);
  const codeIdx = idx('證券代號');
  const nameIdx = idx('證券名稱');
  const totalIdx = fields.findIndex((f) => f.includes('三大法人買賣超股數'));
  const foreignIdx = fields.findIndex((f) => f.includes('外陸資買賣超股數')); // 不含外資自營商
  const trustIdx = idx('投信買賣超股數');
  const dealerIdx = idx('自營商買賣超股數'); // 合計欄 (自行買賣+避險)

  const num = (v) => Number(String(v ?? '0').replace(/,/g, '')) || 0;
  const rows = (json.data || []).map((r) => ({
    code: r[codeIdx],
    name: r[nameIdx],
    netBuySell: num(r[totalIdx]),
    foreign: foreignIdx >= 0 ? num(r[foreignIdx]) : null,
    trust: trustIdx >= 0 ? num(r[trustIdx]) : null,
    dealer: dealerIdx >= 0 ? num(r[dealerIdx]) : null,
  }));
  return { date: json.date || dateStr || null, rows };
}

async function getInstitutionalForStock(code) {
  const { date, rows } = await getInstitutionalDaily();
  const row = rows.find((r) => r.code === code);
  return { date, netBuySell: row ? row.netBuySell : 0, name: row ? row.name : null };
}

// 取得近 N 個交易日的法人買賣超趨勢 (逐日呼叫官方資料，日期用簡單往回推且跳過週末；
// 假日/未開市的日期證交所會回傳空資料，這裡直接忽略即可)
async function getInstitutionalTrend(code, days = 10) {
  const results = [];
  let d = new Date();
  let guard = 0;
  while (results.length < days && guard < days * 3) {
    guard++;
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) {
      const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(
        d.getDate()
      ).padStart(2, '0')}`;
      try {
        const { rows, date } = await getInstitutionalDaily(dateStr);
        const row = rows.find((r) => r.code === code);
        if (row) results.unshift({ date: date || dateStr, netBuySell: row.netBuySell, foreign: row.foreign, trust: row.trust, dealer: row.dealer });
      } catch (e) {
        logger.warn('取得法人趨勢單日資料失敗', { dateStr, error: e.message });
      }
    }
    d.setDate(d.getDate() - 1);
  }
  return results;
}

// 規則式「參考訊號」— 明確聲明僅供參考，非投資建議
function computeSignal(trend) {
  if (!trend || trend.length < 3) return { label: '資料不足', detail: '', tone: 'neutral' };
  const last3 = trend.slice(-3);
  const sumLast3 = last3.reduce((s, t) => s + t.netBuySell, 0);
  const increasing = last3.every((t, i) => i === 0 || t.netBuySell >= last3[i - 1].netBuySell);

  if (sumLast3 > 0 && increasing) {
    return { label: '法人買超轉強(僅供參考)', detail: `近3日合計買超 ${sumLast3.toLocaleString()} 股，且逐日增加`, tone: 'positive' };
  }
  if (sumLast3 < 0) {
    return { label: '法人賣超(僅供參考)', detail: `近3日合計賣超 ${Math.abs(sumLast3).toLocaleString()} 股`, tone: 'negative' };
  }
  return { label: '法人動向不明顯', detail: `近3日合計 ${sumLast3.toLocaleString()} 股`, tone: 'neutral' };
}

// 單一個股「當月」歷史每日收盤價 (證交所官方端點，公開免金鑰)。
// monthsBack=0 為當月，1 為上個月，以此類推；用來湊出足夠天數計算均線。
async function getStockHistoryMonth(code, monthsBack = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsBack, 1);
  const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}01`;
  const url = `https://www.twse.com.tw/exchangeReport/STOCK_DAY?date=${dateStr}&stockNo=${code}&response=json`;
  const json = await cachedFetchJson(url);
  if (!json || !Array.isArray(json.data)) return [];
  // 欄位固定為：日期,成交股數,成交金額,開盤價,最高價,最低價,收盤價,漲跌價差,成交筆數
  return json.data.map((r) => ({
    date: r[0],
    closingPrice: Number(String(r[6]).replace(/,/g, '')) || null,
  })).filter((r) => r.closingPrice != null);
}

// 取得近 2 個月的歷史收盤價 (當月資料不足時會自動往前抓上個月，湊足算均線用的天數)
async function getStockHistory(code) {
  const [thisMonth, lastMonth] = await Promise.all([
    getStockHistoryMonth(code, 0).catch(() => []),
    getStockHistoryMonth(code, 1).catch(() => []),
  ]);
  return [...lastMonth, ...thisMonth];
}

// 均線趨勢 — 這是「描述性統計指標」，不是價格預測。MA5(近5日均價) 相對 MA20(近20日均價)
// 的位置只能說明「近期價格相對於較長期平均是偏強還是偏弱」，不代表未來漲跌，
// 所有文字都刻意避免使用「預測」、「將會」等字眼。
function computeMovingAverageTrend(history) {
  if (!history || history.length < 20) {
    return { available: false, reason: '歷史資料不足 20 個交易日，無法計算均線' };
  }
  const closes = history.map((h) => h.closingPrice);
  const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const ma5 = avg(closes.slice(-5));
  const ma20 = avg(closes.slice(-20));
  const diffPct = ((ma5 - ma20) / ma20) * 100;
  let label, tone;
  if (diffPct > 1) { label = '短期均線在長期均線之上 (偏強)'; tone = 'positive'; }
  else if (diffPct < -1) { label = '短期均線在長期均線之下 (偏弱)'; tone = 'negative'; }
  else { label = '短期與長期均線接近 (盤整)'; tone = 'neutral'; }
  return {
    available: true,
    ma5: Math.round(ma5 * 100) / 100,
    ma20: Math.round(ma20 * 100) / 100,
    diffPct: Math.round(diffPct * 100) / 100,
    label, tone,
    disclaimer: '均線是描述「近期價格相對位置」的統計指標，不是未來走勢預測，過去表現不代表未來結果。',
  };
}

// 個股估值資訊：本益比 / 殖利率 / 股價淨值比 (證交所官方 OpenAPI，公開免金鑰，每日盤後更新)
async function getValuation(code) {
  const url = 'https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_ALL';
  const all = await cachedFetchJson(url);
  const row = (all || []).find((r) => r.Code === code);
  if (!row) return null;
  return {
    code: row.Code,
    name: row.Name,
    peRatio: Number(row.PEratio) || null,          // 本益比
    dividendYield: Number(row.DividendYield) || null, // 殖利率(%)
    pbRatio: Number(row.PBratio) || null,          // 股價淨值比
  };
}

// 台股加權指數 (大盤/台指)：證交所官方「市場成交資訊」，含每日收盤指數與漲跌點數
async function getTaiex() {
  const url = 'https://openapi.twse.com.tw/v1/exchangeReport/FMTQIK';
  const all = await cachedFetchJson(url);
  if (!Array.isArray(all) || !all.length) throw new Error('加權指數資料格式不如預期');
  const last = all[all.length - 1];
  const prev = all.length > 1 ? all[all.length - 2] : null;
  const num = (v) => Number(String(v ?? '').replace(/,/g, '')) || null;
  const index = num(last.TAIEX);
  const prevIndex = prev ? num(prev.TAIEX) : null;
  return {
    symbol: '台股加權指數 (TAIEX)',
    date: last.Date,
    index,
    change: index != null && prevIndex != null ? Math.round((index - prevIndex) * 100) / 100 : num(last.Change),
    tradeValue: num(last.TradeValue), // 當日成交金額(元)
  };
}

// 近 40 個交易日收盤價 + 每日滾動 MA5/MA20，給前端畫「股價走勢 + 均線」圖用
async function getHistoryWithMA(code) {
  const history = await getStockHistory(code);
  const points = history.map((h, i) => {
    const win5 = history.slice(Math.max(0, i - 4), i + 1);
    const win20 = history.slice(Math.max(0, i - 19), i + 1);
    const avg = (arr) => Math.round((arr.reduce((s, x) => s + x.closingPrice, 0) / arr.length) * 100) / 100;
    return {
      date: h.date,
      close: h.closingPrice,
      ma5: win5.length === 5 ? avg(win5) : null,
      ma20: win20.length === 20 ? avg(win20) : null,
    };
  });
  return points.slice(-40);
}

async function healthcheck() {
  try {
    const all = await getAllDailyQuotes();
    return { ok: true, sampleCount: Array.isArray(all) ? all.length : 0 };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = {
  getAllDailyQuotes,
  getQuote,
  getInstitutionalDaily,
  getInstitutionalForStock,
  getInstitutionalTrend,
  computeSignal,
  getStockHistory,
  computeMovingAverageTrend,
  getValuation,
  getTaiex,
  getHistoryWithMA,
  healthcheck,
};
