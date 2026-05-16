import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ExtractJob, TrainJob } from '../models';
import {
  KnowledgeBaseItem,
  type KnowledgeBaseItemSuggestionMeta,
} from '../models/knowledge-base-item.schema';
import type { KnowledgeTrainingScope } from '../models/train-job.schema';
import { knowledgeItemExcludeDeletedOnlyClause } from '../knowledge/knowledge-base-item-access.service';
import { KnowledgeBaseItemService } from '../knowledge/knowledge-base-item.service';
import { KnowledgeTrainingJobService } from '../knowledge/knowledge-training-job.service';
import { deriveKnowledgeBaseItemDisplayFields } from '../knowledge/knowledge-item-display-status.util';
import {
  effectiveKbDocumentFileMetaLean,
} from '../knowledge/knowledge-base-document-sync-fields.util';
import { isTrainableExtractedDocumentText } from '../knowledge/knowledge-text-metrics';
import { normalizeKnowledgeTrainingStatus } from '../knowledge/knowledge-training-status.util';
import { IngestionService } from '../ingestion/ingestion.service';
import { TableImportService } from '../ingestion/table-import.service';
import { BotKnowledgeTotalLimitService, PLAN_LIMIT_BOT_KB_TOTAL_CODE } from '../knowledge/bot-knowledge-total-limit.service';
import { calculateKnowledgeItemUsageBytes, type KnowledgeBaseItemUsageLean } from '../knowledge/knowledge-usage.util';
import {
  INGESTION_STUCK_TIMEOUT_MINUTES,
  KNOWLEDGE_MANUAL_RETRY_MAX_PER_ITEM,
  KNOWLEDGE_MANUAL_RETRY_MIN_INTERVAL_MS,
  KNOWLEDGE_TRAINING_STUCK_TIMEOUT_MINUTES,
  TABLE_IMPORT_STUCK_TIMEOUT_MINUTES,
} from '../lib/global.constants';
import { RateLimitService } from '../rate-limit/rate-limit.service';

export type KnowledgeManualRetryAction =
  | 'retry_extraction'
  | 'retry_training'
  | 'retry_import'
  | 'reset_stuck_extraction'
  | 'reset_stuck_training'
  | 'reset_stuck_import';

export type KnowledgeManualRetryResponse = {
  ok: true;
  action: KnowledgeManualRetryAction;
  status: string;
  extractionStatus: string;
  displayStatus: string;
  displayMessage: string;
};

export type KnowledgeManualRetryErrorCode =
  | 'item_not_found'
  | 'item_deleted'
  | 'retry_not_allowed'
  | 'extraction_not_done'
  | 'source_file_missing'
  | 'import_session_expired'
  | 'already_queued'
  | 'already_processing'
  | 'not_stuck_yet'
  | 'manual_retry_cap_exceeded';

function ingestStuckCutoffMs(): number {
  const m = Math.max(1, INGESTION_STUCK_TIMEOUT_MINUTES);
  return m * 60 * 1000;
}

function trainStuckCutoffMs(): number {
  const m = Math.max(1, KNOWLEDGE_TRAINING_STUCK_TIMEOUT_MINUTES);
  return m * 60 * 1000;
}

function tableImportStuckCutoffMs(): number {
  const m = Math.max(1, TABLE_IMPORT_STUCK_TIMEOUT_MINUTES);
  return m * 60 * 1000;
}

@Injectable()
export class KnowledgeItemManualRetryService {
  constructor(
    @InjectModel(KnowledgeBaseItem.name) private readonly itemModel: Model<KnowledgeBaseItem>,
    @InjectModel(ExtractJob.name) private readonly extractJobModel: Model<ExtractJob>,
    @InjectModel(TrainJob.name) private readonly trainJobModel: Model<TrainJob>,
    private readonly knowledgeBaseItemService: KnowledgeBaseItemService,
    private readonly knowledgeTrainingJobService: KnowledgeTrainingJobService,
    private readonly ingestionService: IngestionService,
    private readonly tableImportService: TableImportService,
    private readonly botKbTotalLimit: BotKnowledgeTotalLimitService,
    private readonly rateLimitService: RateLimitService,
  ) {}

