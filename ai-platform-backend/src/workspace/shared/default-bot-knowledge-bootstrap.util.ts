import type { BotKnowledgeStats } from '../../models/bot-knowledge-stats.schema';

/** Defaults stored on newly created bots so KB overview/statistics pipelines start from a deterministic empty state. */
export function defaultBotKnowledgeTrainingEmbedded(): {
  autoTrainEnabled: boolean;
  trainingDelayMinutes: number;
  scheduleMode: 'smart';
} {
  return {
    autoTrainEnabled: false,
    trainingDelayMinutes: 5,
    scheduleMode: 'smart',
  };
}

export function defaultBotKnowledgeStatsEmbedded(): BotKnowledgeStats {
  const emptyBucket = (): BotKnowledgeStats['byType']['documents'] => ({
    items: 0,
    characters: 0,
    rows: 0,
  });
  return {
    totalCharacters: 0,
    totalItems: 0,
    readyCharacters: 0,
    pendingCharacters: 0,
    queuedCharacters: 0,
    processingCharacters: 0,
    failedCharacters: 0,
    uiOnlyCharacters: 0,
    readyItems: 0,
    pendingItems: 0,
    queuedItems: 0,
    processingItems: 0,
    failedItems: 0,
    uiOnlyItems: 0,
    byType: {
      documents: emptyBucket(),
      qna: emptyBucket(),
      snippets: emptyBucket(),
      datasheets: emptyBucket(),
      suggestions: emptyBucket(),
    },
    lastUpdatedAt: undefined,
    lastQueuedAt: undefined,
    lastTrainingStartedAt: undefined,
    lastTrainedAt: undefined,
  };
}

/** Full embedded defaults merged into bot create payloads (`BotsService.create` and seeded drafts). */
export function botKnowledgeBootstrapDefaults(): {
  knowledgeTraining: ReturnType<typeof defaultBotKnowledgeTrainingEmbedded>;
  knowledgeStats: BotKnowledgeStats;
} {
  return {
    knowledgeTraining: defaultBotKnowledgeTrainingEmbedded(),
    knowledgeStats: defaultBotKnowledgeStatsEmbedded(),
  };
}
