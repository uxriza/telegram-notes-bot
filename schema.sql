CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  user_id TEXT,
  chat_id TEXT NOT NULL,
  reminder_at TEXT,
  reminder_15_sent_at TEXT,
  reminder_sent_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_items_chat_status ON items (chat_id, status);
CREATE INDEX IF NOT EXISTS idx_items_category ON items (chat_id, category, status);
CREATE INDEX IF NOT EXISTS idx_items_reminder_at ON items (reminder_at, status);
