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

});
