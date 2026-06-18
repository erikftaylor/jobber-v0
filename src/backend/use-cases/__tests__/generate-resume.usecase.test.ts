import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { DatabaseService } from '../../services/database.service';
import { GenerateResumeUseCase } from '../generate-resume.usecase';
import { careerContextService } from '../../services/career-context.service';
import { resumePromptBuilderService } from '../../services/resume-prompt-builder.service';
import type { CreateGeneratedMaterialInput } from '../../repositories/generated-material.repository';

// A resume in the exact text shape the /generate prompt asks Claude to produce,
// crafted so the real ResumeParser + ResumeOutputEngine parse and render it
// without falling back. Keeps the success path deterministic with only Claude mocked.
const VALID_RESUME_TEXT = `Jane Doe

SUMMARY
Senior Product Designer with eight years building enterprise and AI-native tools.

CORE EXPERTISE
Design Systems
User Research
Prototyping

PROFESSIONAL EXPERIENCE

Senior Product Designer | Acme Corp | Remote | 2020 – Present
• Architected a design system adopted by five teams, cutting build time by 30%
• Designed an onboarding flow that lifted activation by 25%

EDUCATION
BFA Design • Some University • 2014`;

type CallFn = (prompt: string) => Promise<{ content: string }>;
const fakeExtractor = (call: CallFn) => ({ claude: { call } });

