# Task 6: Session-Specific Data Loading - Verification Findings

**Date:** 2026-06-24  
**Status:** BLOCKED - Required endpoints do not exist

## Task Requirements

Verify session-specific data isolation with these endpoints:
1. `GET /api/kb/jobs/:id/resumes` - return only resumes where `generated_materials.job_id = :id`
2. `GET /api/kb/jobs/:id/conversations` - return only conversations where `conversations.job_id = :id`

## Findings

### Missing Endpoints
- ❌ `GET /api/kb/jobs/:id/resumes` - **DOES NOT EXIST**
- ❌ `GET /api/kb/jobs/:id/conversations` - **DOES NOT EXIST**
- ❌ `/api/jobs` CRUD endpoints (POST, GET :id) - **DO NOT EXIST**

### Current API Available
- ✅ `GET /api/materials` - returns ALL resumes globally (no job filtering)
- ✅ `GET /api/materials/:id` - returns a specific resume by ID
- ✅ `GET /api/kb/jobs/extract` - POST endpoint to extract company/role from job description

### Schema Analysis

**generated_resumes table:**
```sql
CREATE TABLE generated_resumes (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'resume',
  title TEXT NOT NULL,
  job_description_hash TEXT NOT NULL,
  source_document_ids JSON NOT NULL,
  career_model_id TEXT,
  generated_content TEXT NOT NULL,
  structured_resume_json JSON,
  rendered_html TEXT,
  quality_report_json JSON,
  formatting_error TEXT,
  format_version TEXT,
  prompt_version TEXT,
  model TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (career_model_id) REFERENCES career_models(id)
);
```

**Problem:** No `job_id` or `session_id` column → resumes are NOT isolated by job or session

**Unused Tables (exist but not used):**
- `generated_materials` - HAS `job_id` FK but implementation uses `generated_resumes` instead
- `conversations` - HAS `job_id` FK but not wired into backend

### Repository Implementation

**GeneratedMaterialRepository.list():**
```typescript
list(): GeneratedMaterial[] {
  const rows = this.db
    .prepare('SELECT * FROM generated_resumes ORDER BY created_at DESC')
    .all() as Record<string, any>[];
  return rows.map(row => this.mapRow(row));
}
```

**Issue:** No filtering by job_id or session_id. Returns ALL resumes globally.

### Session Isolation Status

| Component | Isolated? | Method |
|-----------|-----------|--------|
| Documents | ✅ YES | `documents.session_id` |
| Career Models | ✅ YES | `career_models.session_id` |
| Generated Resumes | ❌ NO | No session/job column |
| Generated Materials | ❌ UNUSED | Table exists but not used |
| Conversations | ❌ UNUSED | Table exists but not used |

## Why This Happened

The implementation diverged from the design plan:

1. **Plan specified:** Use `generated_materials` table with `job_id` FK
2. **Implementation chose:** New `generated_resumes` table without job/session isolation
3. **Result:** Session isolation not enforced for generated content

The `generated_materials` and `conversations` tables were created per spec but the actual generation flow writes to `generated_resumes` instead.

## What's Needed to Resolve

To implement Task 6 as specified:

### Option A: Migrate to generated_materials table
1. Update `GeneratedMaterialRepository` to use `generated_materials` instead of `generated_resumes`
2. Add `job_id` to the create input
3. Create `/api/jobs` CRUD endpoints (POST to create job, GET to list, GET :id to retrieve)
4. Add `/api/kb/jobs/:id/resumes` endpoint with job_id filtering
5. Add `/api/kb/jobs/:id/conversations` endpoint with job_id filtering
6. Migrate existing resumes from `generated_resumes` to `generated_materials` with associated job_ids

### Option B: Add job_id column to generated_resumes
1. Add `job_id TEXT` column to `generated_resumes`
2. Create `/api/jobs` CRUD endpoints
3. Update `GeneratedMaterialRepository` to accept and filter by job_id
4. Create `/api/kb/jobs/:id/resumes` endpoint
5. Create `/api/kb/jobs/:id/conversations` endpoint (if needed)

### Option C: Accept current architecture
1. Document that session isolation is only for source documents, not generated content
2. Resumes are global, not tied to specific jobs
3. Close Task 6 as "Architecture doesn't support this requirement"

## Current Session Isolation Capability

**What IS isolated by session:**
- Source documents (uploaded resumes, cover letters, etc.)
- Career models
- Active session context

**What is NOT isolated by session:**
- Generated resumes (all users see all generated resumes)
- Conversations about resumes

## Manual Testing

Due to missing endpoints, manual testing cannot proceed as specified in Task 6:
- Cannot create Session A → generate resume → create Session B → verify resume isolation
- The `/api/kb/jobs/:id/resumes` endpoint doesn't exist to query session-specific resumes

## Recommendation

**Decision Required:** Choose between Options A, B, or C above.
- Option A: Most aligned with original design
- Option B: Minimal migration effort
- Option C: Accept current design limitations

Once decision is made, update the schema and implement the missing CRUD endpoints.

---

**Generated for:** Task 6 verification  
**Verified by:** Code review and schema analysis  
**Status:** BLOCKED - Architecture decisions required
