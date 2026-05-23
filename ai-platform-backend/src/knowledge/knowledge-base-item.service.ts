import { forwardRef, HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Bot, ExtractJob, TrainJob, TableImportJob } from '../models';
import { KnowledgeBaseChunk } from '../models/knowledge-base-chunk.schema';
import {
  KnowledgeBaseItem,
  type KnowledgeBaseItemFaqMeta,
  type KnowledgeBaseItemTrainingStatus,
} from '../models/knowledge-base-item.schema';
import {
  EXAMPLE_QUESTIONS_STORAGE_MAX,
  parseExampleQuestionsFromDoc,
  exampleQuestionDocsToMongoArray,
  type ExampleQuestionDoc,
} from '../workspace/shared/example-questions.util';
import type { KnowledgeTrainingScope } from '../models/train-job.schema';
import { computeAutomaticItemRunAfter, getKnowledgeTrainingSettings } from './bot-knowledge-training-settings.util';
import type { KnowledgeBotUpsertOptions } from './knowledge-bot-upsert.options';
import type { KnowledgeSmartScheduleContext } from './knowledge-smart-schedule.util';
import { normalizeKnowledgeTrainingStatus } from './knowledge-training-status.util';
import {
  kbHasHadSuccessfulTrain,
  kbLastSuccessfulTrainInstant,
  kbTrainingFailureMessage,
} from './knowledge-base-item-canonical.util';
import {
  dedupeFaqKnowledgeItemsForOrderedRead,
  faqKnowledgeDuplicateIndexIds,
} from './knowledge-base-item-faq-dedupe.util';
import { coerceNoteSnippetIndex } from './knowledge-note-snippet-index.util';
import { isExtractManualRetrySuggested } from '../ingestion/extract-job-retry.policy.util';
import { isTrainingManualRetrySuggested, resolveTrainingFailureCode } from './knowledge-manual-retry-suggested.util';

/** API body shape for POST admin knowledge `training/train-now` (and retrain-agent via service). */
export type TrainNowKnowledgePayloadType =
  | 'faq'
  | 'note'
  | 'table'
  | 'document'
  | 'suggestion'
  | 'all';

export interface ApplyTrainNowInput {
  type: TrainNowKnowledgePayloadType;
  itemId?: string;
  forceRetrain?: boolean;
  /** Section train: pass false to only move pending/future queued — not failures. Overview omits / uses default true */
  includeFailed?: boolean;
}

/** KB sections touched by `applyTrainNow` (for POST retrain-agent `affectedTypes`). */
export type KnowledgeTrainNowAffectedKbType = 'document' | 'faq' | 'note' | 'table' | 'suggestion';

import { KnowledgeStatsService } from './knowledge-stats.service';
import { KnowledgeTrainingJobService } from './knowledge-training-job.service';
import {
  KnowledgeBaseItemAccessService,
  knowledgeItemExcludeDeletedOnlyClause,
  knowledgeItemNotDeletedClause,
} from './knowledge-base-item-access.service';
import { isScheduledRunDue, mergeTrainingScopes } from './merge-training-scopes.util';
import { actionableRetrainOrBranches } from './immediate-retrain-queue.util';
import { actionNeededItemDisplayStatus } from './customer-training-lifecycle.util';
import {
  knowledgeBaseItemEligibleForRuntimeRetrieval,
  knowledgeRuntimeRetrievalMatchParts,
} from './knowledge-runtime-retrieval-eligibility.util';
import {
  AGENT_TRAINING_DATA_SOURCE_KEYS,
  type AgentTrainingDataSourceKey,
  type AgentTrainingDataSourceRow,
} from './agent-training-data-source.types';
import {
  isTrainableExtractedDocumentText,
  metricsForDocumentContent,
  metricsForFaqRow,
  metricsForSnippetRow,
  metricsForSuggestionRow,
  metricsForTableRow,
} from './knowledge-text-metrics';
import { getCharacterCountForKbItemStats } from './knowledge-stats.service';
import {
  buildFaqEmbeddingText,
  buildNoteEmbeddingText,
  buildQaEmbeddingText,
  buildTableEmbeddingText,
  buildSuggestionEmbeddingText,
  computeEmbeddingInputHash,
} from './faq-note-embedding.helper';
import { tableImportDisplayStateFromKb, type TableImportDisplayState } from './table-import-display-state.util';
import { MAX_DATASHEET_IMPORT_BYTES } from '../documents/bot-document-upload.constants';
import {
  BOT_FIELD_MAX,
  clampStr,
  clampStrUtf8Bytes,
  KNOWLEDGE_ITEM_BODY_MAX_UTF8_BYTES,
} from '../workspace/shared/bot-field-limits';
import { assertTableKnowledgeFitsMongoPersistOrThrow } from '../workspace/datasheet-import.util';
import { assertDatasheetColumnsUnchangedIfLocked } from './datasheet-columns-locked.util';
import { computeKnowledgeContentHash, documentKbContentFingerprint, normalizeKbDocumentBodyForHash, normalizeKbDocumentTitleForRow } from './knowledge-content-hash.util';
import {
  KB_CONTENT_PATCH_TRAIN_GATE_IMMINENT_MS,
  kbContentPatchBlockedByTrainingGate,
} from './kb-content-patch-training-gate.util';
import {
  effectiveKbDocumentFileMetaLean,
  mergedDocumentKbFileMetaFromSync,
} from './knowledge-base-document-sync-fields.util';
import { initialDocumentKbExtractionStatus } from './knowledge-extraction-status.util';
import {
  deriveCustomerKbItemApiDisplayBundle,
  deriveKnowledgeBaseItemDisplayFields,
  finalizeCustomerKbItemApiDisplayBundle,
} from './knowledge-item-display-status.util';
import { computeKbDocumentTrainingDisplay } from './document-effective-training-status.util';
import {
  mergeDocumentPipelineJobsForCustomerRead,
  type DocumentPipelineJobMergeInput,
  type MergedDocumentPipelineJobRow,
} from './document-pipeline-merge-for-read.util';
import {
  INGESTION_STUCK_TIMEOUT_MINUTES,
  KNOWLEDGE_TRAINING_STUCK_TIMEOUT_MINUTES,
} from './knowledge-pipeline-retry.constants';
import { normalizeDocumentUploadStatus } from '../documents/document-upload-status.util';
import { KnowledgeBaseChunkService } from './knowledge-base-chunk.service';
import { kbTrainingLog } from './kb-training-log.util';
import {
  emptyAgentTrainingLifecycleBundle,
  rollupAgentTrainingLifecycleBundle,
  type AgentTrainingLifecycleBundle,
  type LeanKbRowForLifecycleBundle,
} from './agent-training-lifecycle-bundle.util';
import type { KnowledgeBaseSoftDeleteResult } from './knowledge-base-soft-delete.types';
import {
  BotKnowledgeTotalLimitService,
  knowledgeBaseItemRowIndicatesPlanLimitBotKbTotal,
  knowledgeItemNotBlockedByPlanLimitBotKbTotalMongoClause,
  PLAN_LIMIT_BOT_KB_TOTAL_CODE,
} from './bot-knowledge-total-limit.service';
import { KnowledgeOosReconcileService } from './knowledge-oos-reconcile.service';
import {
  incomingFaqSectionUtf8Bytes,
  incomingNoteSnippetSectionUtf8Bytes,
  incomingSuggestionSectionUtf8Bytes,
  incomingTableSectionUtf8Bytes,
} from './bot-knowledge-total-incoming.util';
import {
  calculateDocumentKnowledgeUsageBytes,
  calculateKnowledgeItemUsageBytes,
  calculateTableKnowledgeUsageBytes,
  type KnowledgeBaseItemUsageLean,
} from './knowledge-usage.util';
import { getUtf8ByteCount } from './knowledge-byte-size.util';

/** Document-shaped payload for {@link upsertDocumentKnowledgeItem} (upload + training fields). */
export interface DocumentLikeForSync {
  _id: Types.ObjectId;
  botId: Types.ObjectId;
  title: string;
  /** Training lifecycle (`KnowledgeBaseItem.status`) */
  trainingStatus?: string;
  /** @deprecated Prefer `trainingStatus` */
  status?: string;
  active?: boolean;
  text?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  url?: string;
  storage?: string;
  s3Bucket?: string;
  s3Key?: string;
  uploadSessionId?: string;
}

function contentHash(input: string): string {
  return computeKnowledgeContentHash(input);
}

@Injectable()
export class KnowledgeBaseItemService {
  constructor(
    @InjectModel(KnowledgeBaseItem.name) private readonly itemModel: Model<KnowledgeBaseItem>,
    @InjectModel(Bot.name) private readonly botModel: Model<Bot>,
    @InjectModel(KnowledgeBaseChunk.name) private readonly chunkModel: Model<KnowledgeBaseChunk>,
    @InjectModel(ExtractJob.name) private readonly extractJobModel: Model<ExtractJob>,
    @InjectModel(TrainJob.name) private readonly trainJobModel: Model<TrainJob>,
    @InjectModel(TableImportJob.name) private readonly tableImportJobModel: Model<TableImportJob>,
    private readonly knowledgeStatsService: KnowledgeStatsService,
    private readonly knowledgeTrainingJobService: KnowledgeTrainingJobService,
    private readonly knowledgeBaseItemAccess: KnowledgeBaseItemAccessService,
    private readonly botKbTotalLimit: BotKnowledgeTotalLimitService,
    @Inject(forwardRef(() => KnowledgeOosReconcileService))
    private readonly oosReconcile: KnowledgeOosReconcileService,
    private readonly knowledgeBaseChunkService: KnowledgeBaseChunkService,
  ) {}

