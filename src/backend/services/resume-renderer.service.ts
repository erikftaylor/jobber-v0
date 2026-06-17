/**
 * Resume Renderer
 * Converts normalized resume JSON → deterministic HTML
 * HTML styled per RESUME_FORMAT specification
 */

import { RESUME_FORMAT, PARAGRAPH_STYLES } from '../../shared/resumeFormat';
import type { NormalizedResume } from '../../shared/resumeTypes';

export class ResumeRenderer {
  /**
   * Render resume to HTML
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
    ${resume.portfolio && resume.portfolio.length > 0 ? this.renderPortfolio(resume.portfolio) : ''}
  </div>
</body>
</html>`;
    return html;
  }

  /**
   * Render CSS styles
   */
  private renderStyles(): string {
    const margins = RESUME_FORMAT.margins;
    const colors = RESUME_FORMAT.colors;
    const fonts = RESUME_FORMAT.fonts;

    return `
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      html, body {
        font-family: ${fonts.fallbackStack.map((f) => `"${f}"`).join(', ')};
        color: ${colors.text};
        background: white;
      }

      .resume {
        width: 8.5in;
        height: 11in;
        margin: 0 auto;
        padding: ${margins.top}in ${margins.right}in ${margins.bottom}in ${margins.left}in;
        background: ${colors.background};
        color: ${colors.text};
        line-height: 1.4;
        font-size: 10.5pt;
      }

      /* Typography */
      .resume-name {
        font-size: ${RESUME_FORMAT.fontSizes.name}pt;
        font-weight: ${RESUME_FORMAT.fontWeights.name};
        line-height: ${RESUME_FORMAT.lineHeights.name};
        margin-bottom: ${RESUME_FORMAT.spacing.contactAfter}pt;
      }

      .resume-contact {
        font-size: ${RESUME_FORMAT.fontSizes.contact}pt;
        color: ${colors.secondary};
        line-height: ${RESUME_FORMAT.lineHeights.contact};
        margin-bottom: ${RESUME_FORMAT.spacing.contactAfter}pt;
      }

      .resume-section-heading {
        font-size: ${RESUME_FORMAT.fontSizes.sectionHeading}pt;
        font-weight: ${RESUME_FORMAT.fontWeights.sectionHeading};
        line-height: ${RESUME_FORMAT.lineHeights.sectionHeading};
        margin-top: ${RESUME_FORMAT.spacing.sectionHeadingBefore}pt;
        margin-bottom: ${RESUME_FORMAT.spacing.sectionHeadingAfter}pt;
        padding-bottom: 4pt;
        border-bottom: 1px solid ${colors.divider};
      }

      .resume-summary {
        font-size: ${RESUME_FORMAT.fontSizes.body}pt;
        line-height: ${RESUME_FORMAT.lineHeights.body};
        margin-bottom: ${RESUME_FORMAT.spacing.paragraphAfter}pt;
      }

      .resume-skills {
        font-size: ${RESUME_FORMAT.fontSizes.body}pt;
        line-height: ${RESUME_FORMAT.lineHeights.body};
        margin-bottom: ${RESUME_FORMAT.spacing.paragraphAfter}pt;
      }

      .resume-job-title {
        font-size: ${RESUME_FORMAT.fontSizes.jobTitle}pt;
        font-weight: ${RESUME_FORMAT.fontWeights.jobTitle};
        line-height: ${RESUME_FORMAT.lineHeights.body};
      }

      .resume-company {
        font-size: ${RESUME_FORMAT.fontSizes.company}pt;
        font-weight: ${RESUME_FORMAT.fontWeights.company};
        color: ${colors.secondary};
        line-height: ${RESUME_FORMAT.lineHeights.body};
      }

      .resume-dates {
        font-size: ${RESUME_FORMAT.fontSizes.dates}pt;
        font-weight: ${RESUME_FORMAT.fontWeights.dates};
        color: ${colors.secondary};
        line-height: ${RESUME_FORMAT.lineHeights.body};
      }

      .resume-bullet {
        font-size: ${RESUME_FORMAT.fontSizes.bullets}pt;
        line-height: ${RESUME_FORMAT.lineHeights.bullets};
        margin-bottom: ${RESUME_FORMAT.spacing.bulletAfter}pt;
        margin-left: ${RESUME_FORMAT.bullets.indentInches}in;
        text-indent: -${RESUME_FORMAT.bullets.hangingIndentInches}in;
      }

      .resume-education {
        font-size: ${RESUME_FORMAT.fontSizes.body}pt;
        line-height: ${RESUME_FORMAT.lineHeights.body};
        margin-bottom: ${RESUME_FORMAT.spacing.paragraphAfter}pt;
      }

      /* Sections */
      .role-block {
        margin-bottom: ${RESUME_FORMAT.spacing.roleBlockAfter}pt;
      }

      .role-header {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
      }

      .role-title-company {
        flex: 1;
      }

      .role-dates {
        margin-left: 8pt;
        flex-shrink: 0;
      }

      /* Alignment */
      .resume {
        text-align: left;
      }

      /* Spacing */
      p {
        margin: 0;
      }

      ul {
        list-style: none;
        padding: 0;
        margin: 0;
      }

      li {
        margin-bottom: ${RESUME_FORMAT.spacing.bulletAfter}pt;
      }

      /* Print styles */
      @media print {
        body {
          margin: 0;
          padding: 0;
        }

        .resume {
          width: auto;
          height: auto;
          margin: 0;
          box-shadow: none;
        }
      }

      /* Page break prevention */
      .role-block,
      .resume-section-heading {
        page-break-inside: avoid;
      }

      /* No headers/footers */
      @page {
        margin: 0.6in;
      }
    `;
  }

