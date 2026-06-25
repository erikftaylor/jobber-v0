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

### New Session Modal
Triggered by `+ New` button:
- Company name input (required, e.g., "Acme Corp")
- Role title input (required, e.g., "Senior Engineer")
- Submit creates session, switches to it immediately

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
1. User clicks `+ New`
2. Modal appears: "Company: ___, Role: ___"
3. User enters "Acme Corp" and "Senior Engineer"
4. Session created, user switched to it
5. User uploads documents (if first time) or reuses existing
6. User pastes job description
7. User clicks "Generate Resume"

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

### Phase 1: Session Dropdown & Creation
- Add dropdown component to header
- Add "new session" modal
- Wire dropdown to load sessions from `GET /api/jobs`
- Track `activeSessionId` in app state

### Phase 2: Session Switching
- Load session data when user selects from dropdown
- Update job description, generated resumes, chat to show selected session
- Persist active session ID (localStorage or server-side)

### Phase 3: Session Summary (Optional)
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

- **Session not found:** If user switches to deleted session, show error and default to first session
- **Create session:** Validate company name and role are non-empty
- **Switch session:** Gracefully handle if session data fails to load

## Rollout

No breaking changes — existing users continue using the app. The "session" is just a UI reorganization of the existing job model.

## Future Considerations

- **Session status:** Mark sessions as "applied", "interviewing", "rejected", "offer", etc.
- **Session notes:** Add free-form notes per session (why you're interested, follow-ups needed)
- **Export session:** Export all session data (job description, resume, chat) as PDF or markdown
- **Templates per session:** Different resume styles per company