  private async kickOosReconcile(botId: string, reason: string): Promise<void> {
    try {
      await this.oosReconcile.reconcileOutOfStorageItemsForBot(botId, reason);
    } catch (err) {
      kbTrainingLog('oos reconcile failed', {
        botId,
        reason,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private async refreshBotKnowledgeStats(botId: string): Promise<void> {
    await this.knowledgeStatsService.recalculateKnowledgeStatsForBot(botId);
  }

  /** Remove embeddings for KB items being removed so RAG/orphans never retain vectors. */
  private async deleteChunksForItemIds(ids: Types.ObjectId[]): Promise<void> {
    if (ids.length === 0) return;
    await this.chunkModel.deleteMany({ knowledgeBaseItemId: { $in: ids } });
  }

  /**
   * KB rows that are not yet soft-deleted (`deletedAt` unset/null).
   * Includes reply-excluded rows (`active: false`) so DELETE still matches after “use in replies” is off.
   */
  private liveKbItemClauseForSoftDelete(): Record<string, unknown> {
    return knowledgeItemExcludeDeletedOnlyClause();
  }

  private async skipTableImportJobsForKbItemIds(botOid: Types.ObjectId, itemIds: Types.ObjectId[]): Promise<number> {
    if (itemIds.length === 0) return 0;
    const now = new Date();
    const res = await this.tableImportJobModel.updateMany(
      {
        botId: botOid,
        knowledgeBaseItemId: { $in: itemIds },
        status: { $in: ['queued' as const, 'processing' as const] },
      },
      {
        $set: {
          status: 'failed',
          finishedAt: now,
          error: 'Knowledge item deleted',
          errorCode: 'kb_item_deleted',
        },
      },
    );
    return res.modifiedCount ?? 0;
  }

  /**
   * User-initiated delete: soft-delete rows (`active=false`, `deletedAt`), strip chunks, cancel **queued** document
   * jobs only (`ExtractJob` / document `TrainJob` **processing** rows are left for workers to finish safely).
   * Idempotent — rows already soft-deleted are skipped. Hard-delete + S3 cleanup: purge cron only.
   */
  async softDeleteKnowledgeItemsMatching(botId: string, match: Record<string, unknown>): Promise<number> {
    const r = await this.softDeleteKnowledgeItemsWithStats(botId, match);
    return r.softDeletedCount;
  }

  /** Same as {@link softDeleteKnowledgeItemsMatching} with diagnostics for APIs and tests. */
  async softDeleteKnowledgeItemsWithStats(
    botId: string,
    match: Record<string, unknown>,
  ): Promise<KnowledgeBaseSoftDeleteResult> {
    const empty: KnowledgeBaseSoftDeleteResult = {
      matchedLiveCount: 0,
      softDeletedCount: 0,
      chunksRemovedCount: 0,
      extractJobsQueuedRemovedCount: 0,
      documentTrainJobsQueuedRemovedCount: 0,
      tableImportJobsMarkedFailedCount: 0,
    };
    if (!Types.ObjectId.isValid(botId)) return empty;
    const botOid = new Types.ObjectId(botId);
    const fullMatch = { botId: botOid, $and: [match, this.liveKbItemClauseForSoftDelete()] };
    const ids = (await this.itemModel.distinct('_id', fullMatch as never)) as Types.ObjectId[];
    if (ids.length === 0) return empty;

    const now = new Date();
    const res = await this.itemModel.updateMany(fullMatch as never, {
      $set: { active: false, deletedAt: now, updatedAt: now },
    });
    const softDeletedCount = res.modifiedCount ?? 0;

    const chunkRes = await this.chunkModel.deleteMany({ knowledgeBaseItemId: { $in: ids } });
    const chunksRemovedCount = chunkRes.deletedCount ?? 0;

    const jobRm = await this.cancelQueuedExtractAndDocumentTrainJobsForKbItemIds(botOid, ids);
    const tableImportJobsMarkedFailedCount = await this.skipTableImportJobsForKbItemIds(botOid, ids);

    await this.refreshBotKnowledgeStats(botId);
    await this.kickOosReconcile(botId, 'kb_delete');

    return {
      matchedLiveCount: ids.length,
      softDeletedCount,
      chunksRemovedCount,
      extractJobsQueuedRemovedCount: jobRm.extractJobsQueuedRemovedCount,
      documentTrainJobsQueuedRemovedCount: jobRm.documentTrainJobsQueuedRemovedCount,
      tableImportJobsMarkedFailedCount,
    };
  }

  /**
   * Remove **queued** document pipeline jobs only. **Processing** jobs stay in DB; workers must reload the KB row
   * and exit without persisting content/chunks/ready (see ingestion + stale guards).
   */
  private async cancelQueuedExtractAndDocumentTrainJobsForKbItemIds(
    botOid: Types.ObjectId,
    itemIds: Types.ObjectId[],
  ): Promise<{
    extractJobsQueuedRemovedCount: number;
    documentTrainJobsQueuedRemovedCount: number;
  }> {
    if (itemIds.length === 0) {
      return { extractJobsQueuedRemovedCount: 0, documentTrainJobsQueuedRemovedCount: 0 };
    }
    const [exRes, trRes] = await Promise.all([
      this.extractJobModel.deleteMany({
        botId: botOid,
        knowledgeBaseItemId: { $in: itemIds },
        status: 'queued',
      }),
      this.trainJobModel.deleteMany({
        botId: botOid,
        kind: 'document',
        knowledgeBaseItemId: { $in: itemIds },
        status: 'queued',
      }),
    ]);
    return {
      extractJobsQueuedRemovedCount: exRes.deletedCount ?? 0,
      documentTrainJobsQueuedRemovedCount: trRes.deletedCount ?? 0,
    };
  }

  private async getBotTrainingSettings(botId: string) {
    const b = await this.botModel.findById(new Types.ObjectId(botId)).select('knowledgeTraining').lean();
    return getKnowledgeTrainingSettings(b as Bot);
  }

  /** Called by `DocumentsService` to resolve default upload lifecycle from `knowledgeTraining.autoTrainEnabled`. */
  async getKnowledgeTrainingSettingsForBot(botId: string) {
    return this.getBotTrainingSettings(botId);
  }

  /**
   * Unified queue timing for training/ingest whenever a row is moved onto the pipeline by **manual** lifecycle
   * or Retrain flows: first successful train → immediate; later → {@link computeAutomaticItemRunAfter} /
   * {@link getIngestQueueTimesForDocument}.
   */
  async getQueueTimesForTrainableKbRow(
    botId: string,
    rowLean: Record<string, unknown> & { _id: Types.ObjectId },
    queuedAt: Date,
    cachedSettings?: ReturnType<typeof getKnowledgeTrainingSettings>,
  ): Promise<{ lastQueuedAt: Date; runAfter: Date }> {
    const st = String((rowLean as { sourceType?: string }).sourceType ?? '').trim();
    if (st === 'document') {
      return this.getIngestQueueTimesForDocument(botId, String(rowLean._id), queuedAt);
    }
    const settings = cachedSettings ?? (await this.getBotTrainingSettings(botId));
    const runAfter = this.computeManualRetrainRunAfterForScopeRow(settings, rowLean, queuedAt);
    return { lastQueuedAt: queuedAt, runAfter };
  }

  /**
   * Queue all active KB items in `pending` or `failed` (for retry) for training: set queued timestamps
   * **with spacing** ({@link getQueueTimesForTrainableKbRow}), clear errors when retrying failures.
   */
  async markTrainableItemsQueuedFromLifecycle(
    botId: string,
    mode: 'pending' | 'failed',
  ): Promise<{
    scopes: KnowledgeTrainingScope[];
    documentIds: string[];
  }> {
    if (!Types.ObjectId.isValid(botId)) {
      return { scopes: [], documentIds: [] };
    }
    const now = new Date();
    const botOid = new Types.ObjectId(botId);
    const st = mode === 'pending' ? 'pending' : 'failed';

    const planOk = knowledgeItemNotBlockedByPlanLimitBotKbTotalMongoClause();
    const settings = await this.getBotTrainingSettings(botId);
    const scopes: KnowledgeTrainingScope[] = [];

    const writeForTimes = (
      times: { lastQueuedAt: Date; runAfter: Date },
      modeFail: typeof mode,
    ): { $set: Record<string, unknown>; $unset?: Record<string, 1> } => {
      const $set: Record<string, unknown> = {
        status: 'queued',
        lastQueuedAt: times.lastQueuedAt,
        runAfter: times.runAfter,
        updatedAt: now,
      };
      if (modeFail === 'failed') {
        return { $set, $unset: { trainingError: 1 } };
      }
      return { $set };
    };

    const selectScoped = '_id sourceType lastTrainedAt rawContent title characterCount';

    for (const t of ['faq', 'note', 'table', 'suggestion'] as const) {
      const cand = await this.itemModel
        .find({
          botId: botOid,
          status: st,
          sourceType: t,
          $and: [knowledgeItemExcludeDeletedOnlyClause(), planOk],
        })
        .select(selectScoped)
        .lean();
      let modified = 0;
      for (const raw of cand) {
        const times = await this.getQueueTimesForTrainableKbRow(
          botId,
          raw as Record<string, unknown> & { _id: Types.ObjectId },
          now,
          settings,
        );
        const res = await this.itemModel.updateOne(
          { _id: (raw as { _id: Types.ObjectId })._id },
          writeForTimes(times, mode),
        );
        if ((res.modifiedCount ?? 0) > 0) modified += 1;
      }
      if (modified > 0) scopes.push(t);
    }

    const documentIds: string[] = [];
    const docCand = await this.itemModel
      .find({
        botId: botOid,
        status: st,
        sourceType: 'document',
        isContentExtracted: true,
        extractionStatus: 'done',
        $and: [knowledgeItemExcludeDeletedOnlyClause(), planOk],
      })
      .select('_id')
      .lean();
    for (const raw of docCand) {
      const id = (raw as { _id: Types.ObjectId })._id;
      const times = await this.getQueueTimesForTrainableKbRow(
        botId,
        raw as Record<string, unknown> & { _id: Types.ObjectId },
        now,
        settings,
      );
      const res = await this.itemModel.updateOne({ _id: id }, writeForTimes(times, mode));
      if ((res.modifiedCount ?? 0) > 0) documentIds.push(String(id));
    }

    return { scopes: mergeTrainingScopes(scopes), documentIds };
  }

  /**
   * Paginated KB document rows (`sourceType=document`, non-deleted including `active:false`).
   */
  async listKbDocumentRowsPaginated(
    botId: string,
    page: number,
    limit: number,
  ): Promise<{ rows: Array<Record<string, unknown>>; total: number }> {
    if (!Types.ObjectId.isValid(botId)) {
      return { rows: [], total: 0 };
    }
    const botOid = new Types.ObjectId(botId);
    const skip = Math.max(0, (page - 1) * limit);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const filter: Record<string, unknown> = {
      botId: botOid,
      sourceType: 'document',
      $and: [knowledgeItemExcludeDeletedOnlyClause()],
    };
    const [rowsRaw, total] = await Promise.all([
      this.itemModel
        .find(filter)
        .select('-text -rawContent')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .lean(),
      this.itemModel.countDocuments(filter),
    ]);
    return { rows: rowsRaw as unknown as Array<Record<string, unknown>>, total };
  }

  /** Non-soft-deleted document KB items (includes `active:false` rows). */
  async countKbDocumentRows(botId: string): Promise<number> {
    if (!Types.ObjectId.isValid(botId)) return 0;
    return this.itemModel.countDocuments({
      botId: new Types.ObjectId(botId),
      sourceType: 'document',
      $and: [knowledgeItemExcludeDeletedOnlyClause()],
    });
  }

  /** Sum stored file sizes for document KB rows that are ready (health “indexed bytes”). */
  async sumIndexedBytesReadyDocuments(botId: string): Promise<number> {
    if (!Types.ObjectId.isValid(botId)) return 0;
    const agg = await this.itemModel.aggregate<{ total?: number }>([
      {
        $match: {
          botId: new Types.ObjectId(botId),
          sourceType: 'document',
          status: 'ready',
          $and: [knowledgeItemNotDeletedClause()],
        },
      },
      {
        $group: {
          _id: null,
          total: {
            $sum: {
              $ifNull: [
                '$fileMeta.sizeBytes',
                { $ifNull: ['$file.sizeBytes', { $ifNull: ['$sourceMeta.fileSize', 0] }] },
              ],
            },
          },
        },
      },
    ]);
    return Math.max(0, Math.floor(Number(agg[0]?.total ?? 0)));
  }

  /**
   * Sum item counts and character metrics for active items in the given status(es).
   */
  async sumActiveMetricsByStatuses(
    botId: string,
    statuses: KnowledgeBaseItemTrainingStatus[],
  ): Promise<{ items: number; characters: number }> {
    if (!Types.ObjectId.isValid(botId) || statuses.length === 0) {
      return { items: 0, characters: 0 };
    }
    const items = await this.itemModel
      .find({
        botId: new Types.ObjectId(botId),
        status: { $in: statuses },
        $and: [knowledgeItemNotDeletedClause()],
      })
      .select('sourceType content rawContent title faqMeta characterCount')
      .lean();
    let characters = 0;
    for (const it of items) {
      characters += getCharacterCountForKbItemStats(
        it as Parameters<typeof getCharacterCountForKbItemStats>[0],
      );
    }
    return { items: items.length, characters };
  }

  /**
   * Total datasheet rows (from raw JSON) for table items in the given lifecycle statuses.
   */
  async countActiveItems(
    botId: string,
    sourceType: 'document' | 'faq' | 'note' | 'table' | 'url' | 'html' | 'suggestion',
    statuses: KnowledgeBaseItemTrainingStatus[],
  ): Promise<number> {
    if (!Types.ObjectId.isValid(botId) || statuses.length === 0) return 0;
    return this.itemModel.countDocuments({
      botId: new Types.ObjectId(botId),
      sourceType,
      status: { $in: statuses },
      $and: [knowledgeItemNotDeletedClause()],
    });
  }

  /**
   * Health / overview: newest training completion time among document-backed KB items that are ready.
   */
  async peekLatestReadyDocumentKbTimestamp(botId: string): Promise<Date | undefined> {
    if (!Types.ObjectId.isValid(botId)) return undefined;
    const botOid = new Types.ObjectId(botId);
    const row = await this.itemModel
      .findOne({
        botId: botOid,
        sourceType: 'document',
        status: 'ready',
        $and: [knowledgeItemNotDeletedClause()],
      })
      .sort({ lastTrainedAt: -1 })
      .select({ lastTrainedAt: 1 })
      .lean();
    const r = row as { lastTrainedAt?: Date } | null;
    return kbLastSuccessfulTrainInstant(r ?? {});
  }

  /**
   * Health / overview: latest failed document-linked KB row (sorted by KB `updatedAt`).
   */
  async peekLatestFailedDocumentKb(botId: string): Promise<{
    kbItemId: Types.ObjectId;
    title?: string;
    trainingError?: string;
    updatedAt?: Date;
  } | null> {
    if (!Types.ObjectId.isValid(botId)) return null;
    const row = await this.itemModel
      .findOne({
        botId: new Types.ObjectId(botId),
        sourceType: 'document',
        status: 'failed',
        $and: [knowledgeItemNotDeletedClause()],
      })
      .sort({ updatedAt: -1 })
      .select({ trainingError: 1, updatedAt: 1, title: 1 })
      .lean();
    const r = row as {
      _id?: Types.ObjectId;
      title?: string;
      trainingError?: string;
      updatedAt?: Date;
    } | null;
    if (!r || !r._id) return null;
    return {
      kbItemId: r._id,
      title: r.title,
      trainingError: r.trainingError,
      updatedAt: r.updatedAt,
    };
  }

  async sumDatasheetRowsForTableStatuses(
    botId: string,
    statuses: KnowledgeBaseItemTrainingStatus[],
  ): Promise<number> {
    if (!Types.ObjectId.isValid(botId) || statuses.length === 0) return 0;
    const items = await this.itemModel
      .find({
        botId: new Types.ObjectId(botId),
        sourceType: 'table',
        status: { $in: statuses },
        $and: [knowledgeItemNotDeletedClause()],
      })
      .select('rawContent')
      .lean();
    let rows = 0;
    for (const it of items) {
      const raw = (it as { rawContent?: string }).rawContent;
      if (!raw) continue;
      try {
        const p = JSON.parse(raw) as { rows?: unknown[] };
        if (Array.isArray(p.rows)) rows += p.rows.length;
      } catch {
        /* ignore */
      }
    }
    return rows;
  }

  async markTrainableSourceTypesForRetrain(
    botId: string,
    sourceTypes: Array<'faq' | 'note' | 'table' | 'suggestion'>,
  ): Promise<void> {
    if (!Types.ObjectId.isValid(botId) || sourceTypes.length === 0) return;
    const now = new Date();
    const botOid = new Types.ObjectId(botId);
    const settings = await this.getBotTrainingSettings(botId);
    const cand = await this.itemModel
      .find({
        botId: botOid,
        sourceType: { $in: sourceTypes },
        status: { $nin: ['processing'] },
        $and: [knowledgeItemExcludeDeletedOnlyClause()],
      })
      .select('_id sourceType lastTrainedAt rawContent title characterCount')
      .lean();
    for (const raw of cand) {
      const times = await this.getQueueTimesForTrainableKbRow(
        botId,
        raw as Record<string, unknown> & { _id: Types.ObjectId },
        now,
        settings,
      );
      await this.itemModel.updateOne(
        { _id: (raw as { _id: Types.ObjectId })._id },
        {
          $set: {
            status: 'queued',
            lastQueuedAt: times.lastQueuedAt,
            runAfter: times.runAfter,
            lastContentUpdatedAt: now,
            updatedAt: now,
          },
        },
      );
    }
    const scopes = mergeTrainingScopes(sourceTypes as KnowledgeTrainingScope[]);
    await this.knowledgeTrainingJobService.scheduleTrainingForScopes(botId, scopes, {
      bypassAutoTrainGate: true,
    });
    await this.refreshBotKnowledgeStats(botId);
  }

  /**
   * Customer manual retry: single failed FAQ/note/table/suggestion row → `queued` + scopes {@link TrainJob} (paced like Auto Train).
   * Atomic on the KB row so double-clicks collapse to one state transition; scheduling merges into one live job.
   */
  async queueSingleFailedKbItemForTraining(
    botId: string,
    itemId: string,
    scope: 'faq' | 'note' | 'table' | 'suggestion',
  ): Promise<{ updated: boolean }> {
    if (!Types.ObjectId.isValid(botId) || !Types.ObjectId.isValid(itemId)) return { updated: false };
    const itemOid = new Types.ObjectId(itemId);
    const botOid = new Types.ObjectId(botId);
    const existing = await this.itemModel
      .findOne({
        _id: itemOid,
        botId: botOid,
        sourceType: scope,
        status: 'failed',
        $and: [knowledgeItemExcludeDeletedOnlyClause()],
      })
      .select('_id botId sourceType lastTrainedAt rawContent title characterCount trainingError')
      .lean();
    if (!existing) return { updated: false };
    if (
      String((existing as { trainingError?: string | null }).trainingError ?? '').trim() ===
      PLAN_LIMIT_BOT_KB_TOTAL_CODE
    ) {
      await this.botKbTotalLimit.assertWithinLimit(botId, {
        replacingItemIds: [itemOid],
        incomingBytes: calculateKnowledgeItemUsageBytes(existing as KnowledgeBaseItemUsageLean),
      });
    }
    const now = new Date();
    const times = await this.getQueueTimesForTrainableKbRow(
      botId,
      existing as Record<string, unknown> & { _id: Types.ObjectId },
      now,
    );
    const res = await this.itemModel.findOneAndUpdate(
      {
        _id: itemOid,
        botId: botOid,
        sourceType: scope,
        status: 'failed',
        $and: [knowledgeItemExcludeDeletedOnlyClause()],
      },
      {
        $set: {
          status: 'queued',
          lastQueuedAt: times.lastQueuedAt,
          runAfter: times.runAfter,
          updatedAt: now,
        },
        $unset: { trainingError: 1 },
      },
      { new: true },
    );
    if (!res) return { updated: false };
    await this.knowledgeTrainingJobService.scheduleTrainingForScopes(botId, [scope], {
      bypassAutoTrainGate: true,
    });
    await this.refreshBotKnowledgeStats(botId);
    await this.kickOosReconcile(botId, 'kb_manual_retry_scope');
    return { updated: true };
  }

  private hasTrainedBeforeFromLean(
    row: { lastTrainedAt?: Date } | null | undefined,
  ): boolean {
    return kbHasHadSuccessfulTrain(row ?? {});
  }

  /** Patch for `status` / queue fields from training settings. Caller merges into `$set`. */
  private buildTrainableContentStatus(
    settings: ReturnType<typeof getKnowledgeTrainingSettings>,
    args: {
      needsRetrain: boolean;
      now: Date;
      hasTrainedBefore: boolean;
      smartSchedule?: KnowledgeSmartScheduleContext;
      /** Latest row status when `needsRetrain` is false (same content hash). Used to avoid fake `ready` before first successful train. */
      currentStatus?: KnowledgeBaseItemTrainingStatus | null;
    },
  ):
    | { $set: Record<string, unknown>; $unset?: Record<string, 1>; preserveTrainingLifecycle?: false }
    | { $set: Record<string, unknown>; $unset?: Record<string, 1>; preserveTrainingLifecycle: true } {
    if (!args.needsRetrain) {
      if (args.hasTrainedBefore) {
        return { $set: { status: 'ready' as const }, $unset: { lastQueuedAt: 1, runAfter: 1 } };
      }
      const cur = normalizeKnowledgeTrainingStatus(args.currentStatus ?? undefined);
      if (cur === 'queued' || cur === 'processing' || cur === 'failed') {
        return { $set: {}, preserveTrainingLifecycle: true };
      }
      if (settings.autoTrainEnabled) {
        const runAfter = computeAutomaticItemRunAfter(
          args.now,
          settings.trainingDelayMinutes,
          args.hasTrainedBefore,
          args.smartSchedule,
        );
        return {
          $set: {
            status: 'queued' as const,
            lastQueuedAt: args.now,
            runAfter,
          },
        };
      }
      return {
        $set: { status: 'pending' as const },
        $unset: { lastQueuedAt: 1, runAfter: 1 },
      };
    }
    if (settings.autoTrainEnabled) {
      const runAfter = computeAutomaticItemRunAfter(
        args.now,
        settings.trainingDelayMinutes,
        args.hasTrainedBefore,
        args.smartSchedule,
      );
      return {
        $set: {
          status: 'queued' as const,
          lastQueuedAt: args.now,
          runAfter,
        },
      };
    }
    return {
      $set: { status: 'pending' as const },
      $unset: { lastQueuedAt: 1, runAfter: 1 },
    };
  }

  /**
   * Onboarding go-live: queue first training immediately (`runAfter = now`) regardless of autoTrainEnabled.
   * Preserves in-flight rows (queued/processing) on idempotent retry.
   */
  private buildForcedInitialTrainingStatus(args: {
    needsRetrain: boolean;
    now: Date;
    hasTrainedBefore: boolean;
    currentStatus?: KnowledgeBaseItemTrainingStatus | null;
  }):
    | { $set: Record<string, unknown>; $unset?: Record<string, 1>; preserveTrainingLifecycle?: false }
    | { $set: Record<string, unknown>; $unset?: Record<string, 1>; preserveTrainingLifecycle: true } {
    if (!args.needsRetrain) {
      if (args.hasTrainedBefore) {
        return { $set: { status: 'ready' as const }, $unset: { lastQueuedAt: 1, runAfter: 1 } };
      }
      const cur = normalizeKnowledgeTrainingStatus(args.currentStatus ?? undefined);
      if (cur === 'queued' || cur === 'processing') {
        return { $set: {}, preserveTrainingLifecycle: true };
      }
    }
    return {
      $set: {
        status: 'queued' as const,
        lastQueuedAt: args.now,
        runAfter: args.now,
      },
    };
  }

  private resolveTrainableContentStatusPatch(
    settings: ReturnType<typeof getKnowledgeTrainingSettings>,
    args: {
      needsRetrain: boolean;
      now: Date;
      hasTrainedBefore: boolean;
      smartSchedule?: KnowledgeSmartScheduleContext;
      currentStatus?: KnowledgeBaseItemTrainingStatus | null;
    },
    options?: KnowledgeBotUpsertOptions,
  ) {
    if (options?.forceInitialTraining) {
      return this.buildForcedInitialTrainingStatus(args);
    }
    return this.buildTrainableContentStatus(settings, args);
  }

  private newKbItemTrainingFields(
    settings: ReturnType<typeof getKnowledgeTrainingSettings>,
    now: Date,
    opts: {
      forceInitialTraining?: boolean;
      hasContent: boolean;
      active?: boolean;
      smartSchedule?: KnowledgeSmartScheduleContext;
    },
  ): Record<string, unknown> {
    const active = opts.active !== false;
    if (!opts.hasContent) {
      return { status: 'ready' as const, active };
    }
    if (opts.forceInitialTraining) {
      return {
        status: 'queued' as const,
        active,
        lastQueuedAt: now,
        runAfter: now,
      };
    }
    if (settings.autoTrainEnabled) {
      return {
        status: 'queued' as const,
        active,
        lastQueuedAt: now,
        runAfter: computeAutomaticItemRunAfter(
          now,
          settings.trainingDelayMinutes,
          false,
          opts.smartSchedule,
        ),
      };
    }
    return { status: 'pending' as const, active };
  }

  private async scheduleScopeTrainingAfterUpsert(
    botId: string,
    scope: KnowledgeTrainingScope,
    settings: ReturnType<typeof getKnowledgeTrainingSettings>,
    options?: KnowledgeBotUpsertOptions,
  ): Promise<void> {
    if (settings.autoTrainEnabled) {
      await this.knowledgeTrainingJobService.scheduleTrainingForScopes(botId, [scope]);
      return;
    }
    if (options?.forceInitialTraining) {
      await this.knowledgeTrainingJobService.scheduleTrainingForScopes(botId, [scope], {
        bypassAutoTrainGate: true,
        immediateJob: true,
      });
    }
  }

  /**
   * Manual Retrain / train-now: match Auto Train spacing ({@link computeAutomaticItemRunAfter}) per row instead of forcing `runAfter = now`.
   */
  private manualRetrainSmartScheduleFromLeanScopeRow(row: Record<string, unknown>): KnowledgeSmartScheduleContext {
    const st = String((row as { sourceType?: string }).sourceType ?? '').trim();
    if (st === 'faq') return { kind: 'faq' };
    if (st === 'note') return { kind: 'note' };
    if (st === 'document') return { kind: 'document' };
    if (st === 'suggestion') return { kind: 'suggestion' };
    if (st === 'table') {
      const title = String((row as { title?: string }).title ?? '').trim() || 'Table';
      let columns: string[] = [];
      let dataRows: string[][] = [];
      const raw = String((row as { rawContent?: string }).rawContent ?? '');
      try {
        const p = JSON.parse(raw) as { columns?: unknown; rows?: unknown };
        columns = Array.isArray(p.columns) ? p.columns.map((c) => String(c)) : [];
        if (Array.isArray(p.rows)) {
          dataRows = p.rows.map((r) => (Array.isArray(r) ? r.map((c) => String(c)) : []));
        }
      } catch {
        /* ignore */
      }
      const m = metricsForTableRow({ title, columns, rows: dataRows });
      const chars =
        typeof (row as { characterCount?: number }).characterCount === 'number'
          ? (row as { characterCount: number }).characterCount
          : m.characterCount;
      return { kind: 'table', rowCount: dataRows.length, approxChars: chars };
    }
    return { kind: 'faq' };
  }

  private computeManualRetrainRunAfterForScopeRow(
    settings: ReturnType<typeof getKnowledgeTrainingSettings>,
    row: Record<string, unknown>,
    queuedAt: Date,
  ): Date {
    const hasBefore = this.hasTrainedBeforeFromLean(row as { lastTrainedAt?: Date } | null);
    const smart = this.manualRetrainSmartScheduleFromLeanScopeRow(row);
    return computeAutomaticItemRunAfter(queuedAt, settings.trainingDelayMinutes, hasBefore, smart);
  }

  /** Document KB rows: match `KnowledgeBaseItem._id`; soft-delete filter only ({@link knowledgeItemExcludeDeletedOnlyClause}). */
  private kbLiveDocumentRouteFilter(botId: string, routeId: string): Record<string, unknown> | null {
    if (!Types.ObjectId.isValid(botId) || !Types.ObjectId.isValid(routeId)) return null;
    const botOid = new Types.ObjectId(botId);
    const rid = new Types.ObjectId(routeId);
    return {
      botId: botOid,
      sourceType: 'document' as const,
      _id: rid,
      $and: [knowledgeItemExcludeDeletedOnlyClause()],
    };
  }

  /**
   * Create a KB-only document row after S3 upload (no `documents` collection row).
   */
  async createKbDocumentUploadItem(params: {
    botId: string;
    title: string;
    file: {
      originalName: string;
      mimeType: string;
      sizeBytes: number;
      storageKey: string;
      storageBucket: string;
      storageProvider?: string;
      uploadStatus: 'uploaded' | 'upload_failed';
    };
    /** When set (e.g. template / import by URL), ingestion fetches bytes over HTTPS; S3 keys may be empty. */
    httpDocumentUrl?: string;
    trainingStatus: KnowledgeBaseItemTrainingStatus;
    lastQueuedAt?: Date;
    runAfter?: Date;
  }): Promise<{ id: string }> {
    const botOid = new Types.ObjectId(params.botId);
    const now = new Date();
    const queuedExtra: Record<string, unknown> = {};
    if (params.trainingStatus === 'queued') {
      queuedExtra.lastQueuedAt = params.lastQueuedAt ?? now;
      queuedExtra.runAfter = params.runAfter ?? now;
    }
    const httpU = typeof params.httpDocumentUrl === 'string' ? params.httpDocumentUrl.trim() : '';
    const fileMeta: Record<string, unknown> = { ...params.file };
    if (httpU && /^https?:\/\//i.test(httpU)) {
      fileMeta.url = httpU;
      fileMeta.storage = 'https';
    } else {
      fileMeta.storage = 's3';
    }
    /** Align with {@link upsertDocumentKnowledgeItem} so extract stale-guard fingerprint matches empty body. */
    const initialContentHash = documentKbContentFingerprint(params.title, '');
    const created = await this.itemModel.create({
      botId: botOid,
      title: params.title,
      sourceType: 'document',
      status: params.trainingStatus,
      extractionStatus: initialDocumentKbExtractionStatus({
        content: '',
        fileMeta,
        isContentExtracted: false,
      }),
      active: true,
      fileMeta,
      content: '',
      contentHash: initialContentHash,
      lastContentUpdatedAt: now,
      characterCount: 0,
      isContentExtracted: false,
      ...queuedExtra,
    });
    await this.refreshBotKnowledgeStats(params.botId);
    return { id: (created as { _id: Types.ObjectId })._id.toString() };
  }

  /**
   * Soft-delete document KB rows by canonical item ids (`routeIds`). Chunks removed immediately; queued
   * extract/document-train jobs removed; processing jobs left for workers; hard purge of the row/S3 later via cron.
   */
  async softDeleteKbDocumentRoutesByIds(botId: string, routeIds: Types.ObjectId[]): Promise<number> {
    if (!Types.ObjectId.isValid(botId) || routeIds.length === 0) return 0;
    return this.softDeleteKnowledgeItemsMatching(botId, {
      sourceType: 'document',
      _id: { $in: routeIds },
    });
  }

  async getBotIdForKbDocumentRouteId(itemId: string): Promise<{ botId: string } | null> {
    if (!Types.ObjectId.isValid(itemId)) return null;
    const r = await this.itemModel
      .findOne({ _id: new Types.ObjectId(itemId), sourceType: 'document' })
      .select('botId')
      .lean();
    if (!r) return null;
    const row = r as { botId?: Types.ObjectId };
    return {
      botId: String(row.botId),
    };
  }

  /**
   * Create or update a KnowledgeBaseItem for a document. Matches by `_id`.
   */
  async upsertDocumentKnowledgeItem(doc: DocumentLikeForSync): Promise<{ id: string; created: boolean }> {
    const botOid = new Types.ObjectId(String(doc.botId));
    const docId = doc._id as Types.ObjectId;
    const content = normalizeKbDocumentBodyForHash(String(doc.text ?? ''));
    const titleForRow = normalizeKbDocumentTitleForRow(doc.title);
    const hash = documentKbContentFingerprint(titleForRow, content);
    const settings = await this.getBotTrainingSettings(String(botOid));

    const fileMetaMerged = mergedDocumentKbFileMetaFromSync({
      fileName: doc.fileName,
      fileType: doc.fileType,
      fileSize: doc.fileSize,
      s3Bucket: doc.s3Bucket,
      s3Key: doc.s3Key,
      url: doc.url,
      uploadSessionId: doc.uploadSessionId,
      storage: doc.storage,
    });

    let existing = await this.itemModel
      .findOne({
        botId: botOid,
        sourceType: 'document',
        _id: docId,
      })
      .select('_id contentHash status active lastTrainedAt isContentExtracted trainingError')
      .lean();

    if (!existing) {
      const byId = await this.itemModel
        .findOne({ _id: docId, sourceType: 'document' })
        .select('_id contentHash status active lastTrainedAt isContentExtracted trainingError botId')
        .lean();
      if (
        byId &&
        String((byId as { botId?: Types.ObjectId }).botId ?? '') === String(botOid)
      ) {
        existing = byId;
      }
    }

    const active = doc.active !== false;
    const trainingSignal =
      typeof doc.trainingStatus === 'string' && doc.trainingStatus.trim()
        ? doc.trainingStatus
        : typeof doc.status === 'string'
          ? doc.status
          : '';
    const docNorm = normalizeKnowledgeTrainingStatus(trainingSignal);
    const docSyncStatus: KnowledgeBaseItemTrainingStatus =
      docNorm === 'ready' || docNorm === 'failed' || docNorm === 'processing' || docNorm === 'pending' || docNorm === 'queued'
        ? docNorm
        : 'queued';
    const textMetrics = metricsForDocumentContent(content);
    const contentExtracted = isTrainableExtractedDocumentText(content);
    const now = new Date();
    const sameHashForLimit = existing ? (existing as { contentHash?: string }).contentHash === hash : false;
    if (contentExtracted && content.length > 0 && !sameHashForLimit) {
      const incomingLimitBytes = calculateDocumentKnowledgeUsageBytes({ sourceType: 'document', content });
      let shouldAssertPlanLimit = false;
      if (!existing) {
        shouldAssertPlanLimit = incomingLimitBytes > 0;
      } else {
        const prevContent = normalizeKbDocumentBodyForHash(
          String((existing as { content?: string }).content ?? ''),
        );
        const replacingLimitBytes = calculateDocumentKnowledgeUsageBytes({
          sourceType: 'document',
          content: prevContent,
        });
        shouldAssertPlanLimit = incomingLimitBytes > replacingLimitBytes;
      }
      if (shouldAssertPlanLimit) {
        await this.botKbTotalLimit.assertWithinLimit(String(botOid), {
          replacingItemIds: existing ? [docId] : [],
          incomingBytes: incomingLimitBytes,
        });
      }
    }

    if (existing) {
      const sameHash = (existing as { contentHash?: string }).contentHash === hash;
      const hadPlanTe =
        String((existing as { trainingError?: string | null }).trainingError ?? '').trim() ===
        PLAN_LIMIT_BOT_KB_TOTAL_CODE;
      let forcePlanLimitStay = false;
      if (hadPlanTe && contentExtracted && content.length > 0 && !sameHash) {
        const proj = await this.botKbTotalLimit.evaluateProjectedUsage(String(botOid), {
          replacingItemIds: [docId],
          incomingBytes: calculateDocumentKnowledgeUsageBytes({ sourceType: 'document', content }),
        });
        if (proj.projectedBytes > proj.maxBytes) {
          forcePlanLimitStay = true;
        }
      }
      const stPatch = (() => {
        /**
         * Manual PATCH / sync while embedding is in-flight: preserve `processing` only if title+body
         * fingerprint is unchanged. If the editor saved new text mid-train, re-run pending/queued routing
         * so auto-train off → `pending` and auto-train on → `queued`.
         */
        if (docSyncStatus === 'processing' && sameHash) {
          return { $set: { status: 'processing' as const }, preserveTrainingLifecycle: true } as const;
        }
        if (sameHash) {
          /**
           * Caller may pass explicit `trainingStatus: 'ready'` after embeddings finish while Mongo still
           * shows `queued`/`processing` with no `lastTrainedAt`. Routing that through
           * {@link buildTrainableContentStatus} with `hasTrainedBefore: false` and `currentStatus: 'queued'`
           * incorrectly returned `preserveTrainingLifecycle`, skipping status/trained writes.
           */
          return {
            $set: { status: docSyncStatus },
            $unset: { lastQueuedAt: 1, runAfter: 1 },
          } as const;
        }
        return this.buildTrainableContentStatus(settings, {
          needsRetrain: true,
          now,
          hasTrainedBefore: this.hasTrainedBeforeFromLean(
            existing as { lastTrainedAt?: Date },
          ),
          smartSchedule: { kind: 'document' },
        });
      })();
      const $set: Record<string, unknown> = {
        title: titleForRow,
        content,
        rawContent: content || undefined,
        contentHash: hash,
        active,
        characterCount: textMetrics.characterCount,
        isContentExtracted: contentExtracted,
        updatedAt: now,
      };
      /** Only advance when title/body fingerprint changed — queue/status patches bump `updatedAt`, not content version. */
      let lastContentUpdatedAtAdvanced = !sameHash;
      if (!sameHash) {
        $set.lastContentUpdatedAt = now;
      } else {
        /** Same-hash editor saves still need retraining; drift/reconcile jobs must see fresher `{@link KnowledgeBaseItem.lastContentUpdatedAt}`. */
        const priorSt = normalizeKnowledgeTrainingStatus(String((existing as { status?: string }).status ?? ''));
        if (
          priorSt === 'ready' &&
          (docSyncStatus === 'pending' || docSyncStatus === 'queued')
        ) {
          $set.lastContentUpdatedAt = now;
          lastContentUpdatedAtAdvanced = true;
        }
      }
      if (contentExtracted) {
        $set.extractionStatus = 'done';
        $set.extractedAt = now;
        $set.lastExtractedAt = now;
      }
      if (fileMetaMerged) {
        $set.fileMeta = fileMetaMerged;
      }
      if (!('preserveTrainingLifecycle' in stPatch && stPatch.preserveTrainingLifecycle)) {
        Object.assign($set, stPatch.$set);
      }
      if (forcePlanLimitStay) {
        $set.status = 'failed';
        $set.trainingError = PLAN_LIMIT_BOT_KB_TOTAL_CODE;
      }
      if (
        !('preserveTrainingLifecycle' in stPatch && stPatch.preserveTrainingLifecycle) &&
        (stPatch.$set as { status?: string })?.status === 'ready' &&
        !forcePlanLimitStay
      ) {
        $set.lastTrainedAt = new Date();
      }
      const up: { $set: Record<string, unknown>; $unset?: Record<string, 1> } = { $set };
      if (!('preserveTrainingLifecycle' in stPatch && stPatch.preserveTrainingLifecycle) && stPatch.$unset) {
        up.$unset = stPatch.$unset;
      }
      up.$unset = {
        ...(up.$unset ?? {}),
        sourceMeta: 1,
        file: 1,
        deletedAt: 1,
        ...(!contentExtracted ? { lastExtractedAt: 1 as const, extractedAt: 1 as const } : {}),
        ...(contentExtracted ? { extractionError: 1 as const } : {}),
        ...(forcePlanLimitStay ? { lastQueuedAt: 1 as const, runAfter: 1 as const } : {}),
      };
      const preserve =
        'preserveTrainingLifecycle' in stPatch && stPatch.preserveTrainingLifecycle;
      const mergedStatus =
        preserve ? undefined : typeof ($set as { status?: string }).status === 'string'
          ? ($set as { status: string }).status
          : undefined;
      if (!preserve && !forcePlanLimitStay && mergedStatus !== undefined && mergedStatus !== 'failed') {
        up.$unset = { ...(up.$unset ?? {}), trainingError: 1 };
      }
      await this.itemModel.updateOne(
        { _id: (existing as { _id: Types.ObjectId })._id, botId: botOid, sourceType: 'document' },
        up,
      );
      await this.refreshBotKnowledgeStats(String(botOid));
      kbTrainingLog('document KB row persisted (update)', {
        knowledgeBaseItemId: String((existing as { _id: Types.ObjectId })._id),
        titleRaw: doc.title,
        titleForRow,
        contentLength: content.length,
        contentHashSaved: hash,
        fingerprintMatchesSavedHash: documentKbContentFingerprint(titleForRow, content) === hash,
        lastContentUpdatedAtAdvanced,
        lastContentUpdatedAt:
          lastContentUpdatedAtAdvanced ? (now as Date).toISOString() : undefined,
      });
      await this.kickOosReconcile(String(botOid), 'kb_document_upsert');
      return { id: (existing as { _id: Types.ObjectId })._id.toString(), created: false };
    }

    const createSt = (() => {
      if (docSyncStatus === 'ready') {
        return { status: 'ready' as const, extra: { lastTrainedAt: new Date() } };
      }
      if (docSyncStatus === 'pending') {
        return { status: 'pending' as const, extra: {} };
      }
      if (docSyncStatus === 'failed' || docSyncStatus === 'processing') {
        return { status: docSyncStatus, extra: {} };
      }
      if (docSyncStatus === 'queued' && settings.autoTrainEnabled) {
        return {
          status: 'queued' as const,
          extra: {
            lastQueuedAt: now,
            runAfter: computeAutomaticItemRunAfter(now, settings.trainingDelayMinutes, false),
          },
        };
      }
      return { status: 'pending' as const, extra: {} };
    })();

    const fmForInit = (fileMetaMerged ?? {}) as Record<string, unknown>;
    const createPayload: Record<string, unknown> = {
      _id: docId,
      botId: botOid,
      title: titleForRow,
      sourceType: 'document',
      status: createSt.status,
      active,
      content,
      rawContent: content || undefined,
      contentHash: hash,
      characterCount: textMetrics.characterCount,
      isContentExtracted: contentExtracted,
      extractionStatus: initialDocumentKbExtractionStatus({
        content,
        fileMeta: fmForInit,
        isContentExtracted: contentExtracted,
      }),
      lastContentUpdatedAt: now,
      ...(contentExtracted ? { extractedAt: now, lastExtractedAt: now } : {}),
      ...createSt.extra,
    };
    if (fileMetaMerged) {
      createPayload.fileMeta = fileMetaMerged;
    }
    try {
      await this.itemModel.create(createPayload);
    } catch (err: unknown) {
      const code = typeof err === 'object' && err !== null ? (err as { code?: number }).code : undefined;
      if (code === 11000) {
        const raced = await this.itemModel
          .findOne({ _id: docId, sourceType: 'document', botId: botOid })
          .select('_id')
          .lean();
        if (raced) {
          return this.upsertDocumentKnowledgeItem(doc);
        }
      }
      throw err;
    }
    await this.refreshBotKnowledgeStats(String(botOid));
    kbTrainingLog('document KB row persisted (create)', {
      knowledgeBaseItemId: String(docId),
      titleRaw: doc.title,
      titleForRow,
      contentLength: content.length,
      contentHashSaved: hash,
      fingerprintMatchesSavedHash: documentKbContentFingerprint(titleForRow, content) === hash,
      lastContentUpdatedAt: (now as Date).toISOString(),
    });
    await this.kickOosReconcile(String(botOid), 'kb_document_upsert');
    return { id: docId.toString(), created: true };
  }

  /** Drop extra live FAQ rows that share the same `faqMeta.faqIndex` (avoids duplicate list slots / stray creates). */
  private async softDeleteDuplicateFaqRowsByFaqIndex(botId: string): Promise<void> {
    if (!Types.ObjectId.isValid(botId)) return;
    const botOid = new Types.ObjectId(botId);
    const items = await this.itemModel
      .find({
        botId: botOid,
        sourceType: 'faq',
        $and: [this.liveKbItemClauseForSoftDelete()],
      })
      .select('_id faqMeta lastContentUpdatedAt createdAt')
      .lean() as Array<{
        _id: Types.ObjectId;
        faqMeta?: { faqIndex?: number };
        lastContentUpdatedAt?: Date;
        createdAt?: Date;
      }>;
    const loserIds = faqKnowledgeDuplicateIndexIds(items);
    if (loserIds.length === 0) return;
    await this.softDeleteKnowledgeItemsMatching(botId, {
      _id: { $in: loserIds },
      sourceType: 'faq',
    });
  }

  /**
   * Sync all Q&A entries for a bot to KnowledgeBaseItems. Matches by botId + sourceType='faq' + faqMeta.faqIndex.
   * Each row: optional title, multiple `questions` (or legacy `question` as first phrasing), one `answer`.
   */
  async upsertFaqKnowledgeItemsForBot(
    botId: string,
    faqs: Array<{
      title?: string;
      questions?: string[];
      question?: string;
      answer: string;
      active?: boolean;
    }>,
    options?: KnowledgeBotUpsertOptions,
  ): Promise<{ upserted: number; deactivated: number }> {
    if (!options?.skipKbTotalLimitAssert) {
      await this.botKbTotalLimit.assertWithinLimit(botId, {
        replacingSourceTypes: ['faq'],
        incomingBytes: incomingFaqSectionUtf8Bytes(faqs),
      });
    }
    await this.softDeleteDuplicateFaqRowsByFaqIndex(botId);
    const botOid = new Types.ObjectId(botId);
    const existingItems = await this.itemModel
      .find({ botId: botOid, sourceType: 'faq' })
      .select('_id faqMeta')
      .lean();

    const byIndex = new Map<number, { _id: Types.ObjectId }>();
    for (const item of existingItems) {
      const meta = (item as { faqMeta?: { faqIndex?: number } }).faqMeta;
      if (meta?.faqIndex != null) byIndex.set(meta.faqIndex, { _id: (item as { _id: Types.ObjectId })._id });
    }

    const trainingSettings = await this.getBotTrainingSettings(botId);
    let upserted = 0;
    for (let i = 0; i < faqs.length; i++) {
      const faq = faqs[i];
      const groupTitle = (faq.title ?? '').trim();
      const rawQuestions = Array.isArray(faq.questions) && faq.questions.length
        ? faq.questions
        : faq.question != null && String(faq.question).trim()
          ? [String(faq.question).trim()]
          : [];
      const questions = rawQuestions.map((q) => String(q ?? '').trim()).filter(Boolean);
      const answer = (faq.answer ?? '').trim();
      const active = faq.active !== false;
      const primaryQ = questions[0] ?? '';
      const itemTitle = groupTitle || primaryQ || `Q&A ${i + 1}`;
      const inputForHash =
        questions.length > 0 || groupTitle
          ? buildQaEmbeddingText(groupTitle, questions, answer)
          : buildFaqEmbeddingText(primaryQ, answer);
      const content = inputForHash;
      const hash = computeEmbeddingInputHash(inputForHash);
      const m = metricsForFaqRow({
        title: groupTitle || undefined,
        questions: questions.length ? questions : undefined,
        question: primaryQ,
        answer,
      });
      const contentNow = new Date();

      const faqMeta: KnowledgeBaseItemFaqMeta = {
        title: groupTitle || undefined,
        questions: questions.length ? questions : undefined,
        answer,
        faqIndex: i,
      };

      const existing = byIndex.get(i);
      if (existing) {
        const current = await this.itemModel
          .findById(existing._id)
          .select('contentHash lastTrainedAt')
          .lean();
        const sameHash = (current as { contentHash?: string } | null)?.contentHash === hash;
        const stPatch = this.resolveTrainableContentStatusPatch(
          trainingSettings,
          {
            needsRetrain: !sameHash,
            now: contentNow,
            hasTrainedBefore: this.hasTrainedBeforeFromLean(
              current as { lastTrainedAt?: Date } | null,
            ),
            smartSchedule: { kind: 'faq' },
            currentStatus: normalizeKnowledgeTrainingStatus(
              (current as { status?: string } | null)?.status,
            ) as KnowledgeBaseItemTrainingStatus,
          },
          options,
        );
        const $set: Record<string, unknown> = {
          title: itemTitle,
          content,
          contentHash: hash,
          faqMeta,
          active,
          characterCount: m.characterCount,
          lastContentUpdatedAt: contentNow,
          updatedAt: contentNow,
          extractionStatus: 'not_required',
        };
        if (!('preserveTrainingLifecycle' in stPatch && stPatch.preserveTrainingLifecycle)) {
          Object.assign($set, stPatch.$set);
        }
        const up: { $set: Record<string, unknown>; $unset?: Record<string, 1> } = { $set };
        if (!('preserveTrainingLifecycle' in stPatch && stPatch.preserveTrainingLifecycle) && stPatch.$unset) {
          up.$unset = stPatch.$unset;
        }
        up.$unset = { ...(up.$unset ?? {}), deletedAt: 1 };
        await this.itemModel.updateOne({ _id: existing._id }, up);
        upserted++;
        byIndex.delete(i);
        continue;
      }

      const stNew = this.newKbItemTrainingFields(trainingSettings, contentNow, {
        forceInitialTraining: options?.forceInitialTraining,
        hasContent: Boolean(primaryQ || answer || groupTitle),
        active,
        smartSchedule: { kind: 'faq' },
      });

      await this.itemModel.create({
        botId: botOid,
        title: itemTitle,
        sourceType: 'faq',
        active,
        content,
        contentHash: hash,
        faqMeta,
        characterCount: m.characterCount,
        lastContentUpdatedAt: contentNow,
        extractionStatus: 'not_required',
        ...stNew,
      });
      upserted++;
    }

    const deactivated = await this.deactivateMissingFaqKnowledgeItemsForBot(botId, faqs.length);
    await this.refreshBotKnowledgeStats(botId);
    await this.scheduleScopeTrainingAfterUpsert(botId, 'faq', trainingSettings, options);
    await this.kickOosReconcile(botId, 'kb_faq_upsert');
    return { upserted, deactivated };
  }

  /** Hard-remove FAQ KB rows dropped from the configured list (`faqMeta.faqIndex` >= faqCount). */
  async deactivateMissingFaqKnowledgeItemsForBot(botId: string, faqCount: number): Promise<number> {
    return this.softDeleteKnowledgeItemsMatching(botId, {
      sourceType: 'faq',
      'faqMeta.faqIndex': { $gte: faqCount },
    });
  }

  /**
   * Sync titled snippets: one KnowledgeBaseItem per row (`sourceType: note`, `noteMeta.kind: snippet`, `snippetIndex`).
   * Hard-removes legacy `general_note` and unused snippet indices.
   */
  async upsertSnippetKnowledgeItemsForBot(
    botId: string,
    snippets: Array<{ title: string; snippet: string; active?: boolean }>,
    options?: KnowledgeBotUpsertOptions,
  ): Promise<{ upserted: number; deactivated: number }> {
    if (!options?.skipKbTotalLimitAssert) {
      await this.botKbTotalLimit.assertWithinLimit(botId, {
        replacingSourceTypes: ['note'],
        incomingBytes: incomingNoteSnippetSectionUtf8Bytes(snippets),
      });
    }
    const botOid = new Types.ObjectId(botId);
    const existingItems = await this.itemModel
      .find({ botId: botOid, sourceType: 'note' })
      .select('_id noteMeta')
      .lean();

    const byIndex = new Map<number, { _id: Types.ObjectId }>();
    for (const item of existingItems) {
      const meta = (item as { noteMeta?: unknown }).noteMeta;
      const idx = coerceNoteSnippetIndex(meta);
      if (idx !== undefined) {
        byIndex.set(idx, { _id: (item as { _id: Types.ObjectId })._id });
      }
    }

    const trainingSettingsSn = await this.getBotTrainingSettings(botId);
    let upserted = 0;
    for (let i = 0; i < snippets.length; i++) {
      const row = snippets[i];
      const stitle = (row.title ?? '').trim() || 'Snippet';
      const body = (row.snippet ?? '').trim();
      const active = row.active !== false;
      const hasContent = stitle.length > 0 && body.length > 0;
      const textForHash = buildNoteEmbeddingText(stitle, body);
      const hash = computeEmbeddingInputHash(textForHash);
      const content = textForHash;
      const rawPayload = hasContent ? JSON.stringify({ title: stitle, snippet: body }) : undefined;
      const m = metricsForSnippetRow({ title: stitle, snippet: body });
      const contentNow = new Date();

      const noteMeta = { kind: 'snippet' as const, snippetIndex: i };

      const existing = byIndex.get(i);
      if (existing) {
        const current = await this.itemModel
          .findById(existing._id)
          .select('contentHash lastTrainedAt')
          .lean();
        const sameHash = (current as { contentHash?: string } | null)?.contentHash === hash;
        const stPatch = this.resolveTrainableContentStatusPatch(
          trainingSettingsSn,
          {
            needsRetrain: !sameHash,
            now: contentNow,
            hasTrainedBefore: this.hasTrainedBeforeFromLean(
              current as { lastTrainedAt?: Date } | null,
            ),
            smartSchedule: { kind: 'note' },
            currentStatus: normalizeKnowledgeTrainingStatus(
              (current as { status?: string } | null)?.status,
            ) as KnowledgeBaseItemTrainingStatus,
          },
          options,
        );
        const $set: Record<string, unknown> = {
          title: stitle,
          content: hasContent ? content : '',
          contentHash: hash,
          noteMeta,
          rawContent: rawPayload,
          active: hasContent && active,
          characterCount: m.characterCount,
          lastContentUpdatedAt: contentNow,
          updatedAt: contentNow,
          extractionStatus: 'not_required',
        };
        if (!('preserveTrainingLifecycle' in stPatch && stPatch.preserveTrainingLifecycle)) {
          Object.assign($set, stPatch.$set);
        }
        const up: { $set: Record<string, unknown>; $unset?: Record<string, 1> } = { $set };
        if (!('preserveTrainingLifecycle' in stPatch && stPatch.preserveTrainingLifecycle) && stPatch.$unset) {
          up.$unset = stPatch.$unset;
        }
        up.$unset = { ...(up.$unset ?? {}), deletedAt: 1 };
        await this.itemModel.updateOne({ _id: existing._id }, up);
        upserted++;
        byIndex.delete(i);
        continue;
      }

      const stNoteNew = this.newKbItemTrainingFields(trainingSettingsSn, contentNow, {
        forceInitialTraining: options?.forceInitialTraining,
        hasContent,
        active: hasContent && active,
        smartSchedule: { kind: 'note' },
      });

      await this.itemModel.create({
        botId: botOid,
        title: stitle,
        sourceType: 'note',
        content: hasContent ? content : '',
        contentHash: hash,
        noteMeta,
        rawContent: rawPayload,
        characterCount: m.characterCount,
        lastContentUpdatedAt: contentNow,
        extractionStatus: 'not_required',
        ...stNoteNew,
      });
      upserted++;
    }

    const deactivatedLegacy = await this.softDeleteKnowledgeItemsMatching(botId, {
      sourceType: 'note',
      'noteMeta.kind': 'general_note',
    });
    const deactivated = await this.deactivateMissingSnippetKnowledgeItemsForBot(botId, snippets.length);
    await this.refreshBotKnowledgeStats(botId);
    await this.scheduleScopeTrainingAfterUpsert(botId, 'note', trainingSettingsSn, options);
    await this.kickOosReconcile(botId, 'kb_snippet_upsert');
    return { upserted, deactivated: deactivatedLegacy + deactivated };
  }

  /**
   * Legacy: one blob note. Prefer {@link upsertSnippetKnowledgeItemsForBot} with a single entry.
   */
  async upsertNoteKnowledgeItemForBot(botId: string, knowledgeDescription: string): Promise<{ id: string; created: boolean; active: boolean }> {
    const text = (knowledgeDescription ?? '').trim();
    if (!text) {
      await this.deactivateNoteKnowledgeItemsForBot(botId);
      await this.refreshBotKnowledgeStats(botId);
      return { id: '', created: false, active: false };
    }
    return this.upsertSnippetKnowledgeItemsForBot(botId, [{ title: 'Notes', snippet: text, active: true }], undefined).then(() => ({
      id: '',
      created: true,
      active: true,
    }));
  }

  /**
   * Hard-remove snippet rows with snippetIndex not in 0..count-1 (any stray general_note is removed in upsert).
   */
  async deactivateMissingSnippetKnowledgeItemsForBot(botId: string, snippetCount: number): Promise<number> {
    return this.softDeleteKnowledgeItemsMatching(botId, {
      sourceType: 'note',
      'noteMeta.kind': 'snippet',
      'noteMeta.snippetIndex': { $gte: snippetCount },
    });
  }

  async deactivateNoteKnowledgeItemsForBot(botId: string): Promise<number> {
    return this.softDeleteKnowledgeItemsMatching(botId, {
      sourceType: 'note',
    });
  }

  /**
   * Sync knowledge tables: one KnowledgeBaseItem per table (`sourceType: table`, `tableMeta.tableIndex`).
   */
  async upsertTableKnowledgeItemsForBot(
    botId: string,
    tables: Array<{
      title: string;
      columns: string[];
      rows: string[][];
      active?: boolean;
      importFileSize?: number;
      importFileName?: string;
    }>,
    options?: KnowledgeBotUpsertOptions,
  ): Promise<{ upserted: number; deactivated: number }> {
    if (!options?.skipKbTotalLimitAssert) {
      await this.botKbTotalLimit.assertWithinLimit(botId, {
        replacingSourceTypes: ['table'],
        incomingBytes: incomingTableSectionUtf8Bytes(tables),
      });
    }
    const botOid = new Types.ObjectId(botId);
    const existingItems = await this.itemModel
      .find({ botId: botOid, sourceType: 'table' })
      .select('_id tableMeta')
      .lean();

    const byIndex = new Map<number, { _id: Types.ObjectId }>();
    for (const item of existingItems) {
      const meta = (item as { tableMeta?: { tableIndex?: number } }).tableMeta;
      if (meta?.tableIndex != null) byIndex.set(meta.tableIndex, { _id: (item as { _id: Types.ObjectId })._id });
    }

    const trainingSettingsTbl = await this.getBotTrainingSettings(botId);
    let upserted = 0;
    for (let i = 0; i < tables.length; i++) {
      const t = tables[i]!;
      const title = (t.title ?? '').trim() || `Table ${i + 1}`;
      const columns = Array.isArray(t.columns) ? t.columns.map((c) => String(c ?? '')) : [];
      const rows = Array.isArray(t.rows) ? t.rows.map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? '')) : [])) : [];
      const active = t.active !== false;
      const hasContent = columns.length > 0 && rows.length > 0;
      if (hasContent) {
        assertTableKnowledgeFitsMongoPersistOrThrow(title, columns, rows);
      }
      const textForHash = buildTableEmbeddingText(title, columns, rows);
      const hash = computeEmbeddingInputHash(textForHash);
      const content = textForHash;
      const m = metricsForTableRow({ title, columns, rows });
      const contentNow = new Date();

      const existing = byIndex.get(i);
      if (existing) {
        const live = await this.itemModel
          .findById(existing._id)
          .select('contentHash tableMeta lastTrainedAt sourceMeta status rawContent')
          .lean();
        const impPhase = (live as { tableMeta?: { importPhase?: string } } | null)?.tableMeta?.importPhase;
        if (impPhase === 'import_queued' || impPhase === 'importing') {
          byIndex.delete(i);
          continue;
        }
        const current = live;
        assertDatasheetColumnsUnchangedIfLocked({
          tableMeta: (current as { tableMeta?: unknown }).tableMeta,
          rawContent: (current as { rawContent?: string }).rawContent,
          incomingColumns: columns,
        });
        const sameHash = (current as { contentHash?: string } | null)?.contentHash === hash;
        const rawPayload = hasContent ? JSON.stringify({ title, columns, rows }) : undefined;
        const prevTm = (current as { tableMeta?: { importFileSize?: number; importFileName?: string } } | null)
          ?.tableMeta;
        const prevSm = (current as { sourceMeta?: { fileSize?: number; fileName?: string } | null } | null)
          ?.sourceMeta;
        const incomingSize = t.importFileSize;
        const incomingName = t.importFileName;
        const mergedSize =
          typeof incomingSize === 'number' && Number.isFinite(incomingSize) && incomingSize >= 0
            ? Math.min(Math.floor(incomingSize), MAX_DATASHEET_IMPORT_BYTES)
            : typeof prevTm?.importFileSize === 'number' && Number.isFinite(prevTm.importFileSize)
              ? Math.min(Math.floor(prevTm.importFileSize), MAX_DATASHEET_IMPORT_BYTES)
              : typeof prevSm?.fileSize === 'number' && Number.isFinite(prevSm.fileSize)
                ? Math.min(Math.floor(prevSm.fileSize), MAX_DATASHEET_IMPORT_BYTES)
                : undefined;
        const mergedName =
          typeof incomingName === 'string' && incomingName.trim()
            ? clampStr(incomingName.trim(), BOT_FIELD_MAX.knowledgeDatasheetImportFileName)
            : typeof prevTm?.importFileName === 'string' && prevTm.importFileName.trim()
              ? clampStr(prevTm.importFileName.trim(), BOT_FIELD_MAX.knowledgeDatasheetImportFileName)
              : typeof prevSm?.fileName === 'string' && prevSm.fileName.trim()
                ? clampStr(prevSm.fileName.trim(), BOT_FIELD_MAX.knowledgeDatasheetImportFileName)
                : undefined;
        const prevTmFull = ((current as { tableMeta?: Record<string, unknown> } | null)?.tableMeta ??
          {}) as Record<string, unknown>;
        const tableMeta: Record<string, unknown> = {
          ...prevTmFull,
          tableIndex: i,
          rowCount: rows.length,
          columnCount: columns.length,
        };
        if (mergedSize != null) tableMeta.importFileSize = mergedSize;
        if (mergedName) tableMeta.importFileName = mergedName;

        const trainedRow = current as { lastTrainedAt?: Date } | null;
        const stPatch = this.resolveTrainableContentStatusPatch(
          trainingSettingsTbl,
          {
            needsRetrain: !sameHash,
            now: contentNow,
            hasTrainedBefore: this.hasTrainedBeforeFromLean(trainedRow),
            smartSchedule: {
              kind: 'table',
              rowCount: rows.length,
              approxChars: typeof m.characterCount === 'number' ? m.characterCount : 0,
            },
            currentStatus: normalizeKnowledgeTrainingStatus(
              (current as { status?: string } | null)?.status,
            ) as KnowledgeBaseItemTrainingStatus,
          },
          options,
        );
        const $set: Record<string, unknown> = {
          title,
          content: hasContent ? content : '',
          contentHash: hash,
          tableMeta,
          rawContent: rawPayload,
          active: hasContent && active,
          characterCount: m.characterCount,
          lastContentUpdatedAt: contentNow,
          updatedAt: contentNow,
          extractionStatus: 'not_required',
        };
        if (!('preserveTrainingLifecycle' in stPatch && stPatch.preserveTrainingLifecycle)) {
          Object.assign($set, stPatch.$set);
        }
        const up: { $set: Record<string, unknown>; $unset?: Record<string, 1> } = { $set };
        if (!('preserveTrainingLifecycle' in stPatch && stPatch.preserveTrainingLifecycle) && stPatch.$unset) {
          up.$unset = stPatch.$unset;
        }
        up.$unset = { ...(up.$unset ?? {}), sourceMeta: 1 };
        await this.itemModel.updateOne({ _id: existing._id }, up);
        upserted++;
        byIndex.delete(i);
        continue;
      }

      const rawNew = hasContent ? JSON.stringify({ title, columns, rows }) : undefined;
      const insSize = t.importFileSize;
      const insName = t.importFileName;
      const cSize =
        typeof insSize === 'number' && Number.isFinite(insSize) && insSize >= 0
          ? Math.min(Math.floor(insSize), MAX_DATASHEET_IMPORT_BYTES)
          : undefined;
      const cName =
        typeof insName === 'string' && insName.trim()
          ? clampStr(insName.trim(), BOT_FIELD_MAX.knowledgeDatasheetImportFileName)
          : undefined;
      const createTableMeta: { tableIndex: number; importFileName?: string; importFileSize?: number } = {
        tableIndex: i,
      };
      if (cSize != null) createTableMeta.importFileSize = cSize;
      if (cName) createTableMeta.importFileName = cName;

      const stTableNew = this.newKbItemTrainingFields(trainingSettingsTbl, contentNow, {
        forceInitialTraining: options?.forceInitialTraining,
        hasContent,
        active: hasContent && active,
        smartSchedule: {
          kind: 'table',
          rowCount: rows.length,
          approxChars: typeof m.characterCount === 'number' ? m.characterCount : 0,
        },
      });

      await this.itemModel.create({
        botId: botOid,
        title,
        sourceType: 'table',
        content: hasContent ? content : '',
        contentHash: hash,
        tableMeta: createTableMeta,
        rawContent: rawNew,
        characterCount: m.characterCount,
        lastContentUpdatedAt: contentNow,
        extractionStatus: 'not_required',
        ...stTableNew,
      });
      upserted++;
    }

    const deactivated = await this.deactivateMissingTableKnowledgeItemsForBot(botId, tables.length);
    await this.refreshBotKnowledgeStats(botId);
    await this.scheduleScopeTrainingAfterUpsert(botId, 'table', trainingSettingsTbl, options);
    await this.kickOosReconcile(botId, 'kb_table_upsert');
    return { upserted, deactivated };
  }

