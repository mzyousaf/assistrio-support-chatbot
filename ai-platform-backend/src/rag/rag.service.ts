import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import OpenAI from 'openai';
import { Chunk } from '../models';

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

@Injectable()
export class RagService {
  constructor(
    private readonly config: ConfigService,
    @InjectModel(Chunk.name) private readonly chunkModel: Model<Chunk>,
  ) {}

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
    const res = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: trimmed,
    });
    return res.data[0].embedding;
  }

  async getRelevantChunksForBot(
    botId: string,
    query: string,
    limit = 4,
    apiKeyOverride?: string,
  ): Promise<Array<{ _id: unknown; documentId: unknown; text: string; embedding: number[] }>> {
    const queryEmbedding = await this.embedText(query, apiKeyOverride);
    if (!queryEmbedding.length) return [];

    const chunks = await this.chunkModel
      .find({ botId })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    const scored = chunks.map((chunk) => ({
      chunk: chunk as { _id: unknown; documentId: unknown; text: string; embedding: number[] },
      score: cosineSimilarity(queryEmbedding, (chunk as { embedding: number[] }).embedding),
    }));

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, limit).map((s) => s.chunk);
  }

  async getRelevantChunks(
    botId: string,
    query: string,
    limit = 4,
    apiKeyOverride?: string,
  ): Promise<Array<{ _id: unknown; documentId: unknown; text: string; embedding: number[] }>> {
    return this.getRelevantChunksForBot(botId, query, limit, apiKeyOverride);
  }
}
