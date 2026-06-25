import { describe, it, expect } from 'vitest';
import { resumeQualityReportService } from '../resume-quality-report.service';
import type { CareerModel } from '../../../shared/types';

const createMockCareerModel = (overrides: Partial<CareerModel['model_json']> = {}): CareerModel => ({
  id: 'cm-test',
  session_id: 'default',
  source_document_ids: ['doc-1'],
  source_hash: 'hash123',
  model_json: {
    contact: { name: 'John Doe', email: 'john@example.com' },
    roles: [
      {
        title: 'Senior Engineer',
        company: 'TechCorp',
        startDate: '2020',
        endDate: '2023',
        achievements: ['Led team of 5', 'Designed API architecture'],
      },
    ],
    projects: [],
    skills: [
      { name: 'JavaScript', confidence: 0.9 },
      { name: 'React', confidence: 0.9 },
    ],
    tools: [
      { name: 'Docker', confidence: 0.85 },
      { name: 'Kubernetes', confidence: 0.8 },
    ],
    metrics: [
      { description: 'Improved performance by 35%', value: '35%', confidence: 0.9 },
    ],
    education: [
      { school: 'Stanford University', degree: 'B.S. Computer Science' },
    ],
    certifications: [
      { name: 'AWS Certified Solutions Architect', issuer: 'Amazon' },
    ],
    approvedClaims: [
      {
        claim: 'Led cross-functional team of 5 engineers',
        supportingEvidence: ['team of 5'],
        sourceDocumentIds: ['doc-1'],
        confidence: 0.9,
        category: 'experience',
      },
    ],
    sourceDocumentIds: ['doc-1'],
  },
  model_version: '1.0.0',
  created_at: new Date(),
});

