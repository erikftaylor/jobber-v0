import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { DatabaseService } from '../../services/database.service';
import { GeneratedMaterialRepository } from '../../repositories/generated-material.repository';
import { createMaterialRoutes } from '../materials.routes';

describe('Material routes', () => {
  const dbPath = path.join(process.cwd(), 'test-data', 'test-materials-routes.db');
  let db: DatabaseService;
  let repo: GeneratedMaterialRepository;
  let app: express.Application;

  const cleanup = () =>
    [dbPath, dbPath + '-shm', dbPath + '-wal'].forEach(f => {
      try {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      } catch {
        // ignore
      }
    });

  const seed = () =>
    repo.create({
      title: 'Resume — Lead PD',
      jobDescriptionHash: 'hash',
      sourceDocumentIds: ['doc-1'],
      generatedContent: 'Jane Doe resume text',
      structuredResumeJson: { contact: { name: 'Jane Doe' } },
      renderedHtml: '<html>resume</html>',
    });

  beforeEach(() => {
    cleanup();
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    db = new DatabaseService(dbPath);
    repo = new GeneratedMaterialRepository(db.getConnection());
    app = express();
    app.use(express.json());
    app.use('/api/materials', createMaterialRoutes({ repository: repo }));
  });

  afterEach(cleanup);

  it('GET /api/materials returns saved artifacts', async () => {
    seed();
    seed();

    const res = await request(app).get('/api/materials');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.materials).toHaveLength(2);
    const m = res.body.materials[0];
    expect(m.id).toMatch(/^mat-/);
    expect(m.type).toBe('resume');
    expect(m.title).toBe('Resume — Lead PD');
    expect(m.generated_content).toBe('Jane Doe resume text');
    expect(m.formatted_html).toBe('<html>resume</html>');
    expect(m.created_at).toBeTruthy();
  });

  it('GET /api/materials/:id returns a saved artifact', async () => {
    const created = seed();

    const res = await request(app).get(`/api/materials/${created.id}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.material.id).toBe(created.id);
    expect(res.body.material.generated_content).toBe('Jane Doe resume text');
    expect(res.body.material.formatted_html).toBe('<html>resume</html>');
  });

  it('GET /api/materials/:id returns 404 for a missing artifact', async () => {
    const res = await request(app).get('/api/materials/mat-missing');

    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });
});
