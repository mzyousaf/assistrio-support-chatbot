/**
 * Single-pass agent training / lifecycle rollups aligned with per-row document reads
 * ({@link computeKbDocumentTrainingDisplay} + merged extract/train jobs).
 *
 * Replaces raw `KnowledgeBaseItem.status` for **documents** (post-extraction eligible rows)
 * with effective training status so GET `/knowledge/training/status` matches `GET …/knowledge/status` rows.
 */
import type { MergedDocumentPipelineJobRow } from './document-pipeline-merge-for-read.util';
import { computeKbDocumentTrainingDisplay } from './document-effective-training-status.util';
import { normalizeKnowledgeTrainingStatus } from './knowledge-training-status.util';
import type { KnowledgeBaseItemTrainingStatus } from '../models/knowledge-base-item.schema';
import {
  AGENT_TRAINING_DATA_SOURCE_KEYS,
  type AgentTrainingDataSourceKey,
  type AgentTrainingDataSourceRow,
} from './agent-training-data-source.types';

export type LeanKbRowForLifecycleBundle = {
  _id: { toString(): string };
  sourceType?: string;
  status?: string;
  runAfter?: Date | null;
  extractionStatus?: string;
  isContentExtracted?: boolean;
  extractionError?: string | null;
  trainingError?: string | null;
  tableMeta?: { importPhase?: string; importError?: string; importErrorCode?: string };
  characterCount?: number;
  updatedAt?: Date;
  lastTrainingStartedAt?: Date | null;
  lastQueuedAt?: Date | null;
  extractedAt?: Date | null;
};

export type CustomerTrainingLifecycleMetricsRollup = {
  actionableItems: number;
  actionableCharacters: number;
  dueQueuedItems: number;
  dueQueuedCharacters: number;
  processingItems: number;
  processingCharacters: number;
  trainingPipelineItems: number;
  trainingPipelineCharacters: number;
  failedItems: number;
  failedCharacters: number;
  readyItems: number;
  readyCharacters: number;
  totalTrackedItems: number;
  totalCharacters: number;
};

export type KbLifecycleSupplementCountsRollup = {
  extractingCount: number;
  extractionFailedCount: number;
  datasheetImportPipelineCount: number;
  trainingQueuedCount: number;
  trainingProcessingCount: number;
  trainingFailedCount: number;
  readyCount: number;
};

export type AgentTrainingLifecycleBundle = {
  lm: CustomerTrainingLifecycleMetricsRollup;
  lifecycleCounts: KbLifecycleSupplementCountsRollup;
  dataSources: AgentTrainingDataSourceRow[];
};

const EPOCH_MS = 0;

function planLimitKbBlocked(r: LeanKbRowForLifecycleBundle): boolean {
  return (
    r.trainingError === 'plan_limit_bot_kb_total' ||
    r.extractionError === 'plan_limit_bot_kb_total' ||
    r.tableMeta?.importError === 'plan_limit_bot_kb_total' ||
    r.tableMeta?.importErrorCode === 'plan_limit_bot_kb_total'
  );
}

function documentEligibleForKbTrainingBuckets(r: LeanKbRowForLifecycleBundle): boolean {
  if (r.sourceType !== 'document') return true;
  return r.extractionStatus === 'done' || r.isContentExtracted === true;
}

/** Mirrors {@link trainingLifecycleCountBaseClause}. */
function matchesTrainingLifecycleCountGate(r: LeanKbRowForLifecycleBundle): boolean {
  if (r.sourceType !== 'document') return true;
  if (r.extractionStatus === 'done') return true;
  return (
    r.isContentExtracted === true && (!r.extractionStatus || (r.extractionStatus as unknown) === null)
  );
}

function kbPipelineTouchMs(r: LeanKbRowForLifecycleBundle): number {
  const u = r.updatedAt instanceof Date && !isNaN(r.updatedAt.getTime()) ? r.updatedAt.getTime() : EPOCH_MS;
  const lts =
    r.lastTrainingStartedAt instanceof Date && !isNaN(r.lastTrainingStartedAt.getTime())
      ? r.lastTrainingStartedAt.getTime()
      : EPOCH_MS;
  const lq =
    r.lastQueuedAt instanceof Date && !isNaN(r.lastQueuedAt.getTime()) ? r.lastQueuedAt.getTime() : EPOCH_MS;
  const ex =
    r.extractedAt instanceof Date && !isNaN(r.extractedAt.getTime()) ? r.extractedAt.getTime() : EPOCH_MS;
  return Math.max(u, lts, lq, ex);
}

function kbPipelineFreshEnough(r: LeanKbRowForLifecycleBundle, pipelineTouchCutoff?: Date): boolean {
  if (pipelineTouchCutoff == null) return true;
  return kbPipelineTouchMs(r) >= pipelineTouchCutoff.getTime();
}

function trainingBucketKey(st?: string): AgentTrainingDataSourceKey {
  switch (st) {
    case 'document':
    case 'url':
    case 'html':
      return 'documents';
    case 'faq':
      return 'qna';
    case 'note':
      return 'snippets';
    case 'table':
      return 'datasheets';
    case 'suggestion':
      return 'suggestions';
    default:
      return 'documents';
  }
}

