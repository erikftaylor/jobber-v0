/**
 * Resume Parser
 * Converts Claude-generated resume text → StructuredResume JSON
 */

import type { StructuredResume, ResumeRole } from '../../shared/resumeTypes';

export class ResumeParser {
  /**
   * Parse Claude-generated resume text into StructuredResume
   */
  parse(generatedText: string, contactInfo?: Partial<any>): StructuredResume {
    const lines = generatedText.split('\n').map((l) => l.trim());

    const resume: StructuredResume = {
      contact: {
        name: contactInfo?.name || 'Your Name',
        email: contactInfo?.email,
        phone: contactInfo?.phone,
        location: contactInfo?.location,
        linkedin: contactInfo?.linkedin,
        portfolio: contactInfo?.portfolio,
      },
    };

    let currentSection = '';
    let currentRole: Partial<ResumeRole> = {};
    const roles: ResumeRole[] = [];

    for (const line of lines) {
      // Skip empty lines
      if (!line) continue;

      // Detect sections
      if (this.isSection(line)) {
        // Save current role if exists
        if (currentRole.jobTitle && currentRole.bullets) {
          roles.push(currentRole as ResumeRole);
          currentRole = {};
        }

        currentSection = line.toUpperCase();
        continue;
      }

      // Parse by section
      switch (currentSection) {
        case 'SUMMARY':
          if (!resume.summary) {
            resume.summary = { text: line };
          } else {
            resume.summary.text += ' ' + line;
          }
          break;

        case 'CORE EXPERTISE':
        case 'EXPERTISE':
        case 'SKILLS':
          if (!resume.expertise) resume.expertise = [];
          const skills = line.split('•').map((s) => s.trim());
          for (const skill of skills) {
            if (skill && !resume.expertise.find((e) => e.name.toLowerCase() === skill.toLowerCase())) {
              resume.expertise.push({ name: skill });
            }
          }
          break;

        case 'PROFESSIONAL EXPERIENCE':
        case 'EXPERIENCE':
          // Parse role header (title, company, dates)
          if (this.isRoleHeader(line)) {
            // Save previous role
            if (currentRole.jobTitle && currentRole.bullets && currentRole.bullets.length > 0) {
              roles.push(currentRole as ResumeRole);
            }

            const parsed = this.parseRoleHeader(line);
            currentRole = {
              jobTitle: parsed.jobTitle,
              company: parsed.company,
              location: parsed.location,
              startDate: parsed.startDate,
              endDate: parsed.endDate,
              bullets: [],
            };
          } else if (line.startsWith('•')) {
            // Bullet point
            if (!currentRole.bullets) currentRole.bullets = [];
            currentRole.bullets.push({ text: line });
          }
          break;

        case 'EDUCATION':
          if (!resume.education) resume.education = [];
          resume.education.push({
            school: line,
          });
          break;

        case 'CERTIFICATIONS':
          if (!resume.certifications) resume.certifications = [];
          resume.certifications.push({
            title: line,
          });
          break;

        case 'PORTFOLIO':
          if (!resume.portfolio) resume.portfolio = [];
          resume.portfolio.push({
            title: line,
          });
          break;
      }
    }

    // Save last role
    if (currentRole.jobTitle && currentRole.bullets && currentRole.bullets.length > 0) {
      roles.push(currentRole as ResumeRole);
    }

    if (roles.length > 0) {
      resume.experience = { roles };
    }

    return resume;
  }

  /**
   * Detect if line is a section header
   */
  private isSection(line: string): boolean {
    const sections = [
      'SUMMARY',
      'CORE EXPERTISE',
      'EXPERTISE',
      'SKILLS',
      'PROFESSIONAL EXPERIENCE',
      'EXPERIENCE',
      'EDUCATION',
      'CERTIFICATIONS',
      'PORTFOLIO',
    ];
    return sections.some((s) => line.toUpperCase() === s);
  }

  /**
   * Detect if line is a role header
   * Heuristic: Contains company + job title + optional dates
   */
  private isRoleHeader(line: string): boolean {
    // Role headers can be:
    // - "Title — Company" (em-dash format)
    // - "Title | Company" (pipe format)
    // - "Title – Company" (en-dash format)
    // But NOT date lines or bullets
    if (line.startsWith('•') || line.match(/^\d{4}/)) return false;

    // Must have em-dash (—), en-dash (–), or pipe (|) as separator
    return line.includes('—') || line.includes('–') || (line.includes('|') && !line.includes('•'));
  }

  /**
   * Parse role header into components
   * Handles multiple formats:
   * - "Job Title — Company"     (em-dash, Claude output format)
   * - "Title – Company"         (en-dash)
   * - "Title | Company | Location | Dates"  (pipe format)
   */
  private parseRoleHeader(line: string): {
    jobTitle: string;
    company: string;
    location?: string;
    startDate?: string;
    endDate?: string;
  } {
    // Try em-dash format first: "Title — Company"
    if (line.includes('—')) {
      const [title, company] = line.split('—').map((p) => p.trim());
      return {
        jobTitle: title || '',
        company: company || '',
      };
    }

    // Try en-dash format: "Title – Company"
    if (line.includes('–') && !line.includes('|')) {
      const [title, company] = line.split('–').map((p) => p.trim());
      return {
        jobTitle: title || '',
        company: company || '',
      };
    }

    // Fall back to pipe format: "Title | Company | Location | Dates"
    const parts = line.split('|').map((p) => p.trim());
    let jobTitle = parts[0] || '';
    let company = parts[1] || '';
    let location = parts[2] || '';
    let dates = parts[3] || '';

    // Parse dates
    let startDate = '';
    let endDate = '';
    if (dates) {
      const dateParts = dates.split('–').map((d) => d.trim());
      startDate = dateParts[0] || '';
      endDate = dateParts[1] || '';
    }

    // If location contains dates, move them
    if (location && (location.includes('20') || location.match(/\d{4}/))) {
      const locParts = location.split(/\s+(?=20\d{2})/);
      location = locParts[0];
      if (!startDate) {
        const dateParts = locParts[1]?.split('–').map((d) => d.trim()) || [];
        startDate = dateParts[0] || '';
        endDate = dateParts[1] || '';
      }
    }

    return {
      jobTitle,
      company,
      location: location || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    };
  }
}

export const resumeParser = new ResumeParser();
