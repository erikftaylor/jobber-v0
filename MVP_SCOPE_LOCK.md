# Jobber v0: MVP Scope Lock & Implementation Audit

**Last Updated:** 2026-06-20  
**Status:** Partial — 40% of MVP core requirements complete  
**Test Suite:** 93 tests passing ✅  
**TypeScript:** Fully type-checked ✅

---

## MVP Definition

An interactive resume tailoring app with **persistent Career Knowledge Layer**.

The MVP requires two distinct but interconnected systems:

### 1. Persistent Source Documents
- Upload and maintain career source documents (resume, cover letters, case studies, portfolio, LinkedIn)
- Parse and store raw text
- Enable document management (view, delete, organize)

### 2. Persistent Career Knowledge Layer (THE MVP CORE)
- **Extract** structured knowledge from source documents (skills, achievements, technologies, writing style, values)
- **Synthesize** knowledge (dedupe, resolve conflicts, create unified model)
- **Persist** as structured KnowledgeBase in database
- **Validate** resume claims against source documents
- **Report** quality/truthfulness/ATS metrics

### Core User Workflow

1. Upload and maintain persistent career source documents
2. **System extracts and synthesizes a Career Knowledge Layer** (structured, queryable)
3. Paste a job description
4. **Generate resume using Career Knowledge Layer** (not raw documents) as primary context
5. Preview the generated resume with **quality/truthfulness/ATS warnings**
6. **Validate claims in resume against sources** (all statements traceable)
7. Export as DOCX and PDF
8. Reopen saved generated resumes

---

## Current Implementation Workflow (Raw Document-Based)

```
User uploads documents
    ↓
Backend parses documents (PDF/DOCX/text) → stores raw_text in SQLite
    ↓
User selects session (default or custom)
    ↓
User pastes job description
    ↓
Click "Generate Resume"
    ↓
Backend concatenates raw documents as "CareerContext"
    ↓
Backend calls Claude API with RAW DOCUMENTS + job description (no structured knowledge layer)
    ↓
Claude generates resume text directly from raw documents
    ↓
Resume text parsed → Normalized → Validated → Rendered to HTML
    ↓
Resume persisted to database (generated_resumes table)
    ↓
Preview in center panel (plain text)
    ↓
User can:
    • Copy to clipboard
    • Export as PDF (opens in new tab)
    • Export as DOCX (downloads file)
    • Clear and start over
    ↓
Saved résumés show in right panel (no quality/truthfulness warnings)
    ↓
User can click saved résumé to reopen it
```

### What's Missing vs. MVP Requirement

**Career Knowledge Layer (NOT IMPLEMENTED):**
```
User uploads documents
    ↓
[❌ MISSING] Claude extracts structured knowledge:
  - Skills (name, category, years, confidence, source)
  - Achievements (title, context, metrics, skills, confidence, source)
  - Technologies (name, proficiency, confidence, source)
  - Writing style (tone, voice markers, examples)
  - Values & career themes
    ↓
[❌ MISSING] KnowledgeService synthesizes & dedupes:
  - Merges duplicate skills across documents
  - Resolves conflicts (e.g., different proficiency levels)
  - Creates unified, deduplicated KnowledgeBase
  - Persists to `knowledge_base` table
    ↓
[✅ CURRENT] User pastes job description
    ↓
[❌ WRONG] Generate resume using RAW DOCUMENTS (current)
[❌ SHOULD BE] Generate resume using STRUCTURED KNOWLEDGE + JD matching
    ↓
[❌ MISSING] Truthfulness validation:
  - Check resume claims against source documents
  - Flag unsupported statements
  - Surface confidence scores
    ↓
[❌ MISSING] Quality report:
  - ATS safety score
  - Truthfulness/source coverage
  - Keyword match vs. JD
  - Content quality metrics
    ↓
[✅ CURRENT] Export as DOCX/PDF
```

---

## MVP Readiness: Detailed Feature Matrix

