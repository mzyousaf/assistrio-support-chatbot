export type WorkspaceUsageTrendDay = {
  date: string;
  totalCreditsUsed: number;
  monthlyCreditsUsed: number;
  topUpCreditsUsed: number;
};

export type WorkspaceAiCreditsByAgentRow = {
  botId: string;
  botName: string;
  totalCreditsUsed: number;
  monthlyCreditsUsed: number;
  topUpCreditsUsed: number;
  messageCount: number;
};

export type WorkspaceTrainedKnowledgeByAgentRow = {
  botId: string;
  botName: string;
  usedMb: number;
  maxMb: number;
  percentUsed: number;
};

export type WorkspaceUsageAnalyticsResponse = {
  dateRange: { startDate: string; endDate: string };
  usageTrend: WorkspaceUsageTrendDay[];
  aiCreditsByAgent: WorkspaceAiCreditsByAgentRow[];
  trainedKnowledgeByAgent: WorkspaceTrainedKnowledgeByAgentRow[];
};

export type ParsedWorkspaceUsageAnalyticsQuery = {
  startDate: string;
  endDate: string;
  botIds: string[];
};
