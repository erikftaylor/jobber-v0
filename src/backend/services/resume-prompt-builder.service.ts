/**
 * Resume Prompt Builder service.
 *
 * Owns the Claude prompt construction that previously lived inline in
 * GenerateResumeUseCase. For this task the prompt text is moved verbatim — no
 * formatting rules are centralized and no constraints are changed.
 */

import type { CareerContext } from './career-context.service';

export interface BuildResumePromptInput {
  careerContext: CareerContext;
  jobDescription: string;
}

export class ResumePromptBuilderService {
  buildResumePrompt(input: BuildResumePromptInput): string {
    const { careerContext, jobDescription } = input;
    const documentContext = careerContext.rawContextText;

    return `You are an executive resume writer specializing in modern Product Design and UX resumes.

Write a single-page executive resume based on the candidate's background documents and the target job description.

CRITICAL FORMATTING RULES:
- Exactly 5 bullet points for the current/most recent role
- Exactly 4 bullet points for previous roles
- Exactly 3 bullet points for older roles
- Summary: maximum 65 words (positioning statement, not objective)
- Expertise: maximum 8 items, displayed as a vertical list
- Every bullet MUST start with a strong action verb
- No weak openers: never use "responsible for", "helped", "worked on", "participated in"
- Every bullet describes a meaningful problem solved with measurable impact
- Bullets read naturally in 1-2 lines
- Single column, left-aligned layout

SECTION ORDER (EXACTLY):
NAME
SUMMARY
CORE EXPERTISE
PROFESSIONAL EXPERIENCE
EDUCATION

STYLE GUIDE:
Summary: Executive positioning statement, not a job objective. Example:
"Senior Product Designer with 8+ years designing complex enterprise and AI-native products. Expert in systems thinking, research, and transforming ambiguous problems into intuitive experiences."

Strong action verbs to use:
Architected, Designed, Established, Embedded, Facilitated, Conducted, Transformed, Streamlined, Reduced, Created

Format output exactly as:

[CANDIDATE NAME]

SUMMARY
[Executive positioning statement, max 65 words]

CORE EXPERTISE
[Skill 1]
[Skill 2]
[Skill 3]
[Up to 8 items]

PROFESSIONAL EXPERIENCE

[Job Title]
[Start Date] – [End Date]
• [Strong action verb] [problem solved] [measurable impact]
• [Next achievement...]

[Repeat for other roles with exactly 4 or 3 bullets as appropriate]

EDUCATION
[Degree] • [School] • [Year]

---

CANDIDATE'S BACKGROUND:
${documentContext}

TARGET JOB DESCRIPTION:
${jobDescription}

Now write the tailored executive resume following these rules exactly:`;
  }
}

export const resumePromptBuilderService = new ResumePromptBuilderService();
