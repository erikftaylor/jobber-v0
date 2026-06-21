# Jobber v0 - Manual Smoke Test Script

**Purpose**: Verify the MVP works end-to-end with real documents and a real job description through the browser UI.

**Duration**: ~15-20 minutes

**Tester**: One person, one clean test session

---

## Part 1: Prerequisites & Setup

### 1.1 Environment Variables
Verify that `.env` contains a valid Anthropic API key:
```
ANTHROPIC_API_KEY=sk-ant-api03-...
```
**Action**: Open `.env` and confirm the key is present and not expired.
- ✓ Key is present
- ✓ Key format looks correct (starts with `sk-ant-api03-`)

### 1.2 Dependencies Installed
```bash
npm install
```
**Verify**:
- All packages install without errors
- No peer dependency warnings
- `node_modules/` directory exists

### 1.3 TypeScript & Build Health
```bash
npm run typecheck
npm run build
npm test
```
**Expected results**:
- ✓ Typecheck passes with no errors
- ✓ Build succeeds (creates `dist/` folder)
- ✓ All tests pass (162 tests)

### 1.4 Test Data Preparation
Download or prepare:
1. **A real resume** (PDF or DOCX format)
   - Example: Your own resume or a sample resume (2-4 pages)
   - Formats supported: `.pdf`, `.docx`, `.doc`, `.txt`, `.md`
   - **File size**: Should be < 10MB

2. **A real job description** (copy-paste from job board)
   - Example: A tech job listing from LinkedIn, Indeed, or company career page
   - **Length**: Full job description (multiple paragraphs)
   - **Save location**: Have it ready to paste into the UI

3. **Optional: Cover letter or portfolio** (if testing multiple document types)
   - Must match supported types: `resume`, `cover_letter`, `case_study`, `linkedin`, `portfolio`

---

## Part 2: Clean Database & Fresh Start

### 2.1 Delete the SQLite Database
```bash
rm -f data/jobber.db data/jobber.db-wal data/jobber.db-shm
```
**Verify**:
- ✓ `data/` directory still exists (or will be created on first run)
- ✓ All `*.db*` files are gone

### 2.2 Clear Old Uploads
```bash
rm -rf uploads/
```
**Verify**:
- ✓ `uploads/` directory is deleted (will be recreated on first upload)

### 2.3 Verify Clean Dist
```bash
npm run build
```
**Verify**:
- ✓ `dist/` is rebuilt fresh
- ✓ No stale assets

---

## Part 3: Start Backend & Frontend

### 3.1 Backend
In **Terminal A**:
```bash
npm start
```
**Expected output**:
```
Jobber server listening on port 3000
Open http://localhost:3000 in your browser
```
**Verify**:
- ✓ No errors in console
- ✓ Server is listening on port 3000
- ✓ No "ANTHROPIC_API_KEY" errors (key is configured)

### 3.2 Frontend
The frontend is served by the backend at `http://localhost:3000`.

**Action**: Open browser and navigate to `http://localhost:3000`

**Expected page**:
- React app loads without errors
- Console shows no JavaScript errors (F12 → Console tab)
- Page displays upload zone and session management UI

---

## Part 4: Health Check

### 4.1 API Health
**Action**: Open DevTools Console (F12) and run:
```javascript
fetch('/api/health').then(r => r.json()).then(d => console.log(d))
```
**Expected response**:
```json
{
  "status": "ready",
  "components": {
    "database": "ready",
    "claude": "ready"
  }
}
```
**Verify**:
- ✓ Database component: `ready`
- ✓ Claude component: `ready`

### 4.2 Initial Document List
**Action**: Console:
```javascript
fetch('/api/kb').then(r => r.json()).then(d => console.log(d))
```
**Expected response**:
```json
{
  "success": true,
  "documents": [],
  "context": {
    "total_documents": 0,
    "total_chars": 0,
    "ready_for_generation": false
  }
}
```
**Verify**:
- ✓ No documents yet (fresh state)
- ✓ `ready_for_generation: false`