  async countTableKnowledgeItemsForBot(botId: string): Promise<number> {
    if (!Types.ObjectId.isValid(botId)) return 0;
    return this.itemModel.countDocuments({
      botId: new Types.ObjectId(botId),
      sourceType: 'table',
      $and: [knowledgeItemExcludeDeletedOnlyClause()],
    });
  }

  async allocateTableIndexForBot(botId: string): Promise<number> {
    if (!Types.ObjectId.isValid(botId)) return 0;
    const botOid = new Types.ObjectId(botId);
    const rows = await this.itemModel
      .find({ botId: botOid, sourceType: 'table', $and: [knowledgeItemExcludeDeletedOnlyClause()] })
      .select('tableMeta.tableIndex')
      .lean();
    let max = -1;
    for (const r of rows) {
      const i = (r as { tableMeta?: { tableIndex?: number } }).tableMeta?.tableIndex;
      if (typeof i === 'number' && i > max) max = i;
    }
    return max + 1;
  }

  /**
   * Placeholder row while {@link TableImportJob} parses CSV/XLSX from S3 (never uses document extraction).
   */
  async createAsyncTableImportPlaceholder(params: {
    botId: string;
    title: string;
    tableIndex: number;
    columns: string[];
    previewRows: string[][];
    importFileName: string;
    importFileSize: number;
  }): Promise<{ _id: Types.ObjectId }> {
    const botOid = new Types.ObjectId(params.botId);
    const now = new Date();
    const previewText = buildTableEmbeddingText(params.title, params.columns, params.previewRows);
    const hash = computeEmbeddingInputHash(previewText);
    const raw = JSON.stringify({
      title: params.title,
      columns: params.columns,
      rows: params.previewRows,
    });
    const doc = await this.itemModel.create({
      botId: botOid,
      title: params.title,
      sourceType: 'table',
      status: 'pending',
      active: true,
      content: '',
      rawContent: raw,
      characterCount: 0,
      contentHash: hash,
      extractionStatus: 'not_required',
      tableMeta: {
        tableIndex: params.tableIndex,
        importFileName: clampStr(params.importFileName.trim(), BOT_FIELD_MAX.knowledgeDatasheetImportFileName),
        importFileSize: Math.min(Math.floor(params.importFileSize), MAX_DATASHEET_IMPORT_BYTES),
        importPhase: 'import_queued',
      },
      lastContentUpdatedAt: now,
      updatedAt: now,
    });
    return { _id: (doc as { _id: Types.ObjectId })._id };
  }

  async finalizeAsyncTableImportSuccess(
    botId: string,
    kbItemId: Types.ObjectId,
    data: {
      title: string;
      columns: string[];
      rows: string[][];
      importFileName?: string;
      importFileSize?: number;
      tableIndex: number;
    },
    options?: { skipScopeTrainingSchedule?: boolean },
  ): Promise<void> {
    const trainingSettingsTbl = await this.getBotTrainingSettings(botId);
    const title = (data.title ?? '').trim() || `Table ${data.tableIndex + 1}`;
    const columns = data.columns;
    const rows = data.rows;
    assertTableKnowledgeFitsMongoPersistOrThrow(title, columns, rows);
    const textForHash = buildTableEmbeddingText(title, columns, rows);
    const hash = computeEmbeddingInputHash(textForHash);
    const content = textForHash;
    const m = metricsForTableRow({ title, columns, rows });
    const contentNow = new Date();
    const rawPayload = JSON.stringify({ title, columns, rows });
    await this.botKbTotalLimit.assertWithinLimit(botId, {
      replacingItemIds: [kbItemId],
      incomingBytes: calculateTableKnowledgeUsageBytes({
        sourceType: 'table',
        content,
        rawContent: rawPayload,
      }),
    });

    const current = await this.itemModel
      .findById(kbItemId)
      .select('lastTrainedAt status tableMeta sourceMeta active')
      .lean();
    const prevTm = (current as { tableMeta?: Record<string, unknown> } | null)?.tableMeta ?? {};
    const prevSm = (current as { sourceMeta?: { fileSize?: number; fileName?: string } | null } | null)?.sourceMeta;
    const incomingSize = data.importFileSize;
    const incomingName = data.importFileName;
    const mergedSize =
      typeof incomingSize === 'number' && Number.isFinite(incomingSize) && incomingSize >= 0
        ? Math.min(Math.floor(incomingSize), MAX_DATASHEET_IMPORT_BYTES)
        : typeof (prevTm as { importFileSize?: number }).importFileSize === 'number'
          ? (prevTm as { importFileSize: number }).importFileSize
          : typeof prevSm?.fileSize === 'number'
            ? Math.min(Math.floor(prevSm.fileSize), MAX_DATASHEET_IMPORT_BYTES)
            : undefined;
    const mergedName =
      typeof incomingName === 'string' && incomingName.trim()
        ? clampStr(incomingName.trim(), BOT_FIELD_MAX.knowledgeDatasheetImportFileName)
        : typeof (prevTm as { importFileName?: string }).importFileName === 'string' &&
            (prevTm as { importFileName: string }).importFileName.trim()
          ? clampStr((prevTm as { importFileName: string }).importFileName.trim(), BOT_FIELD_MAX.knowledgeDatasheetImportFileName)
          : typeof prevSm?.fileName === 'string' && prevSm.fileName.trim()
            ? clampStr(prevSm.fileName.trim(), BOT_FIELD_MAX.knowledgeDatasheetImportFileName)
            : undefined;

    const tableMeta: Record<string, unknown> = {
      ...prevTm,
      tableIndex: data.tableIndex,
      importPhase: 'complete',
      importedAt: contentNow,
      rowCount: rows.length,
      columnCount: columns.length,
    };
    if (mergedSize != null) tableMeta.importFileSize = mergedSize;
    if (mergedName) tableMeta.importFileName = mergedName;
    delete tableMeta.importError;
    delete tableMeta.importErrorCode;

    const stPatch = this.buildTrainableContentStatus(trainingSettingsTbl, {
      needsRetrain: true,
      now: contentNow,
      hasTrainedBefore: this.hasTrainedBeforeFromLean(current as { lastTrainedAt?: Date } | null),
      smartSchedule: {
        kind: 'table',
        rowCount: rows.length,
        approxChars: typeof m.characterCount === 'number' ? m.characterCount : 0,
      },
      currentStatus: normalizeKnowledgeTrainingStatus((current as { status?: string } | null)?.status),
    });

    const prevActive = (current as { active?: boolean } | null)?.active;
    const resolvedActive = prevActive === false ? false : true;

    const $set: Record<string, unknown> = {
      title,
      content,
      contentHash: hash,
      tableMeta,
      rawContent: rawPayload,
      active: resolvedActive,
      characterCount: m.characterCount,
      lastContentUpdatedAt: contentNow,
      updatedAt: contentNow,
      extractionStatus: 'not_required',
    };
    if (!('preserveTrainingLifecycle' in stPatch && stPatch.preserveTrainingLifecycle)) {
      Object.assign($set, stPatch.$set);
    }
    const up: { $set: Record<string, unknown>; $unset?: Record<string, 1> } = { $set };
    if (!('preserveTrainingLifecycle' in stPatch && stPatch.preserveTrainingLifecycle) && stPatch.$unset) {
      up.$unset = stPatch.$unset;
    }
    up.$unset = { ...(up.$unset ?? {}), sourceMeta: 1 };
    const preserve =
      'preserveTrainingLifecycle' in stPatch && stPatch.preserveTrainingLifecycle;
    const mergedStatus =
      preserve ? undefined : typeof ($set as { status?: string }).status === 'string'
        ? ($set as { status: string }).status
        : undefined;
    if (!preserve && mergedStatus !== undefined && mergedStatus !== 'failed') {
      up.$unset = { ...(up.$unset ?? {}), trainingError: 1 };
    }
    await this.itemModel.updateOne({ _id: kbItemId }, up);
    await this.refreshBotKnowledgeStats(botId);
    if (!options?.skipScopeTrainingSchedule && trainingSettingsTbl.autoTrainEnabled) {
      await this.knowledgeTrainingJobService.scheduleTrainingForScopes(botId, ['table']);
    }
    await this.kickOosReconcile(botId, 'kb_table_finalize_import');
  }

