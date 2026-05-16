import type {
  CustomerAgentTrainingStatusResponse,
  CustomerKnowledgeOverviewResponse,
} from '@/api/types';

/** Matches GET `/knowledge/training/status` `dataSources[].key` and bot `knowledgeStats.byType`. */
export type KnowledgeSourceBucket =
  | 'documents'
  | 'snippets'
  | 'qna'
  | 'datasheets'
  | 'suggestions';

export type KnowledgeSourceDisplayRow = { bucket: KnowledgeSourceBucket; label: string; bytesApprox: number };

/** `playground/knowledgebase/<segment>` route segment for each KB bucket. */
export function playgroundSegmentForKnowledgeBucket(bucket: KnowledgeSourceBucket): string {
  switch (bucket) {
    case 'documents':
      return 'documents';
    case 'snippets':
      return 'snippets';
    case 'qna':
      return 'faqs';
    case 'datasheets':
      return 'datasheets';
    case 'suggestions':
      return 'suggestions';
  }
}

/** At least one KB row is pending training or queued for embedding — required to enable Train / Retrain. */
export function hasKnowledgePendingOrQueuedForTrainAction(
  overview: CustomerKnowledgeOverviewResponse | null | undefined,
  agentTs: CustomerAgentTrainingStatusResponse | null | undefined,
): boolean {
  if (agentTs != null) {
    return (agentTs.counts.pending ?? 0) + (agentTs.counts.queued ?? 0) >= 1;
  }
  const s = overview?.knowledgeStats;
  if (!s) return false;
  return (s.pendingItems ?? 0) + (s.queuedItems ?? 0) >= 1;
}

/** “Train” when nothing embedded yet; “Retrain” after at least some ready (trained) knowledge exists. */
export function primaryAgentTrainButtonLabel(
  overview: CustomerKnowledgeOverviewResponse | null | undefined,
): 'Train Agent' | 'Retrain Agent' {
  const ready = overview?.knowledgeStats?.readyCharacters ?? 0;
  return ready > 0 ? 'Retrain Agent' : 'Train Agent';
}

/** Sidebar / compact actions use sentence case. */
export function primaryAgentTrainButtonLabelSentence(
  overview: CustomerKnowledgeOverviewResponse | null | undefined,
): 'Train agent' | 'Retrain agent' {
  const ready = overview?.knowledgeStats?.readyCharacters ?? 0;
  return ready > 0 ? 'Retrain agent' : 'Train agent';
}

/** Pending / failed / queued / processing KB items — when greater than zero, primary action is “Retrain”. */
export function kbTrainingPipelineItemsFromOverview(
  o: CustomerKnowledgeOverviewResponse | null | undefined,
): number {
  if (!o?.knowledgeStats) return 0;
  const s = o.knowledgeStats;
  return (
    (s.pendingItems ?? 0) +
    (s.failedItems ?? 0) +
    (s.queuedItems ?? 0) +
    (s.processingItems ?? 0)
  );
}

/** Rows for overview modal / Overview “Data sources” block. */
export function knowledgeSourceRowsFromOverview(o: CustomerKnowledgeOverviewResponse): KnowledgeSourceDisplayRow[] {
  const bt = o.knowledgeStats.byType;
  const qa = bt.qna.items;
  return [
    {
      bucket: 'documents',
      label: `${bt.documents.items} ${bt.documents.items === 1 ? 'File' : 'Files'}`,
      bytesApprox: bt.documents.characters,
    },
    {
      bucket: 'snippets',
      label: `${bt.snippets.items} ${bt.snippets.items === 1 ? 'Text snippet' : 'Text snippets'}`,
      bytesApprox: bt.snippets.characters,
    },
    {
      bucket: 'qna',
      label: `${qa} Q&A`,
      bytesApprox: bt.qna.characters,
    },
    {
      bucket: 'datasheets',
      label: `${bt.datasheets.items} ${bt.datasheets.items === 1 ? 'Datasheet' : 'Datasheets'}`,
      bytesApprox: bt.datasheets.characters,
    },
    {
      bucket: 'suggestions',
      label: `${bt.suggestions.items} ${bt.suggestions.items === 1 ? 'Suggestion' : 'Suggestions'}`,
      bytesApprox: bt.suggestions.characters,
    },
  ];
}
