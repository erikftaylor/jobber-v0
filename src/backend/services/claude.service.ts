import Anthropic from '@anthropic-ai/sdk';

export interface ClaudeResponse {
  content: string;
  stopReason: string;
}

export class ClaudeService {
  private client: Anthropic;

  constructor(apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
    });
  }

  async call(prompt: string, systemPrompt?: string): Promise<ClaudeResponse> {
    const response = await this.client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 2000,
      ...(systemPrompt && { system: systemPrompt }),
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const textContent = response.content.find(block => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text in Claude response');
    }

    return {
      content: textContent.text,
      stopReason: response.stop_reason || 'unknown',
    };
  }
}

export const claude = new ClaudeService();
