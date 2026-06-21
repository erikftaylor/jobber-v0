import { describe, it, expect } from 'vitest';
import { ResumePromptBuilderService } from '../resume-prompt-builder.service';
import type { CareerModel } from '../../../shared/types';

const builder = new ResumePromptBuilderService();

const mockCareerModel: CareerModel = {
  id: 'cm-123',
  session_id: 'default',
  source_document_ids: ['doc-1'],
  source_hash: 'abc123',
  model_json: {
    contact: { name: 'Jane Doe', email: 'jane@example.com' },
    roles: [
      {
        title: 'Senior Designer',
        company: 'TechCorp',
        startDate: '2020',
        endDate: '2023',
        achievements: ['Led design system', 'Mentored 3 designers'],
        confidence: 0.9,
      },
    ],
    skills: [{ name: 'Design Systems', confidence: 0.9 }, { name: 'Figma', confidence: 0.85 }],
    tools: [],
    projects: [],
    metrics: [],
    education: [],
    certifications: [],
    approvedClaims: [],
    sourceDocumentIds: ['doc-1'],
  },
  model_version: '1.0.0',
  created_at: new Date(),
};

describe('ResumePromptBuilderService', () => {
  it('includes the job description and Career Knowledge Layer', () => {
    const prompt = builder.buildResumePrompt({
      careerModel: mockCareerModel,
      jobDescription: 'Lead enterprise design systems',
    });

    // Job description
    expect(prompt).toContain('Lead enterprise design systems');
    // Career Knowledge Layer should be included
    expect(prompt).toContain('CANDIDATE\'S CAREER KNOWLEDGE LAYER');
    expect(prompt).toContain('Jane Doe');
    expect(prompt).toContain('Senior Designer');
    // Instructions should emphasize truthfulness
    expect(prompt).toContain('Do NOT invent');
    expect(prompt).toContain('ONLY facts');
    // Format instructions
    expect(prompt).toContain('CRITICAL CONSTRAINTS:');
    expect(prompt).toContain('FORMATTING RULES:');
    expect(prompt).toContain('SECTION ORDER');
  });

  it('places the Career Knowledge Layer and job description in the expected order', () => {
    const prompt = builder.buildResumePrompt({
      careerModel: mockCareerModel,
      jobDescription: 'Lead enterprise design systems',
    });

    const kbIdx = prompt.indexOf('CANDIDATE\'S CAREER KNOWLEDGE LAYER');
    const jdIdx = prompt.indexOf('TARGET JOB DESCRIPTION:');
    expect(kbIdx).toBeGreaterThan(-1);
    expect(jdIdx).toBeGreaterThan(kbIdx);
  });

  it('includes extracted knowledge from the career model', () => {
    const prompt = builder.buildResumePrompt({
      careerModel: mockCareerModel,
      jobDescription: 'Some job',
    });

    // Should include contact, roles, skills, approved claims
    expect(prompt).toContain('Jane Doe');
    expect(prompt).toContain('TechCorp');
    expect(prompt).toContain('Design Systems');
    expect(prompt).toContain('Figma');
  });
});
