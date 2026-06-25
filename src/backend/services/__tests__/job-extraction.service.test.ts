import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Anthropic SDK before importing the service
vi.mock('@anthropic-ai/sdk', () => {
  const mockCreate = vi.fn();
  return {
    default: class MockAnthropic {
      messages = {
        create: mockCreate
      };
      static mockCreate = mockCreate;
    }
  };
});

import { extractJobInfo } from '../job-extraction.service';
import Anthropic from '@anthropic-ai/sdk';

describe('JobExtractionService', () => {
  beforeEach(() => {
    (Anthropic as any).mockCreate.mockClear();
  });

  it('should extract company and role from job description', async () => {
    (Anthropic as any).mockCreate.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            company: 'Acme Corporation',
            role: 'Senior Software Engineer',
            confidence: 0.95
          })
        }
      ]
    });

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
    (Anthropic as any).mockCreate.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            company: null,
            role: null,
            confidence: 0.2
          })
        }
      ]
    });

    const vague = 'We need someone to work on stuff.';
    const result = await extractJobInfo(vague);

    expect(result).toEqual({
      company: null,
      role: null,
      confidence: expect.any(Number)
    });
  });

  it('should handle extraction with partial results', async () => {
    (Anthropic as any).mockCreate.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            company: 'Acme Corporation',
            role: null,
            confidence: 0.8
          })
        }
      ]
    });

    const jobDescription = `
      Join Acme Corporation!
      We need a talented engineer but the title isn't specified.
    `;

    const result = await extractJobInfo(jobDescription);

    expect(result.company).toBe('Acme Corporation');
    expect(result.role).toBeNull();
  });
});
