export interface Document {
  id: string;
  type: 'resume' | 'cover_letter' | 'case_study' | 'linkedin' | 'portfolio';
  filename: string;
  raw_text: string;
  uploaded_at: Date;
  parsed_at?: Date;
}

export interface Job {
  id: string;
  title: string;
  company?: string;
  description: string;
  added_at: Date;
}

export interface GeneratedMaterial {
  id: string;
  job_id: string;
  type: 'resume' | 'cover_letter';
  content: {
    text: string;
    keywords_used: string[];
    confidence: number;
    grounded_achievements: string[];
  };
  generated_at: Date;
  refinement_history?: RefinementHistoryItem[];
  exported_at?: Date;
}

export interface RefinementHistoryItem {
  user_message: string;
  generated_content: string;
  timestamp: Date;
}

export interface ConversationMessage {
  id: string;
  job_id: string;
  role: 'user' | 'assistant';
  content: string;
  message_at: Date;
}

// Career Knowledge Layer: structured, persistent knowledge extracted from source documents
export interface CareerModelContact {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  website?: string;
}

export interface CareerModelRole {
  title: string;
  company: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  description?: string;
  achievements?: string[];
  confidence?: number;
  sourceDocumentId?: string;
}

export interface CareerModelProject {
  title: string;
  description: string;
  role?: string;
  outcome?: string;
  impact?: string;
  technologies?: string[];
  confidence?: number;
  sourceDocumentId?: string;
}

export interface CareerModelSkill {
  name: string;
  category?: string;
  proficiency?: 'beginner' | 'intermediate' | 'expert';
  yearsOfExperience?: number;
  confidence?: number;
  sourceDocumentId?: string;
}

export interface CareerModelTool {
  name: string;
  category?: string;
  proficiency?: 'beginner' | 'intermediate' | 'expert';
  confidence?: number;
  sourceDocumentId?: string;
}

export interface CareerModelMetric {
  description: string;
  value?: string | number;
  unit?: string;
  context?: string;
  confidence?: number;
  sourceDocumentId?: string;
}

export interface CareerModelEducation {
  school: string;
  degree?: string;
  field?: string;
  graduationDate?: string;
  gpa?: string;
  notes?: string;
  sourceDocumentId?: string;
}

export interface CareerModelCertification {
  name: string;
  issuer?: string;
  issuedDate?: string;
  expiryDate?: string;
  credentialId?: string;
  credentialUrl?: string;
  sourceDocumentId?: string;
}

export interface CareerModelApprovedClaim {
  claim: string;
  supportingEvidence: string[];
  sourceDocumentIds: string[];
  confidence: number;
  category: 'achievement' | 'skill' | 'metric' | 'experience';
}

export interface CareerModel {
  id: string;
  session_id: string;
  source_document_ids: string[];
  source_hash: string;
  model_json: {
    contact: CareerModelContact;
    roles: CareerModelRole[];
    projects: CareerModelProject[];
    skills: CareerModelSkill[];
    tools: CareerModelTool[];
    metrics: CareerModelMetric[];
    education: CareerModelEducation[];
    certifications: CareerModelCertification[];
    approvedClaims: CareerModelApprovedClaim[];
    sourceDocumentIds: string[];
  };
  model_version: string;
  created_at: Date;
}

// Resume Quality Report
export interface ResumeQualityReport {
  exportReady: boolean;
  overallStatus: 'pass' | 'warn' | 'fail';
  ats: {
    status: 'pass' | 'warn' | 'fail';
    warnings: string[];
  };
  truthfulness: {
    status: 'pass' | 'warn' | 'fail';
    supportedClaims: string[];
    weaklySupportedClaims: string[];
    unsupportedClaims: string[];
  };
  keywords: {
    matched: string[];
    missing: string[];
    suggestedIfTruthful: string[];
  };
  length: {
    estimatedPages: number;
    warnings: string[];
  };
}