describe('GenerateResumeUseCase', () => {
  const testDbPath = path.join(process.cwd(), 'test-data', 'test-generate-usecase.db');
  let db: DatabaseService;

  const cleanupDb = () =>
    [testDbPath, testDbPath + '-shm', testDbPath + '-wal'].forEach(f => {
      try {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      } catch {
        // ignore
      }
    });

  beforeEach(() => {
    cleanupDb();
    fs.mkdirSync(path.dirname(testDbPath), { recursive: true });
    db = new DatabaseService(testDbPath);
  });

  afterEach(cleanupDb);

  it('returns 501 when Claude/extractor is not configured', async () => {
    const useCase = new GenerateResumeUseCase({ db });

    const result = await useCase.execute({ job_description: 'Senior PD role' });

    expect(result.statusCode).toBe(501);
    expect(result.body.success).toBe(false);
    expect(result.body.error).toBeDefined();
  });

  it('returns 400 when the job description is missing', async () => {
    const useCase = new GenerateResumeUseCase({
      db,
      extractor: fakeExtractor(async () => ({ content: VALID_RESUME_TEXT })),
    });

    const result = await useCase.execute({});

    expect(result.statusCode).toBe(400);
    expect(String(result.body.error)).toMatch(/job description/i);
  });

  it('returns 400 when no documents are uploaded', async () => {
    const useCase = new GenerateResumeUseCase({
      db,
      extractor: fakeExtractor(async () => ({ content: VALID_RESUME_TEXT })),
    });

    const result = await useCase.execute({ job_description: 'Senior PD role' });

    expect(result.statusCode).toBe(400);
    expect(String(result.body.error)).toMatch(/no documents/i);
  });

  it('generates an ATS resume on the success path (Claude mocked)', async () => {
    db.saveDocument('resume', 'cv.txt', 'Jane Doe — Senior Product Designer, 8 years.');
    let receivedPrompt = '';
    const useCase = new GenerateResumeUseCase({
      db,
      extractor: fakeExtractor(async (prompt: string) => {
        receivedPrompt = prompt;
        return { content: VALID_RESUME_TEXT };
      }),
    });

    const result = await useCase.execute({ job_description: 'Lead enterprise design systems' });

    expect(result.statusCode).toBe(200);
    expect(result.body.success).toBe(true);
    expect(result.body.material_type).toBe('resume');
    expect(result.body.generated_content).toBe(VALID_RESUME_TEXT);
    expect(typeof result.body.formatted_html).toBe('string');
    expect((result.body.formatted_html as string).length).toBeGreaterThan(0);
    expect(result.body.formatting_error).toBeUndefined();
    expect(result.body.based_on_documents).toBe(1);
    expect(result.body.stats).toBeDefined();
    expect((result.body.validation as { warnings: unknown[] }).warnings).toBeInstanceOf(Array);
    // The prompt still includes the job description and raw document context.
    expect(receivedPrompt).toContain('Lead enterprise design systems');
    expect(receivedPrompt).toContain('Jane Doe — Senior Product Designer');
  });

  it('calls Claude with exactly the prompt the builder + career context produce', async () => {
    db.saveDocument('resume', 'cv.txt', 'Jane Doe — Senior Product Designer, 8 years.');
    db.saveDocument('linkedin', 'li.txt', 'Profile summary text');
    let receivedPrompt = '';
    const useCase = new GenerateResumeUseCase({
      db,
      extractor: fakeExtractor(async (prompt: string) => {
        receivedPrompt = prompt;
        return { content: VALID_RESUME_TEXT };
      }),
    });

    await useCase.execute({ job_description: 'Lead enterprise design systems' });

    // Behavior equivalence: the use case orchestrates the same services rather
    // than building the prompt inline.
    const expectedPrompt = resumePromptBuilderService.buildResumePrompt({
      careerContext: careerContextService.build(db.getAllDocuments()),
      jobDescription: 'Lead enterprise design systems',
    });
    expect(receivedPrompt).toBe(expectedPrompt);
  });

  it('propagates unexpected errors when Claude fails (route forwards to next)', async () => {
    db.saveDocument('resume', 'cv.txt', 'Jane Doe');
    const useCase = new GenerateResumeUseCase({
      db,
      extractor: fakeExtractor(async () => {
        throw new Error('Claude exploded');
      }),
    });

    await expect(
      useCase.execute({ job_description: 'Senior PD role' })
    ).rejects.toThrow('Claude exploded');
  });

  it('saves an artifact after a successful generation and returns its id additively', async () => {
    db.saveDocument('resume', 'cv.txt', 'Jane Doe — Senior Product Designer, 8 years.');
    const created: CreateGeneratedMaterialInput[] = [];
    const useCase = new GenerateResumeUseCase({
      db,
      extractor: fakeExtractor(async () => ({ content: VALID_RESUME_TEXT })),
      materialRepository: {
        create: (input) => {
          created.push(input);
          return { id: 'mat-success' };
        },
      },
    });

    const result = await useCase.execute({ job_description: 'Lead enterprise design systems' });

    expect(result.statusCode).toBe(200);
    expect(result.body.artifact_id).toBe('mat-success');
    expect(result.body.artifact_save_error).toBeUndefined();
    // Existing contract still intact.
    expect(result.body.generated_content).toBe(VALID_RESUME_TEXT);
    expect(typeof result.body.formatted_html).toBe('string');

    expect(created).toHaveLength(1);
    const saved = created[0];
    expect(saved.generatedContent).toBe(VALID_RESUME_TEXT);
    expect(saved.renderedHtml).toEqual(expect.any(String));
    expect(saved.sourceDocumentIds).toHaveLength(1);
    expect(String(saved.jobDescriptionHash)).toMatch(/^[a-f0-9]{64}$/);
    expect(String(saved.title)).toContain('Lead enterprise design systems');
  });

  it('does not save an artifact for guard failures (501 / 400)', async () => {
    const created: unknown[] = [];
    const materialRepository = {
      create: (input: unknown) => {
        created.push(input);
        return { id: 'should-not-happen' };
      },
    };

    // 501 — no extractor configured
    const r501 = await new GenerateResumeUseCase({ db, materialRepository }).execute({
      job_description: 'role',
    });
    expect(r501.statusCode).toBe(501);

    // 400 — no documents uploaded (db is empty in this test)
    const r400 = await new GenerateResumeUseCase({
      db,
      extractor: fakeExtractor(async () => ({ content: VALID_RESUME_TEXT })),
      materialRepository,
    }).execute({ job_description: 'role' });
    expect(r400.statusCode).toBe(400);

    expect(created).toHaveLength(0);
    expect(r501.body.artifact_id).toBeUndefined();
    expect(r400.body.artifact_id).toBeUndefined();
  });

  it('still returns the generated résumé when artifact saving fails', async () => {
    db.saveDocument('resume', 'cv.txt', 'Jane Doe — Senior Product Designer.');
    const useCase = new GenerateResumeUseCase({
      db,
      extractor: fakeExtractor(async () => ({ content: VALID_RESUME_TEXT })),
      materialRepository: {
        create: () => {
          throw new Error('disk full');
        },
      },
    });

    const result = await useCase.execute({ job_description: 'Lead enterprise design systems' });

    expect(result.statusCode).toBe(200);
    expect(result.body.generated_content).toBe(VALID_RESUME_TEXT);
    expect(typeof result.body.formatted_html).toBe('string');
    expect(result.body.artifact_id).toBeUndefined();
    expect(result.body.artifact_save_error).toBe('disk full');
  });
});
