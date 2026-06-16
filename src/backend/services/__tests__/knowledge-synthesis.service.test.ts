import { describe, it, expect } from 'vitest';
import { KnowledgeSynthesisService } from '../knowledge-synthesis.service';
import type { Skill, Achievement, Technology, WritingStyle, Value } from '../../../shared/types';

describe('KnowledgeSynthesisService', () => {
  const service = new KnowledgeSynthesisService();

  describe('dedupeSkills', () => {
    it('should merge skills with same name from multiple documents', () => {
      const extractions = [
        {
          skills: [
            {
              id: 'skill-1',
              name: 'TypeScript',
              category: 'backend' as const,
              years_experience: 8,
              confidence: 0.95,
              source_document_id: 'doc-1',
              source_excerpt: 'TypeScript 8 years',
              source_refs_json: [
                { document_id: 'doc-1', excerpt: 'TypeScript 8 years', confidence: 0.95 },
              ],
            },
          ],
          achievements: [],
          technologies: [],
          writingStyle: { tone: 'professional' as const, voice_markers: [], examples: [], confidence: 0, source_refs_json: [] },
          values: [],
        },
        {
          skills: [
            {
              id: 'skill-2',
              name: 'typescript',
              category: 'backend' as const,
              years_experience: 9,
              confidence: 0.9,
              source_document_id: 'doc-2',
              source_excerpt: 'TypeScript 9 years',
              source_refs_json: [
                { document_id: 'doc-2', excerpt: 'TypeScript 9 years', confidence: 0.9 },
              ],
            },
          ],
          achievements: [],
          technologies: [],
          writingStyle: { tone: 'professional' as const, voice_markers: [], examples: [], confidence: 0, source_refs_json: [] },
          values: [],
        },
      ];

      const result = service.synthesize(extractions as any);

      expect(result.skills).toHaveLength(1);
      expect(result.skills[0].name).toBe('TypeScript');
      expect(result.skills[0].years_experience).toBe(9); // Max of 8 and 9
      expect(result.skills[0].confidence).toBeCloseTo(0.925); // Average of 0.95 and 0.9
      expect(result.skills[0].source_refs_json).toHaveLength(2); // Both sources
    });

    it('should preserve source grounding after merge', () => {
      const extractions = [
        {
          skills: [
            {
              id: 'skill-1',
              name: 'React',
              category: 'frontend' as const,
              confidence: 0.9,
              source_document_id: 'resume.pdf',
              source_excerpt: 'React expert',
              source_refs_json: [
                { document_id: 'resume.pdf', excerpt: 'React expert', confidence: 0.9 },
              ],
            },
          ],
          achievements: [],
          technologies: [],
          writingStyle: { tone: 'professional' as const, voice_markers: [], examples: [], confidence: 0, source_refs_json: [] },
          values: [],
        },
      ];

      const result = service.synthesize(extractions as any);

      expect(result.skills[0].source_document_id).toBe('resume.pdf');
      expect(result.skills[0].source_excerpt).toBe('React expert');
      expect(result.skills[0].source_refs_json[0].document_id).toBe('resume.pdf');
    });
  });

  describe('dedupeAchievements', () => {
    it('should merge achievements with same title', () => {
      const extractions = [
        {
          skills: [],
          achievements: [
            {
              id: 'ach-1',
              title: 'Led team project',
              context: 'Delivered payment system',
              metrics: ['95% reduction', '40% faster'],
              skills_demonstrated: ['leadership', 'planning'],
              confidence: 0.9,
              source_document_id: 'resume.pdf',
              source_excerpt: 'Led team',
              source_refs_json: [],
            },
          ],
          technologies: [],
          writingStyle: { tone: 'professional' as const, voice_markers: [], examples: [], confidence: 0, source_refs_json: [] },
          values: [],
        },
        {
          skills: [],
          achievements: [
            {
              id: 'ach-2',
              title: 'led team project',
              context: 'Same context',
              metrics: ['95% reduction', 'improved UX'],
              skills_demonstrated: ['teamwork'],
              confidence: 0.85,
              source_document_id: 'cover-letter.docx',
              source_excerpt: 'led team',
              source_refs_json: [],
            },
          ],
          technologies: [],
          writingStyle: { tone: 'professional' as const, voice_markers: [], examples: [], confidence: 0, source_refs_json: [] },
          values: [],
        },
      ];

      const result = service.synthesize(extractions as any);

      expect(result.achievements).toHaveLength(1);
      expect(result.achievements[0].metrics.sort()).toEqual([
        '40% faster',
        '95% reduction',
        'improved UX',
      ].sort());
      expect(result.achievements[0].skills_demonstrated.sort()).toEqual([
        'leadership',
        'planning',
        'teamwork',
      ].sort());
    });
  });

  describe('dedupeTechnologies', () => {
    it('should use highest proficiency level', () => {
      const extractions = [
        {
          skills: [],
          achievements: [],
          technologies: [
            {
              id: 'tech-1',
              name: 'Docker',
              proficiency: 'intermediate' as const,
              confidence: 0.8,
              source_document_id: 'doc-1',
              source_excerpt: 'Docker',
              source_refs_json: [],
            },
          ],
          writingStyle: { tone: 'professional' as const, voice_markers: [], examples: [], confidence: 0, source_refs_json: [] },
          values: [],
        },
        {
          skills: [],
          achievements: [],
          technologies: [
            {
              id: 'tech-2',
              name: 'docker',
              proficiency: 'expert' as const,
              confidence: 0.95,
              source_document_id: 'doc-2',
              source_excerpt: 'Docker expert',
              source_refs_json: [],
            },
          ],
          writingStyle: { tone: 'professional' as const, voice_markers: [], examples: [], confidence: 0, source_refs_json: [] },
          values: [],
        },
      ];

      const result = service.synthesize(extractions as any);

      expect(result.technologies).toHaveLength(1);
      expect(result.technologies[0].proficiency).toBe('expert');
    });
  });

  describe('synthesizeWritingStyle', () => {
    it('should aggregate writing style from multiple documents', () => {
      const extractions = [
        {
          skills: [],
          achievements: [],
          technologies: [],
          writingStyle: {
            tone: 'professional' as const,
            voice_markers: ['concise', 'data-driven'],
            examples: ['example1'],
            confidence: 0.9,
            source_refs_json: [],
          },
          values: [],
        },
        {
          skills: [],
          achievements: [],
          technologies: [],
          writingStyle: {
            tone: 'professional' as const,
            voice_markers: ['clear', 'action-oriented'],
            examples: ['example2'],
            confidence: 0.85,
            source_refs_json: [],
          },
          values: [],
        },
      ];

      const result = service.synthesize(extractions as any);

      expect(result.writingStyle.tone).toBe('professional');
      expect(result.writingStyle.voice_markers).toContain('concise');
      expect(result.writingStyle.voice_markers).toContain('data-driven');
      expect(result.writingStyle.voice_markers).toContain('clear');
      expect(result.writingStyle.examples).toHaveLength(2);
      expect(result.writingStyle.confidence).toBeCloseTo(0.875);
    });
  });

  describe('dedupeValues', () => {
    it('should merge values with same text', () => {
      const extractions = [
        {
          skills: [],
          achievements: [],
          technologies: [],
          writingStyle: { tone: 'professional' as const, voice_markers: [], examples: [], confidence: 0, source_refs_json: [] },
          values: [
            {
              value: 'Continuous Learning',
              confidence: 0.9,
              source_document_id: 'resume.pdf',
              source_excerpt: 'continuous learning',
              source_refs_json: [
                { document_id: 'resume.pdf', excerpt: 'continuous learning', confidence: 0.9 },
              ],
            },
          ],
        },
        {
          skills: [],
          achievements: [],
          technologies: [],
          writingStyle: { tone: 'professional' as const, voice_markers: [], examples: [], confidence: 0, source_refs_json: [] },
          values: [
            {
              value: 'continuous learning',
              confidence: 0.85,
              source_document_id: 'linkedin.txt',
              source_excerpt: 'continuous learning',
              source_refs_json: [
                { document_id: 'linkedin.txt', excerpt: 'continuous learning', confidence: 0.85 },
              ],
            },
          ],
        },
      ];

      const result = service.synthesize(extractions as any);

      expect(result.values).toHaveLength(1);
      expect(result.values[0].value).toBe('Continuous Learning');
      expect(result.values[0].confidence).toBeCloseTo(0.875);
      expect(result.values[0].source_refs_json).toHaveLength(2);
    });
  });

  describe('empty inputs', () => {
    it('should handle empty extractions gracefully', () => {
      const result = service.synthesize([]);

      expect(result.skills).toEqual([]);
      expect(result.achievements).toEqual([]);
      expect(result.technologies).toEqual([]);
      expect(result.values).toEqual([]);
      expect(result.writingStyle.tone).toBe('professional');
      expect(result.writingStyle.confidence).toBe(0);
    });
  });
});
