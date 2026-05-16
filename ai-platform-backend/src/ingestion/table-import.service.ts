import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { Readable } from 'stream';
import { getObjectBody, getObjectStream, deletePrivateObject, headObjectExists } from '../lib/s3';
import { TableImportJob } from '../models/table-import-job.schema';
import { TableImportSession } from '../models/table-import-session.schema';
import { Bot } from '../models/bot.schema';
import { KnowledgeBaseItemService } from '../knowledge/knowledge-base-item.service';
import { knowledgeBaseItemIsEffectivelyDeleted } from '../knowledge/knowledge-base-item-access.service';
import { KnowledgeTrainingJobService } from '../knowledge/knowledge-training-job.service';
import {
  applyDatasheetColumnDrops,
  isDatasheetCsvFileName,
  parseDatasheetFileBuffer,
  TableDatasheetValidationError,
  validateDatasheetGridOrThrow,
} from '../workspace/datasheet-import.util';
import { streamImportCsvDatasheet } from '../workspace/datasheet-csv-stream.util';
import {
  KNOWLEDGE_ITEM_TITLE_MAX_UTF8_BYTES,
  KNOWLEDGE_TABLES_MAX,
  TABLE_IMPORT_CSV_BATCH_ROWS_DEFAULT,
  clampStrUtf8Bytes,
  tableImportCsvMaxSourceBytesFromEnv,
  tableImportXlsxMaxBytesFromEnv,
} from '../workspace/shared/bot-field-limits';
import { tableImportDisplayStateFromKb } from '../knowledge/table-import-display-state.util';
import { botIsEffectivelyDeleted } from '../bots/bot-not-deleted.util';
import {
  isPlanLimitBotKbTotalHttpException,
  planLimitPayloadFromHttpException,
} from '../knowledge/bot-knowledge-total-limit.service';
import {
  TABLE_IMPORT_MAX_STUCK_RECOVERIES,
  TABLE_IMPORT_STUCK_TIMEOUT_MINUTES,
} from '../knowledge/knowledge-pipeline-retry.constants';
import { mongoTableImportProcessingJobStaleCriteria } from '../knowledge/pipeline-stuck-processing-query.util';

function tableImportSessionCleanupGraceMs(): number {
  const raw = process.env.TABLE_IMPORT_SESSION_CLEANUP_GRACE_MS;
  if (raw === undefined || String(raw).trim() === '') return 3_600_000;
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) && n >= 60_000 ? n : 3_600_000;
}

function tableImportStuckCutoff(): Date {
  const mins = Math.max(1, TABLE_IMPORT_STUCK_TIMEOUT_MINUTES);
  return new Date(Date.now() - mins * 60 * 1000);
}

function tableImportMaxLiveJobsPerBot(): number {
  const raw = process.env.TABLE_IMPORT_MAX_LIVE_JOBS_PER_BOT;
  if (raw === undefined || raw.trim() === '') return 3;
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) && n >= 1 ? n : 3;
}

