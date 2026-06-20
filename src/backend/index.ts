import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { DatabaseService } from './services/database.service';
import { DocumentParserService } from './services/document-parser.service';
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
// Minimal carrier: the generation path only needs `extractor.claude.call(...)`.
const extractor = { claude };
const materialRepository = new GeneratedMaterialRepository(db.getConnection());

// Middleware
app.use(express.json());
app.use(express.static(path.join(process.cwd(), 'dist')));

// API Routes
app.use('/api/kb', createKnowledgeRoutes({ db, parser, extractor, materialRepository }));
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

const server = app.listen(port, () => {
  console.log(`Jobber server listening on port ${port}`);
  console.log(`Open http://localhost:${port} in your browser`);
});

// Graceful shutdown: stop accepting connections, then checkpoint + close the DB
// so committed writes are flushed from the WAL into jobber.db instead of being
// left only in jobber.db-wal. Guarded so a slow server.close() can't strand the
// DB unclosed, and so double-signals don't double-close.
let isShuttingDown = false;
function shutdown(signal: NodeJS.Signals): void {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n${signal} received — shutting down gracefully...`);

  const finalize = (code: number) => {
    try {
      db.close(); // runs PRAGMA wal_checkpoint(TRUNCATE) then closes
      console.log('Database checkpointed and closed.');
    } catch (err) {
      console.error('Error closing database during shutdown:', err);
    }
    process.exit(code);
  };

  server.close(() => finalize(0));

  // Don't wait forever on lingering keep-alive connections.
  setTimeout(() => {
    console.error('Shutdown timed out — forcing exit.');
    finalize(1);
  }, 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

export { app, db, parser, extractor };