  /**
   * Table grid parsed in memory but bot total KB quota blocks persisting as billable training content.
   * Persists grid like success so the customer can free space and retry; stored bytes include this row
   * while {@link KnowledgeBaseItem.trainingError} is {@link PLAN_LIMIT_BOT_KB_TOTAL_CODE} (not trainable until reconciled).
   */
  async persistTableGridBotKbLimitExceeded(
    botId: string,
    kbItemId: Types.ObjectId,
    data: {
      title: string;
      columns: string[];
      rows: string[][];
      importFileName?: string;
      importFileSize?: number;
      tableIndex: number;
    },
  ): Promise<void> {
    const title = (data.title ?? '').trim() || `Table ${data.tableIndex + 1}`;
    const columns = data.columns;
    const rows = data.rows;
    assertTableKnowledgeFitsMongoPersistOrThrow(title, columns, rows);
    const textForHash = buildTableEmbeddingText(title, columns, rows);
    const hash = computeEmbeddingInputHash(textForHash);
    const content = textForHash;
    const m = metricsForTableRow({ title, columns, rows });
    const contentNow = new Date();
    const rawPayload = JSON.stringify({ title, columns, rows });
    const current = await this.itemModel
      .findById(kbItemId)
      .select('lastTrainedAt status tableMeta sourceMeta')
      .lean();
    const prevTm = (current as { tableMeta?: Record<string, unknown> } | null)?.tableMeta ?? {};
    const prevSm = (current as { sourceMeta?: { fileSize?: number; fileName?: string } | null } | null)?.sourceMeta;
    const incomingSize = data.importFileSize;
    const incomingName = data.importFileName;
    const mergedSize =
      typeof incomingSize === 'number' && Number.isFinite(incomingSize) && incomingSize >= 0
        ? Math.min(Math.floor(incomingSize), MAX_DATASHEET_IMPORT_BYTES)
        : typeof (prevTm as { importFileSize?: number }).importFileSize === 'number'
          ? (prevTm as { importFileSize: number }).importFileSize
          : typeof prevSm?.fileSize === 'number'
            ? Math.min(Math.floor(prevSm.fileSize), MAX_DATASHEET_IMPORT_BYTES)
            : undefined;
    const mergedName =
      typeof incomingName === 'string' && incomingName.trim()
        ? clampStr(incomingName.trim(), BOT_FIELD_MAX.knowledgeDatasheetImportFileName)
        : typeof (prevTm as { importFileName?: string }).importFileName === 'string' &&
            (prevTm as { importFileName: string }).importFileName.trim()
          ? clampStr((prevTm as { importFileName: string }).importFileName.trim(), BOT_FIELD_MAX.knowledgeDatasheetImportFileName)
          : typeof prevSm?.fileName === 'string' && prevSm.fileName.trim()
            ? clampStr(prevSm.fileName.trim(), BOT_FIELD_MAX.knowledgeDatasheetImportFileName)
            : undefined;
    const tableMeta: Record<string, unknown> = {
      ...prevTm,
      tableIndex: data.tableIndex,
      importPhase: 'complete',
      importedAt: contentNow,
      rowCount: rows.length,
      columnCount: columns.length,
    };
    if (mergedSize != null) tableMeta.importFileSize = mergedSize;
    if (mergedName) tableMeta.importFileName = mergedName;
    delete tableMeta.importError;
    delete tableMeta.importErrorCode;
    await this.itemModel.updateOne(
      { _id: kbItemId },
      {
        $set: {
          title,
          content,
          contentHash: hash,
          tableMeta,
          rawContent: rawPayload,
          active: true,
          characterCount: m.characterCount,
          lastContentUpdatedAt: contentNow,
          updatedAt: contentNow,
          extractionStatus: 'not_required',
          status: 'failed',
          trainingError: PLAN_LIMIT_BOT_KB_TOTAL_CODE,
        },
        $unset: {
          lastQueuedAt: 1,
          runAfter: 1,
          sourceMeta: 1,
        },
      },
    );
    await this.refreshBotKnowledgeStats(botId);
  }

  async finalizeAsyncTableImportFailure(
    kbItemId: Types.ObjectId,
    code: string,
    message: string,
    botIdForStats: string,
  ): Promise<void> {
    const row = await this.itemModel.findById(kbItemId).select('tableMeta').lean();
    const prevTm = (row as { tableMeta?: Record<string, unknown> } | null)?.tableMeta ?? {};
    const now = new Date();
    await this.itemModel.updateOne(
      { _id: kbItemId },
      {
        $set: {
          status: 'pending',
          tableMeta: {
            ...prevTm,
            importPhase: 'import_failed',
            importErrorCode: code,
            importError: clampStr(message.trim(), 2000) || 'import_failed',
          },
          updatedAt: now,
        },
      },
    );
    await this.refreshBotKnowledgeStats(botIdForStats);
  }

  /**
   * After a failed async table import, customer retry: clear import error UI fields and show import queued again.
   * Does not change the {@link TableImportJob} row — caller requeues the job.
   */
  async resetTableKnowledgeItemImportRetryState(botId: string, kbItemId: Types.ObjectId): Promise<void> {
    if (!Types.ObjectId.isValid(botId)) return;
    const now = new Date();
    await this.itemModel.updateOne(
      {
        _id: kbItemId,
        botId: new Types.ObjectId(botId),
        sourceType: 'table',
        $and: [knowledgeItemExcludeDeletedOnlyClause()],
      },
      {
        $set: {
          'tableMeta.importPhase': 'import_queued',
          status: 'pending',
          updatedAt: now,
        },
        $unset: { 'tableMeta.importError': 1, 'tableMeta.importErrorCode': 1 },
      },
    );
    await this.refreshBotKnowledgeStats(botId);
  }

  /**
   * Soft-deletes a table KB row (e.g. failed import job setup). Chunks/jobs cleared; hard purge later.
   */
  async removeTableKnowledgeItemForBot(botId: string, kbItemId: Types.ObjectId): Promise<void> {
    await this.softDeleteKnowledgeItemsMatching(botId, { _id: kbItemId, sourceType: 'table' });
  }

  async linkTableImportJobToKbItem(kbItemId: Types.ObjectId, jobId: Types.ObjectId): Promise<void> {
    await this.itemModel.updateOne(
      { _id: kbItemId },
      {
        $set: {
          'tableMeta.tableImportJobId': jobId,
          'tableMeta.importPhase': 'import_queued',
          updatedAt: new Date(),
        },
      },
    );
  }

  async setTableKbImportPhase(
    kbItemId: Types.ObjectId,
    phase: 'import_queued' | 'importing',
  ): Promise<void> {
    await this.itemModel.updateOne(
      { _id: kbItemId },
      { $set: { 'tableMeta.importPhase': phase, updatedAt: new Date() } },
    );
  }

  async deactivateMissingTableKnowledgeItemsForBot(botId: string, tableCount: number): Promise<number> {
    return this.softDeleteKnowledgeItemsMatching(botId, {
      sourceType: 'table',
      'tableMeta.tableIndex': { $gte: tableCount },
    });
  }

  /**
   * Remove a suggestion chip KB row (soft-delete + chunk cleanup). Used when a chip becomes label-only.
   */
  private async hardDeleteSuggestionKnowledgeItemById(botId: string, itemId: Types.ObjectId): Promise<void> {
    await this.softDeleteKnowledgeItemsMatching(botId, {
      _id: itemId,
      sourceType: 'suggestion',
    });
  }

  /**
   * Sync widget `exampleQuestions` to KnowledgeBaseItems (`sourceType: suggestion`).
   * Scoped rows enqueue when Auto Train is on.
   *
   * **Label-only chips (no `context`):** no `KnowledgeBaseItem` is kept — chips are UI-only. Any prior scoped row
   * for that index is hard-deleted so stats, retrieval, and training overview are not inflated.
   */
  async upsertSuggestionKnowledgeItemsForBot(
    botId: string,
    questions: ExampleQuestionDoc[],
    options?: { skipKbTotalLimitAssert?: boolean },
  ): Promise<void> {
    if (!Types.ObjectId.isValid(botId)) return;
    if (!options?.skipKbTotalLimitAssert) {
      await this.botKbTotalLimit.assertWithinLimit(botId, {
        replacingSourceTypes: ['suggestion'],
        incomingBytes: incomingSuggestionSectionUtf8Bytes(questions),
      });
    }
    const botOid = new Types.ObjectId(botId);
    const trainingSettings = await this.getBotTrainingSettings(botId);
    const maxIdx = Math.min(questions.length, EXAMPLE_QUESTIONS_STORAGE_MAX);
    const now = new Date();
    let shouldScheduleSuggestionJob = false;

    const existingItems = await this.itemModel
      .find({ botId: botOid, sourceType: 'suggestion' })
      .select('_id suggestionMeta')
      .lean();
    const byIndex = new Map<number, { _id: Types.ObjectId }>();
    for (const item of existingItems) {
      const meta = (item as { suggestionMeta?: { suggestionIndex?: number } }).suggestionMeta;
      if (meta?.suggestionIndex != null) {
        byIndex.set(meta.suggestionIndex, { _id: (item as { _id: Types.ObjectId })._id });
      }
    }

    for (let i = 0; i < maxIdx; i++) {
      const q = questions[i]!;
      const chipText = (q.label ?? '').trim().slice(0, BOT_FIELD_MAX.exampleQuestion);
      if (!chipText) continue;
      const scoped = clampStrUtf8Bytes((q.context ?? '').trim(), KNOWLEDGE_ITEM_BODY_MAX_UTF8_BYTES);
      const hasScoped = Boolean(scoped);

      if (!hasScoped) {
        const existing = byIndex.get(i);
        if (existing) {
          await this.hardDeleteSuggestionKnowledgeItemById(botId, existing._id);
        }
        continue;
      }

      const embedText = buildSuggestionEmbeddingText(chipText, scoped);
      const hash = computeEmbeddingInputHash(embedText);
      const m = metricsForSuggestionRow({ chipText, scopedInformation: scoped });
      const suggestionMeta = {
        suggestionIndex: i,
        chipText,
        ...(scoped ? { scopedInformation: scoped } : {}),
        displayOrder: i,
      };
      const rawPayload = JSON.stringify({ label: chipText, ...(scoped ? { context: scoped } : {}) });
      const contentNow = new Date();

      const existing = byIndex.get(i);
      if (existing) {
        const current = await this.itemModel
          .findById(existing._id)
          .select('status contentHash lastTrainedAt')
          .lean();
        const sameHash = (current as { contentHash?: string } | null)?.contentHash === hash;
        const stPatch = this.buildTrainableContentStatus(trainingSettings, {
          needsRetrain: !sameHash,
          now: contentNow,
          hasTrainedBefore: this.hasTrainedBeforeFromLean(
            current as { lastTrainedAt?: Date } | null,
          ),
          smartSchedule: { kind: 'suggestion' },
          currentStatus: normalizeKnowledgeTrainingStatus(
            (current as { status?: string } | null)?.status,
          ) as KnowledgeBaseItemTrainingStatus,
        });
        const $set: Record<string, unknown> = {
          title: chipText,
          content: embedText,
          contentHash: hash,
          suggestionMeta,
          rawContent: rawPayload,
          characterCount: m.characterCount,
          lastContentUpdatedAt: contentNow,
          updatedAt: contentNow,
          active: true,
          extractionStatus: 'not_required',
        };
        if (!('preserveTrainingLifecycle' in stPatch && stPatch.preserveTrainingLifecycle)) {
          Object.assign($set, stPatch.$set);
        }
        const up: { $set: Record<string, unknown>; $unset?: Record<string, 1> } = { $set };
        if (!('preserveTrainingLifecycle' in stPatch && stPatch.preserveTrainingLifecycle) && stPatch.$unset) {
          up.$unset = stPatch.$unset;
        }
        up.$unset = { ...(up.$unset ?? {}), deletedAt: 1 };
        await this.itemModel.updateOne({ _id: existing._id }, up);
        if (!('preserveTrainingLifecycle' in stPatch && stPatch.preserveTrainingLifecycle)) {
          const st = typeof $set.status === 'string' ? $set.status : '';
          if (st === 'queued' || st === 'processing') {
            shouldScheduleSuggestionJob = true;
          }
        }
        byIndex.delete(i);
        continue;
      }

      const stNew = (() => {
        if (trainingSettings.autoTrainEnabled) {
          return {
            row: {
              status: 'queued' as const,
              title: chipText,
              content: embedText,
              contentHash: hash,
              suggestionMeta,
              rawContent: rawPayload,
              characterCount: m.characterCount,
              lastContentUpdatedAt: contentNow,
              lastQueuedAt: contentNow,
              runAfter: computeAutomaticItemRunAfter(
                contentNow,
                trainingSettings.trainingDelayMinutes,
                false,
              ),
              active: true,
              extractionStatus: 'not_required' as const,
            },
          };
        }
        return {
          row: {
            status: 'pending' as const,
            title: chipText,
            content: embedText,
            contentHash: hash,
            suggestionMeta,
            rawContent: rawPayload,
            characterCount: m.characterCount,
            lastContentUpdatedAt: contentNow,
            active: true,
            extractionStatus: 'not_required' as const,
          },
        };
      })();

      await this.itemModel.create({
        botId: botOid,
        sourceType: 'suggestion',
        ...stNew.row,
      });
      if (trainingSettings.autoTrainEnabled && stNew.row.status === 'queued') {
        shouldScheduleSuggestionJob = true;
      }
    }

    await this.deactivateMissingSuggestionKnowledgeItemsForBot(botId, maxIdx);
    await this.refreshBotKnowledgeStats(botId);
    if (trainingSettings.autoTrainEnabled && shouldScheduleSuggestionJob) {
      await this.knowledgeTrainingJobService.scheduleTrainingForScopes(botId, ['suggestion']);
    }
    await this.kickOosReconcile(botId, 'kb_suggestion_upsert');
  }

  /**
   * Before `POST …/suggestions/sync` replaces the full chip list: same `knowledge_training_busy` semantics as
   * `PATCH …/suggestions/:index/scope` when **existing scoped KB text** changes or its slot is dropped.
   * Label-only chip changes do not pass this gate.
   */
  async assertSuggestionListSyncScopeTrainingGate(botId: string, newDocs: ExampleQuestionDoc[]): Promise<void> {
    if (!Types.ObjectId.isValid(botId)) return;
    const botOid = new Types.ObjectId(botId);
    const rows = await this.itemModel
      .find({
        botId: botOid,
        sourceType: 'suggestion',
        active: { $ne: false },
        $and: [knowledgeItemExcludeDeletedOnlyClause()],
      })
      .select('_id suggestionMeta')
      .lean();
    type Meta = { suggestionIndex?: number; scopedInformation?: string };
    for (const row of rows) {
      const meta = (row as { suggestionMeta?: Meta }).suggestionMeta;
      const idx = meta?.suggestionIndex;
      if (idx == null || idx < 0) continue;
      const kbScoped = String(meta?.scopedInformation ?? '').trim();
      if (!kbScoped) continue;
      const newCtx = idx < newDocs.length ? (newDocs[idx]!.context ?? '').trim() : '';
      const removedFromList = idx >= newDocs.length;
      if (!removedFromList && newCtx === kbScoped) continue;
      await this.assertKbContentPatchTrainingGate(botId, String((row as { _id: Types.ObjectId })._id));
    }
  }

  /**
   * Customer `PATCH …/suggestions/:index/label` — updates chip text on the bot; re-syncs KB row only when
   * that chip already has scoped content. Does **not** apply the KB busy-training gate (scoped edits use
   * `PATCH …/scope`).
   */
  async patchCustomerSuggestionChipLabel(botId: string, suggestionIndex: number, labelIn: string): Promise<void> {
    if (!Types.ObjectId.isValid(botId)) {
      throw new HttpException({ error: 'Invalid bot id' }, HttpStatus.BAD_REQUEST);
    }
    const chipText = clampStrUtf8Bytes(labelIn.trim(), BOT_FIELD_MAX.exampleQuestion);
    if (!chipText) {
      throw new HttpException({ error: 'label is required' }, HttpStatus.BAD_REQUEST);
    }
    const botOid = new Types.ObjectId(botId);
    const bot = await this.botModel.findById(botOid).select('exampleQuestions').lean();
    if (!bot) {
      throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
    }
    const docs = parseExampleQuestionsFromDoc((bot as { exampleQuestions?: unknown }).exampleQuestions);
    if (suggestionIndex < 0 || suggestionIndex >= docs.length) {
      throw new HttpException({ error: 'Invalid suggestion index' }, HttpStatus.BAD_REQUEST);
    }
    const prev = docs[suggestionIndex]!;
    docs[suggestionIndex] = {
      label: chipText,
      ...(prev.context?.trim() ? { context: prev.context.trim() } : {}),
      ...(prev.active === false ? { active: false } : {}),
      ...(prev.hideChipTextInChat === true ? { hideChipTextInChat: true } : {}),
    };
    await this.botModel.updateOne(
      { _id: botOid },
      { $set: { exampleQuestions: exampleQuestionDocsToMongoArray(docs), updatedAt: new Date() } },
    );

    const scoped = (prev.context ?? '').trim();
    if (!scoped) {
      await this.refreshBotKnowledgeStats(botId);
      await this.kickOosReconcile(botId, 'kb_suggestion_chip_patch');
      return;
    }

    const existingItems = await this.itemModel
      .find({
        botId: botOid,
        sourceType: 'suggestion',
        $and: [knowledgeItemExcludeDeletedOnlyClause()],
      })
      .select('_id suggestionMeta')
      .lean();
    let existingId: Types.ObjectId | null = null;
    for (const item of existingItems) {
      const meta = (item as { suggestionMeta?: { suggestionIndex?: number } }).suggestionMeta;
      if (meta?.suggestionIndex === suggestionIndex) {
        existingId = (item as { _id: Types.ObjectId })._id;
        break;
      }
    }
    if (!existingId) {
      await this.refreshBotKnowledgeStats(botId);
      await this.kickOosReconcile(botId, 'kb_suggestion_chip_patch');
      return;
    }

    const trainingSettings = await this.getBotTrainingSettings(botId);
    const embedText = buildSuggestionEmbeddingText(chipText, scoped);
    const hash = computeEmbeddingInputHash(embedText);
    const m = metricsForSuggestionRow({ chipText, scopedInformation: scoped });
    const suggestionMeta = {
      suggestionIndex,
      chipText,
      scopedInformation: scoped,
      displayOrder: suggestionIndex,
    };
    const rawPayload = JSON.stringify({ label: chipText, context: scoped });
    const contentNow = new Date();
    const current = await this.itemModel.findById(existingId).select('status contentHash lastTrainedAt active').lean();
    const sameHash = (current as { contentHash?: string } | null)?.contentHash === hash;
    const activeNow = (current as { active?: boolean } | null)?.active !== false;
    const stPatch = this.buildTrainableContentStatus(trainingSettings, {
      needsRetrain: !sameHash,
      now: contentNow,
      hasTrainedBefore: this.hasTrainedBeforeFromLean(current as { lastTrainedAt?: Date } | null),
      smartSchedule: { kind: 'suggestion' },
      currentStatus: normalizeKnowledgeTrainingStatus((current as { status?: string } | null)?.status) as KnowledgeBaseItemTrainingStatus,
    });
    const $set: Record<string, unknown> = {
      title: chipText,
      content: embedText,
      contentHash: hash,
      suggestionMeta,
      rawContent: rawPayload,
      characterCount: m.characterCount,
      lastContentUpdatedAt: contentNow,
      updatedAt: contentNow,
      active: activeNow,
      extractionStatus: 'not_required',
    };
    if (!('preserveTrainingLifecycle' in stPatch && stPatch.preserveTrainingLifecycle)) {
      Object.assign($set, stPatch.$set);
    }
    const up: { $set: Record<string, unknown>; $unset?: Record<string, 1> } = { $set };
    if (!('preserveTrainingLifecycle' in stPatch && stPatch.preserveTrainingLifecycle) && stPatch.$unset) {
      up.$unset = stPatch.$unset;
    }
    up.$unset = { ...(up.$unset ?? {}), deletedAt: 1 };
    await this.itemModel.updateOne({ _id: existingId }, up);
    let shouldSchedule = false;
    if (!('preserveTrainingLifecycle' in stPatch && stPatch.preserveTrainingLifecycle)) {
      const st = typeof $set.status === 'string' ? $set.status : '';
      if (st === 'queued' || st === 'processing') shouldSchedule = true;
    }
    await this.refreshBotKnowledgeStats(botId);
    if (trainingSettings.autoTrainEnabled && shouldSchedule) {
      await this.knowledgeTrainingJobService.scheduleTrainingForScopes(botId, ['suggestion']);
    }
    await this.kickOosReconcile(botId, 'kb_suggestion_chip_patch');
  }

  /**
   * Customer `PATCH …/suggestions/:index/scope` — asserts storage **before** persisting scoped text + KB row.
   * Chip label is unchanged; bot document is updated only after KB-side checks succeed.
   */
  async patchCustomerSuggestionScope(botId: string, suggestionIndex: number, contextIn: string): Promise<void> {
    if (!Types.ObjectId.isValid(botId)) {
      throw new HttpException({ error: 'Invalid bot id' }, HttpStatus.BAD_REQUEST);
    }
    const scopedNewRaw = clampStrUtf8Bytes(contextIn.trim(), KNOWLEDGE_ITEM_BODY_MAX_UTF8_BYTES);
    const scopedNew = scopedNewRaw.trim();

    const botOid = new Types.ObjectId(botId);
    const bot = await this.botModel.findById(botOid).select('exampleQuestions').lean();
    if (!bot) {
      throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
    }
    const docs = parseExampleQuestionsFromDoc((bot as { exampleQuestions?: unknown }).exampleQuestions);
    if (suggestionIndex < 0 || suggestionIndex >= docs.length) {
      throw new HttpException({ error: 'Invalid suggestion index' }, HttpStatus.BAD_REQUEST);
    }
    const prevEntry = docs[suggestionIndex]!;
    const chipText = (prevEntry.label ?? '').trim();
    if (!chipText) {
      throw new HttpException({ error: 'Suggestion label is missing' }, HttpStatus.BAD_REQUEST);
    }

    const existingItems = await this.itemModel
      .find({
        botId: botOid,
        sourceType: 'suggestion',
        $and: [knowledgeItemExcludeDeletedOnlyClause()],
      })
      .select('_id suggestionMeta')
      .lean();
    let existingId: Types.ObjectId | null = null;
    for (const item of existingItems) {
      const meta = (item as { suggestionMeta?: { suggestionIndex?: number } }).suggestionMeta;
      if (meta?.suggestionIndex === suggestionIndex) {
        existingId = (item as { _id: Types.ObjectId })._id;
        break;
      }
    }

    const trainingSettings = await this.getBotTrainingSettings(botId);
    let shouldSchedule = false;

    if (!scopedNew) {
      if (existingId) {
        await this.assertKbContentPatchTrainingGate(botId, String(existingId));
        await this.hardDeleteSuggestionKnowledgeItemById(botId, existingId);
      }
      docs[suggestionIndex] = {
        label: chipText,
        ...(prevEntry.active === false ? { active: false } : {}),
        ...(prevEntry.hideChipTextInChat === true ? { hideChipTextInChat: true } : {}),
      };
      await this.botModel.updateOne(
        { _id: botOid },
        { $set: { exampleQuestions: exampleQuestionDocsToMongoArray(docs), updatedAt: new Date() } },
      );
      await this.refreshBotKnowledgeStats(botId);
      await this.kickOosReconcile(botId, 'kb_suggestion_scope_patch');
      return;
    }

    const embedText = buildSuggestionEmbeddingText(chipText, scopedNew);
    const hash = computeEmbeddingInputHash(embedText);
    const m = metricsForSuggestionRow({ chipText, scopedInformation: scopedNew });
    const suggestionMeta = {
      suggestionIndex,
      chipText,
      scopedInformation: scopedNew,
      displayOrder: suggestionIndex,
    };
    const rawPayload = JSON.stringify({ label: chipText, context: scopedNew });
    const contentNow = new Date();

    if (existingId) {
      await this.assertKbContentPatchTrainingGate(botId, String(existingId));
      const incomingScopedBytes = getUtf8ByteCount(scopedNew);
      await this.botKbTotalLimit.assertWithinLimit(botId, {
        replacingItemIds: [existingId],
        incomingBytes: incomingScopedBytes,
      });
      const current = await this.itemModel.findById(existingId).select('status contentHash lastTrainedAt active').lean();
      const sameHash = (current as { contentHash?: string } | null)?.contentHash === hash;
      const activeNow = (current as { active?: boolean } | null)?.active !== false;
      const stPatch = this.buildTrainableContentStatus(trainingSettings, {
        needsRetrain: !sameHash,
        now: contentNow,
        hasTrainedBefore: this.hasTrainedBeforeFromLean(current as { lastTrainedAt?: Date } | null),
        smartSchedule: { kind: 'suggestion' },
        currentStatus: normalizeKnowledgeTrainingStatus((current as { status?: string } | null)?.status) as KnowledgeBaseItemTrainingStatus,
      });
      const $set: Record<string, unknown> = {
        title: chipText,
        content: embedText,
        contentHash: hash,
        suggestionMeta,
        rawContent: rawPayload,
        characterCount: m.characterCount,
        lastContentUpdatedAt: contentNow,
        updatedAt: contentNow,
        active: activeNow,
        extractionStatus: 'not_required',
      };
      if (!('preserveTrainingLifecycle' in stPatch && stPatch.preserveTrainingLifecycle)) {
        Object.assign($set, stPatch.$set);
      }
      const up: { $set: Record<string, unknown>; $unset?: Record<string, 1> } = { $set };
      if (!('preserveTrainingLifecycle' in stPatch && stPatch.preserveTrainingLifecycle) && stPatch.$unset) {
        up.$unset = stPatch.$unset;
      }
      up.$unset = { ...(up.$unset ?? {}), deletedAt: 1 };
      await this.itemModel.updateOne({ _id: existingId }, up);
      if (!('preserveTrainingLifecycle' in stPatch && stPatch.preserveTrainingLifecycle)) {
        const st = typeof $set.status === 'string' ? $set.status : '';
        if (st === 'queued' || st === 'processing') shouldSchedule = true;
      }
    } else {
      await this.botKbTotalLimit.assertWithinLimit(botId, {
        incomingBytes: getUtf8ByteCount(scopedNew),
      });
      const stNew = (() => {
        if (trainingSettings.autoTrainEnabled) {
          return {
            row: {
              status: 'queued' as const,
              title: chipText,
              content: embedText,
              contentHash: hash,
              suggestionMeta,
              rawContent: rawPayload,
              characterCount: m.characterCount,
              lastContentUpdatedAt: contentNow,
              lastQueuedAt: contentNow,
              runAfter: computeAutomaticItemRunAfter(
                contentNow,
                trainingSettings.trainingDelayMinutes,
                false,
              ),
              active: true,
              extractionStatus: 'not_required' as const,
            },
          };
        }
        return {
          row: {
            status: 'pending' as const,
            title: chipText,
            content: embedText,
            contentHash: hash,
            suggestionMeta,
            rawContent: rawPayload,
            characterCount: m.characterCount,
            lastContentUpdatedAt: contentNow,
            active: true,
            extractionStatus: 'not_required' as const,
          },
        };
      })();
      await this.itemModel.create({
        botId: botOid,
        sourceType: 'suggestion',
        ...stNew.row,
      });
      if (trainingSettings.autoTrainEnabled && stNew.row.status === 'queued') {
        shouldSchedule = true;
      }
    }

    docs[suggestionIndex] = {
      label: chipText,
      context: scopedNew,
      ...(prevEntry.active === false ? { active: false } : {}),
      ...(prevEntry.hideChipTextInChat === true ? { hideChipTextInChat: true } : {}),
    };
    await this.botModel.updateOne(
      { _id: botOid },
      { $set: { exampleQuestions: exampleQuestionDocsToMongoArray(docs), updatedAt: new Date() } },
    );
    await this.refreshBotKnowledgeStats(botId);
    if (trainingSettings.autoTrainEnabled && shouldSchedule) {
      await this.knowledgeTrainingJobService.scheduleTrainingForScopes(botId, ['suggestion']);
    }
    await this.kickOosReconcile(botId, 'kb_suggestion_scope_patch');
  }

