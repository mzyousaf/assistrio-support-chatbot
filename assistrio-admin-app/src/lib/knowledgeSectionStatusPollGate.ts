import type { AdminAgentTrainingStatusResponse } from '@/api/types';
import type { KbTrainingAffectedType } from '@/lib/botSyncEvents';
import { KB_TRAINING_AFFECTED_ALL } from '@/lib/botSyncEvents';
import { trainingStatusIndicatesExtracting } from '@/lib/knowledgeTrainingStatus';

const SECTION_TO_DATA_SOURCE_KEY: Record<KbTrainingAffectedType, AdminAgentTrainingStatusResponse['dataSources'][number]['key']> =
  {
    document: 'documents',
    faq: 'qna',
    note: 'snippets',
    table: 'datasheets',
    suggestion: 'suggestions',
  };

/**
 * Whether typed `GET …/knowledge/status?type=…` should run for this section, from the latest
 * `GET …/knowledge/training/status` snapshot. Documents/datasheets also respect global extract/import flags.
 */
export function shouldPollKnowledgeSectionFromAgentTrainingStatus(
  ts: AdminAgentTrainingStatusResponse | null | undefined,
  section: KbTrainingAffectedType,
): boolean {
  if (ts == null) return false;
  const key = SECTION_TO_DATA_SOURCE_KEY[section];
  const row = ts.dataSources?.find((d) => d.key === key);
  const bucketBusy = (row?.trainingQueued ?? 0) > 0 || (row?.inTraining ?? 0) > 0;
  if (section === 'document') {
    const lc = ts.lifecycleCounts;
    const documentExtractOrUploadPipeline =
      trainingStatusIndicatesExtracting(ts) ||
      (lc?.extractingCount ?? 0) > 0 ||
      ts.displayPhase === 'extracting';
    return bucketBusy || documentExtractOrUploadPipeline;
  }
  if (section === 'table') {
    const lc = ts.lifecycleCounts;
    const datasheetImportPipeline =
      ts.isImporting === true ||
      (lc?.datasheetImportPipelineCount ?? 0) > 0 ||
      ts.displayPhase === 'importing';
    return bucketBusy || datasheetImportPipeline;
  }
  return bucketBusy;
}

/** True if any KB section gate wants polling (plus document/table global flags covered per section). */
export function shouldPollAnyKnowledgeSectionFromAgentTrainingStatus(
  ts: AdminAgentTrainingStatusResponse | null | undefined,
): boolean {
  if (ts == null) return false;
  return KB_TRAINING_AFFECTED_ALL.some((s) => shouldPollKnowledgeSectionFromAgentTrainingStatus(ts, s));
}
