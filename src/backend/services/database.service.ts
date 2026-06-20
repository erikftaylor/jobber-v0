import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { v4 as uuid } from 'uuid';
import type { Document } from '../../shared/types';

export class DatabaseService {
  private db: Database.Database;
  private dbPath: string;
  private activeSessionId: string = 'default';

  constructor(dbPath?: string) {
    this.dbPath = dbPath || path.join(process.cwd(), 'data', 'jobber.db');
    this.ensureDataDirectory();
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    // Durability: fsync every commit so a power loss / OS crash cannot lose a
    // committed write. This is a low-write desktop workload, so the cost is
    // negligible and the safety is worth it given documents were being lost.
    this.db.pragma('synchronous = FULL');
    // Keep the WAL from growing unbounded between runs. Combined with the
    // checkpoint on close() (and the SIGINT/SIGTERM handler in index.ts), this
    // keeps committed data flowing into the main db file rather than living
    // only in jobber.db-wal.
    this.db.pragma('wal_autocheckpoint = 1000');
    this.initializeSchema();
  }

  private ensureDataDirectory(): void {
    const dataDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  private initializeSchema(): void {
    const schemaPath = path.join(__dirname, '../db/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    this.db.exec(schema);

    // Initialize default session if it doesn't exist
    const defaultSession = this.db.prepare('SELECT id FROM sessions WHERE id = ?').get('default');
    if (!defaultSession) {
      const now = new Date().toISOString();
      this.db.prepare('INSERT INTO sessions (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)')
        .run('default', 'Default Session', now, now);
    }

    // Restore the active session that was in effect before the last shutdown.
    // Without this, the active session reverts to 'default' on every restart and
    // documents uploaded under another session silently disappear from view.
    this.activeSessionId = this.loadActiveSession();
  }

  /** Read the persisted active session id, falling back to 'default' if it is
   * unset or points at a session that no longer exists. */
  private loadActiveSession(): string {
    const row = this.db
      .prepare("SELECT value FROM app_state WHERE key = 'active_session_id'")
      .get() as { value?: string } | undefined;
    const candidate = row?.value;
    if (candidate) {
      const exists = this.db.prepare('SELECT id FROM sessions WHERE id = ?').get(candidate);
      if (exists) return candidate;
    }
    return 'default';
  }

  /** Durably record the active session id so it survives a restart. */
  private persistActiveSession(): void {
    this.db
      .prepare(
        `INSERT INTO app_state (key, value) VALUES ('active_session_id', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      )
      .run(this.activeSessionId);
  }

  // Session Management
  createSession(name: string): { id: string; name: string } {
    const id = 'sess-' + uuid().replace(/-/g, '').substring(0, 12);
    const now = new Date().toISOString();

    this.db.prepare('INSERT INTO sessions (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .run(id, name, now, now);

    return { id, name };
  }

  listSessions(): Array<{ id: string; name: string; created_at: Date }> {
    const rows = this.db.prepare('SELECT id, name, created_at FROM sessions ORDER BY created_at DESC').all() as any[];
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      created_at: new Date(row.created_at),
    }));
  }

  setActiveSession(sessionId: string): void {
    const session = this.db.prepare('SELECT id FROM sessions WHERE id = ?').get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    this.activeSessionId = sessionId;
    this.persistActiveSession();
  }

  getActiveSession(): string {
    return this.activeSessionId;
  }

  deleteSession(sessionId: string): void {
    if (sessionId === 'default') throw new Error('Cannot delete default session');
    this.db.prepare('DELETE FROM documents WHERE session_id = ?').run(sessionId);
    this.db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
    if (this.activeSessionId === sessionId) {
      this.activeSessionId = 'default';
      this.persistActiveSession();
    }
  }

  // Documents
  saveDocument(
    type: Document['type'],
    filename: string,
    rawText: string
  ): Document {
    const id = 'doc-' + uuid().replace(/-/g, '').substring(0, 16);
    const now = new Date();

    const stmt = this.db.prepare(`
      INSERT INTO documents (id, session_id, type, filename, raw_text, uploaded_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, this.activeSessionId, type, filename, rawText, now.toISOString());

    return {
      id,
      type,
      filename,
      raw_text: rawText,
      uploaded_at: now,
    };
  }

  getDocument(id: string): Document | null {
    const stmt = this.db.prepare('SELECT * FROM documents WHERE id = ? AND session_id = ?');
    const row = stmt.get(id, this.activeSessionId) as any;

    if (!row) return null;

    return {
      id: row.id,
      type: row.type,
      filename: row.filename,
      raw_text: row.raw_text,
      uploaded_at: new Date(row.uploaded_at),
      parsed_at: row.parsed_at ? new Date(row.parsed_at) : undefined,
    };
  }

  getAllDocuments(): Document[] {
    const stmt = this.db.prepare('SELECT * FROM documents WHERE session_id = ? ORDER BY uploaded_at DESC');
    const rows = stmt.all(this.activeSessionId) as any[];

    return rows.map(row => ({
      id: row.id,
      type: row.type,
      filename: row.filename,
      raw_text: row.raw_text,
      uploaded_at: new Date(row.uploaded_at),
      parsed_at: row.parsed_at ? new Date(row.parsed_at) : undefined,
    }));
  }

  deleteDocument(id: string): void {
    const stmt = this.db.prepare('DELETE FROM documents WHERE id = ? AND session_id = ?');
    stmt.run(id, this.activeSessionId);
  }

  clearSession(): void {
    this.db.prepare('DELETE FROM documents WHERE session_id = ?').run(this.activeSessionId);
  }

  /** Expose the underlying connection so repositories can own their own SQL. */
  getConnection(): Database.Database {
    return this.db;
  }

  close(): void {
    // Drain the WAL into the main db file before closing so committed data is
    // not left living only in jobber.db-wal. TRUNCATE also resets the WAL file
    // size. Best-effort: never let checkpoint failure block a clean shutdown.
    try {
      this.db.pragma('wal_checkpoint(TRUNCATE)');
    } catch {
      // ignore — close() below still flushes on the last connection
    }
    this.db.close();
  }
}
