import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchSavedResumes, fetchSavedResume, formatSavedDate } from '../savedResumes';

const okJson = (body: unknown) => ({ ok: true, json: async () => body });
const errJson = (status: number, body: unknown) => ({ ok: false, status, json: async () => body });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchSavedResumes', () => {
  it('returns the materials array on success', async () => {
    const materials = [{ id: 'mat-1', type: 'resume', title: 'A', generated_content: 'x', formatted_html: null, created_at: 'z' }];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okJson({ success: true, materials })));

    await expect(fetchSavedResumes()).resolves.toEqual(materials);
  });

  it('returns an empty array when materials is absent', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okJson({ success: true })));

    await expect(fetchSavedResumes()).resolves.toEqual([]);
  });

  it('throws on a failed list request', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(errJson(500, {})));

    await expect(fetchSavedResumes()).rejects.toThrow(/failed to load/i);
  });
});

describe('fetchSavedResume', () => {
  it('returns the material on success', async () => {
    const material = { id: 'mat-1', type: 'resume', title: 'A', generated_content: 'x', formatted_html: '<html></html>', created_at: 'z' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okJson({ success: true, material })));

    await expect(fetchSavedResume('mat-1')).resolves.toEqual(material);
  });

  it('throws with the server error message on 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(errJson(404, { error: 'Material not found' })));

    await expect(fetchSavedResume('mat-missing')).rejects.toThrow('Material not found');
  });
});

describe('formatSavedDate', () => {
  it('formats a valid ISO date', () => {
    expect(formatSavedDate('2026-06-17T12:00:00.000Z')).not.toBe('2026-06-17T12:00:00.000Z');
    expect(formatSavedDate('2026-06-17T12:00:00.000Z').length).toBeGreaterThan(0);
  });

  it('falls back to the raw value when unparseable', () => {
    expect(formatSavedDate('not-a-date')).toBe('not-a-date');
  });
});
