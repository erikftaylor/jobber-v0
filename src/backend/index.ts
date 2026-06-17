import express from 'express';
import path from 'path';
import { DatabaseService } from './services/database.service';
import { DocumentParserService } from './services/document-parser.service';
import { KnowledgeExtractionService } from './services/knowledge-extraction.service';
import { KnowledgeSynthesisService } from './services/knowledge-synthesis.service';
import { ClaudeService } from './services/claude.service';
import { createKnowledgeRoutes } from './routes/knowledge.routes';

const app = express();
const port = process.env.PORT || 3000;

// Initialize services
const db = new DatabaseService();
const parser = new DocumentParserService();
const claude = new ClaudeService();
const extractor = new KnowledgeExtractionService(claude);
const synthesizer = new KnowledgeSynthesisService();

// Middleware
app.use(express.json());
app.use(express.static(path.join(process.cwd(), 'dist')));

// API Routes
app.use('/api/kb', createKnowledgeRoutes({ db, parser, extractor, synthesizer }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Serve React app (catch-all for SPA)
app.use((req, res, next) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(process.cwd(), 'dist/index.html'));
  } else {
    next();
  }
});

// Error handling
app.use((err: any, req: express.Request, res: express.Response) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: err.message || 'Internal server error',
  });
});

app.listen(port, () => {
  console.log(`Jobber server listening on port ${port}`);
  console.log(`Open http://localhost:${port} in your browser`);
});

export { app, db, parser, extractor, synthesizer };
