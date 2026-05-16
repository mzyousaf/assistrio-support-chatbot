import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  KnowledgeBaseItem,
  type KnowledgeBaseItemSuggestionMeta,
  type KnowledgeBaseItemTrainingStatus,
} from '../models/knowledge-base-item.schema';

/**
 * Query + status updates for KB items without depending on {@link KnowledgeTrainingJobService}.
 * Used by {@link KnowledgeBaseChunkService} to avoid a Nest DI cycle:
 * ChunkService → ItemService → TrainingJobService → ChunkService.
 */
/** Rows that are not soft-deleted (`deletedAt` unset or null). */
export function knowledgeItemExcludeDeletedOnlyClause(): Record<string, unknown> {
  return {
    $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
  };
}

/**
 * Mongo match for reply/RAG / “live for stats” KB rows: `active !== false` and not soft-deleted.
 * Training lifecycle queries should use {@link knowledgeItemExcludeDeletedOnlyClause} so `active:false`
 * items still train while staying excluded from retrieval.
 */
export function knowledgeItemNotDeletedClause(): Record<string, unknown> {
  return knowledgeItemReplyEligibleClause();
}

/** Alias: rows eligible for replies and runtime RAG (`active !== false`, not soft-deleted). */
export function knowledgeItemReplyEligibleClause(): Record<string, unknown> {
  return {
    $and: [{ active: { $ne: false } }, knowledgeItemExcludeDeletedOnlyClause()],
  };
}

/** True when the row is user-soft-deleted (`deletedAt`). Reply exclusion uses `active: false` alone — not this. */
export function knowledgeBaseItemIsEffectivelyDeleted(row: {
  deletedAt?: Date | null;
}): boolean {
  const d = row.deletedAt;
  return d instanceof Date && !isNaN(d.getTime());
}

/** FAQ / note / table / suggestion scope-training: only rows that do not wait on extraction. */
export function scopeTrainingExtractionEligibleClause(): Record<string, unknown> {
  return {
    $or: [{ extractionStatus: 'not_required' }, { extractionStatus: { $exists: false } }],
  };
}

const SCOPE_TRAINING_EXTRACTION_SOURCE_TYPES = new Set<
  'faq' | 'note' | 'table' | 'suggestion'
>(['faq', 'note', 'table', 'suggestion']);

@Injectable()
export class KnowledgeBaseItemAccessService {
  constructor(@InjectModel(KnowledgeBaseItem.name) private readonly itemModel: Model<KnowledgeBaseItem>) {}

  /**
   * Stuck ExtractJob / document TrainJob recovery: distinguishes missing routes vs soft-deleted (`inactive`).
   * `KnowledgeBaseItem.active === false` does **not** skip recovery — inactive rows still train.
   */
  async getDocumentKbRouteStuckRecoverState(
    botId: string,
    routeId: string,
  ): Promise<'missing' | 'inactive' | 'active'> {
    if (!Types.ObjectId.isValid(botId) || !Types.ObjectId.isValid(routeId)) return 'missing';
    const row = await this.itemModel
      .findOne({
        botId: new Types.ObjectId(botId),
        _id: new Types.ObjectId(routeId),
        sourceType: 'document',
      })
      .select('deletedAt')
      .lean();
    if (!row) return 'missing';
    if (knowledgeBaseItemIsEffectivelyDeleted(row as { deletedAt?: Date | null })) {
      return 'inactive';
    }
    return 'active';
  }

  async findKnowledgeItemsForBot(
    botId: string,
    options?: {
      sourceType?: 'document' | 'faq' | 'note' | 'url' | 'html' | 'table' | 'suggestion';
      activeOnly?: boolean;
      statuses?: KnowledgeBaseItemTrainingStatus[];
      /**
       * When true with `sourceType` in faq/note/table/suggestion, restrict to rows eligible for scope embedding
       * (`extractionStatus === not_required` or legacy missing field).
       */
      scopeTrainingExtractionOnly?: boolean;
      /**
       * When true with `sourceType === 'table'`, only rows whose async import finished (`importPhase` absent or `complete`)
       * are returned — avoids embedding while CSV/XLSX import is still running.
       */
      tableGridReadyForScopeEmbedding?: boolean;
    },
  ) {
    const andClauses: Record<string, unknown>[] =
      options?.activeOnly === false
        ? [knowledgeItemExcludeDeletedOnlyClause()]
        : [{ active: { $ne: false } }, knowledgeItemExcludeDeletedOnlyClause()];
    if (
      options?.scopeTrainingExtractionOnly === true &&
      options.sourceType &&
      SCOPE_TRAINING_EXTRACTION_SOURCE_TYPES.has(
        options.sourceType as 'faq' | 'note' | 'table' | 'suggestion',
      )
    ) {
      andClauses.push(scopeTrainingExtractionEligibleClause());
    }
    if (options?.tableGridReadyForScopeEmbedding === true && options.sourceType === 'table') {
      andClauses.push({
        $or: [
          { 'tableMeta.importPhase': { $exists: false } },
          { 'tableMeta.importPhase': null },
          { 'tableMeta.importPhase': 'complete' },
        ],
      });
    }
    const filter: Record<string, unknown> = {
      botId: new Types.ObjectId(botId),
      $and: andClauses,
    };
    if (options?.sourceType) filter.sourceType = options.sourceType;
    if (options?.statuses && options.statuses.length > 0) {
      filter.status = { $in: options.statuses };
    }
    return this.itemModel.find(filter).sort({ createdAt: -1 }).lean();
  }