---

## Part 5: Test Input Checklist

Before proceeding to the UI flow, confirm you have:
- [ ] Real resume file ready (downloaded/saved on disk)
- [ ] Real job description copied to clipboard
- [ ] Browser open to `http://localhost:3000`
- [ ] Terminal showing "Listening on port 3000"
- [ ] No console errors on the page

---

## Part 6: UI Flow - Step by Step

### Step 1: Upload Resume
**Action**:
1. On the app, locate the **"Upload Resume"** section
2. Click the upload zone or "Choose File"
3. Select your resume file
4. Confirm file type is **"Resume"**
5. Click upload

**Verify Success**:
- ✓ File is accepted (no error message)
- ✓ Document appears in the "Uploaded Documents" list
- ✓ Shows filename, size (characters), and upload timestamp
- ✓ Console shows: `[Upload] Stored resume: ...`
- ✓ UI is responsive (no freeze/hang)

**Expected HTTP**:
- POST `/api/kb/upload` returns 200 with success message

### Step 2: Verify Document in Database
**Action**: Console:
```javascript
fetch('/api/kb/documents').then(r => r.json()).then(d => console.log(d))
```
**Expected response**:
```json
{
  "success": true,
  "documents": [
    {
      "id": "doc-...",
      "type": "resume",
      "filename": "your-resume.pdf",
      "uploaded_at": "2026-06-20T...",
      "parsed_at": null
    }
  ]
}
```
**Verify**:
- ✓ Document is in the database
- ✓ Type is `resume`
- ✓ ID matches what UI shows

### Step 3: Paste Job Description
**Action**:
1. Locate **"Job Description"** text area
2. Click the text area
3. Paste the full job description
4. Verify text is visible

**Verify Success**:
- ✓ Job description text is in the input
- ✓ No character limit errors
- ✓ Text is fully visible (can scroll if needed)

### Step 4: Generate Tailored Resume
**Action**:
1. Click **"Generate Tailored Resume"** button
2. Watch the UI for progress

**Expected behavior**:
- Button becomes disabled / shows loading spinner
- Message appears: "Generating tailored resume…"
- Status updates in real-time (optional)
- After 10-30 seconds: Generation completes

**Verify Success**:
- ✓ Generation completes without error
- ✓ Tailored resume appears in **Preview** section
- ✓ Console shows no errors
- ✓ No "Claude API" errors or timeout errors
- ✓ Preview shows formatted resume content (not blank/broken HTML)

**Expected backend logs**:
- `[Generate] Using job description: ...`
- `[Generate] Claude API call completed`
- `[Generate] Resume saved: ...`

### Step 5: Verify Quality Report
**Action**:
1. Look for **"Quality Report"** section in the UI
2. Verify it displays metrics

**Expected content**:
- Percentage match to job description
- Keyword coverage
- Format analysis
- Recommendations (if any)

**Verify Success**:
- ✓ Quality report is visible
- ✓ Shows numerical scores (not NaN or errors)
- ✓ Metrics make sense (0-100% match)
- ✓ No "undefined" or broken text

### Step 6: Export to PDF
**Action**:
1. Click **"Download PDF"** button
2. A file dialog appears or file auto-downloads
3. File is saved as `tailored-resume.pdf`

**Verify Success**:
- ✓ File downloads without error
- ✓ File name is `tailored-resume.pdf`
- ✓ File size is > 10KB (not empty)
- ✓ No timeout errors in console
- ✓ Browser download shows success

**Expected HTTP**:
- POST `/api/kb/pdf` returns 200 with PDF blob
- Content-Type: `application/pdf`
- Content-Disposition includes filename

### Step 7: Validate PDF
**Action**:
1. Open the downloaded PDF file
2. Verify contents

