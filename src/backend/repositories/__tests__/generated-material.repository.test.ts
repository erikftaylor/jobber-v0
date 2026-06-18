import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { DatabaseService } from '../../services/database.service';
import { GeneratedMaterialRepository } from '../generated-material.repository';

describe('GeneratedMaterialRepository', () => {
  const dbPath = path.join(process.cwd(), 'test-data', 'test-materials.db');
  let db: DatabaseService;
  let repo: GeneratedMaterialRepository;

  const cleanup = () =>
    [dbPath, dbPath + '-shm', dbPath + '-wal'].forEach(f => {
      try {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      } catch {
        // ignore
      }
    });

  const sample = (overrides: Record<string, unknown> = {}) => ({
    title: 'Senior PD Resume',
    jobDescriptionHash: 'abc123',
    sourceDocumentIds: ['doc-1', 'doc-2'],
    generatedContent: 'Jane Doe\nSUMMARY\nDesigner',
    structuredResumeJson: { contact: { name: 'Jane Doe' } },
    renderedHtml: '<html>resume</html>',
    ...overrides,
  });

  beforeEach(() => {
    cleanup();
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    db = new DatabaseService(dbPath);
    repo = new GeneratedMaterialRepository(db.getConnection());
  });

  afterEach(cleanup);

  it('create persists a generated resume and returns it', () => {
    const created = repo.create(sample());

    expect(created.id).toMatch(/^mat-/);
    expect(created.type).toBe('resume');
    expect(created.title).toBe('Senior PD Resume');
    expect(created.createdAt).toBeTruthy();

    const fetched = repo.getById(created.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.generatedContent).toBe('Jane Doe\nSUMMARY\nDesigner');
    expect(fetched!.sourceDocumentIds).toEqual(['doc-1', 'doc-2']);
    expect(fetched!.structuredResumeJson).toEqual({ contact: { name: 'Jane Doe' } });
    expect(fetched!.renderedHtml).toBe('<html>resume</html>');
  });

  it('persists fallback artifacts with null html and a formatting error', () => {
    const created = repo.create(
      sample({ renderedHtml: null, structuredResumeJson: null, formattingError: 'engine boom' })
    );

    const fetched = repo.getById(created.id)!;
    expect(fetched.renderedHtml).toBeNull();
    expect(fetched.structuredResumeJson).toBeNull();
    expect(fetched.formattingError).toBe('engine boom');
  });

  it('list returns all saved artifacts', () => {
    repo.create(sample({ title: 'A' }));
    repo.create(sample({ title: 'B' }));

    const all = repo.list();
    expect(all.length).toBe(2);
    expect(all.map(m => m.title).sort()).toEqual(['A', 'B']);
  });

  it('getById returns null for a missing artifact', () => {
    expect(repo.getById('mat-missing')).toBeNull();
  });
});
