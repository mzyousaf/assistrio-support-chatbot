import type {
  AdminAgentTrainingStatusResponse,
  AdminKnowledgeOverviewResponse,
} from '@/api/types';

/** Matches GET `/knowledge/training/status` `dataSources[].key` and bot `knowledgeStats.byType`. */
export type KnowledgeSourceBucket =
  | 'documents'
  | 'snippets'
  | 'qna'
  | 'datasheets'
  | 'suggestions';

export type KnowledgeSourceDisplayRow = { bucket: KnowledgeSourceBucket; label: string; bytesApprox: number };

/** `knowledge/<segment>` route segment for each KB bucket. */
export function playgroundSegmentForKnowledgeBucket(bucket: KnowledgeSourceBucket): string {
  switch (bucket) {
    case 'documents':
      return 'documents';
    case 'snippets':
      return 'notes';
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
  overview: AdminKnowledgeOverviewResponse | null | undefined,
  agentTs: AdminAgentTrainingStatusResponse | null | undefined,
): boolean {
  if (agentTs != null) {
    return (agentTs.counts.pending ?? 0) + (agentTs.counts.queued ?? 0) >= 1;
  }
  const s = overview?.knowledgeStats;
  if (!s) return false;
  return (s.pendingItems ?? 0) + (s.queuedItems ?? 0) >= 1;
}

export function primaryAgentTrainButtonLabel(
  overview: AdminKnowledgeOverviewResponse | null | undefined,
): 'Train Bot' | 'Retrain Bot' {
  const ready = overview?.knowledgeStats?.readyCharacters ?? 0;
  return ready > 0 ? 'Retrain Bot' : 'Train Bot';
}

export function primaryAgentTrainButtonLabelSentence(
  overview: AdminKnowledgeOverviewResponse | null | undefined,
): 'Train bot' | 'Retrain bot' {
  const ready = overview?.knowledgeStats?.readyCharacters ?? 0;
  return ready > 0 ? 'Retrain bot' : 'Train bot';
}

export function kbTrainingPipelineItemsFromOverview(
  o: AdminKnowledgeOverviewResponse | null | undefined,
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

export function knowledgeSourceRowsFromOverview(o: AdminKnowledgeOverviewResponse): KnowledgeSourceDisplayRow[] {
  const bt = o.knowledgeStats?.byType;
  if (!bt) {
    return [
      { bucket: 'documents', label: '0 Files', bytesApprox: 0 },
      { bucket: 'snippets', label: '0 Text snippets', bytesApprox: 0 },
      { bucket: 'qna', label: '0 Q&A', bytesApprox: 0 },
      { bucket: 'datasheets', label: '0 Datasheets', bytesApprox: 0 },
      { bucket: 'suggestions', label: '0 Suggestions', bytesApprox: 0 },
    ];
  }
  const qa = bt.qna?.items ?? 0;
  return [
    {
      bucket: 'documents',
      label: `${bt.documents?.items ?? 0} ${(bt.documents?.items ?? 0) === 1 ? 'File' : 'Files'}`,
      bytesApprox: bt.documents?.characters ?? 0,
    },
    {
      bucket: 'snippets',
      label: `${bt.snippets?.items ?? 0} ${(bt.snippets?.items ?? 0) === 1 ? 'Text snippet' : 'Text snippets'}`,
      bytesApprox: bt.snippets?.characters ?? 0,
    },
    {
      bucket: 'qna',
      label: `${qa} Q&A`,
      bytesApprox: bt.qna?.characters ?? 0,
    },
    {
      bucket: 'datasheets',
      label: `${bt.datasheets?.items ?? 0} ${(bt.datasheets?.items ?? 0) === 1 ? 'Datasheet' : 'Datasheets'}`,
      bytesApprox: bt.datasheets?.characters ?? 0,
    },
    {
      bucket: 'suggestions',
      label: `${bt.suggestions?.items ?? 0} ${(bt.suggestions?.items ?? 0) === 1 ? 'Suggestion' : 'Suggestions'}`,
      bytesApprox: bt.suggestions?.characters ?? 0,
    },
  ];
}
