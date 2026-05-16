import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ExtractJob } from '../models/extract-job.schema';
import { KnowledgeBaseItem } from '../models/knowledge-base-item.schema';
import { knowledgeItemNotDeletedClause } from './knowledge-base-item-access.service';
import {
  logCronError,
  logCronFinish,
  logCronSkip,
  logCronStart,
} from '../worker/kb-cron-log.util';

/** KB types that never run file/text extraction; scope training expects `extractionStatus=not_required`. */
const NON_DOCUMENT_EXTRACTION_NORMALIZED_SOURCE_TYPES = ['faq', 'note', 'table', 'suggestion'] as const;
import { effectiveKbDocumentFileMetaLean } from './knowledge-base-document-sync-fields.util';
import {
  kbRowEligibleForQueuedContentExtraction,
  kbRowHasUploadedFileSource,
} from '../ingestion/content-extraction-eligibility.util';
import { isTrainableExtractedDocumentText } from './knowledge-text-metrics';

/**
 * Idempotent backfill for `KnowledgeBaseItem.extractionStatus` / `extractionError`.
 * FAQ/note/table/suggestion rows always get `extractionStatus=not_required` (clears stray `extractionError`);
 * bad legacy values (`failed`, document-only phases, missing field) are corrected so scope training is not
 * blocked forever. Documents use the cursor + ExtractJob reconciliation path below.
 * Safe on repeated app boot (no-ops when rows already match). Disable after production migration with
 * `KNOWLEDGE_EXTRACTION_STATUS_BACKFILL=false` (see `.env.example`).
 */
@Injectable()
export class KnowledgeExtractionStatusBackfillService implements OnApplicationBootstrap {
  private readonly log = new Logger(KnowledgeExtractionStatusBackfillService.name);

  constructor(
    @InjectModel(KnowledgeBaseItem.name) private readonly itemModel: Model<KnowledgeBaseItem>,
    @InjectModel(ExtractJob.name) private readonly extractJobModel: Model<ExtractJob>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (
      process.env.KNOWLEDGE_EXTRACTION_STATUS_BACKFILL === 'false' ||
      process.env.KNOWLEDGE_EXTRACTION_STATUS_BACKFILL === '0'
    ) {
      logCronSkip('extraction_status_backfill', 'KNOWLEDGE_EXTRACTION_STATUS_BACKFILL_disabled');
      return;
    }
    const t0 = performance.now();
    logCronStart('extraction_status_backfill');
    try {
      const r = await this.runBackfill();
      logCronFinish('extraction_status_backfill', {
        durationMs: Math.round(performance.now() - t0),
        nonDocumentsUpdated: r.nonDocumentsUpdated,
        documentsUpdated: r.documentsUpdated,
      });
    } catch (e) {
      this.log.warn(`backfill skipped or failed: ${e instanceof Error ? e.message : String(e)}`);
      logCronError('extraction_status_backfill', e);
      logCronFinish('extraction_status_backfill', {
        durationMs: Math.round(performance.now() - t0),
        fatal: true,
      });
    }
  }

