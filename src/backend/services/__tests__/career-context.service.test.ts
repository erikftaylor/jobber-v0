import { describe, it, expect } from 'vitest';
import { CareerContextService } from '../career-context.service';

const service = new CareerContextService();

const docs = [
  { id: '1', type: 'resume', filename: 'cv.txt', raw_text: 'Jane Doe\nSenior Designer' },
  { id: '2', type: 'linkedin', filename: 'profile.txt', raw_text: 'Profile summary text' },
];

describe('CareerContextService', () => {
  it('builds the exact raw context string format used today', () => {
    const ctx = service.build(docs);

    expect(ctx.mode).toBe('raw-documents');
    expect(ctx.documentCount).toBe(2);
    expect(ctx.rawContextText).toBe(
      '[RESUME: cv.txt]\nJane Doe\nSenior Designer\n\n---\n\n[LINKEDIN: profile.txt]\nProfile summary text'
    );
  });

  it('matches the legacy inline assembly byte-for-byte', () => {
    // The exact expression that lived inside /generate before this refactor.
    const legacy = docs
      .map(d => `[${d.type.toUpperCase()}: ${d.filename}]\n${d.raw_text}`)
      .join('\n\n---\n\n');

    expect(service.build(docs).rawContextText).toBe(legacy);
  });

  it('maps raw_text onto content and preserves identifying fields', () => {
    const ctx = service.build(docs);

    expect(ctx.documents).toEqual([
      { id: '1', type: 'resume', filename: 'cv.txt', content: 'Jane Doe\nSenior Designer' },
      { id: '2', type: 'linkedin', filename: 'profile.txt', content: 'Profile summary text' },
    ]);
  });

  it('returns an empty context for no documents', () => {
    const ctx = service.build([]);

    expect(ctx.documentCount).toBe(0);
    expect(ctx.rawContextText).toBe('');
    expect(ctx.documents).toEqual([]);
  });
});