| Feature | MVP Requirement | Current Status | Notes |
|---------|-----------------|-----------------|-------|
| **Source Document Storage** | Upload & persist source docs | ✅ DONE | 6 types, SQLite, metadata |
| **Knowledge Extraction** | Claude extracts structured knowledge from documents | ❌ NOT DONE | No extraction service, no KnowledgeBase table |
| **Knowledge Synthesis** | Dedupe, resolve conflicts, create unified model | ❌ NOT DONE | No synthesis service |
| **Knowledge Persistence** | Store KnowledgeBase structured in database | ❌ NOT DONE | knowledge_base table defined in ARCHITECTURE, not implemented |
| **Career Knowledge Layer** | Queryable, structured knowledge model | ❌ NOT DONE | System uses raw documents, not structured KB |
| **Resume Generation (from KB)** | Generate resume using KB as primary context | ⚠️ PARTIAL | Currently uses raw documents, should use KB |
| **Truthfulness Validation** | Check resume claims against sources | ❌ NOT DONE | No validation service for source traceability |
| **Quality Report** | Surface warnings/metrics in UI | ❌ NOT DONE | Validator exists but not wired to UI |
| **Job Description Input** | Accept job description | ✅ DONE | Text area in UI |
| **Resume Preview** | View generated resume | ✅ DONE | Plain text + HTML |
| **DOCX Export** | Download as Word document | ✅ DONE | Editable in Word |
| **PDF Export** | Download as PDF | ✅ DONE | Via new tab print |
| **Saved Résumés** | Persist & reopen | ✅ DONE | Artifact tracking works |
| **Session Management** | Multi-context isolation | ✅ DONE | Create/switch/delete sessions |
| **ATS Compliance** | Single-column, structured format | ✅ DONE | Enforced in normalizer/validator |

---

## In-Scope Features: Implemented ✅

### Tier 1: Document Management (Foundation)
- ✅ Upload resume, cover letters, case studies, LinkedIn, portfolio
- ✅ Document type classification (6 types)
- ✅ File parsing (PDF/DOCX/TXT via mammoth + pdf-parse)
- ✅ Persistent storage in SQLite documents table
- ✅ Document deletion
- ✅ View uploaded documents with metadata

### Tier 2: Session Management (UX)
- ✅ Multiple independent sessions (default + custom)
- ✅ Create new sessions
- ✅ Switch between sessions
- ✅ Delete sessions (except default)
- ✅ Clear session documents
- ✅ Active session persistence

### Tier 3: Resume Export (Output)
- ✅ Export as PDF (opens in new tab for printing/saving)
- ✅ Export as DOCX (downloads editable Word document)
- ✅ Both formats are ATS-safe
- ✅ Generated resumes stored in database
- ✅ Saved résumé list and reopening

### Tier 4: Resume Formatting (Quality)
- ✅ Resume parsed to structured JSON (StructuredResume)
- ✅ Content normalization (word limits, skill counts, bullet constraints)
- ✅ Content validation (structure, order, ATS constraints)
- ✅ HTML rendering with embedded CSS
- ✅ One-page fit with automatic compression
- ✅ Centralized format tokens (RESUME_FORMAT)

### Tier 5: UI/UX (Polish)
- ✅ 3-panel layout (left: documents, center: generator, right: saved résumés)
- ✅ Dark mode support (@media prefers-color-scheme: dark)
- ✅ Error banners with user-friendly messages
- ✅ Status banners (generating, exporting)
- ✅ Loading indicators
- ✅ Responsive button states

### Technical Infrastructure ✅
- ✅ Express backend with TypeScript
- ✅ SQLite database (documents, generated_resumes, sessions tables)
- ✅ React 19 frontend with minimal state management
- ✅ Document parser service
- ✅ Resume generator service
- ✅ DOCX/PDF export services
- ✅ Resume output engine
- ✅ Comprehensive test suite (93 tests)

---

