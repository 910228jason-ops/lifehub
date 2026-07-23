const { Router } = require('../mini-http');
const twse = require('../services/twse');
const marketExtras = require('../services/marketExtras');
const { requireAuth } = require('../middleware/auth');
const logger = require('../services/logger');

const router = Router();

router.get('/quote/:code', requireAuth, async (req, res) => {
  try {
    const quote = await twse.getQuote(req.params.code);
    if (!quote) return res.status(404).json({ error: '查無此股票代號 (僅涵蓋上市個股)' });
    res.json(quote);
  } catch (e) {
    logger.error('取得股價失敗', { error: e.message });
    res.status(502).json({ error: '目前無法取得證交所資料，請稍後再試', detail: e.message });
  }
});

router.get('/institutional/:code', requireAuth, async (req, res) => {
  try {
    const days = Math.min(30, Number(req.query.days) || 10);
    const trend = await twse.getInstitutionalTrend(req.params.code, days);
    const signal = twse.computeSignal(trend);
    res.json({ code: req.params.code, trend, signal, disclaimer: '本資訊僅整理公開法人買賣超資料，屬統計參考，不構成投資建議。' });
  } catch (e) {
    logger.error('取得法人買賣超失敗', { error: e.message });
    res.status(502).json({ error: '目前無法取得法人買賣超資料，請稍後再試', detail: e.message });
  }
});

// 均線描述性指標 (非預測) — 見 twse.js 註解說明為什麼不做「未來走勢預測」
router.get('/indicator/:code', requireAuth, async (req, res) => {
  try {
    const history = await twse.getStockHistory(req.params.code);
    const indicator = twse.computeMovingAverageTrend(history);
    res.json({ code: req.params.code, historyPoints: history.length, indicator });
  } catch (e) {
    logger.error('取得均線指標失敗', { error: e.message });
    res.status(502).json({ error: '目前無法取得歷史股價資料，請稍後再試', detail: e.message });
  }
});

// 個股估值 (本益比/殖利率/股價淨值比) — 證交所官方 OpenAPI
router.get('/valuation/:code', requireAuth, async (req, res) => {
  try {
    const v = await twse.getValuation(req.params.code);
    if (!v) return res.status(404).json({ error: '查無此股票的估值資料' });
    res.json(v);
  } catch (e) {
    logger.error('取得估值資料失敗', { error: e.message });
    res.status(502).json({ error: '目前無法取得估值資料，請稍後再試', detail: e.message });
  }
});

// 近 40 個交易日收盤價 + MA5/MA20 (畫走勢圖用)
router.get('/history/:code', requireAuth, async (req, res) => {
  try {
    const points = await twse.getHistoryWithMA(req.params.code);
    res.json({ code: req.params.code, points });
  } catch (e) {
    logger.error('取得歷史股價失敗', { error: e.message });
    res.status(502).json({ error: '目前無法取得歷史股價資料，請稍後再試', detail: e.message });
  }
});

// 台股加權指數 (大盤) — 證交所官方 OpenAPI
router.get('/index/taiex', requireAuth, async (req, res) => {
  try {
    res.json(await twse.getTaiex());
  } catch (e) {
    res.status(502).json({ error: '目前無法取得加權指數資料，請稍後再試', detail: e.message });
  }
});

// 費城半導體指數 (SOX) — 非官方資料源，見 marketExtras.js 註解
router.get('/index/sox', requireAuth, async (req, res) => {
  try {
    res.json(await marketExtras.getSoxIndex());
  } catch (e) {
    res.status(502).json({ error: '目前無法取得 SOX 指數資料 (非官方資料源，可能暫時失效)', detail: e.message });
  }
});

// 相關新聞 (Yahoo奇摩股市官方 RSS)
router.get('/news/:code', requireAuth, async (req, res) => {
  try {
    const quote = await twse.getQuote(req.params.code).catch(() => null);
    const keyword = quote ? quote.name : null;
    const items = await marketExtras.getMarketNews(keyword);
    res.json({ code: req.params.code, keyword, items });
  } catch (e) {
    res.status(502).json({ error: '目前無法取得新聞資料', detail: e.message });
  }
});

module.exports = router;
