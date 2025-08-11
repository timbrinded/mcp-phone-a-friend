import { Database } from 'bun:sqlite';
import { createHash } from 'crypto';

export type Role = 'system' | 'user' | 'assistant' | 'tool';
export type RequestStatus = 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'expired';

export interface MessageRow {
  id: number;
  conversation_id: number;
  role: Role;
  content: string;
  created_at: number;
  seq: number;
  request_id?: number | null;
}

export interface RequestRow {
  id: number;
  conversation_id: number;
  message_id: number;
  model: string;
  params_json: string;
  input_hash: string;
  openai_response_id?: string | null;
  status: RequestStatus;
  error_json?: string | null;
  tries: number;
  started_at?: number | null;
  completed_at?: number | null;
  output_text?: string | null;
  raw_json?: string | null;
  usage_json?: string | null;
  created_at: number;
  updated_at: number;
}

export class ChatStore {
  private db: Database;

  constructor(filename = 'chat.db') {
    this.db = new Database(filename);
    this.db.exec("PRAGMA journal_mode = WAL");
    this.ensureSchema();
  }

  private now(): number {
    return Date.now();
  }

  private ensureSchema(): void {
    const schema = `
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
    `;
    this.db.exec(schema);
  }

  createConversation(title?: string, metadata?: any): number {
    const now = this.now();
    const stmt = this.db.prepare(
      'INSERT INTO conversations(title, metadata_json, created_at, updated_at) VALUES (?, ?, ?, ?)'
    );
    const result = stmt.run(
      title ?? null,
      metadata ? JSON.stringify(metadata) : null,
      now,
      now
    );
    return result.lastInsertRowid as number;
  }

  getMessages(conversationId: number): MessageRow[] {
    const stmt = this.db.prepare(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY seq ASC'
    );
    return stmt.all(conversationId) as MessageRow[];
  }

  appendMessage(conversationId: number, role: Role, content: string, requestId?: number | null): number {
    const now = this.now();
    
    // Get the next sequence number
    const maxSeqStmt = this.db.prepare(
      'SELECT MAX(seq) as maxSeq FROM messages WHERE conversation_id = ?'
    );
    const maxSeqResult = maxSeqStmt.get(conversationId) as { maxSeq: number | null };
    const seq = (maxSeqResult?.maxSeq ?? 0) + 1;

    // Use transaction for atomicity
    const insertStmt = this.db.prepare(
      'INSERT INTO messages(conversation_id, role, content, created_at, seq, request_id) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const updateStmt = this.db.prepare(
      'UPDATE conversations SET updated_at = ? WHERE id = ?'
    );

    const result = this.db.transaction(() => {
      const insertResult = insertStmt.run(conversationId, role, content, now, seq, requestId ?? null);
      updateStmt.run(now, conversationId);
      return insertResult.lastInsertRowid as number;
    })();

    return result;
  }

  static stableHash(input: unknown): string {
    const json = JSON.stringify(input, Object.keys(input as any).sort());
    return createHash('sha256').update(json).digest('hex');
  }

  upsertRequest(opts: {
    conversationId: number;
    messageId: number;
    model: string;
    params: any;
    inputForHash: any;
  }): RequestRow {
    const now = this.now();
    const input_hash = ChatStore.stableHash({
      model: opts.model,
      input: opts.inputForHash,
      params: opts.params
    });
    const params_json = JSON.stringify(opts.params ?? {});

    // Try to find existing request
    const findStmt = this.db.prepare(
      'SELECT * FROM requests WHERE conversation_id = ? AND input_hash = ?'
    );
    const existing = findStmt.get(opts.conversationId, input_hash) as RequestRow | undefined;

    if (existing) {
      return existing;
    }

    // Insert new request
    const insertStmt = this.db.prepare(
      `INSERT INTO requests(conversation_id, message_id, model, params_json, input_hash, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'queued', ?, ?)`
    );
    
    const result = insertStmt.run(
      opts.conversationId,
      opts.messageId,
      opts.model,
      params_json,
      input_hash,
      now,
      now
    );

    const getStmt = this.db.prepare('SELECT * FROM requests WHERE id = ?');
    return getStmt.get(result.lastInsertRowid) as RequestRow;
  }

  markRequestStarted(id: number, openaiId: string): void {
    const now = this.now();
    const stmt = this.db.prepare(
      `UPDATE requests SET openai_response_id = ?, status = 'in_progress', started_at = ?, updated_at = ? WHERE id = ?`
    );
    stmt.run(openaiId, now, now, id);
  }

  saveInProgressStatus(id: number, openaiStatus: string): void {
    const now = this.now();
    const status = openaiStatus === 'in_progress' ? 'in_progress' : 'queued';
    const stmt = this.db.prepare(
      'UPDATE requests SET status = ?, updated_at = ? WHERE id = ?'
    );
    stmt.run(status, now, id);
  }

  saveCompletion(id: number, outputText: string, raw: any, usage: any): void {
    const now = this.now();
    const stmt = this.db.prepare(
      `UPDATE requests SET status = 'completed', completed_at = ?, updated_at = ?, output_text = ?, raw_json = ?, usage_json = ? WHERE id = ?`
    );
    stmt.run(
      now,
      now,
      outputText,
      JSON.stringify(raw),
      JSON.stringify(usage ?? null),
      id
    );
  }

  saveFailure(id: number, error: any, status: RequestStatus = 'failed'): void {
    const now = this.now();
    const stmt = this.db.prepare(
      'UPDATE requests SET status = ?, error_json = ?, updated_at = ? WHERE id = ?'
    );
    stmt.run(status, JSON.stringify(error ?? null), now, id);
  }

  incrementTries(id: number): void {
    const stmt = this.db.prepare('UPDATE requests SET tries = tries + 1 WHERE id = ?');
    stmt.run(id);
  }

  linkAssistantMessage(conversationId: number, requestId: number, content: string): number {
    return this.appendMessage(conversationId, 'assistant', content, requestId);
  }

  getRequestById(id: number): RequestRow | undefined {
    const stmt = this.db.prepare('SELECT * FROM requests WHERE id = ?');
    return stmt.get(id) as RequestRow | undefined;
  }

  getRequestByOpenAIId(openaiId: string): RequestRow | undefined {
    const stmt = this.db.prepare('SELECT * FROM requests WHERE openai_response_id = ?');
    return stmt.get(openaiId) as RequestRow | undefined;
  }

  close(): void {
    this.db.close();
  }
}