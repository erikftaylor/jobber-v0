# Jobber v0: Architecture Blueprint

## High-Level Data Flow

```
User uploads docs (resume, cover letters, case studies, LinkedIn)
    ↓
DocumentParser parses each file (PDF/DOCX/text)
    ↓
Claude extracts structured knowledge (skills, achievements, writing style)
    ↓
KnowledgeService synthesizes & dedupes → unified KnowledgeBase
    ↓
User pastes job description
    ↓
ResumeGenerator (knowledge + JD) → tailored resume JSON
CoverLetterGenerator (knowledge + JD) → tailored letter JSON
    ↓
DocxExporter converts JSON → ATS-safe DOCX files
    ↓
User chats: "Make it more concise"
    ↓
RefinementService regenerates both documents
    ↓
User exports to Desktop
```

---

## Database Schema (SQLite)

### Tables

```sql
-- Documents: uploaded source files
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL, -- 'resume' | 'cover_letter' | 'case_study' | 'linkedin'
  filename TEXT NOT NULL,
  raw_text TEXT NOT NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  parsed_at TIMESTAMP
);

-- Knowledge base: extracted & synthesized knowledge
CREATE TABLE knowledge_base (
  id TEXT PRIMARY KEY,
  skills JSON NOT NULL, -- [{name, category, years, confidence, source}]
  achievements JSON NOT NULL,
  technologies JSON NOT NULL,
  writing_style JSON NOT NULL, -- {tone, voice_markers, examples}
  values JSON NOT NULL,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  synthesis_version INT DEFAULT 1
);

-- Jobs: job descriptions user wants to apply to
CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  company TEXT,
  description TEXT NOT NULL,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Generated materials: resumes and cover letters
CREATE TABLE generated_materials (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  type TEXT NOT NULL, -- 'resume' | 'cover_letter'
  content JSON NOT NULL, -- {text, keywords_used, confidence}
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  refinement_history JSON, -- [{user_message, generated_content, timestamp}]
  exported_at TIMESTAMP,
  FOREIGN KEY (job_id) REFERENCES jobs(id)
);

-- Conversation history: chat refinements
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  role TEXT NOT NULL, -- 'user' | 'assistant'
  content TEXT NOT NULL,
  message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (job_id) REFERENCES jobs(id)
);
```

---

## Service Architecture

### Backend Services (Node.js + Express + TypeScript)

```
src/backend/
├── index.ts                          # Express setup, route mounting
├── services/
│   ├── document-parser.service.ts    # PDF/DOCX/text parsing
│   ├── knowledge.service.ts          # Extract & synthesize knowledge
│   ├── claude.service.ts             # Claude API wrapper
│   ├── resume-generator.service.ts   # Resume generation + DOCX
│   ├── cover-letter-generator.service.ts
│   ├── refinement.service.ts         # Chat refinement loop
│   ├── docx-exporter.service.ts      # JSON → DOCX via docx-js
│   ├── database.service.ts           # SQLite operations
│   └── keyword-analyzer.service.ts   # JD keyword extraction
├── routes/
│   ├── knowledge.routes.ts           # POST /api/kb/upload, GET /api/kb
│   ├── jobs.routes.ts                # CRUD jobs
│   ├── generation.routes.ts          # POST /api/generate (resume + letter)
│   ├── refinement.routes.ts          # POST /api/refine (chat message)
│   ├── export.routes.ts              # POST /api/export (download DOCX)
│   └── conversation.routes.ts        # GET/POST chat history
├── prompts/
│   ├── extract-knowledge.prompt.md
│   ├── synthesize-knowledge.prompt.md
│   ├── generate-resume.prompt.md
│   ├── generate-cover-letter.prompt.md
│   ├── refine-generation.prompt.md
│   └── extract-keywords.prompt.md
├── schemas/
│   ├── knowledge.schema.ts           # Zod validation for KB
│   ├── job.schema.ts
│   ├── generation.schema.ts
│   └── conversation.schema.ts
└── types/
    └── index.ts                      # Shared TypeScript types
```

### API Routes (Express)

