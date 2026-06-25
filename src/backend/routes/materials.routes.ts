import { Router, Request, Response } from 'express';
import type {
  GeneratedMaterial,
  GeneratedMaterialRepository,
} from '../repositories/generated-material.repository';

interface MaterialRoutesDeps {
  repository: Pick<GeneratedMaterialRepository, 'list' | 'getById'>;
}

/** Stable, reopen-focused response shape (snake_case, matching the API style). */
function toResponse(m: GeneratedMaterial) {
  return {
    id: m.id,
    type: m.type,
    title: m.title,
    generated_content: m.generatedContent,
    formatted_html: m.renderedHtml,
    quality_report: m.qualityReportJson ?? null,
    created_at: m.createdAt,
  };
}

/**
 * Reopen endpoints for saved résumé artifacts.
 *   GET /api/materials      -> { success, materials: [...] }
 *   GET /api/materials/:id  -> { success, material } | 404 { error }
 */
export function createMaterialRoutes(deps: MaterialRoutesDeps): Router {
  const router = Router();
  const { repository } = deps;

  router.get('/', (_req: Request, res: Response) => {
    const materials = repository.list().map(toResponse);
    res.json({ success: true, materials });
  });

  router.get('/:id', (req: Request, res: Response) => {
    const material = repository.getById(req.params.id);
    if (!material) {
      res.status(404).json({ error: 'Material not found' });
      return;
    }
    res.json({ success: true, material: toResponse(material) });
  });

  return router;
}
