/**
 * ATS Professional Resume Renderer
 * Generates deterministic HTML matching ATS Professional Resume template exactly
 * Strict single-column layout optimized for 2026 AI-driven ATS parsers
 */

import { RESUME_FORMAT } from '../../shared/resumeFormat';
import type { NormalizedResume } from '../../shared/resumeTypes';

export class ATSResumeRenderer {
  /**
   * Render resume to ATS-compliant HTML
   * No flexbox/grid - uses block elements and tables for ATS safety
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
    ${resume.certifications && resume.certifications.length > 0 ? this.renderCertifications(resume.certifications) : ''}
  </div>
</body>
</html>`;
    return html;
  }

  /**
   * Render CSS styles per ATS specification
   * Critical: No flexbox or grid for structural layout
   */
  private renderStyles(): string {
    const fmt = RESUME_FORMAT;
    const colors = fmt.colors;
    const margins = fmt.margins;

    return `
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      html, body {
        font-family: ${fmt.fonts.fallbackStack.map((f) => `"${f}"`).join(', ')};
        color: ${colors.darkCharcoal};
        background: ${colors.background};
      }

      .resume {
        width: 8.5in;
        height: 11in;
        margin: 0 auto;
        padding: ${margins.top}in ${margins.right}in ${margins.bottom}in ${margins.left}in;
        background: ${colors.background};
        color: ${colors.darkCharcoal};
        font-size: 10.5pt;
        line-height: 1.5;
      }

      /* HEADER - Centered */
      .resume-header {
        text-align: center;
        margin-bottom: ${fmt.spacing.headerMarginBottom}px;
      }

      .resume-name {
        font-size: ${fmt.fontSizes.name}pt;
        font-weight: ${fmt.fontWeights.name};
        color: ${colors.navy};
        letter-spacing: 0.5px;
        text-transform: uppercase;
        line-height: ${fmt.lineHeights.name};
        margin: 0;
      }

      .resume-contact {
        font-size: ${fmt.fontSizes.contact}pt;
        color: ${colors.slateGray};
        line-height: ${fmt.lineHeights.contact};
        margin: 0;
      }

      /* SECTION HEADERS - Left aligned with underline */
      .section-title {
        font-size: ${fmt.fontSizes.sectionHeading}pt;
        font-weight: ${fmt.fontWeights.sectionHeading};
        color: ${colors.navy};
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-top: ${fmt.spacing.sectionMarginTop}px;
        margin-bottom: ${fmt.spacing.sectionMarginBottom}px;
        border-bottom: ${fmt.dividers.width}px ${fmt.dividers.style} ${fmt.dividers.color};
        padding-bottom: ${fmt.dividers.paddingBottom}px;
        line-height: ${fmt.lineHeights.sectionHeading};
        page-break-after: avoid;
      }

      /* SUMMARY */
      .resume-summary {
        font-size: ${fmt.fontSizes.body}pt;
        line-height: ${fmt.lineHeights.body};
        color: ${colors.darkCharcoal};
        margin-bottom: ${fmt.spacing.sectionMarginBottom}px;
        text-align: justify;
      }

      /* SKILLS */
      .resume-skills {
        margin-bottom: ${fmt.spacing.skillBlockMargin}px;
      }

      .skill-row {
        font-size: ${fmt.fontSizes.body}pt;
        line-height: ${fmt.lineHeights.body};
        color: ${colors.darkCharcoal};
        padding-bottom: ${fmt.spacing.skillRowPadding}px;
      }

      /* JOB BLOCKS - Use table for side-by-side title/dates (ATS safe) */
      .job-block {
        margin-bottom: ${fmt.spacing.jobBlockMargin}px;
        page-break-inside: avoid;
      }

      .job-meta-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: ${fmt.spacing.jobMetaMargin}px;
      }

      .job-meta-table td {
        padding: 0;
        line-height: ${fmt.lineHeights.body};
      }

      .job-title-cell {
        font-size: ${fmt.fontSizes.metaLeft}pt;
        font-weight: ${fmt.fontWeights.metaLeft};
        color: ${colors.darkCharcoal};
        width: 70%;
        vertical-align: baseline;
      }

      .job-dates-cell {
        font-size: ${fmt.fontSizes.metaRight}pt;
        color: ${colors.mediumGray};
        width: 30%;
        text-align: right;
        vertical-align: baseline;
      }

      .job-company {
        font-size: ${fmt.fontSizes.metaLeft}pt;
        font-weight: ${fmt.fontWeights.metaLeft};
        color: ${colors.darkCharcoal};
        margin-bottom: ${fmt.spacing.jobMetaMargin}px;
        line-height: ${fmt.lineHeights.body};
      }

      /* BULLETS */
      .job-bullets {
        margin: 0;
        padding-left: ${fmt.spacing.bulletIndent}px;
        list-style: disc;
      }

      .job-bullets li {
        font-size: ${fmt.fontSizes.bullets}pt;
        line-height: ${fmt.lineHeights.bullets};
        color: ${colors.darkCharcoal};
        margin-bottom: ${fmt.spacing.bulletMargin}px;
        text-align: justify;
      }

      /* EDUCATION */
      .edu-block {
        margin-bottom: ${fmt.spacing.eduBlockMargin}px;
        page-break-inside: avoid;
      }

      .edu-entry {
        font-size: ${fmt.fontSizes.body}pt;
        line-height: ${fmt.lineHeights.body};
        color: ${colors.darkCharcoal};
      }

      /* CERTIFICATIONS */
      .cert-entry {
        font-size: ${fmt.fontSizes.body}pt;
        line-height: ${fmt.lineHeights.body};
        color: ${colors.darkCharcoal};
        margin-bottom: ${fmt.spacing.bulletMargin}px;
      }

      /* PAGE BREAK RULES */
      @media print {
        .job-block {
          page-break-inside: avoid;
        }

        .edu-block {
          page-break-inside: avoid;
        }

        .section-title {
          page-break-after: avoid;
        }
      }

      /* PRINT MARGINS */
      @page {
        margin: ${margins.top}in ${margins.right}in ${margins.bottom}in ${margins.left}in;
      }
    `;
  }

