# LifeHub 原型 (股票 / 交通旅遊 / 日記 / 記帳)

個人化跨平台生活整合服務的第一版可運行原型。網站與未來的 App 共用同一套後端
API 與資料庫，帳號資料即時同步；使用者可在「個人化設定」自訂要顯示哪些模組，
概念上類似自訂 Google 首頁小工具。

> 完整的產品規劃 (願景、各功能的資料來源可行性、法規限制、系統架構、路線圖)
> 請見隨附的《產品規劃書》Word 文件，這份 README 只講「這個原型怎麼跑、怎麼除錯、
> 怎麼發下一版」。

## 這個原型刻意做到「零外部 npm 依賴」

開發過程中發現的一個重要限制：某些環境 (包含產生這份原型的沙盒) 對外部 npm
套件源的存取可能受限或不穩定。為了讓這個原型「拿到任何一台裝有 Node.js 22+
的機器上，不需要 `npm install`、不需要能連到 npm registry，執行 `node server.js`
就能直接跑起來」，整個後端只用 Node.js **內建模組**實作：

| 原本會用的套件 | 換成 |
|---|---|
| Express | `src/mini-http.js`：一個約 200 行、模仿 Express API 形狀的極簡路由框架 |
| better-sqlite3 | `node:sqlite` (Node 22.5+ 內建，目前為實驗性功能) |
| bcryptjs | `crypto.scryptSync` (Node 內建) |
| cookie-session | 自製的簽章 cookie (HMAC-SHA256，內建 `crypto`) |
| node-fetch | Node 18+ 內建的全域 `fetch()` |
| dotenv | `src/services/env.js`：20 行的極簡 `.env` 解析器 |
| morgan | `src/mini-http.js` 內建的簡易 request log |

**如果你的正式環境可以正常安裝 npm 套件**，可以視需求換回 Express/better-sqlite3
等成熟套件 (效能與生態系更好)；因為 API 形狀刻意模仿 Express，`src/routes/*.js`
幾乎不需要改。這不是必要的，現在這樣也能穩定運作，只是多一個選項。

## 快速開始

需求：Node.js **22.5 以上** (使用了實驗性的 `node:sqlite`)。

```bash
cp .env.example .env    # 依需求編輯，至少建議更換 SESSION_SECRET / DEBUG_TOKEN
node server.js          # 或 npm start
```

啟動後開啟 http://localhost:3000 ，註冊一組帳號即可開始使用。第一次啟動會自動
建立 SQLite 資料庫檔案 (`data/app.db`) 並套用資料表結構。

## 部署到 Railway (讓任何人都能用真實網址開啟)

