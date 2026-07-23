// 簡易 Logger：同時輸出到 console 與 SQLite (app_logs 表)，供 /api/debug 讀取。
// 未來若要改接 Sentry/Datadog 等外部服務，只需要修改這個檔案即可，其他程式不用動。

const DEBUG = process.env.DEBUG === 'true';

let db = null;
function attachDb(database) {
  db = database;
}

function write(level, message, meta) {
  const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`;
  if (level === 'error') {
    console.error(line, meta || '');
  } else if (DEBUG || level !== 'debug') {
    console.log(line, meta ? JSON.stringify(meta) : '');
  }

  if (db) {
    try {
      db.prepare(
        'INSERT INTO app_logs (level, message, meta_json, created_at) VALUES (?, ?, ?, ?)'
      ).run(level, message, meta ? JSON.stringify(meta) : null, new Date().toISOString());
      // 只保留最近 500 筆，避免除錯紀錄無限增長
      db.prepare(
        `DELETE FROM app_logs WHERE id NOT IN (SELECT id FROM app_logs ORDER BY id DESC LIMIT 500)`
      ).run();
    } catch (e) {
      console.error('logger 寫入 app_logs 失敗', e.message);
    }
  }
}

module.exports = {
  attachDb,
  debug: (msg, meta) => write('debug', msg, meta),
  info: (msg, meta) => write('info', msg, meta),
  warn: (msg, meta) => write('warn', msg, meta),
  error: (msg, meta) => write('error', msg, meta),
};
