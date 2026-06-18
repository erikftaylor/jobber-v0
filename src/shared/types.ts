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