  /**
   * Render header (centered name + contact)
   */
  private renderHeader(contact: any): string {
    const parts: string[] = [];
    if (contact.email) parts.push(contact.email);
    if (contact.phone) parts.push(contact.phone);
    if (contact.location) parts.push(contact.location);
    if (contact.linkedin) parts.push(contact.linkedin);
    if (contact.portfolio) parts.push(contact.portfolio);

    const contactLine = parts.join(' • ');

    return `
      <div class="resume-header">
        <div class="resume-name">${this.escapeHTML(contact.name)}</div>
        <div class="resume-contact">${this.escapeHTML(contactLine)}</div>
      </div>
    `;
  }

  /**
   * Render summary section
   */
  private renderSummary(summary: any): string {
    return `
      <div class="section-title">Summary</div>
      <p class="resume-summary">${this.escapeHTML(summary.text)}</p>
    `;
  }

  /**
   * Render expertise/skills section
   */
  private renderExpertise(skills: any[]): string {
    const skillRows = skills.map((s) => `<div class="skill-row">${this.escapeHTML(s.name)}</div>`).join('');

    return `
      <div class="section-title">Core Expertise</div>
      <div class="resume-skills">${skillRows}</div>
    `;
  }

  /**
   * Render professional experience section
   */
  private renderExperience(experience: any): string {
    let html = `<div class="section-title">Professional Experience</div>`;

    for (const role of experience.roles) {
      const dateRange = `${this.escapeHTML(role.startDate || '')}${role.endDate ? ` – ${this.escapeHTML(role.endDate)}` : ''}`;

      html += `
        <div class="job-block">
          <table class="job-meta-table">
            <tr>
              <td class="job-title-cell"><strong>${this.escapeHTML(role.jobTitle)}</strong></td>
              <td class="job-dates-cell">${dateRange}</td>
            </tr>
          </table>
          <div class="job-company">${this.escapeHTML(role.company)}${role.location ? ` • ${this.escapeHTML(role.location)}` : ''}</div>
          <ul class="job-bullets">
            ${role.bullets.map((bullet: any) => `<li>${this.escapeHTML(bullet.text)}</li>`).join('')}
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
    let html = `<div class="section-title">Education</div>`;

    for (const edu of education) {
      const parts: string[] = [];
      if (edu.degree) parts.push(this.escapeHTML(edu.degree));
      parts.push(this.escapeHTML(edu.school));
      if (edu.year) parts.push(this.escapeHTML(edu.year));

      html += `<div class="edu-block"><div class="edu-entry">${parts.join(' • ')}</div></div>`;
    }

    return html;
  }

  /**
   * Render certifications section
   */
  private renderCertifications(certs: any[]): string {
    let html = `<div class="section-title">Certifications</div>`;

    for (const cert of certs) {
      const parts: string[] = [this.escapeHTML(cert.title)];
      if (cert.issuer) parts.push(this.escapeHTML(cert.issuer));
      if (cert.year) parts.push(this.escapeHTML(cert.year));

      html += `<div class="cert-entry">${parts.join(' • ')}</div>`;
    }

    return html;
  }

  /**
   * Escape HTML
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