  /**
   * Update training lifecycle status for a single KB item (e.g. after chunk embed / failure).
   */
  async setKnowledgeItemStatusById(
    itemId: Types.ObjectId,
    status: KnowledgeBaseItemTrainingStatus,
    options?: { errorMessage?: string },
  ): Promise<void> {
    const now = new Date();
    const $set: Record<string, unknown> = { status, updatedAt: now };
    if (status === 'ready') {
      $set.lastTrainedAt = now;
      await this.itemModel.updateOne(
        { _id: itemId },
        { $set, $unset: { trainingError: 1 } },
      );
      return;
    }
    if (status === 'failed') {
      const msg = (options?.errorMessage ?? 'failed').trim() || 'failed';
      $set.trainingError = msg;
      await this.itemModel.updateOne({ _id: itemId }, { $set });
      return;
    }
    if (status === 'processing') {
      $set.lastTrainingStartedAt = now;
    }
    await this.itemModel.updateOne({ _id: itemId }, { $set });
  }

  /**
   * Customer-facing toggle: update KB item eligibility for runtime/RAG replies.
   *
   * This is intentionally limited to the canonical `active` boolean and `updatedAt` only —
   * it must not touch content hashes, extraction status, or training lifecycle.
   */
  async setKnowledgeItemActiveById(botId: string, itemId: Types.ObjectId, active: boolean): Promise<boolean> {
    if (!Types.ObjectId.isValid(botId)) return false;
    const now = new Date();
    const botOid = new Types.ObjectId(botId);

    const res = await this.itemModel.updateOne(
      {
        botId: botOid,
        _id: itemId,
        $and: [knowledgeItemExcludeDeletedOnlyClause()],
      },
      { $set: { active, updatedAt: now } },
    );

    return (res.matchedCount ?? 0) > 0;
  }

  /**
   * Document-linked KB row fields for ingestion stale-write checks (aligned with chunk replace).
   */
  async findDocumentLinkedKbStaleFields(
    botId: string,
    routeDocumentId: string,
  ): Promise<{
    _id: Types.ObjectId;
    contentHash?: string;
    lastContentUpdatedAt?: Date;
    active?: boolean;
    status?: string;
  } | null> {
    const row = await this.findKbDocumentItemByRouteId(botId, routeDocumentId);
    if (!row) return null;
    return {
      _id: row._id,
      contentHash: row.contentHash,
      lastContentUpdatedAt: row.lastContentUpdatedAt,
      active: row.active,
      status: row.status,
    };
  }

  /**
   * Document KB row for extraction bookkeeping: includes **inactive** rows so the worker can
   * finish/cancel `ExtractJob`s instead of leaving them perpetually `queued`.
   */
  async findKbDocumentItemByRouteIdAnyVisibility(
    botId: string,
    routeId: string,
  ): Promise<{ _id: Types.ObjectId; active?: boolean } | null> {
    if (!Types.ObjectId.isValid(botId) || !Types.ObjectId.isValid(routeId)) return null;
    const botOid = new Types.ObjectId(botId);
    const rid = new Types.ObjectId(routeId);
    const row = await this.itemModel
      .findOne({
        botId: botOid,
        sourceType: 'document',
        _id: rid,
      })
      .select('_id active deletedAt')
      .lean();
    return row as { _id: Types.ObjectId; active?: boolean } | null;
  }