  async runBackfill(): Promise<{ nonDocumentsUpdated: number; documentsUpdated: number }> {
    const nd = await this.itemModel.collection.updateMany(
      {
        sourceType: { $in: [...NON_DOCUMENT_EXTRACTION_NORMALIZED_SOURCE_TYPES] },
        $and: [
          knowledgeItemNotDeletedClause() as object,
          {
            $or: [
              { extractionStatus: { $exists: false } },
              { extractionStatus: null },
              { extractionStatus: { $ne: 'not_required' } },
              {
                $and: [{ extractionStatus: 'not_required' }, { extractionError: { $gt: '' } }],
              },
            ],
          },
        ],
      },
      {
        $set: { extractionStatus: 'not_required', updatedAt: new Date() },
        $unset: { extractionError: '' },
      },
    );

    const batchSize = 80;
    let docUpdated = 0;
    let cursor = this.itemModel
      .find({
        sourceType: 'document',
        $and: [knowledgeItemNotDeletedClause()],
      })
      .select('_id botId content isContentExtracted fileMeta file sourceMeta extractionStatus extractionError')
      .batchSize(batchSize)
      .cursor();

    const batch: Array<{
      _id: Types.ObjectId;
      botId?: Types.ObjectId;
      content?: string;
      isContentExtracted?: boolean;
      fileMeta?: Record<string, unknown>;
      file?: Record<string, unknown>;
      sourceMeta?: Record<string, unknown>;
      extractionStatus?: string;
      extractionError?: string;
    }> = [];

    const flush = async (rows: typeof batch): Promise<void> => {
      if (rows.length === 0) return;
      const ids = rows.map((r) => r._id);
      const latestJobs = (await this.extractJobModel
        .aggregate([
          { $match: { knowledgeBaseItemId: { $in: ids } } },
          { $sort: { createdAt: -1 as const } },
          {
            $group: {
              _id: '$knowledgeBaseItemId',
              status: { $first: '$status' },
              error: { $first: '$error' },
            },
          },
        ])
        .exec()) as Array<{ _id: Types.ObjectId; status?: string; error?: string }>;
      const jobByKb = new Map<string, { status?: string; error?: string }>();
      for (const j of latestJobs) {
        jobByKb.set(String(j._id), { status: j.status, error: j.error });
      }

      for (const row of rows) {
        const target = this.computeDocumentBackfillTarget(row, jobByKb.get(String(row._id)));
        const curEx = row.extractionStatus;
        const curErr = row.extractionError;
        const unchanged =
          curEx === target.extractionStatus &&
          (target.extractionError == null ? curErr == null || curErr === '' : String(curErr ?? '') === target.extractionError);
        if (unchanged) continue;

        const op: { $set: Record<string, unknown>; $unset?: Record<string, ''> } = {
          $set: { extractionStatus: target.extractionStatus, updatedAt: new Date() },
        };
        if (target.extractionError != null) {
          op.$set.extractionError = target.extractionError;
        } else {
          op.$unset = { extractionError: '' };
        }
        await this.itemModel.updateOne({ _id: row._id }, op);
        docUpdated += 1;
      }
    };

    for await (const raw of cursor) {
      batch.push(raw as (typeof batch)[0]);
      if (batch.length >= batchSize) {
        await flush(batch);
        batch.length = 0;
      }
    }
    await flush(batch);

    return { nonDocumentsUpdated: nd.modifiedCount ?? 0, documentsUpdated: docUpdated };
  }

  private computeDocumentBackfillTarget(
    row: {
      content?: string;
      isContentExtracted?: boolean;
      fileMeta?: Record<string, unknown>;
      file?: Record<string, unknown>;
      sourceMeta?: Record<string, unknown>;
    },
    latestJob: { status?: string; error?: string } | undefined,
  ): { extractionStatus: 'queued' | 'processing' | 'done' | 'failed' | 'waiting_for_source'; extractionError: string | null } {
    const body = (row.content ?? '').trim();
    if (row.isContentExtracted === true && body && isTrainableExtractedDocumentText(body)) {
      return { extractionStatus: 'done', extractionError: null };
    }
    const st = typeof latestJob?.status === 'string' ? latestJob.status.trim() : '';
    if (st === 'processing') {
      return { extractionStatus: 'processing', extractionError: null };
    }
    if (st === 'queued') {
      return { extractionStatus: 'queued', extractionError: null };
    }
    if (st === 'failed') {
      const err =
        typeof latestJob?.error === 'string' && latestJob.error.trim()
          ? latestJob.error.trim().slice(0, 2000)
          : 'extraction_failed';
      return { extractionStatus: 'failed', extractionError: err };
    }
    const effRow = effectiveKbDocumentFileMetaLean(row as unknown as Record<string, unknown>);
    if (
      !kbRowEligibleForQueuedContentExtraction({
        isContentExtracted: row.isContentExtracted,
        content: row.content,
        fileMeta: effRow as Record<string, unknown>,
      })
    ) {
      if (!kbRowHasUploadedFileSource({ fileMeta: effRow as Record<string, unknown> }) && body.length === 0) {
        return { extractionStatus: 'waiting_for_source', extractionError: null };
      }
    }
    if (!kbRowHasUploadedFileSource({ fileMeta: effRow as Record<string, unknown> }) && body.length === 0) {
      return { extractionStatus: 'waiting_for_source', extractionError: null };
    }
    return { extractionStatus: 'queued', extractionError: null };
  }
}
