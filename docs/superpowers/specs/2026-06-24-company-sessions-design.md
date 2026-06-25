# Company Sessions Design

**Date:** 2026-06-24  
**Status:** Approved  
**Scope:** UI/UX reorganization to present job applications as company sessions

## Overview

Currently, the app treats each job posting as a standalone unit. This design rebrands the mental model to "company sessions" — one session per company you're applying to, with each session retaining the memory of work done (job description, generated resume, iterations, chat history).

Users create one session per company application. Shared uploaded documents (resume, case studies, etc.) are used across all sessions. Each session is isolated — Claude only sees that company's context when refining resumes.

## Core Concept

A **session** is a company application workspace containing:
- Company name and role title
- Job description (pasted input)
- Generated resume(s) and refinement history
- Conversation history with Claude
- Reference to shared uploaded documents

Switching sessions switches the entire context — documents stay shared, but everything else (job description, resume, chat) is session-specific.

## Architecture

### Data Model (No Changes)

The existing `jobs` table IS the session model. No schema migrations needed.

```sql
jobs (id, company, title, description, added_at)
```

Each job maps 1:1 to a session. The naming is internal; the UI calls it a "session."

### Related Data (Unchanged)

- `generated_materials` — linked to `job_id` (session)
- `conversations` — linked to `job_id` (session)
- `documents` — shared across all sessions (no job_id link)

### API Surface (Existing, Clarified)

| Endpoint | Purpose |
|----------|---------|
| `GET /api/jobs` | List all sessions (companies) |
| `POST /api/jobs` | Create new session |
| `GET /api/jobs/:id` | Load session context |
| `POST /api/jobs/:id/resumes` | Generate resume for this session |
| `GET /api/jobs/:id/conversations` | Load chat history for this session |

No new endpoints needed; existing ones clarify intent.

### Frontend State

New state to track:
- `activeSessionId` — which job (session) is currently being viewed
- `sessions` — list of all jobs (for dropdown)

On session switch:
1. Save active session ID to app state
2. Load that session's job description, generated resumes, chat history
3. Update sidebars to show session-specific data

## UI/UX Changes

### Header
Add a sessions dropdown next to app title:
```
[Jobber v0] [Company: Acme Corp ▼] [+ New] [Clear]
```

**Dropdown contents:**
- List of all companies with role and status
- Example: "Senior Engineer at Acme Corp (generated 2 days ago)"
- Click to switch to that session
- Icon/badge to show session status (in progress, completed, etc.)

### New Session Creation (from Job Description)
When user pastes a job description:
1. Paste job description into center panel
2. Click "Create Session" or trigger on blur
3. Claude extracts company name and role title
4. **Success case:** Auto-fills company and role, creates session immediately
5. **Failure case:** Shows warning dialog with input fields for company and role
   - User manually enters missing details
   - Confirms to create session

No manual `+ New` button needed for typical flow. Company and role are derived from the pasted job description.

### Existing UI (Unchanged)
- Left sidebar: Upload documents, enter job description (session-specific)
- Center: Generate Tailored Resume button and results (session-specific)
- Right sidebar: Saved Résumés (shows only this session's resumes)
- Documents area: Shared across all sessions (no change)

### Session Summary (Optional Future)
Could add a summary card showing:
- Company name
- Role title
- Date created / last modified
- Number of generated resumes
- Conversation history preview

Not required for MVP but improves discoverability.

## User Workflows

### Creating a Session
1. User pastes job description into the center panel
2. Claude automatically extracts company name and role title
3. Session auto-created with extracted details, user switched to it
4. If extraction fails: warning dialog appears asking user to manually enter company and role
5. User confirms (or manually enters if needed)
6. Session created
7. User uploads documents (if first time) or reuses existing
8. User clicks "Generate Resume"

**Implementation Note:** Job description input triggers extraction on blur or on a "Create Session" button click. The extraction call to Claude happens before session creation.

### Switching Sessions
1. User clicks dropdown: "Company: Acme Corp ▼"
2. Sees list: "Senior Engineer at Acme Corp", "Marketing Manager at TechCorp", etc.
3. Clicks "Marketing Manager at TechCorp"
4. App loads that session's job description, generated resume, chat history
5. User can continue refining or regenerate

### Data Isolation
- When viewing Session A (Acme Corp), only see Acme's job description and resumes
- Chat history shows only refinements for Acme
- Uploaded documents visible in all sessions (shared)
- Switching to Session B (TechCorp) shows TechCorp's context

## Implementation Plan (Phases)

### Phase 1: Job Description Extraction Service
- Create backend endpoint: `POST /api/jobs/extract` — takes job description text, returns extracted company and role
- Claude-powered extraction (use existing Claude integration)
- Handle extraction failures gracefully
- Return structured response: `{company: string, role: string, confidence: number}`

### Phase 2: Session Creation from Job Description
- Add "Create Session" button to job description input
- On click: call extraction service
- On success: auto-create session with extracted company/role
- On failure: show warning dialog with manual input fields
- Wire session creation to auto-switch to new session

### Phase 3: Session Dropdown & Switching
- Add dropdown component to header with list of sessions
- Wire dropdown to load sessions from `GET /api/jobs`
- Track `activeSessionId` in app state
- Load session data (job description, resumes, chat) when switching

### Phase 4: Session Summary (Optional)
- Add status indicators to dropdown
- Show "last modified" dates
- Show generated resume count per session

## Testing

### Unit / Component Tests
- Session dropdown renders correctly
- New session modal creates session
- Switching sessions loads correct data
- Data isolation: session A doesn't leak into session B

### Integration Tests
- Create session → upload document → generate resume → switch to new session → verify no crosstalk
- Verify shared documents appear in all sessions
- Verify chat history is per-session

### Manual Tests
- Create 3 sessions with different companies
- Upload 1 document, use across all sessions
- Switch between sessions, verify context changes
- Generate resume in session A, verify it doesn't appear in session B

## Error Handling

- **Extraction fails:** Show warning dialog with input fields for company name and role title. User must manually enter values before session can be created.
- **Extraction partial:** If only company OR role extracted, show confirmation dialog asking user to confirm/correct the extracted value and fill in the missing one.
- **Session not found:** If user switches to deleted session, show error and default to first session
- **Create session:** Validate company name and role are non-empty before creating
- **Switch session:** Gracefully handle if session data fails to load

## Rollout

No breaking changes — existing users continue using the app. The "session" is just a UI reorganization of the existing job model.

## Future Considerations

- **Session status:** Mark sessions as "applied", "interviewing", "rejected", "offer", etc.
- **Session notes:** Add free-form notes per session (why you're interested, follow-ups needed)
- **Export session:** Export all session data (job description, resume, chat) as PDF or markdown
- **Templates per session:** Different resume styles per company
