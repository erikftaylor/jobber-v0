import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { DatabaseService } from '../database.service';

/**
 * Regression coverage for the document data-loss bug.
 *
 * Symptom: after a backend restart, documents appeared to vanish while
 * `generated_resumes` survived. Root cause was NOT WAL durability — committed
 * WAL data survives a process restart — it was that documents are session-scoped
 * and the active session id lived only in memory (`this.activeSessionId`),
 * reverting to 'default' on restart. A document uploaded under a non-default
 * session therefore stayed in the DB but no longer matched the read filter.
 *
 * These tests simulate a restart by closing the service and constructing a new
 * `DatabaseService` on the same file, then assert the document is still present.
 */
describe('DatabaseService durability across restart', () => {
  const testDbPath = path.join(process.cwd(), 'test-data', 'durability.db');

  const cleanupTestDb = () => {
    for (const suffix of ['', '-shm', '-wal']) {
      if (fs.existsSync(testDbPath + suffix)) {
        fs.unlinkSync(testDbPath + suffix);
      }
    }
  };

  beforeEach(cleanupTestDb);

  afterAll(() => {
    cleanupTestDb();
    const dir = path.dirname(testDbPath);
    if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
      fs.rmdirSync(dir);
    }
  });

  it('keeps a document uploaded under a non-default session visible after a restart', () => {
    // Arrange: emulate the real upload flow — create a session, make it active,
    // then upload a document into it.
    const first = new DatabaseService(testDbPath);
    const session = first.createSession('My Job Hunt');
    first.setActiveSession(session.id);
    const doc = first.saveDocument('resume', 'resume.pdf', 'Jane Doe — Staff Engineer');
    first.close();

    // Act: simulate a backend restart — fresh service instance, same file.
    const second = new DatabaseService(testDbPath);

    // Assert: the previously active session is restored, so the document is
    // still visible through the normal (session-scoped) read paths.
    expect(second.getActiveSession()).toBe(session.id);

    const docs = second.getAllDocuments();
    expect(docs.map(d => d.id)).toContain(doc.id);

    const retrieved = second.getDocument(doc.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.raw_text).toBe('Jane Doe — Staff Engineer');

    second.close();
  });

  it('checkpoints the WAL into the main db file on close', () => {
    const service = new DatabaseService(testDbPath);
    service.saveDocument('resume', 'r.pdf', 'x'.repeat(20_000));
    service.close();

    // After a clean close the WAL must be drained into the main file — either
    // truncated to zero or removed entirely — so data does not live only in the WAL.
    const walPath = testDbPath + '-wal';
    const walSize = fs.existsSync(walPath) ? fs.statSync(walPath).size : 0;
    expect(walSize).toBe(0);

    // And the committed row is readable from the main file by a fresh connection.
    const raw = new Database(testDbPath);
    const count = (raw.prepare('SELECT COUNT(*) AS n FROM documents').get() as { n: number }).n;
    raw.close();
    expect(count).toBe(1);
  });
});