  /**
   * Resolve a document KB row by canonical `KnowledgeBaseItem._id` (`routeId`).
   */
  async findKbDocumentItemByRouteId(
    botId: string,
    routeId: string,
  ): Promise<{
    _id: Types.ObjectId;
    botId: Types.ObjectId;
    title?: string;
    content?: string;
    status?: string;
    active?: boolean;
    contentHash?: string;
    lastContentUpdatedAt?: Date;
    updatedAt?: Date;
    sourceType?: string;
    fileMeta?: Record<string, unknown>;
    isContentExtracted?: boolean;
    extractionStatus?: string;
    extractionError?: string | null;
    lastExtractedAt?: Date;
    lastQueuedAt?: Date;
    runAfter?: Date;
  } | null> {
    if (!Types.ObjectId.isValid(botId) || !Types.ObjectId.isValid(routeId)) return null;
    const botOid = new Types.ObjectId(botId);
    const rid = new Types.ObjectId(routeId);
    const row = await this.itemModel
      .findOne({
        botId: botOid,
        sourceType: 'document',
        _id: rid,
        $and: [knowledgeItemExcludeDeletedOnlyClause()],
      })
      .select(
        '_id botId title content status active contentHash lastContentUpdatedAt updatedAt fileMeta file sourceMeta sourceType characterCount isContentExtracted extractionStatus extractionError lastExtractedAt lastQueuedAt runAfter',
      )
      .lean();
    return row as {
      _id: Types.ObjectId;
      botId: Types.ObjectId;
      title?: string;
      content?: string;
      status?: string;
      active?: boolean;
      contentHash?: string;
      lastContentUpdatedAt?: Date;
      updatedAt?: Date;
      sourceType?: string;
      fileMeta?: Record<string, unknown>;
      isContentExtracted?: boolean;
      extractionStatus?: string;
      extractionError?: string | null;
      lastExtractedAt?: Date;
      lastQueuedAt?: Date;
      runAfter?: Date;
    } | null;
  }

  /** Find the document-linked KnowledgeBaseItem for chunk sync (`routeId` = KB item id). */
  async findKnowledgeItemByDocumentId(botId: string, documentId: string): Promise<{ _id: Types.ObjectId } | null> {
    const row = await this.findKbDocumentItemByRouteId(botId, documentId);
    return row ? { _id: row._id } : null;
  }

  /**
   * Document-linked KB rows for a set of document ids (batch enrichment for effective status).
   */
  async findDocumentKbItemsByDocumentIds(
    botId: string,
    documentIds: Types.ObjectId[],
  ): Promise<
    Map<
      string,
      {
        _id: Types.ObjectId;
        status?: string;
        lastQueuedAt?: Date;
        runAfter?: Date;
        lastTrainingStartedAt?: Date;
        lastTrainedAt?: Date;
        trainingError?: string;
        isContentExtracted?: boolean;
        lastExtractedAt?: Date;
        extractionStatus?: string;
        extractionError?: string;
        extractedAt?: Date;
      }
    >
  > {
    if (!Types.ObjectId.isValid(botId) || documentIds.length === 0) {
      return new Map();
    }
    const botOid = new Types.ObjectId(botId);
    const rows = await this.itemModel
      .find({
        botId: botOid,
        sourceType: 'document',
        $and: [{ _id: { $in: documentIds } }, knowledgeItemExcludeDeletedOnlyClause()],
      })
      .select(
        '_id status lastQueuedAt runAfter lastTrainingStartedAt lastTrainedAt trainingError isContentExtracted lastExtractedAt extractedAt extractionStatus extractionError fileMeta.uploadStatus file.uploadStatus',
      )
      .lean();
    type Row = {
      _id: Types.ObjectId;
      status?: string;
      lastQueuedAt?: Date;
      runAfter?: Date;
      lastTrainingStartedAt?: Date;
      lastTrainedAt?: Date;
      trainingError?: string;
      isContentExtracted?: boolean;
      lastExtractedAt?: Date;
      extractedAt?: Date;
      extractionStatus?: string;
      extractionError?: string;
    };
    const m = new Map<string, Row>();
    for (const r of rows) {
      const row = r as Row;
      m.set(row._id.toString(), row);
    }
    return m;
  }

  /**
   * Fresh read for stale-write checks before embedding / marking ready.
   */
  async findKnowledgeItemByIdLean(itemId: Types.ObjectId): Promise<{
    _id: Types.ObjectId;
    active?: boolean;
    status?: string;
    contentHash?: string;
    lastContentUpdatedAt?: Date;
    content?: string;
    title?: string;
    suggestionMeta?: { chipText?: string; scopedInformation?: string };
  } | null> {
    const row = await this.itemModel
      .findById(itemId)
      .select(
        'active status contentHash lastContentUpdatedAt content title suggestionMeta noteMeta faqMeta tableMeta',
      )
      .lean();
    return row as {
      _id: Types.ObjectId;
      active?: boolean;
      status?: string;
      contentHash?: string;
      lastContentUpdatedAt?: Date;
      content?: string;
      title?: string;
      suggestionMeta?: KnowledgeBaseItemSuggestionMeta;
      noteMeta?: Record<string, unknown>;
      faqMeta?: Record<string, unknown>;
      tableMeta?: Record<string, unknown>;
    } | null;
  }

  /**
   * If an item is still `processing` but a newer version was saved, move it back to `queued` for the next job.
   */
  async requeueStaleProcessingItemNow(itemId: Types.ObjectId): Promise<boolean> {
    const now = new Date();
    const r = await this.itemModel.updateOne(
      { _id: itemId, status: 'processing', $and: [knowledgeItemExcludeDeletedOnlyClause()] },
      {
        $set: {
          status: 'queued',
          lastQueuedAt: now,
          runAfter: now,
          updatedAt: now,
        },
      },
    );
    return (r.modifiedCount ?? 0) > 0;
  }
}