function emptyDataSources(): AgentTrainingDataSourceRow[] {
  const emptyRow = (key: AgentTrainingDataSourceKey): AgentTrainingDataSourceRow => ({
    key,
    trainingRequired: 0,
    trainingQueued: 0,
    inTraining: 0,
    trained: 0,
    failed: 0,
    total: 0,
  });
  return AGENT_TRAINING_DATA_SOURCE_KEYS.map((key) => emptyRow(key));
}

function resolveEffectiveTrainingStatus(
  r: LeanKbRowForLifecycleBundle,
  mergedIngestByKbId: Map<string, MergedDocumentPipelineJobRow>,
  embedByKbId: Map<string, number>,
): KnowledgeBaseItemTrainingStatus {
  const rawSt = normalizeKnowledgeTrainingStatus(String(r.status ?? ''));
  if (r.sourceType !== 'document') {
    return rawSt;
  }
  const id = String(r._id);
  const merged = mergedIngestByKbId.get(id);
  const embeddedChunkCount = embedByKbId.get(id) ?? 0;
  return computeKbDocumentTrainingDisplay({
    knowledgeItemStatus: rawSt,
    latestIngestJobStatus: merged?.status ?? null,
    embeddedChunkCount,
  });
}

/**
 * Rolls up metrics for one bot snapshot (all trainable rows already loaded; document job maps provided).
 */