## In-Scope Features: NOT Yet Implemented ❌

### CRITICAL MVP GAPS

**1. Knowledge Extraction ❌**
- No service to extract structured knowledge from documents
- No Claude prompt for knowledge extraction
- No KnowledgeExtraction use case
- **Effort:** 1-2 days
- **Blocks:** All downstream features

**2. Knowledge Synthesis ❌**
- No service to dedupe, merge, and resolve conflicts
- No conflict resolution UI
- **Effort:** 1 day
- **Depends on:** #1

**3. Knowledge Persistence ❌**
- knowledge_base table defined in ARCHITECTURE, not created
- No repository for KnowledgeBase
- No way to query synthesized knowledge
- **Effort:** 1 day
- **Depends on:** #2

**4. Knowledge-Driven Generation ❌**
- Current system uses raw documents (CareerContext)
- Should use structured KnowledgeBase as primary context
- Resume prompt should reference KB, not raw text
- **Effort:** 1-2 days
- **Depends on:** #3

**5. Truthfulness Validation ❌**
- No service to validate resume claims against source documents
- No traceability (which claim came from which source)
- No confidence scoring
- **Effort:** 2-3 days
- **Depends on:** #4

**6. Quality Report UI ❌**
- Validator generates warnings internally
- Not wired to frontend
- No quality panel/widget
- Should show:
  - ATS safety score
  - Truthfulness/source coverage %
  - Keywords matched vs. JD
  - Content quality metrics
- **Effort:** 1-2 days
- **Depends on:** #5

### NON-MVP (Out of Scope)

**Cover Letter Generation** ❌ **DEFERRED** (not MVP)
- Mentioned in ARCHITECTURE.md for future reference
- Same architecture as resume but separate artifact
- **Recommendation:** Build in v0.5+ after MVP resume validation
- **NOT a blocker for MVP ship**

**Refinement Chat** ❌ **DEFERRED** (not MVP)
- "Make it more concise" → regenerate
- Requires conversation history storage
- **Recommendation:** Build in v1.0+
- **NOT a blocker for MVP ship**

**Drag-and-Drop Upload** ⚠️ **NICE-TO-HAVE** (not MVP)
- Current click-upload works fine
- Can enhance later
- **NOT a blocker for MVP ship**

---

## Out-of-Scope Features: Correctly Excluded ✓

✓ Full job application tracking system  
✓ Job evaluation pipeline / ATS scoring API  
✓ Kanban boards for application pipeline  
✓ Recruiter CRM  
✓ Interview prep tools  
✓ Company research  
✓ Offer tracking  
✓ Networking workflows  
✓ Full career operating system  
✓ PDF export (app uses print-to-PDF instead)  
✓ Cloud sync / multi-user  
✓ Code signing / notarization  

---

## Current Gaps: MVP vs. Reality

| Gap | Severity | Effort | Dependencies | Notes |
|-----|----------|--------|--------------|-------|
| **No Career Knowledge Layer** | 🔴 CRITICAL | 5-7 days | Extract → Synthesize → Persist | Core MVP requirement not met |
| **Resume uses raw docs, not KB** | 🔴 CRITICAL | 2 days | Knowledge Persistence complete | Changes resume prompt & architecture |
| **No truthfulness validation** | 🔴 CRITICAL | 3 days | KB resume generation | Claims must be traceable to sources |
| **No quality report UI** | 🔴 CRITICAL | 2 days | Truthfulness validation complete | Users need visibility into reliability |
| Cover letter generation | 🟡 DEFERRED | 2 days | Resume MVP complete | **NOT MVP** — v0.5+ |
| Refinement chat | 🟡 DEFERRED | 3 days | Resume MVP complete | **NOT MVP** — v1.0+ |
| Drag-and-drop upload | 🟡 NICE-TO-HAVE | 1 day | UI enhancement | **NOT MVP** — can enhance later |

---

## Corrected MVP Readiness

### Current Status: **40-45% Complete**

