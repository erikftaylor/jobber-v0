# Jobber v0 MVP Acceptance Checklist

## 1. MVP Scope

**Jobber v0 MVP enables:**
- Persistent career knowledge extraction from user-uploaded documents
- ATS-optimized resume generation tailored to specific job descriptions
- Truthfulness assessment of generated resumes against extracted knowledge
- Export of polished DOCX and PDF files ready for submission

**Out of scope:**
- Claude-powered knowledge improvement (heuristic extraction only)
- Cover letter generation
- Job tracking or application history
- Refinement chat loop
- Job description parsing or role matching
- Multi-user or cloud sync

---

## 2. Critical User Journey (Manual QA Script)

### 2.1 Setup
```
- [ ] Run: npm start (frontend) and backend in separate terminal
- [ ] Clear browser cache / use private window
- [ ] Check database is clean (delete job.db if needed)
```

### 2.2 Upload and Career Model Creation
```
- [ ] Upload a career document (resume or cover letter)
  Expected: Document appears in "Uploaded Documents" panel
  
- [ ] Confirm document persists
  Expected: Refresh page, document still visible
  
- [ ] Check Career Model endpoint: GET /api/kb/career-model
  Expected: { stale: true, careerModel: null, sourceDocumentCount: 1 }
  (Document exists but no model yet—this is expected)
```

### 2.3 Build Career Model
```
- [ ] POST /api/kb/career-model/rebuild
  Expected: 200 response with careerModel object
  
- [ ] Check model has:
  [ ] id (unique identifier)
  [ ] source_document_ids (array with uploaded doc)
  [ ] source_hash (SHA256 hash)
  [ ] model_json.contact (extracted or empty)
  [ ] model_json.roles (array of roles)
  [ ] model_json.skills (array of skills)
  [ ] model_json.tools (array of detected tools)
  [ ] model_json.approvedClaims (array of claims)
```

### 2.4 Verify CareerModel Stale Detection
```
- [ ] Upload a second document
  Expected: GET /api/kb/career-model returns { stale: true }
  (Model exists but source_hash no longer matches)
  
- [ ] POST /api/kb/career-model/rebuild again
  Expected: New model created with updated source_document_ids
```

### 2.5 Resume Generation
```
- [ ] In app, paste a job description
  Example: "Senior Software Engineer, React, Node.js, AWS, microservices..."
  
- [ ] Click "Generate Resume"
  Expected: Resume generates in ~10-30 seconds
  
- [ ] Verify response includes:
  [ ] generated_content (raw Claude text)
  [ ] formatted_html (ATS-formatted HTML)
  [ ] qualityReport (truthfulness, ATS, keywords, length)
  [ ] artifact_id (saved resume ID)
```

### 2.6 Verify Resume Persistence
```
- [ ] Check backend: GET /api/materials/{artifact_id}
  Expected: Resume has these fields:
  [ ] id
  [ ] type: "resume"
  [ ] title (derived from job description)
  [ ] generated_content
  [ ] formatted_html
  [ ] quality_report (QA status)
  [ ] career_model_id (links to career model)
  [ ] created_at
  
- [ ] Query database directly:
  SELECT id, career_model_id, structured_resume_json, rendered_html, quality_report_json 
  FROM generated_resumes 
  WHERE id = {artifact_id}
  
  Expected: All fields are non-null for new resume
```

### 2.7 Quality Report in UI
```
- [ ] Quality report panel appears below generated resume
  Expected: Shows:
  [ ] Overall status ("Ready to export" / "Needs review" / "Not ready")
  [ ] Source support status (pass/warn/fail)
  [ ] ATS formatting status (pass/warn/fail)
  [ ] Keyword alignment (matched/missing count)
  [ ] Length estimate (pages)
  
- [ ] If exportReady is false, warning appears:
  "This resume has issues that should be reviewed before export."
```

### 2.8 Download DOCX
```
- [ ] Click "Export as DOCX"
  Expected: Browser downloads "tailored-resume.docx"
  
- [ ] Open DOCX in Word/Google Docs/LibreOffice
  Expected: File opens without errors
  
- [ ] Verify DOCX content:
  [ ] Text is selectable (not an image)
  [ ] Name at top in bold
  [ ] Contact info (email, phone, location if available)
  [ ] Section headings are bold (SUMMARY, EXPERIENCE, etc.)
  [ ] Experience bullets are bullet points (not dash or *)
  [ ] No columns or text boxes
  [ ] No images or icons
  [ ] No complex tables
  [ ] Margins are reasonable
  [ ] Font is readable (Arial or similar)
  [ ] Section order: Contact → Summary → Experience → Skills → Education
```

