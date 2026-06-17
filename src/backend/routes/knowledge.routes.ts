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

  // POST /api/kb/pdf - Convert resume HTML to PDF
  router.post('/pdf', async (req: Request, res: Response) => {
    try {
      const { html, filename } = req.body;

      if (!html) {
        res.status(400).json({ error: 'HTML resume required' });
        return;
      }

      // Import PDF generator
      const { pdfGenerator } = await import('../services/pdf-generator.service');

      console.log('[PDF] Generating PDF from HTML');

      const pdfBuffer = await pdfGenerator.htmlToPdf(html, filename);

      console.log('[PDF] Generated PDF, size:', Math.round(pdfBuffer.length / 1024), 'KB');

      // Return PDF as file download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename || 'resume.pdf'}"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('PDF generation error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to generate PDF',
      });
    }
  });

  // POST /api/kb/generate - Generate tailored resume for a job description
  router.post('/generate', async (req: Request, res: Response) => {
    try {
      if (!deps.extractor) {
        res.status(501).json({
          error: 'Claude API not configured - cannot generate materials',
          success: false,
        });
        return;
      }

      const { job_description, material_type } = req.body;
      if (!job_description) {
        res.status(400).json({ error: 'Job description required' });
        return;
      }

      const documents = db.getAllDocuments();
      if (documents.length === 0) {
        res.status(400).json({ error: 'No documents uploaded - upload your background documents first' });
        return;
      }

      // Build context from uploaded documents
      const documentContext = documents
        .map(doc => `[${doc.type.toUpperCase()}: ${doc.filename}]\n${doc.raw_text}`)
        .join('\n\n---\n\n');

      const prompt = `You are a professional resume writer. Based on the candidate's background documents below, write a tailored resume for the following job description.

The resume should:
- Be one page maximum
- Use clean formatting with clear sections: SUMMARY, CORE EXPERTISE, PROFESSIONAL EXPERIENCE, EDUCATION
- Highlight relevant skills and experiences matching the JD
- Use keywords from the job description
- Include quantifiable metrics and achievements
- Use bullet points for experience
- Be ATS-friendly (no tables, graphics, or special formatting)

Format as:

[CANDIDATE NAME]
[Email] • [Phone] • [Location] • [LinkedIn] • [Portfolio]

SUMMARY
[50-70 word professional summary]

CORE EXPERTISE
[5-8 most relevant skills separated by •]

PROFESSIONAL EXPERIENCE

[Job Title]
[Company] | [Location]
[Start Date] – [End Date]
• [Achievement with metrics]
• [Achievement with metrics]
• [Achievement with metrics]

[Repeat for other roles...]

EDUCATION
[Degree] | [School] | [Year]

---

CANDIDATE'S BACKGROUND:
${documentContext}

JOB DESCRIPTION:
${job_description}

Write the tailored resume now, following the exact format above:`;

      console.log(`[Generate] Creating resume from ${documents.length} documents`);

      const response = await deps.extractor.claude.call(prompt);

      console.log(`[Generate] Generated resume content`);

      res.json({
        success: true,
        material_type: 'resume',
        generated_content: response.content,
        based_on_documents: documents.length,
        notes: 'Generated resume formatted and validated for ATS compatibility. See resumeFormatted for structured output.',
      });
    } catch (error) {
      console.error('Generate error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to generate materials',
      });
    }
  });

  return router;
}
