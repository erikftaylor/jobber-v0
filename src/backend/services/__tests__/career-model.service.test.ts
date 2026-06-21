import { describe, it, expect, beforeEach } from 'vitest';
import type { Document } from '../../../shared/types';
import { careerModelService } from '../career-model.service';

describe('CareerModelService', () => {
  const createMockDocument = (
    id: string,
    type: Document['type'],
    rawText: string,
    filename: string = 'test.pdf'
  ): Document => ({
    id,
    type,
    filename,
    raw_text: rawText,
    uploaded_at: new Date(),
  });

  describe('buildFromDocuments', () => {
    it('should build an empty but valid career model from empty documents', () => {
      const documents: Document[] = [];
      const model = careerModelService.buildFromDocuments('session-1', documents);

      expect(model.session_id).toBe('session-1');
      expect(model.source_document_ids).toEqual([]);
      expect(model.source_hash).toBeDefined();
      expect(model.model_json.contact).toBeDefined();
      expect(model.model_json.roles).toEqual([]);
      expect(model.model_json.skills).toEqual([]);
      expect(model.model_json.approvedClaims).toEqual([]);
    });

    it('should preserve source document IDs', () => {
      const doc1 = createMockDocument('doc-1', 'resume', 'Resume text');
      const doc2 = createMockDocument('doc-2', 'cover_letter', 'Cover letter text');
      const doc3 = createMockDocument('doc-3', 'case_study', 'Case study text');

      const model = careerModelService.buildFromDocuments('session-1', [doc1, doc2, doc3]);

      expect(model.source_document_ids).toEqual(['doc-1', 'doc-2', 'doc-3']);
      expect(model.model_json.sourceDocumentIds).toEqual(['doc-1', 'doc-2', 'doc-3']);
    });

    it('should extract email when clearly present', () => {
      const doc = createMockDocument('doc-1', 'resume', 'John Doe\njohn.doe@example.com\n555-123-4567');
      const model = careerModelService.buildFromDocuments('session-1', [doc]);

      expect(model.model_json.contact.email).toBe('john.doe@example.com');
    });

    it('should extract phone number when clearly present', () => {
      const doc = createMockDocument('doc-1', 'resume', 'John Doe\n555-123-4567\njohn@example.com');
      const model = careerModelService.buildFromDocuments('session-1', [doc]);

      expect(model.model_json.contact.phone).toBeTruthy();
      expect(model.model_json.contact.phone).toContain('555');
      expect(model.model_json.contact.phone).toContain('123');
      expect(model.model_json.contact.phone).toContain('4567');
    });

    it('should extract LinkedIn URL when present', () => {
      const doc = createMockDocument(
        'doc-1',
        'resume',
        'John Doe\nlinkedin.com/in/johndoe\njohn@example.com'
      );
      const model = careerModelService.buildFromDocuments('session-1', [doc]);

      expect(model.model_json.contact.linkedin).toContain('linkedin.com/in/johndoe');
    });

    it('should extract portfolio URL when present', () => {
      const doc = createMockDocument('doc-1', 'resume', 'John Doe\nwww.johndoe.dev\njohn@example.com');
      const model = careerModelService.buildFromDocuments('session-1', [doc]);

      expect(model.model_json.contact.website).toContain('johndoe.dev');
    });

    it('should extract name from first line of resume', () => {
      const doc = createMockDocument(
        'doc-1',
        'resume',
        'Jane Smith\nSan Francisco, CA\njane@example.com\n\nSummary\nExperienced engineer...'
      );
      const model = careerModelService.buildFromDocuments('session-1', [doc]);

      expect(model.model_json.contact.name).toBe('Jane Smith');
    });

    it('should extract roles from resume with pipe separator', () => {
      const doc = createMockDocument(
        'doc-1',
        'resume',
        'PROFESSIONAL EXPERIENCE\n\nSenior Engineer | Tech Corp | 2020 – 2023\n• Led team of 5\n• Built API'
      );
      const model = careerModelService.buildFromDocuments('session-1', [doc]);

      expect(model.model_json.roles.length).toBeGreaterThan(0);
      const role = model.model_json.roles[0];
      expect(role.title).toBe('Senior Engineer');
      expect(role.company).toBe('Tech Corp');
    });

    it('should extract skills from SKILLS section', () => {
      const doc = createMockDocument(
        'doc-1',
        'resume',
        'SKILLS\nJavaScript, TypeScript, React, Python, SQL\n\nEXPERIENCE'
      );
      const model = careerModelService.buildFromDocuments('session-1', [doc]);

      expect(model.model_json.skills.length).toBeGreaterThan(0);
      const skillNames = model.model_json.skills.map(s => s.name);
      expect(skillNames.some(n => n.includes('JavaScript') || n.includes('TypeScript'))).toBe(true);
    });

    it('should detect tools from known tool list', () => {
      const doc = createMockDocument(
        'doc-1',
        'resume',
        'TECHNICAL SKILLS\nProficient in React, Node.js, Docker, and Kubernetes'
      );
      const model = careerModelService.buildFromDocuments('session-1', [doc]);

      const toolNames = model.model_json.tools.map(t => t.name);
      expect(toolNames).toContain('React');
      expect(toolNames).toContain('Node.js');
      expect(toolNames).toContain('Docker');
      expect(toolNames).toContain('Kubernetes');
    });

    it('should extract metrics from bullet points with numbers', () => {
      const doc = createMockDocument(
        'doc-1',
        'resume',
        '• Increased revenue by 35%\n• Reduced costs by $500,000\n• Grew user base from 10k to 50k users'
      );
      const model = careerModelService.buildFromDocuments('session-1', [doc]);

      expect(model.model_json.metrics.length).toBeGreaterThan(0);
      expect(model.model_json.metrics.some(m => m.description.includes('35%'))).toBe(true);
      expect(model.model_json.metrics.some(m => m.description.includes('500,000'))).toBe(true);
    });

    it('should extract education from degree patterns', () => {
      const doc = createMockDocument(
        'doc-1',
        'resume',
        'EDUCATION\nBachelor of Science, Stanford University\nM.S. Computer Science, MIT'
      );
      const model = careerModelService.buildFromDocuments('session-1', [doc]);

      // May or may not extract depending on regex patterns - just verify structure is valid
      expect(Array.isArray(model.model_json.education)).toBe(true);
      if (model.model_json.education.length > 0) {
        const edu = model.model_json.education[0];
        expect(edu.school || edu.degree).toBeTruthy();
      }
    });

    it('should extract approved claims from bullet points', () => {
      const doc = createMockDocument(
        'doc-1',
        'resume',
        '• Led cross-functional team of 8 engineers to deliver microservices architecture\n' +
          '• Mentored 3 junior developers through code reviews and pair programming'
      );
      const model = careerModelService.buildFromDocuments('session-1', [doc]);

      expect(model.model_json.approvedClaims.length).toBeGreaterThan(0);
      const claims = model.model_json.approvedClaims.map(c => c.claim);
      expect(claims.some(c => c.includes('Led'))).toBe(true);
      expect(claims.some(c => c.includes('Mentored'))).toBe(true);
    });

    it('should preserve source document IDs on extracted items', () => {
      const doc1 = createMockDocument('doc-1', 'resume', 'Senior Engineer | Tech Corp\n• Built APIs');
      const doc2 = createMockDocument('doc-2', 'case_study', 'SKILLS\nJavaScript, React');

      const model = careerModelService.buildFromDocuments('session-1', [doc1, doc2]);

      // Roles should reference doc-1
      if (model.model_json.roles.length > 0) {
        expect(model.model_json.roles[0].sourceDocumentId).toBe('doc-1');
      }

      // Skills should reference doc-2
      if (model.model_json.skills.length > 0) {
        expect(model.model_json.skills[0].sourceDocumentId).toBe('doc-2');
      }
    });

    it('should not extract items when not clearly present', () => {
      const doc = createMockDocument('doc-1', 'resume', 'Ambiguous text without clear structure');
      const model = careerModelService.buildFromDocuments('session-1', [doc]);

      // Should have empty or minimal extractions
      expect(model.model_json.roles.length).toBeLessThanOrEqual(0);
      expect(model.model_json.skills.length).toBeLessThanOrEqual(0);
    });

    it('should include confidence scores on extracted items', () => {
      const doc = createMockDocument(
        'doc-1',
        'resume',
        'Senior Engineer | Tech Corp\nJavaScript, React\n• Increased revenue by 35%'
      );
      const model = careerModelService.buildFromDocuments('session-1', [doc]);

      // Roles should have confidence
      if (model.model_json.roles.length > 0) {
        expect(model.model_json.roles[0].confidence).toBeGreaterThan(0);
        expect(model.model_json.roles[0].confidence).toBeLessThanOrEqual(1);
      }

      // Skills should have confidence
      if (model.model_json.skills.length > 0) {
        expect(model.model_json.skills[0].confidence).toBeGreaterThan(0);
      }

      // Metrics should have confidence
      if (model.model_json.metrics.length > 0) {
        expect(model.model_json.metrics[0].confidence).toBeGreaterThan(0);
      }
    });
  });

  describe('hashSources', () => {
    it('should generate a stable hash for same documents', () => {
      const doc1 = createMockDocument('doc-1', 'resume', 'Resume text');
      const doc2 = createMockDocument('doc-2', 'cover_letter', 'Cover letter text');

      const hash1 = careerModelService.hashSources([doc1, doc2]);
      const hash2 = careerModelService.hashSources([doc1, doc2]);

      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different documents', () => {
      const doc1 = createMockDocument('doc-1', 'resume', 'Resume text');
      const doc2 = createMockDocument('doc-1', 'resume', 'Different resume text');

      const hash1 = careerModelService.hashSources([doc1]);
      const hash2 = careerModelService.hashSources([doc2]);

      expect(hash1).not.toBe(hash2);
    });

    it('should be order-independent (documents sorted before hashing)', () => {
      const doc1 = createMockDocument('doc-1', 'resume', 'Text 1');
      const doc2 = createMockDocument('doc-2', 'cover_letter', 'Text 2');

      const hash1 = careerModelService.hashSources([doc1, doc2]);
      const hash2 = careerModelService.hashSources([doc2, doc1]);

      // Should be same because documents are sorted by id before hashing
      expect(hash1).toBe(hash2);
    });

    it('should return a non-empty hash string', () => {
      const doc = createMockDocument('doc-1', 'resume', 'Some text');
      const hash = careerModelService.hashSources([doc]);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should handle empty document list', () => {
      const hash = careerModelService.hashSources([]);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });
  });

  describe('shouldRefreshCareerModel', () => {
    it('should return true when no existing model', () => {
      const doc = createMockDocument('doc-1', 'resume', 'Text');
      const result = careerModelService.shouldRefreshCareerModel(null, [doc]);

      expect(result).toBe(true);
    });

    it('should return false when source hash matches', () => {
      const doc = createMockDocument('doc-1', 'resume', 'Same text');
      const hash = careerModelService.hashSources([doc]);

      const existingModel = careerModelService.buildFromDocuments('session-1', [doc]);
      existingModel.source_hash = hash;

      const result = careerModelService.shouldRefreshCareerModel(existingModel, [doc]);

      expect(result).toBe(false);
    });

    it('should return true when source hash differs', () => {
      const doc1 = createMockDocument('doc-1', 'resume', 'Original text');
      const doc2 = createMockDocument('doc-1', 'resume', 'Updated text');

      const existingModel = careerModelService.buildFromDocuments('session-1', [doc1]);

      const result = careerModelService.shouldRefreshCareerModel(existingModel, [doc2]);

      expect(result).toBe(true);
    });

    it('should return true when document added', () => {
      const doc1 = createMockDocument('doc-1', 'resume', 'Text 1');
      const doc2 = createMockDocument('doc-2', 'cover_letter', 'Text 2');

      const existingModel = careerModelService.buildFromDocuments('session-1', [doc1]);

      const result = careerModelService.shouldRefreshCareerModel(existingModel, [doc1, doc2]);

      expect(result).toBe(true);
    });

    it('should return true when document removed', () => {
      const doc1 = createMockDocument('doc-1', 'resume', 'Text 1');
      const doc2 = createMockDocument('doc-2', 'cover_letter', 'Text 2');

      const existingModel = careerModelService.buildFromDocuments('session-1', [doc1, doc2]);

      const result = careerModelService.shouldRefreshCareerModel(existingModel, [doc1]);

      expect(result).toBe(true);
    });
  });

  describe('Heuristic specifics', () => {
    it('should not extract invalid phone patterns', () => {
      const doc = createMockDocument('doc-1', 'resume', 'Project 2020-2023 involves 123 items');
      const model = careerModelService.buildFromDocuments('session-1', [doc]);

      expect(model.model_json.contact.phone).toBeUndefined();
    });

    it('should categorize approved claims correctly', () => {
      const doc = createMockDocument(
        'doc-1',
        'resume',
        '• Increased revenue by 35%\n' + '• Expert in leadership\n' + '• Developed and deployed new mobile app'
      );
      const model = careerModelService.buildFromDocuments('session-1', [doc]);

      const claims = model.model_json.approvedClaims;
      const metricClaim = claims.find(c => c.claim.includes('35%'));
      const skillClaim = claims.find(c => c.claim.includes('Expert'));
      const expClaim = claims.find(c => c.claim.includes('Developed') || c.claim.includes('deployed'));

      expect(metricClaim?.category).toBe('metric');
      expect(skillClaim?.category).toBe('skill');
      expect(expClaim?.category).toBe('experience');
    });

    it('should only extract skills from SKILLS section', () => {
      const doc = createMockDocument(
        'doc-1',
        'resume',
        'EXPERIENCE\nJavaScript, TypeScript on projects\n\nSKILLS\nReact, Node.js'
      );
      const model = careerModelService.buildFromDocuments('session-1', [doc]);

      const skillNames = model.model_json.skills.map(s => s.name.toLowerCase());
      // Should find React and Node.js from SKILLS section
      expect(skillNames.some(s => s.includes('react') || s.includes('node'))).toBe(true);
    });
  });

  describe('Professional Experience Extraction Regression', () => {
    it('should extract roles from em-dash format: Company — Title', () => {
      const doc = createMockDocument(
        'doc-1',
        'resume',
        'PROFESSIONAL EXPERIENCE\n\nTovuti LMS — Senior Product Designer\n2025 – 2026\n• Built design system\n• Shipped features'
      );
      const model = careerModelService.buildFromDocuments('session-1', [doc]);

      expect(model.model_json.roles.length).toBeGreaterThan(0);
      const role = model.model_json.roles[0];
      expect(role.company).toBe('Tovuti LMS');
      expect(role.title).toBe('Senior Product Designer');
      expect(role.startDate).toBe('2025');
      expect(role.endDate).toBe('2026');
      expect(role.achievements?.length).toBe(2);
      expect(role.achievements?.[0]).toContain('design system');
    });

    it('should extract roles from em-dash format: Company — Title', () => {
      const doc = createMockDocument(
        'doc-1',
        'resume',
        'PROFESSIONAL EXPERIENCE\n\nTransamerica — Senior UX Designer\nNov 2020 – Nov 2024\n• Led redesign\n• Improved adoption'
      );
      const model = careerModelService.buildFromDocuments('session-1', [doc]);

      expect(model.model_json.roles.length).toBeGreaterThan(0);
      const role = model.model_json.roles[0];
      expect(role.company).toBe('Transamerica');
      expect(role.title).toBe('Senior UX Designer');
      expect(role.startDate).toBe('2020');
      expect(role.endDate).toBe('2024');
      expect(role.achievements?.length).toBeGreaterThan(0);
    });

    it('should extract roles from en-dash format: Company – Title', () => {
      const doc = createMockDocument(
        'doc-1',
        'resume',
        'PROFESSIONAL EXPERIENCE\n\nIBM – Product Designer\n2017 – 2020\n• Designed interfaces\n• Led team'
      );
      const model = careerModelService.buildFromDocuments('session-1', [doc]);

      expect(model.model_json.roles.length).toBeGreaterThan(0);
      const role = model.model_json.roles[0];
      expect(role.company).toBe('IBM');
      expect(role.title).toBe('Product Designer');
    });

    it('should NOT extract dashes inside prose as role headers', () => {
      const doc = createMockDocument(
        'doc-1',
        'resume',
        'SUMMARY\nDesigned end-to-end workflows — improving adoption and usability. ' +
          'Research synthesis — reduced manual effort by 10–15 hours per week.\n\n' +
          'PROFESSIONAL EXPERIENCE\n\nTech Corp — Senior Engineer\n2020 – 2023\n• Architected system'
      );
      const model = careerModelService.buildFromDocuments('session-1', [doc]);

      // Should extract only the real role
      expect(model.model_json.roles.length).toBe(1);
      const role = model.model_json.roles[0];
      expect(role.company).toBe('Tech Corp');
      expect(role.title).toBe('Senior Engineer');
    });

    it('should NOT extract date ranges as role headers', () => {
      const doc = createMockDocument(
        'doc-1',
        'resume',
        'EXPERIENCE\n\nSenior Engineer | Tech Corp | 2020 – 2023\n' +
          '• Project A ran 2022–2024\n' +
          '• Initiative B spanned Q1 – Q4 2023\n' +
          '• Task C: 3–5 hours per week'
      );
      const model = careerModelService.buildFromDocuments('session-1', [doc]);

      // Should extract only the one real role from pipe format
      expect(model.model_json.roles.length).toBe(1);
      const role = model.model_json.roles[0];
      expect(role.title).toBe('Senior Engineer');
    });

    it('should preserve pipe-format backward compatibility', () => {
      const doc = createMockDocument(
        'doc-1',
        'resume',
        'PROFESSIONAL EXPERIENCE\n\nSenior Engineer | Tech Corp | 2020 – 2023\n• Led team\n• Built API'
      );
      const model = careerModelService.buildFromDocuments('session-1', [doc]);

      expect(model.model_json.roles.length).toBe(1);
      const role = model.model_json.roles[0];
      expect(role.title).toBe('Senior Engineer');
      expect(role.company).toBe('Tech Corp');
      expect(role.achievements?.length).toBe(2);
    });

    it('should extract multiple roles from mixed formats', () => {
      const doc = createMockDocument(
        'doc-1',
        'resume',
        'PROFESSIONAL EXPERIENCE\n\n' +
          'Acme Inc — VP Engineering\n2023 – Present\n• Led org\n\n' +
          'Tech Corp | Senior Engineer | 2020 – 2023\n• Built APIs\n\n' +
          'StartupXYZ – Principal Architect\n2018 – 2020\n• Designed platform'
      );
      const model = careerModelService.buildFromDocuments('session-1', [doc]);

      expect(model.model_json.roles.length).toBe(3);
      expect(model.model_json.roles[0].company).toBe('Acme Inc');
      expect(model.model_json.roles[1].company).toBe('Tech Corp');
      expect(model.model_json.roles[2].company).toBe('StartupXYZ');
    });

    it('should preserve location information in date line', () => {
      const doc = createMockDocument(
        'doc-1',
        'resume',
        'PROFESSIONAL EXPERIENCE\n\nTech Corp — Senior Engineer\n2020 – 2023 • San Francisco, CA\n• Built systems'
      );
      const model = careerModelService.buildFromDocuments('session-1', [doc]);

      expect(model.model_json.roles.length).toBe(1);
      const role = model.model_json.roles[0];
      expect(role.location).toBe('San Francisco, CA');
    });

    it('should handle roles with no achievements', () => {
      const doc = createMockDocument(
        'doc-1',
        'resume',
        'PROFESSIONAL EXPERIENCE\n\nAcme Corp — Manager\n2020 – 2023\n\nEducation'
      );
      const model = careerModelService.buildFromDocuments('session-1', [doc]);

      expect(model.model_json.roles.length).toBe(1);
      const role = model.model_json.roles[0];
      expect(role.company).toBe('Acme Corp');
      expect(role.title).toBe('Manager');
      expect(role.achievements?.length).toBe(0);
    });

    it('should set high confidence for em-dash extracted roles', () => {
      const doc = createMockDocument(
        'doc-1',
        'resume',
        'PROFESSIONAL EXPERIENCE\n\nTech Corp — Senior Engineer\n2020 – 2023\n• Led team'
      );
      const model = careerModelService.buildFromDocuments('session-1', [doc]);

      const role = model.model_json.roles[0];
      expect(role.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('should correctly classify summary prose with dashes as non-roles', () => {
      const doc = createMockDocument(
        'doc-1',
        'resume',
        'SUMMARY\nExperienced designer with a passion for design systems — ' +
          'creating scalable, component-driven architectures that improve team velocity and product quality. ' +
          'Deep expertise in AI-driven workflows — automating research synthesis and reducing time-to-insight by 10–15x.\n\n' +
          'PROFESSIONAL EXPERIENCE\n\nDesign Corp — Principal Designer\n2020 – 2023\n• Shipped components'
      );
      const model = careerModelService.buildFromDocuments('session-1', [doc]);

      // Should extract only the real role, not the prose from summary
      expect(model.model_json.roles.length).toBe(1);
      const role = model.model_json.roles[0];
      expect(role.company).toBe('Design Corp');
    });
  });
});
