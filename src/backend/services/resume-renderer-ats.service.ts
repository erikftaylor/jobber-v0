/**
 * Resume Output Engine v2 - Modern Executive Product Design Renderer
 * Deterministic single-column layout with typography-driven hierarchy
 * No tables, no boxes, no visual clutter - clean and minimalist
 */

import { RESUME_FORMAT } from '../../shared/resumeFormat';
import type { NormalizedResume } from '../../shared/resumeTypes';

export class ATSResumeRenderer {
  /**
   * Render resume to clean, minimalist HTML
   * Single column, left-aligned, typography-driven
   */
  renderHTML(resume: NormalizedResume): string {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${resume.contact.name} - Resume</title>
  <style>
    ${this.renderStyles()}
  </style>
</head>
<body>
  <div class="resume">
    ${this.renderHeader(resume.contact)}
    ${resume.summary ? this.renderSummary(resume.summary) : ''}
    ${resume.expertise && resume.expertise.length > 0 ? this.renderExpertise(resume.expertise) : ''}
    ${resume.experience ? this.renderExperience(resume.experience) : ''}
    ${resume.education && resume.education.length > 0 ? this.renderEducation(resume.education) : ''}
  </div>
</body>
</html>`;
    return html;
  }

  /**
   * Render CSS - minimal, clean typography-driven styles
   */
  private renderStyles(): string {
    const fmt = RESUME_FORMAT;

    return `
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      html, body {
        font-family: ${fmt.fonts.fallbackStack.map((f) => `"${f}"`).join(', ')};
        color: ${fmt.colors.text};
        background: ${fmt.colors.background};
      }

      .resume {
        width: 8.5in;
        height: 11in;
        margin: 0 auto;
        padding: ${fmt.margins.top}in ${fmt.margins.right}in ${fmt.margins.bottom}in ${fmt.margins.left}in;
        background: ${fmt.colors.background};
        color: ${fmt.colors.text};
        font-size: ${fmt.fontSizes.body}pt;
        line-height: ${fmt.lineHeights.body};
      }

      /* HEADER - Name only, left aligned */
      .resume-header {
        margin-bottom: ${fmt.spacing.nameMarginBottom}px;
      }

      .resume-name {
        font-size: ${fmt.fontSizes.name}pt;
        font-weight: ${fmt.fontWeights.name};
        color: ${fmt.colors.text};
        line-height: ${fmt.lineHeights.name};
        margin: 0;
      }

      /* SECTION HEADERS - Uppercase, bold, left aligned, no border */
      .section-title {
        font-size: ${fmt.fontSizes.sectionHeading}pt;
        font-weight: ${fmt.fontWeights.sectionHeading};
        color: ${fmt.colors.text};
        text-transform: uppercase;
        margin-top: ${fmt.spacing.sectionMarginTop}px;
        margin-bottom: ${fmt.spacing.sectionMarginBottom}px;
        line-height: ${fmt.lineHeights.sectionHeading};
        page-break-after: avoid;
      }

      /* SUMMARY */
      .resume-summary {
        font-size: ${fmt.fontSizes.body}pt;
        line-height: ${fmt.lineHeights.body};
        color: ${fmt.colors.text};
        margin-bottom: ${fmt.spacing.sectionMarginTop}px;
      }

      /* EXPERTISE - Vertical list */
      .resume-expertise {
        margin-bottom: ${fmt.spacing.sectionMarginTop}px;
      }

      .expertise-item {
        font-size: ${fmt.fontSizes.body}pt;
        line-height: ${fmt.lineHeights.body};
        color: ${fmt.colors.text};
        margin-bottom: ${fmt.spacing.expertiseItemMargin}px;
      }

      /* JOB BLOCKS - No tables, block-based layout */
      .job-block {
        margin-bottom: ${fmt.spacing.jobBlockMargin}px;
        page-break-inside: avoid;
      }

      .job-dates {
        font-size: ${fmt.fontSizes.dates}pt;
        font-weight: ${fmt.fontWeights.dates};
        color: ${fmt.colors.text};
        line-height: ${fmt.lineHeights.dates};
        margin-bottom: ${fmt.spacing.dateMarginBottom}px;
      }

      /* BULLETS */
      .job-bullets {
        margin: 0;
        padding-left: ${fmt.spacing.bulletIndent}px;
        list-style: disc;
      }

      .job-bullets li {
        font-size: ${fmt.fontSizes.body}pt;
        line-height: ${fmt.lineHeights.body};
        color: ${fmt.colors.text};
        margin-bottom: ${fmt.spacing.bulletMargin}px;
      }

      /* EDUCATION - Compact single-line entries */
      .edu-block {
        margin-bottom: ${fmt.spacing.educationItemMargin}px;
        page-break-inside: avoid;
      }

      .edu-entry {
        font-size: ${fmt.fontSizes.body}pt;
        line-height: ${fmt.lineHeights.body};
        color: ${fmt.colors.text};
      }

      /* PAGE BREAK RULES */
      @media print {
        * {
          background: transparent !important;
          color: #000 !important;
          box-shadow: none !important;
          text-shadow: none !important;
        }

        body, html {
          background: white;
          color: #000;
        }

        .resume {
          width: 100%;
          height: auto;
          margin: 0;
          padding: 0.6in;
          background: white;
        }

        .job-block {
          page-break-inside: avoid;
        }

        .edu-block {
          page-break-inside: avoid;
        }

        .section-title {
          page-break-after: avoid;
        }

        a {
          text-decoration: underline;
        }

        /* Remove any borders that don't print well */
        hr {
          border: none;
          border-top: 1px solid #000;
        }
      }

      /* PRINT MARGINS */
      @page {
        margin: ${fmt.margins.top}in ${fmt.margins.right}in ${fmt.margins.bottom}in ${fmt.margins.left}in;
        size: letter;
      }
    `;
  }

  /**
   * Render header - name only, left aligned
   */
  private renderHeader(contact: any): string {
    return `
      <div class="resume-header">
        <div class="resume-name">${this.escapeHTML(contact.name || 'Your Name')}</div>
      </div>
    `;
  }

  /**
   * Render summary - executive positioning statement
   */
  private renderSummary(summary: any): string {
    return `
      <div class="section-title">Summary</div>
      <p class="resume-summary">${this.escapeHTML(summary.text)}</p>
    `;
  }

  /**
   * Render expertise - vertical list, no ratings
   */
  private renderExpertise(skills: any[]): string {
    const expertiseItems = skills
      .map((s) => `<div class="expertise-item">${this.escapeHTML(s.name)}</div>`)
      .join('');

    return `
      <div class="section-title">Core Expertise</div>
      <div class="resume-expertise">${expertiseItems}</div>
    `;
  }

  /**
   * Render professional experience - dates on separate line, then bullets
   */
  private renderExperience(experience: any): string {
    let html = `<div class="section-title">Professional Experience</div>`;

    for (const role of experience.roles) {
      const dateRange = `${this.escapeHTML(role.startDate || '')}${
        role.endDate ? ` – ${this.escapeHTML(role.endDate)}` : ''
      }`.trim();

      html += `
        <div class="job-block">
          ${dateRange ? `<div class="job-dates">${dateRange}</div>` : ''}
          <ul class="job-bullets">
            ${role.bullets.map((bullet: any) => `<li>${this.escapeHTML(bullet.text)}</li>`).join('')}
          </ul>
        </div>
      `;
    }

    return html;
  }

  /**
   * Render education - compact single-line entries
   */
  private renderEducation(education: any[]): string {
    let html = `<div class="section-title">Education</div>`;

    for (const edu of education) {
      const parts: string[] = [];
      if (edu.degree) parts.push(this.escapeHTML(edu.degree));
      if (edu.school) parts.push(this.escapeHTML(edu.school));
      if (edu.year) parts.push(this.escapeHTML(edu.year));

      html += `<div class="edu-block"><div class="edu-entry">${parts.join(' • ')}</div></div>`;
    }

    return html;
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHTML(text: string): string {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

export const atsResumeRenderer = new ATSResumeRenderer();