### 2.9 Download PDF
```
- [ ] Click "Export as PDF"
  Expected: Browser downloads "tailored-resume.pdf"
  
- [ ] Open PDF
  Expected: File opens in PDF reader without errors
  
- [ ] Verify PDF content:
  [ ] Text is selectable (use Ctrl+A or Cmd+A)
  [ ] Layout matches the UI preview closely
  [ ] No obvious formatting issues
  [ ] Page count is ~1 page (or less than 2)
  [ ] Margins and spacing look professional
  [ ] All sections visible (didn't get cut off)
```

### 2.10 Reopen and Re-export
```
- [ ] In "Saved Résumés" panel, click a saved resume
  Expected: Resume loads into main view
  Expected: Quality report appears (if available)
  
- [ ] Click "Export as DOCX" on reopened resume
  Expected: File downloads without error
  
- [ ] Click "Export as PDF" on reopened resume
  Expected: File downloads without error
  
- [ ] Compare exported files with original generation
  Expected: Exports are consistent (same content)
```

### 2.11 Error Cases (Brief)
```
- [ ] Try to export without uploading documents
  Expected: Error: "Upload documents first"
  
- [ ] Try to export without pasting job description
  Expected: Error: "Please paste a job description"
  
- [ ] Upload document, try to export DOCX immediately
  Expected: Either auto-generates or shows: "Resume not yet saved"
  
- [ ] Delete saved resume from database, try to export
  Expected: Error: "Resume not found"
```

---

## 3. Automated Test Coverage

### Test Coverage Summary
```
Total Test Files: 17
Total Tests: 162 (all passing)

Critical Paths Covered:
- [ ] CareerModel creation and persistence (29 tests)
- [ ] Career model stale detection (1 test)
- [ ] Resume generation and persistence (6 tests)
- [ ] Quality report generation (19 tests)
- [ ] DOCX export from structured resume (1 test)
- [ ] PDF export from rendered HTML (implicit via backend)
- [ ] Saved resume parsing with quality report (4 tests)
- [ ] Materials API returns career_model_id and quality_report (implicit)
- [ ] Frontend export uses resumeId (no UI tests, but flow verified)
```

### Key Test Files
```
✅ src/backend/services/__tests__/career-model.service.test.ts (29 tests)
   - Hash stability
   - Stale detection
   - Source document preservation
   - Confidence scoring

✅ src/backend/services/__tests__/resume-quality-report.service.test.ts (19 tests)
   - Truthfulness evaluation
   - ATS formatting checks
   - Keyword matching
   - Export readiness logic

✅ src/backend/use-cases/__tests__/generate-resume.usecase.test.ts (6 tests)
   - Auto-build CareerModel
   - Resume persistence
   - Quality report in response

✅ src/backend/routes/__tests__/knowledge.routes.test.ts (28 tests)
   - Career model endpoints
   - Resume generation endpoint
   - Includes quality report in response

✅ src/backend/routes/__tests__/materials.routes.test.ts (4 tests)
   - Saved resume retrieval
   - quality_report field presence

✅ src/renderer/__tests__/savedResumes.test.ts (7 tests)
   - Parse saved resume with quality_report
   - Backward compatibility (resume without quality_report)
```

---

## 4. Known Limitations

### Extraction Limitations
- **Heuristic-only**: Uses pattern matching, not ML—may miss nuanced skills
- **Conservative**: Errs on side of missing claims rather than fabricating
- **English-only**: Doesn't handle multilingual resumes
- **Tool detection**: Limited to ~35 known tools (not exhaustive)

### UI Limitations
- **Mobile-untested**: Layout not verified on mobile
- **Dark mode**: Dark mode support exists but not thoroughly tested
- **Accessibility**: No ARIA labels or screen-reader testing
- **Localization**: English-only

### Export Limitations
- **Generic filenames**: "tailored-resume.docx" doesn't include job title or date
- **No progress bars**: Large exports may appear to hang (but are working)
- **DOCX styling**: Limited to bold/bullet (no italic, underline, etc.)
- **PDF generation**: Depends on external library (puppeteer/html2pdf)—may have rendering quirks

### Feature Gaps (Out of Scope)
- **No Claude extraction**: Uses heuristics only
- **No cover letters**: Resume-only
- **No job tracking**: No application history or follow-up reminders
- **No refinement loop**: Can't chat to improve generated resume
- **No multi-user**: Single-session, file-based database

### Performance
- **Resume generation**: ~10-30 seconds (depends on Claude latency)
- **DOCX generation**: ~1 second
- **PDF generation**: ~3-5 seconds
- **Database**: SQLite (not suitable for production scale)

---

## 5. Ship/No-Ship Criteria

### ✅ GO (Ship) If:
```
- [ ] All 162 tests pass
- [ ] TypeScript compilation succeeds (no errors)
- [ ] Build succeeds (npm run build)
- [ ] Manual QA journey completes without blockers
- [ ] DOCX and PDF downloads work and are ATS-safe
- [ ] Quality report appears and is accurate
- [ ] No console errors in browser
- [ ] Resume persists and can be reopened
- [ ] Career model stale detection works
```

