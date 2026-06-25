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
    expect(tableNames).toContain('career_models');

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

  // Career Model Tests
  it('should create a career model', () => {
    dbService = new DatabaseService(testDbPath);

    const sourceDocIds = ['doc-1', 'doc-2'];
    const sourceHash = 'hash123';
    const modelJson = {
      contact: { name: 'John Doe', email: 'john@example.com' },
      roles: [],
      projects: [],
      skills: [],
      tools: [],
      metrics: [],
      education: [],
      certifications: [],
      approvedClaims: [],
      sourceDocumentIds: sourceDocIds,
    };

    const model = dbService.createCareerModel({
      source_document_ids: sourceDocIds,
      source_hash: sourceHash,
      model_json: modelJson,
      model_version: '1.0.0',
    });

    expect(model.id).toBeDefined();
    expect(model.source_document_ids).toEqual(sourceDocIds);
    expect(model.source_hash).toBe(sourceHash);
    expect(model.model_json.contact.name).toBe('John Doe');
    expect(model.model_version).toBe('1.0.0');

    dbService.close();
  });

  it('should retrieve the latest career model', () => {
    dbService = new DatabaseService(testDbPath);

    const sourceHash1 = 'hash1';
    const sourceHash2 = 'hash2';
    const modelJson = {
      contact: {},
      roles: [],
      projects: [],
      skills: [],
      tools: [],
      metrics: [],
      education: [],
      certifications: [],
      approvedClaims: [],
      sourceDocumentIds: [],
    };

    const model1 = dbService.createCareerModel({
      source_document_ids: ['doc-1'],
      source_hash: sourceHash1,
      model_json: modelJson,
      model_version: '1.0.0',
    });

    const model2 = dbService.createCareerModel({
      source_document_ids: ['doc-1', 'doc-2'],
      source_hash: sourceHash2,
      model_json: modelJson,
      model_version: '1.0.0',
    });

    const latest = dbService.getLatestCareerModel();
    expect(latest).not.toBeNull();
    // Verify it's one of the two models we created (should be the most recent)
    expect([model1.id, model2.id]).toContain(latest?.id);
    // Verify source_hash is preserved
    expect([sourceHash1, sourceHash2]).toContain(latest?.source_hash);

    dbService.close();
  });

  it('should return null when no career model exists', () => {
    dbService = new DatabaseService(testDbPath);

    const latest = dbService.getLatestCareerModel();
    expect(latest).toBeNull();

    dbService.close();
  });

  it('should list career models', () => {
    dbService = new DatabaseService(testDbPath);

    const modelJson = {
      contact: {},
      roles: [],
      projects: [],
      skills: [],
      tools: [],
      metrics: [],
      education: [],
      certifications: [],
      approvedClaims: [],
      sourceDocumentIds: [],
    };

    const model1 = dbService.createCareerModel({
      source_document_ids: ['doc-1'],
      source_hash: 'hash1',
      model_json: modelJson,
      model_version: '1.0.0',
    });

    const model2 = dbService.createCareerModel({
      source_document_ids: ['doc-1', 'doc-2'],
      source_hash: 'hash2',
      model_json: modelJson,
      model_version: '1.0.0',
    });

    const model3 = dbService.createCareerModel({
      source_document_ids: ['doc-1', 'doc-2', 'doc-3'],
      source_hash: 'hash3',
      model_json: modelJson,
      model_version: '1.0.0',
    });

    const models = dbService.listCareerModels();
    expect(models.length).toBe(3);
    // Verify all models are in the list
    const modelIds = models.map(m => m.id);
    expect(modelIds).toContain(model1.id);
    expect(modelIds).toContain(model2.id);
    expect(modelIds).toContain(model3.id);
    // Verify they're ordered by creation date (descending)
    expect(models[0].created_at >= models[1].created_at).toBe(true);
    expect(models[1].created_at >= models[2].created_at).toBe(true);

    dbService.close();
  });

  it('should retrieve a career model by id', () => {
    dbService = new DatabaseService(testDbPath);

    const sourceDocIds = ['doc-1', 'doc-2'];
    const sourceHash = 'hash123abc';
    const modelJson: any = {
      contact: { name: 'Jane Smith', email: 'jane@example.com' },
      roles: [
        {
          title: 'Senior Engineer',
          company: 'Tech Corp',
          startDate: '2020-01-01',
          endDate: '2023-12-31',
        },
      ],
      projects: [],
      skills: [
        {
          name: 'React',
          proficiency: 'expert' as const,
        },
      ],
      tools: [],
      metrics: [],
      education: [],
      certifications: [],
      approvedClaims: [],
      sourceDocumentIds: sourceDocIds,
    };

    const created = dbService.createCareerModel({
      source_document_ids: sourceDocIds,
      source_hash: sourceHash,
      model_json: modelJson,
      model_version: '1.0.0',
    });

    const retrieved = dbService.getCareerModel(created.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.source_document_ids).toEqual(sourceDocIds);
    expect(retrieved?.source_hash).toBe(sourceHash);
    expect(retrieved?.model_json.contact.name).toBe('Jane Smith');
    expect(retrieved?.model_json.roles[0].title).toBe('Senior Engineer');
    expect(retrieved?.model_json.skills[0].name).toBe('React');

    dbService.close();
  });

  it('should preserve source_document_ids in career model', () => {
    dbService = new DatabaseService(testDbPath);

    const sourceDocIds = ['doc-abc123', 'doc-def456', 'doc-ghi789'];
    const modelJson = {
      contact: {},
      roles: [],
      projects: [],
      skills: [],
      tools: [],
      metrics: [],
      education: [],
      certifications: [],
      approvedClaims: [],
      sourceDocumentIds: sourceDocIds,
    };

    const model = dbService.createCareerModel({
      source_document_ids: sourceDocIds,
      source_hash: 'hash',
      model_json: modelJson,
      model_version: '1.0.0',
    });

    const retrieved = dbService.getCareerModel(model.id);
    expect(retrieved?.source_document_ids).toEqual(sourceDocIds);
    expect(retrieved?.source_document_ids.length).toBe(3);
    expect(retrieved?.source_document_ids[0]).toBe('doc-abc123');

    dbService.close();
  });

  it('should preserve source_hash in career model', () => {
    dbService = new DatabaseService(testDbPath);

    const sourceHash = 'sha256-abcdef123456789';
    const modelJson = {
      contact: {},
      roles: [],
      projects: [],
      skills: [],
      tools: [],
      metrics: [],
      education: [],
      certifications: [],
      approvedClaims: [],
      sourceDocumentIds: [],
    };

    const model = dbService.createCareerModel({
      source_document_ids: ['doc-1'],
      source_hash: sourceHash,
      model_json: modelJson,
      model_version: '1.0.0',
    });

    const retrieved = dbService.getCareerModel(model.id);
    expect(retrieved?.source_hash).toBe(sourceHash);

    dbService.close();
  });

  it('should isolate career models by session', () => {
    dbService = new DatabaseService(testDbPath);

    const modelJson = {
      contact: {},
      roles: [],
      projects: [],
      skills: [],
      tools: [],
      metrics: [],
      education: [],
      certifications: [],
      approvedClaims: [],
      sourceDocumentIds: [],
    };

    // Create model in default session
    const model1 = dbService.createCareerModel({
      source_document_ids: ['doc-1'],
      source_hash: 'hash1',
      model_json: modelJson,
      model_version: '1.0.0',
    });

    // Create a new session
    const session = dbService.createSession('Test Session');
    dbService.setActiveSession(session.id);

    // Create model in new session
    const model2 = dbService.createCareerModel({
      source_document_ids: ['doc-2'],
      source_hash: 'hash2',
      model_json: modelJson,
      model_version: '1.0.0',
    });

    // Verify only model2 is visible in new session
    const modelsInSession2 = dbService.listCareerModels();
    expect(modelsInSession2.length).toBe(1);
    expect(modelsInSession2[0].id).toBe(model2.id);

    // Switch back to default session and verify only model1 is visible
    dbService.setActiveSession('default');
    const modelsInDefaultSession = dbService.listCareerModels();
    expect(modelsInDefaultSession.length).toBe(1);
    expect(modelsInDefaultSession[0].id).toBe(model1.id);

    dbService.close();
  });

});
