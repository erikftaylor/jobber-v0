/**
 * Resume Content Normalizer
 * Enforces content constraints and ATS-safety rules
 * Prepares resume for deterministic rendering
 */

import { RESUME_FORMAT } from '../../shared/resumeFormat';
import type { StructuredResume, NormalizedResume, ResumeBullet } from '../../shared/resumeTypes';

export class ResumeNormalizer {
  /**
   * Normalize a resume to meet all constraints
   */
  normalize(resume: StructuredResume): NormalizedResume {
    const normalized: NormalizedResume = {
      ...resume,
      _normalized: true,
      _stats: {
        summaryWords: 0,
        skillCount: 0,
        experienceRoles: 0,
        totalBullets: 0,
        estimatedPages: 1,
      },
    };

    // Normalize each section
    if (normalized.summary) {
      normalized.summary = this.normalizeSummary(normalized.summary);
      normalized._stats.summaryWords = this.countWords(normalized.summary.text);
    }

    if (normalized.expertise) {
      normalized.expertise = this.normalizeSkills(normalized.expertise);
      normalized._stats.skillCount = normalized.expertise.length;
    }

    if (normalized.experience) {
      normalized.experience.roles = normalized.experience.roles.map((role, idx) => {
        const isOldest = idx === normalized.experience!.roles.length - 1;
        return this.normalizeRole(role, isOldest);
      });
      normalized._stats.experienceRoles = normalized.experience.roles.length;
      normalized._stats.totalBullets = normalized.experience.roles.reduce(
        (sum, role) => sum + role.bullets.length,
        0
      );
    }

    return normalized;
  }

  /**
   * Normalize summary: truncate to max words, remove weak openers
   */
  private normalizeSummary(summary: any) {
    let text = String(summary.text || summary);

    // Remove emojis
    text = text.replace(/[\p{Emoji}]/gu, '').trim();

    // Remove unsupported markdown
    text = text.replace(/[*_`#\[\]()]/g, '').trim();

    // Remove weak openers
    const weakOpeners = [
      'responsible for',
      'helped',
      'worked with',
      'was involved in',
      'participated in',
      'assisted with',
    ];
    for (const opener of weakOpeners) {
      text = text.replace(new RegExp(`^${opener}\\s+`, 'i'), '');
    }

    // Truncate to max words
    const words = text.split(/\s+/);
    if (words.length > RESUME_FORMAT.contentConstraints.summary.maxWords) {
      text = words.slice(0, RESUME_FORMAT.contentConstraints.summary.maxWords).join(' ') + '.';
    }

    return { text };
  }

  /**
   * Normalize skills: limit count, remove duplicates
   */
  private normalizeSkills(skills: any[]) {
    const seen = new Set<string>();
    const normalized = skills
      .filter((s) => {
        const name = String(s.name || s).toLowerCase().trim();
        if (seen.has(name) || !name) return false;
        seen.add(name);
        return true;
      })
      .slice(0, RESUME_FORMAT.contentConstraints.skills.maxItems)
      .map((s) => ({
        name: String(s.name || s).trim(),
      }));

    return normalized;
  }

  /**
   * Normalize role: enforce bullet counts based on role age
   */
  private normalizeRole(role: any, isOldest: boolean) {
    const isCurrent = role.isCurrent || !role.endDate;
    const bulletLimits = isOldest
      ? RESUME_FORMAT.contentConstraints.bullets.older
      : isCurrent
        ? RESUME_FORMAT.contentConstraints.bullets.current
        : RESUME_FORMAT.contentConstraints.bullets.previous;

    const normalizedBullets = role.bullets
      .map((bullet: any) => this.normalizeBullet(bullet))
      .slice(0, bulletLimits.max);

    return {
      ...role,
      bullets: normalizedBullets,
    };
  }

  /**
   * Normalize bullet: remove weak openers, emojis, first-person pronouns
   */
  private normalizeBullet(bullet: ResumeBullet | string): ResumeBullet {
    let text = typeof bullet === 'string' ? bullet : bullet.text || '';

    // Remove bullet character if present (will re-add later)
    text = text.replace(/^•\s*/, '').trim();

    // Remove emojis
    text = text.replace(/[\p{Emoji}]/gu, '').trim();

    // Remove unsupported markdown
    text = text.replace(/[*_`#\[\]()]/g, '').trim();

    // Remove first-person pronouns
    text = text.replace(/\b(I|We|My|Our)\b/g, '').trim();

    // Remove weak openers
    const weakOpeners = [
      'responsible for',
      'helped',
      'worked with',
      'was involved in',
      'participated in',
      'assisted with',
      'was able to',
      'managed to',
    ];
    for (const opener of weakOpeners) {
      text = text.replace(new RegExp(`^${opener}\\s+`, 'i'), '').trim();
    }

    // Ensure it starts with capital letter
    if (text.length > 0) {
      text = text.charAt(0).toUpperCase() + text.slice(1);
    }

    // Add bullet character
    text = `${RESUME_FORMAT.bullets.character} ${text}`;

    return {
      text,
      wordCount: this.countWords(text),
      visualLines: this.estimateVisualLines(text),
    };
  }

  /**
   * Count words in text
   */
  private countWords(text: string): number {
    return text.trim().split(/\s+/).length;
  }

  /**
   * Estimate visual lines for text (approximate)
   * Assumes ~80 chars per line at target font size
   */
  private estimateVisualLines(text: string): number {
    const charsPerLine = 80;
    const lines = Math.ceil(text.length / charsPerLine);
    return Math.max(1, Math.min(lines, RESUME_FORMAT.bullets.maxVisualLines));
  }

  /**
   * Estimate total pages (rough)
   */
  estimatePages(resume: NormalizedResume): number {
    let lines = 0;

    // Header (~3 lines)
    lines += 3;

    // Summary (~2-3 lines)
    if (resume.summary) {
      lines += Math.ceil(resume._stats.summaryWords / 15);
    }

    // Expertise (~1 line)
    if (resume.expertise && resume.expertise.length > 0) {
      lines += 1;
    }

    // Experience
    if (resume.experience) {
      for (const role of resume.experience.roles) {
        lines += 2; // Job title + company
        lines += role.bullets.length * 1.3; // Bullets with spacing
      }
    }

    // Education (~0.5 line per item)
    if (resume.education) {
      lines += resume.education.length * 0.5;
    }

    // Rough conversion: 50 lines ≈ 1 page
    return Math.ceil(lines / 50);
  }
}

export const resumeNormalizer = new ResumeNormalizer();
