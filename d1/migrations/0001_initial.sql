-- D1 schema for talk-gacha

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  category_id TEXT NOT NULL,
  tags TEXT NOT NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- Index for faster category lookups
CREATE INDEX IF NOT EXISTS idx_topics_category ON topics(category_id);