**Validation Checklist - PDF**:
- ✓ PDF opens without errors
- ✓ Contains the full resume content
- ✓ Formatting looks professional (not corrupted)
- ✓ All text is readable (not garbled)
- ✓ Pages are properly formatted
- ✓ No blank pages
- ✓ Fonts render correctly
- ✓ Line breaks and spacing are preserved
- ✓ Tailored content is present (matched to job description)

**Failure symptoms**:
- PDF opens as blank or corrupted
- "Invalid PDF" error when opening
- Text appears as symbols/boxes
- Layout is broken or overlapping
- File size is < 5KB (likely empty)

### Step 8: Export to DOCX
**Action**:
1. Click **"Download DOCX"** button
2. A file dialog appears or file auto-downloads
3. File is saved as `tailored-resume.docx`

**Verify Success**:
- ✓ File downloads without error
- ✓ File name is `tailored-resume.docx`
- ✓ File size is > 10KB (not empty)
- ✓ No timeout errors in console
- ✓ Browser download shows success

**Expected HTTP**:
- POST `/api/kb/docx` returns 200 with DOCX blob
- Content-Type: `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- Content-Disposition includes filename

### Step 9: Validate DOCX
**Action**:
1. Open the downloaded DOCX file in Microsoft Word, Google Docs, or LibreOffice
2. Verify contents

**Validation Checklist - DOCX**:
- ✓ DOCX opens without errors
- ✓ Contains the full resume content
- ✓ Formatting looks professional (headers, bold, italics)
- ✓ All text is readable and editable
- ✓ No corruption or garbled text
- ✓ Line breaks and spacing are correct
- ✓ Tables/lists (if present) are properly formatted
- ✓ Fonts are embedded or fallback correctly
- ✓ File can be edited in Word
- ✓ Can save a copy (file is not read-only)
- ✓ Tailored content is present (matched to job description)

**Failure symptoms**:
- DOCX opens as corrupted/damaged file
- "Unable to read file" or similar error
- Text appears as boxes or symbols
- No formatting (everything is plain text)
- File size is < 5KB (likely empty)
- Cannot edit content in Word

### Step 10: Check Saved Resumes
**Action**:
1. Look for **"Saved Resumes"** section
2. Verify generated resume appears in the list

**Verify Success**:
- ✓ Generated resume is listed
- ✓ Shows title, creation date, and timestamp
- ✓ Can be clicked to view/reopen
- ✓ Shows job description snippet (if applicable)

### Step 11: Reopen Saved Resume
**Action**:
1. Click on the saved resume in the list
2. Verify it reloads into the preview

**Verify Success**:
- ✓ Resume content reloads without error
- ✓ Preview shows the same content as before
- ✓ Quality report is still visible
- ✓ Can export to PDF/DOCX again

### Step 12: Cleanup
**Action**:
1. Clear session: Click **"Clear Session"** or use `POST /api/kb/clear`
2. Confirm all documents are deleted

**Verify Success**:
- ✓ Documents disappear from list
- ✓ Preview clears
- ✓ No errors in console
- ✓ Database still works (ready for next test)

---

## Part 7: Error Handling & Edge Cases (Optional)

### Test 7.1: Missing Job Description
**Action**:
1. Clear the job description field
2. Try to generate a resume

**Expected**: Error message appears, generation is blocked
- ✓ Shows "Please paste a job description"
- ✓ Generation is not called
- ✓ No API error

### Test 7.2: Missing Resume
**Action**:
1. Clear all documents
2. Try to generate a resume

**Expected**: Error message appears, generation is blocked
- ✓ Shows "Upload documents first"
- ✓ Generation is not called
- ✓ No API error

### Test 7.3: Large File Upload
**Action**:
1. Try uploading a file > 10MB

**Expected**: Upload is rejected
- ✓ Error message appears
- ✓ Shows file size limit (10MB)
- ✓ File is not uploaded to database

### Test 7.4: Unsupported File Type
**Action**:
1. Try uploading a `.exe`, `.zip`, or image file

**Expected**: Upload is rejected
- ✓ Error message appears
- ✓ Shows supported file types
- ✓ File is not uploaded

### Test 7.5: Backend Down
**Action**:
1. Stop backend (Ctrl+C in Terminal A)
2. Try to generate a resume

**Expected**: Error message appears
- ✓ Shows connection/network error
- ✓ Graceful error, not JavaScript crash
- ✓ Restart backend and UI recovers

---

## Part 8: Database Validation

### Verify SQLite Database
**Action**:
1. After test completes, inspect the database file:
```bash
sqlite3 data/jobber.db "SELECT COUNT(*) as doc_count FROM documents; SELECT COUNT(*) as model_count FROM career_models;"
```

**Expected output**:
```
doc_count: 1 (or more if you uploaded multiple)
model_count: 1 (one generated resume)
```

### Verify Generated Material
```bash
sqlite3 data/jobber.db "SELECT id, type, title, rendered_html IS NOT NULL as has_html FROM generated_resumes LIMIT 1;"
```

**Expected**:
```
id: artifact-...
type: resume
title: (job title or filename)
has_html: 1 (true)
```

---

## Part 9: API Inspection (DevTools)

### Inspect Network Tab
**Action**: F12 → Network tab → Run the full flow again

**Key endpoints to verify**:
1. `POST /api/kb/upload` → 200
   - Response: `{ success: true, document: {...} }`
   - File size < 10MB

2. `GET /api/kb/documents` → 200
   - Response: Array of documents

3. `POST /api/kb/generate` → 200
   - Response: `{ success: true, resume_id: "...", resume: {...}, quality_report: {...} }`
   - Takes 10-30 seconds
   - No 429 (rate limit) errors

4. `POST /api/kb/pdf` → 200
   - Response: Binary PDF file
   - Content-Type: `application/pdf`
   - Takes 5-15 seconds

5. `POST /api/kb/docx` → 200
   - Response: Binary DOCX file
   - Content-Type: `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
   - Takes 5-15 seconds

