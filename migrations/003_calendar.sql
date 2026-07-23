-- v0.3.0：新增行事曆 (時段待辦) 功能

CREATE TABLE IF NOT EXISTS calendar_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_date TEXT NOT NULL,   -- YYYY-MM-DD
  start_time TEXT,             -- HH:MM，可留空 (全天事項)
  title TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
