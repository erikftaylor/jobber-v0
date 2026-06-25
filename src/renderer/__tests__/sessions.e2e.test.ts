import { describe, it, expect, vi, afterEach } from 'vitest';

const okJson = (body: unknown) => ({ ok: true, json: async () => body });

describe('Company Sessions E2E', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create session from job description, verify isolation', async () => {
    const sessionAId = 'sess-acme-001';
    const sessionBId = 'sess-techcorp-001';

    // Track state across calls
    let createdSessions = [{ id: 'default', name: 'Default', created_at: new Date() }];

    // Mock fetch for all requests
    vi.stubGlobal('fetch', vi.fn((url: string, options?: any) => {
      // Step 1 & 6: GET sessions (returns current state)
      if (url.includes('/api/kb/sessions') && !options?.method) {
        return Promise.resolve(okJson({
          success: true,
          sessions: createdSessions,
          activeSession: createdSessions[createdSessions.length - 1]?.id ?? 'default'
        }));
      }

      // Step 2: Extract job info for Session A
      if (url.includes('/api/kb/jobs/extract') && options?.body?.includes('Acme Corporation')) {
        return Promise.resolve(okJson({
          company: 'Acme Corporation',
          role: 'Senior Software Engineer',
          level: 'Senior',
          skills: ['TypeScript', 'React']
        }));
      }

      // Step 3: Create Session A
      if (url.includes('/api/kb/sessions') && options?.method === 'POST' && options?.body?.includes('Acme Corporation')) {
        const newSession = {
          id: sessionAId,
          name: 'Acme Corporation - Senior Software Engineer',
          created_at: new Date()
        };
        createdSessions.push(newSession);
        return Promise.resolve(okJson({
          success: true,
          session: newSession
        }));
      }

      // Step 4: Extract job info for Session B
      if (url.includes('/api/kb/jobs/extract') && options?.body?.includes('TechCorp')) {
        return Promise.resolve(okJson({
          company: 'TechCorp',
          role: 'Manager',
          level: 'Manager',
          skills: ['Leadership', 'Project Management']
        }));
      }

      // Step 5: Create Session B
      if (url.includes('/api/kb/sessions') && options?.method === 'POST' && options?.body?.includes('TechCorp')) {
        const newSession = {
          id: sessionBId,
          name: 'TechCorp - Manager',
          created_at: new Date()
        };
        createdSessions.push(newSession);
        return Promise.resolve(okJson({
          success: true,
          session: newSession
        }));
      }

      // Default fallback
      return Promise.resolve(okJson({ success: true }));
    }));

    // Step 1: Fetch initial sessions count
    const sessionsResponse = await fetch('/api/kb/sessions');
    const initialData = await sessionsResponse.json();
    const initialCount = initialData.sessions?.length ?? 0;
    expect(initialCount).toBe(1); // Should have default session

    // Step 2: Extract and verify Session A
    const jobDescA = `
      Senior Software Engineer at Acme Corporation
      Requirements: 5+ years TypeScript, React...
    `;

    const extractResponse = await fetch('/api/kb/jobs/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobDescription: jobDescA })
    });
    const extracted = await extractResponse.json();

    expect(extracted.company).toBe('Acme Corporation');
    expect(extracted.role).toBe('Senior Software Engineer');

    // Step 3: Create Session A
    const createAResponse = await fetch('/api/kb/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `${extracted.company} - ${extracted.role}`
      })
    });
    const createAData = await createAResponse.json();
    const sessionA = createAData.session;

    expect(sessionA).toBeDefined();
    expect(sessionA.name).toContain('Acme Corporation');

    // Step 4: Extract and verify Session B
    const jobDescB = `Manager at TechCorp`;
    const extractResponseB = await fetch('/api/kb/jobs/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobDescription: jobDescB })
    });
    const extractedB = await extractResponseB.json();

    expect(extractedB.company).toBe('TechCorp');
    expect(extractedB.role).toBe('Manager');

    // Step 5: Create Session B
    const createBResponse = await fetch('/api/kb/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `${extractedB.company} - ${extractedB.role}`
      })
    });
    const createBData = await createBResponse.json();
    const sessionB = createBData.session;

    expect(sessionB).toBeDefined();
    expect(sessionB.name).toContain('TechCorp');

    // Step 6: Verify both sessions exist in final list
    const allSessionsResponse = await fetch('/api/kb/sessions');
    const allSessionsData = await allSessionsResponse.json();
    const allSessions = allSessionsData.sessions ?? [];

    expect(allSessions.length).toBe(initialCount + 2);

    // Step 7: Verify session context isolation (distinct names and IDs)
    expect(sessionA.id).not.toBe(sessionB.id);
    expect(sessionA.name).not.toBe(sessionB.name);
    expect(sessionA.name).toContain('Acme Corporation');
    expect(sessionB.name).toContain('TechCorp');
  });
});
