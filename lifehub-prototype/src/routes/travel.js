const { Router } = require('../mini-http');
const tdx = require('../services/tdx');
const flights = require('../services/flights');
const itinerary = require('../services/itinerary');
const deeplinks = require('../services/deeplinks');
const { getDb } = require('../services/db');
const { requireAuth } = require('../middleware/auth');
const logger = require('../services/logger');

const router = Router();

router.get('/train/:mode/board', requireAuth, async (req, res) => {
  const mode = req.params.mode === 'thsr' ? 'THSR' : 'TRA';
  const station = req.query.station;
  if (!station) return res.status(400).json({ error: '請提供 station 車站名稱' });
  try {
    const data = await tdx.getRealtimeBoard(mode, station, {
      to: req.query.to,
      date: req.query.date,
      timeFrom: req.query.timeFrom,
      timeTo: req.query.timeTo,
      trainNo: req.query.trainNo,
    });
    res.json(data);
  } catch (e) {
    logger.error('取得交通即時資料失敗', { error: e.message });
    res.status(502).json({ error: '交通資料取得失敗', detail: e.message });
  }
});

// ---- 收藏車次 ----
router.get('/train/favorites', requireAuth, (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM favorite_trains WHERE user_id = ? ORDER BY created_at DESC').all(req.session.userId));
});

router.post('/train/favorites', requireAuth, (req, res) => {
  const { mode, trainNo, fromStation, toStation, departureTime, note } = req.body || {};
  if (!mode || !trainNo || !fromStation) return res.status(400).json({ error: '缺少必要欄位 (mode/trainNo/fromStation)' });
  const db = getDb();
  try {
    const info = db
      .prepare(
        `INSERT INTO favorite_trains (user_id, mode, train_no, from_station, to_station, departure_time, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(req.session.userId, mode, trainNo, fromStation, toStation || null, departureTime || null, note || null, new Date().toISOString());
    res.json({ id: info.lastInsertRowid });
  } catch (e) {
    res.status(409).json({ error: '這個車次已經收藏過了' });
  }
});

router.delete('/train/favorites/:id', requireAuth, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM favorite_trains WHERE id = ? AND user_id = ?').run(req.params.id, req.session.userId);
  res.json({ ok: true });
});

// ---- 機票/訂房各家深連結 ----
router.get('/flights/providers', requireAuth, (req, res) => {
  const { from, to, date } = req.query;
  if (!from || !to) return res.status(400).json({ error: '請提供 from / to' });
  res.json({ from, to, date, providers: deeplinks.flightProviders(from, to, date) });
});

router.get('/hotels/providers', requireAuth, (req, res) => {
  const { city, checkin, checkout } = req.query;
  if (!city) return res.status(400).json({ error: '請提供 city' });
  res.json({ city, checkin, checkout, providers: deeplinks.hotelProviders(city, checkin, checkout) });
});

// 保留舊的示範比價端點 (向下相容)
router.get('/flights/bundle', requireAuth, async (req, res) => {
  const { from, to, date } = req.query;
  if (!from || !to) return res.status(400).json({ error: '請提供 from / to' });
  const data = await flights.getCheapestBundle(from, to, date || new Date().toISOString().slice(0, 10));
  res.json(data);
});

router.post('/itinerary', requireAuth, (req, res) => {
  const { from, to, days } = req.body || {};
  if (!from || !to) return res.status(400).json({ error: '請提供 from / to' });
  res.json(itinerary.generate(from, to, days));
});

module.exports = router;
