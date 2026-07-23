const path = require('path');
const { loadEnv } = require('./src/services/env');
loadEnv();

const { createApp } = require('./src/mini-http');
const logger = require('./src/services/logger');
const { getDb } = require('./src/services/db');

// 啟動時先初始化 DB + 套用 migrations，任何一步失敗就直接讓程式退出，
// 避免「資料庫結構跟程式版本對不上」卻還繼續服務請求。
getDb();

const app = createApp();

app.setSession({
  name: 'lifehub_session',
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  maxAge: 30 * 24 * 60 * 60 * 1000,
});

app.mount('/api/auth', require('./src/routes/auth'));
app.mount('/api/prefs', require('./src/routes/prefs'));
app.mount('/api/stocks', require('./src/routes/stocks'));
app.mount('/api/diary', require('./src/routes/diary'));
app.mount('/api/finance', require('./src/routes/finance'));
app.mount('/api/travel', require('./src/routes/travel'));
app.mount('/api/calendar', require('./src/routes/calendar'));
app.mount('/api/assistant', require('./src/routes/assistant'));
app.mount('/api', require('./src/routes/debug'));

app.setStatic(path.join(__dirname, 'public'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`LifeHub 伺服器已啟動: http://localhost:${PORT} (版本 ${require('./package.json').version})`);
});

process.on('unhandledRejection', (err) => {
  logger.error('未處理的 Promise rejection', { message: err && err.message, stack: err && err.stack });
});
process.on('uncaughtException', (err) => {
  logger.error('未捕捉的例外', { message: err.message, stack: err.stack });
});
