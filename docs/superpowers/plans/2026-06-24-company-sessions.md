# Company Sessions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add company-focused session management where users paste job descriptions, Claude auto-extracts company/role, and each session retains its work history.

**Architecture:** 
- Backend extraction service uses Claude Haiku to pull company and role from job descriptions
- Frontend tracks active session ID and loads/saves session context on switch
- Sessions are implemented as a UI layer over existing job model (no DB schema changes)
- Shared documents across sessions, isolated job descriptions and generated resumes per session

**Tech Stack:** 
- Claude Haiku for extraction
- React for session UI components
- Existing job/generated_materials model (no migrations)

---

## Phase 1: Job Description Extraction Service

### Task 1: Create Job Extraction Service

**Files:**
- Create: `src/backend/services/job-extraction.service.ts`
- Create: `src/backend/services/__tests__/job-extraction.service.test.ts`

- [ ] **Step 1: Write test for extraction success**

Create `src/backend/services/__tests__/job-extraction.service.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { extractJobInfo } from '../job-extraction.service';

describe('JobExtractionService', () => {
  it('should extract company and role from job description', async () => {
    const jobDescription = `
      Senior Software Engineer - Acme Corporation
      
      We are looking for a Senior Software Engineer to join our team.
      Requirements: 5+ years of experience with TypeScript...
    `;

    const result = await extractJobInfo(jobDescription);

    expect(result).toEqual({
      company: 'Acme Corporation',
      role: 'Senior Software Engineer',
      confidence: expect.any(Number)
    });
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it('should return null fields if extraction fails', async () => {
    const vague = 'We need someone to work on stuff.';
    const result = await extractJobInfo(vague);

    expect(result).toEqual({
      company: null,
      role: null,
      confidence: expect.any(Number)
    });
  });

  it('should handle extraction with partial results', async () => {
    const jobDescription = `
      Join Acme Corporation!
      We need a talented engineer but the title isn't specified.
    `;

    const result = await extractJobInfo(jobDescription);

    expect(result.company).toBe('Acme Corporation');
    expect(result.role).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test src/backend/services/__tests__/job-extraction.service.test.ts
```

Expected: FAIL with "extractJobInfo is not exported"

- [ ] **Step 3: Write the extraction service**

Create `src/backend/services/job-extraction.service.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export interface ExtractedJobInfo {
  company: string | null;
  role: string | null;
  confidence: number;
}

export async function extractJobInfo(jobDescription: string): Promise<ExtractedJobInfo> {
  const prompt = `Extract the company name and job title from the following job description. 
Return a JSON object with "company", "role", and "confidence" (0-1).
If you cannot extract a field with reasonable confidence, set it to null.

Job Description:
${jobDescription}

Respond with only valid JSON, no other text.`;

  const message = await client.messages.create({
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 150,
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ]
  });

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
  
  try {
    const parsed = JSON.parse(responseText);
    return {
      company: parsed.company || null,
      role: parsed.role || null,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5
    };
  } catch {
    // If parsing fails, return nulls
    return {
      company: null,
      role: null,
      confidence: 0
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test src/backend/services/__tests__/job-extraction.service.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/backend/services/job-extraction.service.ts
git add src/backend/services/__tests__/job-extraction.service.test.ts
git commit -m "feat: add job extraction service using Claude Haiku"
```

---

### Task 2: Create Extraction API Endpoint

**Files:**
- Modify: `src/backend/routes/knowledge.routes.ts`

- [ ] **Step 1: Add extraction endpoint route**

In `src/backend/routes/knowledge.routes.ts`, add this endpoint before the final export:

```typescript
import { extractJobInfo } from '../services/job-extraction.service';

// In the router setup, add:
router.post('/api/jobs/extract', async (req, res) => {
  try {
    const { jobDescription } = req.body;

    if (!jobDescription || typeof jobDescription !== 'string') {
      return res.status(400).json({ error: 'jobDescription is required and must be a string' });
    }

    const extracted = await extractJobInfo(jobDescription);
    res.json(extracted);
  } catch (error) {
    console.error('Job extraction error:', error);
    res.status(500).json({ error: 'Failed to extract job information' });
  }
});
```

- [ ] **Step 2: Test the endpoint manually**