function tableImportMaxStartsPerBotPerDay(): number {
  const raw = process.env.TABLE_IMPORT_MAX_STARTS_PER_BOT_PER_DAY;
  if (raw === undefined || raw.trim() === '') return 0;
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export type TableImportConfirmResult = {
  ok: true;
  botId: string;
  knowledgeBaseItemId: string;
  importJobId: string;
  sheetIndex: number;
  tableImportDisplayState: ReturnType<typeof tableImportDisplayStateFromKb>;
  idempotent?: boolean;
};

export type TableImportManualRetryResult =
  | { ok: true }
  | {
      ok: false;
      errorCode:
        | 'source_file_missing'
        | 'job_not_found'
        | 'already_queued'
        | 'kb_invalid'
        | 'import_session_expired';
    };

@Injectable()
export class TableImportService {
  private readonly log = new Logger(TableImportService.name);
  constructor(
    @InjectModel(TableImportJob.name) private readonly jobModel: Model<TableImportJob>,
    @InjectModel(TableImportSession.name) private readonly sessionModel: Model<TableImportSession>,
    @InjectModel(Bot.name) private readonly botModel: Model<Bot>,
    private readonly knowledgeBaseItemService: KnowledgeBaseItemService,
    private readonly knowledgeTrainingJobService: KnowledgeTrainingJobService,
  ) {}

  /**
   * Guard stale import finalization: only the job still linked to the KB row/session may mutate table content/status.
   */
  private async staleTableImportReason(
    job: TableImportJob & { _id: Types.ObjectId },
    kbRow?: Record<string, unknown> | null,
  ): Promise<string | null> {
    const kb = kbRow ?? (await this.knowledgeBaseItemService.findKnowledgeItemById(String(job.knowledgeBaseItemId)));
    if (!kb || (kb as { sourceType?: string }).sourceType !== 'table') return 'kb_missing';
    const linkedJobId =
      (kb as { tableMeta?: { tableImportJobId?: Types.ObjectId } }).tableMeta?.tableImportJobId;
    if (linkedJobId && String(linkedJobId) !== String(job._id)) {
      return 'stale_table_import_job';
    }
    const session = await this.sessionModel
      .findById(job.importSessionId)
      .select('cancelledAt resultKnowledgeBaseItemId resultImportJobId')
      .lean();
    if (session?.cancelledAt) return 'import_session_cancelled';
    const sidKb =
      (session as { resultKnowledgeBaseItemId?: Types.ObjectId } | null)?.resultKnowledgeBaseItemId;
    if (sidKb && String(sidKb) !== String(job.knowledgeBaseItemId)) {
      return 'stale_table_import_session_kb';
    }
    const sidJob = (session as { resultImportJobId?: Types.ObjectId } | null)?.resultImportJobId;
    if (sidJob && String(sidJob) !== String(job._id)) {
      return 'stale_table_import_session_job';
    }
    return null;
  }

  async createImportSession(params: {
    botId: string;
    s3Bucket: string;
    s3Key: string;
    originalFileName: string;
    fileSizeBytes: number;
    contentType?: string;
    columns: string[];
    previewRows: string[][];
    estimatedDataRows?: number;
  }): Promise<{ importSessionId: string }> {
    const ttlHours = Math.max(1, Math.floor(Number(process.env.TABLE_IMPORT_SESSION_TTL_HOURS) || 24));
    const doc = await this.sessionModel.create({
      botId: new Types.ObjectId(params.botId),
      s3Bucket: params.s3Bucket,
      s3Key: params.s3Key,
      originalFileName: params.originalFileName,
      fileSizeBytes: params.fileSizeBytes,
      contentType: params.contentType,
      columns: params.columns,
      previewRows: params.previewRows,
      estimatedDataRows: params.estimatedDataRows,
      expiresAt: new Date(Date.now() + ttlHours * 3600 * 1000),
    });
    return { importSessionId: String((doc as { _id: Types.ObjectId })._id) };
  }

  /**
   * Abandon a preview session: delete temp S3 object, mark session cancelled (confirm must fail with `import_session_cancelled`).
   */
  async cancelImportSession(
    botId: string,
    importSessionId: string,
  ): Promise<{ ok: true; alreadyCancelled?: true }> {
    if (!Types.ObjectId.isValid(botId) || !Types.ObjectId.isValid(importSessionId)) {
      throw new Error('invalid_ids');
    }
    const botOid = new Types.ObjectId(botId);
    const sid = new Types.ObjectId(importSessionId);

    const session = await this.sessionModel.findOne({ _id: sid, botId: botOid }).lean();
    if (!session) {
      throw new Error('session_not_found');
    }
    if (session.consumedAt) {
      throw new Error('session_already_consumed');
    }
    if (session.cancelledAt) {
      return { ok: true as const, alreadyCancelled: true as const };
    }

    const updated = await this.sessionModel
      .findOneAndUpdate(
        { _id: sid, botId: botOid, consumedAt: { $exists: false }, cancelledAt: { $exists: false } },
        { $set: { cancelledAt: new Date() } },
        { new: true },
      )
      .lean();
    if (!updated) {
      const again = await this.sessionModel.findOne({ _id: sid, botId: botOid }).lean();
      if (again?.cancelledAt) return { ok: true as const, alreadyCancelled: true as const };
      if (again?.consumedAt) throw new Error('session_already_consumed');
      throw new Error('session_not_found');
    }

    try {
      await deletePrivateObject(session.s3Bucket, session.s3Key);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.log.warn(`cancelImportSession ${importSessionId}: S3 delete failed (${msg})`);
    }
    return { ok: true as const };
  }

  /**
   * Remove stale preview-only sessions (expired or cancelled longer than grace) after best-effort S3 delete.
   * Does not touch consumed (confirmed) sessions.
   */
  async cleanupStaleTableImportPreviewSessions(
    limit = 50,
  ): Promise<{ sessionsRemoved: number; s3DeletesAttempted: number; s3DeletesFailed: number }> {
    const graceMs = tableImportSessionCleanupGraceMs();
    const purgeBefore = new Date(Date.now() - graceMs);
    const lim = Math.max(1, Math.min(500, Math.floor(limit)));
    const candidates = await this.sessionModel
      .find({
        consumedAt: { $exists: false },
        $or: [{ expiresAt: { $lt: purgeBefore } }, { cancelledAt: { $lte: purgeBefore } }],
      })
      .limit(lim)
      .lean();

    let sessionsRemoved = 0;
    let s3DeletesAttempted = 0;
    let s3DeletesFailed = 0;
    for (const raw of candidates) {
      const row = raw as { _id: Types.ObjectId; s3Bucket: string; s3Key: string };
      const hasKey = Boolean(String(row.s3Bucket ?? '').trim() && String(row.s3Key ?? '').trim());
      if (hasKey) {
        s3DeletesAttempted += 1;
        try {
          await deletePrivateObject(row.s3Bucket, row.s3Key);
        } catch (e) {
          s3DeletesFailed += 1;
          const msg = e instanceof Error ? e.message : String(e);
          this.log.warn(`cleanupStaleTableImportPreviewSessions ${String(row._id)}: S3 delete failed (${msg})`);
        }
      }
      await this.sessionModel.deleteOne({ _id: row._id });
      sessionsRemoved += 1;
    }
    return { sessionsRemoved, s3DeletesAttempted, s3DeletesFailed };
  }

  /**
   * Atomically claim one queued job: prefers {@link claimQueuedTableImportJobsFair} with limit 1
   * (oldest-per-bot round among queue heads, then global FIFO fallback).
   */
  async claimQueuedTableImportJob(): Promise<(TableImportJob & { _id: Types.ObjectId }) | null> {
    const batch = await this.claimQueuedTableImportJobsFair(1);
    return batch[0] ?? null;
  }

  /**
   * Claims up to `limit` table import jobs for one cron batch.
   *
   * **Fairness:** A pure global FIFO lets one bot enqueue hundreds of imports and starve every other
   * tenant until its queue drains. We first take the **oldest queued job per botId**, sort those
   * representatives by `queuedAt` / `createdAt`, and atomically claim up to `limit` of them. Remaining
   * slots use the legacy **global FIFO** so a single busy bot still makes progress when it dominates
   * the queue (and `TABLE_IMPORT_JOBS_RUNNER_LIMIT` is greater than the number of bots with work).
   *
   * **Atomicity:** Each row is claimed with `findOneAndUpdate({ _id, status: 'queued' }, …)` so
   * concurrent workers cannot process the same job; stale aggregation rows simply fail the claim.
   */
  async claimQueuedTableImportJobsFair(limit: number): Promise<(TableImportJob & { _id: Types.ObjectId })[]> {
    const lim = Math.max(1, Math.floor(limit));
    const startedAt = new Date();

    const fairReps = await this.jobModel
      .aggregate<(TableImportJob & { _id: Types.ObjectId })>([
        { $match: { status: 'queued' as const } },
        { $sort: { queuedAt: 1 as const, createdAt: 1 as const } },
        { $group: { _id: '$botId', doc: { $first: '$$ROOT' } } },
        { $replaceRoot: { newRoot: '$doc' } },
        { $sort: { queuedAt: 1 as const, createdAt: 1 as const } },
        { $limit: lim },
      ])
      .exec();

    const claimed: (TableImportJob & { _id: Types.ObjectId })[] = [];

    for (const rep of fairReps) {
      if (claimed.length >= lim) break;
      const doc = await this.tryAtomicallyClaimQueuedTableImportJobById(rep._id, startedAt);
      if (doc) claimed.push(doc);
    }

    while (claimed.length < lim) {
      const doc = await this.jobModel
        .findOneAndUpdate(
          { status: 'queued' as const },
          {
            $set: {
              status: 'processing' as const,
              startedAt,
              error: undefined,
              errorCode: undefined,
            },
          },
          { sort: { queuedAt: 1 as const, createdAt: 1 as const }, new: true },
        )
        .exec();
      if (!doc) break;
      claimed.push(doc as TableImportJob & { _id: Types.ObjectId });
    }

    return claimed;
  }

  private async tryAtomicallyClaimQueuedTableImportJobById(
    jobId: Types.ObjectId,
    startedAt: Date,
  ): Promise<(TableImportJob & { _id: Types.ObjectId }) | null> {
    const doc = await this.jobModel
      .findOneAndUpdate(
        { _id: jobId, status: 'queued' as const },
        {
          $set: {
            status: 'processing' as const,
            startedAt,
            error: undefined,
            errorCode: undefined,
          },
        },
        { new: true },
      )
      .exec();
    return doc as (TableImportJob & { _id: Types.ObjectId }) | null;
  }

  async resetStuckTableImportJobs(): Promise<number> {
    const cutoff = tableImportStuckCutoff();
    const stuck = await this.jobModel
      .find({
        ...mongoTableImportProcessingJobStaleCriteria(cutoff),
      })
      .select('_id botId knowledgeBaseItemId importAutoRetryCycles')
      .lean();
    let n = 0;
    const now = new Date();
    for (const raw of stuck) {
      const j = raw as {
        _id: Types.ObjectId;
        botId: Types.ObjectId;
        knowledgeBaseItemId: Types.ObjectId;
        importAutoRetryCycles?: number;
      };
      const cycles = (j.importAutoRetryCycles ?? 0) + 1;
      if (cycles >= TABLE_IMPORT_MAX_STUCK_RECOVERIES) {
        await this.jobModel.updateOne(
          { _id: j._id },
          {
            $set: {
              status: 'failed',
              error: 'stuck_timeout',
              errorCode: 'stuck_timeout',
              finishedAt: now,
              importAutoRetryCycles: cycles,
            },
          },
        );
        await this.knowledgeBaseItemService.finalizeAsyncTableImportFailure(
          j.knowledgeBaseItemId,
          'stuck_timeout',
          'Import job timed out.',
          String(j.botId),
        );
      } else {
        await this.jobModel.updateOne(
          { _id: j._id },
          {
            $set: {
              status: 'queued',
              queuedAt: now,
              importAutoRetryCycles: cycles,
            },
            $unset: { startedAt: 1 },
          },
        );
      }
      n++;
    }
    return n;
  }

  /**
   * Live import work for a table KB row (`queued` | `processing`), if any.
   */
  async findLiveTableImportJobForKnowledgeItem(
    botId: string,
    knowledgeBaseItemId: string,
  ): Promise<(TableImportJob & { _id: Types.ObjectId }) | null> {
    if (!Types.ObjectId.isValid(botId) || !Types.ObjectId.isValid(knowledgeBaseItemId)) return null;
    const doc = await this.jobModel
      .findOne({
        botId: new Types.ObjectId(botId),
        knowledgeBaseItemId: new Types.ObjectId(knowledgeBaseItemId),
        status: { $in: ['queued' as const, 'processing' as const] },
      })
      .sort({ createdAt: -1 })
      .lean();
    return doc as (TableImportJob & { _id: Types.ObjectId }) | null;
  }

  /**
   * Customer-facing: reset one stuck `processing` import job (same policy as {@link resetStuckTableImportJobs}).
   */
  async manualResetStuckTableImportForKnowledgeItem(botId: string, knowledgeBaseItemId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(botId) || !Types.ObjectId.isValid(knowledgeBaseItemId)) return false;
    const cutoff = tableImportStuckCutoff();
    const botOid = new Types.ObjectId(botId);
    const kbOid = new Types.ObjectId(knowledgeBaseItemId);
    const job = await this.jobModel
      .findOne({
        botId: botOid,
        knowledgeBaseItemId: kbOid,
        ...mongoTableImportProcessingJobStaleCriteria(cutoff),
      })
      .lean();
    if (!job) return false;

    const j = job as TableImportJob & { _id: Types.ObjectId };
    const now = new Date();
    const cycles = (j.importAutoRetryCycles ?? 0) + 1;
    if (cycles >= TABLE_IMPORT_MAX_STUCK_RECOVERIES) {
      await this.jobModel.updateOne(
        { _id: j._id },
        {
          $set: {
            status: 'failed' as const,
            error: 'stuck_timeout',
            errorCode: 'stuck_timeout',
            finishedAt: now,
            importAutoRetryCycles: cycles,
          },
        },
      );
      await this.knowledgeBaseItemService.finalizeAsyncTableImportFailure(
        j.knowledgeBaseItemId,
        'stuck_timeout',
        'Import job timed out.',
        String(j.botId),
      );
    } else {
      await this.jobModel.updateOne(
        { _id: j._id },
        {
          $set: {
            status: 'queued' as const,
            queuedAt: now,
            importAutoRetryCycles: cycles,
          },
          $unset: { startedAt: 1 },
        },
      );
    }
    return true;
  }

  /**
   * Customer-facing: retry a failed import when the temp S3 object still exists. Requeues the same job row (no duplicate live job).
   */
  async manualRetryFailedTableImport(
    botId: string,
    knowledgeBaseItemId: string,
  ): Promise<TableImportManualRetryResult> {
    if (!Types.ObjectId.isValid(botId) || !Types.ObjectId.isValid(knowledgeBaseItemId)) {
      return { ok: false, errorCode: 'kb_invalid' };
    }
    const botOid = new Types.ObjectId(botId);
    const kbOid = new Types.ObjectId(knowledgeBaseItemId);

    const kb = await this.knowledgeBaseItemService.findKnowledgeItemById(String(kbOid));
    if (!kb || (kb as { sourceType?: string }).sourceType !== 'table') {
      return { ok: false, errorCode: 'kb_invalid' };
    }
    if (knowledgeBaseItemIsEffectivelyDeleted(kb as { deletedAt?: Date | null })) {
      return { ok: false, errorCode: 'kb_invalid' };
    }

    const live = await this.findLiveTableImportJobForKnowledgeItem(botId, knowledgeBaseItemId);
    if (live) {
      return { ok: false, errorCode: 'already_queued' };
    }

    const job = await this.jobModel
      .findOne({
        botId: botOid,
        knowledgeBaseItemId: kbOid,
        status: 'failed' as const,
      })
      .sort({ createdAt: -1 })
      .lean();
    if (!job) {
      return { ok: false, errorCode: 'job_not_found' };
    }

    const j = job as TableImportJob & { _id: Types.ObjectId };
    const session = await this.sessionModel.findById(j.importSessionId).lean();
    if (!session) {
      return { ok: false, errorCode: 'import_session_expired' };
    }
    if (session.cancelledAt) {
      return { ok: false, errorCode: 'import_session_expired' };
    }

    const exists = await headObjectExists(j.s3Bucket, j.s3Key);
    if (!exists) {
      return { ok: false, errorCode: 'source_file_missing' };
    }

    const now = new Date();
    const updated = await this.jobModel.findOneAndUpdate(
      { _id: j._id, status: 'failed' as const },
      {
        $set: {
          status: 'queued' as const,
          queuedAt: now,
          error: undefined,
          errorCode: undefined,
          importAutoRetryCycles: 0,
        },
        $unset: { startedAt: 1, finishedAt: 1 },
      },
      { new: true },
    );
    if (!updated) {
      const again = await this.findLiveTableImportJobForKnowledgeItem(botId, knowledgeBaseItemId);
      if (again) return { ok: false, errorCode: 'already_queued' };
      return { ok: false, errorCode: 'job_not_found' };
    }

    await this.knowledgeBaseItemService.resetTableKnowledgeItemImportRetryState(botId, kbOid);
    return { ok: true };
  }

  async processTableImportJob(job: TableImportJob & { _id: Types.ObjectId }): Promise<void> {
    const botId = String(job.botId);
    const botRow = await this.botModel.findById(job.botId).select('active deletedAt').lean();
    if (botIsEffectivelyDeleted(botRow as { active?: boolean; deletedAt?: Date | null })) {
      await this.jobModel.updateOne(
        { _id: job._id },
        {
          $set: {
            status: 'failed',
            finishedAt: new Date(),
            error: 'Bot deleted',
            errorCode: 'kb_bot_deleted',
          },
        },
      );
      return;
    }
    const kbId = job.knowledgeBaseItemId;
    const kb = await this.knowledgeBaseItemService.findKnowledgeItemById(String(kbId));
    if (!kb || (kb as { sourceType?: string }).sourceType !== 'table') {
      await this.finishJobSkipped(job._id, 'kb_missing', 'Table knowledge item was removed.');
      return;
    }
    if (knowledgeBaseItemIsEffectivelyDeleted(kb as { deletedAt?: Date })) {
      await this.finishJobSkipped(job._id, 'kb_deleted', 'Table was removed.');
      return;
    }
    const staleAtStart = await this.staleTableImportReason(
      job,
      kb as unknown as Record<string, unknown>,
    );
    if (staleAtStart) {
      await this.finishJobSkipped(job._id, staleAtStart, 'Table import job is stale.');
      return;
    }

    await this.knowledgeBaseItemService.setTableKbImportPhase(kbId, 'importing');

    const title =
      clampStrUtf8Bytes(
        String((kb as { title?: string }).title ?? '').trim() || job.originalFileName.replace(/\.[^.]+$/i, '').trim() || 'Datasheet',
        KNOWLEDGE_ITEM_TITLE_MAX_UTF8_BYTES,
      ) || 'Datasheet';

    const xlsxMax = tableImportXlsxMaxBytesFromEnv();
    const sourceFileSize =
      typeof job.sourceFileSizeBytes === 'number' && Number.isFinite(job.sourceFileSizeBytes)
        ? job.sourceFileSizeBytes
        : undefined;

    let columns: string[];
    let rows: string[][];
    let importFileSizeForMeta: number;

    if (isDatasheetCsvFileName(job.originalFileName)) {
      let stream: Awaited<ReturnType<typeof getObjectStream>> | undefined;
      try {
        stream = await getObjectStream(job.s3Bucket, job.s3Key);
        const iterable = stream as AsyncIterable<Buffer>;
        const parsed = await streamImportCsvDatasheet(iterable, {
          title,
          dropColumnIndices: job.dropColumnIndices?.length ? job.dropColumnIndices : undefined,
          batchSize: TABLE_IMPORT_CSV_BATCH_ROWS_DEFAULT,
          maxSourceBytes: tableImportCsvMaxSourceBytesFromEnv(),
          onDataRowBatch: async () => {
            await new Promise<void>((resolve) => setImmediate(resolve));
          },
        });
        columns = parsed.columns;
        rows = parsed.rows;
        importFileSizeForMeta = sourceFileSize ?? 0;
      } catch (e) {
        if (stream) {
          try {
            (stream as Readable).destroy();
          } catch {
            /* ignore */
          }
        }
        const msg = e instanceof Error ? e.message : String(e);
        if (e instanceof TableDatasheetValidationError) {
          await this.failJob(job, kbId, botId, e.code, e.message);
          return;
        }
        await this.failJob(job, kbId, botId, 'parse_error', msg);
        return;
      } finally {
        if (stream) {
          try {
            (stream as Readable).destroy();
          } catch {
            /* ignore */
          }
        }
      }
    } else {
      if (sourceFileSize != null && sourceFileSize > xlsxMax) {
        await this.failJob(
          job,
          kbId,
          botId,
          'xlsx_too_large',
          'Excel file is too large for in-memory import. Export to CSV for larger tables.',
        );
        return;
      }
      let buffer: Buffer;
      try {
        buffer = await getObjectBody(job.s3Bucket, job.s3Key);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await this.failJob(job, kbId, botId, 's3_download_failed', msg);
        return;
      }
      if (buffer.length > xlsxMax) {
        await this.failJob(
          job,
          kbId,
          botId,
          'xlsx_too_large',
          'Excel file is too large for in-memory import. Export to CSV for larger tables.',
        );
        return;
      }
      const parsed = parseDatasheetFileBuffer(buffer, job.originalFileName, { maxSourceBytes: xlsxMax });
      if (parsed.parseError && parsed.columns.length === 0) {
        const code = parsed.parseErrorCode ?? 'parse_error';
        await this.failJob(job, kbId, botId, code, parsed.parseError || 'parse_error');
        return;
      }
      const applied = applyDatasheetColumnDrops(
        parsed.columns,
        parsed.rows,
        job.dropColumnIndices?.length ? job.dropColumnIndices : undefined,
      );
      columns = applied.columns;
      rows = applied.rows;
      importFileSizeForMeta = buffer.length;

      try {
        validateDatasheetGridOrThrow(title, columns, rows);
      } catch (err) {
        if (err instanceof TableDatasheetValidationError) {
          await this.failJob(job, kbId, botId, err.code, err.message);
          return;
        }
        throw err;
      }
    }

    const kbBeforeFinalize = await this.knowledgeBaseItemService.findKnowledgeItemById(String(kbId));
    if (!kbBeforeFinalize || (kbBeforeFinalize as { sourceType?: string }).sourceType !== 'table') {
      await this.finishJobSkipped(job._id, 'kb_missing', 'Table knowledge item was removed.');
      return;
    }
    if (knowledgeBaseItemIsEffectivelyDeleted(kbBeforeFinalize as { deletedAt?: Date })) {
      await this.finishJobSkipped(job._id, 'kb_deleted', 'Table was removed.');
      return;
    }
    const staleBeforeFinalize = await this.staleTableImportReason(
      job,
      kbBeforeFinalize as unknown as Record<string, unknown>,
    );
    if (staleBeforeFinalize) {
      await this.finishJobSkipped(job._id, staleBeforeFinalize, 'Table import job is stale.');
      return;
    }

    const tableIndex =
      (kbBeforeFinalize as { tableMeta?: { tableIndex?: number } }).tableMeta?.tableIndex ??
      (await this.knowledgeBaseItemService.allocateTableIndexForBot(botId));

    try {
      await this.knowledgeBaseItemService.finalizeAsyncTableImportSuccess(
        botId,
        kbId,
        {
          title,
          columns,
          rows,
          importFileName: job.originalFileName,
          importFileSize: importFileSizeForMeta,
          tableIndex,
        },
        { skipScopeTrainingSchedule: true },
      );
    } catch (e) {
      if (isPlanLimitBotKbTotalHttpException(e)) {
        const pl = planLimitPayloadFromHttpException(e);
        await this.knowledgeBaseItemService.persistTableGridBotKbLimitExceeded(botId, kbId, {
          title,
          columns,
          rows,
          importFileName: job.originalFileName,
          importFileSize: importFileSizeForMeta,
          tableIndex,
        });
        await this.jobModel.updateOne(
          { _id: job._id },
          {
            $set: {
              status: 'failed',
              finishedAt: new Date(),
              error: pl?.message ?? String(e),
              errorCode: pl?.errorCode ?? 'plan_limit_bot_kb_total',
            },
          },
        );
        return;
      }
      if (e instanceof TableDatasheetValidationError) {
        await this.failJob(job, kbId, botId, e.code, e.message);
        return;
      }
      const msg = e instanceof Error ? e.message : String(e);
      await this.failJob(job, kbId, botId, 'persist_failed', msg);
      return;
    }

    try {
      const trainingSettings = await this.knowledgeBaseItemService.getKnowledgeTrainingSettingsForBot(botId);
      if (trainingSettings.autoTrainEnabled) {
        await this.knowledgeTrainingJobService.scheduleTrainingForScopes(botId, ['table']);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.log.warn(`Table import ${String(job._id)}: training schedule failed (${msg})`);
    }

    await this.jobModel.updateOne(
      { _id: job._id },
      { $set: { status: 'done', finishedAt: new Date(), error: undefined, errorCode: undefined } },
    );
  }

  private async finishJobSkipped(jobId: Types.ObjectId, code: string, message: string): Promise<void> {
    await this.jobModel.updateOne(
      { _id: jobId },
      { $set: { status: 'done', finishedAt: new Date(), error: message, errorCode: code } },
    );
  }

  private async failJob(
    job: TableImportJob & { _id: Types.ObjectId },
    kbId: Types.ObjectId,
    botId: string,
    code: string,
    message: string,
  ): Promise<void> {
    const staleReason = await this.staleTableImportReason(job);
    if (staleReason) {
      await this.finishJobSkipped(job._id, staleReason, 'Table import job is stale.');
      return;
    }
    await this.knowledgeBaseItemService.finalizeAsyncTableImportFailure(kbId, code, message, botId);
    await this.jobModel.updateOne(
      { _id: job._id },
      {
        $set: {
          status: 'failed',
          finishedAt: new Date(),
          error: message,
          errorCode: code,
        },
      },
    );
  }

  /** Catch-all when {@link processTableImportJob} throws unexpectedly (after claim). */
  async handleProcessJobCrash(job: TableImportJob & { _id: Types.ObjectId }, message: string): Promise<void> {
    await this.failJob(job, job.knowledgeBaseItemId, String(job.botId), 'worker_exception', message);
  }

  async confirmTableImport(
    botId: string,
    importSessionId: string,
    opts?: { title?: string; dropColumnIndices?: number[] },
  ): Promise<TableImportConfirmResult> {
    if (!Types.ObjectId.isValid(botId) || !Types.ObjectId.isValid(importSessionId)) {
      throw new Error('invalid_ids');
    }
    const botOid = new Types.ObjectId(botId);
    const sid = new Types.ObjectId(importSessionId);
    const now = new Date();

    const existingJob = await this.jobModel
      .findOne({ importSessionId: sid })
      .select('_id knowledgeBaseItemId')
      .sort({ createdAt: -1 })
      .lean();
    if (existingJob) {
      const kbOid = (existingJob as { knowledgeBaseItemId: Types.ObjectId }).knowledgeBaseItemId;
      const kb = await this.knowledgeBaseItemService.findKnowledgeItemById(String(kbOid));
      const sheetIndex =
        (kb as { tableMeta?: { tableIndex?: number } } | null)?.tableMeta?.tableIndex ?? 0;
      return {
        ok: true,
        idempotent: true,
        botId,
        knowledgeBaseItemId: String(kbOid),
        importJobId: String((existingJob as { _id: Types.ObjectId })._id),
        sheetIndex,
        tableImportDisplayState: tableImportDisplayStateFromKb({
          status: (kb as { status?: string } | null)?.status,
          tableMeta: (kb as { tableMeta?: { importPhase?: string } } | null)?.tableMeta,
        }),
      };
    }

    const session = await this.sessionModel.findOne({ _id: sid, botId: botOid }).lean();
    if (!session) {
      throw new Error('session_not_found');
    }
    if (session.cancelledAt) {
      throw new Error('import_session_cancelled');
    }
    if (new Date(session.expiresAt) <= now) {
      throw new Error('import_session_expired');
    }
    if (session.consumedAt) {
      throw new Error('session_already_consumed');
    }

    const count = await this.knowledgeBaseItemService.countTableKnowledgeItemsForBot(botId);
    if (count >= KNOWLEDGE_TABLES_MAX) {
      throw new Error('table_limit');
    }

    const maxLive = tableImportMaxLiveJobsPerBot();
    const liveJobs = await this.jobModel.countDocuments({
      botId: botOid,
      status: { $in: ['queued' as const, 'processing' as const] },
    });
    if (liveJobs >= maxLive) {
      throw new Error('import_limit_concurrent');
    }

    const maxDaily = tableImportMaxStartsPerBotPerDay();
    if (maxDaily > 0) {
      const startUtc = new Date();
      startUtc.setUTCHours(0, 0, 0, 0);
      const startedToday = await this.jobModel.countDocuments({
        botId: botOid,
        createdAt: { $gte: startUtc },
      });
      if (startedToday >= maxDaily) {
        throw new Error('import_limit_daily');
      }
    }

    const tableIndex = await this.knowledgeBaseItemService.allocateTableIndexForBot(botId);
    const baseTitle =
      typeof opts?.title === 'string' && opts.title.trim()
        ? opts.title.trim()
        : String(session.originalFileName ?? 'datasheet').replace(/\.[^.]+$/i, '').trim() || 'Imported datasheet';
    const title = clampStrUtf8Bytes(baseTitle, KNOWLEDGE_ITEM_TITLE_MAX_UTF8_BYTES) || 'Datasheet';

    const { _id: kbOid } = await this.knowledgeBaseItemService.createAsyncTableImportPlaceholder({
      botId,
      title,
      tableIndex,
      columns: session.columns ?? [],
      previewRows: session.previewRows ?? [],
      importFileName: session.originalFileName,
      importFileSize: session.fileSizeBytes,
    });

    let jobDoc: TableImportJob & { _id: Types.ObjectId };
    try {
      jobDoc = (await this.jobModel.create({
        botId: botOid,
        knowledgeBaseItemId: kbOid,
        importSessionId: sid,
        s3Bucket: session.s3Bucket,
        s3Key: session.s3Key,
        originalFileName: session.originalFileName,
        sourceFileSizeBytes: session.fileSizeBytes,
        status: 'queued',
        queuedAt: now,
        dropColumnIndices: opts?.dropColumnIndices?.length ? opts.dropColumnIndices : undefined,
      })) as TableImportJob & { _id: Types.ObjectId };
    } catch (e) {
      const err = e as { code?: number };
      if (err.code === 11000) {
        const j = await this.jobModel
          .findOne({ botId: botOid, knowledgeBaseItemId: kbOid, status: { $in: ['queued', 'processing'] } })
          .lean();
        if (j) {
          return {
            ok: true,
            idempotent: true,
            botId,
            knowledgeBaseItemId: String(kbOid),
            importJobId: String((j as { _id: Types.ObjectId })._id),
            sheetIndex: tableIndex,
            tableImportDisplayState: tableImportDisplayStateFromKb({
              status: 'pending',
              tableMeta: { importPhase: 'import_queued' },
            }),
          };
        }
      }
      await this.knowledgeBaseItemService.removeTableKnowledgeItemForBot(botId, kbOid);
      throw e;
    }

    await this.knowledgeBaseItemService.linkTableImportJobToKbItem(kbOid, jobDoc._id);

    await this.sessionModel.updateOne(
      { _id: sid },
      {
        $set: {
          consumedAt: now,
          resultKnowledgeBaseItemId: kbOid,
          resultImportJobId: jobDoc._id,
        },
      },
    );

    const kbFresh = await this.knowledgeBaseItemService.findKnowledgeItemById(String(kbOid));
    return {
      ok: true,
      botId,
      knowledgeBaseItemId: String(kbOid),
      importJobId: String(jobDoc._id),
      sheetIndex: tableIndex,
      tableImportDisplayState: tableImportDisplayStateFromKb({
        status: (kbFresh as { status?: string } | null)?.status,
        tableMeta: (kbFresh as { tableMeta?: { importPhase?: string } } | null)?.tableMeta,
      }),
    };
  }
}
