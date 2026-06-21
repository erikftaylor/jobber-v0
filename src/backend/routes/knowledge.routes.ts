import express, { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuid } from 'uuid';
import { DatabaseService } from '../services/database.service';
import { DocumentParserService } from '../services/document-parser.service';
import { CareerModelService } from '../services/career-model.service';
import { pdfGenerator } from '../services/pdf-generator.service';
import { GenerateResumeUseCase } from '../use-cases/generate-resume.usecase';
import type { GeneratedMaterialRepository } from '../repositories/generated-material.repository';
import type { Document } from '../../shared/types';

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
  careerModelService?: CareerModelService;
  extractor?: any; // Claude carrier: { claude } — generation calls extractor.claude.call(...)
  materialRepository?: GeneratedMaterialRepository; // persists successful generations
}

export function createKnowledgeRoutes(deps: KnowledgeRouterDeps): Router {
  // Create a fresh router per call so invoking the factory more than once
  // never stacks duplicate route registrations on a shared instance.
  const router = Router();
  const { db, parser } = deps;
  const careerModelService = deps.careerModelService || new CareerModelService();
  const generateResumeUseCase = new GenerateResumeUseCase({
    db,
    extractor: deps.extractor,
    materialRepository: deps.materialRepository,
  });

  // Session Management Routes
  router.get('/sessions', (req: Request, res: Response) => {
    try {
      const sessions = db.listSessions();
      const active = db.getActiveSession();
      res.json({
        success: true,
        sessions,
        activeSession: active,
      });
    } catch (error) {
      console.error('List sessions error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to list sessions',
      });
    }
  });

  router.post('/sessions', (req: Request, res: Response) => {
    try {
      const { name } = req.body;
      if (!name) {
        res.status(400).json({ error: 'Session name required' });
        return;
      }
      const session = db.createSession(name);
      db.setActiveSession(session.id);
      res.json({
        success: true,
        session,
      });
    } catch (error) {
      console.error('Create session error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to create session',
      });
    }
  });

  router.post('/sessions/:id/switch', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      db.setActiveSession(id);
      res.json({
        success: true,
        activeSession: id,
      });
    } catch (error) {
      console.error('Switch session error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to switch session',
      });
    }
  });

  router.delete('/sessions/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (id === 'default') {
        res.status(400).json({ error: 'Cannot delete default session' });
        return;
      }
      db.deleteSession(id);
      res.json({ success: true });
    } catch (error) {
      console.error('Delete session error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to delete session',
      });
    }
  });

  router.post('/clear', (req: Request, res: Response) => {
    try {
      db.clearSession();
      res.json({
        success: true,
        message: 'Session cleared',
      });
    } catch (error) {
      console.error('Clear session error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to clear session',
      });
    }
  });

  // POST /api/kb/upload - Upload a document (stored as context for generation)
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

        // Save to database as context for later use
        const doc = db.saveDocument(documentType, req.file.originalname, rawText);

        console.log(`[Upload] Stored ${documentType}: ${req.file.originalname} (${rawText.length} chars)`);

        res.json({
          success: true,
          message: 'Document stored and ready for tailored generation',
          document: {
            id: doc.id,
            type: doc.type,
            filename: doc.filename,
            uploaded_at: doc.uploaded_at,
            size_chars: rawText.length,
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

  // GET /api/kb - Get documents as context for generation
  router.get('/', (req: Request, res: Response) => {
    try {
      const documents = db.getAllDocuments();

      res.json({
        success: true,
        documents: documents.map(doc => ({
          id: doc.id,
          type: doc.type,
          filename: doc.filename,
          size_chars: doc.raw_text.length,
          uploaded_at: doc.uploaded_at,
        })),
        context: {
          total_documents: documents.length,
          total_chars: documents.reduce((sum, d) => sum + d.raw_text.length, 0),
          ready_for_generation: documents.length > 0,
        },
      });
    } catch (error) {
      console.error('Get KB error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get documents',
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

  // POST /api/kb/pdf - Convert resume HTML to PDF
  router.post('/pdf', async (req: Request, res: Response) => {
    console.log('[PDF] Request received');
    let pdfBuffer: Buffer | null = null;

    try {
      const { html, filename } = req.body;

      if (!html) {
        console.log('[PDF] No HTML provided');
        res.status(400).json({ error: 'HTML resume required' });
        return;
      }

      // Validate HTML is not too large
      if (html.length > 10 * 1024 * 1024) {
        console.log('[PDF] HTML too large');
        res.status(400).json({ error: 'HTML content too large (max 10MB)' });
        return;
      }

      console.log('[PDF] Starting PDF generation, HTML size:', html.length, 'bytes');

      // Generate PDF with timeout
      let timeoutId: NodeJS.Timeout | undefined;
      try {
        const timeoutPromise = new Promise<Buffer>((_, reject) => {
          timeoutId = setTimeout(() => {
            console.error('[PDF] Timeout waiting for PDF generation');
            reject(new Error('PDF generation timeout (30s)'));
          }, 30000);
        });

        pdfBuffer = await Promise.race([
          (async () => {
            console.log('[PDF] Calling pdfGenerator.htmlToPdf');
            const result = await pdfGenerator.htmlToPdf(html, filename);
            console.log('[PDF] htmlToPdf returned:', result?.length, 'bytes');
            return result;
          })(),
          timeoutPromise,
        ]);
      } catch (genErr) {
        console.error('[PDF] Generation error:', genErr);
        throw genErr;
      } finally {
        // Clear the timer once the race settles so a fast success/failure
        // doesn't later fire a false "[PDF] Timeout..." log and reject an
        // already-settled promise.
        if (timeoutId) clearTimeout(timeoutId);
      }

      if (!pdfBuffer || pdfBuffer.length === 0) {
        const emptyErr = 'PDF generation produced empty buffer';
        console.error('[PDF]', emptyErr);
        throw new Error(emptyErr);
      }

      console.log('[PDF] Generated successfully, size:', Math.round(pdfBuffer.length / 1024), 'KB');

      // Return PDF as file download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename || 'resume.pdf'}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.send(pdfBuffer);
      console.log('[PDF] Response sent successfully');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[PDF] Caught error:', errorMsg);
      console.error('[PDF] Error stack:', error instanceof Error ? error.stack : 'no stack');

      // Only send error if headers not already sent
      try {
        if (!res.headersSent) {
          console.log('[PDF] Sending error response');
          res.status(500).json({ error: errorMsg || 'PDF generation failed' });
        } else {
          console.error('[PDF] Headers already sent, cannot send error response');
        }
      } catch (resErr) {
        console.error('[PDF] Error sending response:', resErr);
      }
    }
  });

  // POST /api/kb/docx - Export a saved resume as DOCX
  router.post('/docx', async (req: Request, res: Response) => {
    try {
      const { resumeId } = req.body;

      if (!resumeId) {
        res.status(400).json({ error: 'resumeId is required' });
        return;
      }

      // Look up the saved resume in the database
      const connection = db.getConnection();
      const resume = connection
        .prepare('SELECT id, generated_content FROM generated_resumes WHERE id = ?')
        .get(resumeId) as { id: string; generated_content: string } | undefined;

      if (!resume) {
        res.status(404).json({ error: `Resume ${resumeId} not found` });
        return;
      }

      if (!resume.generated_content || !resume.generated_content.trim()) {
        res.status(400).json({ error: 'Resume content is empty' });
        return;
      }

      // Generate DOCX from the resume content
      const { docxGeneratorService } = await import('../services/docx-generator.service');
      const docxBuffer = await docxGeneratorService.generate(resume.generated_content);

      // Set response headers for file download
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      res.setHeader('Content-Disposition', 'attachment; filename="resume.docx"');
      res.setHeader('Content-Length', docxBuffer.length);

      // Send the DOCX buffer
      res.send(docxBuffer);
    } catch (error) {
      console.error('DOCX export error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'DOCX export failed',
      });
    }
  });

  // POST /api/kb/generate - Generate tailored resume for a job description
  router.post('/generate', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { statusCode, body } = await generateResumeUseCase.execute(req.body);
      res.status(statusCode).json(body);
    } catch (error) {
      next(error);
    }
  });

  // Career Model Routes
  // GET /api/kb/career-model - Get current career model and stale status
  router.get('/career-model', (req: Request, res: Response) => {
    try {
      const documents = db.getAllDocuments();
      const sourceHash = careerModelService.hashSources(documents);
      const latestModel = db.getLatestCareerModel();

      // Determine if stale
      let stale = false;
      if (documents.length > 0 && !latestModel) {
        // Documents exist but no model
        stale = true;
      } else if (latestModel && latestModel.source_hash !== sourceHash) {
        // Model exists but hash doesn't match
        stale = true;
      }
      // If no documents, stale = false (nothing to build)

      res.json({
        success: true,
        careerModel: latestModel || null,
        stale,
        sourceDocumentCount: documents.length,
        sourceHash: documents.length > 0 ? sourceHash : null,
      });
    } catch (error) {
      console.error('Get career model error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get career model',
      });
    }
  });

  // POST /api/kb/career-model/rebuild - Extract and persist a new career model
  router.post('/career-model/rebuild', (req: Request, res: Response) => {
    try {
      const documents = db.getAllDocuments();

      if (documents.length === 0) {
        res.status(400).json({
          error: 'No documents uploaded. Upload at least one document before building a career model.',
        });
        return;
      }

      const activeSessionId = db.getActiveSession();
      const careerModel = careerModelService.buildFromDocuments(activeSessionId, documents);

      // Persist the model
      const persistedModel = db.createCareerModel({
        source_document_ids: careerModel.source_document_ids,
        source_hash: careerModel.source_hash,
        model_json: careerModel.model_json,
        model_version: careerModel.model_version,
      });

      res.json({
        success: true,
        careerModel: persistedModel,
        sourceDocumentCount: documents.length,
        rebuilt: true,
      });
    } catch (error) {
      console.error('Rebuild career model error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to rebuild career model',
      });
    }
  });

  // GET /api/kb/career-models - List career model versions (newest first)
  router.get('/career-models', (req: Request, res: Response) => {
    try {
      const models = db.listCareerModels();

      res.json({
        success: true,
        careerModels: models,
        count: models.length,
      });
    } catch (error) {
      console.error('List career models error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to list career models',
      });
    }
  });

  return router;
}
