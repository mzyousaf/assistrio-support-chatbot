import OpenAI from "openai";

import { connectToDatabase } from "@/lib/mongoose";
import { Chunk } from "@/models/Chunk";

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  return new OpenAI({ apiKey });
}

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

export async function embedText(text: string): Promise<number[]> {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const openai = getOpenAIClient();
  const res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: trimmed,
  });
  return res.data[0].embedding;
}

export async function getRelevantChunksForBot(botId: string, query: string, limit = 4) {
  await connectToDatabase();
  const queryEmbedding = await embedText(query);
  if (!queryEmbedding.length) return [];

  const chunks = await Chunk.find({ botId })
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  const scored = chunks.map((chunk) => ({
    chunk,
    score: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((s) => s.chunk);
}

export async function getRelevantChunks(botId: string, query: string, limit: number = 4) {
  return getRelevantChunksForBot(botId, query, limit);
}