### ❌ NO-SHIP (Blocker) If:
```
- [ ] Tests fail
- [ ] TypeScript errors
- [ ] Build fails
- [ ] Resume generation crashes
- [ ] Exports download wrong format or corrupt files
- [ ] Quality report crashes or shows false data
- [ ] Documents don't persist across page reload
- [ ] Career model creation fails silently
- [ ] Export buttons don't download files
```

---

## 6. Remaining Recommended Tasks (After MVP)

### v0.1 (Quality Improvements)
- [ ] Add Claude extraction service to improve over heuristics
- [ ] Add knowledge synthesis/dedup service
- [ ] Build truthfulness validation dashboard
- [ ] Add resume regeneration with prompt hints

### v0.2 (User Experience)
- [ ] Improve filename generation (include job title or date)
- [ ] Add undo/redo for generated resumes
- [ ] Add resume comparison view
- [ ] Mobile-responsive UI updates

### v0.3 (Features)
- [ ] Add cover letter generation
- [ ] Add job tracking / application history
- [ ] Add resume refinement chat loop
- [ ] Add saved job descriptions for future reference

### v0.5+ (Scale & Polish)
- [ ] Migrate from SQLite to production database (PostgreSQL)
- [ ] Add multi-user support with login
- [ ] Add cloud storage for resumes
- [ ] Add collaborative features

---

## 7. Test Command Summary

```bash
# Type checking
npm run typecheck

# Run all tests (162 tests across 17 files)
npm test

# Build for production
npm run build

# Start development server
npm start
```

---

## 8. Database Verification

### Critical Tables
```sql
-- Verify tables exist
SELECT name FROM sqlite_master WHERE type='table';

Expected tables:
- sessions
- documents
- career_models
- generated_resumes (NEW: has career_model_id, quality_report_json)
- generated_materials (legacy, unused)
```

### Sample Queries for Verification
```sql
-- Career model with full data
SELECT id, session_id, source_hash, model_version, 
       LENGTH(model_json) as model_size,
       ROUND(1.0 * LENGTH(model_json) / 1024, 1) as model_kb
FROM career_models LIMIT 1;

-- Resume with all required fields
SELECT id, type, title, career_model_id, 
       CASE WHEN structured_resume_json IS NOT NULL THEN 'yes' ELSE 'no' END as has_structured,
       CASE WHEN rendered_html IS NOT NULL THEN 'yes' ELSE 'no' END as has_html,
       CASE WHEN quality_report_json IS NOT NULL THEN 'yes' ELSE 'no' END as has_qr,
       created_at
FROM generated_resumes LIMIT 1;
```

---

## 9. Browser Console Verification

### Expected State (No Errors)
```
- [ ] No red errors in Console tab
- [ ] No failed fetch requests (all 2xx or 304)
- [ ] No warnings about missing resources
- [ ] No unhandled promise rejections
- [ ] No React prop warnings (if React)
```

### If Issues Appear
```
1. Check Network tab for failed requests
2. Check Console for error messages
3. Verify backend is running (POST /api/kb/generate should work)
4. Check database file exists and is readable
5. Verify all documents are uploaded (GET /api/kb/documents)
```

---

## 10. Final Acceptance Sign-Off

| Component | Status | Notes |
|-----------|--------|-------|
| Career Model Storage | ✅ | Persistent, hashed, stale-detected |
| Resume Generation | ✅ | Uses CareerModel, includes quality report |
| Quality Report | ✅ | Truthfulness, ATS, keywords, length |
| DOCX Export | ✅ | From structured JSON, ATS-safe |
| PDF Export | ✅ | From rendered HTML, selectable text |
| Frontend Downloads | ✅ | Real files, not HTML/JSON |
| Saved Resume Reopening | ✅ | Persists quality report |
| Tests | ✅ | 162 passing, critical paths covered |
| Build | ⏳ | (To be verified) |

---

## 11. Ship Readiness Checklist

### Pre-Ship (Required)
```
- [ ] Run `npm run typecheck` — 0 errors
- [ ] Run `npm test` — 162 passing
- [ ] Run `npm run build` — succeeds
- [ ] Manual QA journey — completed without blockers
- [ ] No console errors — verified
- [ ] Database queries — all expected tables and data present
- [ ] DOCX file — opens and looks ATS-safe
- [ ] PDF file — opens and is selectable text
```

### Do NOT Ship If
```
- [ ] Any test fails
- [ ] TypeScript errors exist
- [ ] Build fails
- [ ] Manual QA finds critical issue (export broken, persistence failing, etc.)
- [ ] Console has uncaught errors
- [ ] DOCX/PDF are corrupt or unreadable
```

---

## Acceptance Decision

**Ready to ship:** When all pre-ship checks pass and manual QA completes without blockers.

**Not ready to ship:** If any blocker exists, fix and re-verify that specific area.

**Version:** Jobber v0 MVP

**Acceptance Date:** [To be filled upon completion]

**Signed Off By:** [To be filled upon completion]