**What Works** (40%):
- Document upload & storage ✅
- Resume generation from raw documents ✅
- Resume formatting & export ✅
- Saved résumé persistence ✅

**What's Missing** (55%):
- Career Knowledge Layer extraction ❌
- Knowledge synthesis & persistence ❌
- Knowledge-driven resume generation ❌
- Truthfulness validation ❌
- Quality report in UI ❌

### What's NOT Missing (Correctly Out-of-Scope)
- ✓ Cover letters (deferred to v0.5)
- ✓ Refinement chat (deferred to v1.0)
- ✓ Job application tracking (out of scope)
- ✓ ATS scoring API (out of scope)

---

## Implementation Order for MVP Completion

### Phase 1A: Career Knowledge Layer (CRITICAL PATH)
**Timeline:** 5-7 days | **Sequence:** Must happen in order

1. **Knowledge Extraction** (1-2 days)
   - Create `knowledge-extraction.service.ts`
   - Build Claude extraction prompt (prompt engineering)
   - Extract: skills, achievements, technologies, writing style, values
   - Return StructuredCareerKnowledge JSON
   - Tests for parsing reliability

2. **Knowledge Synthesis** (1 day)
   - Create `knowledge-synthesis.service.ts`
   - Dedupe skills (case-insensitive, group by category)
   - Merge achievements (same problem = one entry)
   - Resolve conflicts (e.g., "React: 3 years" vs "React: 5 years" → take max with flag)
   - Create unified CareerModel
   - Store in `knowledge_base` table

3. **Knowledge Persistence** (1 day)
   - Create `knowledge_base` table in database
   - Create `KnowledgeBaseRepository`
   - Create endpoints: `POST /api/kb/extract`, `GET /api/kb/model`
   - Test persistence across sessions

### Phase 1B: Knowledge-Driven Resume Generation (Blocks: 1A complete)
**Timeline:** 2-3 days

1. **Modify Resume Generation** (1 day)
   - Fetch KnowledgeBase instead of raw documents
   - Build new resume prompt: "Here is the candidate's structured career model: {...}"
   - Remove raw document fetching from usecase
   - Update CareerContext to use StructuredCareerKnowledge

2. **Truthfulness Validation** (2 days)
   - Create `truthfulness-validator.service.ts`
   - For each resume claim:
     - Find source document/achievement
     - Map back to evidence
     - Assign confidence score
     - Flag unsupported claims
   - Create validation report

3. **Quality Report UI** (2 days)
   - Add warnings panel to right sidebar
   - Display metrics:
     - Source coverage % (% of claims with sources)
     - ATS safety score (from existing validator)
     - Keyword match vs. JD
   - Color-code warnings (🟢 safe, 🟡 caution, 🔴 error)

### Phase 1C: Integration & Testing (Blocks: 1A, 1B complete)
**Timeline:** 1-2 days

1. Create end-to-end test: upload → extract → synthesize → generate → validate
2. Test with real resume samples
3. Verify knowledge extraction accuracy
4. Verify truthfulness validation catches hallucinations
5. Test session isolation (KB is per-session)

**🎯 After Phase 1 (7-10 days): MVP READY TO SHIP**

---

## After MVP: Future Phases (NOT MVP)

### Phase 2: Cover Letters & Refinement (v0.5)
**Timeline:** 2-3 days | **Status:** Designed, blocked by MVP

1. Create `cover-letter-generator.service.ts`
2. Use same KnowledgeBase + JD as resume
3. Add `POST /api/kb/generate?type=cover_letter`
4. Add UI for cover letter preview & export
5. Link to resume generation

### Phase 3: Refinement Chat (v1.0)
**Timeline:** 3 days | **Status:** Designed, deferred

1. Create `conversation` table for chat history
2. Create `refinement.service.ts` (regenerates using user feedback)
3. UI: chat input below generated resume
4. Limit: 10 messages per job

