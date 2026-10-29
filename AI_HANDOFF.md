# LifeHub 交接說明 (給接手的 AI 助理或開發者)

> 換了 AI 工具、或開一個新對話時，請先讀完這份再動手。這份文件記錄的是**專案怎麼運作、
> 怎麼發版、已經定案的設計規則**。每次發新版時一起更新 (最後更新：v0.88.0)。
>
> ⚠️ 這個 repo 是**公開的**：這份文件、程式碼、zip 都看得到。不要把密碼、金鑰、`.env`、
> 資料庫或任何使用者資料放進 repo。

---

## 1. 專案是什麼

LifeHub：繁體中文的個人生活助理網頁 App (PWA)，主要在**手機**上用「加入主畫面」開啟。
功能：待辦、習慣、看板、記帳、帳單、日記、心情陪伴 (心靈)、健康、陪伴另一半 (生理週期)、
家庭公告欄、行事曆、交通旅遊、AI 助理……共約 25 個分頁。

- 後端：Node.js 22.5+，**零 npm 依賴**。`src/mini-http.js` 是模仿 Express 的極簡框架，
  資料庫用內建 `node:sqlite`。不要加 npm 套件。
- 前端：`public/index.html` + `public/js/app.js` (單一大檔，全域函式) + `public/css/style.css`。
- 新的路由檔**不要改 `server.js`**，比照 `src/routes/debug.js` 把 routes 併進 `/api`
  (`require('./xxx').routes.forEach(...)`)。背景排程也是在被 require 時啟動。

## 2. 部署方式 (很重要)

- 正式環境：GCP Compute Engine VM，專案目錄 `~/lifehub`，systemd 服務 `lifehub`。
- **repo 根目錄放一個 `lifehub-<版本>.zip`**。VM 啟動時 `server.js` 的 bootstrap-extract
  會把這個 zip 解壓、覆蓋專案檔案。
- **根目錄只能有一個 zip**；有兩個以上時 bootstrap 會拒絕解壓 (避免用錯版本)。
- repo 根目錄裡的 `src/`、`public/` 等資料夾是很舊的版本，**以 zip 內容為準**。
- 發版流程：新 zip 上傳 → 刪舊 zip → 在 VM 上執行：
  ```bash
  cd ~/lifehub && git pull && sudo systemctl restart lifehub
  ```
- 確認：打開 `/api/health`，看 `version` 是否為新版本號。
- **自動退回 (v0.88)**：bootstrap 會把被覆蓋的舊檔備份到 `.bootstrap/previous/`，狀態在
  `.bootstrap/state.json` (`status`: trying/ok/bad)。新版啟動 30 秒後自我健康檢查通過才算 ok；
  連續 2 次開機都沒到 ok，第 3 次開機自動還原上一版並把該 zip 標記 bad (之後不再解壓它)。
  看到 `/api/health` 版本號沒變時，先看 `sudo journalctl -u lifehub -n 100` 和 state.json。
  要強制重試同一個 zip：刪掉 `.bootstrap/state.json` 再重啟。`.bootstrap/` 不進 git。

### 沒有 GitHub token 時怎麼上傳 (只用瀏覽器)
使用者偏好**不要讓 AI 操控他的電腦**，但可以用 AI 內建、已登入 GitHub 的瀏覽器。做法：
1. 在 github.com 頁面用 JS `fetch('/910228jason-ops/lifehub/raw/main/<舊zip>')` 取得舊 zip。
2. 把「舊版 → 新版」的 git unified diff 分段送進頁面 (每段約 20KB，用 SHA-256 核對)。
3. 在頁面裡解壓舊 zip、套 diff、用 `CompressionStream('deflate-raw')` 重新壓成新 zip。
4. 用 `DataTransfer` 把新 zip 設給上傳頁的 `input[type=file]`，填 commit 訊息送出。
5. 到 `/delete/main/<舊zip>` 刪掉舊 zip。
6. 用 raw 連結重新下載，算 SHA-256，確認跟本機測過的 zip 一樣。
事前一定要先在本機用 Node 對**真的舊 zip** 跑過同一段腳本，並用 VM 自己的 extractZip 驗證。

## 3. 每次發版前的測試流程

1. `node --check` 所有改過的 .js。
2. 在隔離資料夾啟動伺服器 (`.env` 設不同 PORT)，背景啟動用
   `(setsid nohup node server.js > log 2>&1 &)`，不要跟 kill 用 `&&` 串在一起。
3. Playwright 用 390×844 手機尺寸，淺色、深色各跑一次**全部分頁**，確認 console 沒有錯誤。
4. `package.json` 版本號 + `CHANGELOG.md` (最新在最上面，寫清楚為什麼改)。
5. 打包 zip (排除 `node_modules/`、`data/`、`*.db`、`.env`、`.git/`)，**把 zip 解壓到全新
   資料夾重新跑一次測試**，確認真正要出的 zip 本身沒問題。

## 4. 設計原則 (之後開發必須延續)

