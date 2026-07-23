const { Router } = require('../mini-http');
const { getDb } = require('../services/db');
const { requireAuth } = require('../middleware/auth');

const router = Router();

router.get('/transactions', requireAuth, (req, res) => {
  const db = getDb();
  const { month } = req.query; // YYYY-MM
  let rows;
  if (month) {
    rows = db
      .prepare(`SELECT * FROM finance_transactions WHERE user_id = ? AND tx_date LIKE ? ORDER BY tx_date DESC, id DESC`)
      .all(req.session.userId, `${month}%`);
  } else {
    rows = db
      .prepare(`SELECT * FROM finance_transactions WHERE user_id = ? ORDER BY tx_date DESC, id DESC LIMIT 200`)
      .all(req.session.userId);
  }
  res.json(rows);
});

router.post('/transactions', requireAuth, (req, res) => {
  const { tx_date, type, category, amount, note } = req.body || {};
  if (!tx_date || !type || !category || amount === undefined) {
    return res.status(400).json({ error: '缺少必要欄位 (日期/類型/分類/金額)' });
  }
  if (!['income', 'expense'].includes(type)) return res.status(400).json({ error: 'type 必須是 income 或 expense' });

  const db = getDb();
  const info = db
    .prepare(
      'INSERT INTO finance_transactions (user_id, tx_date, type, category, amount, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .run(req.session.userId, tx_date, type, category, Number(amount), note || null, new Date().toISOString());
  res.json({ id: info.lastInsertRowid });
});

router.delete('/transactions/:id', requireAuth, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM finance_transactions WHERE id = ? AND user_id = ?').run(req.params.id, req.session.userId);
  res.json({ ok: true });
});

router.get('/summary', requireAuth, (req, res) => {
  const { month } = req.query;
  const db = getDb();
  const like = month ? `${month}%` : `${new Date().toISOString().slice(0, 7)}%`;

  const byCategory = db
    .prepare(
      `SELECT category, type, SUM(amount) as total FROM finance_transactions
       WHERE user_id = ? AND tx_date LIKE ? GROUP BY category, type ORDER BY total DESC`
    )
    .all(req.session.userId, like);

  const totals = db
    .prepare(
      `SELECT type, SUM(amount) as total FROM finance_transactions WHERE user_id = ? AND tx_date LIKE ? GROUP BY type`
    )
    .all(req.session.userId, like);

  const monthlyTrend = db
    .prepare(
      `SELECT substr(tx_date,1,7) as ym, type, SUM(amount) as total FROM finance_transactions
       WHERE user_id = ? GROUP BY ym, type ORDER BY ym DESC LIMIT 12`
    )
    .all(req.session.userId);

  res.json({ month: like.replace('%', ''), byCategory, totals, monthlyTrend: monthlyTrend.reverse() });
});

router.get('/budgets', requireAuth, (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM finance_budgets WHERE user_id = ?').all(req.session.userId));
});

router.put('/budgets/:category', requireAuth, (req, res) => {
  const { monthly_limit } = req.body || {};
  const db = getDb();
  const existing = db
    .prepare('SELECT id FROM finance_budgets WHERE user_id = ? AND category = ?')
    .get(req.session.userId, req.params.category);
  if (existing) {
    db.prepare('UPDATE finance_budgets SET monthly_limit = ? WHERE id = ?').run(Number(monthly_limit), existing.id);
  } else {
    db.prepare('INSERT INTO finance_budgets (user_id, category, monthly_limit) VALUES (?, ?, ?)').run(
      req.session.userId,
      req.params.category,
      Number(monthly_limit)
    );
  }
  res.json({ ok: true });
});

module.exports = router;
