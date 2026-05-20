import { chatLog } from './chat-logger';

export function isChatLatencyDebugEnabled(): boolean {
  return process.env.DEBUG_CHAT_LATENCY?.trim().toLowerCase() === 'true';
}

export type ChatLatencyRetrievalBreakdown = {
  queryEmbeddingMs: number;
  chunkAggregateMs: number;
  scoringMs: number;
  diversityDedupMs: number;
  evidenceBudgetMs?: number;
  answerabilityMs?: number;
  selectedChunksCount: number;
  candidateChunksCount: number;
  scoredChunksCount: number;
  queryEmbeddingCacheHit: boolean;
  retrievalResultCacheHit?: boolean;
  greetingFastPath?: boolean;
};

export type ChatLatencyCompletionBreakdown = {
  promptBuildMs: number;
  openaiCompletionMs: number;
  parseMs: number;
  completionSkipped: boolean;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

export type ChatLatencyPersistenceBreakdown = {
  saveUserMessageMs: number;
  saveAssistantMessageMs: number;
  usageLedgerMs: number;
};

export type ChatLatencyBreakdownPayload = {
  requestId: string;
  botId: string;
  conversationId: string;
  sessionSource: string;
  totalDurationMs: number;
  retrievalDurationMs: number;
  completionDurationMs: number;
  retrieval: ChatLatencyRetrievalBreakdown;
  completion: ChatLatencyCompletionBreakdown;
  persistence: ChatLatencyPersistenceBreakdown;
};

export function logChatLatencyBreakdown(payload: ChatLatencyBreakdownPayload): void {
  if (!isChatLatencyDebugEnabled()) return;
  chatLog({
    event: 'chat_latency_breakdown',
    level: 'info',
    botId: payload.botId,
    conversationId: payload.conversationId,
    requestId: payload.requestId,
    metadata: payload as unknown as Record<string, unknown>,
  });
}
