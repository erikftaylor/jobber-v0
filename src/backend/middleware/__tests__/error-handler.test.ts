import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../error-handler';

describe('errorHandler middleware', () => {
  function buildApp(routeError: Error): express.Application {
    const app = express();
    app.get('/boom', (_req, _res, next) => next(routeError));
    // Express only treats middleware as an error handler when it declares
    // four arguments. A 3-arg handler is silently registered as normal
    // middleware, the error falls through to Express's default HTML handler,
    // and the JSON body below never appears.
    app.use(errorHandler);
    return app;
  }

  it('catches errors forwarded via next() and responds with 500 JSON', async () => {
    const res = await request(buildApp(new Error('kaboom'))).get('/boom');

    expect(res.status).toBe(500);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body.error).toBe('kaboom');
  });

  it('falls back to a generic message when the error has none', async () => {
    const res = await request(buildApp(new Error())).get('/boom');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal server error');
  });
});
