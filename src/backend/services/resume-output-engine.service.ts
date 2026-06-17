/**
 * Resume Output Engine
 * Orchestrates: Parse → Normalize → Validate → Render
 * Ensures deterministic, ATS-safe, one-page PDF output
 */

import { ResumeNormalizer } from './resume-normalizer.service';
import { ResumeValidator } from './resume-validator.service';
import { ResumeRenderer } from './resume-renderer.service';
import type { StructuredResume, NormalizedResume } from '../../shared/resumeTypes';

export interface ResumeOutput {
  html: string;
  normalized: NormalizedResume;
  validation: {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
  stats: {
    estimatedPages: number;
    summaryWords: number;
    skillCount: number;
    experienceRoles: number;
    totalBullets: number;
  };
}

export class ResumeOutputEngine {
  private normalizer = new ResumeNormalizer();
  private validator = new ResumeValidator();
  private renderer = new ResumeRenderer();

  /**
   * Generate complete resume output
   * Applies all formatting, normalization, and validation
   */
  generate(resume: StructuredResume): ResumeOutput {
    // 1. Normalize content
    const normalized = this.normalizer.normalize(resume);

    // 2. Validate
    const validation = this.validator.validate(normalized);

    // 3. Check for one-page fit and apply compression if needed
    let finalResume = normalized;
    if (normalized._stats.estimatedPages > 1) {
      console.log('[ResumeOutputEngine] Applying one-page compression');
      finalResume = this.applyCompression(normalized);
      // Re-validate after compression
      const revalidation = this.validator.validate(finalResume);
      if (!revalidation.valid) {
        console.warn('[ResumeOutputEngine] Compression introduced validation errors:', revalidation.errors);
      }
    }

    // 4. Render to HTML
    const html = this.renderer.renderHTML(finalResume);

    return {
      html,
      normalized: finalResume,
      validation,
      stats: finalResume._stats,
    };
  }

  /**
   * Apply deterministic compression to fit on one page
   * Order: older bullets → skills → summary → current bullets (last resort)
   */
  private applyCompression(resume: NormalizedResume): NormalizedResume {
    const compressed = JSON.parse(JSON.stringify(resume)) as NormalizedResume;

    // Step 1: Reduce bullets from oldest roles
    if (compressed.experience && compressed.experience.roles.length > 0) {
      for (let i = compressed.experience.roles.length - 1; i >= 0; i--) {
        const role = compressed.experience.roles[i];
        const isOldest = i === compressed.experience.roles.length - 1;
        if (isOldest && role.bullets.length > 2) {
          console.log(`[Compression] Reducing bullets in oldest role "${role.jobTitle}" from ${role.bullets.length} to 2`);
          role.bullets = role.bullets.slice(0, 2);
          if (this.estimatePages(compressed) <= 1) return compressed;
        }
      }
    }

    // Step 2: Reduce skills
    if (compressed.expertise && compressed.expertise.length > 12) {
      console.log(`[Compression] Reducing skills from ${compressed.expertise.length} to 12`);
      compressed.expertise = compressed.expertise.slice(0, 12);
      compressed._stats.skillCount = 12;
      if (this.estimatePages(compressed) <= 1) return compressed;
    }

    // Step 3: Trim summary
    if (compressed.summary) {
      const words = compressed.summary.text.split(/\s+/);
      if (words.length > 50) {
        console.log(`[Compression] Trimming summary from ${words.length} to 50 words`);
        compressed.summary.text = words.slice(0, 50).join(' ') + '.';
        compressed._stats.summaryWords = 50;
        if (this.estimatePages(compressed) <= 1) return compressed;
      }
    }

    // Step 4: Reduce current role bullets (last resort)
    if (compressed.experience && compressed.experience.roles.length > 0) {
      const firstRole = compressed.experience.roles[0];
      if (firstRole.bullets.length > 4) {
        console.log(`[Compression] Reducing current role bullets from ${firstRole.bullets.length} to 4 (last resort)`);
        firstRole.bullets = firstRole.bullets.slice(0, 4);
        compressed._stats.totalBullets -= 1;
      }
    }

    return compressed;
  }

  /**
   * Rough page estimation (same as normalizer but public)
   */
  private estimatePages(resume: NormalizedResume): number {
    let lines = 0;
    lines += 3; // Header
    if (resume.summary) lines += Math.ceil(resume._stats.summaryWords / 15);
    if (resume.expertise && resume.expertise.length > 0) lines += 1;
    if (resume.experience) {
      for (const role of resume.experience.roles) {
        lines += 2;
        lines += role.bullets.length * 1.3;
      }
    }
    if (resume.education) lines += resume.education.length * 0.5;
    return Math.ceil(lines / 50);
  }
}

export const resumeOutputEngine = new ResumeOutputEngine();
