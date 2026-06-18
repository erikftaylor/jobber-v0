/**
 * Career Context service.
 *
 * Makes the raw-document career context that /generate has always used an
 * explicit, named boundary. For v1 it preserves the existing behavior exactly:
 * the same `[TYPE: filename]\n<text>` blocks joined by `\n\n---\n\n`.
 */

export type RawCareerDocument = {
  id?: string;
  filename: string;
  type?: string;
  content: string;
};

export type CareerContext = {
  mode: 'raw-documents';
  documents: RawCareerDocument[];
  rawContextText: string;
  documentCount: number;
};

/** Minimal shape this service reads from the persisted document model. */
type SourceDocument = {
  id?: string;
  type: string;
  filename: string;
  raw_text: string;
};

export class CareerContextService {
  /**
   * Build the raw-document career context.
   *
   * Output is byte-for-byte identical to the inline assembly /generate used
   * before this extraction.
   */
  build(documents: SourceDocument[]): CareerContext {
    // Career context is intentionally built from uploaded raw documents.
    const docs: RawCareerDocument[] = documents.map(d => ({
      id: d.id,
      filename: d.filename,
      type: d.type,
      content: d.raw_text,
    }));

    const rawContextText = docs
      .map(doc => `[${(doc.type ?? '').toUpperCase()}: ${doc.filename}]\n${doc.content}`)
      .join('\n\n---\n\n');

    return {
      mode: 'raw-documents',
      documents: docs,
      rawContextText,
      documentCount: docs.length,
    };
  }
}

export const careerContextService = new CareerContextService();
