import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { DatabaseService } from './services/database.service';
import { DocumentParserService } from './services/document-parser.service';
import { KnowledgeExtractionService } from './services/knowledge-extraction.service';
import { KnowledgeSynthesisService } from './services/knowledge-synthesis.service';
import { ClaudeService } from './services/claude.service';
import { createKnowledgeRoutes } from './routes/knowledge.routes';
import { createHealthRoutes } from './routes/health.routes';
import { createMaterialRoutes } from './routes/materials.routes';
import { GeneratedMaterialRepository } from './repositories/generated-material.repository';
import { errorHandler } from './middleware/error-handler';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Initialize services
const db = new DatabaseService();
const parser = new DocumentParserService();
const claude = new ClaudeService();
const extractor = new KnowledgeExtractionService(claude);
const synthesizer = new KnowledgeSynthesisService();
const materialRepository = new GeneratedMaterialRepository(db.getConnection());

// Middleware
app.use(express.json());
app.use(express.static(path.join(process.cwd(), 'dist')));

// API Routes
app.use('/api/kb', createKnowledgeRoutes({ db, parser, extractor, synthesizer, materialRepository }));
app.use('/api/materials', createMaterialRoutes({ repository: materialRepository }));

// Health / readiness (cheap, never calls Claude). Claude is "configured" when an
// API key is present — the extractor itself is always constructed.
app.use(
  '/api',
  createHealthRoutes({
    db,
    isClaudeConfigured: () => !!process.env.ANTHROPIC_API_KEY,
  })
);

// Serve React app (catch-all for SPA)
app.use((req, res, next) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(process.cwd(), 'dist/index.html'));
  } else {
    next();
  }
});

// Error handling (must be registered last, with the 4-arg signature)
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Jobber server listening on port ${port}`);
  console.log(`Open http://localhost:${port} in your browser`);
});

export { app, db, parser, extractor, synthesizer };