  private async ensureManualRetryEligibleKnowledgeRow(
    botId: string,
    itemId: string,
  ): Promise<{
    row: Record<string, unknown>;
    botOid: Types.ObjectId;
    itemOid: Types.ObjectId;
  }> {
    if (!Types.ObjectId.isValid(botId) || !Types.ObjectId.isValid(itemId)) {
      throw new HttpException({ error: 'Invalid id', errorCode: 'bad_request' }, HttpStatus.BAD_REQUEST);
    }
    const botOid = new Types.ObjectId(botId);
    const itemOid = new Types.ObjectId(itemId);

    const row = await this.itemModel
      .findOne({
        _id: itemOid,
        botId: botOid,
        $and: [knowledgeItemExcludeDeletedOnlyClause()],
      })
      .lean();
    if (!row) {
      throw new HttpException({ error: 'Knowledge item not found', errorCode: 'item_not_found' }, HttpStatus.NOT_FOUND);
    }

    return { row: row as Record<string, unknown>, botOid, itemOid };
  }

  /** Mongo-backed spacing for manual retry (shared across API replicas). Runs after cap reservation so cap rejects do not consume spacing. */
  private async assertKnowledgeManualRetrySpacingMongo(botId: string, itemId: string): Promise<void> {
    const r = await this.rateLimitService.check({
      key: `cust_kb_manual_retry_spacing:${botId}:${itemId}`,
      limit: 1,
      windowMs: KNOWLEDGE_MANUAL_RETRY_MIN_INTERVAL_MS,
    });
    if (!r.allowed) {
      throw new HttpException(
        { error: 'Please wait a moment before retrying again.', errorCode: 'retry_rate_limited' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async reserveKnowledgeManualRetrySlot(botOid: Types.ObjectId, itemOid: Types.ObjectId): Promise<void> {
    const r = await this.itemModel.updateOne(
      {
        _id: itemOid,
        botId: botOid,
        $expr: {
          $lt: [{ $ifNull: ['$knowledgeManualRetryCount', 0] }, KNOWLEDGE_MANUAL_RETRY_MAX_PER_ITEM],
        },
      },
      { $inc: { knowledgeManualRetryCount: 1 } },
    );
    const modifiedCount = typeof r.modifiedCount === 'number' ? r.modifiedCount : 0;
    if (modifiedCount !== 1) {
      const cur = await this.itemModel.findById(itemOid).select('knowledgeManualRetryCount').lean();
      const cRaw = cur ? (cur as { knowledgeManualRetryCount?: number }).knowledgeManualRetryCount : undefined;
      const c = typeof cRaw === 'number' && Number.isFinite(cRaw) ? Math.max(0, Math.floor(cRaw)) : 0;
      if (c >= KNOWLEDGE_MANUAL_RETRY_MAX_PER_ITEM) {
        throw new HttpException(
          {
            error: 'Manual retry limit reached for this knowledge item.',
            errorCode: 'manual_retry_cap_exceeded',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      throw new HttpException(
        { error: 'Could not reserve manual retry.', errorCode: 'retry_not_allowed' },
        HttpStatus.CONFLICT,
      );
    }
  }

  private async releaseKnowledgeManualRetrySlot(botOid: Types.ObjectId, itemOid: Types.ObjectId): Promise<void> {
    await this.itemModel.updateOne(
      { _id: itemOid, botId: botOid, knowledgeManualRetryCount: { $gt: 0 } },
      { $inc: { knowledgeManualRetryCount: -1 } },
    );
  }

  async manualRetry(
    botId: string,
    itemId: string,
  ): Promise<KnowledgeManualRetryResponse> {
    const { row, botOid, itemOid } = await this.ensureManualRetryEligibleKnowledgeRow(botId, itemId);

    await this.reserveKnowledgeManualRetrySlot(botOid, itemOid);
    try {
      await this.assertKnowledgeManualRetrySpacingMongo(botId, itemId);

      const sourceType = String((row as { sourceType?: string }).sourceType ?? '');
      let action: KnowledgeManualRetryAction;

      if (sourceType === 'document') {
        action = await this.handleDocumentRetry(botId, itemId, row as Record<string, unknown>);
      } else if (sourceType === 'table') {
        action = await this.handleTableRetry(botId, itemId, row as Record<string, unknown>);
      } else if (sourceType === 'faq' || sourceType === 'note' || sourceType === 'suggestion') {
        action = await this.handleScopeRetry(botId, itemId, row as Record<string, unknown>, sourceType);
      } else {
        throw new HttpException(
          { error: 'Retry is not available for this item', errorCode: 'retry_not_allowed' },
          HttpStatus.BAD_REQUEST,
        );
      }

      const fresh = await this.itemModel.findById(itemOid).lean();
      const freshSt = String((fresh as { sourceType?: string })?.sourceType ?? sourceType);
      const freshTm = (fresh as { tableMeta?: { importPhase?: string; importError?: string; importErrorCode?: string } })
        .tableMeta;
      const freshExtractionErr = (fresh as { extractionError?: string | null }).extractionError;
      const disp = deriveKnowledgeBaseItemDisplayFields({
        sourceType: freshSt,
        status: (fresh as { status?: string })?.status,
        extractionStatus: (fresh as { extractionStatus?: string })?.extractionStatus,
        isContentExtracted: (fresh as { isContentExtracted?: boolean })?.isContentExtracted,
        content: typeof (fresh as { content?: string })?.content === 'string' ? (fresh as { content: string }).content : '',
        fileMeta: effectiveKbDocumentFileMetaLean(fresh as unknown as Record<string, unknown>) as Record<string, unknown>,
        uploadDocumentStatus: (() => {
          const fm = effectiveKbDocumentFileMetaLean(fresh as unknown as Record<string, unknown>);
          return typeof fm.uploadStatus === 'string' ? fm.uploadStatus : undefined;
        })(),
        tableImportPhase: freshSt === 'table' ? String(freshTm?.importPhase ?? '') : undefined,
        trainingError: (fresh as { trainingError?: string | null })?.trainingError ?? null,
        extractionError:
          typeof freshExtractionErr === 'string' && freshExtractionErr.trim() ? freshExtractionErr.trim() : null,
        importErrorCode: freshSt === 'table' ? (freshTm?.importErrorCode ?? null) : null,
        importError: freshSt === 'table' ? (freshTm?.importError ?? null) : null,
      });

      return {
        ok: true,
        action,
        status: normalizeKnowledgeTrainingStatus(String((fresh as { status?: string })?.status ?? '')),
        extractionStatus: String((fresh as { extractionStatus?: string })?.extractionStatus ?? 'not_required'),
        displayStatus: disp.displayStatus,
        displayMessage: disp.displayMessage,
      };
    } catch (err) {
      try {
        await this.releaseKnowledgeManualRetrySlot(botOid, itemOid);
      } catch {
        /* avoid masking the handler error */
      }
      throw err;
    }
  }

  private async handleDocumentRetry(botId: string, routeId: string, row: Record<string, unknown>): Promise<KnowledgeManualRetryAction> {
    const extr = String((row as { extractionStatus?: string }).extractionStatus ?? '').trim();
    const st = normalizeKnowledgeTrainingStatus(String((row as { status?: string }).status ?? ''));
    const isEx = (row as { isContentExtracted?: boolean }).isContentExtracted === true;
    const content = typeof row.content === 'string' ? row.content : '';
    const botOid = new Types.ObjectId(botId);
    const kbOid = new Types.ObjectId(routeId);
    const now = Date.now();

    const extractLive = await this.extractJobModel
      .findOne({
        botId: botOid,
        knowledgeBaseItemId: kbOid,
        status: { $in: ['queued', 'processing'] as const },
      })
      .sort({ createdAt: -1 })
      .lean();
    const extractProcessing =
      extractLive && (extractLive as { status?: string }).status === 'processing';

    if (extr === 'processing' || extractProcessing) {
      const started = extractLive ? (extractLive as { startedAt?: Date }).startedAt : undefined;
      const t0 =
        started instanceof Date && !isNaN(started.getTime())
          ? started.getTime()
          : now;
      if (now - t0 < ingestStuckCutoffMs()) {
        throw new HttpException(
          { error: 'Extraction is still running; try again later.', errorCode: 'not_stuck_yet' },
          HttpStatus.CONFLICT,
        );
      }
      const n = await this.ingestionService.manualResetStuckExtractForKnowledgeItem(botId, routeId);
      if (!n) {
        throw new HttpException(
          { error: 'Nothing to reset for extraction.', errorCode: 'not_stuck_yet' },
          HttpStatus.CONFLICT,
        );
      }
      return 'reset_stuck_extraction';
    }

    if (extr === 'failed') {
      if (extractLive && (extractLive as { status?: string }).status === 'queued') {
        throw new HttpException(
          { error: 'Extraction is already queued.', errorCode: 'already_queued' },
          HttpStatus.CONFLICT,
        );
      }
      const fm = effectiveKbDocumentFileMetaLean(row as unknown as Record<string, unknown>);
      if (
        !isTrainableExtractedDocumentText(content) &&
        isEx
      ) {
        await this.itemModel.updateOne(
          { _id: kbOid, botId: botOid },
          {
            $set: { isContentExtracted: false, updatedAt: new Date() },
          },
        );
      }
      await this.ingestionService.manualRetryExtractJob(botId, routeId);
      return 'retry_extraction';
    }

    if (extr === 'done' && isEx && st === 'failed') {
      const trainProc = await this.trainJobModel
        .findOne({
          botId: botOid,
          kind: 'document',
          knowledgeBaseItemId: kbOid,
          status: 'processing',
        })
        .sort({ createdAt: -1 })
        .lean();
      if (trainProc) {
        const started = (trainProc as { startedAt?: Date }).startedAt;
        const t0 =
          started instanceof Date && !isNaN(started.getTime())
            ? started.getTime()
            : now;
        if (now - t0 < trainStuckCutoffMs()) {
          throw new HttpException(
            { error: 'Training is still running.', errorCode: 'already_processing' },
            HttpStatus.CONFLICT,
          );
        }
        const ok = await this.knowledgeTrainingJobService.manualResetStuckDocumentTrainForKnowledgeItem(botId, routeId);
        if (!ok) {
          throw new HttpException({ error: 'Could not reset stuck training job.', errorCode: 'not_stuck_yet' }, HttpStatus.CONFLICT);
        }
        return 'reset_stuck_training';
      }
      const trainQueued = await this.trainJobModel
        .findOne({
          botId: botOid,
          kind: 'document',
          knowledgeBaseItemId: kbOid,
          status: 'queued',
        })
        .sort({ createdAt: -1 })
        .lean();
      if (trainQueued && st === 'failed') {
        throw new HttpException(
          { error: 'Training is already queued.', errorCode: 'already_queued' },
          HttpStatus.CONFLICT,
        );
      }
      const planTe = String((row as { trainingError?: string }).trainingError ?? '').trim();
      if (planTe === PLAN_LIMIT_BOT_KB_TOTAL_CODE) {
        await this.botKbTotalLimit.assertWithinLimit(botId, {
          replacingItemIds: [kbOid],
          incomingBytes: calculateKnowledgeItemUsageBytes(row as KnowledgeBaseItemUsageLean),
        });
      }
      const nowD = new Date();
      const times = await this.knowledgeBaseItemService.getIngestQueueTimesForDocument(botId, routeId, nowD);
      await this.itemModel.updateOne(
        { _id: kbOid, botId: botOid, sourceType: 'document', status: 'failed' },
        {
          $set: {
            status: 'queued',
            lastQueuedAt: times.lastQueuedAt,
            runAfter: times.runAfter,
            updatedAt: nowD,
          },
          $unset: { trainingError: 1 },
        },
      );
      await this.ingestionService.ensureQueuedIngestJobForDocument(botId, routeId);
      return 'retry_training';
    }

    if (st === 'processing' && extr === 'done' && isEx) {
      const trainProc = await this.trainJobModel
        .findOne({
          botId: botOid,
          kind: 'document',
          knowledgeBaseItemId: kbOid,
          status: 'processing',
        })
        .sort({ createdAt: -1 })
        .lean();
      if (!trainProc) {
        throw new HttpException({ error: 'Retry is not available.', errorCode: 'retry_not_allowed' }, HttpStatus.BAD_REQUEST);
      }
      const started = (trainProc as { startedAt?: Date }).startedAt;
      const t0 =
        started instanceof Date && !isNaN(started.getTime())
          ? started.getTime()
          : now;
      if (now - t0 < trainStuckCutoffMs()) {
        throw new HttpException(
          { error: 'Training is still running.', errorCode: 'not_stuck_yet' },
          HttpStatus.CONFLICT,
        );
      }
      const ok = await this.knowledgeTrainingJobService.manualResetStuckDocumentTrainForKnowledgeItem(botId, routeId);
      if (!ok) {
        throw new HttpException({ error: 'Could not reset stuck training.', errorCode: 'not_stuck_yet' }, HttpStatus.CONFLICT);
      }
      return 'reset_stuck_training';
    }

    throw new HttpException({ error: 'Retry is not available for this state.', errorCode: 'retry_not_allowed' }, HttpStatus.BAD_REQUEST);
  }

  private suggestionHasScopedBody(row: Record<string, unknown>): boolean {
    const sm = row.suggestionMeta as KnowledgeBaseItemSuggestionMeta | undefined;
    const s = sm?.scopedInformation;
    return typeof s === 'string' && s.trim().length > 0;
  }

  private async handleScopeRetry(
    botId: string,
    itemId: string,
    row: Record<string, unknown>,
    sourceType: 'faq' | 'note' | 'suggestion',
  ): Promise<KnowledgeManualRetryAction> {
    if (sourceType === 'suggestion' && !this.suggestionHasScopedBody(row)) {
      throw new HttpException(
        { error: 'Label-only suggestions cannot be retried.', errorCode: 'retry_not_allowed' },
        HttpStatus.BAD_REQUEST,
      );
    }
    const extr = String((row as { extractionStatus?: string }).extractionStatus ?? '').trim();
    if (extr !== 'not_required' && extr !== '') {
      throw new HttpException(
        { error: 'Extraction must be complete before retraining.', errorCode: 'extraction_not_done' },
        HttpStatus.BAD_REQUEST,
      );
    }
    const st = normalizeKnowledgeTrainingStatus(String((row as { status?: string }).status ?? ''));
    const scope = sourceType as KnowledgeTrainingScope;
    const now = Date.now();
    const itemOid = new Types.ObjectId(itemId);
    const botOid = new Types.ObjectId(botId);

    if (st === 'processing') {
      const lst = (row as { lastTrainingStartedAt?: Date }).lastTrainingStartedAt;
      const t0 =
        lst instanceof Date && !isNaN(lst.getTime())
          ? lst.getTime()
          : now;
      if (now - t0 < trainStuckCutoffMs()) {
        throw new HttpException(
          { error: 'Training is still running.', errorCode: 'not_stuck_yet' },
          HttpStatus.CONFLICT,
        );
      }
      const ok = await this.knowledgeTrainingJobService.manualResetStuckScopesTrainForBotScope(botId, scope);
      if (!ok) {
        throw new HttpException({ error: 'Could not reset stuck training job.', errorCode: 'not_stuck_yet' }, HttpStatus.CONFLICT);
      }
      return 'reset_stuck_training';
    }

    if (st !== 'failed') {
      throw new HttpException({ error: 'Retry is only available for failed items.', errorCode: 'retry_not_allowed' }, HttpStatus.BAD_REQUEST);
    }

    const dup = await this.itemModel
      .findOne({
        _id: itemOid,
        botId: botOid,
        sourceType,
        status: 'queued',
      })
      .select('_id')
      .lean();
    if (dup) {
      throw new HttpException(
        { error: 'This item is already queued for training.', errorCode: 'already_queued' },
        HttpStatus.CONFLICT,
      );
    }

    const n = await this.knowledgeBaseItemService.queueSingleFailedKbItemForTraining(botId, itemId, scope);
    if (!n.updated) {
      throw new HttpException({ error: 'Could not queue training retry.', errorCode: 'retry_not_allowed' }, HttpStatus.BAD_REQUEST);
    }
    return 'retry_training';
  }

  private async handleTableRetry(botId: string, itemId: string, row: Record<string, unknown>): Promise<KnowledgeManualRetryAction> {
    const tm = (row as { tableMeta?: { importPhase?: string } }).tableMeta;
    const phase = String(tm?.importPhase ?? '').trim();
    const st = normalizeKnowledgeTrainingStatus(String((row as { status?: string }).status ?? ''));
    const extr = String((row as { extractionStatus?: string }).extractionStatus ?? '').trim();
    const now = Date.now();

    if (phase === 'import_failed' || phase === 'import_queued' || phase === 'importing') {
      if (phase === 'importing') {
        const r = await this.tableImportService.findLiveTableImportJobForKnowledgeItem(botId, itemId);
        if (r?.status === 'processing') {
          const started = r.startedAt;
          const t0 =
            started instanceof Date && !isNaN(started.getTime())
              ? started.getTime()
              : now;
          if (now - t0 < tableImportStuckCutoffMs()) {
            throw new HttpException(
              { error: 'Import is still running.', errorCode: 'not_stuck_yet' },
              HttpStatus.CONFLICT,
            );
          }
          await this.tableImportService.manualResetStuckTableImportForKnowledgeItem(botId, itemId);
          return 'reset_stuck_import';
        }
      }
      if (phase === 'import_failed') {
        const r = await this.tableImportService.manualRetryFailedTableImport(botId, itemId);
        if (!r.ok) {
          if (r.errorCode === 'source_file_missing') {
            throw new HttpException(
              { error: 'Source file is no longer available. Please upload the datasheet again.', errorCode: 'source_file_missing' },
              HttpStatus.BAD_REQUEST,
            );
          }
          if (r.errorCode === 'import_session_expired') {
            throw new HttpException(
              { error: 'Import session expired. Please start a new import.', errorCode: 'import_session_expired' },
              HttpStatus.BAD_REQUEST,
            );
          }
          if (r.errorCode === 'already_queued') {
            throw new HttpException(
              { error: 'Import is already queued.', errorCode: 'already_queued' },
              HttpStatus.CONFLICT,
            );
          }
          throw new HttpException({ error: 'Retry import is not available.', errorCode: 'retry_not_allowed' }, HttpStatus.BAD_REQUEST);
        }
        return 'retry_import';
      }
      if (phase === 'import_queued') {
        const live = await this.tableImportService.findLiveTableImportJobForKnowledgeItem(botId, itemId);
        if (live?.status === 'queued') {
          throw new HttpException(
            { error: 'Import is already queued.', errorCode: 'already_queued' },
            HttpStatus.CONFLICT,
          );
        }
      }
    }

    if ((phase === 'complete' || phase === '') && (extr === 'not_required' || !extr) && st === 'failed') {
      const n = await this.knowledgeBaseItemService.queueSingleFailedKbItemForTraining(botId, itemId, 'table');
      if (!n.updated) {
        throw new HttpException({ error: 'Could not queue training retry.', errorCode: 'retry_not_allowed' }, HttpStatus.BAD_REQUEST);
      }
      return 'retry_training';
    }

    if (phase === 'complete' || phase === '') {
      if (st === 'processing') {
        const lst = (row as { lastTrainingStartedAt?: Date }).lastTrainingStartedAt;
        const t0 =
          lst instanceof Date && !isNaN(lst.getTime())
            ? lst.getTime()
            : now;
        if (now - t0 < trainStuckCutoffMs()) {
          throw new HttpException(
            { error: 'Training is still running.', errorCode: 'not_stuck_yet' },
            HttpStatus.CONFLICT,
          );
        }
        const ok = await this.knowledgeTrainingJobService.manualResetStuckScopesTrainForBotScope(botId, 'table');
        if (!ok) {
          throw new HttpException({ error: 'Could not reset stuck training.', errorCode: 'not_stuck_yet' }, HttpStatus.CONFLICT);
        }
        return 'reset_stuck_training';
      }
    }

    throw new HttpException({ error: 'Retry is not available for this state.', errorCode: 'retry_not_allowed' }, HttpStatus.BAD_REQUEST);
  }
}
