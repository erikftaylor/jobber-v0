import { describe, it, expect } from 'vitest';
import { ResumePromptBuilderService } from '../resume-prompt-builder.service';
import { CareerContextService } from '../career-context.service';

const builder = new ResumePromptBuilderService();
const careerContext = new CareerContextService().build([
  { id: '1', type: 'resume', filename: 'cv.txt', raw_text: 'Jane Doe — Senior Designer' },
]);

describe('ResumePromptBuilderService', () => {
  it('includes the job description, the raw career context, and the existing instructions', () => {
    const prompt = builder.buildResumePrompt({
      careerContext,
      jobDescription: 'Lead enterprise design systems',
    });

    // Job description
    expect(prompt).toContain('Lead enterprise design systems');
    // Raw career context (exact block from CareerContextService)
    expect(prompt).toContain('[RESUME: cv.txt]\nJane Doe — Senior Designer');
    // Existing resume instructions / structure (unchanged content)
    expect(prompt).toContain('You are an executive resume writer');
    expect(prompt).toContain('CRITICAL FORMATTING RULES:');
    expect(prompt).toContain('SECTION ORDER (EXACTLY):');
    expect(prompt).toContain("CANDIDATE'S BACKGROUND:");
    expect(prompt).toContain('TARGET JOB DESCRIPTION:');
    expect(prompt).toContain('Now write the tailored executive resume following these rules exactly:');
  });

  it('places the career context and job description in the expected order', () => {
    const prompt = builder.buildResumePrompt({
      careerContext,
      jobDescription: 'Lead enterprise design systems',
    });

    const contextIdx = prompt.indexOf("CANDIDATE'S BACKGROUND:");
    const jdIdx = prompt.indexOf('TARGET JOB DESCRIPTION:');
    expect(contextIdx).toBeGreaterThan(-1);
    expect(jdIdx).toBeGreaterThan(contextIdx);
  });
});
