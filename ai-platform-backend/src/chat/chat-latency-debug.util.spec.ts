import { chatLog } from './chat-logger';
import { isChatLatencyDebugEnabled, logChatLatencyBreakdown } from './chat-latency-debug.util';

jest.mock('./chat-logger', () => ({
  chatLog: jest.fn(),
}));

describe('chat-latency-debug', () => {
  const prev = process.env.DEBUG_CHAT_LATENCY;

  afterEach(() => {
    process.env.DEBUG_CHAT_LATENCY = prev;
    jest.clearAllMocks();
  });

  it('is disabled by default', () => {
    delete process.env.DEBUG_CHAT_LATENCY;
    expect(isChatLatencyDebugEnabled()).toBe(false);
  });

  it('logs structured breakdown without prompt content', () => {
    process.env.DEBUG_CHAT_LATENCY = 'true';
    logChatLatencyBreakdown({
      requestId: 'r1',
      botId: 'b1',
      conversationId: 'c1',
      sessionSource: 'widget_preview',
      totalDurationMs: 9000,
      retrievalDurationMs: 4000,
      completionDurationMs: 4500,
      retrieval: {
        queryEmbeddingMs: 1200,
        chunkAggregateMs: 800,
        scoringMs: 300,
        diversityDedupMs: 50,
        evidenceBudgetMs: 10,
        answerabilityMs: 2,
        selectedChunksCount: 8,
        candidateChunksCount: 120,
        scoredChunksCount: 120,
        queryEmbeddingCacheHit: true,
        greetingFastPath: false,
      },
      completion: {
        promptBuildMs: 5,
        openaiCompletionMs: 4200,
        parseMs: 12,
        completionSkipped: false,
        promptTokens: 100,
        completionTokens: 80,
        totalTokens: 180,
      },
      persistence: {
        saveUserMessageMs: 20,
        saveAssistantMessageMs: 15,
        usageLedgerMs: 8,
      },
    });
    expect(chatLog).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'chat_latency_breakdown',
        metadata: expect.objectContaining({
          totalDurationMs: 9000,
          retrieval: expect.objectContaining({ queryEmbeddingCacheHit: true }),
        }),
      }),
    );
    const payload = (chatLog as jest.Mock).mock.calls[0][0];
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain('systemPrompt');
    expect(serialized).not.toContain('userPrompt');
    expect(serialized).not.toContain('assistantMessage');
    expect(serialized).not.toContain('Tell me about');
  });
});