export function rollupAgentTrainingLifecycleBundle(input: {
  rows: LeanKbRowForLifecycleBundle[];
  now: Date;
  pipelineTouchCutoff?: Date;
  mergedIngestByKbId: Map<string, MergedDocumentPipelineJobRow>;
  embedByKbId: Map<string, number>;
}): AgentTrainingLifecycleBundle {
  const { rows, now, pipelineTouchCutoff, mergedIngestByKbId, embedByKbId } = input;
  const lit = now.getTime();

  let actionableItems = 0;
  let actionableCharacters = 0;
  let dueQueuedItems = 0;
  let dueQueuedCharacters = 0;
  let processingItems = 0;
  let processingCharacters = 0;
  let trainingPipelineItems = 0;
  let trainingPipelineCharacters = 0;
  let failedItems = 0;
  let failedCharacters = 0;
  let readyItems = 0;
  let readyCharacters = 0;
  let totalCharacters = 0;

  let extractingCount = 0;
  let extractionFailedCount = 0;
  let datasheetImportPipelineCount = 0;
  let trainingQueuedCount = 0;
  let trainingProcessingCount = 0;
  let trainingFailedCount = 0;
  let readyCount = 0;

  const dsMap = new Map<AgentTrainingDataSourceKey, AgentTrainingDataSourceRow>();
  for (const key of AGENT_TRAINING_DATA_SOURCE_KEYS) {
    dsMap.set(key, {
      key,
      trainingRequired: 0,
      trainingQueued: 0,
      inTraining: 0,
      trained: 0,
      failed: 0,
      total: 0,
    });
  }

  for (const r of rows) {
    const ch = typeof r.characterCount === 'number' && Number.isFinite(r.characterCount) ? r.characterCount : 0;
    totalCharacters += ch;

    const planBlocked = planLimitKbBlocked(r);
    const eligible = documentEligibleForKbTrainingBuckets(r);
    const rawSt = normalizeKnowledgeTrainingStatus(String(r.status ?? ''));
    const eff = resolveEffectiveTrainingStatus(r, mergedIngestByKbId, embedByKbId);

    const extractionFailed = r.sourceType === 'document' && r.extractionStatus === 'failed';

    const runAfter = r.runAfter instanceof Date && !isNaN(r.runAfter.getTime()) ? r.runAfter : null;
    const runAfterFuture = runAfter != null && runAfter.getTime() > lit;

    const actionableTraining =
      eligible &&
      ((eff === 'pending' || eff === 'failed') || (eff === 'queued' && runAfterFuture));

    const actionableLifecycleOrExtractionFlag = actionableTraining || extractionFailed;

    let dueQueuedFlag = eligible && eff === 'queued' && !runAfterFuture;
    let processingFlag = eligible && eff === 'processing';

    const failedRawFlag = !planBlocked && eligible && eff === 'failed';

    const readyFlag =
      r.sourceType === 'document' && eligible ? eff === 'ready' : rawSt === 'ready';

    const fresh = kbPipelineFreshEnough(r, pipelineTouchCutoff);
    if (pipelineTouchCutoff != null) {
      dueQueuedFlag = dueQueuedFlag && fresh;
      processingFlag = processingFlag && fresh;
    }

    const actionableFlag = !planBlocked && actionableLifecycleOrExtractionFlag;

    const trainingPipelineFlag = dueQueuedFlag || processingFlag;

    const trainingPipelineItemsExpr = trainingPipelineFlag ? 1 : 0;
    const trainingPipelineCharsExpr = trainingPipelineFlag ? ch : 0;

    actionableItems += actionableFlag ? 1 : 0;
    actionableCharacters += actionableFlag ? ch : 0;
    dueQueuedItems += dueQueuedFlag ? 1 : 0;
    dueQueuedCharacters += dueQueuedFlag ? ch : 0;
    processingItems += processingFlag ? 1 : 0;
    processingCharacters += processingFlag ? ch : 0;
    trainingPipelineItems += trainingPipelineItemsExpr;
    trainingPipelineCharacters += trainingPipelineCharsExpr;
    failedItems += failedRawFlag ? 1 : 0;
    failedCharacters += failedRawFlag ? ch : 0;
    readyItems += readyFlag ? 1 : 0;
    readyCharacters += readyFlag ? ch : 0;

    /** Supplement — same filters as legacy Mongo helpers, but training queued/processing use effective status for documents. */
    if (r.sourceType === 'document') {
      if (r.extractionStatus === 'failed') {
        extractionFailedCount += 1;
      } else if (
        ['queued', 'processing', 'waiting_for_source'].includes(String(r.extractionStatus ?? '')) &&
        (pipelineTouchCutoff == null || fresh)
      ) {
        extractingCount += 1;
      }
    }
    if (
      r.sourceType === 'table' &&
      (r.tableMeta?.importPhase === 'import_queued' || r.tableMeta?.importPhase === 'importing') &&
      (pipelineTouchCutoff == null || fresh)
    ) {
      datasheetImportPipelineCount += 1;
    }

    const gateOk = matchesTrainingLifecycleCountGate(r) && !planBlocked;
    if (gateOk) {
      const tq = r.sourceType === 'document' ? eff === 'queued' : rawSt === 'queued';
      const tp = r.sourceType === 'document' ? eff === 'processing' : rawSt === 'processing';
      const tf = r.sourceType === 'document' ? eff === 'failed' : rawSt === 'failed';
      const tr = r.sourceType === 'document' ? eff === 'ready' : rawSt === 'ready';

      /** Matches legacy Mongo: queued/processing tallies use optional pipeline freshness; failed/ready do not. */
      const activeFresh = pipelineTouchCutoff == null || fresh;
      if (activeFresh) {
        if (tq) trainingQueuedCount += 1;
        if (tp) trainingProcessingCount += 1;
      }
      if (tf) trainingFailedCount += 1;
      if (tr) readyCount += 1;
    }

    const dataSourcePending = !planBlocked && eligible && eff === 'pending';
    const dataSourceQueued = !planBlocked && eligible && eff === 'queued';
    const dataSourceProcessing =
      !planBlocked && eligible && eff === 'processing' && (pipelineTouchCutoff == null || fresh);

    const bk = trainingBucketKey(r.sourceType);
    const d = dsMap.get(bk);
    if (d) {
      d.total += 1;
      if (dataSourcePending) d.trainingRequired += 1;
      if (dataSourceQueued) d.trainingQueued += 1;
      if (dataSourceProcessing) d.inTraining += 1;
      if (readyFlag) d.trained += 1;
      if (failedRawFlag) d.failed += 1;
    }
  }

  const totalTrackedItems = rows.length;

  return {
    lm: {
      actionableItems,
      actionableCharacters,
      dueQueuedItems,
      dueQueuedCharacters,
      processingItems,
      processingCharacters,
      trainingPipelineItems,
      trainingPipelineCharacters,
      failedItems,
      failedCharacters,
      readyItems,
      readyCharacters,
      totalTrackedItems,
      totalCharacters,
    },
    lifecycleCounts: {
      extractingCount,
      extractionFailedCount,
      datasheetImportPipelineCount,
      trainingQueuedCount,
      trainingProcessingCount,
      trainingFailedCount,
      readyCount,
    },
    dataSources: AGENT_TRAINING_DATA_SOURCE_KEYS.map((k) => dsMap.get(k)!),
  };
}

export function emptyAgentTrainingLifecycleBundle(): AgentTrainingLifecycleBundle {
  const zeroLm: CustomerTrainingLifecycleMetricsRollup = {
    actionableItems: 0,
    actionableCharacters: 0,
    dueQueuedItems: 0,
    dueQueuedCharacters: 0,
    processingItems: 0,
    processingCharacters: 0,
    trainingPipelineItems: 0,
    trainingPipelineCharacters: 0,
    failedItems: 0,
    failedCharacters: 0,
    readyItems: 0,
    readyCharacters: 0,
    totalTrackedItems: 0,
    totalCharacters: 0,
  };
  const zeroLc: KbLifecycleSupplementCountsRollup = {
    extractingCount: 0,
    extractionFailedCount: 0,
    datasheetImportPipelineCount: 0,
    trainingQueuedCount: 0,
    trainingProcessingCount: 0,
    trainingFailedCount: 0,
    readyCount: 0,
  };
  return { lm: zeroLm, lifecycleCounts: zeroLc, dataSources: emptyDataSources() };
}
