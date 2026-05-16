/**
 * UI buckets for GET `/knowledge/training/status` `dataSources` — aligned with
 * {@link mapSourceTypeToUiBucket} / overview “Data sources” (document+url+html → documents).
 */
export const AGENT_TRAINING_DATA_SOURCE_KEYS = [
  'documents',
  'qna',
  'snippets',
  'datasheets',
  'suggestions',
] as const;
export type AgentTrainingDataSourceKey = (typeof AGENT_TRAINING_DATA_SOURCE_KEYS)[number];

export type AgentTrainingDataSourceRow = {
  key: AgentTrainingDataSourceKey;
  /** Rows in lifecycle `pending` (needs training; not queued yet). */
  trainingRequired: number;
  /** Rows in lifecycle `queued` (including smart-delay / future `runAfter`). */
  trainingQueued: number;
  /** Rows in lifecycle `processing` (embedding in flight). */
  inTraining: number;
  /** Successfully embedded / `ready`. */
  trained: number;
  /** Subset of action-needed: `status === 'failed'` (for optional red badge). */
  failed: number;
  total: number;
};
