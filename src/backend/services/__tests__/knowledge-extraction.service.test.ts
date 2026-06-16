import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KnowledgeExtractionService } from '../knowledge-extraction.service';
import { ClaudeService } from '../claude.service';

describe('KnowledgeExtractionService', () => {
  let service: KnowledgeExtractionService;
  let mockClaude: ClaudeService;

  const sampleResume = `
    John Doe
    Senior Software Engineer

    Skills:
    - TypeScript (8 years)
    - React (6 years)
    - Node.js (7 years)
    - Team Leadership

    Experience:
    Led a team of 5 developers to deliver a critical payment processing system,
    reducing transaction failures by 95% and improving response time by 40%.

    I value clean code, mentoring junior engineers, and continuous learning.
  `;

  beforeEach(() => {
    mockClaude = new ClaudeService();
    service = new KnowledgeExtractionService(mockClaude);
  });

  it('should extract skills with source grounding', async () => {
    // Mock Claude response
    const mockResponse = {
      content: JSON.stringify({
        skills: [
          {
            name: 'TypeScript',
            category: 'backend',
            years_experience: 8,
            confidence: 0.95,
            excerpt: 'TypeScript (8 years)',
          },
        ],
        achievements: [],
        technologies: [],
        writing_style: { tone: 'professional', voice_markers: [], examples: [], confidence: 0 },
        values: [],
      }),
      stopReason: 'end_turn',
    };

    vi.spyOn(mockClaude, 'call').mockResolvedValue(mockResponse);

    const result = await service.extractFromDocument('doc-123', sampleResume, 'resume.txt');

    expect(result.skills).toHaveLength(1);
    const skill = result.skills[0];
    expect(skill.name).toBe('TypeScript');
    expect(skill.source_document_id).toBe('doc-123');
    expect(skill.source_excerpt).toBe('TypeScript (8 years)');
    expect(skill.confidence).toBe(0.95);
    expect(skill.source_refs_json).toHaveLength(1);
    expect(skill.source_refs_json[0].document_id).toBe('doc-123');
  });

  it('should extract achievements with metrics', async () => {
    const mockResponse = {
      content: JSON.stringify({
        skills: [],
        achievements: [
          {
            title: 'Payment System Implementation',
            context: 'Led team effort',
            metrics: ['95% reduction in failures', '40% faster response'],
            skills_demonstrated: ['leadership', 'problem-solving'],
            confidence: 0.9,
            excerpt: 'reducing transaction failures by 95%',
          },
        ],
        technologies: [],
        writing_style: { tone: 'professional', voice_markers: [], examples: [], confidence: 0 },
        values: [],
      }),
      stopReason: 'end_turn',
    };

    vi.spyOn(mockClaude, 'call').mockResolvedValue(mockResponse);

    const result = await service.extractFromDocument('doc-456', sampleResume, 'resume.txt');

    expect(result.achievements).toHaveLength(1);
    const ach = result.achievements[0];
    expect(ach.title).toBe('Payment System Implementation');
    expect(ach.metrics).toEqual(['95% reduction in failures', '40% faster response']);
    expect(ach.source_document_id).toBe('doc-456');
    expect(ach.confidence).toBe(0.9);
  });

  it('should extract values with confidence', async () => {
    const mockResponse = {
      content: JSON.stringify({
        skills: [],
        achievements: [],
        technologies: [],
        writing_style: { tone: 'professional', voice_markers: [], examples: [], confidence: 0.8 },
        values: [
          {
            value: 'Clean code and best practices',
            confidence: 0.85,
            excerpt: 'I value clean code',
          },
          {
            value: 'Mentoring and team development',
            confidence: 0.85,
            excerpt: 'mentoring junior engineers',
          },
        ],
      }),
      stopReason: 'end_turn',
    };

    vi.spyOn(mockClaude, 'call').mockResolvedValue(mockResponse);

    const result = await service.extractFromDocument('doc-789', sampleResume, 'resume.txt');

    expect(result.values).toHaveLength(2);
    expect(result.values[0].value).toBe('Clean code and best practices');
    expect(result.values[0].confidence).toBe(0.85);
  });

  it('should clamp confidence values to 0-1 range', async () => {
    const mockResponse = {
      content: JSON.stringify({
        skills: [
          {
            name: 'Test Skill',
            category: 'backend',
            confidence: 1.5, // Invalid, should be clamped
            excerpt: 'test',
          },
        ],
        achievements: [],
        technologies: [],
        writing_style: { tone: 'professional', voice_markers: [], examples: [], confidence: -0.5 }, // Invalid
        values: [],
      }),
      stopReason: 'end_turn',
    };

    vi.spyOn(mockClaude, 'call').mockResolvedValue(mockResponse);

    const result = await service.extractFromDocument('doc-000', sampleResume, 'resume.txt');

    expect(result.skills[0].confidence).toBe(1); // Clamped to 1
    expect(result.writingStyle.confidence).toBe(0); // Clamped to 0
  });

  it('should handle Claude API errors gracefully', async () => {
    vi.spyOn(mockClaude, 'call').mockRejectedValue(new Error('API Error'));

    const result = await service.extractFromDocument('doc-fail', sampleResume, 'resume.txt');

    expect(result.skills).toEqual([]);
    expect(result.achievements).toEqual([]);
    expect(result.writingStyle.tone).toBe('professional');
    expect(result.values).toEqual([]);
  });

  it('should generate unique IDs for extracted items', async () => {
    const mockResponse = {
      content: JSON.stringify({
        skills: [
          {
            name: 'Skill 1',
            category: 'backend',
            confidence: 0.9,
            excerpt: 'skill 1',
          },
          {
            name: 'Skill 2',
            category: 'frontend',
            confidence: 0.85,
            excerpt: 'skill 2',
          },
        ],
        achievements: [],
        technologies: [],
        writing_style: { tone: 'professional', voice_markers: [], examples: [], confidence: 0 },
        values: [],
      }),
      stopReason: 'end_turn',
    };

    vi.spyOn(mockClaude, 'call').mockResolvedValue(mockResponse);

    const result = await service.extractFromDocument('doc-ids', sampleResume, 'resume.txt');

    expect(result.skills[0].id).not.toBe(result.skills[1].id);
    expect(result.skills[0].id).toMatch(/^skill-/);
  });
});
