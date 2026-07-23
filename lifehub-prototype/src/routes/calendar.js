const { Router } = require('../mini-http');
const { getDb } = require('../services/db');
const { requireAuth } = require('../middleware/auth');

const router = Router();

router.get('/', requireAuth, (req, res) => {
  const db = getDb();
  const { from, to } = req.query;
  let rows;
  if (from && to) {
    rows = db
      .prepare('SELECT * FROM calendar_events WHERE user_id = ? AND event_date BETWEEN ? AND ? ORDER BY event_date, start_time')
      .all(req.session.userId, from, to);
  } else {
    rows = db
      .prepare('SELECT * FROM calendar_events WHERE user_id = ? ORDER BY event_date, start_time LIMIT 200')
      .all(req.session.userId);
  }
  res.json(rows);
});

router.post('/', requireAuth, (req, res) => {
  const { event_date, start_time, title, note } = req.body || {};
  if (!event_date || !title) return res.status(400).json({ error: '缺少必要欄位 (event_date/title)' });
  const db = getDb();
  const now = new Date().toISOString();
  const info = db
    .prepare('INSERT INTO calendar_events (user_id, event_date, start_time, title, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(req.session.userId, event_date, start_time || null, title, note || null, now, now);
  res.json({ id: info.lastInsertRowid });
});

router.put('/:id', requireAuth, (req, res) => {
  const { event_date, start_time, title, note } = req.body || {};
  const db = getDb();
  db.prepare(
    'UPDATE calendar_events SET event_date = ?, start_time = ?, title = ?, note = ?, updated_at = ? WHERE id = ? AND user_id = ?'
  ).run(event_date, start_time || null, title, note || null, new Date().toISOString(), req.params.id, req.session.userId);
  res.json({ ok: true });
});

router.delete('/:id', requireAuth, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM calendar_events WHERE id = ? AND user_id = ?').run(req.params.id, req.session.userId);
  res.json({ ok: true });
});

module.exports = router;