### Phase 4: Polish (v1.5+)
**Timeline:** 1-2 days each

1. Drag-and-drop upload enhancement
2. Multiple resume variants (A/B)
3. Document content preview
4. Keyboard shortcuts
5. Code signing + notarization

---

## Database Schema

### Current Tables

```sql
-- Documents: uploaded source files
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  type TEXT NOT NULL,  -- resume | cover_letter | case_study | linkedin | portfolio | work_history
  filename TEXT NOT NULL,
  raw_text TEXT NOT NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Generated resumes: artifacts from generation
CREATE TABLE generated_resumes (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  generated_content TEXT NOT NULL,
  formatted_html TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Sessions: isolated working contexts
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Active session metadata
CREATE TABLE active_session (
  session_id TEXT PRIMARY KEY,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);
```

**Ready for extension:**
- Add `generated_cover_letters` table (Phase 2)
- Add `conversation_history` table (for refinement chat, v0.5+)
- Add `job_descriptions` table (currently transient, Phase 2+)

---

## Architecture & Code Quality

### Backend Structure

```
src/backend/
├── index.ts                          # Express setup, route mounting
├── db/                               # SQLite schema & initialization
├── services/
│   ├── document-parser.service.ts    # PDF/DOCX/text parsing
│   ├── claude.service.ts             # Claude API wrapper
│   ├── resume-generator.service.ts   # Resume generation + Claude calls
│   ├── docx-generator.service.ts     # JSON → DOCX via docx library
│   ├── pdf-generator.service.ts      # HTML → PDF via pdfkit
│   ├── resume-parser.service.ts      # Generated text → JSON
│   ├── resume-normalizer.service.ts  # Enforce content constraints
│   ├── resume-validator.service.ts   # Validate structure & content
│   ├── resume-output-engine.service  # Orchestrate normalize → validate → render
│   ├── database.service.ts           # SQLite operations
│   └── readiness.service.ts          # Backend health checks
├── routes/
│   ├── knowledge.routes.ts           # Document upload, generation, export
│   ├── materials.routes.ts           # Saved résumé retrieval
│   ├── health.routes.ts              # Health check endpoint
├── repositories/
│   └── generated-material.repository # Persisted résumé artifacts
├── use-cases/
│   └── generate-resume.usecase.ts    # Orchestrates generation workflow
└── schemas/
    └── (Zod validation for request bodies)
```

### Frontend Structure

```
src/renderer/
├── App.tsx                           # Main 3-panel layout, state management
├── components/
│   └── UploadZone.tsx                # File upload UI
├── savedResumes.ts                   # Fetch saved résumé artifacts
└── main.tsx                          # React entry point
```

**Architecture Notes:**
- Minimal Zustand usage (state is mostly local useState)
- Backend-driven state via REST API calls
- No complex client-side caching
- Session-scoped documents (clean multi-context support)

### Test Coverage

```
93 tests passing
├── Backend services (50+)
│   ├── resume-output-engine.test.ts      (20 tests)
│   ├── document-parser.service.test.ts   (8 tests)
│   ├── docx-generator.service.test.ts    (6 tests)
│   ├── database.service.test.ts          (10+ tests)
│   └── ...
├── Backend routes (20+)
│   ├── knowledge.routes.test.ts
│   ├── materials.routes.test.ts
│   └── ...
└── Frontend (10+)
    └── savedResumes.test.ts
```

**Coverage:** Good coverage on core services, routes tested, database layer verified.

---

## ATS Compliance

### Enforced in Normalizer & Validator

- ✅ Single-column layout (left-aligned text only)
- ✅ Font: Arial/Calibri 11pt (via centralized RESUME_FORMAT)
- ✅ Proper heading hierarchy (H1 name → H2 sections → bullets)
- ✅ Bullets via HTML `<li>` / DOCX LevelFormat.BULLET
- ✅ 1" margins (0.6" in current format, can be adjusted)
- ✅ No tables, images, text boxes, icons
- ✅ No special formatting (justified text, columns, etc.)
- ✅ Keyword injection (natural language in bullets)
- ✅ One-page fit with deterministic compression
- ✅ Smart quotes avoided (straight quotes only)

