// 資料庫初始化 + 簡易 migration 系統
// 之後每次要改資料表結構，就在 /migrations 資料夾新增一支 00X_xxx.sql，
// 程式啟動時會自動依編號順序套用「尚未執行過」的檔案，並記錄在 schema_migrations 表。
// 這是為了讓「以後持續推出版本更新」時，資料庫結構可以跟著程式版本一起演進，
// 不需要每次都手動改 DB 或請使用者刪除重建。

const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite'); // Node.js 內建 (實驗性功能，v22 起提供)，取代 better-sqlite3
const logger = require('./logger');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'app.db');

function ensureDataDir() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function runMigrations(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`);

  const migrationsDir = path.join(__dirname, '..', '..', 'migrations');
  if (!fs.existsSync(migrationsDir)) return;

  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  const applied = new Set(db.prepare('SELECT version FROM schema_migrations').all().map((r) => r.version));

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    db.exec('BEGIN');
    try {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(
        file,
        new Date().toISOString()
      );
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    logger.info(`已套用 migration: ${file}`);
  }
}

let instance = null;
function getDb() {
  if (instance) return instance;
  ensureDataDir();
  instance = new DatabaseSync(DB_PATH);
  instance.exec('PRAGMA journal_mode = WAL');
  runMigrations(instance);
  logger.attachDb(instance);
  return instance;
}

module.exports = { getDb, DB_PATH };
