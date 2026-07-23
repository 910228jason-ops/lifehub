// 股票模組的補充資料：費城半導體指數(SOX)、相關新聞。
//
// 誠實揭露這兩個資料源的性質：
//   - SOX 指數：目前找不到「官方、免費、有正式文件」的即時報價 API。這裡使用的是
//     Yahoo Finance 一個被廣泛使用、但屬於「未公開文件、非正式支援」的查詢端點
//     (很多開源股票工具，例如 Python 的 yfinance，都是用同一個端點)。它今天可用，
//     不代表 Yahoo 保證長期穩定提供，也不是雙方有正式簽約的資料源，未來有可能改版
//     或封鎖，請把它當作「能用就用、壞了要有心理準備」的補充資訊，不是正式資料源。
//     正式上線建議改用有正式文件與 SLA 保證的商業指數資料供應商。
//   - 新聞：使用 Yahoo奇摩股市 官方公開提供的 RSS 訂閱功能 (tw.stock.yahoo.com/rss)，
//     這是 Yahoo 自己在網站上公開說明、供訂閱使用的功能，性質上比 SOX 那個端點正式，
//     但仍請保留原文出處連結，不要整篇轉載內文。

const logger = require('./logger');

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map();

async function fetchWithTimeout(url, opts = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function cached(key, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;
  const data = await fn();
  cache.set(key, { data, at: Date.now() });
  return data;
}

// 費城半導體指數 (SOX) — 非官方端點，失敗時要能優雅降級，不能讓整個股票頁面掛掉
async function getSoxIndex() {
  return cached('sox', async () => {
    const url = 'https://query1.finance.yahoo.com/v8/finance/chart/%5ESOX?interval=1d&range=5d';
    const res = await fetchWithTimeout(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error(`SOX 查詢失敗: HTTP ${res.status}`);
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) throw new Error('SOX 回傳格式不如預期');
    const closes = result.indicators?.quote?.[0]?.close?.filter((v) => v != null) || [];
    const last = closes[closes.length - 1];
    const prev = closes[closes.length - 2];
    return {
      symbol: 'SOX (費城半導體指數)',
      price: last != null ? Math.round(last * 100) / 100 : null,
      change: last != null && prev != null ? Math.round((last - prev) * 100) / 100 : null,
      asOf: new Date((result.meta?.regularMarketTime || Date.now() / 1000) * 1000).toISOString(),
      isUnofficialSource: true,
    };
  });
}

// 新聞 — Yahoo奇摩股市官方 RSS (台股動態分類)，簡易解析 XML
function parseRssItems(xml, limit = 8) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml)) && items.length < limit) {
    const block = m[1];
    const title = (block.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
    const link = (block.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '';
    const pubDate = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '';
    items.push({
      title: title.replace(/<!\[CDATA\[|\]\]>/g, '').trim(),
      link: link.replace(/<!\[CDATA\[|\]\]>/g, '').trim(),
      pubDate,
    });
  }
  return items;
}

async function getMarketNews(keyword) {
  return cached(`news:${keyword || 'all'}`, async () => {
    const url = 'https://tw.stock.yahoo.com/rss?category=tw-market';
    const res = await fetchWithTimeout(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error(`新聞 RSS 取得失敗: HTTP ${res.status}`);
    const xml = await res.text();
    let items = parseRssItems(xml, 20);
    if (keyword) {
      const filtered = items.filter((it) => it.title.includes(keyword));
      items = filtered.length ? filtered : items.slice(0, 5); // 沒有精準符合就退而求其次給大盤新聞
    }
    return items.slice(0, 8);
  });
}

async function healthcheck() {
  const out = {};
  try { await getSoxIndex(); out.sox = { ok: true }; } catch (e) { out.sox = { ok: false, error: e.message }; }
  try { await getMarketNews(); out.news = { ok: true }; } catch (e) { out.news = { ok: false, error: e.message }; }
  return out;
}

module.exports = { getSoxIndex, getMarketNews, healthcheck };
