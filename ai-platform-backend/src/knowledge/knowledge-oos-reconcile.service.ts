import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Bot, KnowledgeBaseItem } from '../models';
import type { KnowledgeTrainingScope } from '../models/train-job.schema';
import { getKnowledgeTrainingSettings } from './bot-knowledge-training-settings.util';
import { PLAN_LIMIT_BOT_KB_TOTAL_CODE } from './bot-knowledge-total-limit.service';
import { KnowledgeStatsService } from './knowledge-stats.service';
import { KnowledgeTrainingJobService } from './knowledge-training-job.service';
import { KnowledgeBaseItemService } from './knowledge-base-item.service';
import {
  calculateKnowledgeItemUsageBytes,
  knowledgeBaseItemEligibleForKbUsageAggregation,
  knowledgeBaseItemEligibleForTrainableKbAggregation,
  knowledgeBaseItemIsOutOfStoragePlanLimit,
  KNOWLEDGE_USAGE_LEAN_FIELDS,
  knowledgeItemNotDeletedClause,
  type KnowledgeBaseItemUsageLean,
} from './knowledge-usage.util';
import { mergeTrainingScopes } from './merge-training-scopes.util';
import { BotKnowledgeSizeResolverService } from '../entitlements/bot-knowledge-size-resolver.service';

function trainingScopeForKbSourceType(st: string): KnowledgeTrainingScope | null {
  if (st === 'faq' || st === 'note' || st === 'table' || st === 'suggestion') return st;
  return null;
}

/** Oldest-first for OOS release: `createdAt` then ObjectId time for lean rows missing timestamps. */
export function oosReconcileCreatedAtAsc(
  a: { createdAt?: Date; _id: Types.ObjectId },
  b: { createdAt?: Date; _id: Types.ObjectId },
): number {
  const ta =
    a.createdAt instanceof Date && !isNaN(a.createdAt.getTime())
      ? a.createdAt.getTime()
      : a._id.getTimestamp().getTime();
  const tb =
    b.createdAt instanceof Date && !isNaN(b.createdAt.getTime())
      ? b.createdAt.getTime()
      : b._id.getTimestamp().getTime();
  if (ta !== tb) return ta - tb;
  return String(a._id).localeCompare(String(b._id));
}

@Injectable()
export class KnowledgeOosReconcileService {
  private readonly logger = new Logger(KnowledgeOosReconcileService.name);

  constructor(
    @InjectModel(KnowledgeBaseItem.name) private readonly itemModel: Model<KnowledgeBaseItem>,
    @InjectModel(Bot.name) private readonly botModel: Model<Bot>,
    private readonly moduleRef: ModuleRef,
    private readonly knowledgeTrainingJobService: KnowledgeTrainingJobService,
    private readonly knowledgeStatsService: KnowledgeStatsService,
    @Inject(forwardRef(() => KnowledgeBaseItemService))
    private readonly knowledgeBaseItemService: KnowledgeBaseItemService,
    private readonly knowledgeSizeResolver: BotKnowledgeSizeResolverService,
  ) {}

