# Resume Output Engine

A deterministic, ATS-safe resume formatting system that ensures every generated resume renders identically with locked visual design, immutable section order, and comprehensive content validation.

## Architecture

The Resume Output Engine follows a strict pipeline:

```
Claude-Generated Text
    ↓
[Parser] → StructuredResume JSON
    ↓
[Normalizer] → NormalizedResume (constraints applied)
    ↓
[Validator] → ValidationResult (errors & warnings)
    ↓
[Renderer] → Deterministic HTML (styled per format spec)
    ↓
ATS-Safe, One-Page, Searchable Resume
```

## Core Components

### 1. Format Specification (`src/shared/resumeFormat.ts`)

Centralized design tokens that define every visual aspect:

- **Document**: US Letter (8.5" × 11"), portrait, 1 page, single column
- **Margins**: 0.6" all sides
- **Typography**: Inter primary, with fallback stack (Aptos, Calibri, Helvetica, Arial)
- **Font Sizes**: Name 20pt, headings 11pt, body 10.5pt, contact 9.5pt
- **Colors**: Text #111111, secondary #444444, divider #DDDDDD
- **Spacing**: Precise pt-based spacing for all sections and elements
- **Bullets**: • character, 0.18" indent, hanging indent
- **Section Order**: Immutable (Header → Summary → Expertise → Experience → Education → Certifications → Portfolio)

No visual formatting can occur outside these tokens.

### 2. Resume Types (`src/shared/resumeTypes.ts`)

TypeScript interfaces for type-safe resume data:

```typescript
StructuredResume {
  contact: ResumeContact
  summary?: ResumeSummary
  expertise?: ResumeSkill[]
  experience?: ResumeExperience
  education?: ResumeEducation[]
  certifications?: ResumeCertification[]
  portfolio?: ResumePortfolioItem[]
}

NormalizedResume extends StructuredResume {
  _normalized: true
  _stats: {
    summaryWords: number
    skillCount: number
    experienceRoles: number
    totalBullets: number
    estimatedPages: number
  }
}
```

### 3. Normalizer (`src/backend/services/resume-normalizer.service.ts`)

Enforces content constraints before rendering:

**Content Constraints:**
- Summary: max 70 words
- Skills: max 18 items
- Current role bullets: 5–7
- Previous role bullets: 4–6
- Older role bullets: 2–4

**Text Normalization:**
- Remove emojis: `[\p{Emoji}]/gu`
- Remove unsupported markdown: `[*_`#\[\]()]/g`
- Remove first-person pronouns: `\b(I|We|My|Our)\b`
- Remove weak openers: "responsible for", "helped", "worked with", etc.
- Deduplicate skills (case-insensitive)

**Output:** NormalizedResume with all constraints applied, ready for validation.

### 4. Validator (`src/backend/services/resume-validator.service.ts`)

Validates resume structure and content:

**Validation Checks:**
- Section order is immutable (Header → Summary → Expertise → Experience → Education → Certifications → Portfolio)
- Required sections present (contact name, professional experience)
- No prohibited ATS elements (tables, columns, icons, graphics, justified text, etc.)
- Content constraints met (word counts, skill limits, bullet counts)
- Typography matches specification
- Margins match specification
- One-page fit or can be compressed

**Output:** ValidationResult with errors (blocking) and warnings (informational)

### 5. Renderer (`src/backend/services/resume-renderer.service.ts`)

Converts NormalizedResume JSON → deterministic HTML:

- All styling from RESUME_FORMAT tokens
- Left-aligned, searchable text (never rasterized)
- No tables, columns, or graphics
- CSS for print-to-PDF conversion
- Page-break prevention for role blocks
- Automatic font stack fallback

**Output:** HTML string with embedded CSS, ready for PDF conversion.

### 6. Output Engine (`src/backend/services/resume-output-engine.service.ts`)

Orchestrates the full pipeline:

1. **Normalize** content to meet constraints
2. **Validate** structure and content
3. **Compress** if needed to fit one page
   - Compression order (deterministic):
     1. Reduce bullets in oldest roles
     2. Reduce skills to 12
     3. Trim summary to 50 words
     4. Reduce current role bullets (last resort)
4. **Render** to HTML

**Compression Constraints:**
- Never reduce body font size below 10pt
- Never reduce margins below 0.5in
- Page-fit algorithm preserves importance

