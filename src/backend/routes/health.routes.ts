import { Router, Request, Response } from 'express';
import { buildReadiness, ReadinessDeps } from '../services/readiness.service';

/**
 * Health / readiness route.
 *
 * GET /api/health returns a cheap operational snapshot (server, database,
 * Claude config, and whether generation is available). It never calls Claude.
 * Always responds 200 — `status` ("ok" | "degraded") carries the readiness
 * signal so this doubles as a liveness check (`server.ok`).
 */
export function createHealthRoutes(deps: ReadinessDeps): Router {
  const router = Router();

  router.get('/health', (_req: Request, res: Response) => {
    res.json(buildReadiness(deps));
  });

  return router;
}
