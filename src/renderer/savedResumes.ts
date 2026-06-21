/**
 * Saved-résumé data access for the frontend.
 *
 * Thin, framework-free wrappers over the Task 5 materials endpoints plus a small
 * date formatter. Kept out of App.tsx so the data/format logic is unit-testable
 * in the node test environment (no DOM required).
 */

import type { ResumeQualityReport } from '../shared/types';

export interface SavedResume {
  id: string;
  type: string;
  title: string;
  generated_content: string;
  formatted_html: string | null;
  quality_report?: ResumeQualityReport | null;
  created_at: string;
}

/** GET /api/materials -> list of saved résumés (newest first). */
export async function fetchSavedResumes(): Promise<SavedResume[]> {
  const response = await fetch('/api/materials');
  if (!response.ok) {
    throw new Error('Failed to load saved résumés');
  }
  const data = await response.json();
  return (data.materials ?? []) as SavedResume[];
}

/** GET /api/materials/:id -> a single saved résumé. */
export async function fetchSavedResume(id: string): Promise<SavedResume> {
  const response = await fetch(`/api/materials/${id}`);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to load saved résumé');
  }
  const data = await response.json();
  return data.material as SavedResume;
}

/** Human-readable created-at; falls back to the raw value if unparseable. */
export function formatSavedDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}