  /**
   * After deletes, shrinking updates, or quota increases: release `out_of_storage` items in **createdAt ascending**
   * (oldest first) when `trainableBytes + itemBytes <= maxBytes`. Skipped items do not block later candidates.
   */
  async reconcileOutOfStorageItemsForBot(botId: string, reason: string): Promise<{ releasedCount: number }> {
    if (!Types.ObjectId.isValid(botId)) return { releasedCount: 0 };
    const botLean = await this.botModel
      .findById(new Types.ObjectId(botId))
      .select('workspaceId botConfig knowledgeTraining')
      .lean();
    const { maxBytes } = await this.knowledgeSizeResolver.resolveForBotLean(
      botLean as Parameters<BotKnowledgeSizeResolverService['resolveForBotLean']>[0],
    );
    if (!Number.isFinite(maxBytes) || maxBytes <= 0) return { releasedCount: 0 };

    const settings = getKnowledgeTrainingSettings(botLean as Parameters<typeof getKnowledgeTrainingSettings>[0]);
    const rows = (await this.itemModel
      .find({
        botId: new Types.ObjectId(botId),
        $and: [knowledgeItemNotDeletedClause()],
      } as never)
      .select(`${String(KNOWLEDGE_USAGE_LEAN_FIELDS)} _id createdAt lastTrainedAt`)
      .lean()) as (KnowledgeBaseItemUsageLean & { _id: Types.ObjectId; createdAt?: Date })[];

    let trainableBytes = 0;
    for (const row of rows) {
      if (!knowledgeBaseItemEligibleForTrainableKbAggregation(row)) continue;
      trainableBytes += calculateKnowledgeItemUsageBytes(row);
    }

    const candidates: {
      row: KnowledgeBaseItemUsageLean & { _id: Types.ObjectId; createdAt?: Date };
      bytes: number;
    }[] = [];
    for (const row of rows) {
      if (!knowledgeBaseItemEligibleForKbUsageAggregation(row)) continue;
      if (!knowledgeBaseItemIsOutOfStoragePlanLimit(row)) continue;
      const bytes = calculateKnowledgeItemUsageBytes(row);
      if (bytes <= 0) continue;
      candidates.push({ row, bytes });
    }
    candidates.sort((x, y) => oosReconcileCreatedAtAsc(x.row, y.row));

    const releasedDocIds: string[] = [];
    const releasedScopes = new Set<KnowledgeTrainingScope>();
    let releasedCount = 0;

    for (const { row, bytes } of candidates) {
      if (trainableBytes + bytes > maxBytes) continue;

      const id = row._id;
      const st = String(row.sourceType ?? '');
      const now = new Date();
      const $unset: Record<string, 1> = {};
      if (String(row.trainingError ?? '').trim() === PLAN_LIMIT_BOT_KB_TOTAL_CODE) {
        $unset.trainingError = 1;
      }
      if (String((row as { extractionError?: string }).extractionError ?? '').trim() === PLAN_LIMIT_BOT_KB_TOTAL_CODE) {
        $unset.extractionError = 1;
      }
      const tm = row.tableMeta;
      if (tm && typeof tm === 'object') {
        if (String(tm.importErrorCode ?? '').trim() === PLAN_LIMIT_BOT_KB_TOTAL_CODE) {
          $unset['tableMeta.importErrorCode'] = 1;
        }
        if (String(tm.importError ?? '').trim() === PLAN_LIMIT_BOT_KB_TOTAL_CODE) {
          $unset['tableMeta.importError'] = 1;
        }
      }

      const baseSet: Record<string, unknown> = { updatedAt: now };
      if (settings.autoTrainEnabled) {
        const times = await this.knowledgeBaseItemService.getQueueTimesForTrainableKbRow(
          botId,
          row as Record<string, unknown> & { _id: Types.ObjectId },
          now,
          settings,
        );
        baseSet.status = 'queued';
        baseSet.lastQueuedAt = times.lastQueuedAt;
        baseSet.runAfter = times.runAfter;
      } else {
        baseSet.status = 'pending';
      }

      const patch: { $set: Record<string, unknown>; $unset?: Record<string, 1> } = { $set: baseSet };
      if (Object.keys($unset).length > 0) patch.$unset = $unset;
      if (!settings.autoTrainEnabled) {
        patch.$unset = {
          ...(patch.$unset ?? {}),
          lastQueuedAt: 1,
          runAfter: 1,
        };
      }
      await this.itemModel.updateOne(
        { _id: id, botId: new Types.ObjectId(botId), $and: [knowledgeItemNotDeletedClause()] } as never,
        patch as never,
      );

      trainableBytes += bytes;
      releasedCount += 1;
      if (st === 'document') {
        releasedDocIds.push(String(id));
      } else {
        const sc = trainingScopeForKbSourceType(st);
        if (sc) releasedScopes.add(sc);
      }
    }

    if (releasedCount === 0) {
      return { releasedCount: 0 };
    }

    if (settings.autoTrainEnabled) {
      const { IngestionService } = await import('../ingestion/ingestion.service');
      const ingestion = this.moduleRef.get(IngestionService, { strict: false });
      for (const docId of releasedDocIds) {
        await ingestion.ensureQueuedIngestJobForDocument(botId, docId);
      }
      const scopes = mergeTrainingScopes([...releasedScopes]);
      if (scopes.length > 0) {
        await this.knowledgeTrainingJobService.scheduleTrainingForScopes(botId, scopes, {
          bypassAutoTrainGate: true,
        });
      }
    }

    await this.knowledgeStatsService.recalculateKnowledgeStatsForBot(botId);
    this.logger.log(`oos reconcile botId=${botId} reason=${reason} released=${releasedCount}`);
    return { releasedCount };
  }
}
