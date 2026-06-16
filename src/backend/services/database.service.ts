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

    // Initialize knowledge base if it doesn't exist
    const kb = this.db.prepare('SELECT id FROM knowledge_base LIMIT 1').get();
    if (!kb) {
      this.createInitialKnowledgeBase();
    }
  }

  private createInitialKnowledgeBase(): void {
    const id = 'kb-' + uuid().replace(/-/g, '').substring(0, 16);
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO knowledge_base (
        id, skills, achievements, technologies, writing_style, "values",
        synthesis_version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
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

  // Documents
  saveDocument(
    type: Document['type'],
    filename: string,
    rawText: string
  ): Document {
    const id = 'doc-' + uuid().replace(/-/g, '').substring(0, 16);
    const now = new Date();

    const stmt = this.db.prepare(`
      INSERT INTO documents (id, type, filename, raw_text, uploaded_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(id, type, filename, rawText, now.toISOString());

    return {
      id,
      type,
      filename,
      raw_text: rawText,
      uploaded_at: now,
    };
  }

  getDocument(id: string): Document | null {
    const stmt = this.db.prepare('SELECT * FROM documents WHERE id = ?');
    const row = stmt.get(id) as any;

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
    const stmt = this.db.prepare('SELECT * FROM documents ORDER BY uploaded_at DESC');
    const rows = stmt.all() as any[];

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
    const stmt = this.db.prepare('DELETE FROM documents WHERE id = ?');
    stmt.run(id);
  }

  // Knowledge Base
  getKnowledgeBase(): KnowledgeBase | null {
    const stmt = this.db.prepare('SELECT * FROM knowledge_base LIMIT 1');
    const row = stmt.get() as any;

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
      WHERE id = ?
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
      kb.id
    );

    return this.getKnowledgeBase()!;
  }

  close(): void {
    this.db.close();
  }
}