  /**
   * Customer `PATCH …/suggestions/:index/hide-chip-text` — widget-only display; does not affect training or KB rows.
   */
  async patchCustomerSuggestionHideChipTextInChat(
    botId: string,
    suggestionIndex: number,
    hideChipTextInChat: boolean,
  ): Promise<void> {
    if (!Types.ObjectId.isValid(botId)) {
      throw new HttpException({ error: 'Invalid bot id' }, HttpStatus.BAD_REQUEST);
    }
    const botOid = new Types.ObjectId(botId);
    const bot = await this.botModel.findById(botOid).select('exampleQuestions').lean();
    if (!bot) {
      throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
    }
    const docs = parseExampleQuestionsFromDoc((bot as { exampleQuestions?: unknown }).exampleQuestions);
    if (suggestionIndex < 0 || suggestionIndex >= docs.length) {
      throw new HttpException({ error: 'Invalid suggestion index' }, HttpStatus.BAD_REQUEST);
    }
    const prev = docs[suggestionIndex]!;
    const label = (prev.label ?? '').trim();
    if (!label) {
      throw new HttpException({ error: 'Suggestion label is missing' }, HttpStatus.BAD_REQUEST);
    }
    docs[suggestionIndex] = {
      label,
      ...(prev.context?.trim() ? { context: prev.context.trim() } : {}),
      ...(prev.active === false ? { active: false } : {}),
      ...(hideChipTextInChat ? { hideChipTextInChat: true } : {}),
    };
    await this.botModel.updateOne(
      { _id: botOid },
      { $set: { exampleQuestions: exampleQuestionDocsToMongoArray(docs), updatedAt: new Date() } },
    );
    await this.refreshBotKnowledgeStats(botId);
    await this.kickOosReconcile(botId, 'kb_suggestion_hide_chip_patch');
  }

  async deactivateMissingSuggestionKnowledgeItemsForBot(botId: string, suggestionCount: number): Promise<number> {
    return this.softDeleteKnowledgeItemsMatching(botId, {
      sourceType: 'suggestion',
      'suggestionMeta.suggestionIndex': { $gte: suggestionCount },
    });
  }

  /**
   * Runtime: widget sends suggestion KB item id; verify trainable row for scoped-only retrieval.
   */
  /**
   * Public widget: chip label + optional `KnowledgeBaseItem` id (never scoped text).
   * Ids are present when a matching suggestion row exists in the knowledge base.
   */
  async getPublicSuggestionChipsForBot(
    botId: string,
  ): Promise<Array<{ label: string; suggestionId?: string; hideChipTextInChat?: boolean }>> {
    if (!Types.ObjectId.isValid(botId)) return [];
    const bot = await this.botModel.findById(new Types.ObjectId(botId)).select('exampleQuestions').lean();
    if (!bot) return [];
    const questions = parseExampleQuestionsFromDoc((bot as { exampleQuestions?: unknown }).exampleQuestions);
    const botOid = new Types.ObjectId(botId);
    const items = await this.itemModel
      .find({
        botId: botOid,
        sourceType: 'suggestion',
        $and: knowledgeRuntimeRetrievalMatchParts(),
      })
      .select('_id suggestionMeta')
      .lean();
    const byIndex = new Map<number, string>();
    for (const it of items) {
      const idx = (it as { suggestionMeta?: { suggestionIndex?: number } }).suggestionMeta?.suggestionIndex;
      if (typeof idx === 'number' && idx >= 0) {
        byIndex.set(idx, (it as { _id: Types.ObjectId })._id.toString());
      }
    }
    const out: Array<{ label: string; suggestionId?: string; hideChipTextInChat?: boolean }> = [];
    for (let i = 0; i < questions.length; i++) {
      const label = (questions[i]!.label ?? '').trim();
      if (!label) continue;
      const sid = byIndex.get(i);
      const hide = questions[i]!.hideChipTextInChat === true ? { hideChipTextInChat: true as const } : {};
      out.push(sid ? { label, suggestionId: sid, ...hide } : { label, ...hide });
    }
    return out;
  }

