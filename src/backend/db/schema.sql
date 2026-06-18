-- Sessions: separate knowledge bases for different contexts (jobs, applications, etc.)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Documents: uploaded source files (resume, cover letter, case study, LinkedIn)
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL DEFAULT 'default',
  type TEXT NOT NULL CHECK(type IN ('resume', 'cover_letter', 'case_study', 'linkedin', 'portfolio')),
  filename TEXT NOT NULL,
  raw_text TEXT NOT NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  parsed_at TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Jobs: job descriptions user wants to apply to
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  company TEXT,
  description TEXT NOT NULL,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Generated materials: resumes and cover letters
CREATE TABLE IF NOT EXISTS generated_materials (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('resume', 'cover_letter')),
  content JSON NOT NULL,          -- {text, keywords_used, confidence, grounded_achievements}
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  refinement_history JSON,        -- [{user_message, generated_content, timestamp}]
  exported_at TIMESTAMP,
  FOREIGN KEY (job_id) REFERENCES jobs(id)
);

-- Conversation history: chat refinements
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (job_id) REFERENCES jobs(id)
);

-- Generated resume artifacts: durable record of each successful generation so a
-- result can be reopened later. Distinct from the unused `generated_materials`
-- table above, which requires a job_id FK that the generation flow never creates.
CREATE TABLE IF NOT EXISTS generated_resumes (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'resume' CHECK(type IN ('resume')),
  title TEXT NOT NULL,
  job_description_hash TEXT NOT NULL,
  source_document_ids JSON NOT NULL,     -- string[]
  generated_content TEXT NOT NULL,       -- raw Claude resume text
  structured_resume_json JSON,           -- normalized StructuredResume; null on formatting fallback
  rendered_html TEXT,                    -- ATS HTML; null on formatting fallback
  formatting_error TEXT,                 -- set when the output engine fell back
  format_version TEXT,
  prompt_version TEXT,
  model TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_at ON documents(uploaded_at);
CREATE INDEX IF NOT EXISTS idx_generated_materials_job_id ON generated_materials(job_id);
CREATE INDEX IF NOT EXISTS idx_conversations_job_id ON conversations(job_id);
CREATE INDEX IF NOT EXISTS idx_generated_resumes_created_at ON generated_resumes(created_at);
