import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { withTimeout, withRetry, AI_CALL_TIMEOUTS } from '../lib/ai-call.helper';

@Injectable()
export class RagService {
  constructor(private readonly config: ConfigService) {}

  private getOpenAIClient(apiKeyOverride?: string): OpenAI {
    const apiKey = (apiKeyOverride || this.config.get<string>('openaiApiKey') || '').trim();
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set');
    }
    return new OpenAI({ apiKey });
  }

  async embedText(text: string, apiKeyOverride?: string): Promise<number[]> {
    const trimmed = text.trim();
    if (!trimmed) return [];
    const openai = this.getOpenAIClient(apiKeyOverride);
    const res = await withRetry(
      () =>
        withTimeout(
          openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: trimmed,
          }),
          AI_CALL_TIMEOUTS.embedding,
          'embedding',
        ),
      { maxRetries: 1 },
    );
    return res.data[0].embedding;
  }

  /**
   * Embed multiple texts in one API call. Much faster than calling embedText in a loop.
   * Batch size kept modest to stay under token limits (~8k tokens per input).
   */
  async embedTexts(texts: string[], apiKeyOverride?: string): Promise<number[][]> {
    const trimmed = texts.map((t) => t.trim()).filter((t) => t.length > 0);
    if (trimmed.length === 0) return [];
    const openai = this.getOpenAIClient(apiKeyOverride);
    const res = await withRetry(
      () =>
        withTimeout(
          openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: trimmed,
          }),
          AI_CALL_TIMEOUTS.embedding,
          'embedding_batch',
        ),
      { maxRetries: 1 },
    );
    const byIndex = new Map<number, number[]>();
    for (const item of res.data) {
      if (item.index != null && item.embedding) {
        byIndex.set(item.index, item.embedding);
      }
    }
    return trimmed.map((_, i) => byIndex.get(i) ?? []);
  }
}
