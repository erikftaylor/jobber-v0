import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createHealthRoutes } from '../health.routes';

function buildApp(opts: { docs: unknown[]; claudeConfigured: boolean }): express.Application {
  const app = express();
  app.use(
    '/api',
    createHealthRoutes({
      db: { getAllDocuments: () => opts.docs },
      isClaudeConfigured: () => opts.claudeConfigured,
    })
  );
  return app;
}

describe('GET /api/health', () => {
  it('returns 200 with status ok when generation is available', async () => {
    const res = await request(buildApp({ docs: [{ id: '1' }], claudeConfigured: true })).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.server.ok).toBe(true);
    expect(res.body.database.ok).toBe(true);
    expect(res.body.database.documentCount).toBe(1);
    expect(res.body.claude.configured).toBe(true);
    expect(res.body.generation.available).toBe(true);
  });

  it('returns 200 with status degraded when no documents are uploaded', async () => {
    const res = await request(buildApp({ docs: [], claudeConfigured: true })).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('degraded');
    expect(res.body.generation.available).toBe(false);
    expect(String(res.body.generation.reason)).toMatch(/no uploaded source documents/i);
  });

  it('returns 200 with status degraded when Claude is not configured', async () => {
    const res = await request(buildApp({ docs: [{ id: '1' }], claudeConfigured: false })).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('degraded');
    expect(res.body.claude.configured).toBe(false);
    expect(String(res.body.generation.reason)).toMatch(/claude api key/i);
  });
});
