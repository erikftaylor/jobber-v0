import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { DatabaseService } from '../../services/database.service';
import { DocumentParserService } from '../../services/document-parser.service';
import { createKnowledgeRoutes } from '../knowledge.routes';
import { errorHandler } from '../../middleware/error-handler';

describe('Knowledge Routes', () => {
  const testDbPath = path.join(process.cwd(), 'test-data', 'test-routes.db');
  // Own subdirectory so the recursive cleanup below can't delete another test
  // file's fixtures (previously both shared process.cwd()/test-fixtures).
  const testDir = path.join(process.cwd(), 'test-fixtures', 'knowledge-routes');
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

  it('GET /api/kb should return documents and generation context', async () => {
    const res = await request(app).get('/api/kb');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // The route serves the raw-document context model that /generate consumes —
    // not a structured knowledge base.
    expect(res.body.documents).toEqual([]);
    expect(res.body.context).toEqual({
      total_documents: 0,
      total_chars: 0,
      ready_for_generation: false,
    });
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

  it('createKnowledgeRoutes returns a fresh router each call (no duplicate stacking)', () => {
    const r1 = createKnowledgeRoutes({ db, parser });
    const r2 = createKnowledgeRoutes({ db, parser });

    // A module-scope Router shared across factory calls would make these the
    // same object and accumulate routes on every invocation.
    expect(r1).not.toBe(r2);
    expect(r2.stack.length).toBe(r1.stack.length);
  });

  it('POST /api/kb/generate delegates to the use case and returns 501 when Claude is not configured', async () => {
    // This app is mounted without an extractor, so the use case short-circuits.
    const res = await request(app).post('/api/kb/generate').send({ job_description: 'Senior PD role' });

    expect(res.status).toBe(501);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBeDefined();
  });
});

describe('POST /api/kb/generate (delegation contract)', () => {
  const genDbPath = path.join(process.cwd(), 'test-data', 'test-generate-route.db');
  let genDb: DatabaseService;

  // Same text shape the prompt asks Claude for, so the real parser + output
  // engine render it without falling back.
  const VALID_RESUME_TEXT = `Jane Doe

SUMMARY
Senior Product Designer with eight years building enterprise and AI-native tools.

CORE EXPERTISE
Design Systems
User Research

PROFESSIONAL EXPERIENCE

Senior Product Designer | Acme Corp | Remote | 2020 – Present
• Architected a design system adopted by five teams, cutting build time by 30%
• Designed an onboarding flow that lifted activation by 25%

EDUCATION
BFA Design • Some University • 2014`;

  const cleanup = () =>
    [genDbPath, genDbPath + '-shm', genDbPath + '-wal'].forEach(f => {
      try {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      } catch {
        // ignore
      }
    });

  beforeEach(() => {
    cleanup();
    fs.mkdirSync(path.dirname(genDbPath), { recursive: true });
    genDb = new DatabaseService(genDbPath);
    genDb.saveDocument('resume', 'cv.txt', 'Jane Doe — Senior Product Designer');
  });

  afterEach(cleanup);

  function buildApp(call: (prompt: string) => Promise<{ content: string }>): express.Application {
    const app = express();
    app.use(express.json());
    app.use(
      '/api/kb',
      createKnowledgeRoutes({
        db: genDb,
        parser: new DocumentParserService(),
        extractor: { claude: { call } },
      })
    );
    app.use(errorHandler);
    return app;
  }

  it('returns the same JSON shape on success', async () => {
    const app = buildApp(async () => ({ content: VALID_RESUME_TEXT }));

    const res = await request(app)
      .post('/api/kb/generate')
      .send({ job_description: 'Lead enterprise design systems', material_type: 'resume' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.material_type).toBe('resume');
    expect(res.body.generated_content).toBe(VALID_RESUME_TEXT);
    expect(typeof res.body.formatted_html).toBe('string');
    expect(res.body.based_on_documents).toBe(1);
    expect(res.body.validation).toBeDefined();
  });

  it('forwards unexpected errors to next() and the centralized handler returns 500 JSON', async () => {
    const app = buildApp(async () => {
      throw new Error('Claude exploded');
    });

    const res = await request(app)
      .post('/api/kb/generate')
      .send({ job_description: 'Lead enterprise design systems' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Claude exploded');
  });
});
