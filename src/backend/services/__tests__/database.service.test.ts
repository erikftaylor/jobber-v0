import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { DatabaseService } from '../database.service';

describe('DatabaseService', () => {
  let dbService: DatabaseService;
  const testDbPath = path.join(process.cwd(), 'test-data', 'test.db');

  const cleanupTestDb = () => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    if (fs.existsSync(testDbPath + '-shm')) {
      fs.unlinkSync(testDbPath + '-shm');
    }
    if (fs.existsSync(testDbPath + '-wal')) {
      fs.unlinkSync(testDbPath + '-wal');
    }
  };

  beforeEach(() => {
    // Clean up test database before each test
    cleanupTestDb();
  });

  afterAll(() => {
    // Clean up test database
    cleanupTestDb();
    const testDataDir = path.dirname(testDbPath);
    if (fs.existsSync(testDataDir) && fs.readdirSync(testDataDir).length === 0) {
      fs.rmdirSync(testDataDir);
    }
  });

  it('should initialize database schema on creation', () => {
    dbService = new DatabaseService(testDbPath);
    expect(dbService).toBeDefined();

    // Verify tables exist
    const db = new Database(testDbPath);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    const tableNames = tables.map(t => (t as any).name);

    expect(tableNames).toContain('documents');
    expect(tableNames).toContain('knowledge_base');
    expect(tableNames).toContain('jobs');
    expect(tableNames).toContain('generated_materials');
    expect(tableNames).toContain('conversations');

    db.close();
    dbService.close();
  });

  it('should create and retrieve a document', () => {
    dbService = new DatabaseService(testDbPath);

    const doc = dbService.saveDocument('resume', 'test.pdf', 'John Doe - Senior Engineer');
    expect(doc.id).toBeDefined();
    expect(doc.type).toBe('resume');
    expect(doc.filename).toBe('test.pdf');

    const retrieved = dbService.getDocument(doc.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.raw_text).toBe('John Doe - Senior Engineer');

    dbService.close();
  });

  it('should get all documents', () => {
    dbService = new DatabaseService(testDbPath);

    dbService.saveDocument('resume', 'resume.pdf', 'Resume text');
    dbService.saveDocument('cover_letter', 'letter.docx', 'Cover letter text');

    const docs = dbService.getAllDocuments();
    expect(docs.length).toBe(2);
    expect(docs[0].type).toBe('cover_letter'); // Most recent first
    expect(docs[1].type).toBe('resume');

    dbService.close();
  });

  it('should delete a document', () => {
    dbService = new DatabaseService(testDbPath);

    const doc = dbService.saveDocument('resume', 'test.pdf', 'Test');
    dbService.deleteDocument(doc.id);

    const retrieved = dbService.getDocument(doc.id);
    expect(retrieved).toBeNull();

    dbService.close();
  });

  it('should initialize knowledge base on first access', () => {
    dbService = new DatabaseService(testDbPath);

    const kb = dbService.getKnowledgeBase();
    expect(kb).not.toBeNull();
    expect(kb?.id).toBeDefined();
    expect(kb?.skills).toEqual([]);
    expect(kb?.achievements).toEqual([]);
    expect(kb?.synthesis_version).toBe(1);

    dbService.close();
  });

  it('should update knowledge base with skills', () => {
    dbService = new DatabaseService(testDbPath);

    const skill = {
      id: 'skill-1',
      name: 'TypeScript',
      category: 'backend' as const,
      years_experience: 5,
      confidence: 0.95,
      source_document_id: 'doc-1',
      source_excerpt: 'Experienced in TypeScript',
      source_refs_json: [
        {
          document_id: 'doc-1',
          excerpt: 'Experienced in TypeScript',
          confidence: 0.95,
        },
      ],
    };

    const updated = dbService.updateKnowledgeBase([skill], [], [], {
      tone: 'professional',
      voice_markers: [],
      examples: [],
      confidence: 0,
      source_refs_json: [],
    }, []);

    expect(updated.skills.length).toBe(1);
    expect(updated.skills[0].name).toBe('TypeScript');
    expect(updated.synthesis_version).toBe(2);

    dbService.close();
  });

  it('should preserve source grounding in knowledge base', () => {
    dbService = new DatabaseService(testDbPath);

    const achievement = {
      id: 'ach-1',
      title: 'Led team project',
      context: 'Delivered X on time',
      metrics: ['10% faster', '50% cost reduction'],
      skills_demonstrated: ['leadership', 'planning'],
      confidence: 0.9,
      source_document_id: 'doc-resume',
      source_excerpt: 'Led a team of 5 developers...',
      source_refs_json: [
        {
          document_id: 'doc-resume',
          excerpt: 'Led a team of 5 developers...',
          confidence: 0.9,
        },
      ],
    };

    dbService.updateKnowledgeBase([], [achievement], [], {
      tone: 'professional',
      voice_markers: [],
      examples: [],
      confidence: 0,
      source_refs_json: [],
    }, []);

    const kb = dbService.getKnowledgeBase();
    const retrieved = kb?.achievements[0];

    expect(retrieved?.source_document_id).toBe('doc-resume');
    expect(retrieved?.source_excerpt).toBe('Led a team of 5 developers...');
    expect(retrieved?.source_refs_json.length).toBe(1);

    dbService.close();
  });
});
