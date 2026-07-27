const path = require('path');

// ===== 自我更新：每次開機都從同目錄的 lifehub-prototype.zip 還原/覆蓋一次專案檔案 =====
// (常見情況：透過網頁手動上傳到 GitHub 時，瀏覽器沒有把子資料夾一起送出。)
// 純粹用 Node.js 內建模組實作 (fs / zlib)，不依賴任何外部套件或系統指令，
// 符合這個專案「零外部依賴」的原則。整段邏輯內嵌在 server.js 裡。
// 刻意設計成「只要 zip 檔存在就一定執行」而不是只在缺檔案時才執行，
// 這樣以後要更新畫面/功能，只需要換掉這個 zip 檔重新部署，
// 不用再手動一個一個資料夾上傳、也不用再改 server.js。
(function ensureExtracted(rootDir) {
  const fs = require('fs');
  const zlib = require('zlib');

  function findZipFile() {
    const zipNames = fs.readdirSync(rootDir).filter((name) => name.toLowerCase().endsWith('.zip'));
    if (zipNames.length === 0) return null;
    if (zipNames.length > 1) {
      console.error(
        `[bootstrap-extract] 偵測到 ${zipNames.length} 個 zip 檔 (${zipNames.join(', ')})，` +
          '為避免用錯版本，這次不會自動解壓縮。請確認專案根目錄只留「一個」zip 檔案。'
      );
      return null;
    }
    return path.join(rootDir, zipNames[0]);
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
    const srcDir = path.join(rootDir, 'src');
    if (!fs.existsSync(srcDir)) {
      console.error('[bootstrap-extract] 缺少 src/ 資料夾，且找不到 lifehub-prototype.zip 可以還原。');
    }
    return;
  }
  console.log(`[bootstrap-extract] 正在從 ${path.basename(zipPath)} 還原/更新專案檔案...`);
  extractZip(zipPath, rootDir);
  console.log('[bootstrap-extract] 還原完成。');
})(__dirname);

const { loadEnv } = require('./src/services/env');
loadEnv();

const { createApp } = require('./src/mini-http');
const logger = require('./src/services/logger');
const { getDb } = require('./src/services/db');

getDb();

const assistantService = require('./src/services/assistant');
const health = assistantService.healthcheck();
if (health.ok) {
  const keyLen = (process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY || '').length;
  logger.info(`[assistant] 已偵測到 AI 供應商: ${health.provider} (金鑰長度: ${keyLen})`);
} else {
  logger.info(`[assistant] 尚未偵測到 AI 供應商設定 (${health.reason})`);
}

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
app.mount('/api/mood', require('./src/routes/mood'));
app.mount('/api/export', require('./src/routes/export'));
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
