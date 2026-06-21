/**
 * Generated Material repository.
 *
 * Persists durable résumé artifacts produced by a successful generation into the
 * `generated_resumes` table so they can be reopened later. Owns its own SQL,
 * mirroring the prepared-statement style of DatabaseService.
 */

import { v4 as uuid } from 'uuid';

/** Minimal structural view of the better-sqlite3 connection this repo uses. */
interface SqliteStatement {
  run(...params: unknown[]): unknown;
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}
interface SqliteConnection {
  prepare(sql: string): SqliteStatement;
}

export interface CreateGeneratedMaterialInput {
  type?: 'resume';
  title: string;
  jobDescriptionHash: string;
  sourceDocumentIds: string[];
  careerModelId?: string;
  generatedContent: string;
  structuredResumeJson: unknown;
  renderedHtml: string | null;
  formattingError?: string;
  formatVersion?: string;
  promptVersion?: string;
  model?: string;
}

export interface GeneratedMaterial {
  id: string;
  type: 'resume';
  title: string;
  jobDescriptionHash: string;
  sourceDocumentIds: string[];
  careerModelId?: string;
  generatedContent: string;
  structuredResumeJson: unknown;
  renderedHtml: string | null;
  formattingError?: string;
  formatVersion?: string;
  promptVersion?: string;
  model?: string;
  createdAt: string;
}

export class GeneratedMaterialRepository {
  constructor(private db: SqliteConnection) {}

  create(input: CreateGeneratedMaterialInput): GeneratedMaterial {
    const id = 'mat-' + uuid().replace(/-/g, '').substring(0, 16);
    const type = input.type ?? 'resume';
    const createdAt = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO generated_resumes (
          id, type, title, job_description_hash, source_document_ids, career_model_id,
          generated_content, structured_resume_json, rendered_html,
          formatting_error, format_version, prompt_version, model, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        type,
        input.title,
        input.jobDescriptionHash,
        JSON.stringify(input.sourceDocumentIds ?? []),
        input.careerModelId ?? null,
        input.generatedContent,
        input.structuredResumeJson == null ? null : JSON.stringify(input.structuredResumeJson),
        input.renderedHtml,
        input.formattingError ?? null,
        input.formatVersion ?? null,
        input.promptVersion ?? null,
        input.model ?? null,
        createdAt
      );

    return {
      id,
      type,
      title: input.title,
      jobDescriptionHash: input.jobDescriptionHash,
      sourceDocumentIds: input.sourceDocumentIds ?? [],
      careerModelId: input.careerModelId,
      generatedContent: input.generatedContent,
      structuredResumeJson: input.structuredResumeJson ?? null,
      renderedHtml: input.renderedHtml,
      formattingError: input.formattingError,
      formatVersion: input.formatVersion,
      promptVersion: input.promptVersion,
      model: input.model,
      createdAt,
    };
  }

  list(): GeneratedMaterial[] {
    const rows = this.db
      .prepare('SELECT * FROM generated_resumes ORDER BY created_at DESC')
      .all() as Record<string, any>[];
    return rows.map(row => this.mapRow(row));
  }

  getById(id: string): GeneratedMaterial | null {
    const row = this.db
      .prepare('SELECT * FROM generated_resumes WHERE id = ?')
      .get(id) as Record<string, any> | undefined;
    return row ? this.mapRow(row) : null;
  }

  private mapRow(row: Record<string, any>): GeneratedMaterial {
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      jobDescriptionHash: row.job_description_hash,
      sourceDocumentIds: JSON.parse(row.source_document_ids),
      careerModelId: row.career_model_id ?? undefined,
      generatedContent: row.generated_content,
      structuredResumeJson: row.structured_resume_json ? JSON.parse(row.structured_resume_json) : null,
      renderedHtml: row.rendered_html ?? null,
      formattingError: row.formatting_error ?? undefined,
      formatVersion: row.format_version ?? undefined,
      promptVersion: row.prompt_version ?? undefined,
      model: row.model ?? undefined,
      createdAt: row.created_at,
    };
  }
}
