import { describe, it, expect } from 'vitest';
import { resumeParser } from '../resume-parser.service';

describe('ResumeParser', () => {
  describe('Basic parsing', () => {
    it('should parse a simple resume with summary', () => {
      const text = 'SUMMARY\nExperienced engineer with 5 years of experience.';
      const resume = resumeParser.parse(text);

      expect(resume.summary).toBeDefined();
      expect(resume.summary?.text).toContain('Experienced engineer');
    });

    it('should extract contact info when provided', () => {
      const text = 'Jane Doe\njane@example.com';
      const resume = resumeParser.parse(text, {
        name: 'Jane Doe',
        email: 'jane@example.com',
      });

      expect(resume.contact.name).toBe('Jane Doe');
      expect(resume.contact.email).toBe('jane@example.com');
    });
  });

  describe('Professional Experience Parsing Regression', () => {
    it('should parse role header with em-dash: Title — Company', () => {
      const text =
        'PROFESSIONAL EXPERIENCE\n\n' +
        'Senior Designer — Acme Corp\n' +
        '• Led design\n' +
        '• Built components';

      const resume = resumeParser.parse(text);

      expect(resume.experience).toBeDefined();
      expect(resume.experience?.roles).toBeDefined();
      expect(resume.experience?.roles.length).toBeGreaterThan(0);
      const role = resume.experience?.roles[0]!;
      expect(role.jobTitle).toContain('Senior Designer');
      expect(role.company).toContain('Acme Corp');
      expect(role.bullets).toBeDefined();
      expect(role.bullets.length).toBe(2);
    });

    it('should parse role header with em-dash: Company — Title', () => {
      const text =
        'PROFESSIONAL EXPERIENCE\n\n' +
        'Acme Corp — Senior Designer\n' +
        '• Led design\n' +
        '• Built components';

      const resume = resumeParser.parse(text);

      expect(resume.experience).toBeDefined();
      expect(resume.experience?.roles.length).toBeGreaterThan(0);
      const role = resume.experience?.roles[0]!;
      expect(role.jobTitle).toContain('Senior Designer');
      expect(role.company).toContain('Acme Corp');
    });

    it('should parse role header with en-dash: Title – Company', () => {
      const text =
        'PROFESSIONAL EXPERIENCE\n\n' +
        'Principal Engineer – TechCorp\n' +
        '• Architected systems\n' +
        '• Led team';

      const resume = resumeParser.parse(text);

      expect(resume.experience).toBeDefined();
      expect(resume.experience?.roles.length).toBeGreaterThan(0);
      const role = resume.experience?.roles[0]!;
      expect(role.jobTitle).toContain('Principal Engineer');
      expect(role.company).toContain('TechCorp');
    });

    it('should preserve pipe-format backward compatibility: Title | Company', () => {
      const text =
        'PROFESSIONAL EXPERIENCE\n\n' +
        'Senior Engineer | Tech Corp | 2020 – 2023\n' +
        '• Built API\n' +
        '• Led team';

      const resume = resumeParser.parse(text);

      expect(resume.experience).toBeDefined();
      expect(resume.experience?.roles.length).toBeGreaterThan(0);
      const role = resume.experience?.roles[0]!;
      expect(role.jobTitle).toContain('Senior Engineer');
      expect(role.company).toContain('Tech Corp');
      expect(role.bullets!.length).toBe(2);
    });

    it('should NOT mistake date ranges for role separators', () => {
      const text =
        'PROFESSIONAL EXPERIENCE\n\n' +
        'Senior Engineer | Tech Corp | 2020 – 2023\n' +
        '• Project A: 2022–2024\n' +
        '• Initiative spans Q1 – Q4\n' +
        '• Task estimated at 3–5 hours';

      const resume = resumeParser.parse(text);

      expect(resume.experience).toBeDefined();
      expect(resume.experience?.roles.length).toBe(1);
      const role = resume.experience?.roles[0]!;
      expect(role.jobTitle).toContain('Senior Engineer');
      expect(role.bullets!.length).toBe(3);
      // Verify bullets don't contain role-like content
      const bulletText = role.bullets.map((b: any) => b.text).join(' ');
      expect(bulletText).toContain('Project A');
      expect(bulletText).toContain('Initiative');
    });

    it('should extract dates from role headers', () => {
      const text =
        'PROFESSIONAL EXPERIENCE\n\n' +
        'Senior Designer | Acme Inc | 2020 – 2023\n' +
        '• Led team';

      const resume = resumeParser.parse(text);

      const role = resume.experience?.roles[0]!;
      expect(role.startDate).toBe('2020');
      expect(role.endDate).toBe('2023');
    });

    it('should handle location in pipe-separated headers', () => {
      const text =
        'PROFESSIONAL EXPERIENCE\n\n' +
        'Senior Engineer | Tech Corp | San Francisco | 2020 – 2023\n' +
        '• Architected systems';

      const resume = resumeParser.parse(text);

      const role = resume.experience?.roles[0]!;
      expect(role.location).toBe('San Francisco');
      expect(role.startDate).toBe('2020');
      expect(role.endDate).toBe('2023');
    });

    it('should attach achievement bullets to correct role', () => {
      const text =
        'PROFESSIONAL EXPERIENCE\n\n' +
        'Role A | Company A | 2020 – 2022\n' +
        '• Achievement A1\n' +
        '• Achievement A2\n\n' +
        'Role B | Company B | 2022 – 2023\n' +
        '• Achievement B1';

      const resume = resumeParser.parse(text);

      expect(resume.experience?.roles.length).toBe(2);

      const roleA = resume.experience?.roles[0]!;
      expect(roleA.jobTitle).toContain('Role A');
      expect(roleA.bullets!.length).toBe(2);
      expect(roleA.bullets![0].text).toContain('Achievement A1');

      const roleB = resume.experience?.roles[1]!;
      expect(roleB.jobTitle).toContain('Role B');
      expect(roleB.bullets!.length).toBe(1);
      expect(roleB.bullets![0].text).toContain('Achievement B1');
    });

    it('should handle roles with minimal achievements', () => {
      const text =
        'PROFESSIONAL EXPERIENCE\n\n' +
        'Designer | Startup | 2023 – Present\n' +
        '• Single achievement\n\n' +
        'EDUCATION';

      const resume = resumeParser.parse(text);

      const role = resume.experience?.roles[0]!;
      expect(role.jobTitle).toContain('Designer');
      expect(role.bullets!.length).toBe(1);
    });

    it('should preserve PROFESSIONAL EXPERIENCE section in structured resume', () => {
      const text =
        'PROFESSIONAL EXPERIENCE\n\n' +
        'Senior Engineer | Tech Corp | 2020 – 2023\n' +
        '• Achievement 1';

      const resume = resumeParser.parse(text);

      // Should have experience section
      expect(resume.experience).toBeDefined();
      expect(resume.experience?.roles).toBeDefined();
      expect(Array.isArray(resume.experience?.roles)).toBe(true);
      expect(resume.experience?.roles.length).toBeGreaterThan(0);
    });

    it('should handle EXPERIENCE alias for PROFESSIONAL EXPERIENCE', () => {
      const text =
        'EXPERIENCE\n\n' +
        'Designer | Studio | 2021 – Present\n' +
        '• Created designs';

      const resume = resumeParser.parse(text);

      expect(resume.experience).toBeDefined();
      expect(resume.experience?.roles.length).toBeGreaterThan(0);
    });

    it('should transition to next section correctly', () => {
      const text =
        'PROFESSIONAL EXPERIENCE\n\n' +
        'Senior Engineer | Tech Corp | 2020 – 2023\n' +
        '• Achievement\n\n' +
        'EDUCATION\n\n' +
        'B.S. Computer Science | University';

      const resume = resumeParser.parse(text);

      expect(resume.experience).toBeDefined();
      expect(resume.experience?.roles.length).toBe(1);
      expect(resume.education).toBeDefined();
      expect(resume.education!.length).toBeGreaterThan(0);
    });

    it('should support Claude-generated format: Title — Company with multiple roles', () => {
      const text =
        'PROFESSIONAL EXPERIENCE\n\n' +
        'Senior Product Designer — Tovuti LMS\n' +
        '2025 – 2026\n' +
        '• Built design system\n' +
        '• Shipped AI features\n\n' +
        'Senior UX Designer — Transamerica\n' +
        '2020 – 2024\n' +
        '• Led redesign\n' +
        '• Improved adoption';

      const resume = resumeParser.parse(text);

      expect(resume.experience).toBeDefined();
      expect(resume.experience?.roles.length).toBe(2);

      const role1 = resume.experience?.roles[0]!;
      expect(role1.jobTitle).toContain('Senior Product Designer');
      expect(role1.company).toContain('Tovuti LMS');
      expect(role1.bullets!.length).toBe(2);

      const role2 = resume.experience?.roles[1]!;
      expect(role2.jobTitle).toContain('Senior UX Designer');
      expect(role2.company).toContain('Transamerica');
      expect(role2.bullets!.length).toBe(2);
    });

    it('should handle edge case: role header without bullets before section end', () => {
      const text =
        'PROFESSIONAL EXPERIENCE\n\n' +
        'Senior Engineer | Tech Corp | 2020 – 2023\n\n' +
        'SKILLS';

      const resume = resumeParser.parse(text);

      expect(resume.experience).toBeDefined();
      expect(resume.experience?.roles.length).toBe(1);
      const role = resume.experience?.roles[0]!;
      expect(role.jobTitle).toContain('Senior Engineer');
    });
  });

  describe('Skills and Expertise parsing', () => {
    it('should parse CORE EXPERTISE section', () => {
      const text = 'CORE EXPERTISE\nFigma\nSketch\nJira\nUI Design';
      const resume = resumeParser.parse(text);

      expect(resume.expertise).toBeDefined();
      expect(resume.expertise!.length).toBeGreaterThan(0);
    });

    it('should handle bullet-separated expertise', () => {
      const text = 'EXPERTISE\nFigma • Sketch • React • TypeScript';
      const resume = resumeParser.parse(text);

      expect(resume.expertise).toBeDefined();
      expect(resume.expertise!.length).toBeGreaterThan(0);
    });
  });

  describe('Education parsing', () => {
    it('should parse education section', () => {
      const text = 'EDUCATION\nB.S. Computer Science, Stanford University';
      const resume = resumeParser.parse(text);

      expect(resume.education).toBeDefined();
      expect(resume.education!.length).toBeGreaterThan(0);
    });
  });
});
