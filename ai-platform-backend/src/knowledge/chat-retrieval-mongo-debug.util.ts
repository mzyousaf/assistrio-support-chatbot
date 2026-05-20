import { chatLog } from '../chat/chat-logger';

export function isChatRetrievalMongoDebugEnabled(): boolean {
  return process.env.DEBUG_CHAT_RETRIEVAL_MONGO?.trim().toLowerCase() === 'true';
}

export type ChatRetrievalMongoDebugPayload = {
  botId: string;
  collection: string;
  candidateChunkCount: number;
  aggregateDurationMs: number;
  usedSetWindowFields: boolean;
  aggregateStrategy: 'window_fields' | 'simple_find';
  botIdFilterPresent: boolean;
  eligibleItemCount: number;
  perItemCap: number;
  /** Expected compound index for match + sort (see KnowledgeBaseChunk schema). */
  indexHint?: string;
};

export function logChatRetrievalMongoDebug(payload: ChatRetrievalMongoDebugPayload): void {
  if (!isChatRetrievalMongoDebugEnabled()) return;
  chatLog({
    event: 'chat_retrieval_mongo_debug',
    level: 'info',
    botId: payload.botId,
    metadata: payload as unknown as Record<string, unknown>,
  });
}