這個專案已經準備好可以直接部署到 [Railway](https://railway.app)：`railway.json` 指定了
啟動指令，`.nvmrc`/`package.json engines` 指定了 Node 版本 (需要 22.5+ 才有 `node:sqlite`)。

1. 到 Railway 建立新專案，選擇「Deploy from GitHub repo」或直接上傳這個資料夾的程式碼。
2. 在 Railway 專案的 **Variables** 分頁設定環境變數 (至少要設)：
   - `SESSION_SECRET`：一組隨機長字串 (登入 session 簽章用，正式上線務必換掉範例值)
   - `DEBUG_TOKEN`：一組隨機字串 (用來保護 `/api/debug`，不要用預設值)
   - `DB_PATH`：設成 `/data/app.db` (搭配下一步的 Volume，重新部署才不會遺失資料)
   - 如需真實台鐵/高鐵資料：`TDX_CLIENT_ID` / `TDX_CLIENT_SECRET` (見上方申請說明)
   - 如需 AI 助理真的能對話：`ANTHROPIC_API_KEY`
3. 在 Railway 專案設定加一個 **Volume**，掛載路徑設為 `/data`。SQLite 資料庫檔案存在
   本機磁碟上，沒有 Volume 的話，每次重新部署都會把使用者資料(帳號/日記/記帳/行事曆)
   清空，這一步不能省略。
4. Railway 會自動偵測 Node 專案並用 `node server.js` 啟動，部署完成後會給一個
   `https://your-app.up.railway.app` 網址，這就是可以分享給任何人使用、也可以在
   iPhone Safari 用「加入主畫面」變成 App 圖示的正式網址。
5. 部署後用 `<你的網址>/api/health` 確認版本號正確、用 `/api/debug` (帶
   `X-Debug-Token` header) 確認資料庫與外部資料源狀態。

> 提醒：這台伺服器部署到 Railway 之後，就有正常的對外網路連線了，先前在開發環境
> 遇到的「證交所/TDX 連線失敗」問題應該就會消失，會抓到真正的即時資料。

## 各功能模組的資料來源與現況

| 模組 | 資料來源 | 現況 |
|---|---|---|
| 股票收盤價 | 臺灣證券交易所 OpenAPI (`openapi.twse.com.tw`) | 公開、免金鑰，每日盤後更新一次 |
| 三大法人買賣超 | 證交所網站資料 (`www.twse.com.tw/rwd/...`) | 公開、免金鑰，每日盤後更新一次 |
| 台鐵/高鐵時刻與動態 | 交通部 TDX 運輸資料流通服務 | 需免費申請會員取得 API 金鑰，見下方說明 |
| 機票/訂房比價 | 尚無 | 需申請商業合作 (如 Amadeus)，目前為示範資料 |
| 銀行帳戶即時餘額 | 尚無 | 屬台灣 Open Banking 範疇，需金融機構/金管會核准的第三方(TSP)資格，目前僅支援手動記帳 |

### 如何啟用台鐵/高鐵真實資料 (TDX)

1. 前往 https://tdx.transportdata.tw 註冊會員並完成 Email 驗證。
2. 登入後至「會員中心 > 金鑰管理」建立一組 API 金鑰 (免費，最多可建立 3 組)。
3. 把取得的 Client ID / Client Secret 填入 `.env` 的 `TDX_CLIENT_ID` / `TDX_CLIENT_SECRET`。
4. 重啟伺服器。交通頁面會自動改用真實資料，畫面上的「示範資料」提示也會消失。

沒有設定金鑰時，程式會自動 fallback 成示範資料並在畫面上明顯標示，不會讓使用者
誤以為看到的是真實班次。

### 股票資料為什麼不是「逐秒跳動」的即時報價？

證交所公開的 OpenAPI 是「每日盤後」整理的資料 (通常下午才會有當日資料)，
不是逐筆撮合的盤中即時報價。真正的盤中即時報價需要向券商/資訊供應商申請
「即時報價授權」，通常需要付費並簽約，目前原型沒有做這一段，介面上也刻意標明
資料的更新頻率，避免誤導使用者。

## 除錯 (Debug)

- `GET /api/health`：不需要驗證，回傳版本號與運行時間，適合當作 uptime 監控用。
- `GET /api/debug`：需要在 Header 帶 `X-Debug-Token: <.env 裡的 DEBUG_TOKEN>`，
  會回傳目前版本、資料庫各表筆數、已套用的 migration 清單、外部資料源
  (證交所/TDX/機票) 的連線健康狀態、最近 30 筆系統日誌。網站左下角「系統狀態」
  連結會跳出輸入框讓你貼上 Token 直接查看。
- 設定 `.env` 的 `DEBUG=true` 並用 `npm run dev` 啟動，可以在終端機看到每一筆
  request 的方法/路徑/狀態碼/耗時，方便開發時追蹤問題。
- 所有 `logger.error(...)` 記錄的錯誤都會寫進 SQLite 的 `app_logs` 表 (只保留最近
  500 筆)，透過 `/api/debug` 就能看到，不需要另外接第三方監控服務也能先應急除錯。

## 之後要怎麼持續發版更新

1. **資料庫結構有變動**：在 `migrations/` 新增一支新的 `00X_描述.sql` (數字遞增)，
   絕對不要修改已發布過的舊檔案。伺服器重啟時會自動偵測並套用「還沒跑過」的
   migration，不需要手動改資料庫，也不會重複套用同一支。
2. **改版本號**：更新 `package.json` 的 `version`。
3. **寫更新紀錄**：在 `CHANGELOG.md` 新增一個版本區塊。
4. **佈署**：把新程式碼放上主機、重啟服務 (`npm start` 或搭配 `pm2`/`systemd`
   之類的程序管理工具做 zero-downtime 重啟)。
5. **驗證**：呼叫 `/api/health` 確認版本號正確；呼叫 `/api/debug` 確認 migration
   都套用成功、外部資料源連線正常、沒有異常錯誤日誌。

這一套流程的目的，是讓「以後持續推出版本更新」這件事情不需要每次都手動處理
資料庫、也能快速確認新版本真的正常運作。

## 目錄結構

```
server.js              進入點：載入設定、掛上路由、啟動 HTTP 伺服器
src/mini-http.js        極簡路由/伺服器框架 (取代 Express)
src/middleware/auth.js  登入驗證中介層
src/services/           商業邏輯：db、logger、env、密碼雜湊、股票/交通/機票/行程資料
src/routes/             各功能的 API 路由 (auth/prefs/stocks/diary/finance/travel/debug)
migrations/             資料庫結構變更歷史 (依編號自動套用)
public/                 前端 (單頁應用，純 HTML/CSS/原生 JS，無框架依賴)
data/app.db             SQLite 資料庫檔案 (執行後自動產生，已加入 .gitignore 建議)
```

## 已知限制 (誠實列出，避免誤解為 bug)

- `node:sqlite` 目前是 Node.js 的實驗性功能，啟動時會印出一行 ExperimentalWarning，
  這是正常的，不影響功能。若未來要換成更成熟的 better-sqlite3，只需要改
  `src/services/db.js` 一個檔案。
- 機票即時比價、銀行帳戶即時餘額目前都是示範資料，原因與後續規劃寫在
  《產品規劃書》。
- 這是單一 Node 程序、單檔 SQLite 的原型架構，適合驗證功能與畫面，正式上線
  多使用者、高併發情境建議依《產品規劃書》的架構章節換成正式的資料庫
  (PostgreSQL) 與可水平擴展的部署方式。
