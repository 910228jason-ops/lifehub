const { Router } = require('../mini-http');
const { hashPassword, verifyPassword } = require('../services/passwords');
const { getDb } = require('../services/db');
const logger = require('../services/logger');

const router = Router();

router.post('/register', (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: '請輸入 email 與密碼' });
  if (String(password).length < 6) return res.status(400).json({ error: '密碼至少需 6 碼' });

  const db = getDb();
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) return res.status(409).json({ error: '此 email 已被註冊' });

  const hash = hashPassword(password);
  const now = new Date().toISOString();
  const info = db
    .prepare('INSERT INTO users (email, password_hash, name, created_at) VALUES (?, ?, ?, ?)')
    .run(email, hash, name || email.split('@')[0], now);

  db.prepare('INSERT INTO user_prefs (user_id) VALUES (?)').run(info.lastInsertRowid);

  req.session.userId = info.lastInsertRowid;
  logger.info('新使用者註冊', { userId: info.lastInsertRowid });
  res.json({ id: info.lastInsertRowid, email, name: name || email.split('@')[0] });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !verifyPassword(password || '', user.password_hash)) {
    return res.status(401).json({ error: 'email 或密碼錯誤' });
  }
  req.session.userId = user.id;
  res.json({ id: user.id, email: user.email, name: user.name });
});

router.post('/logout', (req, res) => {
  req.session = null;
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  if (!req.session || !req.session.userId) return res.json({ user: null });
  const db = getDb();
  const user = db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(req.session.userId);
  res.json({ user: user || null });
});

module.exports = router;
