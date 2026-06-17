/**
 * ATS Resume Renderer
 * Renders resumes deterministically using centralized RESUME_FORMAT tokens
 * Single-column, left-aligned, ATS-safe layout with embedded format specifications
 */

import { RESUME_FORMAT } from '../../shared/resumeFormat';
import type { NormalizedResume } from '../../shared/resumeTypes';

export class ATSResumeRenderer {
  /**
   * Render resume as searchable HTML
   * Uses centralized format tokens for deterministic output
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
   * Render CSS from centralized format specification
   * All typography, spacing, margins, and colors from RESUME_FORMAT tokens
   */
  private renderStyles(): string {
    const fmt = RESUME_FORMAT;
    const fontStack = fmt.fonts.fallbackStack.map(f => `"${f}"`).join(', ');

    return `
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      html, body {
        font-family: ${fontStack};
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
        text-align: ${fmt.document.alignment};
      }

      /* Header - Name and contact */
      .resume-header {
        margin-bottom: ${fmt.spacing.contactAfter}pt;
      }

      .resume-name {
        font-size: ${fmt.fontSizes.name}pt;
        font-weight: ${fmt.fontWeights.name};
        color: ${fmt.colors.text};
        margin-bottom: 4pt;
        line-height: ${fmt.lineHeights.name};
      }

      .resume-contact {
        font-size: ${fmt.fontSizes.contact}pt;
        color: ${fmt.colors.secondary};
        line-height: ${fmt.lineHeights.contact};
      }

      /* Section headings */
      .section-title {
        font-size: ${fmt.fontSizes.sectionHeading}pt;
        font-weight: ${fmt.fontWeights.sectionHeading};
        color: ${fmt.colors.text};
        text-align: left;
        margin-top: ${fmt.spacing.sectionBefore}pt;
        margin-bottom: ${fmt.spacing.sectionAfter}pt;
        line-height: ${fmt.lineHeights.sectionHeading};
        page-break-after: avoid;
      }

      /* Summary */
      .resume-summary {
        font-size: ${fmt.fontSizes.body}pt;
        color: ${fmt.colors.text};
        line-height: ${fmt.lineHeights.body};
        margin-bottom: ${fmt.spacing.paragraphAfter}pt;
      }

      /* Experience */
      .job-block {
        margin-bottom: ${fmt.spacing.roleBlockAfter}pt;
        page-break-inside: avoid;
      }

      .job-company {
        font-size: ${fmt.fontSizes.company}pt;
        font-weight: ${fmt.fontWeights.company};
        color: ${fmt.colors.text};
        margin-bottom: 0;
        line-height: ${fmt.lineHeights.sectionHeading};
      }

      .job-title {
        font-size: ${fmt.fontSizes.jobTitle}pt;
        font-weight: ${fmt.fontWeights.jobTitle};
        color: ${fmt.colors.text};
        margin-bottom: 0;
        line-height: ${fmt.lineHeights.sectionHeading};
      }

      .job-location {
        font-size: ${fmt.fontSizes.body}pt;
        color: ${fmt.colors.secondary};
        margin-bottom: ${fmt.spacing.bulletAfter}pt;
      }

      .job-dates {
        font-size: ${fmt.fontSizes.dates}pt;
        font-weight: ${fmt.fontWeights.dates};
        color: ${fmt.colors.secondary};
        margin-bottom: ${fmt.spacing.bulletAfter}pt;
      }

      .job-bullets {
        margin: 0;
        padding-left: ${fmt.bullets.indent}in;
        list-style: disc;
      }

      .job-bullets li {
        font-size: ${fmt.fontSizes.bullets}pt;
        color: ${fmt.colors.text};
        line-height: ${fmt.lineHeights.bullets};
        margin-bottom: ${fmt.spacing.bulletAfter}pt;
      }

      /* Expertise/Skills */
      .resume-expertise {
        margin-bottom: ${fmt.spacing.paragraphAfter}pt;
      }

      .expertise-item {
        font-size: ${fmt.fontSizes.body}pt;
        color: ${fmt.colors.text};
        line-height: ${fmt.lineHeights.body};
        margin-bottom: ${fmt.spacing.bulletAfter}pt;
      }

      /* Education */
      .edu-block {
        margin-bottom: ${fmt.spacing.roleBlockAfter}pt;
        page-break-inside: avoid;
      }

      .edu-degree {
        font-size: ${fmt.fontSizes.body}pt;
        font-weight: 700;
        color: ${fmt.colors.text};
        line-height: ${fmt.lineHeights.body};
        margin-bottom: 0;
      }

      .edu-school {
        font-size: ${fmt.fontSizes.body}pt;
        color: ${fmt.colors.text};
        line-height: ${fmt.lineHeights.body};
        margin-bottom: 0;
      }

      .edu-year {
        font-size: ${fmt.fontSizes.dates}pt;
        color: ${fmt.colors.secondary};
        line-height: ${fmt.lineHeights.contact};
      }

      /* Print optimization */
      @media print {
        * {
          background: transparent !important;
          color: #000 !important;
          box-shadow: none !important;
        }

        body, html {
          background: ${fmt.colors.background};
          color: #000;
        }

        .resume {
          width: 100%;
          height: auto;
          margin: 0;
          background: ${fmt.colors.background};
        }

        .job-block, .edu-block {
          page-break-inside: avoid;
        }

        .section-title {
          page-break-after: avoid;
        }
      }

      @page {
        margin: ${fmt.margins.top}in ${fmt.margins.right}in ${fmt.margins.bottom}in ${fmt.margins.left}in;
        size: letter;
      }
    `;
  }

