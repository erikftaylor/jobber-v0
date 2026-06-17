import express, { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuid } from 'uuid';
import { DatabaseService } from '../services/database.service';
import { DocumentParserService } from '../services/document-parser.service';
import type { Document } from '../../shared/types';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  dest: path.join(process.cwd(), 'uploads'),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.docx', '.doc', '.txt', '.md'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not supported: ${ext}`));
    }
  },
});

interface KnowledgeRouterDeps {
  db: DatabaseService;
  parser: DocumentParserService;
  extractor?: any; // KnowledgeExtractionService
  synthesizer?: any; // KnowledgeSynthesisService
}

export function createKnowledgeRoutes(deps: KnowledgeRouterDeps): Router {
  const { db, parser } = deps;

  // POST /api/kb/upload - Upload a document
  router.post(
    '/upload',
    upload.single('file'),
    async (req: Request, res: Response) => {
      try {
        if (!req.file) {
          res.status(400).json({ error: 'No file uploaded' });
          return;
        }

        const documentType = (req.body.type as Document['type']) || 'resume';
        if (!['resume', 'cover_letter', 'case_study', 'linkedin', 'portfolio'].includes(documentType)) {
          res.status(400).json({ error: 'Invalid document type' });
          return;
        }

        // Parse the uploaded file
        const rawText = await parser.parseFile(req.file.path, req.file.originalname);

        // Save to database
        const doc = db.saveDocument(documentType, req.file.originalname, rawText);

        res.json({
          success: true,
          document: {
            id: doc.id,
            type: doc.type,
            filename: doc.filename,
            uploaded_at: doc.uploaded_at,
          },
        });
      } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Upload failed',
        });
      }
    }
  );

  // GET /api/kb - Get current knowledge base
  router.get('/', (req: Request, res: Response) => {
    try {
      const kb = db.getKnowledgeBase();
      if (!kb) {
        res.status(404).json({ error: 'Knowledge base not found' });
        return;
      }

      res.json({
        success: true,
        knowledgeBase: kb,
      });
    } catch (error) {
      console.error('Get KB error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get knowledge base',
      });
    }
  });

  // GET /api/kb/documents - Get all uploaded documents
  router.get('/documents', (req: Request, res: Response) => {
    try {
      const docs = db.getAllDocuments();
      res.json({
        success: true,
        documents: docs.map(doc => ({
          id: doc.id,
          type: doc.type,
          filename: doc.filename,
          uploaded_at: doc.uploaded_at,
          parsed_at: doc.parsed_at,
        })),
      });
    } catch (error) {
      console.error('Get documents error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get documents',
      });
    }
  });

  // DELETE /api/kb/documents/:id - Delete a document
  router.delete('/documents/:id', (req: Request, res: Response) => {
    try {
      db.deleteDocument(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Delete document error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to delete document',
      });
    }
  });

  // POST /api/kb/refresh - Extract and synthesize knowledge from all documents
  router.post('/refresh', async (req: Request, res: Response) => {
    try {
      if (!deps.extractor || !deps.synthesizer) {
        console.warn('[KB Refresh] Claude API key not configured');
        res.status(501).json({
          error: 'Extraction not available - Claude API key not configured',
          success: false,
        });
        return;
      }

      const documents = db.getAllDocuments();
      console.log(`[KB Refresh] Starting extraction for ${documents.length} documents`);

      if (documents.length === 0) {
        console.log('[KB Refresh] No documents to extract');
        res.json({
          success: true,
          message: 'No documents to extract from',
          extractedDocuments: 0,
        });
        return;
      }

      // Extract knowledge from each document
      console.log('[KB Refresh] Extracting knowledge from documents...');
      const extractions = await Promise.all(
        documents.map(doc => {
          console.log(`[KB Refresh] Extracting from ${doc.filename}...`);
          return deps.extractor.extractFromDocument(doc.id, doc.raw_text, doc.filename);
        })
      );

      // Check if anything was extracted
      const totalSkills = extractions.reduce((sum, e) => sum + e.skills.length, 0);
      const totalAchievements = extractions.reduce((sum, e) => sum + e.achievements.length, 0);
      const totalTechs = extractions.reduce((sum, e) => sum + e.technologies.length, 0);

      console.log(
        `[KB Refresh] Extracted: ${totalSkills} skills, ${totalAchievements} achievements, ${totalTechs} technologies`
      );

      // Synthesize all extractions
      const synthesized = deps.synthesizer.synthesize(extractions);

      // Update knowledge base
      const updated = db.updateKnowledgeBase(
        synthesized.skills,
        synthesized.achievements,
        synthesized.technologies,
        synthesized.writingStyle,
        synthesized.values,
        new Date(),
        new Date()
      );

      const message =
        totalSkills + totalAchievements + totalTechs > 0
          ? `Successfully extracted knowledge: ${totalSkills} skills, ${totalAchievements} achievements, ${totalTechs} technologies`
          : 'Extraction completed but no structured data found. Documents may not contain clear skill, achievement, or technology information.';

      console.log(`[KB Refresh] Completed. ${message}`);

      res.json({
        success: true,
        message,
        knowledgeBase: updated,
        extractedDocuments: documents.length,
        stats: {
          skills: totalSkills,
          achievements: totalAchievements,
          technologies: totalTechs,
        },
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[KB Refresh ERROR]:', errorMsg);
      res.status(500).json({
        error: errorMsg,
        success: false,
        message: 'Failed to refresh knowledge base',
      });
    }
  });

  return router;
}
