import { Document, Packer, Paragraph, TextRun } from 'docx';

/**
 * DOCX Resume Export Service.
 *
 * Converts generated resume text (from Claude) into a .docx file Buffer.
 * Structure:
 * - Parses plain-text resume into sections (title, summary, experience, education, skills)
 * - Renders skills one per line (per locked spec)
 * - Preserves special characters safely (docx library handles XML escaping)
 * - Returns a Buffer ready to send as a file download
 */
export class DocxGeneratorService {
  /**
   * Generate a DOCX Buffer from plain-text resume content.
   * @param content Raw resume text from Claude
   * @returns Promise<Buffer> — valid DOCX file as Buffer
   * @throws Error if content is empty or only whitespace
   */
  async generate(content: string): Promise<Buffer> {
    // Validate input
    if (!content || !content.trim()) {
      throw new Error('Resume content is empty or contains only whitespace. Cannot generate DOCX.');
    }

    // Parse the resume text into structured sections
    const sections = this.parseResume(content);

    // Build DOCX paragraphs from sections
    const paragraphs = this.buildParagraphs(sections);

    // Create and pack the document
    const doc = new Document({
      sections: [
        {
          children: paragraphs,
        },
      ],
    });

    // Render to Buffer
    const buffer = await Packer.toBuffer(doc);
    return buffer;
  }

  /**
   * Parse plain-text resume into structured sections.
   * Recognizes section headers (SUMMARY, EXPERIENCE, EDUCATION, SKILLS, etc.)
   * and groups content under each.
   */
  private parseResume(content: string): ResumeSection[] {
    const lines = content.split('\n');
    const sections: ResumeSection[] = [];
    let currentSection: ResumeSection | null = null;

    // Section headers (all caps, often followed by blank line or text)
    const sectionHeaders = [
      'SUMMARY', 'EXPERIENCE', 'EDUCATION', 'SKILLS', 'CERTIFICATIONS',
      'LANGUAGES', 'AWARDS', 'PUBLICATIONS', 'PROJECTS', 'VOLUNTEER',
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Check if this line is a section header
      const headerMatch = sectionHeaders.find(h => trimmed === h || trimmed.startsWith(h + ' '));
      if (headerMatch) {
        // Save previous section if any
        if (currentSection) {
          sections.push(currentSection);
        }
        // Start new section
        currentSection = {
          title: headerMatch,
          content: [],
        };
      } else if (currentSection) {
        // Add to current section
        if (trimmed) {
          currentSection.content.push(trimmed);
        }
      } else if (trimmed) {
        // Content before any section header (usually the title/name)
        if (!sections.find(s => s.title === '__NAME')) {
          currentSection = {
            title: '__NAME',
            content: [trimmed],
          };
          sections.push(currentSection);
          currentSection = null;
        }
      }
    }

    // Save final section
    if (currentSection) {
      sections.push(currentSection);
    }

    return sections;
  }

  /**
   * Build DOCX Paragraph objects from structured resume sections.
   */
  private buildParagraphs(sections: ResumeSection[]): Paragraph[] {
    const paragraphs: Paragraph[] = [];

    for (const section of sections) {
      if (section.title === '__NAME') {
        // Name/title at the top — bold and large
        for (const line of section.content) {
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: line,
                  bold: true,
                  size: 28, // 14pt in half-points
                }),
              ],
              spacing: { after: 100 },
            })
          );
        }
      } else if (section.title === 'SKILLS') {
        // SKILLS section: each skill as a separate paragraph (one per line)
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: section.title,
                bold: true,
                size: 24, // 12pt
              }),
            ],
            spacing: { after: 100 },
          })
        );

        // Parse skills: could be comma-separated, bullet points, or already one per line
        // We'll split by common delimiters and render each as a paragraph
        const skillsText = section.content.join(' ');
        const skillItems = this.parseSkills(skillsText);

        for (const skill of skillItems) {
          if (skill.trim()) {
            paragraphs.push(
              new Paragraph({
                text: skill.trim(),
                spacing: { after: 50 },
              })
            );
          }
        }
      } else {
        // Other sections: title as heading, content as paragraphs
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: section.title,
                bold: true,
                size: 24, // 12pt
              }),
            ],
            spacing: { after: 100 },
          })
        );

        for (const line of section.content) {
          paragraphs.push(
            new Paragraph({
              text: line,
              spacing: { after: 50 },
            })
          );
        }
      }
    }

    return paragraphs;
  }

  /**
   * Parse skills text into individual items.
   * Handles formats like:
   * - "TypeScript • React • Node.js"
   * - "TypeScript, React, Node.js"
   * - "- TypeScript\n- React"
   */
  private parseSkills(skillsText: string): string[] {
    // Split by common delimiters: •, |, comma, semicolon, dash, newline
    const skills = skillsText
      .split(/[•|,;–\-\n]/)
      .map(s => s.trim())
      .filter(s => s.length > 0 && s !== '&' && s !== 'and');

    return skills;
  }
}

interface ResumeSection {
  title: string;
  content: string[];
}

export const docxGeneratorService = new DocxGeneratorService();
