// 極簡 .env 載入器 (取代 dotenv 套件)：讀取專案根目錄的 .env，
// 解析 KEY=VALUE 並寫入 process.env (若該 KEY 尚未被外部環境變數設定則不覆蓋)。

const fs = require('fs');
const path = require('path');

function loadEnv(file = path.join(__dirname, '..', '..', '.env')) {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, 'utf8');
  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx === -1) return;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  });
}

module.exports = { loadEnv };