```
POST   /api/kb/upload              # Upload document (resume/letter/case study/LinkedIn)
GET    /api/kb                     # Get synthesized knowledge base
POST   /api/kb/refresh             # Re-extract & re-synthesize all documents

POST   /api/jobs                   # Add job description
GET    /api/jobs                   # List all jobs
GET    /api/jobs/:id               # Get single job
DELETE /api/jobs/:id               # Delete job

POST   /api/generate               # Generate resume + cover letter for job
  Input: {job_id, knowledge_base}
  Output: {resume_json, cover_letter_json, keywords_used}

POST   /api/refine                 # Chat refinement
  Input: {job_id, user_message, current_resume, current_cover_letter}
  Output: {updated_resume_json, updated_cover_letter_json}

POST   /api/export                 # Export to DOCX
  Input: {job_id, resume_json, cover_letter_json}
  Output: {resume_docx, cover_letter_docx} (as buffers)

GET    /api/conversations/:job_id  # Get chat history
POST   /api/conversations/:job_id  # Add message to chat
```

---

## Frontend Architecture (React 18 + Zustand)

### State Management (Zustand Store)

```typescript
// src/renderer/store/jobberStore.ts

interface JobberState {
  // Knowledge base
  knowledgeBase: KnowledgeBase | null;
  isExtractingKnowledge: boolean;
  knowledgeError: string | null;
  
  // Jobs
  jobs: Job[];
  selectedJobId: string | null;
  isLoadingJobs: boolean;
  
  // Generation
  currentResume: string | null;
  currentCoverLetter: string | null;
  isGenerating: boolean;
  generationError: string | null;
  
  // Chat/Refinement
  conversation: ConversationMessage[];
  isRefinementInProgress: boolean;
  
  // Actions
  uploadDocuments: (files: File[]) => Promise<void>;
  refreshKnowledgeBase: () => Promise<void>;
  addJob: (title: string, company: string, description: string) => Promise<void>;
  deleteJob: (jobId: string) => Promise<void>;
  selectJob: (jobId: string) => void;
  generateMaterials: (jobId: string) => Promise<void>;
  refineMaterials: (jobId: string, message: string) => Promise<void>;
  exportToDocx: (jobId: string) => Promise<void>;
}
```

### Component Tree

```
App.tsx
├── Header
│   ├── Logo
│   └── Settings (dark mode toggle)
├── MainLayout (3-panel)
│   ├── LeftPanel (Knowledge Base)
│   │   ├── UploadZone
│   │   ├── KnowledgeBaseBrowser
│   │   │   ├── SkillsList
│   │   │   ├── AchievementsList
│   │   │   ├── TechnologiesList
│   │   │   └── WritingStyleViewer
│   │   └── SynthesisStatus
│   │
│   ├── CenterPanel (Job + Chat)
│   │   ├── JobInput
│   │   │   ├── JobDescriptionPaster
│   │   │   └── JobList
│   │   ├── GenerateButton
│   │   └── ChatRefinement
│   │       ├── MessageHistory
│   │       ├── MessageInput
│   │       └── RefinementIndicator
│   │
│   └── RightPanel (Preview + Export)
│       ├── DocumentPreview
│       │   ├── ResumePreview (HTML)
│       │   └── CoverLetterPreview (HTML)
│       ├── ExportButtons
│       │   ├── "Export Resume"
│       │   └── "Export Cover Letter"
│       └── PreviewMetadata
│           ├── Keywords used
│           ├── Generated at
│           └── ATS safety indicator
```

### Styling & UX

- **Layout:** CSS Grid for 3-panel layout (left 25%, center 35%, right 40%)
- **Dark Mode:** `@media (prefers-color-scheme: dark)`
- **Typography:** System fonts (SF Pro Display on Mac)
- **Colors:** Minimal palette (dark bg, light text, accent color for CTAs)
- **Responsive:** Stack panels vertically on mobile

---

## Data Models (TypeScript)

