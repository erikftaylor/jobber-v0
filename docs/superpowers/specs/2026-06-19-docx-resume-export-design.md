# DOCX Resume Export — Design

**Date:** 2026-06-19
**Status:** Approved (pending spec review)
**Feature:** Export the AI-tailored résumé as a downloadable, ATS-friendly `.docx` file.

---

## Goal

Add a "Export as DOCX" capability that turns the app's **tailored** (AI-generated) résumé into a single-column, ATS-safe Word document with byte-consistent formatting, using the [`docx`](https://www.npmjs.com/package/docx) library (already a dependency, `^9.7.1`).

The feature parallels the existing "Export as PDF" action and is fully isolated: it does not modify generation, parsing, normalization, the HTML/PDF render path, or `/generate`.

## Decisions (locked)

1. **Source = the tailored résumé.** DOCX is built from the raw generated résumé text (`generated_content`), not the original upload and not the lossy structured JSON.
2. **Skills render one item per line.** The generator produces a flat "Core Expertise" list (not categorized `{label, content}`), so each item renders as its own line under the ATS heading "Core Skills".
3. **Title / specialties are conditional.** Tailored résumés omit a title line and specialties array; the DOCX header renders them only when present. For tailored output the header is: name → contact line → summary.

## Why not reuse the structured JSON

The existing `resumeParser` → `NormalizedResume` path is lossy for this purpose:
- It does not populate contact info (name/email/phone/location/linkedin/portfolio) — `parse()` is called without `contactInfo`.
- It stores expertise as a flat list (no categories).
- Its role-header parser expects `Job Title | Company`, but generated output is `Company | Title`, so it swaps the two.

Feeding DOCX from the raw tailored text is higher-fidelity and avoids coupling to (or changing) the existing parser/HTML path.

---

## Design tokens (non-negotiable)

### Colors
- Navy (headings/accents): `#1A3C5A`
- Body text: `#222222`
- Muted (dates, sublines): `#555555`

### Font
- Calibri throughout (ATS-safe, universally installed).

### Sizes (`docx` half-points = pt × 2)
| Element | Half-points |
|---|---|
| Name | 40 |
| Job title line | 24 |
| Section headings (bold, navy, UPPERCASE) | 24 |
| Role / company | 22 |
| Body & bullets | 21 |
| Specialties line | 19 |
| Contact line | 19 |
| Date line | 20 |

