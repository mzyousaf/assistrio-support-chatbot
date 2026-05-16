import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { KnowledgeBaseItem } from '../models/knowledge-base-item.schema';
import { KnowledgeBaseChunk } from '../models/knowledge-base-chunk.schema';
import { ExtractJob } from '../models/extract-job.schema';
import { TrainJob } from '../models/train-job.schema';
import { TableImportJob } from '../models/table-import-job.schema';
import { TableImportSession } from '../models/table-import-session.schema';
import { KnowledgeStatsService } from './knowledge-stats.service';
import { deletePrivateObject } from '../lib/s3';
import { collectKbPurgeS3Refs, type KbPurgeS3Ref } from './knowledge-item-purge-s3.util';

function purgeAfterMinutes(): number {
  const n = Math.floor(Number(process.env.KNOWLEDGE_ITEM_PURGE_AFTER_MINUTES) || 30);
  return Number.isFinite(n) && n >= 1 ? n : 30;
}

function purgeBatchLimit(): number {
  const n = Math.floor(Number(process.env.KNOWLEDGE_ITEM_PURGE_BATCH_LIMIT) || 100);
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 500) : 100;
}

type KbItemLean = {
  _id: Types.ObjectId;
  botId: Types.ObjectId;
  sourceType: string;
  fileMeta?: Record<string, unknown>;
};

/** Per-item hard purge counts (no file contents or URLs). */
export type KbItemHardPurgeStats = {
  chunksDeleted: number;
  extractJobsDeleted: number;
  trainDocumentJobsDeleted: number;
  tableImportJobsDeleted: number;
  tableSessionsDeleted: number;
  s3DeleteAttempted: number;
  s3DeleteFailed: number;
};

export function emptyKbItemHardPurgeStats(): KbItemHardPurgeStats {
  return {
    chunksDeleted: 0,
    extractJobsDeleted: 0,
    trainDocumentJobsDeleted: 0,
    tableImportJobsDeleted: 0,
    tableSessionsDeleted: 0,
    s3DeleteAttempted: 0,
    s3DeleteFailed: 0,
  };
}

export function mergeKbItemHardPurgeStats(into: KbItemHardPurgeStats, part: KbItemHardPurgeStats): void {
  into.chunksDeleted += part.chunksDeleted;
  into.extractJobsDeleted += part.extractJobsDeleted;
  into.trainDocumentJobsDeleted += part.trainDocumentJobsDeleted;
  into.tableImportJobsDeleted += part.tableImportJobsDeleted;
  into.tableSessionsDeleted += part.tableSessionsDeleted;
  into.s3DeleteAttempted += part.s3DeleteAttempted;
  into.s3DeleteFailed += part.s3DeleteFailed;
}

export type KnowledgeItemPurgeRunResult = {
  purged: number;
  botsToRefresh: string[];
  eligibleCount: number;
  purgeErrors: number;
} & KbItemHardPurgeStats;

/**
 * Hard-deletes KB items that were soft-deleted ({@link KnowledgeBaseItem.deletedAt}) after a grace period.
 */
@Injectable()
export class KnowledgeItemPurgeService {
  private readonly log = new Logger(KnowledgeItemPurgeService.name);

  constructor(
    @InjectModel(KnowledgeBaseItem.name) private readonly itemModel: Model<KnowledgeBaseItem>,
    @InjectModel(KnowledgeBaseChunk.name) private readonly chunkModel: Model<KnowledgeBaseChunk>,
    @InjectModel(ExtractJob.name) private readonly extractJobModel: Model<ExtractJob>,
    @InjectModel(TrainJob.name) private readonly trainJobModel: Model<TrainJob>,
    @InjectModel(TableImportJob.name) private readonly tableImportJobModel: Model<TableImportJob>,
    @InjectModel(TableImportSession.name) private readonly tableImportSessionModel: Model<TableImportSession>,
    private readonly knowledgeStatsService: KnowledgeStatsService,
  ) {}

