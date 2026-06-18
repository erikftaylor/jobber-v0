/**
 * Generate Resume use case.
 *
 * Holds the orchestration that previously lived inline in the POST /generate
 * route: load source documents, delegate career-context assembly and prompt
 * construction to dedicated services, prompt Claude, parse the response, run it
 * through the Resume Output Engine, and return the ATS-safe HTML plus the JSON
 * shape the frontend expects.
 *
 * Behavior is intentionally unchanged from the old route. Expected outcomes
 * (missing Claude config, missing input, missing documents, success, and the
 * formatting fallback) are returned as { statusCode, body } so the route stays
 * thin while preserving the exact status codes. Only genuinely unexpected
 * failures (e.g. the Claude call rejecting) are thrown, so the route can hand
 * them to next(error) and the centralized error handler.
 */

import { createHash } from 'crypto';
import { resumeParser } from '../services/resume-parser.service';
import { resumeOutputEngine } from '../services/resume-output-engine.service';
import { careerContextService } from '../services/career-context.service';
import { resumePromptBuilderService } from '../services/resume-prompt-builder.service';
import type { DatabaseService } from '../services/database.service';
import type { CreateGeneratedMaterialInput } from '../repositories/generated-material.repository';

interface ClaudeLike {
  call(prompt: string, systemPrompt?: string): Promise<{ content: string }>;
}

interface ExtractorLike {
  claude: ClaudeLike;
}

interface MaterialRepositoryLike {
  create(input: CreateGeneratedMaterialInput): { id: string };
}

export interface GenerateResumeDeps {
  db: Pick<DatabaseService, 'getAllDocuments'>;
  extractor?: ExtractorLike;
  // Optional: when present, successful generations are persisted as durable
  // artifacts. Saving is best-effort and never blocks returning the résumé.
  materialRepository?: MaterialRepositoryLike;
}

export interface GenerateResumeRequest {
  job_description?: string;
  material_type?: string;
}

export interface GenerateResumeResult {
  statusCode: number;
  body: Record<string, unknown>;
}

export class GenerateResumeUseCase {
  constructor(private deps: GenerateResumeDeps) {}

  async execute(body: GenerateResumeRequest = {}): Promise<GenerateResumeResult> {
    const { db, extractor } = this.deps;

    if (!extractor) {
      return {
        statusCode: 501,
        body: {
          error: 'Claude API not configured - cannot generate materials',
          success: false,
        },
      };
    }

    const { job_description } = body ?? {};
    if (!job_description) {
      return { statusCode: 400, body: { error: 'Job description required' } };
    }

    const documents = db.getAllDocuments();
    if (documents.length === 0) {
      return {
        statusCode: 400,
        body: { error: 'No documents uploaded - upload your background documents first' },
      };
    }

    const careerContext = careerContextService.build(documents);
    const prompt = resumePromptBuilderService.buildResumePrompt({
      careerContext,
      jobDescription: job_description,
    });

    console.log(`[Generate] Creating resume from ${documents.length} documents`);

    const response = await extractor.claude.call(prompt);

    console.log(`[Generate] Generated resume content`);

    try {
      // Parse generated text into structured resume
      console.log('[Generate] Parsing resume text...');
      const structuredResume = resumeParser.parse(response.content);
      console.log('[Generate] Parsed successfully');

      // Pass through Resume Output Engine for formatting and validation
      console.log('[Generate] Generating formatted resume...');
      const output = resumeOutputEngine.generate(structuredResume);
      console.log(
        `[Generate] Resume formatted: ${output.stats.experienceRoles} roles, ${output.stats.summaryWords} summary words, ${output.stats.estimatedPages} pages`
      );

      const saved = this.persistArtifact({
        title: this.buildTitle(job_description),
        jobDescriptionHash: this.hashJobDescription(job_description),
        sourceDocumentIds: documents.map(d => d.id),
        generatedContent: response.content,
        structuredResumeJson: output.normalized,
        renderedHtml: output.html,
      });

      return {
        statusCode: 200,
        body: {
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
          ...saved,
        },
      };
    } catch (formatError) {
      const errorMsg = formatError instanceof Error ? formatError.message : String(formatError);
      const errorStack = formatError instanceof Error ? formatError.stack : '';
      console.error('[Generate] Formatting error:', errorMsg);
      if (errorStack) console.error('[Generate] Stack:', errorStack);

      // The text résumé generated successfully, so still persist the artifact.
      const saved = this.persistArtifact({
        title: this.buildTitle(job_description),
        jobDescriptionHash: this.hashJobDescription(job_description),
        sourceDocumentIds: documents.map(d => d.id),
        generatedContent: response.content,
        structuredResumeJson: null,
        renderedHtml: null,
        formattingError: errorMsg,
      });

      // Fallback: return raw content without formatting
      return {
        statusCode: 200,
        body: {
          success: true,
          material_type: 'resume',
          generated_content: response.content,
          formatted_html: null,
          based_on_documents: documents.length,
          formatting_error: errorMsg,
          ...saved,
        },
      };
    }
  }

  /**
   * Best-effort artifact persistence. A save failure never hides the generated
   * résumé from the user — it surfaces as a non-breaking `artifact_save_error`.
   */
  private persistArtifact(
    input: CreateGeneratedMaterialInput
  ): { artifact_id?: string; artifact_save_error?: string } {
    const repo = this.deps.materialRepository;
    if (!repo) return {};
    try {
      const material = repo.create(input);
      return { artifact_id: material.id };
    } catch (saveError) {
      const msg = saveError instanceof Error ? saveError.message : String(saveError);
      console.error('[Generate] Artifact save failed (résumé still returned):', msg);
      return { artifact_save_error: msg };
    }
  }

  private hashJobDescription(jobDescription: string): string {
    return createHash('sha256').update(jobDescription).digest('hex');
  }

  private buildTitle(jobDescription: string): string {
    const firstLine = jobDescription.split('\n').map(l => l.trim()).find(Boolean) ?? '';
    const snippet = firstLine.slice(0, 80).trim();
    return snippet ? `Resume — ${snippet}` : 'Generated Resume';
  }
}
