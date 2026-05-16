import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { KnowledgeBaseItem, TrainJob } from '../models';
import { KnowledgeBaseChunkService } from './knowledge-base-chunk.service';
import { KnowledgeBaseItemService } from './knowledge-base-item.service';
import { PLAN_LIMIT_BOT_KB_TOTAL_CODE } from './bot-knowledge-total-limit.service';
import { knowledgeItemExcludeDeletedOnlyClause } from './knowledge-base-item-access.service';

function envDisabled(): boolean {
  const v = process.env.KNOWLEDGE_TRAIN_KB_DRIFT_RECONCILE_DISABLED;
  return v === 'true' || v === '1' || v === 'yes';
}

function reconcileBatchLimit(): number {
  const raw = process.env.KNOWLEDGE_TRAIN_KB_DRIFT_RECONCILE_BATCH ?? '25';
  return Math.max(1, Math.floor(Number(raw)) || 25);
}

/**
 * Heals rare drift: latest document {@link TrainJob} is `done` and embeddings exist, but the KB row stayed
 * `pending` / `queued` / `processing` (e.g. partial failure after chunk write). Requires the KB row's
 * `contentHash` / {@link KnowledgeBaseItem.lastContentUpdatedAt} to still align with the job snapshot so we
 * do not overwrite intentional `pending` after a manual edit (same-hash retrain waits, auto-train off, etc.).
 * Skips plan-limit, incomplete extraction, and any row whose newest train job is not `done`.
 */
@Injectable()
export class KnowledgeTrainKbDriftReconcileService {
  constructor(
    @InjectModel(KnowledgeBaseItem.name) private readonly itemModel: Model<KnowledgeBaseItem>,
    @InjectModel(TrainJob.name) private readonly trainJobModel: Model<TrainJob>,
    private readonly knowledgeBaseChunkService: KnowledgeBaseChunkService,
    private readonly knowledgeBaseItemService: KnowledgeBaseItemService,
  ) {}

  /** Returns number of KB rows updated to `ready`. */
  async reconcileDocumentTrainKbDrift(): Promise<number> {
    if (envDisabled()) return 0;
    const batchLimit = reconcileBatchLimit();

    const candidates = await this.itemModel
      .find({
        sourceType: 'document',
        status: { $in: ['pending', 'queued', 'processing'] as const },
        $and: [knowledgeItemExcludeDeletedOnlyClause()],
      })
      .sort({ updatedAt: 1 })
      .limit(batchLimit)
      .select('_id botId extractionStatus isContentExtracted trainingError contentHash lastContentUpdatedAt')
      .lean();

    if (candidates.length === 0) return 0;

    const kbIds = candidates.map((c) => c._id as Types.ObjectId);
    const kbIdStrs = new Set(kbIds.map((id) => id.toString()));

    const trainJobs = await this.trainJobModel
      .find({
        kind: 'document',
        knowledgeBaseItemId: { $in: kbIds },
      })
      .sort({ createdAt: -1 })
      .select(
        'knowledgeBaseItemId status finishedAt documentEmbedTargetContentHash documentEmbedTargetLastContentUpdatedAt',
      )
      .lean();

    type LatestTrainLean = {
      status: string;
      finishedAt?: Date;
      documentEmbedTargetContentHash?: string;
      documentEmbedTargetLastContentUpdatedAt?: Date;
    };

    const latestJobByKb = new Map<string, LatestTrainLean>();
    for (const j of trainJobs) {
      const kid = (j as { knowledgeBaseItemId?: Types.ObjectId }).knowledgeBaseItemId;
      if (!kid) continue;
      const ks = kid.toString();
      if (!kbIdStrs.has(ks) || latestJobByKb.has(ks)) continue;
      const row = j as {
        knowledgeBaseItemId?: Types.ObjectId;
        status?: string;
        finishedAt?: Date;
        documentEmbedTargetContentHash?: string;
        documentEmbedTargetLastContentUpdatedAt?: Date;
      };
      latestJobByKb.set(ks, {
        status: String(row.status ?? ''),
        finishedAt: row.finishedAt,
        documentEmbedTargetContentHash:
          typeof row.documentEmbedTargetContentHash === 'string' ? row.documentEmbedTargetContentHash : undefined,
        documentEmbedTargetLastContentUpdatedAt:
          row.documentEmbedTargetLastContentUpdatedAt instanceof Date
            ? row.documentEmbedTargetLastContentUpdatedAt
            : undefined,
      });
    }

    const embedByKb = await this.knowledgeBaseChunkService.countChunksWithValidEmbeddingsByKnowledgeItemIds(kbIds);

    let fixed = 0;
    for (const kb of candidates) {
      const routeId = String(kb._id);
      const botId = String(kb.botId);

      const planTe = String((kb as { trainingError?: string | null }).trainingError ?? '').trim();
      if (planTe === PLAN_LIMIT_BOT_KB_TOTAL_CODE) continue;

      const exRaw = String((kb as { extractionStatus?: string }).extractionStatus ?? '').trim();
      const extractionOk =
        exRaw === 'done' && (kb as { isContentExtracted?: boolean }).isContentExtracted === true;
      if (!extractionOk) continue;

      const latest = latestJobByKb.get(routeId);
      if (!latest || latest.status !== 'done') continue;
      if ((embedByKb.get(routeId) ?? 0) <= 0) continue;

      const kbHash = String((kb as { contentHash?: string }).contentHash ?? '').trim();
      const jobHash = String(latest.documentEmbedTargetContentHash ?? '').trim();
      if (kbHash && jobHash && kbHash !== jobHash) continue;

      const kbLcu = (kb as { lastContentUpdatedAt?: Date }).lastContentUpdatedAt;
      const jobLcu = latest.documentEmbedTargetLastContentUpdatedAt;
      if (kbLcu instanceof Date && jobLcu instanceof Date && kbLcu.getTime() > jobLcu.getTime()) continue;

      /** Older jobs omit embed snapshots — refuse `ready` if content moved after train finished. */
      if ((!jobHash || !(jobLcu instanceof Date)) && kbLcu instanceof Date && latest.finishedAt instanceof Date) {
        if (kbLcu.getTime() > latest.finishedAt.getTime()) continue;
      }

      const ok = await this.knowledgeBaseItemService.setDocumentKnowledgeItemStatus(botId, routeId, {
        status: 'ready',
      });
      if (ok) fixed += 1;
    }
    return fixed;
  }
}