### Page
- US Letter: `12240 × 15840` DXA
- Margins: `1080` DXA all sides (0.75")

### Spacing (DXA, 1440 = 1 inch)
| Element | Spacing |
|---|---|
| Section heading | before 260, after 120, + bottom border rule |
| Role line | before 160, after 0 |
| Date line | before 0, after 40 |
| Bullets | after 60 |
| Skill rows | after 70 |

## Structural rules (ATS-safe; enforced on every export)

1. **Single column only.** No tables, text boxes, or multi-column sections. Date alignment uses inline text.
2. **Real bullet lists** via one `LevelFormat.BULLET` numbering config (`reference: "bullets"`, indent left 360 / hanging 200) — never typed `•` and never `\n`.
3. **Fixed ATS heading vocabulary**, uppercased: `Professional Summary`, `Core Skills`, `Professional Experience`, `Education`.
4. **Company bold, role regular**, on one line separated by ` — `; dates italic + muted on the line below.
5. **Live hyperlinks** on email (`mailto:`), LinkedIn (`https://`), and portfolio (`https://`).
6. **Each heading gets a paragraph bottom border** `{ style: SINGLE, size: 6, color: "1A3C5A", space: 2 }` — not a table, not a drawn shape.

---

## Architecture

### New file 1 — `src/backend/services/docx-generator.service.ts`
Pure builder. Input: a `ResumeDocxData` object. Output: a `docx` `Document`, plus `toBuffer(data): Promise<Buffer>`.

Implements the reference `buildResume` with two adaptations:
- `title` and `specialties` paragraphs render only when non-empty.
- "Core Skills" renders each skill as its own paragraph (one item per line, 21hp), instead of `label: content` rows.

`ResumeDocxData` shape:
```
{
  name: string;
  title?: string;
  specialties?: string[];
  location?: string; phone?: string; email?: string;
  linkedin?: string; portfolio?: string;
  summary?: string;
  skills: string[];                 // flat list, one per line
  experience: { company: string; title: string; dates: string; bullets: string[] }[];
  education: { school: string; credential?: string; detail?: string }[];
}
```

### New file 2 — `src/backend/services/resume-docx-mapper.service.ts`
Converts tailored résumé text (`generated_content`) → `ResumeDocxData`. Responsibilities:
- **Name:** first non-empty line.
- **Contact line:** the line containing `|` near the top; split on `|` and classify each part — email (contains `@`), linkedin (contains `linkedin`), phone (digits / parentheses), portfolio (remaining url-like token), location (first textual part).
- **Summary:** text under the `SUMMARY` section.
- **Skills:** items under `CORE EXPERTISE` (flat).
- **Experience:** under `PROFESSIONAL EXPERIENCE`, each role = a `Company | Title` header line (company first), an optional date line, then `•` bullet lines. Handles the `Company | Title` order correctly.
- **Education:** under `EDUCATION`, each line split into `{school, credential, detail}` best-effort (on `•` / `—`); falls back to the whole line as `school`.

Defensive: any missing section is simply omitted; the mapper never throws on absent sections.

### New file 3 — Route `POST /api/kb/docx` (in `src/backend/routes/knowledge.routes.ts`)
Beside `/pdf`. Accepts `{ content: string, filename?: string }`.
- `400` if `content` missing/empty.
- Maps → builds → returns the buffer.
- Headers: `Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `Content-Disposition: attachment; filename="<filename | resume.docx>"`, `Content-Length`.
- `500` (via the same pattern as `/pdf`) on mapper/builder failure. No timeout race needed — DOCX generation is fast and in-process.

### Edit — Frontend "Export as DOCX" button (`src/renderer/App.tsx`)
Next to "Export as PDF". Handler `handleDownloadDOCX`:
- POST `generated_content` (from `currentArtifact?.content || generatedContent`) to `/api/kb/docx`.
- Receive the blob, trigger download via an anchor element + object URL (no new dependency, no `file-saver`).
- Own `isExportingDocx` / status state; disabled while in flight or when there is no content.

## Data flow

```
generated_content (frontend state)
  → POST /api/kb/docx { content, filename }
    → resumeDocxMapper.toData(content)   → ResumeDocxData
    → docxGenerator.toBuffer(data)       → Buffer (.docx)
  → response (attachment) → browser download
```

## Error handling

| Condition | Result |
|---|---|
| Missing/empty `content` | `400 { error }` |
| Mapper throws unexpectedly | `500 { error }` |
| Builder/packer throws | `500 { error }` |
| Missing section in content | Section omitted; export still succeeds |

## Testing (TDD — tests written first)

1. **Mapper unit test** (`resume-docx-mapper.service.test.ts`): real tailored-text sample → asserts name, all parsed contact fields, summary, the flat skills array, `experience[0] = { company: 'Tovuti LMS', title: 'Product Designer', dates, bullets }`, and education entries.
2. **Builder unit test** (`docx-generator.service.test.ts`): sample `ResumeDocxData` → `toBuffer` returns a non-empty Buffer whose first two bytes are `PK` (zip magic) and which contains `word/document.xml` when unzipped; spot-check the doc XML includes the name and an ATS heading.
3. **Route test** (added to `knowledge.routes.test.ts`): POST `/api/kb/docx` with sample content → `200`, `Content-Type` is the docx MIME, body buffer starts with `PK`. Missing content → `400`.

Validation philosophy: a passing builder/route test that produces a re-openable OOXML buffer is the bar. No headless PDF-conversion CI step is added.

## Out of scope / untouched

- The Claude prompt, `GenerateResumeUseCase`, `CareerContextService`, `ResumePromptBuilderService`.
- `resumeParser`, the normalizer, validator, ATS HTML renderer, and the existing `/pdf` path.
- `/generate` behavior and all generation output.
- `data/jobber.db`.

## Expected outcome

~3 new test files / cases added; total test count rises from 76 to ~79+. Typecheck, full test suite, and build all green. A working "Export as DOCX" button that downloads an ATS-safe Word document of the tailored résumé.