```typescript
// src/shared/types.ts

interface KnowledgeBase {
  id: string;
  skills: Skill[];
  achievements: Achievement[];
  technologies: Technology[];
  writingStyle: WritingStyle;
  values: string[];
  lastUpdated: Date;
  synthesisVersion: number;
}

interface Skill {
  name: string;
  category: 'frontend' | 'backend' | 'design' | 'leadership' | 'other';
  yearsExperience?: number;
  confidence: number; // 0-1
  source: string; // "resume line 5" | "cover letter 2"
}

interface Achievement {
  title: string;
  context: string;
  metrics: string[];
  skillsDemonstrated: string[];
  confidence: number;
  source: string;
}

interface Technology {
  name: string;
  proficiency: 'beginner' | 'intermediate' | 'expert';
  confidence: number;
  source: string;
}

interface WritingStyle {
  tone: 'professional' | 'conversational' | 'technical';
  voiceMarkers: string[];
  examples: string[];
}

interface Job {
  id: string;
  title: string;
  company?: string;
  description: string;
  addedAt: Date;
}

interface GeneratedMaterial {
  id: string;
  jobId: string;
  type: 'resume' | 'cover_letter';
  content: {
    text: string;
    keywordsUsed: string[];
    confidence: number;
  };
  generatedAt: Date;
  refinementHistory: RefinementHistoryItem[];
  exportedAt?: Date;
}

interface RefinementHistoryItem {
  userMessage: string;
  regeneratedContent: string;
  timestamp: Date;
}

interface ConversationMessage {
  id: string;
  jobId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}
```

---

## Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **SQLite for persistence** | Local-only, no cloud, instant access, file-based |
| **Zustand for state** | Lightweight, no boilerplate, easy to sync with backend |
| **docx-js for DOCX generation** | Programmatic, ATS-safe structure, editable output |
| **Express backend** | Handles Claude API calls server-side, database ops |
| **Single-column resume layout** | ATS parsing requires linear text flow |
| **Chat-driven refinement** | Users refine by instruction, not by editing UI |
| **Evidence sourcing** | Every extracted item traces to source doc (anti-fabrication) |

---

## Critical ATS Rules (Enforced at Generation Level)

1. **Page size:** US Letter (12240 × 15840 DXA)
2. **Margins:** 1" on all sides (1440 DXA each)
3. **Font:** Arial or Calibri, 11pt default
4. **Structure:** H1 (name) → H2 (section) → bullets
5. **No fancy:** Tables, images, text boxes, columns, special formatting
6. **Bullets:** Via docx LevelFormat.BULLET, not unicode characters
7. **Keywords:** Injected naturally (1 per bullet, 1-2% density)
8. **Smart quotes:** Avoided in generated content (use straight quotes)

---

## Build Order (What Claude Code Will Execute)

**Phase 1: Knowledge Base (4-5h)**
1. Document parser service
2. Knowledge extraction prompt + service
3. Knowledge synthesis prompt + service
4. Database schema + service
5. KB upload routes
6. KB browser component

**Phase 2: Generation (6-7h)**
1. Resume generator service + prompt
2. Cover letter generator service + prompt
3. DOCX exporter (docx-js integration)
4. Generation routes
5. Document preview component
6. Export buttons

**Phase 3: Refinement (2h)**
1. Refinement service + prompt
2. Chat component + history
3. Message routes

**Phase 4: Polish (1h)**
1. Dark mode CSS
2. Error handling UI
3. Loading indicators
4. Basic styling

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| **Claude API rate limits** | Batch requests, retry logic, user feedback |
| **Large document parsing** | Stream parsing for PDFs, chunking if needed |
| **Knowledge synthesis conflicts** | Flag contradictions, ask user to resolve |
| **DOCX formatting breaks** | Validate structure post-generation, test widely |
| **Chat refinement loops** | Limit to 10 messages per job, cache results |

---

## Success Criteria for v0

✅ Upload resume + cover letters + case study + LinkedIn text
✅ Knowledge base extracts 30+ skills, 10+ achievements, writing style
✅ Paste job description, generate tailored resume + cover letter in <10 seconds
✅ Chat refinement regenerates in <5 seconds
✅ Export both files as editable DOCX
✅ No ATS parsing errors (validated structure)
✅ No hallucinations (all claims traceable to source)
✅ Works on Mac Electron app
✅ Dark mode works

---

## Non-Goals for v0

❌ Notarization / code signing (v0.5+)
❌ Batch job processing
❌ ATS scoring
❌ Job evaluation pipeline
❌ Application tracking
❌ PDF export
❌ Cloud sync
❌ Multi-user