Start the backend: `npm run start`

In another terminal, test the endpoint:

```bash
curl -X POST http://localhost:3000/api/jobs/extract \
  -H "Content-Type: application/json" \
  -d '{
    "jobDescription": "Senior Software Engineer at Acme Corporation. We are seeking a talented engineer with 5+ years experience."
  }'
```

Expected response:
```json
{
  "company": "Acme Corporation",
  "role": "Senior Software Engineer",
  "confidence": 0.95
}
```

- [ ] **Step 3: Commit**

```bash
git add src/backend/routes/knowledge.routes.ts
git commit -m "feat: add POST /api/jobs/extract endpoint for job parsing"
```

---

## Phase 2: Session Creation UI with Extraction

### Task 3: Create Session Warning Dialog Component

**Files:**
- Create: `src/renderer/components/SessionWarningDialog.tsx`

- [ ] **Step 1: Write component test**

Create `src/renderer/components/__tests__/SessionWarningDialog.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SessionWarningDialog from '../SessionWarningDialog';

describe('SessionWarningDialog', () => {
  it('should render with empty extraction results', () => {
    const mockOnConfirm = vi.fn();
    const mockOnCancel = vi.fn();

    render(
      <SessionWarningDialog
        isOpen={true}
        extracted={{ company: null, role: null, confidence: 0 }}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText(/Company and job title could not be extracted/i)).toBeInTheDocument();
  });

  it('should allow user to enter company and role', () => {
    const mockOnConfirm = vi.fn();
    const mockOnCancel = vi.fn();

    render(
      <SessionWarningDialog
        isOpen={true}
        extracted={{ company: null, role: null, confidence: 0 }}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    const companyInput = screen.getByPlaceholderText(/company/i);
    const roleInput = screen.getByPlaceholderText(/job title/i);
    const confirmButton = screen.getByText(/Confirm/i);

    fireEvent.change(companyInput, { target: { value: 'Acme Corp' } });
    fireEvent.change(roleInput, { target: { value: 'Senior Engineer' } });
    fireEvent.click(confirmButton);

    expect(mockOnConfirm).toHaveBeenCalledWith({
      company: 'Acme Corp',
      role: 'Senior Engineer'
    });
  });

  it('should pre-fill extracted values if available', () => {
    const mockOnConfirm = vi.fn();
    const mockOnCancel = vi.fn();

    render(
      <SessionWarningDialog
        isOpen={true}
        extracted={{ company: 'Acme Corp', role: null, confidence: 0.8 }}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    const companyInput = screen.getByPlaceholderText(/company/i) as HTMLInputElement;
    expect(companyInput.value).toBe('Acme Corp');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test src/renderer/components/__tests__/SessionWarningDialog.test.ts
```