**Verify**:
- ✓ No failed requests (status 5xx)
- ✓ No 401/403 errors (auth issues)
- ✓ No 413 errors (payload too large)
- ✓ All endpoints respond with correct content types

---

## Part 10: Pass/Fail Criteria

### ✅ PASS Criteria (All must be true)
- [x] All `npm run typecheck` checks pass
- [x] All 162 tests pass (`npm test`)
- [x] `npm run build` succeeds with no errors
- [x] Backend starts with no console errors
- [x] Frontend loads and renders without JavaScript errors
- [x] Health check returns `ready` for both database and Claude
- [x] Resume uploads successfully
- [x] Job description text accepts full job posting
- [x] Resume generation completes within 30 seconds
- [x] Quality report displays with valid metrics (0-100%)
- [x] PDF export downloads successfully and opens without corruption
- [x] DOCX export downloads successfully and opens in Word/Docs
- [x] Saved resumes list is populated and resume can be reopened
- [x] Generated DOCX is editable and contains all resume content
- [x] Generated PDF is readable and contains all resume content
- [x] No API errors in Network tab (all 200 responses)
- [x] No console errors or warnings (F12 Console tab)
- [x] Database file is created and contains expected tables
- [x] Can clear session and reset for another test run

### ❌ FAIL Criteria (Any failure means FAIL)
- [ ] TypeScript errors on build
- [ ] Test failures
- [ ] Backend crashes or refuses to start
- [ ] Frontend shows blank page or JavaScript errors
- [ ] API returns 5xx errors
- [ ] Resume generation fails or times out (>30s)
- [ ] Generated PDF is corrupted or empty
- [ ] Generated DOCX is corrupted or empty
- [ ] Quality report shows NaN or invalid data
- [ ] Cannot download files or download hangs
- [ ] Database file is not created or is corrupted
- [ ] Cannot switch sessions or clear session
- [ ] API missing expected response fields

---

## Part 11: Screenshots & Artifacts to Capture

