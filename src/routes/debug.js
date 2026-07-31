// /api/debug 與 /api/health
// 目的：讓「以後持續推出版本更新」時，你或未來的工程團隊可以快速確認：
//   1. 現在跑的是哪個版本 (package.json version + migration 版本)
//   2. 外部資料源 (證交所 / TDX / 機票 Provider) 現在連得上嗎
//   3. 最近有沒有錯誤日誌
// /api/debug 需要帶 Header: X-Debug-Token，值需與 .env 的 DEBUG_TOKEN 相同，
// 避免任何人都能看到系統內部狀態。

const { Router } = require('../mini-http');
const pkg = require('../../package.json');
const { getDb } = require('../services/db');
const twse = require('../services/twse');
const tdx = require('../services/tdx');
const flights = require('../services/flights');
const marketExtras = require('../services/marketExtras');
const assistant = require('../services/assistant');

const router = Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok', version: pkg.version, uptimeSec: Math.round(process.uptime()) });
});

router.get('/debug', async (req, res) => {
  const token = req.headers['x-debug-token'];
  if (!process.env.DEBUG_TOKEN || token !== process.env.DEBUG_TOKEN) {
    return res.status(403).json({ error: '缺少或錯誤的 X-Debug-Token' });
  }

  const db = getDb();
  const counts = {
    users: db.prepare('SELECT COUNT(*) c FROM users').get().c,
    diary_entries: db.prepare('SELECT COUNT(*) c FROM diary_entries').get().c,
    finance_transactions: db.prepare('SELECT COUNT(*) c FROM finance_transactions').get().c,
    calendar_events: db.prepare('SELECT COUNT(*) c FROM calendar_events').get().c,
    favorite_trains: db.prepare('SELECT COUNT(*) c FROM favorite_trains').get().c,
  };
  const migrations = db.prepare('SELECT version, applied_at FROM schema_migrations ORDER BY version').all();
  const recentLogs = db
    .prepare('SELECT level, message, meta_json, created_at FROM app_logs ORDER BY id DESC LIMIT 30')
    .all();

  const [twseHealth, tdxHealth, marketExtrasHealth] = await Promise.all([
    twse.healthcheck(),
    tdx.healthcheck(),
    marketExtras.healthcheck(),
  ]);

  res.json({
    version: pkg.version,
    nodeEnv: process.env.NODE_ENV || 'development',
    uptimeSec: Math.round(process.uptime()),
    dbCounts: counts,
    migrationsApplied: migrations,
    externalDataSources: {
      twse: twseHealth,
      tdx: tdxHealth,
      flights: flights.healthcheck(),
      marketExtras: marketExtrasHealth,
      assistant: assistant.healthcheck(),
    },
    recentLogs,
  });
});

module.exports = router;

    // 暫時性資料庫匯出端點 (供搬家/備份使用)：用 X-Export-Token 驗證 (需與 .env 的 DB_EXPORT_TOKEN 相同)，
// 回傳完整的 SQLite 資料庫檔案 (含所有使用者的資料)。純粹的一般 HTTP request/response，
// 不會影響啟動流程，之後如果還要再搬一次可以繼續用，不用的時候記得移除。
router.get('/export-db', (req, res) => {
    const token = req.headers['x-export-token'];
        if (!process.env.DB_EXPORT_TOKEN || token !== process.env.DB_EXPORT_TOKEN) {
              return res.status(403).json({ error: '缺少或錯誤的 X-Export-Token' });
        }
    const fs = require('fs');
    const { getDb, DB_PATH } = require('../services/db');
    try {
          const db = getDb();
          db.exec('PRAGMA wal_checkpoint(FULL)');
    } catch (e) {
          return res.status(500).json({ error: 'checkpoint_failed: ' + e.message });
    }
    let buf;
    try {
          buf = fs.readFileSync(DB_PATH);
    } catch (e) {
          return res.status(500).json({ error: 'read_failed: ' + e.message });
    }
    res.setHeader('content-type', 'application/octet-stream');
    res.setHeader('content-disposition', 'attachment; filename="app.db"');
    res.setHeader('content-length', String(buf.length));
    res.end(buf);
});
