/**
 * Resume Output Engine Tests
 * Tests for deterministic, ATS-safe resume rendering
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ResumeOutputEngine } from '../resume-output-engine.service';
import { ResumeNormalizer } from '../resume-normalizer.service';
import { ResumeValidator } from '../resume-validator.service';
import type { StructuredResume } from '../../../shared/resumeTypes';
import { RESUME_FORMAT } from '../../../shared/resumeFormat';

describe('Resume Output Engine', () => {
  let engine: ResumeOutputEngine;

  beforeEach(() => {
    engine = new ResumeOutputEngine();
  });

  describe('Section order stability', () => {
    it('should render sections in immutable order', () => {
      const resume: StructuredResume = {
        contact: { name: 'John Doe' },
        summary: { text: 'Experienced engineer' },
        expertise: [{ name: 'JavaScript' }, { name: 'React' }],
        experience: {
          roles: [
            {
              jobTitle: 'Engineer',
              company: 'TechCorp',
              bullets: [{ text: '• Built systems' }],
            },
          ],
        },
        education: [{ school: 'MIT' }],
      };

      const output = engine.generate(resume);
      const html = output.html;

      // Find section positions (only those rendered)
      const summaryPos = html.indexOf('SUMMARY');
      const expertisePos = html.indexOf('CORE EXPERTISE');
      const experiencePos = html.indexOf('PROFESSIONAL EXPERIENCE');
      const educationPos = html.indexOf('EDUCATION');

      // Verify order - sections should appear in spec order
      expect(summaryPos).toBeGreaterThanOrEqual(0);
      expect(expertisePos).toBeGreaterThanOrEqual(0);
      expect(experiencePos).toBeGreaterThanOrEqual(0);
      expect(educationPos).toBeGreaterThanOrEqual(0);

      expect(summaryPos).toBeLessThan(expertisePos);
      expect(expertisePos).toBeLessThan(experiencePos);
      expect(experiencePos).toBeLessThan(educationPos);
    });
  });

  describe('Content normalization', () => {
    it('should truncate summary to max words', () => {
      const resume: StructuredResume = {
        contact: { name: 'John Doe' },
        summary: {
          text: 'This is a very long summary that contains way too many words and should be truncated to the maximum allowed word count to fit on the page ' +
            'without exceeding the specified constraints and limits.',
        },
      };

      const output = engine.generate(resume);
      const wordCount = output.stats.summaryWords;

      expect(wordCount).toBeLessThanOrEqual(RESUME_FORMAT.contentConstraints.summary.maxWords);
    });

    it('should limit skills to max items', () => {
      const skills = Array.from({ length: 30 }, (_, i) => ({ name: `Skill ${i}` }));

      const resume: StructuredResume = {
        contact: { name: 'John Doe' },
        expertise: skills,
      };

      const output = engine.generate(resume);

      expect(output.stats.skillCount).toBeLessThanOrEqual(RESUME_FORMAT.contentConstraints.expertise.maxItems);
    });

    it('should remove weak openers from bullets', () => {
      const resume: StructuredResume = {
        contact: { name: 'John Doe' },
        experience: {
          roles: [
            {
              jobTitle: 'Engineer',
              company: 'Corp',
              bullets: [
                { text: '• Responsible for building systems' },
                { text: '• Helped with deployment' },
                { text: '• Worked with team on features' },
              ],
            },
          ],
        },
      };

      const output = engine.generate(resume);
      const html = output.html;

      // Should not contain weak openers
      expect(html).not.toContain('Responsible for');
      expect(html).not.toContain('Helped');
      expect(html).not.toContain('Worked with');
    });

    it('should remove emojis from content', () => {
      const resume: StructuredResume = {
        contact: { name: 'John Doe', email: 'john@example.com' },
        summary: { text: 'Great engineer ⭐ with passion 🚀' },
        experience: {
          roles: [
            {
              jobTitle: 'Engineer',
              company: 'Corp',
              bullets: [{ text: '• Built systems 🔧 and platforms 🚀' }],
            },
          ],
        },
      };

      const output = engine.generate(resume);

      // Verify emojis were removed during normalization from summary and bullets
      expect(output.normalized.summary?.text).not.toContain('⭐');
      expect(output.normalized.summary?.text).not.toContain('🚀');
      if (output.normalized.experience) {
        const bulletText = output.normalized.experience.roles[0].bullets[0].text;
        expect(bulletText).not.toContain('🔧');
      }
    });

    it('should enforce bullet count limits per role', () => {
      const resume: StructuredResume = {
        contact: { name: 'John Doe' },
        experience: {
          roles: [
            {
              jobTitle: 'Current Role',
              company: 'Corp',
              isCurrent: true,
              bullets: Array.from({ length: 15 }, (_, i) => ({
                text: `• Achievement ${i}`,
              })),
            },
            {
              jobTitle: 'Previous Role',
              company: 'Corp',
              endDate: '2022',
              bullets: Array.from({ length: 12 }, (_, i) => ({
                text: `• Achievement ${i}`,
              })),
            },
            {
              jobTitle: 'Old Role',
              company: 'Corp',
              endDate: '2020',
              bullets: Array.from({ length: 10 }, (_, i) => ({
                text: `• Achievement ${i}`,
              })),
            },
          ],
        },
      };

      const output = engine.generate(resume);

      // Check bullet limits
      if (output.normalized.experience) {
        const current = output.normalized.experience.roles[0];
        const previous = output.normalized.experience.roles[1];
        const old = output.normalized.experience.roles[2];

        expect(current.bullets.length).toBeLessThanOrEqual(
          RESUME_FORMAT.contentConstraints.bullets.current.max
        );
        expect(previous.bullets.length).toBeLessThanOrEqual(
          RESUME_FORMAT.contentConstraints.bullets.previous.max
        );
        expect(old.bullets.length).toBeLessThanOrEqual(RESUME_FORMAT.contentConstraints.bullets.older.max);
      }
    });
  });

  describe('ATS-safe validation', () => {
    it('should prohibit tables and graphics', () => {
      const resume: StructuredResume = {
        contact: { name: 'John Doe' },
        summary: { text: 'Built with │ tables and ──── graphics' },
      };

      const output = engine.generate(resume);

      expect(output.html).not.toContain('<table');
      expect(output.html).not.toContain('colspan');
      expect(output.html).not.toContain('rowspan');
    });

    it('should use left alignment only', () => {
      const resume: StructuredResume = {
        contact: { name: 'John Doe' },
      };

      const output = engine.generate(resume);

      expect(output.html).toContain('text-align: left');
      expect(output.html).not.toContain('text-align: center');
      expect(output.html).not.toContain('text-align: right');
      expect(output.html).not.toContain('text-align: justify');
    });

    it('should prevent rasterized text', () => {
      const resume: StructuredResume = {
        contact: { name: 'John Doe' },
      };

      const output = engine.generate(resume);

      // Should not contain image tags for text
      expect(output.html).not.toContain('<img');
      // Should use searchable text
      expect(output.html).toContain('John Doe');
    });
  });

  describe('One-page fitting', () => {
    it('should estimate pages correctly', () => {
      const resume: StructuredResume = {
        contact: { name: 'John Doe' },
        summary: { text: 'Short summary' },
        experience: {
          roles: [
            {
              jobTitle: 'Engineer',
              company: 'Corp',
              bullets: [
                { text: '• Achievement 1' },
                { text: '• Achievement 2' },
                { text: '• Achievement 3' },
              ],
            },
          ],
        },
      };

      const output = engine.generate(resume);

      expect(output.stats.estimatedPages).toBeLessThanOrEqual(RESUME_FORMAT.document.maxPages);
    });

    it('should apply compression if needed', () => {
      // Create a resume that would exceed one page
      const resume: StructuredResume = {
        contact: { name: 'John Doe' },
        summary: {
          text: 'This is a lengthy professional summary with many details about the candidate\'s extensive background and achievements ' +
            'spanning a long career with diverse experiences and accomplishments that demonstrate excellence.',
        },
        expertise: Array.from({ length: 20 }, (_, i) => ({ name: `Skill ${i}` })),
        experience: {
          roles: Array.from({ length: 6 }, (_, i) => ({
            jobTitle: `Role ${i}`,
            company: `Company ${i}`,
            bullets: Array.from({ length: 8 }, (_, j) => ({
              text: `• Achievement ${j}`,
            })),
          })),
        },
      };

      const output = engine.generate(resume);

      // After compression, should fit on one page
      expect(output.stats.estimatedPages).toBeLessThanOrEqual(RESUME_FORMAT.document.maxPages);
    });
  });

  describe('Deterministic rendering', () => {
    it('should produce identical output for same input', () => {
      const resume: StructuredResume = {
        contact: { name: 'Jane Smith', email: 'jane@example.com' },
        summary: { text: 'Experienced software engineer' },
        expertise: [{ name: 'Python' }, { name: 'React' }],
        experience: {
          roles: [
            {
              jobTitle: 'Senior Engineer',
              company: 'TechCorp',
              startDate: '2020',
              endDate: 'Present',
              isCurrent: true,
              bullets: [{ text: '• Led team of 5 engineers' }],
            },
          ],
        },
        education: [{ school: 'Stanford University', year: '2016' }],
      };

      // Generate twice
      const output1 = engine.generate(resume);
      const output2 = engine.generate(resume);

      // HTML should be identical
      expect(output1.html).toBe(output2.html);

      // Stats should be identical
      expect(output1.stats).toEqual(output2.stats);
    });
  });

  describe('Validation', () => {
    it('should validate section order', () => {
      const resume: StructuredResume = {
        contact: { name: 'John Doe' },
        experience: { roles: [{ jobTitle: 'Engineer', company: 'Corp', bullets: [{ text: '• Work' }] }] },
      };

      const output = engine.generate(resume);

      expect(output.validation.valid).toBe(true);
    });

    it('should normalize content that exceeds constraints', () => {
      const resume: StructuredResume = {
        contact: { name: 'John Doe' },
        summary: {
          text: 'This summary is far too long and exceeds the recommended word count by a significant margin with unnecessary details and more content'.repeat(
            5
          ),
        },
        expertise: Array.from({ length: 25 }, (_, i) => ({ name: `Skill ${i}` })),
        experience: {
          roles: [
            {
              jobTitle: 'Role',
              company: 'Corp',
              bullets: Array.from({ length: 10 }, (_, i) => ({
                text: `• Achievement ${i}`,
              })),
            },
          ],
        },
      };

      const output = engine.generate(resume);

      // After normalization, content should meet constraints
      expect(output.stats.summaryWords).toBeLessThanOrEqual(
        RESUME_FORMAT.contentConstraints.summary.maxWords
      );
      expect(output.stats.skillCount).toBeLessThanOrEqual(
        RESUME_FORMAT.contentConstraints.expertise.maxItems
      );
    });

    it('should require contact name', () => {
      const resume: StructuredResume = {
        contact: { name: '' },
      };

      const output = engine.generate(resume);

      expect(output.validation.errors.some((e) => e.includes('name'))).toBe(true);
    });

    it('should require professional experience', () => {
      const resume: StructuredResume = {
        contact: { name: 'John Doe' },
      };

      const output = engine.generate(resume);

      expect(output.validation.errors.some((e) => e.includes('experience'))).toBe(true);
    });
  });

  describe('Formatting tokens', () => {
    it('should apply correct font sizes', () => {
      const resume: StructuredResume = {
        contact: { name: 'John Doe' },
        experience: { roles: [{ jobTitle: 'Engineer', company: 'Corp', bullets: [{ text: '• Work' }] }] },
      };

      const output = engine.generate(resume);

      expect(output.html).toContain(`${RESUME_FORMAT.fontSizes.name}pt`);
      expect(output.html).toContain(`${RESUME_FORMAT.fontSizes.jobTitle}pt`);
      expect(output.html).toContain(`${RESUME_FORMAT.fontSizes.body}pt`);
    });

    it('should apply correct margins', () => {
      const resume: StructuredResume = {
        contact: { name: 'John Doe' },
        experience: { roles: [{ jobTitle: 'Engineer', company: 'Corp', bullets: [{ text: '• Work' }] }] },
      };

      const output = engine.generate(resume);

      const margin = RESUME_FORMAT.margins.top;
      expect(output.html).toContain(`${margin}in`);
    });

    it('should use specified font stack', () => {
      const resume: StructuredResume = {
        contact: { name: 'John Doe' },
        experience: { roles: [{ jobTitle: 'Engineer', company: 'Corp', bullets: [{ text: '• Work' }] }] },
      };

      const output = engine.generate(resume);

      expect(output.html).toContain('Inter');
      expect(output.html).toContain('Helvetica');
      expect(output.html).toContain('Arial');
    });

    it('should use specified colors', () => {
      const resume: StructuredResume = {
        contact: { name: 'John Doe' },
        experience: { roles: [{ jobTitle: 'Engineer', company: 'Corp', bullets: [{ text: '• Work' }] }] },
      };

      const output = engine.generate(resume);

      expect(output.html).toContain(RESUME_FORMAT.colors.text);
      expect(output.html).toContain(RESUME_FORMAT.colors.secondary);
      expect(output.html).toContain(RESUME_FORMAT.colors.background);
    });
  });
});
