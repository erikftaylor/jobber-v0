import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ExtractedJobInfo {
  company: string | null;
  role: string | null;
  confidence: number;
}

export async function extractJobInfo(jobDescription: string): Promise<ExtractedJobInfo> {
  if (!jobDescription?.trim()) {
    return { company: null, role: null, confidence: 0 };
  }

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

  const responseText = message.content?.[0]?.type === 'text'
    ? message.content[0].text
    : '';

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