**Output:** ResumeOutput with HTML, normalized resume, validation results, and statistics.

### 7. Parser (`src/backend/services/resume-parser.service.ts`)

Converts Claude-generated resume text → StructuredResume JSON:

- Detects section headers (SUMMARY, CORE EXPERTISE, PROFESSIONAL EXPERIENCE, etc.)
- Parses role headers (Job Title | Company | Location | Dates)
- Extracts bullet points
- Heuristic-based parsing for robustness

**Output:** StructuredResume ready for normalization.

## Design Principles

### Determinism
- Same input JSON always produces identical HTML/PDF
- No random choices in rendering pipeline
- All formatting from centralized tokens

### ATS-Safety
- No prohibited elements (tables, graphics, icons, sidebars)
- Left-aligned text only
- Searchable, selectable text (never rasterized)
- Simple, clean hierarchy

### One-Page Guarantee
- Automatic page-fit validation
- Deterministic compression algorithm
- Preserves content importance while fitting

### Type Safety
- TypeScript interfaces throughout
- No loose typing or string-based styling
- Compile-time validation where possible

### Testability
- 20+ unit tests covering all major components
- Deterministic output testing (same input → same output)
- Mock fixtures for validation
- Format token application verification

## Usage

### Generate a Resume

```typescript
import { resumeOutputEngine } from './resume-output-engine.service';

const resume = {
  contact: { name: 'Jane Smith', email: 'jane@example.com' },
  summary: { text: 'Experienced engineer...' },
  expertise: [{ name: 'Python' }, { name: 'React' }],
  experience: {
    roles: [
      {
        jobTitle: 'Senior Engineer',
        company: 'TechCorp',
        bullets: [{ text: '• Led team of 5 engineers' }],
      },
    ],
  },
  education: [{ school: 'Stanford University' }],
};

const output = resumeOutputEngine.generate(resume);

console.log(output.html); // Formatted HTML ready for PDF conversion
console.log(output.validation); // Validation results
console.log(output.stats); // Resume statistics
```

### Convert to PDF

Use a headless browser (Puppeteer, Playwright) or PDF library (pdfkit):

```typescript
import puppeteer from 'puppeteer';

const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.setContent(output.html);
await page.pdf({ path: 'resume.pdf', format: 'letter' });
await browser.close();
```

## Format Specification Details

### Typography Scale

| Element | Size | Weight | Line Height |
|---------|------|--------|-------------|
| Name | 20pt | 700 | 1.0 |
| Section Heading | 11pt | 700 | 1.15 |
| Job Title | 11pt | 600 | 1.3 |
| Company | 10.5pt | 500 | 1.3 |
| Body/Bullets | 10.5pt | 400 | 1.25 |
| Dates | 10pt | 400 | 1.3 |
| Contact | 9.5pt | 400 | 1.15 |

### Spacing Scale

| Element | Value |
|---------|-------|
| Contact after | 16pt |
| Section heading before | 16pt |
| Section heading after | 8pt |
| Paragraph after | 4pt |
| Bullet after | 3pt |
| Role block after | 12pt |
| Divider margin top | 6pt |
| Divider margin bottom | 10pt |

### Color Palette

| Role | Value |
|------|-------|
| Text | #111111 |
| Secondary | #444444 |
| Divider | #DDDDDD |
| Background | #FFFFFF |

## Testing

Run tests:

```bash
npm test -- resume-output-engine.test.ts
```

Test coverage:
- Section order stability
- Content normalization
- ATS-safety validation
- One-page fitting
- Deterministic rendering
- Format token application
- Validation rules
- Compression algorithm

All 20 tests passing ✅

## Acceptance Criteria Met

✅ **Determinism**: Same resume JSON produces identical visual output every run
✅ **One-Page**: Output always fits on single page, ATS-safe, searchable
✅ **Centralized Tokens**: All formatting driven by `RESUME_FORMAT` specification
✅ **No Prohibited Elements**: No tables, icons, sidebars, graphics, justified text
✅ **Comprehensive Tests**: 20 unit tests validate all requirements
✅ **Backward Compatible**: Existing resume generation still works

## Future Enhancements

- PDF export via Puppeteer/pdfkit
- DOCX export via docx-js
- Resume templates (different layouts, different color schemes)
- A/B testing formatter (generate multiple variations)
- Accessibility testing (contrast ratios, semantic HTML)
- Performance metrics (render time, file size)
