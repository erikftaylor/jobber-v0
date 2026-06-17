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

      // Validate HTML is not too large
      if (html.length > 10 * 1024 * 1024) {
        res.status(400).json({ error: 'HTML content too large (max 10MB)' });
        return;
      }

      console.log('[PDF] Generating PDF from HTML, size:', html.length, 'bytes');

      // Import PDF generator
      const { pdfGenerator } = await import('../services/pdf-generator.service');

      try {
        const pdfBuffer = await Promise.race([
          pdfGenerator.htmlToPdf(html, filename),
          new Promise<Buffer>((_, reject) =>
            setTimeout(() => reject(new Error('PDF generation timeout (30s)')), 30000)
          ),
        ]);

        console.log('[PDF] Generated PDF, size:', Math.round(pdfBuffer.length / 1024), 'KB');

        // Return PDF as file download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename || 'resume.pdf'}"`);
        res.send(pdfBuffer);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error('[PDF] Generation error:', errorMsg);
        throw err;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to generate PDF';
      console.error('[PDF] Request error:', errorMsg);

      // Don't crash the server, return 500 with error message
      if (!res.headersSent) {
        res.status(500).json({
          error: errorMsg || 'PDF generation failed. Please try again.',
        });
      }
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

      const prompt = `You are an executive resume writer specializing in modern Product Design and UX resumes.

Write a single-page executive resume based on the candidate's background documents and the target job description.

CRITICAL FORMATTING RULES:
- Exactly 5 bullet points for the current/most recent role
- Exactly 4 bullet points for previous roles
- Exactly 3 bullet points for older roles
- Summary: maximum 65 words (positioning statement, not objective)
- Expertise: maximum 8 items, displayed as a vertical list
- Every bullet MUST start with a strong action verb
- No weak openers: never use "responsible for", "helped", "worked on", "participated in"
- Every bullet describes a meaningful problem solved with measurable impact
- Bullets read naturally in 1-2 lines
- Single column, left-aligned layout

SECTION ORDER (EXACTLY):
NAME
SUMMARY
CORE EXPERTISE
PROFESSIONAL EXPERIENCE
EDUCATION

STYLE GUIDE:
Summary: Executive positioning statement, not a job objective. Example:
"Senior Product Designer with 8+ years designing complex enterprise and AI-native products. Expert in systems thinking, research, and transforming ambiguous problems into intuitive experiences."

Strong action verbs to use:
Architected, Designed, Established, Embedded, Facilitated, Conducted, Transformed, Streamlined, Reduced, Created

Format output exactly as:

[CANDIDATE NAME]

SUMMARY
[Executive positioning statement, max 65 words]

CORE EXPERTISE
[Skill 1]
[Skill 2]
[Skill 3]
[Up to 8 items]

PROFESSIONAL EXPERIENCE

[Job Title]
[Start Date] – [End Date]
• [Strong action verb] [problem solved] [measurable impact]
• [Next achievement...]

[Repeat for other roles with exactly 4 or 3 bullets as appropriate]

EDUCATION
[Degree] • [School] • [Year]

---

CANDIDATE'S BACKGROUND:
${documentContext}

TARGET JOB DESCRIPTION:
${job_description}

Now write the tailored executive resume following these rules exactly:`;

      console.log(`[Generate] Creating resume from ${documents.length} documents`);

      const response = await deps.extractor.claude.call(prompt);

      console.log(`[Generate] Generated resume content`);

      try {
        // Parse generated text into structured resume
        console.log('[Generate] Importing parser...');
        const { resumeParser } = await import('../services/resume-parser.service');
        console.log('[Generate] Parsing resume text...');
        const structuredResume = resumeParser.parse(response.content);
        console.log('[Generate] Parsed successfully');

        // Pass through Resume Output Engine for formatting and validation
        console.log('[Generate] Importing Resume Output Engine...');
        const { resumeOutputEngine } = await import('../services/resume-output-engine.service');
        console.log('[Generate] Generating formatted resume...');
        const output = resumeOutputEngine.generate(structuredResume);
        console.log(`[Generate] Resume formatted: ${output.stats.experienceRoles} roles, ${output.stats.summaryWords} summary words, ${output.stats.estimatedPages} pages`);

        res.json({
          success: true,
          material_type: 'resume',
          generated_content: response.content,
          formatted_html: output.html, // ATS-formatted HTML for PDF
          based_on_documents: documents.length,
          stats: output.stats,
          validation: {
            valid: output.validation.valid,
            warnings: output.validation.warnings,
          },
        });
      } catch (formatError) {
        const errorMsg = formatError instanceof Error ? formatError.message : String(formatError);
        const errorStack = formatError instanceof Error ? formatError.stack : '';
        console.error('[Generate] Formatting error:', errorMsg);
        if (errorStack) console.error('[Generate] Stack:', errorStack);
        // Fallback: return raw content without formatting
        res.json({
          success: true,
          material_type: 'resume',
          generated_content: response.content,
          formatted_html: null,
          based_on_documents: documents.length,
          formatting_error: errorMsg,
        });
      }
    } catch (error) {
      console.error('Generate error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to generate materials',
      });
    }
  });

  return router;
}
