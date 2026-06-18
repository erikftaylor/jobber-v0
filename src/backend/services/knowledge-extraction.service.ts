import { v4 as uuid } from 'uuid';
import { ClaudeService } from './claude.service';
import type {
  Skill,
  Achievement,
  Technology,
  WritingStyle,
  Value,
  SourceRef,
} from '../../shared/types';

interface ExtractionResult {
  skills: Skill[];
  achievements: Achievement[];
  technologies: Technology[];
  writingStyle: WritingStyle;
  values: Value[];
}

const EXTRACTION_PROMPT = `Extract structured knowledge from the following document text.

Document:
<document>
{DOCUMENT_TEXT}
</document>

Extract and return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "skills": [
    {
      "name": "skill name",
      "category": "frontend|backend|design|leadership|other",
      "years_experience": number or null,
      "confidence": 0-1,
      "excerpt": "exact quote from document"
    }
  ],
  "achievements": [
    {
      "title": "achievement title",
      "context": "brief context",
      "metrics": ["metric1", "metric2"],
      "skills_demonstrated": ["skill1", "skill2"],
      "confidence": 0-1,
      "excerpt": "exact quote from document"
    }
  ],
  "technologies": [
    {
      "name": "technology name",
      "proficiency": "beginner|intermediate|expert",
      "confidence": 0-1,
      "excerpt": "exact quote from document"
    }
  ],
  "writing_style": {
    "tone": "professional|conversational|technical",
    "voice_markers": ["marker1", "marker2"],
    "examples": ["example1", "example2"],
    "confidence": 0-1
  },
  "values": [
    {
      "value": "value statement",
      "confidence": 0-1,
      "excerpt": "exact quote from document"
    }
  ]
}

Rules:
- Only extract facts explicitly stated in the document
- confidence 0.9-1.0 = stated explicitly and clear
- confidence 0.7-0.9 = implied but reasonably inferred
- confidence < 0.7 = speculative, omit these
- Excerpt must be exact quotes from the document
- Return empty arrays for categories with no clear evidence`;

export class KnowledgeExtractionService {
  constructor(private claude: ClaudeService) {}

  async extractFromDocument(
    documentId: string,
    documentText: string,
    filename: string
  ): Promise<ExtractionResult> {
    // Truncate document if too long
    const maxChars = 8000;
    const truncatedText =
      documentText.length > maxChars
        ? documentText.substring(0, maxChars) + '\n...[document truncated]'
        : documentText;

    const prompt = EXTRACTION_PROMPT.replace('{DOCUMENT_TEXT}', truncatedText);

    try {
      console.log(`[Extraction] Starting extraction for ${documentId}`);
      const response = await this.claude.call(prompt);
      console.log(`[Extraction] Claude response received for ${documentId}`);
      console.log(`[Extraction] Response content:`, response.content.substring(0, 200));

      const parsed = JSON.parse(response.content);
      console.log(`[Extraction] Parsed JSON successfully for ${documentId}`);

      const result = this.enrichWithSourceGrounding(parsed, documentId, documentText);
      console.log(`[Extraction] Enriched with grounding for ${documentId}: ${result.skills.length} skills, ${result.achievements.length} achievements`);
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[Extraction ERROR] Failed to extract from ${documentId}:`, errorMsg);
      if (error instanceof SyntaxError) {
        console.error('[Extraction ERROR] JSON parse failed - Claude may have returned non-JSON');
      }

      // On failure, return a safe empty extraction. We intentionally do NOT
      // fabricate skills/achievements from keyword matching — every KB fact
      // must stay grounded in the source document.
      return this.emptyExtraction();
    }
  }

  /** A valid, empty extraction result returned when Claude extraction fails. */
  private emptyExtraction(): ExtractionResult {
    return {
      skills: [],
      achievements: [],
      technologies: [],
      writingStyle: {
        tone: 'professional',
        voice_markers: [],
        examples: [],
        confidence: 0,
        source_refs_json: [],
      },
      values: [],
    };
  }

  private enrichWithSourceGrounding(
    extracted: any,
    documentId: string,
    documentText: string
  ): ExtractionResult {
    return {
      skills: (extracted.skills || []).map((s: any) => ({
        id: 'skill-' + uuid().replace(/-/g, '').substring(0, 16),
        name: s.name,
        category: s.category,
        years_experience: s.years_experience,
        confidence: Math.min(1, Math.max(0, s.confidence)),
        source_document_id: documentId,
        source_excerpt: s.excerpt || '',
        source_refs_json: [
          {
            document_id: documentId,
            excerpt: s.excerpt || '',
            confidence: Math.min(1, Math.max(0, s.confidence)),
          },
        ],
      })),

      achievements: (extracted.achievements || []).map((a: any) => ({
        id: 'ach-' + uuid().replace(/-/g, '').substring(0, 16),
        title: a.title,
        context: a.context,
        metrics: a.metrics || [],
        skills_demonstrated: a.skills_demonstrated || [],
        confidence: Math.min(1, Math.max(0, a.confidence)),
        source_document_id: documentId,
        source_excerpt: a.excerpt || '',
        source_refs_json: [
          {
            document_id: documentId,
            excerpt: a.excerpt || '',
            confidence: Math.min(1, Math.max(0, a.confidence)),
          },
        ],
      })),

      technologies: (extracted.technologies || []).map((t: any) => ({
        id: 'tech-' + uuid().replace(/-/g, '').substring(0, 16),
        name: t.name,
        proficiency: t.proficiency,
        confidence: Math.min(1, Math.max(0, t.confidence)),
        source_document_id: documentId,
        source_excerpt: t.excerpt || '',
        source_refs_json: [
          {
            document_id: documentId,
            excerpt: t.excerpt || '',
            confidence: Math.min(1, Math.max(0, t.confidence)),
          },
        ],
      })),

      writingStyle: {
        tone: extracted.writing_style?.tone ?? 'professional',
        voice_markers: extracted.writing_style?.voice_markers ?? [],
        examples: extracted.writing_style?.examples ?? [],
        confidence: Math.min(
          1,
          Math.max(0, extracted.writing_style?.confidence ?? 0)
        ),
        source_refs_json: [
          {
            document_id: documentId,
            excerpt:
              'Inferred from overall document tone and style',
            confidence: Math.min(1, Math.max(0, extracted.writing_style?.confidence ?? 0)),
          },
        ],
      },

      values: (extracted.values || []).map((v: any) => ({
        value: v.value,
        confidence: Math.min(1, Math.max(0, v.confidence)),
        source_document_id: documentId,
        source_excerpt: v.excerpt || '',
        source_refs_json: [
          {
            document_id: documentId,
            excerpt: v.excerpt || '',
            confidence: Math.min(1, Math.max(0, v.confidence)),
          },
        ],
      })),
    };
  }
}
