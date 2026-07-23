const { Router } = require('../mini-http');
const { getDb } = require('../services/db');
const { requireAuth } = require('../middleware/auth');

const router = Router();

router.get('/', requireAuth, (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM user_prefs WHERE user_id = ?').get(req.session.userId);
  if (!row) return res.json({ moduleOrder: ['stocks', 'travel', 'diary', 'finance'], enabledModules: {}, watchlist: [] });
  res.json({
    moduleOrder: JSON.parse(row.module_order_json),
    enabledModules: JSON.parse(row.enabled_modules_json),
    watchlist: JSON.parse(row.watchlist_json),
    theme: row.theme,
  });
});

router.put('/', requireAuth, (req, res) => {
  const { moduleOrder, enabledModules, watchlist, theme } = req.body || {};
  const db = getDb();
  db.prepare(
    `UPDATE user_prefs SET module_order_json = ?, enabled_modules_json = ?, watchlist_json = ?, theme = ? WHERE user_id = ?`
  ).run(
    JSON.stringify(moduleOrder || []),
    JSON.stringify(enabledModules || {}),
    JSON.stringify(watchlist || []),
    theme || 'light',
    req.session.userId
  );
  res.json({ ok: true });
});

module.exports = router;
