/**
 * Resume Prompt Builder service.
 *
 * Constructs Claude prompts for resume generation using the Career Knowledge Layer
 * as the primary context. The structured CareerModel provides proven facts (contact,
 * roles, skills, metrics, education, certifications, approvedClaims) extracted from
 * source documents with full traceability.
 */

import type { CareerModel } from '../../shared/types';

export interface BuildResumePromptInput {
  careerModel: CareerModel;
  jobDescription: string;
}

export class ResumePromptBuilderService {
  buildResumePrompt(input: BuildResumePromptInput): string {
    const { careerModel, jobDescription } = input;
    const knowledgeSection = this.renderCareerKnowledgeLayer(careerModel);

    return `You are an expert resume writer specializing in ATS-safe, truthful resumes.

Write a single-page resume based on the candidate's Career Knowledge Layer (structured facts extracted from source documents) and the target job description.

CRITICAL CONSTRAINTS:
- Use ONLY facts in the Career Knowledge Layer below
- Do NOT invent employers, titles, dates, metrics, tools, degrees, certifications, or outcomes
- If the job requires unsupported skills/experience, do not fabricate them
- Every claim must be traceable to the Career Knowledge Layer
- Include metrics/impact only where present in approved claims

FORMATTING RULES:
- Exactly 5 bullet points for the current/most recent role
- Exactly 4 bullet points for previous roles
- Exactly 3 bullet points for older roles
- Summary: maximum 65 words (positioning statement, not objective)
- Expertise: maximum 8 items, displayed as a vertical list
- Every bullet MUST start with a strong action verb
- No weak openers: never use "responsible for", "helped", "worked on", "participated in"
- Every bullet describes a meaningful problem solved with impact
- Bullets read naturally in 1-2 lines
- Single column, left-aligned layout

SECTION ORDER (EXACTLY):
NAME
SUMMARY
CORE EXPERTISE
PROFESSIONAL EXPERIENCE
EDUCATION

STYLE GUIDE:
Summary: Executive positioning statement, not a job objective.
Strong action verbs: Architected, Designed, Established, Embedded, Facilitated, Conducted, Transformed, Streamlined, Reduced, Created

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

CANDIDATE'S CAREER KNOWLEDGE LAYER (structured facts from source documents):
${knowledgeSection}

TARGET JOB DESCRIPTION:
${jobDescription}

Now write the tailored resume using ONLY facts from the Career Knowledge Layer above. Do not invent anything not explicitly listed there.`;
  }

  /**
   * Render the structured Career Knowledge Layer into a clear, readable section
   * for Claude to use as the primary context for resume generation.
   */
  private renderCareerKnowledgeLayer(model: CareerModel): string {
    const lines: string[] = [];

    // Contact
    if (model.model_json.contact && Object.keys(model.model_json.contact).length > 0) {
      lines.push('## CONTACT');
      const c = model.model_json.contact;
      if (c.name) lines.push(`Name: ${c.name}`);
      if (c.email) lines.push(`Email: ${c.email}`);
      if (c.phone) lines.push(`Phone: ${c.phone}`);
      if (c.location) lines.push(`Location: ${c.location}`);
      if (c.linkedin) lines.push(`LinkedIn: ${c.linkedin}`);
      if (c.website) lines.push(`Website: ${c.website}`);
      lines.push('');
    }

    // Roles (professional experience)
    if (model.model_json.roles && model.model_json.roles.length > 0) {
      lines.push('## PROFESSIONAL EXPERIENCE');
      for (const role of model.model_json.roles) {
        const dates = role.startDate && role.endDate ? `${role.startDate} – ${role.endDate}` : 'Dates not specified';
        lines.push(`${role.title} at ${role.company} (${dates})`);
        if (role.location) lines.push(`  Location: ${role.location}`);
        if (role.achievements && role.achievements.length > 0) {
          lines.push(`  Achievements:`);
          for (const achievement of role.achievements) {
            lines.push(`    - ${achievement}`);
          }
        }
        lines.push('');
      }
    }

    // Skills
    if (model.model_json.skills && model.model_json.skills.length > 0) {
      lines.push('## SKILLS');
      const skillNames = model.model_json.skills.map(s => s.name);
      lines.push(skillNames.join(', '));
      lines.push('');
    }

    // Tools/Technologies
    if (model.model_json.tools && model.model_json.tools.length > 0) {
      lines.push('## TECHNOLOGIES');
      const toolNames = model.model_json.tools.map(t => t.name);
      lines.push(toolNames.join(', '));
      lines.push('');
    }

    // Metrics (quantified achievements)
    if (model.model_json.metrics && model.model_json.metrics.length > 0) {
      lines.push('## KEY METRICS & ACHIEVEMENTS');
      for (const metric of model.model_json.metrics) {
        if (metric.value) {
          lines.push(`- ${metric.description} (${metric.value})`);
        } else {
          lines.push(`- ${metric.description}`);
        }
      }
      lines.push('');
    }

    // Education
    if (model.model_json.education && model.model_json.education.length > 0) {
      lines.push('## EDUCATION');
      for (const edu of model.model_json.education) {
        let eduStr = edu.school;
        if (edu.degree) eduStr = `${edu.degree} in ${edu.field || 'Studies'}`;
        if (edu.school) eduStr += ` from ${edu.school}`;
        if (edu.graduationDate) eduStr += ` (${edu.graduationDate})`;
        lines.push(eduStr);
      }
      lines.push('');
    }

    // Certifications
    if (model.model_json.certifications && model.model_json.certifications.length > 0) {
      lines.push('## CERTIFICATIONS');
      for (const cert of model.model_json.certifications) {
        let certStr = cert.name;
        if (cert.issuer) certStr += ` from ${cert.issuer}`;
        lines.push(`- ${certStr}`);
      }
      lines.push('');
    }

    // Approved Claims (source-backed achievements)
    if (model.model_json.approvedClaims && model.model_json.approvedClaims.length > 0) {
      lines.push('## APPROVED CLAIMS (source-backed achievements)');
      for (const claim of model.model_json.approvedClaims) {
        lines.push(`- ${claim.claim} [${claim.category}]`);
      }
      lines.push('');
    }

    return lines.length > 0 ? lines.join('\n') : '(No career knowledge extracted yet)';
  }
}

export const resumePromptBuilderService = new ResumePromptBuilderService();
