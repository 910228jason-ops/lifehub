const path = require('path');

// ===== 自我修復：如果缺少 src/ 資料夾，就從同目錄的 lifehub-prototype.zip 自動解壓縮 =====
// (常見情況：透過網頁手動上傳到 GitHub 時，瀏覽器沒有把子資料夾一起送出。)
// 純粹用 Node.js 內建模組實作 (fs / zlib)，不依賴任何外部套件或系統指令，
// 符合這個專案「零外部依賴」的原則。整段邏輯內嵌在 server.js 裡，
// 這樣只需要「這一個檔案 + 一個 zip」兩個東西，不用額外再上傳別的腳本檔。
(function ensureExtracted(rootDir) {
  const fs = require('fs');
  const zlib = require('zlib');
  const srcDir = path.join(rootDir, 'src');
  if (fs.existsSync(srcDir)) return; // 已經是完整的專案，不用做任何事

  function findZipFile() {
    const preferred = path.join(rootDir, 'lifehub-prototype.zip');
    if (fs.existsSync(preferred)) return preferred;
    const zipName = fs.readdirSync(rootDir).find((name) => name.toLowerCase().endsWith('.zip'));
    return zipName ? path.join(rootDir, zipName) : null;
  }

  function readEocd(buf) {
    const SIG = 0x06054b50;
    for (let i = buf.length - 22; i >= 0; i--) {
      if (buf.readUInt32LE(i) === SIG) {
        return { entryCount: buf.readUInt16LE(i + 10), cdOffset: buf.readUInt32LE(i + 16) };
      }
    }
    throw new Error('找不到 ZIP 的 End Of Central Directory，檔案可能不完整或已損毀');
  }

  function extractZip(zipPath, destDir) {
    const buf = fs.readFileSync(zipPath);
    const { entryCount, cdOffset } = readEocd(buf);
    let offset = cdOffset;
    for (let i = 0; i < entryCount; i++) {
      if (buf.readUInt32LE(offset) !== 0x02014b50) {
        throw new Error(`ZIP central directory 格式異常 (entry ${i})`);
      }
      const compressionMethod = buf.readUInt16LE(offset + 10);
      const compressedSize = buf.readUInt32LE(offset + 20);
      const nameLen = buf.readUInt16LE(offset + 28);
      const extraLen = buf.readUInt16LE(offset + 30);
      const commentLen = buf.readUInt16LE(offset + 32);
      const localHeaderOffset = buf.readUInt32LE(offset + 42);
      const nameStart = offset + 46;
      const fileName = buf.toString('utf8', nameStart, nameStart + nameLen);

      const localNameLen = buf.readUInt16LE(localHeaderOffset + 26);
      const localExtraLen = buf.readUInt16LE(localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
      const compressedData = buf.subarray(dataStart, dataStart + compressedSize);

      const targetPath = path.join(destDir, fileName);
      if (fileName.endsWith('/')) {
        fs.mkdirSync(targetPath, { recursive: true });
      } else {
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        const data = compressionMethod === 0 ? compressedData : zlib.inflateRawSync(compressedData);
        fs.writeFileSync(targetPath, data);
      }
      offset = nameStart + nameLen + extraLen + commentLen;
    }
  }

  const zipPath = findZipFile();
  if (!zipPath) {
    console.error('[bootstrap-extract] 缺少 src/ 資料夾，且找不到 lifehub-prototype.zip 可以還原。');
    return;
  }
  console.log(`[bootstrap-extract] 偵測到 src/ 缺失，正在從 ${path.basename(zipPath)} 還原專案檔案...`);
  extractZip(zipPath, rootDir);
  console.log('[bootstrap-extract] 還原完成。');
})(__dirname);

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