  /**
   * Render header (name + contact)
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
      <div class="resume-name">${this.escapeHTML(contact.name)}</div>
      <div class="resume-contact">${this.escapeHTML(contactLine)}</div>
    `;
  }

  /**
   * Render summary section
   */
  private renderSummary(summary: any): string {
    return `
      <div class="resume-section-heading">SUMMARY</div>
      <p class="resume-summary">${this.escapeHTML(summary.text)}</p>
    `;
  }

  /**
   * Render expertise/skills section
   */
  private renderExpertise(skills: any[]): string {
    const skillNames = skills.map((s) => this.escapeHTML(s.name)).join(' • ');
    return `
      <div class="resume-section-heading">CORE EXPERTISE</div>
      <p class="resume-skills">${skillNames}</p>
    `;
  }

  /**
   * Render professional experience section
   */
  private renderExperience(experience: any): string {
    let html = `<div class="resume-section-heading">PROFESSIONAL EXPERIENCE</div>`;

    for (const role of experience.roles) {
      html += `
        <div class="role-block">
          <div class="role-header">
            <div class="role-title-company">
              <div class="resume-job-title">${this.escapeHTML(role.jobTitle)}</div>
              <div class="resume-company">${this.escapeHTML(role.company)}${role.location ? ` • ${this.escapeHTML(role.location)}` : ''}</div>
            </div>
            <div class="role-dates resume-dates">${this.escapeHTML(role.startDate || '')}${role.endDate ? ` – ${this.escapeHTML(role.endDate)}` : ''}</div>
          </div>
          <ul>
            ${role.bullets.map((bullet: any) => `<li class="resume-bullet">${this.escapeHTML(bullet.text)}</li>`).join('')}
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
    let html = `<div class="resume-section-heading">EDUCATION</div>`;

    for (const edu of education) {
      const parts: string[] = [];
      if (edu.degree) parts.push(this.escapeHTML(edu.degree));
      parts.push(this.escapeHTML(edu.school));
      if (edu.year) parts.push(this.escapeHTML(edu.year));

      html += `<p class="resume-education">${parts.join(' • ')}</p>`;
    }

    return html;
  }

  /**
   * Render certifications section
   */
  private renderCertifications(certs: any[]): string {
    let html = `<div class="resume-section-heading">CERTIFICATIONS</div>`;

    for (const cert of certs) {
      const parts: string[] = [this.escapeHTML(cert.title)];
      if (cert.issuer) parts.push(this.escapeHTML(cert.issuer));
      if (cert.year) parts.push(this.escapeHTML(cert.year));

      html += `<p class="resume-education">${parts.join(' • ')}</p>`;
    }

    return html;
  }

  /**
   * Render portfolio section
   */
  private renderPortfolio(portfolio: any[]): string {
    let html = `<div class="resume-section-heading">PORTFOLIO</div>`;

    for (const item of portfolio) {
      const title = this.escapeHTML(item.title);
      const link = item.url ? `<a href="${this.escapeHTML(item.url)}">${title}</a>` : title;
      html += `<p class="resume-education">${link}`;
      if (item.description) {
        html += ` – ${this.escapeHTML(item.description)}`;
      }
      html += `</p>`;
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

export const resumeRenderer = new ResumeRenderer();
