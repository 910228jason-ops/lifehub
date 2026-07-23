-- v0.2.0：新增收藏車次功能

CREATE TABLE IF NOT EXISTS favorite_trains (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('TRA','THSR')),
  train_no TEXT NOT NULL,
  from_station TEXT NOT NULL,
  to_station TEXT,
  departure_time TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, mode, train_no, from_station, departure_time)
);