Expected: FAIL (component doesn't exist)

- [ ] **Step 3: Create the component**

Create `src/renderer/components/SessionWarningDialog.tsx`:

```tsx
import React, { useState } from 'react';
import styles from './SessionWarningDialog.module.css';

interface ExtractedInfo {
  company: string | null;
  role: string | null;
  confidence: number;
}

interface Props {
  isOpen: boolean;
  extracted: ExtractedInfo;
  onConfirm: (data: { company: string; role: string }) => void;
  onCancel: () => void;
}

export default function SessionWarningDialog({ isOpen, extracted, onConfirm, onCancel }: Props) {
  const [company, setCompany] = useState(extracted.company || '');
  const [role, setRole] = useState(extracted.role || '');

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (company.trim() && role.trim()) {
      onConfirm({ company: company.trim(), role: role.trim() });
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.dialog}>
        <h2>Complete Session Details</h2>
        <p>Company and job title could not be extracted from the job description. Please enter them manually:</p>
        
        <input
          type="text"
          placeholder="Company name (e.g., Acme Corporation)"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          className={styles.input}
        />
        
        <input
          type="text"
          placeholder="Job title (e.g., Senior Software Engineer)"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className={styles.input}
        />
        
        <div className={styles.buttons}>
          <button onClick={onCancel} className={styles.cancelBtn}>Cancel</button>
          <button 
            onClick={handleConfirm} 
            disabled={!company.trim() || !role.trim()}
            className={styles.confirmBtn}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
```

Create `src/renderer/components/SessionWarningDialog.module.css`:

```css
.overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: #2a2a2a;
  border-radius: 8px;
  padding: 24px;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  color: #f0f0f0;
}

.dialog h2 {
  margin-top: 0;
  margin-bottom: 12px;
  font-size: 18px;
}

.dialog p {
  margin-bottom: 16px;
  color: #c0c0c0;
  font-size: 14px;
}

.input {
  width: 100%;
  padding: 10px;
  margin-bottom: 12px;
  background: #1a1a1a;
  border: 1px solid #444;
  border-radius: 4px;
  color: #f0f0f0;
  font-size: 14px;
  box-sizing: border-box;
}

.input:focus {
  outline: none;
  border-color: #0066ff;
}

.buttons {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.cancelBtn,
.confirmBtn {
  padding: 8px 16px;
  border-radius: 4px;
  border: none;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.cancelBtn {
  background: #444;
  color: #f0f0f0;
}

.cancelBtn:hover {
  background: #555;
}

.confirmBtn {
  background: #0066ff;
  color: white;
}

.confirmBtn:hover:not(:disabled) {
  background: #0052cc;
}

.confirmBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test src/renderer/components/__tests__/SessionWarningDialog.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/SessionWarningDialog.tsx
git add src/renderer/components/SessionWarningDialog.module.css
git add src/renderer/components/__tests__/SessionWarningDialog.test.ts
git commit -m "feat: add session warning dialog for manual entry fallback"
```

---

### Task 4: Create Session Dropdown Component

**Files:**
- Create: `src/renderer/components/SessionDropdown.tsx`

- [ ] **Step 1: Write component test**

Create `src/renderer/components/__tests__/SessionDropdown.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SessionDropdown from '../SessionDropdown';

describe('SessionDropdown', () => {
  it('should render current session name', () => {
    render(
      <SessionDropdown
        sessions={[
          { id: '1', company: 'Acme Corp', title: 'Senior Engineer', added_at: new Date() }
        ]}
        activeSessionId="1"
        onSelectSession={vi.fn()}
      />
    );

    expect(screen.getByText(/Acme Corp/i)).toBeInTheDocument();
  });

  it('should show all sessions when dropdown opened', () => {
    const sessions = [
      { id: '1', company: 'Acme Corp', title: 'Senior Engineer', added_at: new Date() },
      { id: '2', company: 'TechCorp', title: 'Manager', added_at: new Date() }
    ];

    render(
      <SessionDropdown
        sessions={sessions}
        activeSessionId="1"
        onSelectSession={vi.fn()}
      />
    );

    const dropdownButton = screen.getByRole('button');
    fireEvent.click(dropdownButton);

    expect(screen.getByText(/Senior Engineer at Acme Corp/i)).toBeInTheDocument();
    expect(screen.getByText(/Manager at TechCorp/i)).toBeInTheDocument();
  });

  it('should call onSelectSession when item clicked', () => {
    const mockOnSelect = vi.fn();
    const sessions = [
      { id: '1', company: 'Acme Corp', title: 'Senior Engineer', added_at: new Date() },
      { id: '2', company: 'TechCorp', title: 'Manager', added_at: new Date() }
    ];

    render(
      <SessionDropdown
        sessions={sessions}
        activeSessionId="1"
        onSelectSession={mockOnSelect}
      />
    );

    const dropdownButton = screen.getByRole('button');
    fireEvent.click(dropdownButton);

    const techcorpItem = screen.getByText(/Manager at TechCorp/i);
    fireEvent.click(techcorpItem);

    expect(mockOnSelect).toHaveBeenCalledWith('2');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test src/renderer/components/__tests__/SessionDropdown.test.ts
```

Expected: FAIL (component doesn't exist)

- [ ] **Step 3: Create the component**

Create `src/renderer/components/SessionDropdown.tsx`:

```tsx
import React, { useState } from 'react';
import styles from './SessionDropdown.module.css';

interface Session {
  id: string;
  company: string;
  title: string;
  added_at: Date;
}

interface Props {
  sessions: Session[];
  activeSessionId: string;
  onSelectSession: (sessionId: string) => void;
}

export default function SessionDropdown({ sessions, activeSessionId, onSelectSession }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const activeSession = sessions.find(s => s.id === activeSessionId);

  const handleSelectSession = (sessionId: string) => {
    onSelectSession(sessionId);
    setIsOpen(false);
  };

  return (
    <div className={styles.container}>
      <button className={styles.button} onClick={() => setIsOpen(!isOpen)}>
        <span>{activeSession ? activeSession.company : 'Select Session'}</span>
        <span className={styles.arrow}>▼</span>
      </button>

      {isOpen && (
        <div className={styles.menu}>
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`${styles.item} ${session.id === activeSessionId ? styles.active : ''}`}
              onClick={() => handleSelectSession(session.id)}
            >
              <div className={styles.itemTitle}>
                {session.title} at {session.company}
              </div>
              <div className={styles.itemDate}>
                {new Date(session.added_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

Create `src/renderer/components/SessionDropdown.module.css`:

```css
.container {
  position: relative;
  display: inline-block;
}

.button {
  background: #333;
  color: #f0f0f0;
  border: 1px solid #555;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  transition: background 0.2s;
}

.button:hover {
  background: #444;
}

.arrow {
  font-size: 12px;
  transition: transform 0.2s;
}

.button:hover .arrow {
  transform: translateY(2px);
}

.menu {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: #2a2a2a;
  border: 1px solid #555;
  border-top: none;
  border-radius: 0 0 4px 4px;
  max-height: 300px;
  overflow-y: auto;
  z-index: 100;
}

.item {
  padding: 12px 16px;
  cursor: pointer;
  border-bottom: 1px solid #444;
  transition: background 0.2s;
}

.item:last-child {
  border-bottom: none;
}

.item:hover {
  background: #3a3a3a;
}

.item.active {
  background: #0066ff;
  color: white;
}

.itemTitle {
  font-weight: 500;
  margin-bottom: 4px;
}

.itemDate {
  font-size: 12px;
  opacity: 0.7;
}

.item.active .itemDate {
  opacity: 0.9;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test src/renderer/components/__tests__/SessionDropdown.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/SessionDropdown.tsx
git add src/renderer/components/SessionDropdown.module.css
git add src/renderer/components/__tests__/SessionDropdown.test.ts
git commit -m "feat: add session dropdown component"
```

---

### Task 5: Integrate Session Management into App.tsx

**Files:**
- Modify: `src/renderer/App.tsx`

- [ ] **Step 1: Add session state to App component**

In `src/renderer/App.tsx`, at the top of the component, add these imports:

```typescript
import SessionDropdown from './components/SessionDropdown';
import SessionWarningDialog from './components/SessionWarningDialog';
```

Add these state variables after other state declarations:

```typescript
const [sessions, setSessions] = useState<Array<{id: string; company: string; title: string; added_at: Date}>>([]);
const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
const [showWarningDialog, setShowWarningDialog] = useState(false);
const [extractedInfo, setExtractedInfo] = useState({ company: null, role: null, confidence: 0 });
const [isExtracting, setIsExtracting] = useState(false);
```

- [ ] **Step 2: Load sessions on mount**

Add this useEffect hook:

```typescript
useEffect(() => {
  const loadSessions = async () => {
    try {
      const response = await fetch('/api/jobs');
      const data = await response.json();
      setSessions(data);
      if (data.length > 0 && !activeSessionId) {
        setActiveSessionId(data[0].id);
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  };

  loadSessions();
}, []);
```

- [ ] **Step 3: Add extraction handler for job description**

Add this function to App:

```typescript
const handleExtractJobInfo = async (jobDescription: string) => {
  if (!jobDescription.trim()) return;

  setIsExtracting(true);
  try {
    const response = await fetch('/api/jobs/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobDescription })
    });

    const extracted = await response.json();
    setExtractedInfo(extracted);

    // If extraction is confident and complete, auto-create session
    if (extracted.confidence > 0.7 && extracted.company && extracted.role) {
      await createSessionFromExtraction(extracted.company, extracted.role);
    } else {
      // Show warning dialog for manual entry
      setShowWarningDialog(true);
    }
  } catch (error) {
    console.error('Extraction failed:', error);
    setShowWarningDialog(true);
  } finally {
    setIsExtracting(false);
  }
};
```

- [ ] **Step 4: Add session creation handler**

Add this function:

```typescript
const createSessionFromExtraction = async (company: string, role: string) => {
  try {
    const response = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company,
        title: role,
        description: jobDescription // Assume jobDescription is in state
      })
    });

    const newSession = await response.json();
    setSessions([...sessions, newSession]);
    setActiveSessionId(newSession.id);
    setShowWarningDialog(false);
  } catch (error) {
    console.error('Failed to create session:', error);
  }
};
```

- [ ] **Step 5: Add session switch handler**

Add this function:

```typescript
const handleSelectSession = async (sessionId: string) => {
  setActiveSessionId(sessionId);
  
  try {
    const response = await fetch(`/api/jobs/${sessionId}`);
    const session = await response.json();
    setJobDescription(session.description); // Load job description for this session
  } catch (error) {
    console.error('Failed to load session:', error);
  }
};
```

- [ ] **Step 6: Add components to render**

In the JSX return, add the dropdown before the main content:

```tsx
<div style={{ marginBottom: '16px' }}>
  <SessionDropdown
    sessions={sessions}
    activeSessionId={activeSessionId || ''}
    onSelectSession={handleSelectSession}
  />
