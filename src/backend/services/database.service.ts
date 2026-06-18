import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { v4 as uuid } from 'uuid';
import type {
  KnowledgeBase,
  Document,
  Skill,
  Achievement,
  Technology,
  WritingStyle,
  Value,
} from '../../shared/types';

export class DatabaseService {
  private db: Database.Database;
  private dbPath: string;
  private activeSessionId: string = 'default';

  constructor(dbPath?: string) {
    this.dbPath = dbPath || path.join(process.cwd(), 'data', 'jobber.db');
    this.ensureDataDirectory();
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
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

    // Initialize knowledge base for default session if it doesn't exist
    const kb = this.db.prepare('SELECT id FROM knowledge_base WHERE session_id = ?').get('default');
    if (!kb) {
      this.createInitialKnowledgeBase('default');
    }
  }

  private createInitialKnowledgeBase(sessionId: string): void {
    const id = 'kb-' + uuid().replace(/-/g, '').substring(0, 16);
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO knowledge_base (
        id, session_id, skills, achievements, technologies, writing_style, "values",
        synthesis_version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      sessionId,
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify({
        tone: 'professional',
        voice_markers: [],
        examples: [],
        confidence: 0,
        source_refs_json: [],
      }),
      JSON.stringify([]),
      1,
      now,
      now
    );
  }

  // Session Management
  createSession(name: string): { id: string; name: string } {
    const id = 'sess-' + uuid().replace(/-/g, '').substring(0, 12);
    const now = new Date().toISOString();

    this.db.prepare('INSERT INTO sessions (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .run(id, name, now, now);

    this.createInitialKnowledgeBase(id);
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
  }

  getActiveSession(): string {
    return this.activeSessionId;
  }

  deleteSession(sessionId: string): void {
    if (sessionId === 'default') throw new Error('Cannot delete default session');
    this.db.prepare('DELETE FROM documents WHERE session_id = ?').run(sessionId);
    this.db.prepare('DELETE FROM knowledge_base WHERE session_id = ?').run(sessionId);
    this.db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
    if (this.activeSessionId === sessionId) {
      this.activeSessionId = 'default';
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

  // Knowledge Base
  getKnowledgeBase(): KnowledgeBase | null {
    const stmt = this.db.prepare('SELECT * FROM knowledge_base WHERE session_id = ? LIMIT 1');
    const row = stmt.get(this.activeSessionId) as any;

    if (!row) return null;

    return {
      id: row.id,
      skills: JSON.parse(row.skills),
      achievements: JSON.parse(row.achievements),
      technologies: JSON.parse(row.technologies),
      writing_style: JSON.parse(row.writing_style),
      values: JSON.parse(row.values),
      extracted_at: row.extracted_at ? new Date(row.extracted_at) : undefined,
      synthesized_at: row.synthesized_at ? new Date(row.synthesized_at) : undefined,
      synthesis_version: row.synthesis_version,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    };
  }

  updateKnowledgeBase(
    skills: Skill[],
    achievements: Achievement[],
    technologies: Technology[],
    writingStyle: WritingStyle,
    values: Value[],
    extractedAt?: Date,
    synthesizedAt?: Date
  ): KnowledgeBase {
    const kb = this.getKnowledgeBase();
    if (!kb) throw new Error('Knowledge base not initialized');

    const now = new Date();
    const stmt = this.db.prepare(`
      UPDATE knowledge_base
      SET skills = ?, achievements = ?, technologies = ?, writing_style = ?,
          "values" = ?, extracted_at = ?, synthesized_at = ?,
          synthesis_version = synthesis_version + 1, updated_at = ?
      WHERE id = ? AND session_id = ?
    `);

    stmt.run(
      JSON.stringify(skills),
      JSON.stringify(achievements),
      JSON.stringify(technologies),
      JSON.stringify(writingStyle),
      JSON.stringify(values),
      extractedAt ? extractedAt.toISOString() : null,
      synthesizedAt ? synthesizedAt.toISOString() : null,
      now.toISOString(),
      kb.id,
      this.activeSessionId
    );

    return this.getKnowledgeBase()!;
  }

  /** Expose the underlying connection so repositories can own their own SQL. */
  getConnection(): Database.Database {
    return this.db;
  }

  close(): void {
    this.db.close();
  }
}