  /**
   * Render header - name and contact information
   */
  private renderHeader(contact: any): string {
    const contactParts = [];
    if (contact.email) contactParts.push(this.escapeHTML(contact.email));
    if (contact.phone) contactParts.push(this.escapeHTML(contact.phone));
    if (contact.location) contactParts.push(this.escapeHTML(contact.location));

    return `
      <div class="resume-header">
        <div class="resume-name">${this.escapeHTML(contact.name || 'Your Name')}</div>
        <div class="resume-contact">${contactParts.join(' • ')}</div>
      </div>
    `;
  }

  /**
   * Render summary section
   */
  private renderSummary(summary: any): string {
    return `
      <div class="section-title">SUMMARY</div>
      <p class="resume-summary">${this.escapeHTML(summary.text)}</p>
    `;
  }

  /**
   * Render expertise/skills section
   */
  private renderExpertise(skills: any[]): string {
    let html = `<div class="section-title">CORE EXPERTISE</div>`;
    const skillNames = skills.map(s => this.escapeHTML(s.name)).join(' • ');
    html += `<p class="expertise-item">${skillNames}</p>`;
    return html;
  }

  /**
   * Render professional experience section
   */
  private renderExperience(experience: any): string {
    let html = `<div class="section-title">PROFESSIONAL EXPERIENCE</div>`;

    for (const role of experience.roles) {
      const dateRange = `${role.startDate || ''}${role.endDate ? ` – ${role.endDate}` : ''}`.trim();

      html += `
        <div class="job-block">
          <div class="job-company">${this.escapeHTML(role.company || '')}</div>
          <div class="job-title">${this.escapeHTML(role.jobTitle || '')}</div>
          ${role.location ? `<div class="job-location">${this.escapeHTML(role.location)}</div>` : ''}
          ${dateRange ? `<div class="job-dates">${this.escapeHTML(dateRange)}</div>` : ''}
          <ul class="job-bullets">
            ${role.bullets.map((bullet: any) => {
              const text = typeof bullet === 'string' ? bullet : bullet.text || '';
              return `<li>${this.escapeHTML(text)}</li>`;
            }).join('')}
          </ul>
        </div>
      `;
    }

    return html;
  }

  /**
   * Render education section
   */
  private renderEducation(education: any[]): string {
    let html = `<div class="section-title">EDUCATION</div>`;

    for (const edu of education) {
      html += `
        <div class="edu-block">
          <div class="edu-degree">${this.escapeHTML(edu.degree || '')}</div>
          <div class="edu-school">${this.escapeHTML(edu.school || '')}</div>
          ${edu.year ? `<div class="edu-year">${this.escapeHTML(edu.year)}</div>` : ''}
        </div>
      `;
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
