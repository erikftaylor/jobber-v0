// Source grounding: every extracted fact has provenance
export interface SourceRef {
  document_id: string;
  excerpt: string;
  confidence: number; // 0-1
}

export interface Skill {
  id: string;
  name: string;
  category: 'frontend' | 'backend' | 'design' | 'leadership' | 'other';
  years_experience?: number;
  confidence: number; // 0-1
  source_document_id: string;
  source_excerpt: string;
  source_refs_json: SourceRef[];
}

export interface Achievement {
  id: string;
  title: string;
  context: string;
  metrics: string[];
  skills_demonstrated: string[];
  confidence: number; // 0-1
  source_document_id: string;
  source_excerpt: string;
  source_refs_json: SourceRef[];
}

export interface Technology {
  id: string;
  name: string;
  proficiency: 'beginner' | 'intermediate' | 'expert';
  confidence: number; // 0-1
  source_document_id: string;
  source_excerpt: string;
  source_refs_json: SourceRef[];
}

export interface WritingStyle {
  tone: 'professional' | 'conversational' | 'technical';
  voice_markers: string[];
  examples: string[];
  confidence: number;
  source_refs_json: SourceRef[];
}

export interface Value {
  value: string;
  confidence: number; // 0-1
  source_document_id: string;
  source_excerpt: string;
  source_refs_json: SourceRef[];
}

export interface KnowledgeBase {
  id: string;
  skills: Skill[];
  achievements: Achievement[];
  technologies: Technology[];
  writing_style: WritingStyle;
  values: Value[];
  extracted_at?: Date;
  synthesized_at?: Date;
  synthesis_version: number;
  created_at: Date;
  updated_at: Date;
}

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
