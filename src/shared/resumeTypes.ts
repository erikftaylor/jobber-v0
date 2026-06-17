/**
 * Structured Resume Data Types
 * Used for deterministic rendering from JSON → HTML/PDF
 */

export interface ResumeContact {
  name: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  portfolio?: string;
}

export interface ResumeSummary {
  text: string;
  wordCount?: number;
}

export interface ResumeSkill {
  name: string;
}

export interface ResumeBullet {
  text: string;
  wordCount?: number;
  visualLines?: number; // Estimate for one-page fitting
}

export interface ResumeRole {
  jobTitle: string;
  company: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  isCurrent?: boolean;
  bullets: ResumeBullet[];
}

export interface ResumeExperience {
  roles: ResumeRole[];
}

export interface ResumeEducation {
  degree?: string;
  school: string;
  year?: string;
  details?: string;
}

export interface ResumeCertification {
  title: string;
  issuer?: string;
  year?: string;
}

export interface ResumePortfolioItem {
  title: string;
  url?: string;
  description?: string;
}

/**
 * Complete Resume structure
 * Sections appear in immutable order defined by RESUME_FORMAT.sectionOrder
 */
export interface StructuredResume {
  // Header
  contact: ResumeContact;

  // Optional sections
  summary?: ResumeSummary;
  expertise?: ResumeSkill[];
  experience?: ResumeExperience;
  education?: ResumeEducation[];
  certifications?: ResumeCertification[];
  portfolio?: ResumePortfolioItem[];

  // Metadata
  generatedAt?: string;
  generatedForJd?: string; // Reference to job description
}

/**
 * Normalized Resume - validated and constrained for rendering
 * All content constraints applied
 * All ATS violations removed
 */
export interface NormalizedResume extends StructuredResume {
  _normalized: true;
  _stats: {
    summaryWords: number;
    skillCount: number;
    experienceRoles: number;
    totalBullets: number;
    estimatedPages: number;
  };
}
