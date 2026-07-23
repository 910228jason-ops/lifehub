-- 初始資料庫結構 (v0.1.0)

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  created_at TEXT NOT NULL
);

-- 個人化設定：像 Google 首頁一樣，每個使用者可以自訂啟用哪些模組、排序如何
CREATE TABLE IF NOT EXISTS user_prefs (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  module_order_json TEXT NOT NULL DEFAULT '["stocks","travel","diary","finance"]',
  enabled_modules_json TEXT NOT NULL DEFAULT '{"stocks":true,"travel":true,"diary":true,"finance":true}',
  watchlist_json TEXT NOT NULL DEFAULT '[]',
  theme TEXT NOT NULL DEFAULT 'light'
);

CREATE TABLE IF NOT EXISTS diary_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_date TEXT NOT NULL, -- YYYY-MM-DD
  content TEXT NOT NULL DEFAULT '',
  mood TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, entry_date)
);

CREATE TABLE IF NOT EXISTS finance_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tx_date TEXT NOT NULL, -- YYYY-MM-DD
  type TEXT NOT NULL CHECK (type IN ('income','expense')),
  category TEXT NOT NULL,
  amount REAL NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS finance_budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  monthly_limit REAL NOT NULL,
  UNIQUE(user_id, category)
);

-- 除錯用的日誌表，/api/debug 會讀取最近的紀錄
CREATE TABLE IF NOT EXISTS app_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  meta_json TEXT,
  created_at TEXT NOT NULL
);
