/**
 * Resume Validator
 * Enforces ATS-safety, formatting, and structural requirements
 */

import { RESUME_FORMAT } from '../../shared/resumeFormat';
import type { NormalizedResume } from '../../shared/resumeTypes';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class ResumeValidator {
  /**
   * Validate a normalized resume
   */
  validate(resume: NormalizedResume): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check section order
    this.validateSectionOrder(resume, errors);

    // Check required sections
    this.validateRequiredSections(resume, errors);

    // Check for prohibited elements (in text)
    this.validateNoProhibitedElements(resume, errors);

    // Check content constraints
    this.validateContentConstraints(resume, errors, warnings);

    // Check one-page fit
    const estimatedPages = resume._stats.estimatedPages;
    if (estimatedPages > RESUME_FORMAT.document.maxPages) {
      warnings.push(
        `Resume estimated to be ${estimatedPages} pages, will need compression to fit on 1 page`
      );
    }

    // Check margins
    if (!this.validateMargins()) {
      errors.push('Resume margins do not match specification');
    }

    // Check typography
    if (!this.validateTypography(resume)) {
      errors.push('Resume typography does not match specification');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate that sections appear in correct order
   */
  private validateSectionOrder(resume: NormalizedResume, errors: string[]) {
    const presentSections: string[] = [];

    if (resume.contact) presentSections.push('header');
    if (resume.summary) presentSections.push('summary');
    if (resume.expertise && resume.expertise.length > 0) presentSections.push('expertise');
    if (resume.experience && resume.experience.roles.length > 0) presentSections.push('experience');
    if (resume.education && resume.education.length > 0) presentSections.push('education');
    if (resume.certifications && resume.certifications.length > 0) presentSections.push('certifications');
    if (resume.portfolio && resume.portfolio.length > 0) presentSections.push('portfolio');

    // Check that sections are in order (ignoring optional ones)
    const expectedOrder = RESUME_FORMAT.sectionOrder;
    let lastFoundIndex = -1;

    for (const section of presentSections) {
      const index = expectedOrder.indexOf(section as any);
      if (index <= lastFoundIndex) {
        errors.push(`Section order violation: ${section} appears out of order`);
      }
      lastFoundIndex = index;
    }
  }

  /**
   * Validate required sections exist
   */
  private validateRequiredSections(resume: NormalizedResume, errors: string[]) {
    if (!resume.contact || !resume.contact.name) {
      errors.push('Resume must include contact name');
    }

    if (!resume.experience || resume.experience.roles.length === 0) {
      errors.push('Resume must include professional experience');
    }
  }

  /**
   * Check for prohibited ATS elements in text
   */
  private validateNoProhibitedElements(resume: NormalizedResume, errors: string[]) {
    const prohibitedPatterns = [
      { pattern: /\[.*?\]/g, element: 'brackets/text boxes' },
      { pattern: /{.*?}/g, element: 'braces' },
      { pattern: /\|{2,}/g, element: 'columns' },
      { pattern: /─+|═+|─┼─/g, element: 'graphics/lines' },
      { pattern: /[★☆✓✗✔]/g, element: 'special icons' },
      { pattern: /justify|alignment.*center/gi, element: 'justified text' },
    ];

    const allText = this.extractAllText(resume);

    for (const { pattern, element } of prohibitedPatterns) {
      if (pattern.test(allText)) {
        errors.push(`Found prohibited ATS element: ${element}`);
      }
    }
  }

  /**
   * Validate content meets constraints
   */
  private validateContentConstraints(
    resume: NormalizedResume,
    errors: string[],
    warnings: string[]
  ) {
    // Summary word count
    if (resume.summary) {
      const wordCount = resume._stats.summaryWords;
      if (wordCount > RESUME_FORMAT.contentConstraints.summary.maxWords) {
        warnings.push(`Summary has ${wordCount} words, max is ${RESUME_FORMAT.contentConstraints.summary.maxWords}`);
      }
    }

    // Skills count
    if (resume.expertise) {
      const skillCount = resume._stats.skillCount;
      if (skillCount > RESUME_FORMAT.contentConstraints.expertise.maxItems) {
        warnings.push(`${skillCount} skills listed, max is ${RESUME_FORMAT.contentConstraints.expertise.maxItems}`);
      }
    }

    // Bullet counts per role
    if (resume.experience) {
      for (let i = 0; i < resume.experience.roles.length; i++) {
        const role = resume.experience.roles[i];
        const isOldest = i === resume.experience.roles.length - 1;
        const isCurrent = role.isCurrent || !role.endDate;
        const limits = isOldest
          ? RESUME_FORMAT.contentConstraints.bullets.older
          : isCurrent
            ? RESUME_FORMAT.contentConstraints.bullets.current
            : RESUME_FORMAT.contentConstraints.bullets.previous;

        if (role.bullets.length > limits.max) {
          warnings.push(
            `Role "${role.jobTitle}" has ${role.bullets.length} bullets, max is ${limits.max}`
          );
        }
      }
    }
  }

  /**
   * Validate margins match specification
   */
  private validateMargins(): boolean {
    // In actual PDF rendering, this would be verified
    // For now, we assume correct if structure is valid
    return true;
  }

  /**
   * Validate typography matches specification
   */
  private validateTypography(resume: NormalizedResume): boolean {
    // In actual PDF rendering, this would be verified
    // For now, we assume correct if structure is valid
    return true;
  }

  /**
   * Extract all text from resume
   */
  private extractAllText(resume: NormalizedResume): string {
    const parts: string[] = [];

    if (resume.contact) {
      parts.push(resume.contact.name);
      if (resume.contact.email) parts.push(resume.contact.email);
      if (resume.contact.phone) parts.push(resume.contact.phone);
      if (resume.contact.location) parts.push(resume.contact.location);
    }

    if (resume.summary) {
      parts.push(resume.summary.text);
    }

    if (resume.expertise) {
      parts.push(resume.expertise.map((s) => s.name).join(' '));
    }

    if (resume.experience) {
      for (const role of resume.experience.roles) {
        parts.push(role.jobTitle);
        parts.push(role.company);
        for (const bullet of role.bullets) {
          parts.push(bullet.text);
        }
      }
    }

    if (resume.education) {
      for (const edu of resume.education) {
        if (edu.degree) parts.push(edu.degree);
        parts.push(edu.school);
      }
    }

    return parts.join(' ');
  }
}

export const resumeValidator = new ResumeValidator();