  async isValidSuggestionForScopedRetrieval(botId: string, knowledgeBaseItemId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(botId) || !Types.ObjectId.isValid(knowledgeBaseItemId)) return false;
    const it = await this.itemModel
      .findOne({
        _id: new Types.ObjectId(knowledgeBaseItemId),
        botId: new Types.ObjectId(botId),
        sourceType: 'suggestion',
        $and: knowledgeRuntimeRetrievalMatchParts(),
      })
      .select('_id suggestionMeta active deletedAt status sourceType extractionStatus isContentExtracted')
      .lean();
    if (!it) return false;
    if (
      !knowledgeBaseItemEligibleForRuntimeRetrieval(
        it as {
          active?: boolean;
          deletedAt?: Date | null;
          status?: string;
          sourceType?: string;
          extractionStatus?: string | null;
          isContentExtracted?: boolean;
        },
      )
    ) {
      return false;
    }
    const scoped = (it as { suggestionMeta?: { scopedInformation?: string } }).suggestionMeta?.scopedInformation?.trim();
    if (!scoped) return false;
    const n = await this.chunkModel.countDocuments({ knowledgeBaseItemId: (it as { _id: Types.ObjectId })._id });
    return n > 0;
  }

  findKnowledgeItemsForBot(
    botId: string,
    options?: {
      sourceType?: 'document' | 'faq' | 'note' | 'url' | 'html' | 'table' | 'suggestion';
      activeOnly?: boolean;
      statuses?: KnowledgeBaseItemTrainingStatus[];
      scopeTrainingExtractionOnly?: boolean;
    },
  ) {
    return this.knowledgeBaseItemAccess.findKnowledgeItemsForBot(botId, options);
  }

  /** Get Q&A list for a bot from KB (for admin/chat display). */
  async getFaqsForBot(
    botId: string,
    options?: { includeInactive?: boolean },
  ): Promise<
    Array<{
      title?: string;
      questions: string[];
      question: string;
      answer: string;
      active?: boolean;
    }>
  > {
    const includeInactive = options?.includeInactive === true;
    const items = await this.itemModel
      .find({
        botId: new Types.ObjectId(botId),
        sourceType: 'faq',
        ...(includeInactive ? {} : { active: true }),
        $and: [knowledgeItemExcludeDeletedOnlyClause()],
      })
      .select(
        includeInactive ? 'faqMeta active lastContentUpdatedAt createdAt' : 'faqMeta lastContentUpdatedAt createdAt',
      )
      .sort({ 'faqMeta.faqIndex': 1 })
      .lean();
    const ordered = dedupeFaqKnowledgeItemsForOrderedRead(items);
    return ordered.map((it) => {
      const meta = (it as {
        faqMeta?: {
          title?: string;
          questions?: string[];
          answer?: string;
        };
        active?: boolean;
      }).faqMeta;
      const title = String(meta?.title ?? '').trim();
      const fromArr = Array.isArray(meta?.questions) ? meta!.questions!.map((q) => String(q ?? '').trim()).filter(Boolean) : [];
      const questions = fromArr;
      const question = questions[0] ?? '';
      return {
        ...(title ? { title } : {}),
        questions,
        question,
        answer: String(meta?.answer ?? '').trim(),
        active: includeInactive ? (it as { active?: boolean }).active !== false : true,
      };
    });
  }

  /**
   * Titled snippets for workspace UI (active rows). Legacy `general_note` becomes one synthetic snippet.
   */
  async getSnippetsForBot(
    botId: string,
    options?: { includeInactive?: boolean },
  ): Promise<Array<{ title: string; snippet: string; active?: boolean }>> {
    const includeInactive = options?.includeInactive === true;
    const items = await this.itemModel
      .find({
        botId: new Types.ObjectId(botId),
        sourceType: 'note',
        ...(includeInactive ? {} : { active: true }),
        $and: [knowledgeItemExcludeDeletedOnlyClause()],
      })
      .select(includeInactive ? 'title content rawContent noteMeta active' : 'title content rawContent noteMeta')
      .sort({ 'noteMeta.snippetIndex': 1, createdAt: 1 })
      .lean() as Array<{
        title?: string;
        content?: string;
        rawContent?: string;
        noteMeta?: { kind?: string; snippetIndex?: number };
        active?: boolean;
      }>;

    const rows: Array<{ title: string; snippet: string; active?: boolean }> = [];
    for (const it of items) {
      const kind = it.noteMeta?.kind;
      if (kind === 'general_note') {
        const c = (it.content ?? '').trim();
        if (c) {
          rows.push({
            title: (it.title ?? '').trim() || 'Notes',
            snippet: c,
            active: includeInactive ? it.active !== false : true,
          });
        }
        continue;
      }
      if (kind !== 'snippet') continue;
      let body = '';
      let structuredTitle: string | undefined;
      if (it.rawContent) {
        try {
          const p = JSON.parse(it.rawContent) as { title?: string; snippet?: string };
          structuredTitle = typeof p.title === 'string' ? p.title.trim() : undefined;
          body = String(p.snippet ?? '').trim();
        } catch {
          body = (it.content ?? '').trim();
        }
      } else {
        body = (it.content ?? '').trim();
      }
      if (!body && !includeInactive) continue;
      const docTitle = (it.title ?? '').trim();
      const stitle = docTitle || (structuredTitle && structuredTitle.length > 0 ? structuredTitle : '') || 'Snippet';
      rows.push({
        title: stitle,
        snippet: body,
        active: includeInactive ? it.active !== false : true,
      });
    }
    return rows;
  }

  /**
   * Join all active snippet bodies for embed runtime `knowledgeDescription` compatibility.
   */
  async getNoteContentForBot(botId: string): Promise<string> {
    const list = await this.getSnippetsForBot(botId);
    return list
      .filter((r) => r.active !== false)
      .map((r) => r.snippet.trim())
      .filter(Boolean)
      .join('\n\n');
  }

  async getTablesForBot(
    botId: string,
    options?: { includeInactive?: boolean },
  ): Promise<Array<{ title: string; columns: string[]; rows: string[][]; active?: boolean }>> {
    const includeInactive = options?.includeInactive === true;
    const items = await this.itemModel
      .find({
        botId: new Types.ObjectId(botId),
        sourceType: 'table',
        ...(includeInactive ? {} : { active: true }),
        $and: [knowledgeItemExcludeDeletedOnlyClause()],
      })
      .select(includeInactive ? 'title rawContent tableMeta active' : 'title rawContent tableMeta')
      .sort({ 'tableMeta.tableIndex': 1, createdAt: 1 })
      .lean();

    const out: Array<{ title: string; columns: string[]; rows: string[][]; active?: boolean }> = [];
    for (const it of items) {
      const ac = (it as { active?: boolean }).active;
      if (!includeInactive && ac === false) continue;
      const titleStored = (it as { title?: string }).title?.trim() || 'Table';
      const raw = (it as { rawContent?: string }).rawContent;
      if (raw && typeof raw === 'string') {
        try {
          const p = JSON.parse(raw) as { title?: string; columns?: string[]; rows?: string[][] };
          out.push({
            title: (p.title ?? titleStored).trim() || titleStored,
            columns: Array.isArray(p.columns) ? p.columns.map((c) => String(c ?? '')) : [],
            rows: Array.isArray(p.rows) ? p.rows.map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? '')) : [])) : [],
            active: ac !== false,
          });
        } catch {
          out.push({ title: titleStored, columns: [], rows: [], active: ac !== false });
        }
      } else {
        out.push({ title: titleStored, columns: [], rows: [], active: ac !== false });
      }
    }
    return out;
  }

  /** KB-based status for admin (replaces legacy embedding job status). */
  async getKnowledgeStatusForBot(botId: string): Promise<{
    faqItemCount: number;
    noteContentLength: number;
    snippetItemCount: number;
    tableItemCount: number;
  }> {
    const [faqs, noteContent, snippets, tables] = await Promise.all([
      this.getFaqsForBot(botId),
      this.getNoteContentForBot(botId),
      this.getSnippetsForBot(botId),
      this.getTablesForBot(botId),
    ]);
    return {
      faqItemCount: faqs.length,
      noteContentLength: noteContent.length,
      snippetItemCount: snippets.length,
      tableItemCount: tables.length,
    };
  }

  async findKnowledgeItemById(id: string): Promise<KnowledgeBaseItem | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return this.itemModel.findById(new Types.ObjectId(id)).lean();
  }

  /**
   * Update training lifecycle status for a single KB item (e.g. after chunk embed / failure).
   */
  setKnowledgeItemStatusById(
    itemId: Types.ObjectId,
    status: KnowledgeBaseItemTrainingStatus,
    options?: { errorMessage?: string },
  ): Promise<void> {
    return this.knowledgeBaseItemAccess.setKnowledgeItemStatusById(itemId, status, options);
  }

  async markKnowledgeItemPending(itemId: Types.ObjectId, extra?: Record<string, unknown>): Promise<void> {
    await this.itemModel.updateOne(
      { _id: itemId },
      { $set: { status: 'pending', updatedAt: new Date(), ...extra } },
    );
  }

  async markKnowledgeItemQueued(itemId: Types.ObjectId, runAfter?: Date): Promise<void> {
    const $set: Record<string, unknown> = {
      status: 'queued',
      lastQueuedAt: new Date(),
      updatedAt: new Date(),
    };
    if (runAfter != null) $set.runAfter = runAfter;
    await this.itemModel.updateOne({ _id: itemId }, { $set });
  }

  async markKnowledgeItemProcessing(itemId: Types.ObjectId): Promise<void> {
    await this.itemModel.updateOne(
      { _id: itemId },
      { $set: { status: 'processing', lastTrainingStartedAt: new Date(), updatedAt: new Date() } },
    );
  }

  async markKnowledgeItemReady(itemId: Types.ObjectId): Promise<void> {
    const now = new Date();
    await this.itemModel.updateOne(
      { _id: itemId },
      {
        $set: {
          status: 'ready',
          lastTrainedAt: now,
          updatedAt: now,
        },
        $unset: { trainingError: 1 },
      },
    );
  }

  async markKnowledgeItemFailed(itemId: Types.ObjectId, errorMessage: string): Promise<void> {
    const msg = (errorMessage ?? '').trim() || 'failed';
    await this.itemModel.updateOne(
      { _id: itemId },
      {
        $set: { status: 'failed', trainingError: msg, updatedAt: new Date() },
      },
    );
  }

  /** Find the document-linked KnowledgeBaseItem for a given document (for chunk sync). */
  findKnowledgeItemByDocumentId(botId: string, documentId: string): Promise<{ _id: Types.ObjectId } | null> {
    return this.knowledgeBaseItemAccess.findKnowledgeItemByDocumentId(botId, documentId);
  }

  /** Debug / GET `.../documents/:id/knowledge-debug` — lean row for tooling. */
  async findDocumentKbItemLeanForDebug(botId: string, documentId: string): Promise<Record<string, unknown> | null> {
    const row = await this.knowledgeBaseItemAccess.findKbDocumentItemByRouteId(botId, documentId);
    return row as Record<string, unknown> | null;
  }

  /**
   * When a document IngestJob is queued: align KB item with schedule (same `runAfter` / `lastQueuedAt` as the job when provided).
   */
  /**
   * Schedule for Document IngestJobs: first completed training trains immediately (no delay); later retries use delay from last queue time (`computeAutomaticItemRunAfter`).
   */
  async getIngestQueueTimesForDocument(
    botId: string,
    documentId: string,
    queuedAt: Date,
  ): Promise<{ lastQueuedAt: Date; runAfter: Date }> {
    if (!Types.ObjectId.isValid(botId) || !Types.ObjectId.isValid(documentId)) {
      return { lastQueuedAt: queuedAt, runAfter: queuedAt };
    }
    const settings = await this.getBotTrainingSettings(botId);
    const filter = this.kbLiveDocumentRouteFilter(botId, documentId);
    if (!filter) {
      return { lastQueuedAt: queuedAt, runAfter: queuedAt };
    }
    const row = await this.itemModel.findOne(filter).select('lastTrainedAt').lean();
    const hasBefore = this.hasTrainedBeforeFromLean(
      row as { lastTrainedAt?: Date } | null,
    );
    const runAfter = computeAutomaticItemRunAfter(queuedAt, settings.trainingDelayMinutes, hasBefore, {
      kind: 'document',
    });
    return { lastQueuedAt: queuedAt, runAfter };
  }

  /** Merge shallow fields into KB document row `fileMeta` (canonical upload surface); no-op if row missing. */
  async mergeDocumentKbFileMetaFields(
    botId: string,
    routeId: string,
    patch: Record<string, unknown>,
  ): Promise<void> {
    if (!Types.ObjectId.isValid(botId) || !Types.ObjectId.isValid(routeId)) return;
    const filter = this.kbLiveDocumentRouteFilter(botId, routeId);
    if (!filter) return;
    const row = await this.itemModel.findOne(filter).select('fileMeta').lean();
    if (!row) return;
    const cur = (
      (((row as { fileMeta?: Record<string, unknown> }).fileMeta ?? {}) ?? {}) as Record<string, unknown>
    );
    const merged = { ...cur, ...patch };
    await this.itemModel.updateOne(filter, {
      $set: { fileMeta: merged as unknown as KnowledgeBaseItem['fileMeta'], updatedAt: new Date() },
    });
    await this.refreshBotKnowledgeStats(botId);
  }

  async markDocumentIngestionQueued(
    botId: string,
    documentId: string,
    times: { lastQueuedAt: Date; runAfter: Date },
    opts?: { setTrainingStatusQueued?: boolean },
  ): Promise<void> {
    const filter = this.kbLiveDocumentRouteFilter(botId, documentId);
    if (!filter) return;
    const setTraining = opts?.setTrainingStatusQueued !== false;
    const $set: Record<string, unknown> = {
      lastQueuedAt: times.lastQueuedAt,
      runAfter: times.runAfter,
      updatedAt: new Date(),
    };
    if (setTraining) {
      $set.status = 'queued';
    }
    await this.itemModel.updateOne(filter, { $set });
    await this.refreshBotKnowledgeStats(botId);
  }

  /**
   * When an `ExtractJob` row is created/refreshed: align KB extraction phase and optionally training `queued`.
   */
  async notifyDocumentExtractJobEnqueued(
    botId: string,
    documentId: string,
    times: { lastQueuedAt: Date; runAfter: Date },
    options: { alignTrainingStatusQueued: boolean },
  ): Promise<void> {
    const filter = this.kbLiveDocumentRouteFilter(botId, documentId);
    if (!filter) return;
    const curRow = await this.itemModel.findOne(filter).select('status').lean();
    const curSt = normalizeKnowledgeTrainingStatus(String((curRow as { status?: string })?.status ?? ''));

    const $set: Record<string, unknown> = {
      extractionStatus: 'queued',
      lastQueuedAt: times.lastQueuedAt,
      runAfter: times.runAfter,
      updatedAt: new Date(),
    };
    if (options.alignTrainingStatusQueued) {
      $set.status = 'queued';
    } else if (curSt === 'ready') {
      /** Extract re-queued without aligning training queue: embeddings must not stay “ready” for stale chunks. */
      $set.status = 'pending';
    }

    await this.itemModel.updateOne(filter, {
      $set,
      $unset: { extractionError: 1 },
    });
    await this.refreshBotKnowledgeStats(botId);
  }

  async setDocumentKbExtractionProcessing(botId: string, routeId: string): Promise<void> {
    const filter = this.kbLiveDocumentRouteFilter(botId, routeId);
    if (!filter) return;
    await this.itemModel.updateOne(filter, {
      $set: { extractionStatus: 'processing', updatedAt: new Date() },
      $unset: { extractionError: 1 },
    });
    await this.refreshBotKnowledgeStats(botId);
  }

  /**
   * Permanent text extraction failure (`ExtractJob` / source unusable). Does not set training `status=failed`.
   */
  async patchDocumentKbExtractionFailed(
    botId: string,
    routeId: string,
    message: string,
    opts?: { clearContent?: boolean },
  ): Promise<void> {
    const filter = this.kbLiveDocumentRouteFilter(botId, routeId);
    if (!filter) return;
    const msg = message.trim().slice(0, 2000) || 'extraction_failed';
    const $set: Record<string, unknown> = {
      extractionStatus: 'failed',
      extractionError: msg,
      isContentExtracted: false,
      /** Extraction failure is not a training failure — drop stale training-queue state. */
      status: 'pending',
      updatedAt: new Date(),
    };
    const $unset: Record<string, 1> = {
      extractedAt: 1,
      lastExtractedAt: 1,
      lastQueuedAt: 1,
      runAfter: 1,
      trainingError: 1,
    };
    if (opts?.clearContent) {
      $set.content = '';
      $set.characterCount = 0;
      $unset.contentHash = 1;
    }
    await this.itemModel.updateOne(filter, { $set, $unset });
    await this.refreshBotKnowledgeStats(botId);
  }

  /**
   * Persist extracted document text with extraction `done`, but training blocked by bot total KB quota.
   * Stored bytes count toward usage; the row is not trainable until reconciled or manual retry after space is available.
   */
  async persistDocumentKbExtractedBotKbLimitExceeded(
    botId: string,
    routeId: string,
    doc: DocumentLikeForSync,
  ): Promise<void> {
    const filter = this.kbLiveDocumentRouteFilter(botId, routeId);
    if (!filter) return;
    const content = normalizeKbDocumentBodyForHash(String(doc.text ?? ''));
    const titleForRow = normalizeKbDocumentTitleForRow(doc.title);
    const hash = documentKbContentFingerprint(titleForRow, content);
    const textMetrics = metricsForDocumentContent(content);
    const contentExtracted = isTrainableExtractedDocumentText(content);
    const now = new Date();
    const fileMetaMerged = mergedDocumentKbFileMetaFromSync({
      fileName: doc.fileName,
      fileType: doc.fileType,
      fileSize: doc.fileSize,
      s3Bucket: doc.s3Bucket,
      s3Key: doc.s3Key,
      url: doc.url,
      uploadSessionId: doc.uploadSessionId,
      storage: doc.storage,
    });
    const $set: Record<string, unknown> = {
      title: titleForRow,
      content,
      rawContent: content || undefined,
      contentHash: hash,
      characterCount: textMetrics.characterCount,
      isContentExtracted: contentExtracted,
      extractionStatus: 'done',
      extractedAt: now,
      lastExtractedAt: now,
      status: 'failed',
      trainingError: PLAN_LIMIT_BOT_KB_TOTAL_CODE,
      updatedAt: now,
      lastContentUpdatedAt: now,
    };
    if (fileMetaMerged) {
      $set.fileMeta = fileMetaMerged;
    }
    await this.itemModel.updateOne(filter, {
      $set,
      $unset: { extractionError: 1, lastQueuedAt: 1, runAfter: 1 },
    });
    await this.refreshBotKnowledgeStats(botId);
  }

  async markDocumentKbWaitingForSource(botId: string, routeId: string): Promise<void> {
    const filter = this.kbLiveDocumentRouteFilter(botId, routeId);
    if (!filter) return;
    await this.itemModel.updateOne(filter, {
      $set: { extractionStatus: 'waiting_for_source', updatedAt: new Date() },
      $unset: { extractionError: 1 },
    });
    await this.refreshBotKnowledgeStats(botId);
  }

  /**
   * Repairs `contentHash` when it drifted from canonical title+stored body (same formula as {@link upsertDocumentKnowledgeItem}).
   * Avoids false-positive `stale_document_text` after manual edits or legacy partial writes.
   */
  async repairDocumentKbContentHashIfDrifted(botId: string, routeDocumentId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(botId) || !Types.ObjectId.isValid(routeDocumentId)) return false;
    const row = await this.knowledgeBaseItemAccess.findKbDocumentItemByRouteId(botId, routeDocumentId);
    if (!row) return false;
    const titleForRow = normalizeKbDocumentTitleForRow(row.title);
    const bodyNorm = normalizeKbDocumentBodyForHash(String(row.content ?? ''));
    const expectedHash = documentKbContentFingerprint(titleForRow, bodyNorm);
    const curHash = String((row as { contentHash?: unknown }).contentHash ?? '').trim();
    if (curHash === expectedHash) return false;
    const filter = this.kbLiveDocumentRouteFilter(botId, routeDocumentId);
    if (!filter) return false;
    await this.itemModel.updateOne(filter, {
      $set: { contentHash: expectedHash, updatedAt: new Date() },
    });
    kbTrainingLog('document KB repaired contentHash drift', {
      botId,
      knowledgeBaseItemId: routeDocumentId,
      priorContentHashPreview: curHash.slice(0, 12),
      repairedContentHashPreview: expectedHash.slice(0, 12),
    });
    await this.refreshBotKnowledgeStats(botId);
    return true;
  }

  /**
   * Update status/active for the document-linked item (e.g. when document is set active/failed/queued).
   */
  async setDocumentKnowledgeItemStatus(
    botId: string,
    documentId: string,
    updates: {
      status?: KnowledgeBaseItemTrainingStatus;
      active?: boolean;
      /** Stored on `trainingError` when status is failed (overrides default). */
      failureReason?: string;
    },
  ): Promise<boolean> {
    if (!Types.ObjectId.isValid(botId) || !Types.ObjectId.isValid(documentId)) return false;
    const setPayload: Record<string, unknown> = { updatedAt: new Date() };
    if (updates.status != null) {
      setPayload.status = updates.status;
      if (updates.status === 'processing') {
        setPayload.lastTrainingStartedAt = new Date();
      }
      if (updates.status === 'failed') {
        const msg = (updates.failureReason ?? 'document_training_failed').trim() || 'document_training_failed';
        setPayload.trainingError = msg;
      }
      if (updates.status === 'ready') {
        const now = new Date();
        setPayload.lastTrainedAt = now;
      }
    }
    if (updates.active != null) setPayload.active = updates.active;
    const op: { $set: Record<string, unknown>; $unset?: Record<string, 1> } = { $set: setPayload };
    if (updates.status === 'ready') {
      op.$unset = { runAfter: 1, lastQueuedAt: 1, trainingError: 1 };
    }
    const filter = this.kbLiveDocumentRouteFilter(botId, documentId);
    if (!filter) return false;
    const result = await this.itemModel.updateOne(filter, op);
    const ok = (result.modifiedCount ?? 0) > 0;
    if (ok) {
      await this.refreshBotKnowledgeStats(botId);
    }
    return ok;
  }

  /**
   * Customer-facing toggle: update KB item eligibility for runtime/RAG replies.
   *
   * Updates only the canonical `active` boolean and `updatedAt`, and then refreshes
   * lightweight bot knowledge stats (no extraction/training jobs are queued here).
   */
  async setKnowledgeItemActiveById(botId: string, itemId: string, active: boolean): Promise<boolean> {
    if (!Types.ObjectId.isValid(botId) || !Types.ObjectId.isValid(itemId)) return false;
    const ok = await this.knowledgeBaseItemAccess.setKnowledgeItemActiveById(
      botId,
      new Types.ObjectId(itemId),
      active,
    );
    if (ok) {
      await this.refreshBotKnowledgeStats(botId);
    }
    return ok;
  }

  /**
   * Shared “busy training blocks this edit” gate for KB content PATCH/PUT paths (409 `knowledge_training_busy`):
   * documents, datasheet/table grids, FAQs, snippets, `POST …/suggestions/sync` scope mutations, scoped suggestion PATCH (not chip label PATCH).
   * Call before mutating a `KnowledgeBaseItem` row’s content or linked bot fields that train as KB text.
   */
  async assertKbContentPatchTrainingGate(botId: string, knowledgeItemId: string): Promise<void> {
    if (!Types.ObjectId.isValid(botId) || !Types.ObjectId.isValid(knowledgeItemId)) return;
    const row = await this.itemModel
      .findOne({
        botId: new Types.ObjectId(botId),
        _id: new Types.ObjectId(knowledgeItemId),
        active: { $ne: false },
        $and: [knowledgeItemExcludeDeletedOnlyClause()],
      })
      .select('status runAfter')
      .lean();
    if (!row) return;
    const ra = (row as { runAfter?: Date | null }).runAfter;
    if (
      kbContentPatchBlockedByTrainingGate(
        typeof (row as { status?: string }).status === 'string' ? (row as { status: string }).status : undefined,
        ra,
        Date.now(),
        KB_CONTENT_PATCH_TRAIN_GATE_IMMINENT_MS,
      )
    ) {
      throw new HttpException(
        {
          error: 'Training is in progress or about to start. Please wait a moment and try again.',
          errorCode: 'knowledge_training_busy',
        },
        HttpStatus.CONFLICT,
      );
    }
  }

  /**
   * Block datasheet **grid** PATCH (rows/title/columns) while import is in flight (`kb_table_import_busy`) or the table
   * KB row is **`queued`** / **`processing`** (`datasheet_training_busy`). Stricter than
   * {@link assertKbContentPatchTrainingGate}: always blocks `queued`, including delayed smart-schedule retrains.
   *
   * Does not apply to active-only / Use-in-replies-style edits (handled in {@link BotsService.patchWorkspaceBotKnowledgeTableAtIndex}).
   */
  async assertKnowledgeTableIndicesNotBusyForDatasheetContentPatch(
    botId: string,
    zeroBasedIndices: Iterable<number>,
  ): Promise<void> {
    if (!Types.ObjectId.isValid(botId)) {
      throw new HttpException({ error: 'Invalid bot id' }, HttpStatus.BAD_REQUEST);
    }
    const botOid = new Types.ObjectId(botId);
    const seen = new Set<number>();
    const importBusyMessage =
      'Datasheet import is in progress for this row. Cancel or finish the import before editing.';
    const trainingBusyMessage =
      'This datasheet is being trained. Please wait until training finishes before editing rows.';
    for (const rawIdx of zeroBasedIndices) {
      const idx =
        typeof rawIdx === 'number' && Number.isFinite(rawIdx) && Number.isInteger(rawIdx) ? rawIdx : NaN;
      if (!(idx >= 0) || seen.has(idx)) continue;
      seen.add(idx);
      const row = await this.itemModel
        .findOne({
          botId: botOid,
          sourceType: 'table',
          'tableMeta.tableIndex': idx,
          $and: [knowledgeItemExcludeDeletedOnlyClause()],
        })
        .select('status tableMeta')
        .lean();
      if (!row) continue;
      const phase = (row as { tableMeta?: { importPhase?: string } }).tableMeta?.importPhase;
      if (phase === 'import_queued' || phase === 'importing') {
        throw new HttpException({ error: importBusyMessage, errorCode: 'kb_table_import_busy' }, HttpStatus.CONFLICT);
      }
      const st = normalizeKnowledgeTrainingStatus(String((row as { status?: string }).status ?? ''));
      if (st === 'queued' || st === 'processing') {
        throw new HttpException(
          { error: trainingBusyMessage, errorCode: 'datasheet_training_busy' },
          HttpStatus.CONFLICT,
        );
      }
    }
  }

  /**
   * Block PATCH/PUT on datasheet/table rows while an import pipeline is queued or running (`kb_table_import_busy`).
   */
  async assertKnowledgeTableIndicesNotImportBusy(botId: string, zeroBasedIndices: Iterable<number>): Promise<void> {
    if (!Types.ObjectId.isValid(botId)) {
      throw new HttpException({ error: 'Invalid bot id' }, HttpStatus.BAD_REQUEST);
    }
    const botOid = new Types.ObjectId(botId);
    const seen = new Set<number>();
    const busyMessage =
      'Datasheet import is in progress for this row. Cancel or finish the import before editing.';
    for (const rawIdx of zeroBasedIndices) {
      const idx =
        typeof rawIdx === 'number' && Number.isFinite(rawIdx) && Number.isInteger(rawIdx) ? rawIdx : NaN;
      if (!(idx >= 0) || seen.has(idx)) continue;
      seen.add(idx);
      const row = await this.itemModel
        .findOne({
          botId: botOid,
          sourceType: 'table',
          'tableMeta.tableIndex': idx,
          $and: [knowledgeItemExcludeDeletedOnlyClause()],
        })
        .select('tableMeta')
        .lean();
      const phase = (row as { tableMeta?: { importPhase?: string } } | null)?.tableMeta?.importPhase;
      if (phase === 'import_queued' || phase === 'importing') {
        throw new HttpException({ error: busyMessage, errorCode: 'kb_table_import_busy' }, HttpStatus.CONFLICT);
      }
    }
  }

  /**
   * Monotonic millisecond stamp for optimistic concurrency on workspace KB rows (`updatedAt` preferred).
   */
  private kbItemConcurrencyStampMs(row: { updatedAt?: Date; createdAt?: Date }): number {
    const u = row.updatedAt;
    const c = row.createdAt;
    const tu = u ? new Date(u).getTime() : NaN;
    if (Number.isFinite(tu)) return tu;
    const tc = c ? new Date(c).getTime() : NaN;
    if (Number.isFinite(tc)) return tc;
    return 0;
  }

  /** Fails with `409` `kb_delete_concurrent_conflict` when another writer changed or removed a targeted row. */
  private async assertKbBulkDeletionSnapshotStillCurrent(
    botOid: Types.ObjectId,
    routeIds: Iterable<string>,
    snapshotMs: Map<string, number>,
  ): Promise<void> {
    const ids = [...new Set([...routeIds])];
    if (ids.length === 0) return;
    const oids = ids.map((id) => new Types.ObjectId(id));
    const live = await this.itemModel
      .find({
        botId: botOid,
        _id: { $in: oids },
        $and: [knowledgeItemExcludeDeletedOnlyClause()],
      })
      .select('_id updatedAt createdAt')
      .lean();
    const byId = new Map(live.map((r) => [String((r as { _id: Types.ObjectId })._id), r]));
    const conflictBody = (): HttpException =>
      new HttpException(
        {
          error: 'Knowledge changed while deleting. Refresh and try again.',
          errorCode: 'kb_delete_concurrent_conflict',
        },
        HttpStatus.CONFLICT,
      );
    for (const id of ids) {
      const row = byId.get(id);
      if (!row) throw conflictBody();
      const cur = this.kbItemConcurrencyStampMs(row as { updatedAt?: Date; createdAt?: Date });
      const was = snapshotMs.get(id);
      if (was !== undefined && cur !== was) throw conflictBody();
    }
  }

  /**
   * Rebuild persisted snippet sibling rows (`sourceType=note`) after excluding one or many route ids —
   * used by workspace row delete paths so bulk deletes remain consistent without index/id drift.
   */
  private async workspaceRebuildSnippetNotesExcludingRouteIds(
    botId: string,
    excludeRouteIds: Set<string>,
    skipLim: { skipKbTotalLimitAssert: true },
  ): Promise<void> {
    if (!Types.ObjectId.isValid(botId)) return;
    const botOid = new Types.ObjectId(botId);

    type NoteSibLean = {
      _id: Types.ObjectId;
      noteMeta?: { kind?: string };
      title?: string;
      content?: string;
      rawContent?: string;
      active?: boolean;
    };

    const siblings = (await this.itemModel
      .find({
        botId: botOid,
        sourceType: 'note',
        $and: [knowledgeItemExcludeDeletedOnlyClause()],
      })
      .sort({ 'noteMeta.snippetIndex': 1, createdAt: 1 })
      .select('_id noteMeta title content rawContent active')
      .lean()) as NoteSibLean[];

    const mapSnippetLean = (doc: NoteSibLean): { title: string; snippet: string; active?: boolean } => {
      const nm = doc.noteMeta;
      if (nm?.kind === 'general_note') {
        const c = String(doc.content ?? '').trim();
        const t = String(doc.title ?? '').trim() || 'Notes';
        return { title: t, snippet: c, active: doc.active !== false };
      }
      let body = '';
      let structuredTitle: string | undefined;
      const raw = doc.rawContent;
      if (raw) {
        try {
          const p = JSON.parse(raw) as { title?: string; snippet?: string };
          structuredTitle = typeof p.title === 'string' ? p.title.trim() : undefined;
          body = String(p.snippet ?? '').trim();
        } catch {
          body = String(doc.content ?? '').trim();
        }
      } else {
        body = String(doc.content ?? '').trim();
      }
      const docTitle = String(doc.title ?? '').trim();
      const stitle =
        docTitle || (structuredTitle && structuredTitle.length > 0 ? structuredTitle : '') || 'Snippet';
      return {
        title: stitle,
        snippet: body,
        active: doc.active !== false,
      };
    };

    let general: { title: string; snippet: string; active: boolean } | null = null;
    const snippetRows: NoteSibLean[] = [];

    for (const doc of siblings) {
      if (excludeRouteIds.has(String(doc._id))) continue;
      const k = doc.noteMeta?.kind;
      if (k === 'general_note') {
        const m = mapSnippetLean(doc);
        if (m.snippet) {
          general = { title: m.title, snippet: m.snippet, active: m.active !== false };
        }
      } else if (k === 'snippet' || coerceNoteSnippetIndex(doc.noteMeta) !== undefined) {
        snippetRows.push(doc);
      }
    }

    snippetRows.sort(
      (a, b) => (coerceNoteSnippetIndex(a.noteMeta) ?? 0) - (coerceNoteSnippetIndex(b.noteMeta) ?? 0),
    );

    const snippetsNext: Array<{ title: string; snippet: string; active?: boolean }> = [];
    if (general && general.snippet) {
      snippetsNext.push({
        title: general.title,
        snippet: general.snippet,
        active: general.active,
      });
    }
    for (const doc of snippetRows) {
      snippetsNext.push(mapSnippetLean(doc));
    }

    await this.upsertSnippetKnowledgeItemsForBot(botId, snippetsNext, skipLim);
  }

  /**
   * Workspace `DELETE …/knowledge/items/:itemId` — asserts {@link assertKbContentPatchTrainingGate}; does **not**
   * run bot total KB storage asserts. (`PATCH …/suggestions/:index/label` stays a separate chip-text flow.)
   */
  async workspaceDeleteKnowledgeItemByRouteId(botId: string, itemId: string): Promise<{ ok: true }> {
    if (!Types.ObjectId.isValid(botId) || !Types.ObjectId.isValid(itemId)) {
      throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    }
    const botOid = new Types.ObjectId(botId);
    const oid = new Types.ObjectId(itemId);
    const row = await this.itemModel
      .findOne({
        botId: botOid,
        _id: oid,
        $and: [knowledgeItemExcludeDeletedOnlyClause()],
      })
      .select('sourceType faqMeta noteMeta tableMeta suggestionMeta title content rawContent active')
      .lean();
    if (!row) {
      throw new HttpException({ error: 'Knowledge item not found', errorCode: 'kb_item_not_found' }, HttpStatus.NOT_FOUND);
    }

    await this.assertKbContentPatchTrainingGate(botId, itemId);

    const sourceType = String((row as { sourceType?: string }).sourceType ?? '').trim();
    const skipLim = { skipKbTotalLimitAssert: true as const };

    if (sourceType === 'document') {
      await this.softDeleteKbDocumentRoutesByIds(botId, [oid]);
      return { ok: true };
    }

    if (sourceType === 'faq') {
      const siblings = await this.itemModel
        .find({
          botId: botOid,
          sourceType: 'faq',
          $and: [knowledgeItemExcludeDeletedOnlyClause()],
        })
        .sort({ 'faqMeta.faqIndex': 1 })
        .select('_id faqMeta active')
        .lean();
      const survivors = siblings.filter((s) => String((s as { _id: Types.ObjectId })._id) !== itemId);
      if (survivors.length === siblings.length) {
        throw new HttpException({ error: 'Knowledge item not found', errorCode: 'kb_item_not_found' }, HttpStatus.NOT_FOUND);
      }
      const faqsNext = survivors.map((doc) => {
        const fm = (doc as { faqMeta?: KnowledgeBaseItemFaqMeta }).faqMeta;
        const title = String(fm?.title ?? '').trim();
        const rawQs = Array.isArray(fm?.questions) ? fm!.questions! : [];
        const questions = rawQs.map((q) => String(q ?? '').trim()).filter(Boolean);
        const answer = String(fm?.answer ?? '').trim();
        const base: {
          title?: string;
          questions?: string[];
          answer: string;
          active?: boolean;
        } = { answer, active: (doc as { active?: boolean }).active !== false };
        if (title) base.title = title;
        if (questions.length) base.questions = questions;
        return base;
      });
      await this.upsertFaqKnowledgeItemsForBot(botId, faqsNext, skipLim);
      return { ok: true };
    }

    if (sourceType === 'note') {
      const kind = String((row as { noteMeta?: { kind?: string } }).noteMeta?.kind ?? '').trim();
      if (kind === 'general_note') {
        await this.softDeleteKnowledgeItemsMatching(botId, { _id: oid, sourceType: 'note' });
        return { ok: true };
      }

      await this.workspaceRebuildSnippetNotesExcludingRouteIds(botId, new Set([itemId]), skipLim);
      return { ok: true };
    }

    if (sourceType === 'table') {
      const tm = (row as { tableMeta?: { importPhase?: string } }).tableMeta;
      const phase = tm?.importPhase;
      if (phase === 'import_queued' || phase === 'importing') {
        throw new HttpException(
          {
            error: 'Datasheet import is in progress for this row. Cancel or finish the import before deleting.',
            errorCode: 'kb_table_import_busy',
          },
          HttpStatus.CONFLICT,
        );
      }
      const siblings = await this.itemModel
        .find({
          botId: botOid,
          sourceType: 'table',
          $and: [knowledgeItemExcludeDeletedOnlyClause()],
        })
        .sort({ 'tableMeta.tableIndex': 1, createdAt: 1 })
        .select('_id title rawContent tableMeta active')
        .lean();
      const survivors = siblings.filter((s) => String((s as { _id: Types.ObjectId })._id) !== itemId);
      if (survivors.length === siblings.length) {
        throw new HttpException({ error: 'Knowledge item not found', errorCode: 'kb_item_not_found' }, HttpStatus.NOT_FOUND);
      }
      const tablesNext = survivors.map((doc) => {
        const ac = (doc as { active?: boolean }).active;
        const titleStored = String((doc as { title?: string }).title ?? '').trim() || 'Table';
        const raw = String((doc as { rawContent?: string }).rawContent ?? '');
        let title = titleStored;
        let columns: string[] = [];
        let rows: string[][] = [];
        if (raw) {
          try {
            const p = JSON.parse(raw) as { title?: string; columns?: string[]; rows?: string[][] };
            title = (p.title ?? titleStored).trim() || titleStored;
            columns = Array.isArray(p.columns) ? p.columns.map((c) => String(c ?? '')) : [];
            rows = Array.isArray(p.rows)
              ? p.rows.map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? '')) : []))
              : [];
          } catch {
            /* empty grid */
          }
        }
        return {
          title,
          columns,
          rows,
          active: ac !== false,
        };
      });
      await this.upsertTableKnowledgeItemsForBot(botId, tablesNext, skipLim);
      return { ok: true };
    }

    if (sourceType === 'suggestion') {
      const bot = await this.botModel.findById(botOid).select('exampleQuestions').lean();
      if (!bot) {
        throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
      }
      const docs = parseExampleQuestionsFromDoc((bot as { exampleQuestions?: unknown }).exampleQuestions);
      const idx = (row as { suggestionMeta?: { suggestionIndex?: number } }).suggestionMeta?.suggestionIndex;
      if (idx == null || idx < 0 || idx >= docs.length) {
        throw new HttpException({ error: 'Suggestion not found', errorCode: 'kb_suggestion_not_found' }, HttpStatus.NOT_FOUND);
      }
      docs.splice(idx, 1);
      await this.botModel.updateOne(
        { _id: botOid },
        { $set: { exampleQuestions: exampleQuestionDocsToMongoArray(docs), updatedAt: new Date() } },
      );
      await this.upsertSuggestionKnowledgeItemsForBot(botId, docs, skipLim);
      return { ok: true };
    }

    throw new HttpException(
      {
        error: 'This knowledge item type cannot be deleted through this endpoint',
        errorCode: 'kb_delete_unsupported_source_type',
      },
      HttpStatus.BAD_REQUEST,
    );
  }

  /**
   * Workspace bulk-delete: one HTTP round trip. Same **gates** as {@link workspaceDeleteKnowledgeItemByRouteId}
   * (`assertKbContentPatchTrainingGate`, `kb_table_import_busy`, not-found semantics). Mixed-type payloads are grouped
   * so FAQ/snippet/table/suggestion sections apply **once**—avoids stale ObjectId→slot drift from repeated upserts.
   *
   * **Body contract:** Every `itemIds` element must trim to a valid ObjectId (`invalid_body`). Duplicates are ignored.
   * **Cross-type** mutations run **FAQ → datasheet → suggestion chips → general notes → snippets → documents**
   * (documents last — lightweight soft-delete failures are unlikely after heavier section upserts). Not one Mongo
   * transaction; each phase asserts targeted rows match the request-time `updatedAt` stamp so overlapping edits abort
   * with **`409`** `kb_delete_concurrent_conflict` instead of silently mixing sessions.
   */
  async workspaceBulkDeleteKnowledgeItemsByRouteIds(botId: string, itemIds: unknown[]): Promise<{ ok: true; deleted: number }> {
    if (!Types.ObjectId.isValid(botId)) {
      throw new HttpException({ error: 'Invalid bot id' }, HttpStatus.BAD_REQUEST);
    }
    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      throw new HttpException(
        { error: 'itemIds must be a non-empty array', errorCode: 'invalid_body' },
        HttpStatus.BAD_REQUEST,
      );
    }
    const KB_BULK_DELETE_MAX = 100;
    if (itemIds.length > KB_BULK_DELETE_MAX) {
      throw new HttpException(
        {
          error: `At most ${KB_BULK_DELETE_MAX} knowledge items may be deleted in one request.`,
          errorCode: 'kb_bulk_delete_limit',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const deduped: string[] = [];
    const seen = new Set<string>();
    for (const raw of itemIds) {
      const id = String(raw ?? '').trim().toLowerCase();
      if (!Types.ObjectId.isValid(id)) {
        throw new HttpException(
          {
            error: 'Each knowledge item id must be a valid ObjectId.',
            errorCode: 'invalid_body',
          },
          HttpStatus.BAD_REQUEST,
        );
      }
      if (seen.has(id)) continue;
      seen.add(id);
      deduped.push(id);
    }
    if (deduped.length === 0) {
      throw new HttpException(
        { error: 'itemIds must include at least one unique id.', errorCode: 'invalid_body' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const botOid = new Types.ObjectId(botId);
    const oids = deduped.map((id) => new Types.ObjectId(id));
    const rows = await this.itemModel
      .find({
        botId: botOid,
        _id: { $in: oids },
        $and: [knowledgeItemExcludeDeletedOnlyClause()],
      })
      .select(
        'sourceType faqMeta noteMeta tableMeta suggestionMeta title content rawContent active updatedAt createdAt',
      )
      .lean();
    const rowById = new Map<string, (typeof rows)[0]>();
    for (const r of rows) {
      rowById.set(String((r as { _id: Types.ObjectId })._id).toLowerCase(), r as (typeof rows)[0]);
    }
    for (const id of deduped) {
      if (!rowById.has(id)) {
        throw new HttpException({ error: 'Knowledge item not found', errorCode: 'kb_item_not_found' }, HttpStatus.NOT_FOUND);
      }
    }

    const skipLim = { skipKbTotalLimitAssert: true as const };
    for (const id of deduped) {
      await this.assertKbContentPatchTrainingGate(botId, id);
    }

    const docOids: Types.ObjectId[] = [];
    const faqDelete = new Set<string>();
    const tableDelete = new Set<string>();
    const suggestionDelete = new Set<string>();
    const generalNoteOids: Types.ObjectId[] = [];
    const snippetDelete = new Set<string>();

    for (const id of deduped) {
      const row = rowById.get(id)!;
      const st = String((row as { sourceType?: string }).sourceType ?? '').trim();
      if (st === 'document') {
        docOids.push(new Types.ObjectId(id));
      } else if (st === 'faq') {
        faqDelete.add(id);
      } else if (st === 'table') {
        tableDelete.add(id);
      } else if (st === 'suggestion') {
        suggestionDelete.add(id);
      } else if (st === 'note') {
        const kind = String((row as { noteMeta?: { kind?: string } }).noteMeta?.kind ?? '').trim();
        if (kind === 'general_note') generalNoteOids.push(new Types.ObjectId(id));
        else snippetDelete.add(id);
      } else {
        throw new HttpException(
          {
            error: 'This knowledge item type cannot be deleted through this endpoint',
            errorCode: 'kb_delete_unsupported_source_type',
          },
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    for (const tid of tableDelete) {
      const row = rowById.get(tid)!;
      const phase = (row as { tableMeta?: { importPhase?: string } }).tableMeta?.importPhase;
      if (phase === 'import_queued' || phase === 'importing') {
        throw new HttpException(
          {
            error: 'Datasheet import is in progress for this row. Cancel or finish the import before deleting.',
            errorCode: 'kb_table_import_busy',
          },
          HttpStatus.CONFLICT,
        );
      }
    }

    const initialConcurrencyMs = new Map<string, number>();
    for (const id of deduped) {
      initialConcurrencyMs.set(
        id,
        this.kbItemConcurrencyStampMs(rowById.get(id)! as { updatedAt?: Date; createdAt?: Date }),
      );
    }

    if (faqDelete.size > 0) {
      await this.assertKbBulkDeletionSnapshotStillCurrent(botOid, faqDelete, initialConcurrencyMs);
      const siblings = await this.itemModel
        .find({
          botId: botOid,
          sourceType: 'faq',
          $and: [knowledgeItemExcludeDeletedOnlyClause()],
        })
        .sort({ 'faqMeta.faqIndex': 1 })
        .select('_id faqMeta active')
        .lean();
      const survivors = siblings.filter((s) => !faqDelete.has(String((s as { _id: Types.ObjectId })._id).toLowerCase()));
      if (survivors.length !== siblings.length - faqDelete.size) {
        throw new HttpException({ error: 'Knowledge item not found', errorCode: 'kb_item_not_found' }, HttpStatus.NOT_FOUND);
      }
      const faqsNext = survivors.map((doc) => {
        const fm = (doc as { faqMeta?: KnowledgeBaseItemFaqMeta }).faqMeta;
        const title = String(fm?.title ?? '').trim();
        const rawQs = Array.isArray(fm?.questions) ? fm!.questions! : [];
        const questions = rawQs.map((q) => String(q ?? '').trim()).filter(Boolean);
        const answer = String(fm?.answer ?? '').trim();
        const base: {
          title?: string;
          questions?: string[];
          answer: string;
          active?: boolean;
        } = { answer, active: (doc as { active?: boolean }).active !== false };
        if (title) base.title = title;
        if (questions.length) base.questions = questions;
        return base;
      });
      await this.upsertFaqKnowledgeItemsForBot(botId, faqsNext, skipLim);
    }

    if (tableDelete.size > 0) {
      await this.assertKbBulkDeletionSnapshotStillCurrent(botOid, tableDelete, initialConcurrencyMs);
      const siblings = await this.itemModel
        .find({
          botId: botOid,
          sourceType: 'table',
          $and: [knowledgeItemExcludeDeletedOnlyClause()],
        })
        .sort({ 'tableMeta.tableIndex': 1, createdAt: 1 })
        .select('_id title rawContent tableMeta active')
        .lean();
      const survivors = siblings.filter((s) => !tableDelete.has(String((s as { _id: Types.ObjectId })._id).toLowerCase()));
      if (survivors.length !== siblings.length - tableDelete.size) {
        throw new HttpException({ error: 'Knowledge item not found', errorCode: 'kb_item_not_found' }, HttpStatus.NOT_FOUND);
      }
      const tablesNext = survivors.map((doc) => {
        const ac = (doc as { active?: boolean }).active;
        const titleStored = String((doc as { title?: string }).title ?? '').trim() || 'Table';
        const raw = String((doc as { rawContent?: string }).rawContent ?? '');
        let title = titleStored;
        let columns: string[] = [];
        let rowsGrid: string[][] = [];
        if (raw) {
          try {
            const p = JSON.parse(raw) as { title?: string; columns?: string[]; rows?: string[][] };
            title = (p.title ?? titleStored).trim() || titleStored;
            columns = Array.isArray(p.columns) ? p.columns.map((c) => String(c ?? '')) : [];
            rowsGrid = Array.isArray(p.rows)
              ? p.rows.map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? '')) : []))
              : [];
          } catch {
            /* empty grid */
          }
        }
        return {
          title,
          columns,
          rows: rowsGrid,
          active: ac !== false,
        };
      });
      await this.upsertTableKnowledgeItemsForBot(botId, tablesNext, skipLim);
    }

    if (suggestionDelete.size > 0) {
      await this.assertKbBulkDeletionSnapshotStillCurrent(botOid, suggestionDelete, initialConcurrencyMs);
      const sugIdsOid = [...suggestionDelete].map((id) => new Types.ObjectId(id));
      const sugLive = await this.itemModel
        .find({
          botId: botOid,
          _id: { $in: sugIdsOid },
          sourceType: 'suggestion',
          $and: [knowledgeItemExcludeDeletedOnlyClause()],
        })
        .select('_id suggestionMeta')
        .lean();
      if (sugLive.length !== suggestionDelete.size) {
        throw new HttpException(
          {
            error: 'Knowledge changed while deleting. Refresh and try again.',
            errorCode: 'kb_delete_concurrent_conflict',
          },
          HttpStatus.CONFLICT,
        );
      }
      const sugLiveById = new Map(
        sugLive.map((r) => [String((r as { _id: Types.ObjectId })._id).toLowerCase(), r]),
      );

      const botRow = await this.botModel.findById(botOid).select('exampleQuestions').lean();
      if (!botRow) {
        throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
      }
      const suggestionDocs = parseExampleQuestionsFromDoc(
        (botRow as { exampleQuestions?: unknown }).exampleQuestions,
      );
      const indexSet = new Set<number>();
      for (const sid of suggestionDelete) {
        const srow = sugLiveById.get(sid) as {
          suggestionMeta?: { suggestionIndex?: number };
        };
        const idx = srow?.suggestionMeta?.suggestionIndex;
        if (idx == null || idx < 0 || idx >= suggestionDocs.length) {
          throw new HttpException(
            { error: 'Suggestion not found', errorCode: 'kb_suggestion_not_found' },
            HttpStatus.NOT_FOUND,
          );
        }
        indexSet.add(idx);
      }
      const descending = [...indexSet].sort((a, b) => b - a);
      for (const idx of descending) suggestionDocs.splice(idx, 1);
      await this.botModel.updateOne(
        { _id: botOid },
        {
          $set: {
            exampleQuestions: exampleQuestionDocsToMongoArray(suggestionDocs),
            updatedAt: new Date(),
          },
        },
      );
      await this.upsertSuggestionKnowledgeItemsForBot(botId, suggestionDocs, skipLim);
    }

    if (generalNoteOids.length > 0) {
      const generalNoteRoutes = generalNoteOids.map((oid) => String(oid).toLowerCase());
      await this.assertKbBulkDeletionSnapshotStillCurrent(botOid, generalNoteRoutes, initialConcurrencyMs);
      await this.softDeleteKnowledgeItemsMatching(botId, {
        _id: { $in: generalNoteOids },
        sourceType: 'note',
        'noteMeta.kind': 'general_note',
      });
    }

    if (snippetDelete.size > 0) {
      await this.assertKbBulkDeletionSnapshotStillCurrent(botOid, snippetDelete, initialConcurrencyMs);
      await this.workspaceRebuildSnippetNotesExcludingRouteIds(botId, snippetDelete, skipLim);
    }

    if (docOids.length > 0) {
      await this.assertKbBulkDeletionSnapshotStillCurrent(
        botOid,
        docOids.map((id) => String(id).toLowerCase()),
        initialConcurrencyMs,
      );
      await this.softDeleteKbDocumentRoutesByIds(botId, docOids);
    }

    return { ok: true, deleted: deduped.length };
  }

  async assertKbLegacyKnowledgeDescriptionTrainingGate(botId: string): Promise<void> {
    if (!Types.ObjectId.isValid(botId)) return;
    const meta = await this.getIndexedSnippetTraining(botId, 1);
    const sid = meta[0]?.knowledgeItemId ?? (await this.resolveGeneralNoteKnowledgeItemId(botId));
    if (sid) await this.assertKbContentPatchTrainingGate(botId, sid);
  }

  private async resolveGeneralNoteKnowledgeItemId(botId: string): Promise<string | null> {
    if (!Types.ObjectId.isValid(botId)) return null;
    const row = await this.itemModel
      .findOne({
        botId: new Types.ObjectId(botId),
        sourceType: 'note',
        active: { $ne: false },
        'noteMeta.kind': 'general_note',
        $and: [knowledgeItemExcludeDeletedOnlyClause()],
      })
      .select('_id')
      .lean();
    return row ? String((row as { _id: Types.ObjectId })._id) : null;
  }

  /**
   * Gates each FAQ / snippet / table row index and optionally suggestions when `spec.suggestionCount` is passed.
   * No longer used by `PATCH …/bots/:id`; suggestion list sync applies scope-only training gates elsewhere.
   */
  async assertWorkspaceBotPatchKnowledgeTrainingGates(
    botId: string,
    spec: {
      faqCount: number;
      suggestionCount: number;
      snippetCount: number;
      knowledgeDescriptionOnlyTouchedWithoutSnippets: boolean;
      tableCount: number;
    },
  ): Promise<void> {
    const bid = botId;
    if (spec.faqCount > 0) {
      const meta = await this.getIndexedFaqTraining(bid, spec.faqCount);
      for (const row of meta) {
        if (row?.knowledgeItemId) await this.assertKbContentPatchTrainingGate(bid, row.knowledgeItemId);
      }
    }
    if (spec.suggestionCount > 0) {
      const meta = await this.getIndexedSuggestionTraining(bid, spec.suggestionCount);
      for (const row of meta) {
        if (row?.knowledgeItemId) await this.assertKbContentPatchTrainingGate(bid, row.knowledgeItemId);
      }
    }
    if (spec.snippetCount > 0) {
      const meta = await this.getIndexedSnippetTraining(bid, spec.snippetCount);
      for (const row of meta) {
        if (row?.knowledgeItemId) await this.assertKbContentPatchTrainingGate(bid, row.knowledgeItemId);
      }
    }
    if (spec.knowledgeDescriptionOnlyTouchedWithoutSnippets) {
      const meta = await this.getIndexedSnippetTraining(bid, 1);
      const sid = meta[0]?.knowledgeItemId ?? (await this.resolveGeneralNoteKnowledgeItemId(bid));
      if (sid) await this.assertKbContentPatchTrainingGate(bid, sid);
    }
    if (spec.tableCount > 0) {
      const meta = await this.getIndexedTableTraining(bid, spec.tableCount);
      for (const row of meta) {
        if (row?.knowledgeItemId) await this.assertKbContentPatchTrainingGate(bid, row.knowledgeItemId);
      }
    }
  }

  /**
   * Hard-delete KnowledgeBaseItems by KB document ids (`_id` of document rows).
   */
  async deactivateByDocumentIds(botId: string, documentIds: Types.ObjectId[]): Promise<number> {
    if (documentIds.length === 0) return 0;
    return this.softDeleteKnowledgeItemsMatching(botId, {
      _id: { $in: documentIds },
      sourceType: 'document',
    });
  }

  /**
   * Per-index training metadata for titled snippets (matches `knowledgeSnippets[i]` on the bot document).
   */
  async getIndexedSnippetTraining(
    botId: string,
    count: number,
  ): Promise<
    Array<{
      trainingStatus: KnowledgeBaseItemTrainingStatus;
      lastTrainedAt: string | null;
      knowledgeItemId: string;
      active: boolean;
    } | null>
  > {
    if (count <= 0) {
      return [];
    }
    if (!Types.ObjectId.isValid(botId)) {
      return Array.from({ length: count }, () => null);
    }
    const botOid = new Types.ObjectId(botId);
    const rows = await this.itemModel
      .find({
        botId: botOid,
        sourceType: 'note',
        $and: [
          knowledgeItemExcludeDeletedOnlyClause(),
          {
            $or: [{ 'noteMeta.kind': 'snippet' }, { 'noteMeta.snippetIndex': { $exists: true, $ne: null } }],
          },
        ],
      })
      .select('_id status lastTrainedAt noteMeta active')
      .lean();
    const out: Array<{
      trainingStatus: KnowledgeBaseItemTrainingStatus;
      lastTrainedAt: string | null;
      knowledgeItemId: string;
      active: boolean;
    } | null> = Array.from({ length: count }, () => null);
    for (const it of rows) {
      const idx = coerceNoteSnippetIndex((it as { noteMeta?: unknown }).noteMeta);
      if (idx == null || idx < 0 || idx >= count) continue;
      const status = (it as { status?: KnowledgeBaseItemTrainingStatus }).status;
      if (!status) continue;
      const trained = kbLastSuccessfulTrainInstant(
        it as { lastTrainedAt?: Date },
      );
      const _id = (it as { _id: Types.ObjectId })._id;
      out[idx] = {
        trainingStatus: status,
        lastTrainedAt: trained instanceof Date ? trained.toISOString() : null,
        knowledgeItemId: String(_id),
        active: (it as { active?: boolean }).active !== false,
      };
    }
    return out;
  }

  /**
   * Per-index training metadata for FAQs (matches `faqs[i]` on the bot document).
   */
  async getIndexedFaqTraining(
    botId: string,
    count: number,
  ): Promise<
    Array<{
      trainingStatus: KnowledgeBaseItemTrainingStatus;
      lastTrainedAt: string | null;
      knowledgeItemId: string;
      active: boolean;
    } | null>
  > {
    if (count <= 0) {
      return [];
    }
    if (!Types.ObjectId.isValid(botId)) {
      return Array.from({ length: count }, () => null);
    }
    const botOid = new Types.ObjectId(botId);
    const rows = await this.itemModel
      .find({
        botId: botOid,
        sourceType: 'faq',
        $and: [knowledgeItemExcludeDeletedOnlyClause()],
      })
      .select('_id status lastTrainedAt faqMeta active')
      .lean();
    const out: Array<{
      trainingStatus: KnowledgeBaseItemTrainingStatus;
      lastTrainedAt: string | null;
      knowledgeItemId: string;
      active: boolean;
    } | null> = Array.from({ length: count }, () => null);
    for (const it of rows) {
      const idx = (it as { faqMeta?: { faqIndex?: number } }).faqMeta?.faqIndex;
      if (idx == null || idx < 0 || idx >= count) continue;
      const status = (it as { status?: KnowledgeBaseItemTrainingStatus }).status;
      if (!status) continue;
      const trained = kbLastSuccessfulTrainInstant(
        it as { lastTrainedAt?: Date },
      );
      const _id = (it as { _id: Types.ObjectId })._id;
      out[idx] = {
        trainingStatus: status,
        lastTrainedAt: trained instanceof Date ? trained.toISOString() : null,
        knowledgeItemId: String(_id),
        active: (it as { active?: boolean }).active !== false,
      };
    }
    return out;
  }

  /**
   * Per-index metadata for suggestion chips (matches `exampleQuestions[i]` on the bot).
   */
  async getIndexedSuggestionTraining(
    botId: string,
    count: number,
  ): Promise<
    Array<{
      trainingStatus: KnowledgeBaseItemTrainingStatus;
      lastTrainedAt: string | null;
      knowledgeItemId: string;
      active: boolean;
    } | null>
  > {
    if (count <= 0) {
      return [];
    }
    if (!Types.ObjectId.isValid(botId)) {
      return Array.from({ length: count }, () => null);
    }
    const botOid = new Types.ObjectId(botId);
    const rows = await this.itemModel
      .find({
        botId: botOid,
        sourceType: 'suggestion',
        $and: [knowledgeItemExcludeDeletedOnlyClause()],
      })
      .select('_id status lastTrainedAt suggestionMeta active')
      .lean();
    const out: Array<{
      trainingStatus: KnowledgeBaseItemTrainingStatus;
      lastTrainedAt: string | null;
      knowledgeItemId: string;
      active: boolean;
    } | null> = Array.from({ length: count }, () => null);
    for (const it of rows) {
      const idx = (it as { suggestionMeta?: { suggestionIndex?: number } }).suggestionMeta?.suggestionIndex;
      if (idx == null || idx < 0 || idx >= count) continue;
      const status = (it as { status?: KnowledgeBaseItemTrainingStatus }).status;
      if (!status) continue;
      const trained = kbLastSuccessfulTrainInstant(
        it as { lastTrainedAt?: Date },
      );
      const _id = (it as { _id: Types.ObjectId })._id;
      out[idx] = {
        trainingStatus: status,
        lastTrainedAt: trained instanceof Date ? trained.toISOString() : null,
        knowledgeItemId: String(_id),
        active: (it as { active?: boolean }).active !== false,
      };
    }
    return out;
  }

  /**
   * Per-index metadata for knowledge datasheets (matches `knowledgeDatasheets[i]` / `knowledgeTables[i]` on the bot).
   */
  async getIndexedTableTraining(
    botId: string,
    count: number,
  ): Promise<
    Array<{
      trainingStatus: KnowledgeBaseItemTrainingStatus;
      lastTrainedAt: string | null;
      importFileSize: number | null;
      importFileName: string | null;
      knowledgeItemId: string;
      active: boolean;
      importDisplayState: TableImportDisplayState;
    } | null>
  > {
    if (count <= 0) {
      return [];
    }
    if (!Types.ObjectId.isValid(botId)) {
      return Array.from({ length: count }, () => null);
    }
    const botOid = new Types.ObjectId(botId);
    const rows = await this.itemModel
      .find({
        botId: botOid,
        sourceType: 'table',
        $and: [knowledgeItemExcludeDeletedOnlyClause()],
      })
      .select('_id status lastTrainedAt tableMeta sourceMeta active')
      .lean();
    const out: Array<{
      trainingStatus: KnowledgeBaseItemTrainingStatus;
      lastTrainedAt: string | null;
      importFileSize: number | null;
      importFileName: string | null;
      knowledgeItemId: string;
      active: boolean;
      importDisplayState: TableImportDisplayState;
    } | null> = Array.from({ length: count }, () => null);
    for (const it of rows) {
      const idx = (it as { tableMeta?: { tableIndex?: number } }).tableMeta?.tableIndex;
      if (idx == null || idx < 0 || idx >= count) continue;
      const status = (it as { status?: KnowledgeBaseItemTrainingStatus }).status;
      if (!status) continue;
      const trained = kbLastSuccessfulTrainInstant(
        it as { lastTrainedAt?: Date },
      );
      const tm = (it as { tableMeta?: { tableIndex?: number; importFileSize?: number; importFileName?: string } })
        .tableMeta;
      const sm = (it as { sourceMeta?: { fileSize?: number; fileName?: string } | null }).sourceMeta;
      const fsz = tm?.importFileSize ?? sm?.fileSize;
      const _id = (it as { _id: Types.ObjectId })._id;
      out[idx] = {
        trainingStatus: status,
        lastTrainedAt: trained instanceof Date ? trained.toISOString() : null,
        importFileSize: typeof fsz === 'number' && Number.isFinite(fsz) && fsz >= 0 ? fsz : null,
        importFileName: typeof tm?.importFileName === 'string' && tm.importFileName.trim()
          ? tm.importFileName.trim()
          : typeof sm?.fileName === 'string' && sm.fileName.trim()
            ? sm.fileName.trim()
            : null,
        knowledgeItemId: String(_id),
        active: (it as { active?: boolean }).active !== false,
        importDisplayState: tableImportDisplayStateFromKb({
          status,
          tableMeta: tm as { importPhase?: string },
        }),
      };
    }
    return out;
  }

  /**
   * Latest extract/train ingest merge + embedding counts per document KB row (same as
   * {@link listLightweightTrainingStatuses} / agent lifecycle bundle).
   */
  private async loadDocumentIngestJobContext(
    botOid: Types.ObjectId,
    documentKbIds: Types.ObjectId[],
  ): Promise<{
    mergedIngestByKbId: Map<string, MergedDocumentPipelineJobRow>;
    embedByKbId: Map<string, number>;
    extractLatestByKbId: Map<string, { status: string; extractAutoRetryCycles: number; extractLastError?: string }>;
  }> {
    const mergedIngestByKbId = new Map<string, MergedDocumentPipelineJobRow>();
    const extractLatestByKbId = new Map<
      string,
      { status: string; extractAutoRetryCycles: number; extractLastError?: string }
    >();
    let embedByKbId = new Map<string, number>();
    if (documentKbIds.length === 0) {
      return { mergedIngestByKbId, embedByKbId, extractLatestByKbId };
    }
    const extractStaleMs = Math.max(1, INGESTION_STUCK_TIMEOUT_MINUTES) * 60_000;
    const trainStaleMs = Math.max(1, KNOWLEDGE_TRAINING_STUCK_TIMEOUT_MINUTES) * 60_000;
    const [extractJobs, trainJobs, embedCounts] = await Promise.all([
      this.extractJobModel
        .find({ botId: botOid, knowledgeBaseItemId: { $in: documentKbIds } })
        .sort({ createdAt: -1 })
        .lean(),
      this.trainJobModel
        .find({
          botId: botOid,
          kind: 'document',
          knowledgeBaseItemId: { $in: documentKbIds },
        })
        .sort({ createdAt: -1 })
        .lean(),
      this.knowledgeBaseChunkService.countChunksWithValidEmbeddingsByKnowledgeItemIds(documentKbIds),
    ]);
    embedByKbId = embedCounts;

    const exFullByKbId = new Map<string, DocumentPipelineJobMergeInput>();
    for (const j of extractJobs) {
      const row = j as {
        knowledgeBaseItemId?: Types.ObjectId;
        status?: string;
        queuedAt?: Date;
        runAfter?: Date;
        finishedAt?: Date;
        startedAt?: Date | null;
        processingStartedAt?: Date | null;
        updatedAt?: Date;
        createdAt?: Date;
        extractAutoRetryCycles?: number;
        error?: string;
      };
      const kid = row.knowledgeBaseItemId?.toString();
      if (!kid || exFullByKbId.has(kid)) continue;
      const cyc =
        typeof row.extractAutoRetryCycles === 'number' ? Math.max(0, Math.floor(row.extractAutoRetryCycles)) : 0;
      const errRaw = row.error;
      exFullByKbId.set(kid, {
        status: row.status as DocumentPipelineJobMergeInput['status'],
        queuedAt: row.queuedAt,
        runAfter: row.runAfter,
        finishedAt: row.finishedAt,
        startedAt: row.startedAt,
        processingStartedAt: row.processingStartedAt,
        updatedAt: row.updatedAt,
        createdAt: row.createdAt,
      });
      extractLatestByKbId.set(kid, {
        status: String(row.status ?? ''),
        extractAutoRetryCycles: cyc,
        extractLastError: typeof errRaw === 'string' && errRaw.trim() ? errRaw.trim() : undefined,
      });
    }

    const trByKbId = new Map<string, DocumentPipelineJobMergeInput>();
    for (const j of trainJobs) {
      const row = j as {
        knowledgeBaseItemId?: Types.ObjectId;
        status?: string;
        queuedAt?: Date;
        runAfter?: Date;
        finishedAt?: Date;
        startedAt?: Date | null;
        processingStartedAt?: Date | null;
        updatedAt?: Date;
        createdAt?: Date;
      };
      const kid = row.knowledgeBaseItemId?.toString();
      if (!kid || trByKbId.has(kid)) continue;
      trByKbId.set(kid, {
        status: row.status as DocumentPipelineJobMergeInput['status'],
        queuedAt: row.queuedAt,
        runAfter: row.runAfter,
        finishedAt: row.finishedAt,
        startedAt: row.startedAt,
        processingStartedAt: row.processingStartedAt,
        updatedAt: row.updatedAt,
        createdAt: row.createdAt,
      });
    }

    for (const oid of documentKbIds) {
      const ks = oid.toString();
      const merged = mergeDocumentPipelineJobsForCustomerRead(
        exFullByKbId.get(ks),
        trByKbId.get(ks),
        extractStaleMs,
        trainStaleMs,
      );
      if (merged) mergedIngestByKbId.set(ks, merged);
    }

    return { mergedIngestByKbId, embedByKbId, extractLatestByKbId };
  }

  /**
   * GET `/knowledge/training/status` rollups + supplement counts — document rows use merged extract/train jobs
   * ({@link computeKbDocumentTrainingDisplay}) so headline metrics match per-item polling.
   */
  async aggregateAgentTrainingLifecycleBundle(
    botId: string,
    nowInput?: Date,
    opts?: { pipelineTouchCutoff?: Date },
  ): Promise<AgentTrainingLifecycleBundle> {
    if (!Types.ObjectId.isValid(botId)) {
      return emptyAgentTrainingLifecycleBundle();
    }
    const nowDate = nowInput ?? new Date();
    const botOid = new Types.ObjectId(botId);
    const trainableTypes = ['document', 'faq', 'note', 'table', 'suggestion', 'url', 'html'] as const;
    const rows = await this.itemModel
      .find({
        botId: botOid,
        sourceType: { $in: [...trainableTypes] },
        $and: [knowledgeItemExcludeDeletedOnlyClause()],
      })
      .select(
        '_id sourceType status runAfter extractionStatus extractionError isContentExtracted characterCount trainingError tableMeta updatedAt lastTrainingStartedAt lastQueuedAt extractedAt',
      )
      .lean();

    const documentKbIds = rows
      .filter((r) => (r as { sourceType?: string }).sourceType === 'document')
      .map((r) => (r as { _id: Types.ObjectId })._id);

    const { mergedIngestByKbId, embedByKbId } = await this.loadDocumentIngestJobContext(botOid, documentKbIds);

    return rollupAgentTrainingLifecycleBundle({
      rows: rows as LeanKbRowForLifecycleBundle[],
      now: nowDate,
      pipelineTouchCutoff: opts?.pipelineTouchCutoff,
      mergedIngestByKbId,
      embedByKbId,
    });
  }

  /**
   * Lightweight training fields for frontend polling (`GET .../knowledge/status`).
   */
  async listLightweightTrainingStatuses(
    botId: string,
    type?: TrainNowKnowledgePayloadType | 'faq' | 'note' | 'table' | 'document' | 'suggestion',
    itemRouteId?: string,
  ): Promise<
    Array<{
      id: string;
      status: KnowledgeBaseItemTrainingStatus;
      trainingStatus?: string;
      extractionStatus?: string;
      lastQueuedAt?: string | null;
      runAfter?: string | null;
      lastTrainingStartedAt?: string | null;
      lastTrainedAt?: string | null;
      trainingError?: string | null;
      extractionError?: string | null;
      updatedAt?: string | null;
      displayStatus: string;
      displayLabel: string;
      displayMessage: string;
      isTraining: boolean;
      isExtracting: boolean;
      isImporting: boolean;
      /** When `false`, item is excluded from replies (`KnowledgeBaseItem.active`). */
      active: boolean;
      faqIndex?: number;
      snippetIndex?: number;
      tableIndex?: number;
      suggestionIndex?: number;
      sourceType?: string;
      /** Document rows only: latest extract job suggests manual Retry (auto retries / stuck cap exhausted). */
      extractManualRetrySuggested?: boolean;
      /** Training failed after automatic stuck-recovery cap — customer should use Retry. */
      trainingManualRetrySuggested?: boolean;
      /** When training failed after stuck cap; stable even if `trainingError` is humanized. */
      trainingFailureCode?: string | null;
    }>
  > {
    if (!Types.ObjectId.isValid(botId)) return [];
    const botOid = new Types.ObjectId(botId);
    const filter: Record<string, unknown> = {
      botId: botOid,
      $and: [knowledgeItemExcludeDeletedOnlyClause()],
    };
    if (type && type !== 'all') {
      filter.sourceType = type;
    } else if (!type || type === 'all') {
      filter.sourceType = { $in: ['document', 'faq', 'note', 'table', 'suggestion'] as const };
    }
    if (
      typeof itemRouteId === 'string' &&
      itemRouteId.trim() &&
      Types.ObjectId.isValid(itemRouteId.trim())
    ) {
      const rid = new Types.ObjectId(String(itemRouteId).trim());
      const st = typeof type === 'string' ? type : undefined;
      const byIdOnly = { _id: rid };
      if (st === 'document') {
        (filter.$and as unknown[]).push(byIdOnly);
      } else if (st && st !== 'all') {
        (filter.$and as unknown[]).push(byIdOnly);
      }
    }
    let q = this.itemModel.find(filter).select(
      '_id sourceType active status extractionStatus extractionError isContentExtracted content characterCount fileMeta lastQueuedAt runAfter lastTrainingStartedAt lastTrainedAt trainingError faqMeta noteMeta tableMeta suggestionMeta updatedAt',
    );
    if (type === 'document') {
      q = q.sort({ createdAt: -1 });
    }
    const rows = await q.lean();
    const tableJobIds: Types.ObjectId[] = [];
    for (const r of rows) {
      if ((r as { sourceType?: string }).sourceType !== 'table') continue;
      const jid = (r as { tableMeta?: { tableImportJobId?: Types.ObjectId } }).tableMeta?.tableImportJobId;
      if (jid) tableJobIds.push(jid);
    }
    const uniqJobIds = [...new Set(tableJobIds.map((id) => String(id)))].filter((id) => Types.ObjectId.isValid(id));
    const jobStatusById = new Map<string, string>();
    if (uniqJobIds.length > 0) {
      const jobs = await this.tableImportJobModel
        .find({ _id: { $in: uniqJobIds.map((id) => new Types.ObjectId(id)) } })
        .select('status')
        .lean();
      for (const j of jobs) {
        jobStatusById.set(
          String((j as { _id: Types.ObjectId })._id),
          String((j as { status?: string }).status ?? ''),
        );
      }
    }

    const documentKbIds = rows
      .filter((r) => (r as { sourceType?: string }).sourceType === 'document')
      .map((r) => (r as { _id: Types.ObjectId })._id);

    const { mergedIngestByKbId, embedByKbId, extractLatestByKbId } = await this.loadDocumentIngestJobContext(
      botOid,
      documentKbIds,
    );

    const iso = (d: unknown): string | null | undefined => {
      if (d instanceof Date && !isNaN(d.getTime())) return d.toISOString();
      return undefined;
    };
    return rows.map((r) => {
      const st = (r as { sourceType?: string }).sourceType;
      const faqMeta = (r as { faqMeta?: { faqIndex?: number } }).faqMeta;
      const noteMeta = (r as { noteMeta?: unknown }).noteMeta;
      const tableMeta = (r as { tableMeta?: { tableIndex?: number } }).tableMeta;
      const suggestionMeta = (r as { suggestionMeta?: { suggestionIndex?: number } }).suggestionMeta;
      const sourceTypeKnown = typeof st === 'string' && st.trim() ? st.trim() : undefined;
      const rawTrainingErr = (r as { trainingError?: string | null }).trainingError ?? null;
      const trainingFailureCode = resolveTrainingFailureCode(rawTrainingErr);
      const trainingErr = kbTrainingFailureMessage(
        r as { trainingError?: string | null },
      );
      const extractionErrRaw = (r as { extractionError?: string | null }).extractionError;
      const extractionError =
        typeof extractionErrRaw === 'string' && extractionErrRaw.trim() ? extractionErrRaw.trim() : null;
      const extrSt = (r as { extractionStatus?: string }).extractionStatus;
      const tmForDisp = (r as {
        tableMeta?: {
          importPhase?: string;
          importError?: string;
          importErrorCode?: string;
          tableIndex?: number;
          tableImportJobId?: Types.ObjectId;
        };
      }).tableMeta;
      const tableJobId = st === 'table' ? tmForDisp?.tableImportJobId : undefined;
      const tableImportJobStatus =
        tableJobId != null ? jobStatusById.get(String(tableJobId)) ?? null : null;
      const lifecycleSt = normalizeKnowledgeTrainingStatus((r as { status?: string }).status as string);
      const kbItemIdStr = String((r as { _id: Types.ObjectId })._id);
      const docFmLean = effectiveKbDocumentFileMetaLean(r as unknown as Record<string, unknown>);
      const trainErrPoll =
        rawTrainingErr != null && `${rawTrainingErr}`.trim() ? `${rawTrainingErr}`.trim() : null;

      let bundle: ReturnType<typeof finalizeCustomerKbItemApiDisplayBundle>;
      let lastTrainedAtResolved: string | null;

      if (st === 'document') {
        const merged = mergedIngestByKbId.get(kbItemIdStr);
        const embeddedChunkCount = embedByKbId.get(kbItemIdStr) ?? 0;
        const eff = computeKbDocumentTrainingDisplay({
          knowledgeItemStatus: lifecycleSt,
          latestIngestJobStatus: merged?.status,
          embeddedChunkCount,
        });
        const rawUpload = typeof docFmLean.uploadStatus === 'string' ? docFmLean.uploadStatus : '';
        const uploadSt = normalizeDocumentUploadStatus(rawUpload, undefined);
        const wfDisp = deriveKnowledgeBaseItemDisplayFields({
          sourceType: 'document',
          status: eff,
          extractionStatus: extrSt,
          isContentExtracted: (r as { isContentExtracted?: boolean }).isContentExtracted,
          content:
            typeof (r as { content?: string }).content === 'string' ? (r as { content: string }).content : '',
          fileMeta: docFmLean as Record<string, unknown>,
          uploadDocumentStatus: uploadSt,
          trainingError: trainErrPoll,
          extractionError,
        });
        bundle = finalizeCustomerKbItemApiDisplayBundle(wfDisp, {
          sourceType: 'document',
          status: lifecycleSt,
        });
        const kbTrainedIso =
          iso(kbLastSuccessfulTrainInstant(r as { lastTrainedAt?: Date })) ?? null;
        lastTrainedAtResolved =
          eff === 'ready'
            ? kbTrainedIso ?? (merged?.status === 'done' ? iso(merged.finishedAt) ?? null : null)
            : kbTrainedIso;
      } else {
        bundle = deriveCustomerKbItemApiDisplayBundle({
          sourceType: String(st ?? 'document'),
          status: (r as { status?: string }).status,
          extractionStatus: extrSt,
          isContentExtracted: (r as { isContentExtracted?: boolean }).isContentExtracted,
          content:
            typeof (r as { content?: string }).content === 'string' ? (r as { content: string }).content : '',
          fileMeta: docFmLean as Record<string, unknown>,
          uploadDocumentStatus: (() => {
            const fm = docFmLean;
            return typeof fm.uploadStatus === 'string' ? fm.uploadStatus : undefined;
          })(),
          tableImportPhase: st === 'table' ? String(tmForDisp?.importPhase ?? '') : undefined,
          tableImportJobStatus,
          trainingError: (r as { trainingError?: string | null }).trainingError ?? null,
          extractionError,
          importErrorCode: st === 'table' ? (tmForDisp?.importErrorCode ?? null) : null,
          importError: st === 'table' ? (tmForDisp?.importError ?? null) : null,
        });
        lastTrainedAtResolved =
          iso(kbLastSuccessfulTrainInstant(r as { lastTrainedAt?: Date })) ?? null;
      }

      const ej = st === 'document' ? extractLatestByKbId.get(kbItemIdStr) : undefined;
      return {
        id: kbItemIdStr,
        ...(sourceTypeKnown ? { sourceType: sourceTypeKnown } : {}),
        active: (r as { active?: boolean }).active !== false,
        status: lifecycleSt,
        trainingStatus: bundle.trainingStatus,
        extractionStatus: extrSt ?? 'not_required',
        updatedAt: iso((r as { updatedAt?: Date }).updatedAt) ?? null,
        lastQueuedAt: iso((r as { lastQueuedAt?: Date }).lastQueuedAt) ?? null,
        runAfter: iso((r as { runAfter?: Date }).runAfter) ?? null,
        lastTrainingStartedAt: iso((r as { lastTrainingStartedAt?: Date }).lastTrainingStartedAt) ?? null,
        lastTrainedAt: lastTrainedAtResolved,
        trainingError: trainingErr,
        extractionError,
        displayStatus: bundle.displayStatus,
        displayLabel: bundle.displayLabel,
        displayMessage: bundle.displayMessage,
        isTraining: bundle.isTraining,
        isExtracting: bundle.isExtracting,
        isImporting: bundle.isImporting,
        trainingManualRetrySuggested: isTrainingManualRetrySuggested({
          knowledgeItemTrainingStatus: lifecycleSt,
          trainingError: trainingErr,
          trainingFailureCode,
        }),
        ...(trainingFailureCode != null ? { trainingFailureCode } : {}),
        ...(st === 'document'
          ? {
              extractManualRetrySuggested: ej
                ? isExtractManualRetrySuggested({
                    extractStatus: ej.status,
                    extractAutoRetryCycles: ej.extractAutoRetryCycles,
                    latestExtractError: ej.extractLastError,
                  })
                : false,
            }
          : {}),
        ...(st === 'faq' && typeof faqMeta?.faqIndex === 'number'
          ? { faqIndex: faqMeta.faqIndex }
          : {}),
        ...(st === 'note'
          ? (() => {
              const si = coerceNoteSnippetIndex(noteMeta);
              return si !== undefined ? { snippetIndex: si } : {};
            })()
          : {}),
        ...(st === 'table' && typeof tableMeta?.tableIndex === 'number'
          ? { tableIndex: tableMeta.tableIndex }
          : {}),
        ...(st === 'suggestion' && typeof suggestionMeta?.suggestionIndex === 'number'
          ? { suggestionIndex: suggestionMeta.suggestionIndex }
          : {}),
        ...(st === 'document'
          ? (() => {
              const bytes = calculateDocumentKnowledgeUsageBytes(r as KnowledgeBaseItemUsageLean);
              return bytes > 0 ? { storedTextUtf8Bytes: bytes } : {};
            })()
          : {}),
      };
    });
  }

  /**
   * Safe titles for pending-only items (sidebar modal). Never exposes suggestion scoped/body content beyond chip/title.
   */
  private displayTitleForPendingKbItem(row: Record<string, unknown>): string {
    const st = row.sourceType ?? '';
    const titleRaw = typeof row.title === 'string' ? row.title.trim() : '';
    if (st === 'suggestion') {
      const sm = row.suggestionMeta as { chipText?: string } | undefined;
      const chip = typeof sm?.chipText === 'string' ? sm.chipText.trim() : '';
      return chip || titleRaw || 'Untitled suggestion';
    }
    if (st === 'faq') {
      if (titleRaw) return titleRaw;
      const faqMeta = row.faqMeta as KnowledgeBaseItemFaqMeta | undefined;
      const gt = (faqMeta?.title ?? '').trim();
      if (gt) return gt;
      const q0 =
        Array.isArray(faqMeta?.questions) && faqMeta.questions.length
          ? String(faqMeta.questions[0] ?? '').trim()
          : '';
      if (q0) return q0;
      return 'Untitled Q&A';
    }
    if (st === 'document' || st === 'url' || st === 'html') {
      if (titleRaw) return titleRaw;
      const docFm = effectiveKbDocumentFileMetaLean(row);
      const fn = (docFm.originalName ?? '').trim();
      if (fn) return fn;
      return 'Untitled document';
    }
    if (st === 'note') {
      return titleRaw || 'Untitled snippet';
    }
    if (st === 'table') {
      return titleRaw || 'Untitled datasheet';
    }
    return titleRaw || 'Untitled item';
  }

  /** Lifecycle buckets for sidebar status + workload estimates — delegates to {@link aggregateAgentTrainingLifecycleBundle}. */
  async aggregateCustomerTrainingLifecycleMetrics(
    botId: string,
    nowInput?: Date,
    opts?: { pipelineTouchCutoff?: Date },
  ): Promise<{
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
  }> {
    return (await this.aggregateAgentTrainingLifecycleBundle(botId, nowInput, opts)).lm;
  }

  /**
   * Supplement lifecycle tallies — same bundle as {@link aggregateAgentTrainingLifecycleBundle}.
   */
  async aggregateKbLifecycleSupplementCounts(
    botId: string,
    opts?: { pipelineTouchCutoff?: Date },
  ): Promise<{
    extractingCount: number;
    extractionFailedCount: number;
    datasheetImportPipelineCount: number;
    trainingQueuedCount: number;
    trainingProcessingCount: number;
    trainingFailedCount: number;
    readyCount: number;
  }> {
    return (await this.aggregateAgentTrainingLifecycleBundle(botId, undefined, opts)).lifecycleCounts;
  }

  /**
   * Per data-source rollups — {@link aggregateAgentTrainingLifecycleBundle}.
   */
  async aggregateTrainingLifecycleByDataSource(
    botId: string,
    nowInput?: Date,
    opts?: { pipelineTouchCutoff?: Date },
  ): Promise<AgentTrainingDataSourceRow[]> {
    return (await this.aggregateAgentTrainingLifecycleBundle(botId, nowInput, opts)).dataSources;
  }

  /** Document KB rows that may lack an `ExtractJob` — reconciler narrows via {@link kbRowEligibleForQueuedContentExtraction}. */
  async findDocumentKbRowsForIngestReconcile(limit: number): Promise<
    Array<{
      _id: Types.ObjectId;
      botId: Types.ObjectId;
      status?: string;
      content?: string;
      fileMeta?: Record<string, unknown>;
      isContentExtracted?: boolean;
    }>
  > {
    const n = Math.max(1, Math.min(100, Math.floor(Number(limit)) || 25));
    return this.itemModel
      .find({
        sourceType: 'document',
        isContentExtracted: { $ne: true },
        $and: [knowledgeItemExcludeDeletedOnlyClause()],
      })
      .select('_id botId status content fileMeta isContentExtracted')
      .sort({ updatedAt: 1 })
      .limit(n)
      .lean()
      .exec() as unknown as Promise<
      Array<{
        _id: Types.ObjectId;
        botId: Types.ObjectId;
        status?: string;
        content?: string;
        fileMeta?: Record<string, unknown>;
        isContentExtracted?: boolean;
      }>
    >;
  }

  /**
   * Rows still awaiting extraction (for cron sweep). Includes legacy `file` / `sourceMeta` so
   * {@link effectiveKbDocumentFileMetaLean} matches worker reads.
   */
  async findDocumentKbRowsForUploadSourceFailureSweep(limit: number): Promise<
    Array<{
      _id: Types.ObjectId;
      botId: Types.ObjectId;
      content?: string;
      fileMeta?: Record<string, unknown>;
      file?: Record<string, unknown>;
      sourceMeta?: Record<string, unknown>;
      isContentExtracted?: boolean;
    }>
  > {
    const n = Math.max(1, Math.min(100, Math.floor(Number(limit)) || 25));
    return this.itemModel
      .find({
        sourceType: 'document',
        isContentExtracted: { $ne: true },
        $and: [knowledgeItemExcludeDeletedOnlyClause()],
      })
      .select('_id botId content fileMeta file sourceMeta isContentExtracted')
      .sort({ updatedAt: 1 })
      .limit(n)
      .lean()
      .exec() as unknown as Promise<
      Array<{
        _id: Types.ObjectId;
        botId: Types.ObjectId;
        content?: string;
        fileMeta?: Record<string, unknown>;
        file?: Record<string, unknown>;
        sourceMeta?: Record<string, unknown>;
        isContentExtracted?: boolean;
      }>
    >;
  }

  /**
   * Document KB stuck in training `processing` before text is extracted, for orphan detection —
   * embedding-phase `processing` uses `isContentExtracted === true` and must be excluded here.
   */
  async findDocumentKbRowsPhantomExtractProcessing(limit: number): Promise<
    Array<{ _id: Types.ObjectId; botId: Types.ObjectId; status?: string }>
  > {
    const n = Math.max(1, Math.min(100, Math.floor(Number(limit)) || 25));
    return this.itemModel
      .find({
        sourceType: 'document',
        status: 'processing',
        isContentExtracted: { $ne: true },
        $and: [knowledgeItemExcludeDeletedOnlyClause()],
      })
      .select('_id botId status')
      .sort({ updatedAt: 1 })
      .limit(n)
      .lean()
      .exec() as unknown as Promise<
      Array<{ _id: Types.ObjectId; botId: Types.ObjectId; status?: string }>
    >;
  }

  /**
   * Items for customer Training status modal: action-needed (pending, failed, future-scheduled)
   * plus rows actively embedding or queued and due (`processing`, `queued` with runAfter due / unset).
   */
  async listPendingTrainingItemSummaries(botId: string): Promise<
    Array<{
      id: string;
      sourceType: string;
      title: string;
      displayStatus:
        | 'needs_training'
        | 'failed'
        | 'scheduled'
        | 'extraction_failed'
        | 'in_training'
        | 'training_queued';
      /** ISO time when queued for a future embedding run ({@link displayStatus} `scheduled`). */
      nextRunAfter?: string | null;
    }>
  > {
    if (!Types.ObjectId.isValid(botId)) return [];
    const botOid = new Types.ObjectId(botId);
    const now = new Date();
    const planOkListing = knowledgeItemNotBlockedByPlanLimitBotKbTotalMongoClause();
    const rows = await this.itemModel
      .find({
        botId: botOid,
        sourceType: { $in: ['document', 'faq', 'note', 'table', 'suggestion', 'url', 'html'] as const },
        $and: [knowledgeItemExcludeDeletedOnlyClause(), planOkListing],
        $or: [
          { status: 'pending' },
          { status: 'failed' },
          { status: 'processing' },
          {
            status: 'queued',
            $or: [{ runAfter: { $exists: false } }, { runAfter: null }, { runAfter: { $lte: now } }],
          },
          { status: 'queued', runAfter: { $gt: now } },
          {
            sourceType: 'document',
            extractionStatus: { $in: ['failed', 'waiting_for_source', 'queued', 'processing'] },
          },
        ],
      })
      .select(
        '_id sourceType status title runAfter faqMeta suggestionMeta fileMeta isContentExtracted extractionStatus',
      )
      .sort({ title: 1, _id: 1 })
      .lean();
    const out: Array<{
      id: string;
      sourceType: string;
      title: string;
      displayStatus:
        | 'needs_training'
        | 'failed'
        | 'scheduled'
        | 'extraction_failed'
        | 'in_training'
        | 'training_queued';
      nextRunAfter?: string | null;
    }> = [];
    for (const r of rows) {
      const st = String((r as { status?: string }).status ?? '');
      const ra = (r as { runAfter?: Date | null }).runAfter ?? null;
      const ds =
        typeof ra === 'object' &&
        ra != null &&
        'getTime' in ra &&
        typeof (ra as Date).getTime === 'function'
          ? (ra as Date)
          : null;
      const src = String((r as { sourceType?: string }).sourceType ?? '');
      const extractionSt = String((r as { extractionStatus?: string }).extractionStatus ?? '').trim();
      if (
        src === 'document' &&
        extractionSt &&
        extractionSt !== 'done' &&
        extractionSt !== 'not_required'
      ) {
        out.push({
          id: String((r as { _id: Types.ObjectId })._id),
          sourceType: src,
          title: this.displayTitleForPendingKbItem(r as Record<string, unknown>),
          displayStatus: extractionSt === 'failed' ? 'extraction_failed' : 'needs_training',
        });
        continue;
      }
      const extracted = (r as { isContentExtracted?: boolean }).isContentExtracted === true;
      if (src === 'document' && !extractionSt && !extracted && st !== 'failed') {
        continue;
      }
      if (st === 'processing') {
        out.push({
          id: String((r as { _id: Types.ObjectId })._id),
          sourceType: String((r as { sourceType?: string }).sourceType ?? ''),
          title: this.displayTitleForPendingKbItem(r as Record<string, unknown>),
          displayStatus: 'in_training',
        });
        continue;
      }
      if (st === 'queued' && isScheduledRunDue(ds, now)) {
        out.push({
          id: String((r as { _id: Types.ObjectId })._id),
          sourceType: String((r as { sourceType?: string }).sourceType ?? ''),
          title: this.displayTitleForPendingKbItem(r as Record<string, unknown>),
          displayStatus: 'training_queued',
          ...(ds instanceof Date && Number.isFinite(ds.getTime()) ? { nextRunAfter: ds.toISOString() } : {}),
        });
        continue;
      }
      const displayStatus = actionNeededItemDisplayStatus(st, ds, now);
      if (!displayStatus) continue;
      out.push({
        id: String((r as { _id: Types.ObjectId })._id),
        sourceType: String((r as { sourceType?: string }).sourceType ?? ''),
        title: this.displayTitleForPendingKbItem(r as Record<string, unknown>),
        displayStatus,
        nextRunAfter:
          displayStatus === 'scheduled' && ds instanceof Date && Number.isFinite(ds.getTime())
            ? ds.toISOString()
            : undefined,
      });
    }
    return out;
  }

  /**
   * Manual "train now" / **Retrain Agent**: queue pending/failed (and optional force-ready), then caller schedules jobs.
   * Per-row `runAfter` matches Auto Train spacing ({@link computeAutomaticItemRunAfter} / {@link getIngestQueueTimesForDocument} for documents).
   */
  async applyTrainNow(
    botId: string,
    input: ApplyTrainNowInput,
  ): Promise<{
    scopesForJob: KnowledgeTrainingScope[];
    documentIdsForIngest: string[];
    affectedKbSectionTypes: KnowledgeTrainNowAffectedKbType[];
  }> {
    if (!Types.ObjectId.isValid(botId)) {
      return { scopesForJob: [], documentIdsForIngest: [], affectedKbSectionTypes: [] };
    }
    const botOid = new Types.ObjectId(botId);
    const now = new Date();
    const includeFailed = input.includeFailed !== false;

    const planOkTrain = knowledgeItemNotBlockedByPlanLimitBotKbTotalMongoClause();
    const settings = await this.getBotTrainingSettings(botId);

    const mapScope = (src: string): KnowledgeTrainingScope | null => {
      if (src === 'faq' || src === 'note' || src === 'table' || src === 'suggestion') return src;
      return null;
    };

    const sourceTypesFull = (): Array<'faq' | 'note' | 'table' | 'document' | 'suggestion'> => [
      'faq',
      'note',
      'table',
      'document',
      'suggestion',
    ];

    /** Single-row path */
    if (input.itemId && Types.ObjectId.isValid(input.itemId)) {
      const row = await this.itemModel
        .findOne({
          _id: new Types.ObjectId(input.itemId),
          botId: botOid,
          $and: [knowledgeItemExcludeDeletedOnlyClause()],
        })
        .lean();
      if (!row) return { scopesForJob: [], documentIdsForIngest: [], affectedKbSectionTypes: [] };
      const st = row as {
        sourceType?: string;
        status?: KnowledgeBaseItemTrainingStatus;
        _id?: Types.ObjectId;
        isContentExtracted?: boolean;
        extractionStatus?: string;
      };
      if (input.type !== 'all' && st.sourceType !== input.type) {
        return { scopesForJob: [], documentIdsForIngest: [], affectedKbSectionTypes: [] };
      }
      if (st.sourceType === 'document') {
        const ex = String(st.extractionStatus ?? '').trim();
        const body = String((row as { content?: string }).content ?? '').trim();
        if (
          ex !== 'done' ||
          st.isContentExtracted !== true ||
          !body ||
          !isTrainableExtractedDocumentText(body)
        ) {
          return { scopesForJob: [], documentIdsForIngest: [], affectedKbSectionTypes: [] };
        }
      }
      const status = normalizeKnowledgeTrainingStatus(
        (row as { status?: string }).status,
      ) as KnowledgeBaseItemTrainingStatus;
      if (status === 'processing') return { scopesForJob: [], documentIdsForIngest: [], affectedKbSectionTypes: [] };
      if (status === 'ready' && !input.forceRetrain) return { scopesForJob: [], documentIdsForIngest: [], affectedKbSectionTypes: [] };

      if (knowledgeBaseItemRowIndicatesPlanLimitBotKbTotal(row as Record<string, unknown>)) {
        return { scopesForJob: [], documentIdsForIngest: [], affectedKbSectionTypes: [] };
      }

      let lastQueuedAt = now;
      let runAfter: Date;
      if (st.sourceType === 'document') {
        const t = await this.getIngestQueueTimesForDocument(botId, String(st._id), now);
        lastQueuedAt = t.lastQueuedAt;
        runAfter = t.runAfter;
      } else {
        runAfter = this.computeManualRetrainRunAfterForScopeRow(settings, row as Record<string, unknown>, now);
      }

      await this.itemModel.updateOne(
        { _id: row._id },
        {
          $set: {
            status: 'queued',
            lastQueuedAt,
            runAfter,
            updatedAt: now,
          },
          $unset: { trainingError: 1 },
        },
      );
      const sco = mapScope(String(st.sourceType ?? ''));
      const scopesForJob = sco != null ? ([sco] as KnowledgeTrainingScope[]) : ([] as KnowledgeTrainingScope[]);
      const documentIdsForIngest = st.sourceType === 'document' ? [String(st._id)] : [];
      const src = String(st.sourceType ?? '');
      const affectedSingle: KnowledgeTrainNowAffectedKbType[] =
        src === 'faq' || src === 'note' || src === 'table' || src === 'document' || src === 'suggestion'
          ? [src]
          : [];
      await this.refreshBotKnowledgeStats(botId);
      return {
        scopesForJob: mergeTrainingScopes(scopesForJob),
        documentIdsForIngest,
        affectedKbSectionTypes: affectedSingle,
      };
    }

    const typesScope = (
      input.type === 'all' ? sourceTypesFull() : [input.type as 'faq' | 'note' | 'table' | 'document' | 'suggestion']
    ).filter((t) => ['faq', 'note', 'table', 'document', 'suggestion'].includes(t)) as Array<
      'faq' | 'note' | 'table' | 'document' | 'suggestion'
    >;

    const touchedScopes = new Set<KnowledgeTrainingScope>();
    const affectedKb = new Set<KnowledgeTrainNowAffectedKbType>();

    for (const st of typesScope) {
      const orRows = actionableRetrainOrBranches(
        includeFailed,
        !!(input.forceRetrain && !input.itemId),
        now,
      );
      const extraDocExtractionClause =
        st === 'document'
          ? ({ isContentExtracted: true, extractionStatus: 'done' as const } as const)
          : ({} as const);

      const selectLean =
        st === 'document' ? '_id sourceType status' : '_id sourceType lastTrainedAt rawContent title characterCount';

      const cand = await this.itemModel
        .find({
          botId: botOid,
          sourceType: st,
          status: { $ne: 'processing' },
          ...extraDocExtractionClause,
          $or: orRows,
          $and: [knowledgeItemExcludeDeletedOnlyClause(), planOkTrain],
        })
        .select(selectLean)
        .lean();

      let modified = 0;
      for (const raw of cand) {
        const id = (raw as { _id: Types.ObjectId })._id;
        let lastQueuedAt = now;
        let runAfter: Date;
        if (st === 'document') {
          const t = await this.getIngestQueueTimesForDocument(botId, String(id), now);
          lastQueuedAt = t.lastQueuedAt;
          runAfter = t.runAfter;
        } else {
          runAfter = this.computeManualRetrainRunAfterForScopeRow(settings, raw as Record<string, unknown>, now);
        }
        const res = await this.itemModel.updateOne(
          { _id: id },
          {
            $set: {
              status: 'queued',
              lastQueuedAt,
              runAfter,
              updatedAt: now,
            },
            $unset: { trainingError: 1 },
          },
        );
        if ((res.modifiedCount ?? 0) > 0) modified += 1;
      }

      if (modified > 0) {
        const m = mapScope(st);
        if (m) touchedScopes.add(m);
        affectedKb.add(st as KnowledgeTrainNowAffectedKbType);
      }
    }

    kbTrainingLog('applyTrainNow', {
      bot: botId,
      types: JSON.stringify(typesScope),
      scopesForJobCandidate: mergeTrainingScopes([...touchedScopes]).join('|'),
      affectedKb: [...affectedKb].join('|'),
    });

    let documentIdsForIngest: string[] = [];
    if (typesScope.includes('document')) {
      const alldocs = await this.itemModel.distinct('_id', {
        botId: botOid,
        sourceType: 'document',
        status: 'queued',
        isContentExtracted: true,
        extractionStatus: 'done',
        $and: [knowledgeItemExcludeDeletedOnlyClause()],
      } as Record<string, unknown>);
      documentIdsForIngest = alldocs
        .map((x) => (x instanceof Types.ObjectId ? String(x) : String(x)))
        .filter(Boolean);
    }

    const scopesArray = [...touchedScopes] as KnowledgeTrainingScope[];
    await this.refreshBotKnowledgeStats(botId);
    return {
      scopesForJob: mergeTrainingScopes(scopesArray),
      documentIdsForIngest,
      affectedKbSectionTypes: [...affectedKb],
    };
  }
}