1. **零記錄成本**：想在使用者低潮時幫忙的功能，不能要求他當下輸入任何東西。所有被動功能
   都必須從「已經存在的資料」算出來。
2. **只講事實、不猜感受**：不要用 A 的資料去斷言 B 的心情 (例如用她的週期斷言「你這幾天
   可能也很累」)。先講可驗證的事實 (天數、次數、狀態)，情緒解讀留給使用者。也不要用
   自我辯護式的收尾 (例如「不是要邀功，只是…」)。
3. **顏色只在有語意時用**：色條 (`.rb-*`) 與優先度圓點只用在帳單急迫度、任務優先度、
   藥物狀態這類有狀態意義的地方，其他一律中性色，不要為了好看發明新顏色。
4. **原生 dialog 政策**：`confirm()` 只用在不可逆刪除前；需要輸入資料的 `prompt()` 改成
   就地展開的 UI (隱藏的 Debug 面板除外)。
5. **敏感推播預設關閉**：生日、另一半週期、心情、自我照顧、家庭公告欄這幾類推播都由
   使用者在設定頁決定，規則集中在 `src/services/pushFilter.js`，前景通知與背景推播共用。

## 5. 外觀規則 (v0.85 起，使用者看過三版設計稿後定案)

- **配色維持原本的**：米白底 `#f6f4f0`、白卡片、深綠主色 `--accent #2f3b34`、金色點綴
  `--gold #a8823a`，保留 emoji 圖示。使用者試過「全米色＋焦糖色」的版本後明確說不要。
- **全站不要出現藍色** (舊的 btn-ghost、focus 光暈、連結都已改成深綠)。
- **底部導覽列是白色**，目前分頁用淡綠膠囊標示 (使用者指定)。
- 外形：卡片圓角 22px、按鈕膠囊形、觸控目標 ≥ 44px、淺色模式 `--text-muted #6f6a60` (對比 ≥ 4.5:1)。
- 首頁順序：問候 → 今天 (完成度＋待辦/行程) → 今天的心情 → 問 AI → 家庭公告欄 → 更多。
- v0.85 的外觀覆寫集中在 `style.css` 最後的「v0.85 第二版」區塊。
- **使用者只用手機版**，桌面版側欄的優化不是重點。
- 改 UI 之前先給使用者看設計稿，確認後再寫程式。
- **手機上不要一次攤開一大堆東西 (v0.87)**：使用者明確反映「功能列太擠、很亂」。新卡片如果
  是分析/回顧/設定類，用 `makeCardCollapsible(card, key, defaultOpen)` 做成可收合；長說明會被
  全域的 hint 收合機制收成兩行 (`.card p.hint` 超過 70 字)；清單列的操作按鈕放在標題下方，
  不要跟標題擠同一列；行內小按鈕用 `font-size:11px` 這類寫法時會自動不套 44px 最小高度。
- **時間一律用台灣時間 (UTC+8)** 判斷，不要依賴伺服器時區 (GCP VM 預設 UTC)。

- **離線 (v0.88)**：`public/sw.js` 對 App 外殼和 GET /api 採「網路優先、4 秒逾時才用快取」。
  改 sw.js 的快取策略時要遞增 `SHELL_CACHE`/`API_CACHE` 名稱；新增含敏感資料或不該離線顯示的
  API 時，加進 `isCacheableApi` 的排除清單。登出/登入會呼叫 `clearOfflineApiCache()`。

## 6. 資料與備份

- 資料庫：`DB_PATH` (預設 `data/app.db`)。
- 每月備份 (v0.67)：同一台主機的 `data/backups/`，每位使用者一份 JSON。
- **異地備份 (v0.86)**：`src/services/offsiteBackup.js`。每天台北時間 04:00 後，把整個資料庫
  `VACUUM INTO` → gzip → AES-256-GCM 加密 → 上傳到 GCS bucket
  `<GCP專案ID>-lifehub-backups` (可用 `BACKUP_GCS_BUCKET` 覆寫)。`daily/` 留 30 天、
  `monthly/` 留 12 個月。
  - 需要 VM 的「Cloud API 存取權範圍 → 儲存空間」是「讀寫」(預設唯讀，要先停止 VM 才能改)。
  - 加密金鑰：環境變數 `BACKUP_KEY`，或自動產生的 `data/backup.key`。管理者可以在「個人化
    設定 → 異地備份」顯示金鑰另外保存。**金鑰絕對不能放進 repo。**
  - 還原：`node scripts/decrypt-backup.js <檔案.lhbk> <輸出.db> [金鑰]`，停服務、換掉 `DB_PATH`
    指的檔案、重啟。

## 7. 已知待辦 / 下一步候選

- 共用購物清單 (家人可同時勾選)。
- 每週一次只講事實的被動摘要 (推播預設關閉)。
- 伺服器端很多 `todayStr()` 用的是 UTC 日期 (帳單的 currentPeriod 已在 v0.88 改成台灣時間) (台灣早上 8 點前會算成前一天)，可以統一改成台灣時間。
