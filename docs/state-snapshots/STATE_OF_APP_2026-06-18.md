# State of the App — Jobber v0

**Snapshot date:** 2026-06-18
**Purpose:** A clean, verified checkpoint of the stable baseline before pausing infrastructure work and resuming later with a UX polish phase.

---

## 1. Executive summary

Jobber v0 is now an **operational résumé generation workbench**.

- It uses **uploaded raw career documents** as the source of truth.
- It can **generate, save, reopen, preview, and export** résumé artifacts.
- Dormant **Knowledge Base (KB) infrastructure has been removed** — the app no longer carries an unused extraction/synthesis pipeline.
- The **PDF false-timeout bug has been fixed** — a successful export no longer emits a misleading timeout log ~30s later.

In short: the product is a focused, working résumé tool built directly on uploaded documents, with the speculative KB layer cleared away.

---

## 2. Current shipped baseline

```text
Latest commit: b1b8761 — Fix false PDF export timeout log
Branch:        main
Remote:        origin/main
Working tree:  clean
```

Immediately relevant recent commits:

```text
43e6081 — Remove dormant Knowledge Base infrastructure
b1b8761 — Fix false PDF export timeout log
```

Both are shipped to `origin/main`.

---

## 3. Verified capabilities

The following were exercised and confirmed working during the Task 26 end-to-end smoke test and the Task 27 fix verification:

- ✅ Backend starts (`npm run start`, port 3000)
- ✅ Frontend starts (`npm run dev`, Vite on port 5175, `/api` proxied to backend)
- ✅ `/api/health` responds (`status: ok`, database ok, claude configured, generation available)
- ✅ `/api/kb` returns raw uploaded document context
- ✅ `/api/kb/generate` generates résumé content
- ✅ Claude generation path works (one authorized call)
- ✅ Generated résumé is saved as an artifact (`artifact_id` returned, no save error)
- ✅ `/api/materials` lists saved artifacts
- ✅ `/api/materials/:id` reopens saved artifacts (and 404s correctly for missing ids)
- ✅ Reopened HTML can drive PDF export
- ✅ `/api/kb/pdf` returns a valid PDF (`Content-Type: application/pdf`, body begins with `%PDF`)
- ✅ No delayed false PDF timeout log after a successful export (verified by waiting 40s post-success: zero `[PDF] Timeout...` lines)

---

## 4. Test / build status

Latest verified status:

```text
npm run typecheck: passes
npx vitest run:    76 passed / 0 failed
npm run build:     passes
```

The end-to-end smoke test used **one authorized Claude generation call** (tiny Product Designer job description). All other checks used non-Claude paths.

---

## 5. Architecture reality

The app **as it actually exists now** (not as originally imagined):

- **Source of truth:** uploaded raw documents
- **Context assembly:** `CareerContextService` (`src/backend/services/career-context.service.ts`) — builds the raw-document context from uploaded documents
- **Prompt construction:** `ResumePromptBuilderService` (`src/backend/services/resume-prompt-builder.service.ts`)
- **Generation orchestration:** `GenerateResumeUseCase` (`src/backend/use-cases/generate-resume.usecase.ts`)
- **Persistence:** generated résumé artifacts/materials (saved via the material repository, reopened through the materials routes)
- **Preview/export:** formatted HTML → PDF route (`POST /api/kb/pdf`)
- **Removed / de-scoped:** the dormant KB extraction/synthesis pipeline and the `knowledge_base` schema lifecycle

The mental model: documents in → context assembled → prompt built → Claude generates → artifact saved → reopen/preview/export. No structured knowledge base sits in that path.

---

## 6. Removed / de-scoped scope

Intentionally removed as part of the KB de-scoping:

- KB refresh route
- KB extraction service
- KB synthesis service
- KB shared types/schemas
- KB DB read/write methods
- `knowledge_base` table creation/seeding lifecycle

Note:

```text
Existing local databases may still contain an orphaned knowledge_base table because no
destructive DROP TABLE migration was added.
```

---

## 7. Known non-blockers / technical notes

- Existing DBs may retain an **orphaned `knowledge_base` table** — harmless, because no code reads from or writes to it.
- The **`/api/kb` route name is now historically named**; it actually returns raw document context plus the generation/export endpoints, not a structured knowledge base.
- **`data/jobber.db` is intentionally not modified** by cleanup tasks; SQLite WAL/SHM sidecars are gitignored.
- The **test count changed** from earlier runs because dormant KB tests were removed and one PDF-timeout test was added (current total: 76).

---

## 8. Recommended next phase: UX polish pass

*(Not to be implemented now — candidate work for the next phase.)*

- Improve saved résumé/artifact list usability
- Improve loading and error states during generation/export
- Make artifact reopen state clearer
- Make empty states more helpful
- Add visible success feedback after save/export
- Review route naming / UI copy now that KB has been removed
- Confirm preview/export button behavior for reopened artifacts

---

## 9. Stop point

```text
Recommended stop point: this is a clean, pushed, verified baseline. Next work should begin
from UX polish, not more infrastructure cleanup unless a new bug is found.
```
