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
      .prepare('SELECT * FROM diary_entries WHERE user_id = ? AND entry_date BETWEEN ? AND ? ORDER BY entry_date DESC')
      .all(req.session.userId, from, to);
  } else {
    rows = db
      .prepare('SELECT * FROM diary_entries WHERE user_id = ? ORDER BY entry_date DESC LIMIT 100')
      .all(req.session.userId);
  }
  res.json(rows);
});

router.get('/:date', requireAuth, (req, res) => {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM diary_entries WHERE user_id = ? AND entry_date = ?')
    .get(req.session.userId, req.params.date);
  res.json(row || null);
});

router.put('/:date', requireAuth, (req, res) => {
  const { content, mood } = req.body || {};
  const db = getDb();
  const now = new Date().toISOString();
  const existing = db
    .prepare('SELECT id FROM diary_entries WHERE user_id = ? AND entry_date = ?')
    .get(req.session.userId, req.params.date);

  if (existing) {
    db.prepare('UPDATE diary_entries SET content = ?, mood = ?, updated_at = ? WHERE id = ?').run(
      content || '',
      mood || null,
      now,
      existing.id
    );
  } else {
    db.prepare(
      'INSERT INTO diary_entries (user_id, entry_date, content, mood, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(req.session.userId, req.params.date, content || '', mood || null, now, now);
  }
  res.json({ ok: true });
});

router.delete('/:date', requireAuth, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM diary_entries WHERE user_id = ? AND entry_date = ?').run(
    req.session.userId,
    req.params.date
  );
  res.json({ ok: true });
});

// 從本機文字檔匯入日記 (前端以 <input type="file"> 讀取內容後以純文字 POST 上來，
// 這裡只負責寫入指定日期，避免在伺服器端直接存取使用者電腦檔案系統)
router.post('/import', requireAuth, (req, res) => {
  const { date, content } = req.body || {};
  if (!date || typeof content !== 'string') return res.status(400).json({ error: '缺少 date 或 content' });
  const db = getDb();
  const now = new Date().toISOString();
  const existing = db
    .prepare('SELECT id FROM diary_entries WHERE user_id = ? AND entry_date = ?')
    .get(req.session.userId, date);
  if (existing) {
    db.prepare('UPDATE diary_entries SET content = ?, updated_at = ? WHERE id = ?').run(content, now, existing.id);
  } else {
    db.prepare(
      'INSERT INTO diary_entries (user_id, entry_date, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).run(req.session.userId, date, content, now, now);
  }
  res.json({ ok: true });
});

module.exports = router;