**Validation checks in code:**
- `/src/backend/services/resume-validator.service.ts` — 10+ validation rules
- `/src/backend/services/resume-normalizer.service.ts` — content constraints
- `/src/shared/resumeFormat.ts` — centralized design tokens

---

## API Routes

### Production Routes (Implemented)

```
POST   /api/kb/upload              # Upload document
GET    /api/kb                     # List documents (current session)
GET    /api/kb/documents           # (Deprecated, use GET /api/kb)
DELETE /api/kb/documents/:id       # Delete document

POST   /api/kb/generate            # Generate resume (main workflow)
POST   /api/kb/docx                # Export resume as DOCX

POST   /api/kb/sessions            # Create session
GET    /api/kb/sessions            # List sessions
POST   /api/kb/sessions/:id/switch # Switch session
DELETE /api/kb/sessions/:id        # Delete session
POST   /api/kb/clear               # Clear session documents

GET    /api/materials              # List saved résumés
GET    /api/materials/:id          # Get single saved résumé

POST   /api/kb/pdf                 # (Experimental) PDF export via server

GET    /health                     # Health check
```

### Route Dependencies

```
Knowledge Routes (POST /api/kb/generate)
  ├→ DatabaseService (load documents)
  ├→ GenerateResumeUseCase
  │   ├→ ClaudeService (call Claude API)
  │   ├→ ResumeOutputEngine
  │   │   ├→ ResumeParser
  │   │   ├→ ResumeNormalizer
  │   │   ├→ ResumeValidator
  │   │   └→ ResumeRenderer
  │   └→ GeneratedMaterialRepository (persist)
  └→ Response: {generated_content, formatted_html, artifact_id}

DOCX Export Routes (POST /api/kb/docx)
  ├→ DatabaseService (lookup resume)
  ├→ DocxGeneratorService
  └→ Response: Buffer (DOCX file)
```

---

## Success Criteria for MVP v0

| Criterion | Current | Status | Effort |
|-----------|---------|--------|--------|
| **Upload & persist source docs** | ✅ DONE | MVP Ready | — |
| **Extract structured knowledge** | ❌ NOT DONE | CRITICAL | 1-2 days |
| **Synthesize & dedupe knowledge** | ❌ NOT DONE | CRITICAL | 1 day |
| **Persist KnowledgeBase** | ❌ NOT DONE | CRITICAL | 1 day |
| **Resume generation uses KB** | ❌ NOT DONE | CRITICAL | 2 days |
| **Truthfulness validation** | ❌ NOT DONE | CRITICAL | 2 days |
| **Quality report in UI** | ❌ NOT DONE | CRITICAL | 2 days |
| **Job description input** | ✅ DONE | MVP Ready | — |
| **Resume preview** | ✅ DONE | MVP Ready | — |
| **Export DOCX/PDF** | ✅ DONE | MVP Ready | — |
| **Reopen saved résumés** | ✅ DONE | MVP Ready | — |
| **ATS compliance** | ✅ DONE | MVP Ready | — |
| **Dark mode** | ✅ DONE | MVP Ready | — |
| **No ATS parsing errors** | ✅ DONE | MVP Ready | — |
| Cover letters | ❌ NOT DONE | **NOT MVP** (v0.5) | 2 days |
| Refinement chat | ❌ NOT DONE | **NOT MVP** (v1.0) | 3 days |

**MVP Ship Decision:** 
- 🟢 Ready when all CRITICAL items complete
- 🟡 Current: 40% complete (document storage + export, missing knowledge layer)
- 🔴 **NOT ready to ship** — Career Knowledge Layer is core MVP, currently not implemented

---

## Release Checklist

### Blockers Before MVP Ship

