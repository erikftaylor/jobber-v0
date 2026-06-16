import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { DatabaseService } from '../../services/database.service';
import { DocumentParserService } from '../../services/document-parser.service';
import { createKnowledgeRoutes } from '../knowledge.routes';

describe('Knowledge Routes', () => {
  const testDbPath = path.join(process.cwd(), 'test-data', 'test-routes.db');
  const testDir = path.join(process.cwd(), 'test-fixtures');
  const testFile = path.join(testDir, 'test-doc.txt');
  let db: DatabaseService;
  let parser: DocumentParserService;
  let app: express.Application;

  beforeEach(() => {
    // Clean up test database files before each test
    const files = [testDbPath, testDbPath + '-shm', testDbPath + '-wal'];
    files.forEach(f => {
      try {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      } catch (e) {
        // Ignore
      }
    });

    // Create test directory and file
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    fs.writeFileSync(testFile, 'Test Resume Content\nJohn Doe\nSenior Engineer');

    // Fresh instances for each test
    db = new DatabaseService(testDbPath);
    parser = new DocumentParserService();

    app = express();
    app.use(express.json());
    app.use('/api/kb', createKnowledgeRoutes({ db, parser }));
  });

  afterEach(() => {
    // Don't close db - let garbage collection handle it
    // better-sqlite3 has issues with rapid open/close cycles

    // Cleanup test files
    const cleanup = (p: string) => {
      try {
        if (fs.existsSync(p)) {
          if (fs.lstatSync(p).isDirectory()) {
            fs.readdirSync(p).forEach(f => cleanup(path.join(p, f)));
            fs.rmdirSync(p);
          } else {
            fs.unlinkSync(p);
          }
        }
      } catch (e) {
        // Ignore cleanup errors
      }
    };

    cleanup(testDir);
  });

  it('GET /api/kb should return knowledge base', async () => {
    const res = await request(app).get('/api/kb');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.knowledgeBase).toBeDefined();
    expect(res.body.knowledgeBase.skills).toEqual([]);
    expect(res.body.knowledgeBase.synthesis_version).toBe(1);
  });

  it('GET /api/kb/documents should return empty list initially', async () => {
    const res = await request(app).get('/api/kb/documents');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.documents).toEqual([]);
  });

  it('POST /api/kb/upload should reject missing file', async () => {
    const res = await request(app).post('/api/kb/upload');

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('POST /api/kb/upload should accept text files', async () => {
    const res = await request(app)
      .post('/api/kb/upload')
      .field('type', 'resume')
      .attach('file', testFile);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.document.id).toBeDefined();
    expect(res.body.document.type).toBe('resume');
    expect(res.body.document.filename).toBe('test-doc.txt');
  });

  it('POST /api/kb/upload with invalid type should return error', async () => {
    const res = await request(app)
      .post('/api/kb/upload')
      .field('type', 'invalid_type')
      .attach('file', testFile);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid document type');
  });

  it('DELETE /api/kb/documents/:id should return success', async () => {
    const doc = db.saveDocument('resume', 'test.txt', 'Test content');

    const res = await request(app).delete(`/api/kb/documents/${doc.id}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
