import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI, { APIConnectionError, APIError } from 'openai';
import { withTimeout, withRetry, AI_CALL_TIMEOUTS } from '../lib/ai-call.helper';

@Injectable()
export class RagService {
  constructor(private readonly config: ConfigService) {}

  /** Structured diagnostics when embeddings fail (no API keys or document text). */
  private logEmbeddingFailure(where: string, err: unknown, meta: Record<string, unknown>): void {
    const payload: Record<string, unknown> = { ...meta, where };
    if (err instanceof APIConnectionError) {
      payload.layer = 'connection';
    }
    if (err instanceof APIError) {
      payload.openaiErrorClass = err.constructor?.name ?? 'APIError';
      payload.httpStatus = err.status;
      payload.openaiCode = err.code;
      payload.openaiType = err.type;
      payload.requestId = err.request_id;
    }
    if (err instanceof Error) {
      payload.message = err.message;
      const c = (err as Error & { cause?: unknown }).cause;
      if (c != null) {
        payload.cause =
          c instanceof Error ? { name: c.name, message: c.message } : { detail: String(c) };
      }
    } else {
      payload.message = String(err);
    }
    console.error('[rag.embed]', payload);
  }

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
    try {
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
    } catch (err) {
      this.logEmbeddingFailure('embedText', err, {
        model: 'text-embedding-3-small',
        inputCount: 1,
        totalInputChars: trimmed.length,
        usingApiKeyOverride: Boolean((apiKeyOverride ?? '').trim()),
      });
      throw err;
    }
  }

  /**
   * Embed multiple texts in one API call. Much faster than calling embedText in a loop.
   * Batch size kept modest to stay under token limits (~8k tokens per input).
   */
  async embedTexts(texts: string[], apiKeyOverride?: string): Promise<number[][]> {
    const trimmed = texts.map((t) => t.trim()).filter((t) => t.length > 0);
    if (trimmed.length === 0) return [];
    const openai = this.getOpenAIClient(apiKeyOverride);
    try {
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
    } catch (err) {
      this.logEmbeddingFailure('embedTexts', err, {
        model: 'text-embedding-3-small',
        inputCount: trimmed.length,
        totalInputChars: trimmed.reduce((s, t) => s + t.length, 0),
        usingApiKeyOverride: Boolean((apiKeyOverride ?? '').trim()),
      });
      throw err;
    }
  }
}