</div>
```

And add the warning dialog:

```tsx
<SessionWarningDialog
  isOpen={showWarningDialog}
  extracted={extractedInfo}
  onConfirm={(data) => createSessionFromExtraction(data.company, data.role)}
  onCancel={() => setShowWarningDialog(false)}
/>
```

- [ ] **Step 7: Wire extraction to job description input**

Modify the job description textarea to call extraction on a "Create Session" button (or on blur after short delay):

```tsx
<button 
  onClick={() => handleExtractJobInfo(jobDescription)}
  disabled={isExtracting || !jobDescription.trim()}
>
  {isExtracting ? 'Extracting...' : 'Create Session'}
</button>
```

- [ ] **Step 8: Run the app and test**

```bash
npm run dev
```

- Paste a realistic job description
- Click "Create Session"
- Verify extraction and session creation works
- Switch between sessions in dropdown
- Verify context (job description, resumes) changes per session

- [ ] **Step 9: Commit**

```bash
git add src/renderer/App.tsx
git commit -m "feat: integrate session management and extraction into App"
```

---

## Phase 3: Session Persistence and Data Isolation

### Task 6: Ensure Session-Specific Data Loading

**Files:**
- Modify: `src/backend/routes/knowledge.routes.ts`

- [ ] **Step 1: Verify session-specific resume loading**

In `src/backend/routes/knowledge.routes.ts`, ensure the `GET /api/jobs/:id/resumes` endpoint filters by job_id:

```typescript
router.get('/api/jobs/:id/resumes', async (req, res) => {
  try {
    const jobId = req.params.id;
    const resumes = await db.query(
      'SELECT * FROM generated_materials WHERE job_id = ? ORDER BY generated_at DESC',
      [jobId]
    );
    res.json(resumes);
  } catch (error) {
    console.error('Failed to fetch resumes:', error);
    res.status(500).json({ error: 'Failed to fetch resumes' });
  }
});
```

- [ ] **Step 2: Verify conversation history is session-specific**

Ensure `GET /api/jobs/:id/conversations` filters by job_id:

```typescript
router.get('/api/jobs/:id/conversations', async (req, res) => {
  try {
    const jobId = req.params.id;
    const conversations = await db.query(
      'SELECT * FROM conversations WHERE job_id = ? ORDER BY message_at ASC',
      [jobId]
    );
    res.json(conversations);
  } catch (error) {
    console.error('Failed to fetch conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});
```

- [ ] **Step 3: Test session isolation manually**

- Create Session A (Acme Corp, Senior Engineer)
- Generate a resume for Session A
- Create Session B (TechCorp, Manager)
- Verify Session A's resume doesn't appear in Session B
- Switch back to Session A
- Verify the resume reappears

- [ ] **Step 4: Commit**

```bash
git add src/backend/routes/knowledge.routes.ts
git commit -m "docs: verify session-specific data isolation"
```

---

## Phase 4: Polish and Testing

### Task 7: Add End-to-End Session Test

**Files:**
- Create: `src/renderer/__tests__/sessions.e2e.test.ts`

- [ ] **Step 1: Write integration test**

Create `src/renderer/__tests__/sessions.e2e.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('Company Sessions E2E', () => {
  it('should create session from job description, verify isolation', async () => {
    // Step 1: Fetch initial sessions
    const sessionsResponse = await fetch('/api/jobs');
    const initialSessions = await sessionsResponse.json();
    const initialCount = initialSessions.length;

    // Step 2: Extract and create session A
    const jobDescA = `
      Senior Software Engineer at Acme Corporation
      Requirements: 5+ years TypeScript, React...
    `;

    const extractResponse = await fetch('/api/jobs/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobDescription: jobDescA })
    });
    const extracted = await extractResponse.json();

    expect(extracted.company).toBe('Acme Corporation');
    expect(extracted.role).toBe('Senior Software Engineer');

    // Step 3: Create session A
    const createAResponse = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company: extracted.company,
        title: extracted.role,
        description: jobDescA
      })
    });
    const sessionA = await createAResponse.json();

    expect(sessionA.company).toBe('Acme Corporation');

    // Step 4: Create session B
    const jobDescB = `Manager at TechCorp`;
    const extractResponseB = await fetch('/api/jobs/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobDescription: jobDescB })
    });
    const extractedB = await extractResponseB.json();

    const createBResponse = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company: extractedB.company,
        title: extractedB.role,
        description: jobDescB
      })
    });
    const sessionB = await createBResponse.json();

    // Step 5: Verify sessions are separate
    const allSessions = await fetch('/api/jobs').then(r => r.json());
    expect(allSessions.length).toBe(initialCount + 2);

    // Step 6: Verify session context isolation
    const getAResponse = await fetch(`/api/jobs/${sessionA.id}`);
    const loadedA = await getAResponse.json();
    expect(loadedA.description).toContain('Acme Corporation');

    const getBResponse = await fetch(`/api/jobs/${sessionB.id}`);
    const loadedB = await getBResponse.json();
    expect(loadedB.description).toContain('TechCorp');
  });
});
```

- [ ] **Step 2: Run test**

```bash
npm test src/renderer/__tests__/sessions.e2e.test.ts
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/renderer/__tests__/sessions.e2e.test.ts
git commit -m "test: add end-to-end session creation and isolation test"
```

---

### Task 8: Manual Testing & Polish

- [ ] **Step 1: Test complete workflow**

1. Open app: `npm run dev` + backend running
2. Paste realistic job description (copy from a job posting)
3. Click "Create Session"
4. Verify extraction accuracy
5. If extraction incomplete, fill in manually
6. Verify session created and appears in dropdown
7. Paste second job description (different company)
8. Create second session
9. Switch between sessions
10. Verify each session shows its own job description
11. Generate resume in one session, verify it doesn't appear in other

- [ ] **Step 2: Test extraction edge cases**

- Minimal job posting (just company name): Should handle gracefully
- Job posting without company name: Should show warning dialog
- Very long job description: Should extract efficiently
- Unusual company names (with special characters, acronyms): Should extract correctly

- [ ] **Step 3: Polish UI based on manual testing**

- Adjust button labels/positioning if unclear
- Ensure error messages are helpful
- Test on different screen sizes (responsive dropdown)

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "test: manual testing and UI polish for sessions"
```

---

## Summary

**Total tasks:** 8  
**Estimated time:** 4-6 hours (depending on testing depth)

**Key deliverables:**
- Job extraction service (Haiku-powered)
- Extraction API endpoint
- Session warning dialog for fallback
- Session dropdown component
- Full session management integrated into App
- Data isolation verification
- End-to-end tests
- Manual testing

**Database:** No migrations needed (reusing jobs table as sessions)

**Architecture decision:** Sessions are a UI/UX layer over the existing job model. No data model changes.

**Testing approach:** 
- Unit tests for extraction, components
- Integration test for end-to-end workflow
- Manual testing for UX and edge cases

**Rollout:** No breaking changes. Existing users can continue using the app; new session features are opt-in (via "Create Session" button or job description paste).
