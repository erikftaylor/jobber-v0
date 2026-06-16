# Jobber v0: Design Spec

Status: Approved for planning
Builds on: `ARCHITECTURE.md`, `SCOPE_LOCK.md` (project root)

## Purpose

Jobber v0 is a personal-use Mac Electron app. It ingests a user's resume, cover
letters, case studies, and LinkedIn text; builds a knowledge base via Claude;
and generates tailored, ATS-safe resumes and cover letters per job description,
refined through chat.

This spec fills the gaps `ARCHITECTURE.md` left open — primarily, how Electron,
Express, and React actually wire together at runtime — and records scope
decisions made during brainstorming. It does not repeat content from
`ARCHITECTURE.md`/`SCOPE_LOCK.md` verbatim; read those first for the full data
flow, DB schema, routes, component tree, and ATS rules. This document layers
on top of them.

## Scope Decisions

- **Distribution: personal use only.** No installer, no code signing, no
  auto-update. Run via a local dev/start script. (Confirms `SCOPE_LOCK.md`'s
  exclusion of notarization/code signing.)
- **Single current draft per job.** One resume + one cover letter row per job;
  refinement overwrites in place. No version history list, no "restore
  previous version" UI.
- **Knowledge synthesis conflicts auto-resolve.** No interactive
  contradiction-resolution UI in v0 (see "Knowledge Synthesis" below).

## Electron Shell & Process Model

This is the layer `ARCHITECTURE.md` never specified.

- **Integration model:** Express runs in-process inside Electron's main
  process, started on app launch (`localhost:<port>`, e.g. 4500). The
  renderer is a normal React app that talks to it via `fetch()` — the exact
  REST routes already defined in `ARCHITECTURE.md`. No IPC layer for app
  logic.
  - Rejected alternatives: (B) IPC-native via `contextBridge`/`ipcMain.handle`
    — more idiomatic Electron, avoids an open localhost port, but requires
    redesigning the routes layer the architecture doc already wrote as REST
    endpoints, for a benefit that doesn't matter for a single-user local
    tool. (C) Express as a forked child process — same API surface as the
    chosen model, adds IPC-vs-HTTP plumbing for crash isolation that matters
    at scale, not here.
- **`electron/main.ts`:** on launch, starts the Express server, then creates
  one `BrowserWindow` with `contextIsolation: true`, `nodeIntegration: false`.
  Loads the Vite dev server URL in dev, or `dist/renderer/index.html` in prod.
- **`electron/preload.ts`:** effectively unused — nothing privileged the
  renderer needs that a `fetch()` call can't already do.
- **Native module rebuild:** `better-sqlite3` is a native addon compiled
  against a specific Node ABI. It must be rebuilt against Electron's bundled
  Node/V8 version, not system Node, or the app fails to launch. Add `electron`
  and `@electron/rebuild` as devDependencies (currently missing from
  `package.json` entirely) with a `postinstall` rebuild step.
- **Dev workflow:** `npm run dev` runs Vite (renderer) and Electron
  concurrently (`concurrently` + `wait-on` gating Electron's launch on the
  Vite dev server being up), so renderer changes hot-reload while Electron
  stays open.
- **File export:** since Express runs in the same process as Electron's main
  process, `export.routes.ts`'s handler calls `electron.dialog.showSaveDialog`
  and `fs.writeFileSync` directly — no IPC channel needed. Default save
  location: `app.getPath('desktop')`, matching `ARCHITECTURE.md`'s stated
  data flow ("User exports to Desktop").

## Backend — Data Layer & Services

Carries over from `ARCHITECTURE.md` with these additions/clarifications:

- **PDF/DOCX parsing libraries** (not present in `package.json`): add
  `pdf-parse` (PDF → text) and `mammoth` (DOCX → text) as dependencies.
  Plain text/LinkedIn paste needs no library.
- **`generated_materials` table:** add a `UNIQUE(job_id, type)` constraint to
  enforce the single-current-draft decision at the DB level. Generation
  upserts (insert if absent for that job+type, else update); refinement
  updates the same row and appends to its `refinement_history` JSON array.
- **`knowledge_base` table** stays a singleton (one row, `synthesis_version`
  increments on `POST /api/kb/refresh`) — unchanged from the doc.
