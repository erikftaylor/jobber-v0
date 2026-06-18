import { describe, it, expect } from 'vitest';
import { buildReadiness } from '../readiness.service';

const stubDb = (docs: unknown[]) => ({ getAllDocuments: () => docs });
const throwingDb = () => ({
  getAllDocuments: (): unknown[] => {
    throw new Error('db down');
  },
});

describe('buildReadiness', () => {
  it('reports ok when db is reachable, Claude is configured, and a document exists', () => {
    const r = buildReadiness({ db: stubDb([{ id: '1' }]), isClaudeConfigured: () => true });

    expect(r.status).toBe('ok');
    expect(r.server.ok).toBe(true);
    expect(r.database.ok).toBe(true);
    expect(r.database.documentCount).toBe(1);
    expect(r.claude.configured).toBe(true);
    expect(r.generation.available).toBe(true);
    expect(r.generation.reason).toBeUndefined();
  });

  it('reports degraded when Claude is not configured', () => {
    const r = buildReadiness({ db: stubDb([{ id: '1' }]), isClaudeConfigured: () => false });

    expect(r.status).toBe('degraded');
    expect(r.claude.configured).toBe(false);
    expect(r.generation.available).toBe(false);
    expect(String(r.generation.reason)).toMatch(/claude api key/i);
  });

  it('reports degraded when there are zero documents', () => {
    const r = buildReadiness({ db: stubDb([]), isClaudeConfigured: () => true });

    expect(r.status).toBe('degraded');
    expect(r.database.ok).toBe(true);
    expect(r.database.documentCount).toBe(0);
    expect(r.generation.available).toBe(false);
    expect(String(r.generation.reason)).toMatch(/no uploaded source documents/i);
  });

  it('reports degraded (server still ok) when the database is unavailable', () => {
    const r = buildReadiness({ db: throwingDb(), isClaudeConfigured: () => true });

    expect(r.status).toBe('degraded');
    expect(r.server.ok).toBe(true);
    expect(r.database.ok).toBe(false);
    expect(r.database.documentCount).toBeUndefined();
    expect(r.generation.available).toBe(false);
    expect(String(r.generation.reason)).toMatch(/database/i);
  });
});
