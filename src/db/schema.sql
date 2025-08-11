-- conversations: one per chat session
CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  metadata_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- messages: ordered list of chat turns
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('system','user','assistant','tool')),
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  seq INTEGER NOT NULL,
  request_id INTEGER REFERENCES requests(id),
  UNIQUE(conversation_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_messages_convo_seq ON messages(conversation_id, seq);

-- requests: tracks async OpenAI jobs and caching
CREATE TABLE IF NOT EXISTS requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  params_json TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  openai_response_id TEXT,
  status TEXT NOT NULL CHECK(status IN ('queued','in_progress','completed','failed','cancelled','expired')),
  error_json TEXT,
  tries INTEGER NOT NULL DEFAULT 0,
  started_at INTEGER,
  completed_at INTEGER,
  output_text TEXT,
  raw_json TEXT,
  usage_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(conversation_id, input_hash)
);

CREATE INDEX IF NOT EXISTS idx_requests_convo_status ON requests(conversation_id, status);
CREATE INDEX IF NOT EXISTS idx_requests_openai_id ON requests(openai_response_id);