**Required for MVP v0 (Must Complete):**
- [ ] **Phase 1A: Career Knowledge Layer**
  - [ ] Knowledge extraction service (Claude prompt)
  - [ ] Knowledge synthesis service (dedupe + merge)
  - [ ] Database persistence (knowledge_base table)
  - [ ] Extraction + synthesis routes
  - [ ] Tests for accuracy

- [ ] **Phase 1B: Knowledge-Driven Generation**
  - [ ] Modify resume generator to use KB (not raw docs)
  - [ ] Truthfulness validator service
  - [ ] Quality report generation
  - [ ] Wire quality report to UI

- [ ] **Phase 1C: MVP Testing**
  - [ ] End-to-end test: upload → extract → generate → validate
  - [ ] Hallucination detection test
  - [ ] Session isolation test

### Testing Before Ship

- [ ] DOCX export in Microsoft Word + Google Docs
- [ ] PDF export via print dialog (Chrome, Safari, Firefox)
- [ ] Dark mode on all panels
- [ ] Session switching with KB persistence
- [ ] Saved résumé reopening
- [ ] Knowledge extraction accuracy (real resume samples)
- [ ] Truthfulness validation catches unsupported claims
- [ ] Error messages are user-friendly
- [ ] Load test: 20+ documents in session

### Ship v0

- [ ] Mark MVP complete
- [ ] Tag release v0.1.0
- [ ] Build Electron app

### Not Required for MVP Ship (v0.5+)

- ❌ Cover letter generation (Phase 2)
- ❌ Refinement chat (Phase 3)
- ❌ Drag-and-drop upload (Phase 4)
- ❌ Code signing (v1.0+)

---

## Known Issues & Workarounds

| Issue | Workaround | Priority |
|-------|-----------|----------|
| PDF export times out on slow networks | Use DOCX export instead | Medium |
| Large PDFs (>10MB) fail to parse | Split into smaller files | Low |
| DOCX export may truncate long resumes | User can edit in Word | Low |
| Session name can collide (not unique yet) | Will be fixed in v0.2 | Low |
| No resume version history | Resumes immutable once exported | Medium |

---

## Summary: Corrected MVP Assessment

### What's Actually Built (40% of MVP)

✅ **Foundation Layer** (complete)
- Document upload & parsing (6 types)
- SQLite persistence
- Session management
- Resume formatting & export

✅ **Output Layer** (complete)
- DOCX/PDF export
- Saved résumé reopening
- Dark mode & UI polish

### What's Missing (60% of MVP)

❌ **Career Knowledge Layer** (THE CORE)
- No structured knowledge extraction from documents
- No knowledge synthesis (dedupe, conflict resolution)
- No persistent KnowledgeBase
- No knowledge-driven resume generation
- No truthfulness validation
- No quality report in UI

### Critical Distinction

**Current System:** Raw Document → Resume Generator → Claude (generates from raw text)
- Simple but unreliable
- No structured knowledge model
- No truthfulness guarantees
- No visibility into quality

**MVP Required:** Raw Documents → Knowledge Extraction → Synthesized KB → Resume Generator → Claude (generates from KB)
- More complex but trustworthy
- Structured knowledge model
- Truthfulness validation
- Quality metrics visible to user

### Ship Decision

**❌ NOT READY TO SHIP** as of 2026-06-20

**Why:** Career Knowledge Layer is not a nice-to-have; it's the core MVP requirement. 
Resume generation without it is just a raw-document-to-text converter.

**To ship MVP v0:** Must complete Phase 1A (extraction + synthesis + persistence) + Phase 1B (KB-driven generation + truthfulness validation). 
**Estimated:** 7-10 days of development.

**What's NOT Blocking MVP Ship:**
- ✓ Cover letters (v0.5)
- ✓ Refinement chat (v1.0)
- ✓ Drag-and-drop (phase 4)

**Test Status:** 93 tests passing ✅ | TypeScript ✅ | Ready for implementation.