### Before Test
- [ ] Screenshot of terminal: `npm run typecheck`, `npm test`, `npm run build` all passing
- [ ] Screenshot of `.env` file showing ANTHROPIC_API_KEY is set

### During Test
- [ ] Screenshot of homepage with uploaded resume in list
- [ ] Screenshot of generated resume preview in browser
- [ ] Screenshot of quality report panel
- [ ] Screenshot of DevTools Network tab showing successful API calls
- [ ] Screenshot of DevTools Console showing no errors

### After Test
- [ ] Downloaded `tailored-resume.pdf` file
- [ ] Downloaded `tailored-resume.docx` file
- [ ] Screenshot of PDF opened in browser/reader
- [ ] Screenshot of DOCX opened in Word/Docs
- [ ] Database inspection output:
```bash
sqlite3 data/jobber.db ".tables"
sqlite3 data/jobber.db "SELECT COUNT(*) FROM generated_resumes;"
```

---

## Part 12: Test Report Template

**Date**: [YYYY-MM-DD]  
**Tester**: [Name]  
**Test Duration**: [minutes]  
**Browser**: [Chrome/Firefox/Safari/Edge]  
**OS**: [macOS/Windows/Linux]  

### Results
- **Overall**: ✓ PASS / ✗ FAIL
- **Build Status**: ✓ OK / ✗ FAIL
- **API Tests**: ✓ OK / ✗ FAIL
- **PDF Export**: ✓ OK / ✗ FAIL
- **DOCX Export**: ✓ OK / ✗ FAIL
- **Quality Report**: ✓ OK / ✗ FAIL
- **Saved Resumes**: ✓ OK / ✗ FAIL

### Issues Found
(List any failures, errors, or unexpected behavior)

1. Issue: ...
   - Expected: ...
   - Actual: ...
   - Severity: High/Medium/Low

### Sign-Off
- **QA Approved**: ✓ Yes / ✗ No
- **Ready for Release**: ✓ Yes / ✗ No
- **Notes**: ...

---

## Quick Reference: Terminal Commands

### Start Fresh
```bash
rm -f data/jobber.db data/jobber.db-wal data/jobber.db-shm
rm -rf uploads/
npm run build
```

### Run Tests
```bash
npm run typecheck
npm test
npm run build
```

### Start Backend
```bash
npm start
```

### Reset Session (in browser console)
```javascript
fetch('/api/kb/clear', { method: 'POST' }).then(r => r.json()).then(d => console.log(d))
```

### Check API Health
```javascript
fetch('/api/health').then(r => r.json()).then(d => console.log(d))
```

### View Database
```bash
sqlite3 data/jobber.db ".schema"
sqlite3 data/jobber.db "SELECT * FROM documents;"
sqlite3 data/jobber.db "SELECT * FROM generated_resumes;"
```

---

## Notes for Testers

- **Do not test multiple resumes in parallel**: Use one resume, one job description per test run
- **Timing**: Generation typically takes 10-30 seconds; PDF/DOCX export 5-15 seconds
- **API Key**: The `.env` file must have a valid `ANTHROPIC_API_KEY` or generation will fail with 401 error
- **Network**: Ensure your internet connection is stable (API calls to Anthropic)
- **Storage**: Ensure your system has > 1GB free disk space for database, uploads, and file generation
- **Cleanup**: After test passes, delete downloaded files and regenerate on next run (tests download artifacts fresh)

---

## Post-Test Verification Checklist

After all manual tests pass:
- [ ] No uncommitted changes in tracked files (only new test artifacts in `data/`, `uploads/`, `downloads/`)
- [ ] Git status is clean for source code
- [ ] Ready to commit smoke test documentation
- [ ] Ready to create a release candidate tag
- [ ] No console warnings or deprecations
- [ ] No performance regressions (generation time is reasonable)
- [ ] Database file can be backed up without corruption (try `cp data/jobber.db data/jobber.db.backup`)

---