  /**
   * Purge up to {@link purgeBatchLimit} soft-deleted items whose {@link KnowledgeBaseItem.deletedAt}
   * is older than {@link purgeAfterMinutes}. Idempotent per item.
   */
  async purgeDueItems(): Promise<KnowledgeItemPurgeRunResult> {
    const graceMs = purgeAfterMinutes() * 60_000;
    const cutoff = new Date(Date.now() - graceMs);
    const lim = purgeBatchLimit();
    const rows = (await this.itemModel
      .find({
        active: false,
        deletedAt: { $lte: cutoff },
      })
      .select('_id botId sourceType fileMeta')
      .limit(lim)
      .lean()) as KbItemLean[];

    const bots = new Set<string>();
    let purged = 0;
    let purgeErrors = 0;
    const totals = emptyKbItemHardPurgeStats();
    for (const row of rows) {
      try {
        const one = await this.hardPurgeOne(row);
        mergeKbItemHardPurgeStats(totals, one);
        purged += 1;
        bots.add(String(row.botId));
      } catch (e) {
        purgeErrors += 1;
        const msg = e instanceof Error ? e.message : String(e);
        this.log.warn(`purge kb item ${String(row._id)} failed: ${msg}`);
      }
    }
    for (const botId of bots) {
      try {
        await this.knowledgeStatsService.recalculateKnowledgeStatsForBot(botId);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.log.warn(`recalculate stats bot ${botId} after purge: ${msg}`);
      }
    }
    return {
      purged,
      botsToRefresh: [...bots],
      eligibleCount: rows.length,
      purgeErrors,
      ...totals,
    };
  }

  async hardPurgeKnowledgeItemRow(row: KbItemLean): Promise<KbItemHardPurgeStats> {
    return this.hardPurgeOne(row);
  }

  private async hardPurgeOne(row: KbItemLean): Promise<KbItemHardPurgeStats> {
    const acc = emptyKbItemHardPurgeStats();
    const id = row._id;
    const botOid = row.botId;
    const chunkRes = await this.chunkModel.deleteMany({ knowledgeBaseItemId: id });
    acc.chunksDeleted = chunkRes.deletedCount ?? 0;

    const tableJobs = (await this.tableImportJobModel
      .find({ botId: botOid, knowledgeBaseItemId: id })
      .select('_id importSessionId s3Bucket s3Key')
      .lean()) as Array<{
      _id: Types.ObjectId;
      importSessionId?: Types.ObjectId;
      s3Bucket?: string;
      s3Key?: string;
    }>;

    const jobSessionIds = tableJobs
      .map((j) => j.importSessionId)
      .filter((x): x is Types.ObjectId => Boolean(x));
    const sessionFilter: Record<string, unknown> = {
      botId: botOid,
      $or: [{ resultKnowledgeBaseItemId: id }, ...(jobSessionIds.length ? [{ _id: { $in: jobSessionIds } }] : [])],
    };
    const tableSessions = (await this.tableImportSessionModel
      .find(sessionFilter)
      .select('_id s3Bucket s3Key')
      .lean()) as Array<{ _id: Types.ObjectId; s3Bucket?: string; s3Key?: string }>;

    const refs = collectKbPurgeS3Refs({
      itemLean: row as unknown as Record<string, unknown> & { _id: Types.ObjectId; sourceType?: string },
      tableImportJobs: tableJobs,
      tableImportSessions: tableSessions,
    });
    const s3 = await this.bestEffortDeletePurgeS3Refs(row.sourceType, id, refs);
    acc.s3DeleteAttempted += s3.attempted;
    acc.s3DeleteFailed += s3.failed;

    const [exRes, trRes, tjRes, tsRes] = await Promise.all([
      this.extractJobModel.deleteMany({ botId: botOid, knowledgeBaseItemId: id }),
      this.trainJobModel.deleteMany({
        botId: botOid,
        kind: 'document',
        knowledgeBaseItemId: id,
      }),
      this.tableImportJobModel.deleteMany({ botId: botOid, knowledgeBaseItemId: id }),
      this.tableImportSessionModel.deleteMany({
        botId: botOid,
        $or: [
          { resultKnowledgeBaseItemId: id },
          ...(jobSessionIds.length ? [{ _id: { $in: jobSessionIds } }] : []),
        ],
      }),
    ]);
    acc.extractJobsDeleted = exRes.deletedCount ?? 0;
    acc.trainDocumentJobsDeleted = trRes.deletedCount ?? 0;
    acc.tableImportJobsDeleted = tjRes.deletedCount ?? 0;
    acc.tableSessionsDeleted = tsRes.deletedCount ?? 0;
    await this.itemModel.deleteOne({ _id: id, botId: botOid });
    return acc;
  }

  private async bestEffortDeletePurgeS3Refs(
    sourceType: string,
    itemId: Types.ObjectId,
    refs: KbPurgeS3Ref[],
  ): Promise<{ attempted: number; failed: number }> {
    let attempted = 0;
    let failed = 0;
    for (const ref of refs) {
      attempted += 1;
      try {
        await deletePrivateObject(ref.bucket, ref.key);
      } catch (e) {
        failed += 1;
        const msg = e instanceof Error ? e.message : String(e);
        this.log.warn(
          `S3 purge delete failed sourceType=${sourceType} itemId=${String(itemId)} provenance=${ref.provenance} bucket=${ref.bucket}: ${msg}`,
        );
      }
    }
    return { attempted, failed };
  }
}