- All other services (`claude.service.ts`, `resume-generator.service.ts`,
  `cover-letter-generator.service.ts`, `docx-exporter.service.ts`,
  `keyword-analyzer.service.ts`), routes, and Zod schemas carry over from
  `ARCHITECTURE.md` unchanged.

## Frontend (React + Zustand)

Carries over from `ARCHITECTURE.md` essentially unchanged — the 3-panel
layout, `jobberStore.ts` state shape, and component tree are sound as
specified. Two clarifications from the scope decisions above:

- `currentResume`/`currentCoverLetter` in the store map directly to the
  single-draft-per-job row — no version list, no "which version" state.
- `SynthesisStatus` (left panel) shows last-synthesized metadata (timestamp,
  skill/achievement counts) rather than any contradiction-flagging UI, since
  conflicts auto-resolve (see below).

Styling, dark mode, and CSS Grid layout approach are unchanged from the doc.

## Knowledge Synthesis — Conflict Handling

When `synthesize-knowledge.prompt.md` finds contradictory facts across
documents (e.g. two different years-of-experience values for the same
skill), `knowledge.service.ts` auto-resolves rather than prompting the user:

- **Resolution rule:** prefer the item with higher `confidence`; if tied,
  prefer the most recently uploaded source document.
- The resolved item's `source` field still records which document it came
  from, preserving the doc's evidence-sourcing/anti-fabrication principle —
  traceable, just not interactively resolved.
- Purely a prompt/service-logic rule. No new UI, no new DB fields.

## Build Order

Revises `ARCHITECTURE.md`'s build order to add the Electron foundation it
skipped:

1. **Phase 0 (~1-2h) — Foundation:** add `electron`, `@electron/rebuild`,
   `concurrently`, `wait-on` to `package.json`; create `electron/main.ts` +
   `electron/preload.ts`; configure Vite for the renderer; wire the dev
   script; verify an empty window launches and hot-reloads.
2. **Phase 1 (~4-5h) — Knowledge Base:** as in `ARCHITECTURE.md`, plus wiring
   in `pdf-parse`/`mammoth`.
3. **Phase 2 (~6-7h) — Generation:** as in `ARCHITECTURE.md`.
4. **Phase 3 (~2h) — Refinement:** as in `ARCHITECTURE.md`.
5. **Phase 4 (~1h) — Polish:** as in `ARCHITECTURE.md`.

## Testing Strategy

Not specified in `ARCHITECTURE.md` despite `vitest`/`@testing-library/react`
already being installed:

- Service-level unit tests with Vitest: `document-parser`,
  `knowledge.service` (synthesis + conflict-resolution rule),
  `keyword-analyzer`, and `docx-exporter` (validate generated DOCX structure
  — margins, no tables/images, bullet formatting per the ATS rules in
  `SCOPE_LOCK.md`).
- `claude.service` is mocked in tests — no live API calls in the suite.
- Component tests with `@testing-library/react` for the upload flow and chat
  refinement flow.
- No Electron-level/e2e automation for v0 — manual smoke-test launch given
  personal-use scope; disproportionate effort otherwise.

## Risks

Carried over from `ARCHITECTURE.md`, with one addition and one update:

| Risk | Mitigation |
|------|-----------|
| **Native module ABI mismatch** (new) | `better-sqlite3` must be rebuilt against Electron's Node version via `@electron/rebuild` postinstall step (Phase 0), or the app fails to launch |
| **Knowledge synthesis conflicts** (updated) | Auto-resolved by the confidence/recency rule — no longer needs user-facing resolution UI |
| Claude API rate limits | Batch requests, retry logic, user feedback |
| Large document parsing | Stream parsing for PDFs, chunking if needed |
| DOCX formatting breaks | Validate structure post-generation, test widely |
| Chat refinement loops | Limit to 10 messages per job, cache results |

## Non-Goals

Unchanged from `SCOPE_LOCK.md`: no ATS scoring, no portal scanning, no batch
processing, no application tracking, no two-column layouts, no images/tables
in resumes, no notarization/code signing, no PDF export, no cloud sync, no
multi-user.