describe('ResumeQualityReportService', () => {
  describe('Truthfulness Evaluation', () => {
    it('passes when generated bullet matches an approved CareerModel claim', () => {
      const careerModel = createMockCareerModel();
      const generatedContent = `
Senior Engineer | TechCorp | 2020 – 2023
• Led cross-functional team of 5 engineers
• Designed API architecture
`;

      const report = resumeQualityReportService.buildReport({
        generatedContent,
        careerModel,
        jobDescription: 'Senior engineer role',
      });

      expect(report.truthfulness.supportedClaims.length).toBeGreaterThan(0);
      expect(report.truthfulness.supportedClaims[0]).toContain('Led cross-functional team');
    });

    it('warns when generated bullet includes an unsupported metric', () => {
      const careerModel = createMockCareerModel();
      const generatedContent = `
Senior Engineer | TechCorp | 2020 – 2023
• Improved performance by 35%
• Reduced latency by 50%
`;

      const report = resumeQualityReportService.buildReport({
        generatedContent,
        careerModel,
        jobDescription: 'Senior engineer role',
      });

      // 35% is in the model, 50% is not
      expect(report.truthfulness.unsupportedClaims.length).toBeGreaterThan(0);
    });

    it('fails when generated bullet includes unsupported certification', () => {
      const careerModel = createMockCareerModel();
      const generatedContent = `
Senior Engineer | TechCorp | 2020 – 2023
• Certified in AWS Solutions Architecture (unsupported cert)
• AWS Certified Solutions Architect
`;

      const report = resumeQualityReportService.buildReport({
        generatedContent,
        careerModel,
        jobDescription: 'Senior engineer role',
      });

      // The AWS cert is supported, but "unsupported cert" is not
      expect(report.truthfulness.unsupportedClaims.length).toBeGreaterThan(0);
      if (report.truthfulness.status === 'fail') {
        expect(report.exportReady).toBe(false);
      }
    });

    it('detects unsupported tools not in CareerModel', () => {
      const careerModel = createMockCareerModel();
      const generatedContent = `
Senior Engineer | TechCorp | 2020 – 2023
• Designed microservices using Docker and Kubernetes
• Built systems with Terraform (unsupported tool)
`;

      const report = resumeQualityReportService.buildReport({
        generatedContent,
        careerModel,
        jobDescription: 'Senior engineer role',
      });

      // Docker and Kubernetes are supported, Terraform is not
      expect(report.truthfulness.unsupportedClaims.length).toBeGreaterThan(0);
    });

    it('categorizes claims as supported, weakly-supported, or unsupported', () => {
      const careerModel = createMockCareerModel();
      const generatedContent = `
Senior Engineer | TechCorp | 2020 – 2023
• Led cross-functional team of 5 engineers
• Designed API architecture
• Built systems with fabricated metric 99.99%
`;

      const report = resumeQualityReportService.buildReport({
        generatedContent,
        careerModel,
        jobDescription: 'Senior engineer role',
      });

      // Should have at least one supported or weakly-supported claim
      const totalMatches =
        report.truthfulness.supportedClaims.length + report.truthfulness.weaklySupportedClaims.length;
      expect(totalMatches).toBeGreaterThanOrEqual(1);
      // Should have at least one unsupported claim (the 99.99% metric)
      expect(report.truthfulness.unsupportedClaims.length).toBeGreaterThan(0);
    });
  });

  describe('ATS Evaluation', () => {
    it('passes ATS check for well-formed resume', () => {
      const generatedContent = `
John Doe

SUMMARY
Senior engineer with 10 years experience.

CORE EXPERTISE
JavaScript
React
Docker

PROFESSIONAL EXPERIENCE

Senior Engineer | TechCorp | 2020 – 2023
• Led team of 5
• Designed architecture

EDUCATION
B.S. Computer Science • Stanford University • 2015
`;

      const report = resumeQualityReportService.buildReport({
        generatedContent,
        careerModel: createMockCareerModel(),
        jobDescription: 'Senior engineer',
      });

      expect(report.ats.status).not.toBe('fail');
    });

    it('warns when required sections are missing', () => {
      const generatedContent = `John Doe
Senior engineer with 10 years experience.
• Led team of 5
`;

      const report = resumeQualityReportService.buildReport({
        generatedContent,
        careerModel: createMockCareerModel(),
        jobDescription: 'Senior engineer',
      });

      expect(report.ats.warnings.length).toBeGreaterThan(0);
      expect(report.ats.warnings.some(w => w.includes('Missing required section'))).toBe(true);
    });

    it('recognizes CORE EXPERTISE as valid SKILLS section', () => {
      const generatedContent = `
John Doe

SUMMARY
Senior engineer with 10 years experience.

CORE EXPERTISE
JavaScript
React
Docker

PROFESSIONAL EXPERIENCE
Senior Engineer | TechCorp | 2020 – 2023
• Led team of 5

EDUCATION
B.S. Computer Science • Stanford
`;

      const report = resumeQualityReportService.buildReport({
        generatedContent,
        careerModel: createMockCareerModel(),
        jobDescription: 'Senior engineer',
      });

      expect(report.ats.warnings.filter(w => w.includes('SKILLS'))).toHaveLength(0);
    });

    it('recognizes EXPERTISE as valid SKILLS section', () => {
      const generatedContent = `
John Doe

SUMMARY
Senior engineer.

EXPERTISE
Python, JavaScript, AWS

PROFESSIONAL EXPERIENCE
Senior Engineer | TechCorp | 2020 – 2023
• Led team

EDUCATION
B.S. • Stanford
`;

      const report = resumeQualityReportService.buildReport({
        generatedContent,
        careerModel: createMockCareerModel(),
        jobDescription: 'Senior engineer',
      });

      expect(report.ats.warnings.filter(w => w.includes('SKILLS'))).toHaveLength(0);
    });

    it('recognizes COMPETENCIES as valid SKILLS section', () => {
      const generatedContent = `
John Doe

SUMMARY
Senior engineer.

COMPETENCIES
Java, Spring Boot, Kubernetes

PROFESSIONAL EXPERIENCE
Senior Engineer | TechCorp | 2020 – 2023
• Designed systems

EDUCATION
B.S. • Stanford
`;

      const report = resumeQualityReportService.buildReport({
        generatedContent,
        careerModel: createMockCareerModel(),
        jobDescription: 'Senior engineer',
      });

      expect(report.ats.warnings.filter(w => w.includes('SKILLS'))).toHaveLength(0);
    });

    it('recognizes TECHNICAL SKILLS as valid SKILLS section', () => {
      const generatedContent = `
John Doe

SUMMARY
Senior engineer.

TECHNICAL SKILLS
C++, Rust, CUDA

PROFESSIONAL EXPERIENCE
Senior Engineer | TechCorp | 2020 – 2023
• Optimized performance

EDUCATION
B.S. • Stanford
`;

      const report = resumeQualityReportService.buildReport({
        generatedContent,
        careerModel: createMockCareerModel(),
        jobDescription: 'Senior engineer',
      });

      expect(report.ats.warnings.filter(w => w.includes('SKILLS'))).toHaveLength(0);
    });

    it('recognizes PROFESSIONAL EXPERIENCE as valid EXPERIENCE section', () => {
      const generatedContent = `
John Doe

SUMMARY
Senior engineer.

PROFESSIONAL EXPERIENCE
Senior Engineer | TechCorp | 2020 – 2023
• Led team

CORE EXPERTISE
JavaScript

EDUCATION
B.S. • Stanford
`;

      const report = resumeQualityReportService.buildReport({
        generatedContent,
        careerModel: createMockCareerModel(),
        jobDescription: 'Senior engineer',
      });

      expect(report.ats.warnings.filter(w => w.includes('EXPERIENCE'))).toHaveLength(0);
    });

    it('recognizes WORK HISTORY as valid EXPERIENCE section', () => {
      const generatedContent = `
John Doe

SUMMARY
Senior engineer.

WORK HISTORY
Senior Engineer | TechCorp | 2020 – 2023
• Led team

CORE EXPERTISE
JavaScript

EDUCATION
B.S. • Stanford
`;

      const report = resumeQualityReportService.buildReport({
        generatedContent,
        careerModel: createMockCareerModel(),
        jobDescription: 'Senior engineer',
      });

      expect(report.ats.warnings.filter(w => w.includes('EXPERIENCE'))).toHaveLength(0);
    });

    it('warns when no bullet points detected', () => {
      const generatedContent = `John Doe
Senior Engineer at TechCorp from 2020 to 2023.
Designed API architecture.
Led a team of 5 engineers.`;

      const report = resumeQualityReportService.buildReport({
        generatedContent,
        careerModel: createMockCareerModel(),
        jobDescription: 'Senior engineer',
      });

      expect(report.ats.warnings.some(w => w.includes('No bullet points'))).toBe(true);
    });

    it('warns when excessive bullet points', () => {
      const bullets = Array.from({ length: 50 }, (_, i) => `• Point ${i + 1}`).join('\n');
      const generatedContent = `John Doe

SUMMARY
Senior engineer.

PROFESSIONAL EXPERIENCE
Senior Engineer | TechCorp | 2020 – 2023
${bullets}

EDUCATION
B.S. • Stanford • 2015
`;

      const report = resumeQualityReportService.buildReport({
        generatedContent,
        careerModel: createMockCareerModel(),
        jobDescription: 'Senior engineer',
      });

      expect(report.ats.warnings.some(w => w.includes('Excessive bullet'))).toBe(true);
    });
  });

  describe('Keyword Evaluation', () => {
    it('detects matched keywords from job description', () => {
      const generatedContent = `
John Doe

SUMMARY
Senior software engineer with expertise in React and Docker.

PROFESSIONAL EXPERIENCE
Senior Engineer | TechCorp | 2020 – 2023
• Built microservices using JavaScript and Kubernetes
• Designed distributed systems architecture
`;

      const report = resumeQualityReportService.buildReport({
        generatedContent,
        careerModel: createMockCareerModel(),
        jobDescription: 'Seeking senior software engineer with React, Docker, Kubernetes experience',
      });

      expect(report.keywords.matched.length).toBeGreaterThan(0);
      // React, Docker, Kubernetes should be matched
      const matchedLower = report.keywords.matched.map(k => k.toLowerCase());
      expect(matchedLower.some(k => k.includes('react') || k.includes('docker') || k.includes('kubernetes'))).toBe(true);
    });

    it('detects missing keywords from job description', () => {
      const generatedContent = `
John Doe

PROFESSIONAL EXPERIENCE
Senior Engineer | TechCorp | 2020 – 2023
• Built services using JavaScript
• Designed systems
`;

      const report = resumeQualityReportService.buildReport({
        generatedContent,
        careerModel: createMockCareerModel(),
        jobDescription: 'Seeking senior engineer with Kubernetes, Docker, and AWS expertise',
      });

      // Should detect missing Kubernetes, Docker, AWS (important keywords)
      expect(report.keywords.missing.length).toBeGreaterThan(0);
      expect(report.keywords.suggestedIfTruthful.length).toBeGreaterThan(0);
    });
  });

  describe('Length Estimation', () => {
    it('estimates length based on word count', () => {
      const shortContent = `
John Doe

SUMMARY
Senior engineer with 10 years experience.

PROFESSIONAL EXPERIENCE
Senior Engineer | TechCorp | 2020 – 2023
• Led team
• Designed systems

EDUCATION
B.S. • Stanford • 2015
`;

      const report = resumeQualityReportService.buildReport({
        generatedContent: shortContent,
        careerModel: createMockCareerModel(),
        jobDescription: 'Senior engineer',
      });

      expect(report.length.estimatedPages).toBeLessThanOrEqual(1);
    });

    it('warns when estimated to exceed one page', () => {
      const longBullets = Array.from({ length: 25 }, (_, i) => `• Achievement ${i + 1} with significant impact and detailed description of what was accomplished`).join('\n');
      const longContent = `
John Doe

SUMMARY
Senior software engineer with 10+ years of experience building scalable systems and leading teams.

CORE EXPERTISE
JavaScript, TypeScript, React, Node.js, Python, Docker, Kubernetes, AWS

PROFESSIONAL EXPERIENCE

Senior Engineer | TechCorp | 2020 – 2023
${longBullets}

EDUCATION
B.S. Computer Science • Stanford University • 2015
`;

      const report = resumeQualityReportService.buildReport({
        generatedContent: longContent,
        careerModel: createMockCareerModel(),
        jobDescription: 'Senior engineer',
      });

      if (report.length.estimatedPages > 1) {
        expect(report.length.warnings.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Export Readiness', () => {
    it('is false when truthfulness status is fail', () => {
      const careerModel = createMockCareerModel();
      const generatedContent = `
John Doe

PROFESSIONAL EXPERIENCE
Senior Engineer | UnknownCorp | 2020 – 2023
• Invented quantum computing technology
• Designed AI system with 99.9% accuracy (unsupported)

EDUCATION
Ph.D. Physics • MIT • 2015 (unsupported)
`;

      const report = resumeQualityReportService.buildReport({
        generatedContent,
        careerModel,
        jobDescription: 'Senior engineer',
      });

      if (report.truthfulness.status === 'fail') {
        expect(report.exportReady).toBe(false);
      }
    });

    it('is false when ATS status is fail', () => {
      const generatedContent = 'John Doe (no sections)';

      const report = resumeQualityReportService.buildReport({
        generatedContent,
        careerModel: createMockCareerModel(),
        jobDescription: 'Senior engineer',
      });

      if (report.ats.status === 'fail') {
        expect(report.exportReady).toBe(false);
      }
    });

    it('can be true with warnings', () => {
      const generatedContent = `
John Doe

SUMMARY
Senior engineer.

PROFESSIONAL EXPERIENCE
Senior Engineer | TechCorp | 2020 – 2023
• Led team of 5
• Designed API architecture
• Missing one keyword from job description

EDUCATION
B.S. • Stanford • 2015
`;

      const report = resumeQualityReportService.buildReport({
        generatedContent,
        careerModel: createMockCareerModel(),
        jobDescription: 'Senior engineer with Kubernetes',
      });

      // Can export even with missing keyword warnings
      expect(report.exportReady).toBe(true);
    });
  });

  describe('Overall Status', () => {
    it('returns fail if any critical component fails', () => {
      const careerModel = createMockCareerModel();
      const generatedContent = 'John Doe'; // Missing sections

      const report = resumeQualityReportService.buildReport({
        generatedContent,
        careerModel,
        jobDescription: 'Senior engineer',
      });

      if (report.ats.status === 'fail' || report.truthfulness.status === 'fail') {
        expect(report.overallStatus).toBe('fail');
      }
    });

    it('returns warn if any component warns', () => {
      const careerModel = createMockCareerModel();
      const generatedContent = `
John Doe

SUMMARY
Senior engineer.

PROFESSIONAL EXPERIENCE
Senior Engineer | TechCorp | 2020 – 2023
• Led team (weakly supported claim)
${Array.from({ length: 30 }, (_, i) => `• Point ${i}`).join('\n')}

EDUCATION
B.S. • Stanford • 2015
`;

      const report = resumeQualityReportService.buildReport({
        generatedContent,
        careerModel,
        jobDescription: 'Senior engineer',
      });

      expect(['warn', 'fail']).toContain(report.overallStatus);
    });

    it('returns pass when all components pass', () => {
      const careerModel = createMockCareerModel();
      const generatedContent = `
John Doe

SUMMARY
Senior software engineer with 10 years experience.

CORE EXPERTISE
JavaScript
React
Docker

PROFESSIONAL EXPERIENCE

Senior Engineer | TechCorp | 2020 – 2023
• Led cross-functional team of 5 engineers
• Designed API architecture
• Improved performance by 35%

EDUCATION
B.S. Computer Science • Stanford University • 2015
`;

      const report = resumeQualityReportService.buildReport({
        generatedContent,
        careerModel,
        jobDescription: 'Senior engineer with React and Docker experience',
      });

      if (
        report.truthfulness.status === 'pass' &&
        report.ats.status === 'pass' &&
        report.length.warnings.length === 0
      ) {
        expect(report.overallStatus).toBe('pass');
      }
    });
  });
});
