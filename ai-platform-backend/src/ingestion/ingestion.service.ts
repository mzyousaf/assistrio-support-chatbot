import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { Bot, ExtractJob, TrainJob } from '../models';
import { KbService } from '../knowledge/kb.service';
import { KnowledgeBaseItemAccessService, knowledgeBaseItemIsEffectivelyDeleted } from '../knowledge/knowledge-base-item-access.service';
import { KnowledgeBaseItemService } from '../knowledge/knowledge-base-item.service';
import { KnowledgeBaseChunkService } from '../knowledge/knowledge-base-chunk.service';
import { RagService } from '../rag/rag.service';
import { getObjectBody } from '../lib/s3';
import { isTrainableExtractedDocumentText } from '../knowledge/knowledge-text-metrics';
import { normalizeKnowledgeTrainingStatus } from '../knowledge/knowledge-training-status.util';
import type { IngestionRunResult } from './ingestion-runner.types';
import type { DocumentKbStaleSnapshot } from './document-ingest-stale-guard';
import { shouldSkipDocumentKnowledgeChunkWrite, documentIngestKbContentFingerprint } from './document-ingest-stale-guard';
import { humanizeDocumentIngestFailureReason } from './ingestion-failure-message.util';
import {
  kbRowEligibleForQueuedContentExtraction,
  shouldMarkDocumentKbUploadFailedForUnusableSource,
} from './content-extraction-eligibility.util';
import { effectiveKbDocumentFileMetaLean } from '../knowledge/knowledge-base-document-sync-fields.util';
import {
  extractFailureDeferRunAfterMs,
  resolveExtractJobMaxAutoRetries,
} from './extract-job-retry.policy.util';
import { kbTrainingLog } from '../knowledge/kb-training-log.util';
import { KnowledgeStatsService } from '../knowledge/knowledge-stats.service';
import {
  documentKbContentFingerprint,
  normalizeKbDocumentBodyForHash,
  normalizeKbDocumentTitleForRow,
} from '../knowledge/knowledge-content-hash.util';
import { botIsEffectivelyDeleted } from '../bots/bot-not-deleted.util';
import {
  isPlanLimitBotKbTotalHttpException,
  PLAN_LIMIT_BOT_KB_TOTAL_CODE,
  PLAN_LIMIT_BOT_KB_TOTAL_MESSAGE,
} from '../knowledge/bot-knowledge-total-limit.service';
import {
  EXTRACT_JOB_MAX_STUCK_RECOVERIES,
  INGESTION_STUCK_TIMEOUT_MINUTES,
  STUCK_RECOVERY_LIMIT_JOB_ERROR,
} from '../knowledge/knowledge-pipeline-retry.constants';
import { mongoExtractProcessingJobStaleCriteria } from '../knowledge/pipeline-stuck-processing-query.util';

const STUCK_RECOVERY_LIMIT_EXTRACTION_CUSTOMER_MESSAGE =
  'Processing stalled too many times automatically. Use Retry to try again.';

function extractJobDueRunAfterClause(now: Date): Record<string, unknown>[] {
  return [{ runAfter: { $exists: false } }, { runAfter: null }, { runAfter: { $lte: now } }];
}

/** Max document chunks to embed and store (KB-only). */
const MAX_DOC_CHUNKS = 50;
/** Max total chars across chunks for one document. */
const MAX_EMBED_TOTAL_CHARS = 100_000;
const EMBED_BATCH_SIZE = 25;

type IngestRouteJobRef = {
  _id: Types.ObjectId;
  botId: Types.ObjectId;
  knowledgeBaseItemId?: Types.ObjectId;
};

/** Document chunk/embed phase (`knowledge_base_training_jobs` with `kind: 'document'`). */
export type DocumentTrainRouteRef = {
  _id: Types.ObjectId;
  botId: Types.ObjectId;
  knowledgeBaseItemId?: Types.ObjectId;
  documentEmbedTargetContentHash?: string;
  documentEmbedTargetLastContentUpdatedAt?: Date;
};

@Injectable()
export class IngestionService {
  constructor(
    private readonly config: ConfigService,
    private readonly kbService: KbService,
    private readonly ragService: RagService,
    private readonly knowledgeBaseItemAccess: KnowledgeBaseItemAccessService,
    private readonly knowledgeBaseItemService: KnowledgeBaseItemService,
    private readonly knowledgeBaseChunkService: KnowledgeBaseChunkService,
    private readonly knowledgeStatsService: KnowledgeStatsService,
    @InjectModel(Bot.name) private readonly botModel: Model<Bot>,
    @InjectModel(ExtractJob.name) private readonly extractJobModel: Model<ExtractJob>,
    @InjectModel(TrainJob.name) private readonly trainJobModel: Model<TrainJob>,
  ) {}

  /**
   * Per-bot chain so each document's post-extract storage check sees usage left by prior extracts
   * (multi-upload partial OOS under concurrent workers).
   */
  private readonly documentExtractPersistChains = new Map<string, Promise<unknown>>();

  private runDocumentExtractPersistSerialized<T>(botId: string, fn: () => Promise<T>): Promise<T> {
    const key = String(botId);
    const prev = this.documentExtractPersistChains.get(key) ?? Promise.resolve();
    const next = prev.then(fn, fn);
    this.documentExtractPersistChains.set(
      key,
      next.then(
        () => undefined,
        () => undefined,
      ),
    );
    return next;
  }

  /**
   * Training phase should only run when item is explicitly queued, or auto-train is enabled.
   * Upload-triggered extraction jobs may run with status=pending when auto-train is off.
   */
  private async shouldRunDocumentTrainingPhase(botId: string, currentStatus: unknown): Promise<boolean> {
    const st = normalizeKnowledgeTrainingStatus(String(currentStatus ?? ''));
    if (st === 'queued' || st === 'processing' || st === 'ready') return true;
    const settings = await this.knowledgeBaseItemService.getKnowledgeTrainingSettingsForBot(botId);
    return settings.autoTrainEnabled;
  }

  async runJob(secret: string, _jobId?: string): Promise<{ ok: boolean }> {
    const expected = this.config.get<string>('jobRunnerSecret');
    if (secret !== expected) {
      throw new Error('Invalid job runner secret');
    }
    return { ok: true };
  }

  async deleteJobsByDocId(botId: string, routeId: string): Promise<void> {
    if (!Types.ObjectId.isValid(botId) || !Types.ObjectId.isValid(routeId)) return;
    const botOid = new Types.ObjectId(botId);
    const rid = new Types.ObjectId(routeId);
    /** Only **queued** jobs — leave `processing` rows for workers to finish or stale-guard. */
    await Promise.all([
      this.extractJobModel.deleteMany({ botId: botOid, knowledgeBaseItemId: rid, status: 'queued' }),
      this.trainJobModel.deleteMany({
        botId: botOid,
        kind: 'document',
        knowledgeBaseItemId: rid,
        status: 'queued',
      }),
    ]);
  }

  /**
   * Prefer an in-flight job, else the newest queued row, else most recently touched (done/failed history).
   */
  private pickCanonicalExtractJobSibling(
    siblings: Array<
      Record<string, unknown> & {
        _id: Types.ObjectId;
        status?: string;
        createdAt?: Date;
        updatedAt?: Date;
        processingStartedAt?: Date;
        startedAt?: Date;
      }
    >,
  ): (typeof siblings)[number] {
    const processing = siblings.filter((s) => String(s.status ?? '') === 'processing');
    if (processing.length) {
      const t = (r: (typeof siblings)[number]) =>
        new Date(
          (r.processingStartedAt as Date | undefined)?.getTime?.() ??
            (r.startedAt as Date | undefined)?.getTime?.() ??
            (r.createdAt as Date | undefined)?.getTime?.() ??
            0,
        ).getTime();
      return processing.sort((a, b) => t(b) - t(a))[0];
    }
    const queued = siblings.filter((s) => String(s.status ?? '') === 'queued');
    if (queued.length) {
      const t = (r: (typeof siblings)[number]) =>
        new Date((r.createdAt as Date | undefined)?.getTime?.() ?? 0).getTime();
      return queued.sort((a, b) => t(b) - t(a))[0];
    }
    const touch = (r: (typeof siblings)[number]) =>
      new Date(
        (r.updatedAt as Date | undefined)?.getTime?.() ??
          (r.createdAt as Date | undefined)?.getTime?.() ??
          0,
      ).getTime();
    return siblings.sort((a, b) => touch(b) - touch(a))[0];
  }

  /**
   * One `ExtractJob` document per document KB route: reuse the same row across queued → processing → done/failed and
   * refresh `runAfter` / re-queue on the canonical row. Collapses historical duplicate rows (legacy inserts after `done`).
   */
  async createQueuedJob(
    botId: string,
    routeId: string,
    opts?: {
      timesOverride?: { lastQueuedAt: Date; runAfter: Date };
      markTrainingQueued?: boolean;
      /** Skip post-create immediate extract (tests / batch). */
      deferImmediateExtract?: boolean;
    },
  ) {
    if (!Types.ObjectId.isValid(botId) || !Types.ObjectId.isValid(routeId)) {
      throw new Error('createQueuedJob: invalid botId or routeId');
    }
    const kbRow = await this.knowledgeBaseItemAccess.findKbDocumentItemByRouteId(botId, routeId);
    if (!kbRow) {
      throw new Error('createQueuedJob: KnowledgeBaseItem document row not found');
    }
    const now = new Date();
    const times =
      opts?.timesOverride ??
      (await this.knowledgeBaseItemService.getIngestQueueTimesForDocument(botId, String(kbRow._id), now));
    const botOid = new Types.ObjectId(botId);
    const kbOid = kbRow._id as Types.ObjectId;
    const createPayload = {
      botId: botOid,
      knowledgeBaseItemId: kbOid,
      status: 'queued' as const,
      queuedAt: times.lastQueuedAt,
      runAfter: times.runAfter,
      extractAutoRetryCycles: 0,
      extractStuckRecoveryCycles: 0,
    };

    let jobId: Types.ObjectId | undefined;
    let scheduleImmediate = opts?.deferImmediateExtract !== true;

    for (let attempt = 0; attempt < 4 && !jobId; attempt++) {
      type ExtractSibling = Record<string, unknown> & {
        _id: Types.ObjectId;
        status?: string;
        createdAt?: Date;
        updatedAt?: Date;
        processingStartedAt?: Date;
        startedAt?: Date;
      };
      const siblings = (await this.extractJobModel
        .find({ botId: botOid, knowledgeBaseItemId: kbOid })
        .sort({ updatedAt: -1 })
        .lean()) as unknown as ExtractSibling[];

      if (siblings.length > 1) {
        const canonical = this.pickCanonicalExtractJobSibling(siblings);
        const canonicalId = canonical._id;
        const dupIds = siblings.filter((s) => String(s._id) !== String(canonicalId)).map((s) => s._id);
        if (dupIds.length) {
          const finishedDedupeAt = new Date();
          await this.extractJobModel.updateMany(
            { _id: { $in: dupIds } },
            {
              $set: {
                status: 'done',
                finishedAt: finishedDedupeAt,
                error: 'skipped:dedupe_singleton_extract_job',
              },
              $unset: { startedAt: 1, processingStartedAt: 1 },
            },
          );
        }
        jobId = canonicalId;
        const st = String(canonical.status ?? '');
        if (st === 'processing') {
          scheduleImmediate = false;
        } else if (st === 'queued') {
          await this.extractJobModel.updateOne(
            { _id: jobId },
            { $set: { queuedAt: times.lastQueuedAt, runAfter: times.runAfter, error: undefined } },
          );
        } else {
          await this.extractJobModel.updateOne(
            { _id: jobId },
            {
              $set: {
                status: 'queued',
                queuedAt: times.lastQueuedAt,
                runAfter: times.runAfter,
                error: undefined,
                extractAutoRetryCycles: 0,
                extractStuckRecoveryCycles: 0,
              },
              $unset: { startedAt: 1, processingStartedAt: 1, finishedAt: 1 },
            },
          );
        }
        continue;
      }

      if (siblings.length === 1) {
        const only = siblings[0];
        jobId = only._id;
        const st = String(only.status ?? '');
        if (st === 'processing') {
          scheduleImmediate = false;
        } else if (st === 'queued') {
          await this.extractJobModel.updateOne(
            { _id: jobId },
            { $set: { queuedAt: times.lastQueuedAt, runAfter: times.runAfter, error: undefined } },
          );
        } else {
          await this.extractJobModel.updateOne(
            { _id: jobId },
            {
              $set: {
                status: 'queued',
                queuedAt: times.lastQueuedAt,
                runAfter: times.runAfter,
                error: undefined,
                extractAutoRetryCycles: 0,
                extractStuckRecoveryCycles: 0,
              },
              $unset: { startedAt: 1, processingStartedAt: 1, finishedAt: 1 },
            },
          );
        }
        continue;
      }

      try {
        const created = await this.extractJobModel.create(createPayload);
        jobId = (created as { _id: Types.ObjectId })._id;
      } catch (e: unknown) {
        const code = (e as { code?: number })?.code;
        if (code !== 11000 || attempt >= 3) throw e;
      }
    }

    if (!jobId) {
      throw new Error('createQueuedJob: could not resolve extract job id');
    }

    kbTrainingLog('ExtractJob created', {
      extractJobId: String(jobId),
      botId,
      knowledgeBaseItemId: String(kbRow._id),
      runAfter: times.runAfter.toISOString(),
    });
    if (opts?.markTrainingQueued !== false) {
      await this.knowledgeBaseItemService.notifyDocumentExtractJobEnqueued(botId, String(kbRow._id), times, {
        alignTrainingStatusQueued: true,
      });
    } else {
      await this.knowledgeBaseItemService.notifyDocumentExtractJobEnqueued(botId, String(kbRow._id), times, {
        alignTrainingStatusQueued: false,
      });
    }
    if (scheduleImmediate) {
      this.scheduleImmediateExtractAfterCreate(jobId.toString());
    }
    const leanJob = await this.extractJobModel.findById(jobId).lean();
    return (leanJob ?? { _id: jobId }) as unknown as Record<string, unknown>;
  }

  /**
   * After PATCH persisted KB title/body when source extraction is unnecessary: skip creating an {@link ExtractJob}
   * and enqueue document training like {@link tryFinishExtractJobIfAlreadyExtracted} →
   * {@link markExtractJobDoneAndMaybeQueueTraining}. Uses {@link KnowledgeBaseItemService.getIngestQueueTimesForDocument}
   * so {@link TrainJob} `runAfter` follows ingest smart-delay (first train immediate when configured; spaced repeats afterward).
   * Does not reset {@link KnowledgeBaseItem} extraction phase.
   */
  async finalizeDocumentManualPatchWithoutExtractJob(
    botId: string,
    routeId: string,
    alignTrainingQueuedWithIngest: boolean,
  ): Promise<void> {
    if (!Types.ObjectId.isValid(botId) || !Types.ObjectId.isValid(routeId)) return;
    const kbRow = await this.knowledgeBaseItemAccess.findKbDocumentItemByRouteId(botId, routeId);
    if (!kbRow) return;
    const botOid = new Types.ObjectId(botId);
    const kbOid = kbRow._id as Types.ObjectId;
    const now = new Date();
    const times = await this.knowledgeBaseItemService.getIngestQueueTimesForDocument(botId, String(kbOid), now);
    await this.knowledgeBaseItemService.markDocumentIngestionQueued(
      botId,
      routeId,
      { lastQueuedAt: times.lastQueuedAt, runAfter: times.runAfter },
      { setTrainingStatusQueued: alignTrainingQueuedWithIngest },
    );

    const kbFresh = await this.knowledgeBaseItemAccess.findKbDocumentItemByRouteId(botId, routeId);
    if (!kbFresh) return;

    const shouldRun = await this.shouldRunDocumentTrainingPhase(botId, kbFresh.status);
    if (!shouldRun) {
      await this.knowledgeBaseItemService.setDocumentKnowledgeItemStatus(botId, routeId, { status: 'pending' });
      return;
    }

    await this.upsertQueuedDocumentTrainJob(botOid, kbOid, {
      queuedAt: times.lastQueuedAt,
      runAfter: times.runAfter,
    });
  }

  /**
   * Ensure an IngestJob exists and is queued (or refresh times). Does not add a second job while one is processing.
   * @param opts.minDelayMs Optional minimum delay before `runAfter` (stale-skip retries) to avoid hot loops.
   * @param opts.forceImmediateDue When true, use `runAfter = lastQueuedAt = now` and skip smart delay. Retrain Agent passes false (default) so timing matches {@link KnowledgeBaseItemService.getIngestQueueTimesForDocument}.
   */
  async ensureQueuedIngestJobForDocument(
    botId: string,
    docId: string,
    opts?: { minDelayMs?: number; forceImmediateDue?: boolean },
  ): Promise<void> {
    if (!Types.ObjectId.isValid(botId) || !Types.ObjectId.isValid(docId)) return;
    const botOid = new Types.ObjectId(botId);
    const kbRow = await this.knowledgeBaseItemAccess.findKbDocumentItemByRouteId(botId, docId);
    if (!kbRow) return;
    /** Align with extract completion + Train Now: embedding only when queued/processing/ready or auto-train on. */
    const shouldQueueDocumentTrainingPhase = await this.shouldRunDocumentTrainingPhase(
      botId,
      (kbRow as { status?: string }).status,
    );
    const now = new Date();
    const immediateTimes = { lastQueuedAt: now, runAfter: now };
    const times =
      opts?.forceImmediateDue === true
        ? immediateTimes
        : await (async () => {
          const baseTimes = await this.knowledgeBaseItemService.getIngestQueueTimesForDocument(
            botId,
            String(kbRow._id),
            now,
          );
          const minAfter =
            opts?.minDelayMs != null && opts.minDelayMs > 0 ? new Date(Date.now() + opts.minDelayMs) : null;
          return {
            lastQueuedAt: baseTimes.lastQueuedAt,
            runAfter:
              minAfter != null && minAfter.getTime() > baseTimes.runAfter.getTime()
                ? minAfter
                : baseTimes.runAfter,
          };
        })();
    kbTrainingLog('ensureQueuedIngestJob', {
      docId,
      immediate: opts?.forceImmediateDue === true,
      runAfter: times.runAfter.toISOString(),
    });

    const routeKey = { knowledgeBaseItemId: kbRow._id } as Record<string, unknown>;
    const kbTrainNorm = normalizeKnowledgeTrainingStatus(String((kbRow as { status?: string }).status ?? ''));

    const trainProcessing = await this.trainJobModel
      .findOne({
        botId: botOid,
        kind: 'document',
        ...routeKey,
        status: 'processing',
      })
      .sort({ createdAt: -1 })
      .lean();
    if (trainProcessing) {
      kbTrainingLog('ensureQueuedIngestJob: skip (document TrainJob already processing)', {
        botId: String(botOid),
        knowledgeBaseItemId: String(kbRow._id),
        processingTrainJobId: String((trainProcessing as { _id: Types.ObjectId })._id),
      });
      return;
    }

    const extractProcessing = await this.extractJobModel
      .findOne({
        botId: botOid,
        ...routeKey,
        status: 'processing',
      })
      .sort({ createdAt: -1 })
      .lean();
    if (extractProcessing) {
      return;
    }

    const existingExtract = await this.extractJobModel
      .findOne({
        botId: botOid,
        ...routeKey,
      })
      .sort({ createdAt: -1 })
      .lean();

    const kbEffective = effectiveKbDocumentFileMetaLean(kbRow as unknown as Record<string, unknown>);
    const stillNeedsExtract = kbRowEligibleForQueuedContentExtraction({
      isContentExtracted: kbRow.isContentExtracted,
      content: kbRow.content,
      fileMeta: kbEffective,
    });

    const extractDoneButKbNotExtracted =
      Boolean(existingExtract) && (existingExtract as { status?: string }).status === 'done' && stillNeedsExtract;
    if (extractDoneButKbNotExtracted) {
      await this.trainJobModel.deleteMany({
        botId: botOid,
        kind: 'document',
        ...routeKey,
        status: 'queued',
      });
      const exId = (existingExtract as { _id: Types.ObjectId })._id;
      await this.extractJobModel.updateOne(
        { _id: exId },
        {
          $set: {
            status: 'queued',
            queuedAt: times.lastQueuedAt,
            runAfter: times.runAfter,
            error: undefined,
            extractAutoRetryCycles: 0,
            extractStuckRecoveryCycles: 0,
          },
          $unset: { startedAt: 1, processingStartedAt: 1, finishedAt: 1 },
        },
      );
      await this.knowledgeBaseItemService.notifyDocumentExtractJobEnqueued(botId, String(kbRow._id), times, {
        alignTrainingStatusQueued: false,
      });
      this.scheduleImmediateExtractAfterCreate(String(exId));
      return;
    }

    const trainQueued = await this.trainJobModel
      .findOne({
        botId: botOid,
        kind: 'document',
        ...routeKey,
        status: 'queued',
      })
      .sort({ createdAt: -1 })
      .lean();
    if (trainQueued) {
      if (!stillNeedsExtract) {
        if (!shouldQueueDocumentTrainingPhase) {
          await this.trainJobModel.deleteMany({
            botId: botOid,
            kind: 'document',
            ...routeKey,
            status: 'queued',
          });
          const kbSt = normalizeKnowledgeTrainingStatus(String((kbRow as { status?: string }).status ?? ''));
          if (kbSt === 'queued') {
            await this.knowledgeBaseItemService.setDocumentKnowledgeItemStatus(botId, String(kbRow._id), {
              status: 'pending',
            });
          }
          return;
        }
        const tjSnap = await this.knowledgeBaseItemAccess.findDocumentLinkedKbStaleFields(botId, String(kbRow._id));
        await this.trainJobModel.updateOne(
          { _id: (trainQueued as { _id: Types.ObjectId })._id },
          {
            $set: {
              queuedAt: times.lastQueuedAt,
              runAfter: times.runAfter,
              error: undefined,
              documentEmbedTargetContentHash: tjSnap?.contentHash,
              documentEmbedTargetLastContentUpdatedAt: tjSnap?.lastContentUpdatedAt,
            },
          },
        );
        await this.knowledgeBaseItemService.markDocumentIngestionQueued(botId, String(kbRow._id), times, {
          setTrainingStatusQueued: true,
        });
        return;
      }
      await this.trainJobModel.deleteMany({
        botId: botOid,
        kind: 'document',
        ...routeKey,
        status: 'queued',
      });
    }

    if (!existingExtract) {
      await this.createQueuedJob(botId, String(kbRow._id), {
        timesOverride: times,
        markTrainingQueued: shouldQueueDocumentTrainingPhase,
      });
      return;
    }
    const st = (existingExtract as { status?: string }).status;
    if (st === 'queued') {
      await this.extractJobModel.updateOne(
        { _id: (existingExtract as { _id: Types.ObjectId })._id },
        { $set: { queuedAt: times.lastQueuedAt, runAfter: times.runAfter, error: undefined } },
      );
      await this.knowledgeBaseItemService.notifyDocumentExtractJobEnqueued(botId, String(kbRow._id), times, {
        alignTrainingStatusQueued: false,
      });
      return;
    }
    if (st === 'failed') {
      await this.extractJobModel.updateOne(
        { _id: (existingExtract as { _id: Types.ObjectId })._id },
        {
          $set: {
            status: 'queued',
            queuedAt: times.lastQueuedAt,
            runAfter: times.runAfter,
            error: undefined,
            extractAutoRetryCycles: 0,
            extractStuckRecoveryCycles: 0,
            startedAt: undefined,
            processingStartedAt: undefined,
            finishedAt: undefined,
          },
        },
      );
      await this.knowledgeBaseItemService.notifyDocumentExtractJobEnqueued(botId, String(kbRow._id), times, {
        alignTrainingStatusQueued: false,
      });
      return;
    }
    if (st === 'done') {
      // Extract finished: only queue embedding when the KB row is not already trained.
      // Note: `forceImmediateDue` only tightens schedule times above — it must NOT bypass this guard.
      // Callers that need to re-embed "ready" docs (Retrain) demote them to `queued` in `applyTrainNow` first.
      if (kbTrainNorm === 'ready') {
        return;
      }
      if (!shouldQueueDocumentTrainingPhase) {
        return;
      }
      await this.upsertQueuedDocumentTrainJob(botOid, kbRow._id as Types.ObjectId, {
        queuedAt: times.lastQueuedAt,
        runAfter: times.runAfter,
      });
      await this.knowledgeBaseItemService.markDocumentIngestionQueued(botId, String(kbRow._id), times, {
        setTrainingStatusQueued: true,
      });
      return;
    }

    /** Active extract — Retrain Agent must not interrupt; use {@link resetStuckJobs} for stale processing. */
    if (st === 'processing') {
      return;
    }
  }

  /**
   * At most one live document train job per KB item: refresh `runAfter` on existing queued, or create if none.
   * If a job is already `processing`, leave it alone (avoid fighting the worker).
   */
  private async upsertQueuedDocumentTrainJob(
    botOid: Types.ObjectId,
    knowledgeBaseItemOid: Types.ObjectId,
    times: { queuedAt: Date; runAfter: Date },
  ): Promise<void> {
    const processing = await this.trainJobModel
      .findOne({
        botId: botOid,
        kind: 'document',
        knowledgeBaseItemId: knowledgeBaseItemOid,
        status: 'processing',
      })
      .sort({ createdAt: -1 })
      .lean();
    if (processing) {
      return;
    }
    const embedSnap = await this.knowledgeBaseItemAccess.findDocumentLinkedKbStaleFields(
      String(botOid),
      String(knowledgeBaseItemOid),
    );
    // Collapse duplicate legacy/batched `queued` rows — then insert a single canonical job.
    await this.trainJobModel.deleteMany({
      botId: botOid,
      kind: 'document',
      knowledgeBaseItemId: knowledgeBaseItemOid,
      status: 'queued',
    });
    const created = await this.trainJobModel.create({
      botId: botOid,
      kind: 'document',
      knowledgeBaseItemId: knowledgeBaseItemOid,
      status: 'queued',
      queuedAt: times.queuedAt,
      runAfter: times.runAfter,
      queuedItems: 0,
      queuedCharacters: 0,
      documentEmbedTargetContentHash: embedSnap?.contentHash,
      documentEmbedTargetLastContentUpdatedAt: embedSnap?.lastContentUpdatedAt,
    });
    const kbAtQueue = await this.knowledgeBaseItemAccess.findKbDocumentItemByRouteId(
      String(botOid),
      String(knowledgeBaseItemOid),
    );
    const fpAtQueue =
      kbAtQueue != null
        ? documentKbContentFingerprint(kbAtQueue.title, String(kbAtQueue.content ?? ''))
        : null;
    kbTrainingLog('document TrainJob queued', {
      trainJobId: String((created as { _id: Types.ObjectId })._id),
      botId: String(botOid),
      knowledgeBaseItemId: String(knowledgeBaseItemOid),
      runAfter: times.runAfter.toISOString(),
      kbContentHashAtQueue: embedSnap?.contentHash ?? null,
      trainJobDocumentEmbedTargetContentHash: embedSnap?.contentHash ?? null,
      kbLastContentUpdatedAtAtQueue: embedSnap?.lastContentUpdatedAt?.toISOString?.() ?? null,
      kbTitleRaw: kbAtQueue?.title ?? null,
      kbTitleForRow: kbAtQueue != null ? normalizeKbDocumentTitleForRow(kbAtQueue.title) : null,
      kbContentLength: kbAtQueue?.content != null ? String(kbAtQueue.content).length : 0,
      fingerprintAtQueue: fpAtQueue,
      fingerprintMatchesQueueHash:
        fpAtQueue != null && embedSnap?.contentHash != null ? fpAtQueue === embedSnap.contentHash : null,
    });
  }

  /** Route filter for extract/train jobs targeting a document KB item. */
  private buildDocumentIngestRouteOr(kbRow: { _id: Types.ObjectId }): Record<string, unknown>[] {
    return [{ knowledgeBaseItemId: kbRow._id }];
  }

  /** True while an extract/train job is queued or processing for this document KB route. */
  private async documentIngestPipelineHasQueuedOrProcessing(
    botOid: Types.ObjectId,
    routeOr: Record<string, unknown>[],
  ): Promise<boolean> {
    const extractLive = await this.extractJobModel
      .findOne({
        botId: botOid,
        $or: routeOr,
        status: { $in: ['queued', 'processing'] },
      })
      .sort({ createdAt: -1 })
      .lean();
    if (extractLive) return true;
    const trainLive = await this.trainJobModel
      .findOne({
        botId: botOid,
        kind: 'document',
        $or: routeOr,
        status: { $in: ['queued', 'processing'] },
      })
      .sort({ createdAt: -1 })
      .lean();
    return Boolean(trainLive);
  }

  /**
   * Periodic sweep: orphaned KB `processing` before extraction, and eligible document rows lacking a viable
   * extract job (`ensureQueuedIngestJobForDocument`). Safe to skip when disabled via env.
   */
  async reconcileDocumentIngestState(): Promise<{ phantomFixed: number; extractEnsured: number }> {
    const disabled =
      process.env.KNOWLEDGE_INGEST_RECONCILER_DISABLED === 'true' ||
      process.env.KNOWLEDGE_INGEST_RECONCILER_DISABLED === '1' ||
      process.env.EXTRACT_INGEST_RECONCILER_DISABLED === 'true' ||
      process.env.EXTRACT_INGEST_RECONCILER_DISABLED === '1';
    if (disabled) {
      return { phantomFixed: 0, extractEnsured: 0 };
    }
    const raw =
      process.env.KNOWLEDGE_INGEST_RECONCILER_LIMIT ?? process.env.EXTRACT_INGEST_RECONCILER_LIMIT ?? '20';
    const cap = Math.max(1, Math.min(100, Math.floor(Number(raw)) || 20));
    let phantomFixed = 0;
    let extractEnsured = 0;
    let budget = cap;

    const phantomRows = await this.knowledgeBaseItemService.findDocumentKbRowsPhantomExtractProcessing(cap);
    for (const row of phantomRows) {
      if (budget <= 0) break;
      const botOid = row.botId;
      const routeOr = this.buildDocumentIngestRouteOr(row);
      if (await this.documentIngestPipelineHasQueuedOrProcessing(botOid, routeOr)) {
        continue;
      }
      await this.knowledgeBaseItemAccess.requeueStaleProcessingItemNow(row._id);
      await this.ensureQueuedIngestJobForDocument(String(botOid), String(row._id));
      phantomFixed += 1;
      budget -= 1;
    }

    const candidates = await this.knowledgeBaseItemService.findDocumentKbRowsForIngestReconcile(cap);
    for (const row of candidates) {
      if (budget <= 0) break;
      const effective = effectiveKbDocumentFileMetaLean(row as unknown as Record<string, unknown>);
      if (
        !kbRowEligibleForQueuedContentExtraction({
          isContentExtracted: row.isContentExtracted,
          content: row.content,
          fileMeta: effective,
        })
      ) {
        continue;
      }
      await this.ensureQueuedIngestJobForDocument(String(row.botId), String(row._id));
      extractEnsured += 1;
      budget -= 1;
    }

    return { phantomFixed, extractEnsured };
  }

  /**
   * Mark document KB rows that have no usable S3/HTTPS source (and no manual body) as `upload_failed`,
   * and terminate queued/processing extract + document train jobs for those routes.
   */
  async markDocumentKbRowsWithUnusableUploadSources(): Promise<{ marked: number }> {
    const disabled =
      process.env.KNOWLEDGE_UPLOAD_BAD_SOURCE_SWEEP_DISABLED === 'true' ||
      process.env.KNOWLEDGE_UPLOAD_BAD_SOURCE_SWEEP_DISABLED === '1';
    if (disabled) {
      return { marked: 0 };
    }
    const raw = process.env.KNOWLEDGE_UPLOAD_BAD_SOURCE_SWEEP_LIMIT ?? '25';
    const cap = Math.max(1, Math.min(100, Math.floor(Number(raw)) || 25));
    const rows = await this.knowledgeBaseItemService.findDocumentKbRowsForUploadSourceFailureSweep(cap);
    let marked = 0;
    const human = humanizeDocumentIngestFailureReason('file_url_missing');
    const now = new Date();
    for (const row of rows) {
      if (
        !shouldMarkDocumentKbUploadFailedForUnusableSource({
          isContentExtracted: row.isContentExtracted,
          content: row.content,
          fileMeta: row.fileMeta,
          file: row.file,
          sourceMeta: row.sourceMeta,
        })
      ) {
        continue;
      }
      const botId = String(row.botId);
      const routeId = String(row._id);
      await this.knowledgeBaseItemService.mergeDocumentKbFileMetaFields(botId, routeId, {
        uploadStatus: 'upload_failed',
      });
      await this.knowledgeBaseItemService.patchDocumentKbExtractionFailed(botId, routeId, human);
      await this.extractJobModel.updateMany(
        {
          botId,
          knowledgeBaseItemId: row._id,
          status: { $in: ['queued', 'processing'] as const },
        },
        { $set: { status: 'failed', error: human, finishedAt: now } },
      );
      await this.trainJobModel.updateMany(
        {
          botId,
          kind: 'document',
          knowledgeBaseItemId: row._id,
          status: { $in: ['queued', 'processing'] as const },
        },
        { $set: { status: 'failed', error: 'upload_source_unusable', finishedAt: now } },
      );
      marked += 1;
    }
    return { marked };
  }

  /**
   * Pull queued extract + document train jobs and scope train jobs forward to run immediately (`runAfter = now`).
   * Prefer **manual** lifecycle queues that still require instant due (e.g. overview “queue pending / retry failed”).
   * **Retrain Agent** uses spaced `runAfter` on rows/jobs instead of calling this helper.
   */
  async bumpQueuedIngestJobsImmediateForBot(botId: string): Promise<void> {
    if (!Types.ObjectId.isValid(botId)) return;
    const now = new Date();
    const botOid = new Types.ObjectId(botId);
    await Promise.all([
      this.extractJobModel.updateMany({ botId: botOid, status: 'queued' }, { $set: { queuedAt: now, runAfter: now } }),
      this.trainJobModel.updateMany(
        { botId: botOid, kind: 'document', status: 'queued' },
        { $set: { queuedAt: now, runAfter: now } },
      ),
      this.trainJobModel.updateMany(
        { botId: botOid, kind: 'scopes', status: 'queued' },
        { $set: { queuedAt: now, runAfter: now } },
      ),
    ]);
  }

  async ensureQueuedIngestJobsForDocumentIds(
    botId: string,
    documentIds: string[],
    opts?: { forceImmediateDue?: boolean },
  ): Promise<void> {
    for (const id of documentIds) {
      await this.ensureQueuedIngestJobForDocument(botId, id, { forceImmediateDue: opts?.forceImmediateDue === true });
    }
  }

  /**
   * Hard-deleted or deactivated document KB rows cannot run extraction; finish the job so the queue does not stall.
   */
  private async tryFinishExtractJobIfOrphanOrInactive(job: IngestRouteJobRef): Promise<boolean> {
    const botRow = await this.botModel.findById(job.botId).select('active deletedAt').lean();
    if (botIsEffectivelyDeleted(botRow as { active?: boolean; deletedAt?: Date | null })) {
      await this.finishIngestJobSkippedQuiet(job, 'kb_bot_deleted');
      return true;
    }
    const routeKey = job.knowledgeBaseItemId;
    if (!routeKey) return false;
    const botIdStr = String(job.botId);
    const row = await this.knowledgeBaseItemAccess.findKbDocumentItemByRouteIdAnyVisibility(
      botIdStr,
      String(routeKey),
    );
    if (!row) {
      kbTrainingLog('ExtractJob abandoned (KB row missing)', {
        extractJobId: String(job._id),
        botId: botIdStr,
        knowledgeBaseItemId: String(routeKey),
      });
      await this.finishIngestJobSkippedQuiet(job, 'kb_item_missing');
      return true;
    }
    if (knowledgeBaseItemIsEffectivelyDeleted(row as { deletedAt?: Date | null })) {
      await this.knowledgeBaseChunkService.removeDocumentKnowledgeChunksForDocument(botIdStr, String(routeKey));
      kbTrainingLog('ExtractJob abandoned (KB row inactive or deleted)', {
        extractJobId: String(job._id),
        botId: botIdStr,
        knowledgeBaseItemId: String(routeKey),
      });
      await this.finishIngestJobSkippedQuiet(job, 'kb_item_inactive');
      return true;
    }
    return false;
  }

  /**
   * Duplicate or stale queued `ExtractJob` while `KnowledgeBaseItem` already has extracted text — avoid a second
   * S3/URL fetch and align train queue like a normal successful extract.
   */
  private async tryFinishExtractJobIfAlreadyExtracted(job: IngestRouteJobRef): Promise<boolean> {
    const routeKey = job.knowledgeBaseItemId;
    if (!routeKey) return false;
    const botIdStr = String(job.botId);
    const kb = await this.knowledgeBaseItemAccess.findKbDocumentItemByRouteId(botIdStr, String(routeKey));
    if (!kb || kb.isContentExtracted !== true) return false;
    const body = (kb.content ?? '').trim();
    if (!body || !isTrainableExtractedDocumentText(body)) {
      kbTrainingLog('ExtractJob skipped (isContentExtracted but no trainable body)', {
        extractJobId: String(job._id),
        botId: botIdStr,
        knowledgeBaseItemId: String(routeKey),
      });
      const clearProc = normalizeKnowledgeTrainingStatus(String(kb.status ?? '')) === 'processing';
      await this.knowledgeBaseItemService.patchDocumentKbExtractionFailed(botIdStr, String(routeKey), 'kb_already_extracted_invalid_body', {
        clearContent: true,
      });
      await this.finishIngestJobSkippedQuiet(job, 'kb_already_extracted_invalid_body', {
        clearStuckProcessingForDoc: clearProc,
      });
      return true;
    }
    const shouldRun = await this.shouldRunDocumentTrainingPhase(botIdStr, kb.status);
    kbTrainingLog('ExtractJob finished without fetch (KB already extracted)', {
      extractJobId: String(job._id),
      botId: botIdStr,
      knowledgeBaseItemId: String(routeKey),
    });
    await this.markExtractJobDoneAndMaybeQueueTraining(job, {
      botIdStr,
      routeId: String(kb._id),
      kbOid: kb._id as Types.ObjectId,
      botOid: job.botId,
      shouldRunTrainingPhase: shouldRun,
    });
    return true;
  }

  private async markExtractJobDoneAndMaybeQueueTraining(
    job: IngestRouteJobRef,
    params: {
      botIdStr: string;
      routeId: string;
      kbOid: Types.ObjectId;
      botOid: Types.ObjectId;
      shouldRunTrainingPhase: boolean;
    },
  ): Promise<void> {
    const finishedAt = new Date();
    const { botIdStr, routeId, kbOid, botOid, shouldRunTrainingPhase } = params;
    if (!shouldRunTrainingPhase) {
      await this.knowledgeBaseItemService.setDocumentKnowledgeItemStatus(botIdStr, routeId, { status: 'pending' });
      await this.extractJobModel.updateOne(
        { _id: job._id },
        { $set: { status: 'done', finishedAt, error: undefined, extractAutoRetryCycles: 0, extractStuckRecoveryCycles: 0 } },
      );
      return;
    }
    await this.extractJobModel.updateOne(
      { _id: job._id },
      { $set: { status: 'done', finishedAt, error: undefined, extractAutoRetryCycles: 0, extractStuckRecoveryCycles: 0 } },
    );
    await this.upsertQueuedDocumentTrainJob(botOid, kbOid, {
      queuedAt: finishedAt,
      runAfter: finishedAt,
    });
    await this.knowledgeBaseItemService.markDocumentIngestionQueued(botIdStr, routeId, {
      lastQueuedAt: finishedAt,
      runAfter: finishedAt,
    });
  }

  /**
   * True when file/url exists on the KB row (or inline body), and extraction is still pending — same shape as {@link processJob}.
   */
  private async isQueuedExtractJobReadyToClaim(job: IngestRouteJobRef): Promise<boolean> {
    const botId = String(job.botId);
    const routeKey = job.knowledgeBaseItemId;
    if (!routeKey) return false;
    const kb = await this.knowledgeBaseItemAccess.findKbDocumentItemByRouteId(botId, String(routeKey));
    if (!kb) return false;
    return kbRowEligibleForQueuedContentExtraction({
      isContentExtracted: kb.isContentExtracted,
      content: kb.content,
      fileMeta: effectiveKbDocumentFileMetaLean(kb as unknown as Record<string, unknown>),
    });
  }

  /**
   * Claim one queued content-extraction job whose KB row is uploaded (or has inline body) with
   * `isContentExtracted !== true` — avoids locking the pipeline while multipart upload is completing.
   * Scans the next oldest jobs up to `EXTRACT_JOB_CLAIM_LOOKAHEAD` (env, default 40) per tick.
   *
   * Concurrency: each candidate uses `findOneAndUpdate({ _id, status: 'queued', due runAfter }, …)` so a job that is
   * not yet due or already claimed by another worker cannot transition to `processing`.
   * Only the first worker wins; others get `null` for that id — same job is never processed twice.
   */
  async claimQueuedJob(): Promise<IngestRouteJobRef | null> {
    const now = new Date();
    const dueOr = extractJobDueRunAfterClause(now);
    const parsed = Number(process.env.EXTRACT_JOB_CLAIM_LOOKAHEAD ?? '40');
    const lookahead = Math.max(5, Math.min(100, (Number.isFinite(parsed) ? Math.floor(parsed) : 40) || 40));

    const batch = await this.extractJobModel
      .find({
        status: 'queued',
        $or: dueOr,
      })
      .sort({ runAfter: 1, createdAt: 1 })
      .limit(lookahead)
      .lean();

    for (const raw of batch) {
      const job = raw as unknown as IngestRouteJobRef;
      if (await this.tryFinishExtractJobIfOrphanOrInactive(job)) continue;
      if (await this.tryFinishExtractJobIfAlreadyExtracted(job)) continue;
      if (!(await this.isQueuedExtractJobReadyToClaim(job))) continue;
      const startedAt = new Date();
      const claimed = await this.extractJobModel.findOneAndUpdate(
        { _id: job._id, status: 'queued', $or: dueOr },
        {
          $set: {
            status: 'processing',
            startedAt,
            processingStartedAt: startedAt,
            error: undefined,
          },
        },
        { new: true },
      );
      if (claimed) {
        const rid = (claimed as { knowledgeBaseItemId?: Types.ObjectId }).knowledgeBaseItemId;
        if (rid) {
          await this.knowledgeBaseItemService.setDocumentKbExtractionProcessing(String(claimed.botId), String(rid));
        }
        kbTrainingLog('ExtractJob claimed', {
          extractJobId: String(claimed._id),
          botId: String(claimed.botId),
          knowledgeBaseItemId: rid ? String(rid) : undefined,
        });
      }
      if (claimed) return claimed as unknown as IngestRouteJobRef;
    }

    return null;
  }

  /** Fire-and-forget: claim + run extraction for a known job id (same path as cron). */
  scheduleImmediateExtractAfterCreate(jobMongoId: string): void {
    const workerOn = this.config.get<boolean>('enableKbWorker') === true;
    const disabled =
      process.env.EXTRACT_JOB_IMMEDIATE_ON_UPLOAD === 'false' || process.env.EXTRACT_JOB_IMMEDIATE_ON_UPLOAD === '0';
    if (!workerOn || disabled) return;
    setImmediate(() => {
      void (async () => {
        try {
          const claimed = await this.tryClaimQueuedExtractJobById(jobMongoId);
          if (!claimed) return;
          try {
            await this.processJob(claimed);
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'ingestion_failed';
            await this.markJobFailed(claimed, message);
          }
        } catch {
          /* ignore defer fire-and-forget */
        }
      })();
    });
  }

  /**
   * Atomically claim one queued extraction job when `_id` and due window match (for immediate post-upload run).
   */
  async tryClaimQueuedExtractJobById(jobMongoId: string): Promise<IngestRouteJobRef | null> {
    if (!Types.ObjectId.isValid(jobMongoId)) return null;
    const _id = new Types.ObjectId(jobMongoId);
    const now = new Date();
    const dueOr = extractJobDueRunAfterClause(now);
    const raw = await this.extractJobModel.findOne({ _id, status: 'queued', $or: dueOr }).lean();
    if (!raw) return null;
    const job = raw as unknown as IngestRouteJobRef;
    if (await this.tryFinishExtractJobIfOrphanOrInactive(job)) return null;
    if (await this.tryFinishExtractJobIfAlreadyExtracted(job)) return null;
    if (!(await this.isQueuedExtractJobReadyToClaim(job))) return null;
    const startedAt = new Date();
    const claimed = await this.extractJobModel.findOneAndUpdate(
      { _id, status: 'queued', $or: dueOr },
      {
        $set: {
          status: 'processing',
          startedAt,
          processingStartedAt: startedAt,
          error: undefined,
        },
      },
      { new: true },
    );
    if (claimed) {
      const rid = (claimed as { knowledgeBaseItemId?: Types.ObjectId }).knowledgeBaseItemId;
      if (rid) {
        await this.knowledgeBaseItemService.setDocumentKbExtractionProcessing(String(claimed.botId), String(rid));
      }
    }
    return claimed ? (claimed as unknown as IngestRouteJobRef) : null;
  }

  /** After automatic retries exhausted, resets cycles and queues again; then tries immediate extract. */
  async manualRetryExtractJob(botId: string, routeId: string): Promise<{ ok: boolean }> {
    if (!Types.ObjectId.isValid(botId) || !Types.ObjectId.isValid(routeId)) return { ok: false };
    const botOid = new Types.ObjectId(botId);
    const rid = new Types.ObjectId(routeId);
    const routeOr = [{ knowledgeBaseItemId: rid }] as Record<string, unknown>[];
    const latest = await this.extractJobModel
      .findOne({ botId: botOid, $or: routeOr })
      .sort({ createdAt: -1 })
      .lean();
    const now = new Date();
    if (!latest) {
      await this.ensureQueuedIngestJobForDocument(botId, routeId);
      const created = await this.extractJobModel
        .findOne({ botId: botOid, $or: routeOr })
        .sort({ createdAt: -1 })
        .select('_id')
        .lean();
      const nid = created ? String((created as { _id: Types.ObjectId })._id) : '';
      if (nid) this.scheduleImmediateExtractAfterCreate(nid);
      return { ok: true };
    }
    const ingestTimes = await this.knowledgeBaseItemService.getIngestQueueTimesForDocument(botId, routeId, now);
    const jid = String((latest as { _id: Types.ObjectId })._id);
    await this.extractJobModel.updateOne(
      { _id: (latest as { _id: Types.ObjectId })._id },
      {
        $set: {
          status: 'queued',
          queuedAt: ingestTimes.lastQueuedAt,
          runAfter: ingestTimes.runAfter,
          extractAutoRetryCycles: 0,
          extractStuckRecoveryCycles: 0,
          error: undefined,
          startedAt: undefined,
          processingStartedAt: undefined,
          finishedAt: undefined,
        },
      },
    );
    const kbRow = await this.knowledgeBaseItemAccess.findKbDocumentItemByRouteId(botId, routeId);
    if (kbRow) {
      await this.knowledgeBaseItemService.notifyDocumentExtractJobEnqueued(botId, String(kbRow._id), {
        lastQueuedAt: ingestTimes.lastQueuedAt,
        runAfter: ingestTimes.runAfter,
      }, {
        alignTrainingStatusQueued: false,
      });
    }
    this.scheduleImmediateExtractAfterCreate(jid);
    return { ok: true };
  }

  /**
   * Customer-facing stuck recovery for one document KB item: re-queue its `processing` {@link ExtractJob} when older than
   * {@link INGESTION_STUCK_TIMEOUT_MINUTES}. Same rules as {@link resetStuckJobs} (orphan/inactive routes finish the job).
   */
  async manualResetStuckExtractForKnowledgeItem(botId: string, routeId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(botId) || !Types.ObjectId.isValid(routeId)) return false;
    const timeoutMinutes = Math.max(1, INGESTION_STUCK_TIMEOUT_MINUTES);
    const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000);
    const botOid = new Types.ObjectId(botId);
    const kbOid = new Types.ObjectId(routeId);
    const job = await this.extractJobModel
      .findOne({
        botId: botOid,
        knowledgeBaseItemId: kbOid,
        ...mongoExtractProcessingJobStaleCriteria(cutoff),
      })
      .sort({ createdAt: -1 })
      .lean();
    if (!job) return false;

    const finishedAt = new Date();
    const kbId = (job as { knowledgeBaseItemId?: Types.ObjectId }).knowledgeBaseItemId;
    if (!kbId) {
      await this.extractJobModel.updateOne(
        { _id: job._id },
        {
          $set: {
            status: 'done',
            finishedAt,
            error: 'skipped:orphan_stuck_reset',
          },
          $unset: { startedAt: 1, processingStartedAt: 1 },
        },
      );
      return true;
    }
    const kbState = await this.knowledgeBaseItemAccess.getDocumentKbRouteStuckRecoverState(String(job.botId), String(kbId));
    if (kbState === 'missing') {
      await this.extractJobModel.updateOne(
        { _id: job._id },
        {
          $set: {
            status: 'done',
            finishedAt,
            error: 'skipped:document_missing_stuck_reset',
          },
          $unset: { startedAt: 1, processingStartedAt: 1 },
        },
      );
      return true;
    }
    if (kbState === 'inactive') {
      await this.extractJobModel.updateOne(
        { _id: job._id },
        {
          $set: {
            status: 'done',
            finishedAt,
            error: 'skipped:kb_inactive_stuck_reset',
          },
          $unset: { startedAt: 1, processingStartedAt: 1 },
        },
      );
      return true;
    }
    const sr = (job as { extractStuckRecoveryCycles?: number }).extractStuckRecoveryCycles ?? 0;
    if (sr >= EXTRACT_JOB_MAX_STUCK_RECOVERIES) {
      const exhaustedAt = new Date();
      await this.extractJobModel.updateOne(
        { _id: job._id },
        {
          $set: {
            status: 'failed',
            finishedAt: exhaustedAt,
            error: STUCK_RECOVERY_LIMIT_JOB_ERROR,
          },
          $unset: {
            startedAt: 1,
            processingStartedAt: 1,
          },
        },
      );
      await this.knowledgeBaseItemService.patchDocumentKbExtractionFailed(
        String(job.botId),
        String(kbId),
        STUCK_RECOVERY_LIMIT_EXTRACTION_CUSTOMER_MESSAGE,
      );
      await this.knowledgeStatsService.recalculateKnowledgeStatsForBot(String(job.botId));
      return true;
    }

    const requeuedAt = new Date();
    const nextSr = sr + 1;
    await this.extractJobModel.updateOne(
      { _id: job._id },
      {
        $set: {
          status: 'queued',
          error: undefined,
          queuedAt: requeuedAt,
          runAfter: requeuedAt,
          extractStuckRecoveryCycles: nextSr,
        },
        $unset: {
          startedAt: 1,
          processingStartedAt: 1,
          finishedAt: 1,
        },
      },
    );
    await this.knowledgeBaseItemService.notifyDocumentExtractJobEnqueued(String(job.botId), String(kbId), {
      lastQueuedAt: requeuedAt,
      runAfter: requeuedAt,
    }, {
      alignTrainingStatusQueued: false,
    });
    await this.knowledgeStatsService.recalculateKnowledgeStatsForBot(String(job.botId));
    this.scheduleImmediateExtractAfterCreate(String(job._id));
    return true;
  }

  /**
   * Move failed extraction jobs back to queued when automatic retries remain and backoff elapsed.
   * @returns number re-queued this call
   */
  async requeueEligibleFailedExtractJobs(batchLimit = 25): Promise<number> {
    const max = resolveExtractJobMaxAutoRetries();
    if (max <= 0) return 0;
    const now = new Date();
    const dueOr = extractJobDueRunAfterClause(now);
    const candidates = await this.extractJobModel
      .find({
        status: 'failed',
        extractAutoRetryCycles: { $lt: max },
        $or: dueOr,
      })
      .sort({ runAfter: 1, createdAt: 1 })
      .limit(Math.max(5, Math.min(100, Math.floor(Number(batchLimit)) || 25)))
      .lean();

    let moved = 0;
    for (const raw of candidates) {
      const job = raw as unknown as IngestRouteJobRef;
      if (await this.tryFinishExtractJobIfOrphanOrInactive(job)) continue;
      if (await this.tryFinishExtractJobIfAlreadyExtracted(job)) continue;
      if (!(await this.isQueuedExtractJobReadyToClaim(job))) continue;
      const requeuedAt = new Date();
      const res = await this.extractJobModel.findOneAndUpdate(
        {
          _id: job._id,
          status: 'failed',
          extractAutoRetryCycles: { $lt: max },
          $or: dueOr,
        },
        {
          $set: {
            status: 'queued',
            queuedAt: requeuedAt,
            runAfter: requeuedAt,
            error: undefined,
            startedAt: undefined,
            processingStartedAt: undefined,
            finishedAt: undefined,
          },
          $inc: { extractAutoRetryCycles: 1 },
        },
        { new: true },
      );
      if (!res) continue;
      const routeId = this.ingestTrainingRouteId(job);
      if (routeId) {
        await this.knowledgeBaseItemService.notifyDocumentExtractJobEnqueued(String(job.botId), routeId, {
          lastQueuedAt: requeuedAt,
          runAfter: requeuedAt,
        }, {
          alignTrainingStatusQueued: false,
        });
      }
      moved += 1;
    }
    return moved;
  }

  private ingestTrainingRouteId(job: IngestRouteJobRef): string | null {
    const x = job.knowledgeBaseItemId;
    return x ? String(x) : null;
  }

  /** Job finished safely without mutating KB chunks (race with delete/update). */
  private async finishIngestJobSkippedQuiet(
    job: IngestRouteJobRef,
    reason: string,
    opts?: { requeueDocument?: boolean; clearStuckProcessingForDoc?: boolean },
  ): Promise<void> {
    const finishedAt = new Date();
    await this.extractJobModel.updateOne(
      { _id: job._id },
      { $set: { status: 'done', finishedAt, error: `skipped:${reason}`, extractAutoRetryCycles: 0, extractStuckRecoveryCycles: 0 } },
    );
    const routeId = this.ingestTrainingRouteId(job);
    if (
      opts?.clearStuckProcessingForDoc &&
      reason !== 'document_missing' &&
      reason !== 'orphan_claim' &&
      routeId
    ) {
      await this.maybeClearProcessingDocumentBecauseSkipped(String(job.botId), routeId);
    }
    if (opts?.requeueDocument && routeId) {
      const delayParsed = Number(process.env.INGEST_SKIP_REQUEUE_DELAY_MS);
      const staleLike = reason.startsWith('stale_') || reason === 'kb_item_missing';
      const minDelayMs = staleLike
        ? Math.max(Number.isFinite(delayParsed) && delayParsed >= 1000 ? delayParsed : 12_000, 3_000)
        : 0;
      kbTrainingLog('ingest requeue-after-skip', {
        botId: String(job.botId),
        routeId,
        reason,
        minDelayMs,
      });
      await this.ensureQueuedIngestJobForDocument(String(job.botId), routeId, {
        minDelayMs,
      });
    }
  }

  private async maybeClearProcessingDocumentBecauseSkipped(botId: string, docId: string): Promise<void> {
    if (!Types.ObjectId.isValid(botId) || !Types.ObjectId.isValid(docId)) return;
    const snap = await this.knowledgeBaseItemAccess.findDocumentLinkedKbStaleFields(botId, docId);
    if (!snap || snap.status !== 'processing') return;
    await this.knowledgeBaseItemService.setDocumentKnowledgeItemStatus(botId, docId, { status: 'queued' });
  }

  /** After shouldSkip verdict (pre-chunk-write). */
  private async finishDocumentIngestAfterSkipVerdict(
    job: IngestRouteJobRef,
    verdict: {
      skip: true;
      reason: string;
      requeueLater: boolean;
      clearStuckProcessing: boolean;
    },
  ): Promise<void> {
    await this.finishIngestJobSkippedQuiet(job, verdict.reason, {
      requeueDocument: verdict.requeueLater,
      clearStuckProcessingForDoc: verdict.clearStuckProcessing,
    });
  }

  private documentTrainRouteId(job: DocumentTrainRouteRef): string | null {
    const x = job.knowledgeBaseItemId;
    return x ? String(x) : null;
  }

  /**
   * Too many stale-skip finishes for the same document route — stop requeue churn (counts **prior** `done` jobs only).
   */
  private async documentTrainStaleRequeueWouldLoop(botIdStr: string, routeId: string, reason: string): Promise<boolean> {
    const staleLike = reason.startsWith('stale_') || reason === 'kb_item_missing';
    if (!staleLike) return false;
    const windowMsRaw = Number(process.env.DOCUMENT_TRAIN_STALE_LOOP_WINDOW_MS);
    const windowMs =
      Number.isFinite(windowMsRaw) && windowMsRaw >= 60_000
        ? Math.min(windowMsRaw, 60 * 60_000)
        : 20 * 60_000;
    const since = new Date(Date.now() - windowMs);
    const prior = await this.trainJobModel.countDocuments({
      botId: new Types.ObjectId(botIdStr),
      kind: 'document',
      knowledgeBaseItemId: new Types.ObjectId(routeId),
      status: 'done',
      finishedAt: { $gte: since },
      $or: [{ error: { $regex: /^skipped:stale_/ } }, { error: 'skipped:kb_item_missing' }],
    });
    const thrRaw = Number(process.env.DOCUMENT_TRAIN_STALE_LOOP_THRESHOLD);
    const threshold =
      Number.isFinite(thrRaw) && thrRaw >= 1 ? Math.min(Math.floor(thrRaw), 20) : 2;
    return prior >= threshold;
  }

  /**
   * After the train-job cron catches an error from {@link processDocumentTrainJob}, `TrainJob` is
   * marked `failed` but the document KB item is often still `queued`. Sync so the workspace is not stuck misleadingly.
   */
  async reflectDocumentTrainJobCatchFailure(job: DocumentTrainRouteRef, errorMessage: string): Promise<void> {
    const routeId = this.documentTrainRouteId(job);
    if (!routeId) return;
    const msg = errorMessage.trim().slice(0, 2000) || 'knowledge_training_failed';
    await this.knowledgeBaseItemService.setDocumentKnowledgeItemStatus(String(job.botId), routeId, {
      status: 'failed',
      failureReason: msg,
    });
  }

  private async finishTrainJobSkippedQuiet(
    job: DocumentTrainRouteRef,
    reason: string,
    opts?: { requeueDocument?: boolean; clearStuckProcessingForDoc?: boolean },
  ): Promise<void> {
    const finishedAt = new Date();
    await this.trainJobModel.updateOne(
      { _id: job._id },
      { $set: { status: 'done', finishedAt, error: `skipped:${reason}` } },
    );
    const routeId = this.documentTrainRouteId(job);
    if (
      opts?.clearStuckProcessingForDoc &&
      reason !== 'document_missing' &&
      reason !== 'orphan_claim' &&
      routeId
    ) {
      await this.maybeClearProcessingDocumentBecauseSkipped(String(job.botId), routeId);
    }
    if (opts?.requeueDocument && routeId) {
      if (await this.documentTrainStaleRequeueWouldLoop(String(job.botId), routeId, reason)) {
        kbTrainingLog('document TrainJob stale requeue suppressed (loop guard)', {
          trainJobId: String(job._id),
          botId: String(job.botId),
          knowledgeBaseItemId: routeId,
          reason,
        });
        await this.knowledgeBaseItemService.setDocumentKnowledgeItemStatus(String(job.botId), routeId, {
          status: 'failed',
          failureReason: 'stale_document_text_loop',
        });
        return;
      }
      const delayParsed = Number(process.env.INGEST_SKIP_REQUEUE_DELAY_MS);
      const staleLike = reason.startsWith('stale_') || reason === 'kb_item_missing';
      const minDelayMs = staleLike
        ? Math.max(Number.isFinite(delayParsed) && delayParsed >= 1000 ? delayParsed : 12_000, 3_000)
        : 0;
      kbTrainingLog('train requeue-after-skip', {
        botId: String(job.botId),
        routeId,
        reason,
        minDelayMs,
      });
      kbTrainingLog('document TrainJob requeue-after-stale-skip (ensureQueuedIngestJobForDocument)', {
        trainJobId: String(job._id),
        botId: String(job.botId),
        knowledgeBaseItemId: routeId,
        reason,
        minDelayMs,
      });
      await this.ensureQueuedIngestJobForDocument(String(job.botId), routeId, {
        minDelayMs,
      });
    }
  }

  private async finishDocumentTrainAfterSkipVerdict(
    job: DocumentTrainRouteRef,
    verdict: {
      skip: true;
      reason: string;
      requeueLater: boolean;
      clearStuckProcessing: boolean;
    },
  ): Promise<void> {
    await this.finishTrainJobSkippedQuiet(job, verdict.reason, {
      requeueDocument: verdict.requeueLater,
      clearStuckProcessingForDoc: verdict.clearStuckProcessing,
    });
    const routeId = this.documentTrainRouteId(job);
    if (verdict.reason === 'stale_document_text' && !verdict.requeueLater && routeId) {
      await this.knowledgeBaseItemService.setDocumentKnowledgeItemStatus(String(job.botId), routeId, {
        status: 'failed',
        failureReason: 'stale_document_text',
      });
    }
  }

  /** Claimed job: always resolves the `KnowledgeBaseItem` document row and runs KB-native extraction. */
  async processJob(job: IngestRouteJobRef): Promise<'completed' | 'skipped'> {
    const botIdStr = String(job.botId);
    const routeKey = job.knowledgeBaseItemId;
    if (!routeKey) {
      await this.finishIngestJobSkippedQuiet(job, 'orphan_claim');
      return 'skipped';
    }
    const botRow = await this.botModel.findById(job.botId).select('active deletedAt').lean();
    if (botIsEffectivelyDeleted(botRow as { active?: boolean; deletedAt?: Date | null })) {
      await this.finishIngestJobSkippedQuiet(job, 'kb_bot_deleted');
      return 'skipped';
    }
    const kb = await this.knowledgeBaseItemAccess.findKbDocumentItemByRouteId(botIdStr, String(routeKey));
    if (!kb) {
      await this.finishIngestJobSkippedQuiet(job, 'document_missing');
      return 'skipped';
    }
    return this.processKbOnlyDocumentIngest(job, kb);
  }

  /** KB-native document extraction (S3, https URL, or inline body on the KB item). */
  private async processKbOnlyDocumentIngest(
    job: IngestRouteJobRef,
    kb: NonNullable<Awaited<ReturnType<KnowledgeBaseItemAccessService['findKbDocumentItemByRouteId']>>>,
  ): Promise<'completed' | 'skipped'> {
    const routeId = String(kb._id);
    const botIdStr = String(job.botId);
    await this.knowledgeBaseItemService.repairDocumentKbContentHashIfDrifted(botIdStr, routeId);
    const kbRow =
      (await this.knowledgeBaseItemAccess.findKbDocumentItemByRouteId(botIdStr, routeId)) ?? null;
    if (!kbRow) {
      await this.finishIngestJobSkippedQuiet(job, 'kb_item_deleted');
      return 'skipped';
    }
    const shouldRunTrainingPhase = await this.shouldRunDocumentTrainingPhase(botIdStr, kbRow.status);
    const extractSnapshot: DocumentKbStaleSnapshot = {
      kbContentHash: String(kbRow.contentHash ?? ''),
      kbLastContentUpdatedAt: kbRow.lastContentUpdatedAt ?? null,
    };
    kbTrainingLog('processKbOnly start', { routeId, extractJobId: String(job._id) });
    // Text extraction is tracked on `ExtractJob` + `isContentExtracted` — KB `status` is the **training** lifecycle only.
    // `KnowledgeBaseItem.active === false` only excludes replies/RAG — extraction and embedding still run.

    const priorTrainableEarly = normalizeKbDocumentBodyForHash(String(kbRow.content ?? ''));
    if (
      kbRow.isContentExtracted === true &&
      priorTrainableEarly &&
      isTrainableExtractedDocumentText(priorTrainableEarly)
    ) {
      kbTrainingLog('document extraction skipped (content already on KB; no S3/URL fetch)', {
        extractJobId: String(job._id),
        routeId,
        botId: botIdStr,
      });
      await this.markExtractJobDoneAndMaybeQueueTraining(job, {
        botIdStr,
        routeId,
        kbOid: kbRow._id as Types.ObjectId,
        botOid: job.botId,
        shouldRunTrainingPhase,
      });
      return 'completed';
    }

    const fm = effectiveKbDocumentFileMetaLean(kbRow as unknown as Record<string, unknown>);
    const s3Bucket = fm.storageBucket;
    const s3Key = fm.storageKey;
    const fileName = fm.originalName;
    const fileType = fm.mimeType;
    const url = fm.url;

    let textToChunk: string;
    let extractionSource: 'inline' | 's3' | 'url';
    const prior = normalizeKbDocumentBodyForHash(String(kbRow.content ?? ''));
    if (prior) {
      extractionSource = 'inline';
      textToChunk = prior;
    } else if (s3Bucket && s3Key) {
      extractionSource = 's3';
      const buffer = await getObjectBody(s3Bucket, s3Key);
      const ext = this.kbService.getFileExtension(fileName || '') || 'bin';
      const fn = fileName || `doc.${ext}`;
      const fp = path.join(os.tmpdir(), `ingest-kb-${routeId}-${Date.now()}.${ext}`);
      await fs.writeFile(fp, buffer);
      try {
        const extractionResult = await this.kbService.extractTextFromUpload({
          filePath: fp,
          fileName: fn,
          fileType: fileType || undefined,
        });
        if (!extractionResult.extracted || !extractionResult.text.trim()) {
          throw new Error(extractionResult.reason || 'extraction_failed');
        }
        textToChunk = extractionResult.text;
      } finally {
        await fs.unlink(fp).catch(() => {});
      }
    } else if (url) {
      extractionSource = 'url';
      const urlStr = String(url).trim();
      if (urlStr.startsWith('http://') || urlStr.startsWith('https://')) {
        const res = await fetch(urlStr, { redirect: 'follow' });
        if (!res.ok) throw new Error(`url_fetch_failed: ${res.status}`);
        const buffer = Buffer.from(await res.arrayBuffer());
        const urlPathname = new URL(urlStr).pathname || '';
        const baseName = path.basename(urlPathname) || 'document';
        const ext = this.kbService.getFileExtension(baseName) || path.extname(urlPathname).slice(1) || 'bin';
        const fn = fileName || baseName;
        const fp = path.join(os.tmpdir(), `ingest-kb-${routeId}-${Date.now()}.${ext}`);
        await fs.writeFile(fp, buffer);
        try {
          const extractionResult = await this.kbService.extractTextFromUpload({
            filePath: fp,
            fileName: fn,
            fileType: fileType || res.headers.get('content-type') || undefined,
          });
          if (!extractionResult.extracted || !extractionResult.text.trim()) {
            throw new Error(extractionResult.reason || 'extraction_failed');
          }
          textToChunk = extractionResult.text;
        } finally {
          await fs.unlink(fp).catch(() => {});
        }
      } else {
        throw new Error('file_url_missing');
      }
    } else {
      throw new Error('file_url_missing');
    }

    textToChunk = normalizeKbDocumentBodyForHash(String(textToChunk ?? ''));
    if (!textToChunk || !isTrainableExtractedDocumentText(textToChunk)) {
      throw new Error('No readable text found');
    }

    const kbBeforePersist = await this.knowledgeBaseItemAccess.findKbDocumentItemByRouteId(botIdStr, routeId);
    if (!kbBeforePersist) {
      await this.finishIngestJobSkippedQuiet(job, 'kb_item_deleted');
      return 'skipped';
    }

    const botMid = await this.botModel.findById(job.botId).select('active deletedAt').lean();
    if (botIsEffectivelyDeleted(botMid as { active?: boolean; deletedAt?: Date | null })) {
      await this.finishIngestJobSkippedQuiet(job, 'kb_bot_deleted');
      return 'skipped';
    }
    const extractionPrePersistVerdict = shouldSkipDocumentKnowledgeChunkWrite(
      {
        title: kbBeforePersist.title,
        text: normalizeKbDocumentBodyForHash(String(kbBeforePersist.content ?? '')),
        active: true,
      },
      {
        active: kbBeforePersist.active,
        contentHash: kbBeforePersist.contentHash,
        lastContentUpdatedAt: kbBeforePersist.lastContentUpdatedAt ?? null,
      },
      extractSnapshot,
    );
    if (extractionPrePersistVerdict.skip) {
      kbTrainingLog('ExtractJob stale guard (pre-persist)', {
        extractJobId: String(job._id),
        botId: botIdStr,
        knowledgeBaseItemId: routeId,
        reason: extractionPrePersistVerdict.reason,
        requeueLater: extractionPrePersistVerdict.requeueLater,
        snapshotKbContentHash: extractSnapshot.kbContentHash,
        snapshotKbLastContentUpdatedAt: extractSnapshot.kbLastContentUpdatedAt
          ? new Date(extractSnapshot.kbLastContentUpdatedAt).toISOString()
          : null,
        currentKbContentHash: kbBeforePersist.contentHash ?? null,
        currentKbLastContentUpdatedAt: kbBeforePersist.lastContentUpdatedAt
          ? new Date(kbBeforePersist.lastContentUpdatedAt).toISOString()
          : null,
      });
      await this.finishDocumentIngestAfterSkipVerdict(job, extractionPrePersistVerdict);
      return 'skipped';
    }

    const trainingAfterExtract = (await this.shouldRunDocumentTrainingPhase(botIdStr, kbBeforePersist.status))
      ? ('queued' as const)
      : ('pending' as const);
    return await this.runDocumentExtractPersistSerialized(botIdStr, async () => {
      try {
        await this.knowledgeBaseItemService.upsertDocumentKnowledgeItem({
          _id: kbBeforePersist._id,
          botId: kbBeforePersist.botId,
          title: normalizeKbDocumentTitleForRow(kbBeforePersist.title),
          trainingStatus: trainingAfterExtract,
          active: kbBeforePersist.active !== false,
          text: textToChunk,
          fileName,
          fileType,
          fileSize: fm.sizeBytes,
          url,
          storage: fm.storage ?? 's3',
          s3Bucket,
          s3Key,
          uploadSessionId: fm.uploadSessionId,
        });
      } catch (err: unknown) {
        if (isPlanLimitBotKbTotalHttpException(err)) {
          kbTrainingLog('document extraction blocked by bot KB total limit', {
            routeId,
            botId: botIdStr,
            extractJobId: String(job._id),
          });
          await this.knowledgeBaseItemService.persistDocumentKbExtractedBotKbLimitExceeded(botIdStr, routeId, {
            _id: kbBeforePersist._id,
            botId: kbBeforePersist.botId,
            title: normalizeKbDocumentTitleForRow(kbBeforePersist.title),
            text: textToChunk,
            fileName,
            fileType,
            fileSize: fm.sizeBytes,
            url,
            storage: fm.storage ?? 's3',
            s3Bucket,
            s3Key,
            uploadSessionId: fm.uploadSessionId,
          });
          await this.extractJobModel.updateOne(
            { _id: job._id },
            {
              $set: {
                status: 'done',
                finishedAt: new Date(),
                error: PLAN_LIMIT_BOT_KB_TOTAL_MESSAGE,
              },
            },
          );
          return 'completed' as const;
        }
        throw err;
      }

      const snapAfterExtract = await this.knowledgeBaseItemAccess.findDocumentLinkedKbStaleFields(botIdStr, routeId);
      kbTrainingLog('document extraction persisted', {
        routeId,
        botId: botIdStr,
        extractJobId: String(job._id),
        source: extractionSource,
        extractedTextLength: textToChunk.length,
        contentHash: snapAfterExtract?.contentHash ?? '',
      });

      const extractedLength = textToChunk.length;
      if (process.env.NODE_ENV !== 'production') {
        const preview = textToChunk.slice(0, 200).replace(/\s+/g, ' ');
        console.log(
          `[ingestion] processKbOnly routeId=${routeId} extractedTextLength=${extractedLength} preview=${JSON.stringify(preview)}`,
        );
      } else {
        console.log(`[ingestion] processKbOnly routeId=${routeId} extractedTextLength=${extractedLength}`);
      }

      await this.markExtractJobDoneAndMaybeQueueTraining(job, {
        botIdStr,
        routeId,
        kbOid: kbRow._id as Types.ObjectId,
        botOid: job.botId,
        shouldRunTrainingPhase,
      });
      return 'completed' as const;
    });
  }

  /**
   * Chunk + embed + KB ready for a document (after extract text is on the KB item).
   * Invoked by the train-job worker for `knowledge_base_training_jobs` with `kind: 'document'`.
   */
  async processDocumentTrainJob(job: DocumentTrainRouteRef): Promise<void> {
    const routeId = this.documentTrainRouteId(job);
    if (!routeId) {
      await this.trainJobModel.updateOne(
        { _id: job._id },
        { $set: { status: 'failed', error: 'orphan_claim', finishedAt: new Date() } },
      );
      return;
    }
    const botIdStr = String(job.botId);
    const botRowEarly = await this.botModel.findById(job.botId).select('active deletedAt').lean();
    if (botIsEffectivelyDeleted(botRowEarly as { active?: boolean; deletedAt?: Date | null })) {
      await this.finishTrainJobSkippedQuiet(job, 'kb_bot_deleted', { clearStuckProcessingForDoc: true });
      return;
    }
    await this.knowledgeBaseItemService.repairDocumentKbContentHashIfDrifted(botIdStr, routeId);
    const kb = await this.knowledgeBaseItemAccess.findKbDocumentItemByRouteId(botIdStr, routeId);
    if (!kb) {
      await this.trainJobModel.updateOne(
        { _id: job._id },
        { $set: { status: 'failed', error: 'document_missing', finishedAt: new Date() } },
      );
      return;
    }

    const textToChunk = normalizeKbDocumentBodyForHash(String(kb.content ?? ''));
    const exRaw = String((kb as { extractionStatus?: string }).extractionStatus ?? '').trim();
    const extractionOk =
      exRaw === 'done' &&
      kb.isContentExtracted === true &&
      Boolean(textToChunk) &&
      isTrainableExtractedDocumentText(textToChunk);
    if (!extractionOk) {
      await this.finishTrainJobSkippedQuiet(job, 'extraction_not_ready', {
        requeueDocument: exRaw === 'failed' || exRaw === 'queued' || exRaw === 'processing' || exRaw === 'waiting_for_source',
        clearStuckProcessingForDoc: true,
      });
      return;
    }

    const planTe = String((kb as { trainingError?: string | null }).trainingError ?? '').trim();
    if (planTe === PLAN_LIMIT_BOT_KB_TOTAL_CODE) {
      kbTrainingLog('document TrainJob skipped (plan_limit_bot_kb_total)', {
        trainJobId: String(job._id),
        botId: botIdStr,
        knowledgeBaseItemId: routeId,
      });
      await this.finishTrainJobSkippedQuiet(job, 'out_of_storage', { clearStuckProcessingForDoc: true });
      await this.knowledgeBaseItemService.setDocumentKnowledgeItemStatus(botIdStr, routeId, {
        status: 'failed',
        failureReason: PLAN_LIMIT_BOT_KB_TOTAL_CODE,
      });
      return;
    }

    kbTrainingLog('document TrainJob start', {
      trainJobId: String(job._id),
      botId: botIdStr,
      knowledgeBaseItemId: routeId,
      jobDocumentEmbedTargetContentHash: job.documentEmbedTargetContentHash ?? null,
      jobDocumentEmbedTargetLastContentUpdatedAt: job.documentEmbedTargetLastContentUpdatedAt
        ? new Date(job.documentEmbedTargetLastContentUpdatedAt).toISOString()
        : null,
      kbContentHash: kb.contentHash ?? null,
      kbTitleRaw: kb.title ?? null,
      kbTitleForRow: normalizeKbDocumentTitleForRow(kb.title),
      contentLength: textToChunk.length,
      recomputedFingerprintFromKbRow: documentKbContentFingerprint(kb.title, String(kb.content ?? '')),
      fingerprintMatchesKbContentHash:
        (kb.contentHash ?? '') === documentKbContentFingerprint(kb.title, String(kb.content ?? '')),
      kbLastContentUpdatedAt: kb.lastContentUpdatedAt
        ? new Date(kb.lastContentUpdatedAt).toISOString()
        : null,
      kbUpdatedAt: kb.updatedAt ? new Date(kb.updatedAt).toISOString() : null,
      extractionStatus: exRaw,
    });

    await this.knowledgeBaseItemService.setDocumentKnowledgeItemStatus(botIdStr, routeId, { status: 'processing' });

    const fm = effectiveKbDocumentFileMetaLean(kb as unknown as Record<string, unknown>);
    const s3Bucket = fm.storageBucket;
    const s3Key = fm.storageKey;
    const fileName = fm.originalName;
    const fileType = fm.mimeType;
    const url = fm.url;

    const rawChunks = this.kbService.chunkText(textToChunk);
    const limitedChunks = rawChunks.slice(0, MAX_DOC_CHUNKS);
    const totalChars = limitedChunks.reduce((sum, c) => sum + c.length, 0);
    if (limitedChunks.length === 0) {
      await this.knowledgeBaseChunkService.removeDocumentKnowledgeChunksForDocument(botIdStr, routeId);
      await this.knowledgeBaseItemService.setDocumentKnowledgeItemStatus(botIdStr, routeId, {
        status: 'failed',
        failureReason: 'no_chunks_created',
      });
      await this.trainJobModel.updateOne(
        { _id: job._id },
        { $set: { status: 'failed', error: 'no_chunks_created', finishedAt: new Date() } },
      );
      throw new Error('no_chunks_created');
    }
    if (totalChars > MAX_EMBED_TOTAL_CHARS) {
      await this.knowledgeBaseChunkService.removeDocumentKnowledgeChunksForDocument(botIdStr, routeId);
      await this.knowledgeBaseItemService.setDocumentKnowledgeItemStatus(botIdStr, routeId, {
        status: 'failed',
        failureReason: 'too_large_for_embedding',
      });
      await this.trainJobModel.updateOne(
        { _id: job._id },
        { $set: { status: 'failed', error: 'too_large_for_embedding', finishedAt: new Date() } },
      );
      throw new Error('too_large_for_embedding');
    }

    kbTrainingLog('document TrainJob chunking', {
      trainJobId: String(job._id),
      botId: botIdStr,
      routeId,
      chunkCount: limitedChunks.length,
      totalChars,
    });

    const kbSnapBeforeEmbed = await this.knowledgeBaseItemAccess.findDocumentLinkedKbStaleFields(botIdStr, routeId);
    const embedSnapshot: DocumentKbStaleSnapshot = {
      kbContentHash: kbSnapBeforeEmbed?.contentHash ?? '',
      kbLastContentUpdatedAt: kbSnapBeforeEmbed?.lastContentUpdatedAt ?? null,
    };
    kbTrainingLog('document TrainJob embed snapshot captured', {
      trainJobId: String(job._id),
      routeId,
      snapshotKbContentHash: embedSnapshot.kbContentHash,
      snapshotKbLastContentUpdatedAt: embedSnapshot.kbLastContentUpdatedAt
        ? new Date(embedSnapshot.kbLastContentUpdatedAt).toISOString()
        : null,
    });

    const apiKeyOverride = await this.knowledgeBaseChunkService.getBotApiKeyOverride(botIdStr);
    const embeddings: number[][] = [];
    for (let i = 0; i < limitedChunks.length; i += EMBED_BATCH_SIZE) {
      const batch = limitedChunks.slice(i, i + EMBED_BATCH_SIZE);
      try {
        const batchEmbeds = await this.ragService.embedTexts(batch, apiKeyOverride);
        embeddings.push(...batchEmbeds);
      } catch (e) {
        const batchChars = batch.reduce((s, t) => s + t.length, 0);
        console.error('[ingestion] processDocumentTrainJob embedding batch failed', {
          botId: botIdStr,
          routeId,
          trainJobId: String(job._id),
          chunkBatchOffset: i,
          chunkBatchSize: batch.length,
          totalChunks: limitedChunks.length,
          batchCharTotal: batchChars,
        });
        throw e;
      }
    }
    const chunksForKb = limitedChunks
      .slice(0, embeddings.length)
      .map((text, i) => ({
        text,
        embedding: embeddings[i] ?? [],
      }))
      .filter((c) => c.embedding.length > 0);

    if (chunksForKb.length === 0) {
      const reason = 'no_embeddings_saved';
      await this.knowledgeBaseChunkService.removeDocumentKnowledgeChunksForDocument(botIdStr, routeId);
      await this.knowledgeBaseItemService.setDocumentKnowledgeItemStatus(botIdStr, routeId, {
        status: 'failed',
        failureReason: reason,
      });
      await this.trainJobModel.updateOne(
        { _id: job._id },
        { $set: { status: 'failed', error: reason, finishedAt: new Date() } },
      );
      throw new Error(reason);
    }

    const freshKb = await this.knowledgeBaseItemAccess.findKbDocumentItemByRouteId(botIdStr, routeId);
    const latestLean = freshKb
      ? {
          title: freshKb.title,
          text: normalizeKbDocumentBodyForHash(String(freshKb.content ?? '')),
          active: freshKb.active !== false,
        }
      : null;
    const kbLatestPreWrite = await this.knowledgeBaseItemAccess.findDocumentLinkedKbStaleFields(botIdStr, routeId);
    const skipVerdict = shouldSkipDocumentKnowledgeChunkWrite(latestLean, kbLatestPreWrite, embedSnapshot);
    if (skipVerdict.skip) {
      const recomputedFp = latestLean
        ? documentIngestKbContentFingerprint(latestLean.title, latestLean.text)
        : null;
      kbTrainingLog('document TrainJob stale guard (pre-write)', {
        trainJobId: String(job._id),
        botId: botIdStr,
        knowledgeBaseItemId: routeId,
        routeId,
        reason: skipVerdict.reason,
        requeueLater: skipVerdict.requeueLater,
        jobDocumentEmbedTargetContentHash: job.documentEmbedTargetContentHash ?? null,
        embedSnapshotKbContentHash: embedSnapshot.kbContentHash,
        embedSnapshotKbLastContentUpdatedAt: embedSnapshot.kbLastContentUpdatedAt
          ? new Date(embedSnapshot.kbLastContentUpdatedAt).toISOString()
          : null,
        currentKbContentHash: kbLatestPreWrite?.contentHash ?? null,
        currentKbLastContentUpdatedAt: kbLatestPreWrite?.lastContentUpdatedAt
          ? new Date(kbLatestPreWrite.lastContentUpdatedAt).toISOString()
          : null,
        latestTitleRaw: latestLean?.title ?? null,
        latestContentLength: latestLean?.text?.length ?? 0,
        recomputedContentFingerprint: recomputedFp,
        fingerprintEqualsSnapshot: recomputedFp === embedSnapshot.kbContentHash,
      });
      await this.finishDocumentTrainAfterSkipVerdict(job, skipVerdict);
      return;
    }

    const chunksWritten = await this.knowledgeBaseChunkService.replaceDocumentKnowledgeChunks(botIdStr, routeId, chunksForKb);
    if (chunksWritten === 0) {
      const err = 'no_chunks_persisted';
      await this.knowledgeBaseChunkService.removeDocumentKnowledgeChunksForDocument(botIdStr, routeId);
      await this.knowledgeBaseItemService.setDocumentKnowledgeItemStatus(botIdStr, routeId, {
        status: 'failed',
        failureReason: 'no_chunks_persisted_kb_item_inactive_or_missing',
      });
      await this.trainJobModel.updateOne({ _id: job._id }, { $set: { status: 'failed', error: err, finishedAt: new Date() } });
      throw new Error(err);
    }

    const docReadyKb = await this.knowledgeBaseItemAccess.findKbDocumentItemByRouteId(botIdStr, routeId);
    const kbFresh = await this.knowledgeBaseItemAccess.findDocumentLinkedKbStaleFields(botIdStr, routeId);
    const skipAfterWrite = shouldSkipDocumentKnowledgeChunkWrite(
      docReadyKb
        ? {
            title: docReadyKb.title,
            text: normalizeKbDocumentBodyForHash(String(docReadyKb.content ?? '')),
            active: docReadyKb.active !== false,
          }
        : null,
      kbFresh,
      embedSnapshot,
    );
    if (skipAfterWrite.skip) {
      const postLean = docReadyKb
        ? {
            title: docReadyKb.title,
            text: normalizeKbDocumentBodyForHash(String(docReadyKb.content ?? '')),
            active: docReadyKb.active !== false,
          }
        : null;
      const recomputedPost = postLean ? documentIngestKbContentFingerprint(postLean.title, postLean.text) : null;
      kbTrainingLog('document TrainJob stale guard (post-write)', {
        trainJobId: String(job._id),
        botId: botIdStr,
        knowledgeBaseItemId: routeId,
        routeId,
        reason: skipAfterWrite.reason,
        requeueLater: skipAfterWrite.requeueLater,
        jobDocumentEmbedTargetContentHash: job.documentEmbedTargetContentHash ?? null,
        embedSnapshotKbContentHash: embedSnapshot.kbContentHash,
        currentKbContentHash: kbFresh?.contentHash ?? null,
        recomputedContentFingerprint: recomputedPost,
      });
      await this.knowledgeBaseChunkService.removeDocumentKnowledgeChunksForDocument(botIdStr, routeId);
      await this.finishDocumentTrainAfterSkipVerdict(job, skipAfterWrite);
      return;
    }

    const embeddedPersisted = await this.knowledgeBaseChunkService.countChunksWithValidEmbeddingsForDocument(
      botIdStr,
      routeId,
    );
    if (embeddedPersisted === 0) {
      const err = 'no_embedding_chunks_in_db';
      await this.knowledgeBaseChunkService.removeDocumentKnowledgeChunksForDocument(botIdStr, routeId);
      await this.knowledgeBaseItemService.setDocumentKnowledgeItemStatus(botIdStr, routeId, {
        status: 'failed',
        failureReason: 'no_chunks_with_embeddings_after_write',
      });
      await this.trainJobModel.updateOne({ _id: job._id }, { $set: { status: 'failed', error: err, finishedAt: new Date() } });
      throw new Error(err);
    }

    if (!isTrainableExtractedDocumentText(textToChunk)) {
      await this.knowledgeBaseChunkService.removeDocumentKnowledgeChunksForDocument(botIdStr, routeId);
      throw new Error('No readable text found');
    }

    kbTrainingLog('document TrainJob completed', {
      trainJobId: String(job._id),
      botId: botIdStr,
      routeId,
      chunksWritten,
      chunksWithEmbeddingsVerified: embeddedPersisted,
      finalKbStatus: 'ready',
    });

    const finishedAt = new Date();
    const titleForUpsert = normalizeKbDocumentTitleForRow(docReadyKb?.title ?? kb.title);
    await this.knowledgeBaseItemService.upsertDocumentKnowledgeItem({
      _id: kb._id,
      botId: kb.botId,
      title: titleForUpsert,
      trainingStatus: 'ready',
      active: docReadyKb?.active !== false,
      text: textToChunk,
      fileName,
      fileType,
      fileSize: fm.sizeBytes,
      url,
      storage: fm.storage ?? 's3',
      s3Bucket,
      s3Key,
      uploadSessionId: fm.uploadSessionId,
    });

    await this.trainJobModel.updateOne(
      { _id: job._id },
      { $set: { status: 'done', finishedAt, error: undefined } },
    );
  }

  /**
   * Reset `ExtractJob`s stuck in `processing`: re-queue eligible work, align `KnowledgeBaseItem.extractionStatus`
   * to `queued`, and **never** force training `status` to `processing`. Orphan / inactive routes finish the
   * job row as `done` so nothing remains stuck claimable.
   */
  async resetStuckJobs(): Promise<number> {
    const timeoutMinutes = Math.max(1, INGESTION_STUCK_TIMEOUT_MINUTES);
    const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000);
    const stuck = await this.extractJobModel.find({
      ...mongoExtractProcessingJobStaleCriteria(cutoff),
    });
    const affectedBots = new Set<string>();
    for (const job of stuck) {
      affectedBots.add(String(job.botId));
      const finishedAt = new Date();
      const kbId = (job as { knowledgeBaseItemId?: Types.ObjectId }).knowledgeBaseItemId;
      if (!kbId) {
        await this.extractJobModel.updateOne(
          { _id: job._id },
          {
            $set: {
              status: 'done',
              finishedAt,
              error: 'skipped:orphan_stuck_reset',
            },
            $unset: {
              startedAt: 1,
              processingStartedAt: 1,
            },
          },
        );
        continue;
      }
      const kbState = await this.knowledgeBaseItemAccess.getDocumentKbRouteStuckRecoverState(
        String(job.botId),
        String(kbId),
      );
      if (kbState === 'missing') {
        await this.extractJobModel.updateOne(
          { _id: job._id },
          {
            $set: {
              status: 'done',
              finishedAt,
              error: 'skipped:document_missing_stuck_reset',
            },
            $unset: {
              startedAt: 1,
              processingStartedAt: 1,
            },
          },
        );
        continue;
      }
      if (kbState === 'inactive') {
        await this.extractJobModel.updateOne(
          { _id: job._id },
          {
            $set: {
              status: 'done',
              finishedAt,
              error: 'skipped:kb_inactive_stuck_reset',
            },
            $unset: {
              startedAt: 1,
              processingStartedAt: 1,
            },
          },
        );
        continue;
      }
      const sr = (job as { extractStuckRecoveryCycles?: number }).extractStuckRecoveryCycles ?? 0;
      if (sr >= EXTRACT_JOB_MAX_STUCK_RECOVERIES) {
        await this.extractJobModel.updateOne(
          { _id: job._id },
          {
            $set: {
              status: 'failed',
              finishedAt,
              error: STUCK_RECOVERY_LIMIT_JOB_ERROR,
            },
            $unset: {
              startedAt: 1,
              processingStartedAt: 1,
            },
          },
        );
        await this.knowledgeBaseItemService.patchDocumentKbExtractionFailed(
          String(job.botId),
          String(kbId),
          STUCK_RECOVERY_LIMIT_EXTRACTION_CUSTOMER_MESSAGE,
        );
        continue;
      }

      const requeuedAt = new Date();
      const nextSr = sr + 1;
      await this.extractJobModel.updateOne(
        { _id: job._id },
        {
          $set: {
            status: 'queued',
            error: undefined,
            queuedAt: requeuedAt,
            runAfter: requeuedAt,
            extractStuckRecoveryCycles: nextSr,
          },
          $unset: {
            startedAt: 1,
            processingStartedAt: 1,
            finishedAt: 1,
          },
        },
      );
      await this.knowledgeBaseItemService.notifyDocumentExtractJobEnqueued(
        String(job.botId),
        String(kbId),
        {
          lastQueuedAt: requeuedAt,
          runAfter: requeuedAt,
        },
        {
          alignTrainingStatusQueued: false,
        },
      );
    }
    if (stuck.length > 0) {
      console.log(`[ingestion] reset ${stuck.length} stuck job(s) (processing > ${timeoutMinutes} min)`);
      for (const botId of affectedBots) {
        await this.knowledgeStatsService.recalculateKnowledgeStatsForBot(botId);
      }
    }
    return stuck.length;
  }

  /**
   * Mark a claimed extraction job failed and persist KB extraction failure (`extractionError` / `extractionStatus`).
   * When no S3/key and no https URL existed for extraction (`file_url_missing`), also sets KB `fileMeta.uploadStatus`
   * to `upload_failed`.
   */
  async markJobFailed(job: IngestRouteJobRef, errorMessage: string): Promise<void> {
    const routeId = this.ingestTrainingRouteId(job);
    if (!routeId) return;
    if (errorMessage === 'file_url_missing') {
      await this.knowledgeBaseItemService.mergeDocumentKbFileMetaFields(String(job.botId), routeId, {
        uploadStatus: 'upload_failed',
      });
    }
    const human = humanizeDocumentIngestFailureReason(errorMessage);
    const cur = await this.extractJobModel.findById(job._id).select('extractAutoRetryCycles').lean();
    const rawCycles = (cur as { extractAutoRetryCycles?: number } | null)?.extractAutoRetryCycles;
    const cycles =
      typeof rawCycles === 'number' && Number.isFinite(rawCycles) ? Math.max(0, Math.floor(rawCycles)) : 0;
    const deferMs = extractFailureDeferRunAfterMs(cycles);
    const runAfter = new Date(Date.now() + deferMs);
    await this.knowledgeBaseItemService.patchDocumentKbExtractionFailed(String(job.botId), routeId, human);
    if (Types.ObjectId.isValid(routeId)) {
      const rid = new Types.ObjectId(routeId);
      await this.trainJobModel.deleteMany({
        botId: job.botId,
        kind: 'document',
        knowledgeBaseItemId: rid,
        status: 'queued',
      });
    }
    kbTrainingLog('ExtractJob failed', {
      extractJobId: String(job._id),
      botId: String(job.botId),
      knowledgeBaseItemId: routeId,
      reason: human,
    });
    await this.extractJobModel.updateOne(
      { _id: job._id },
      { $set: { status: 'failed', error: human, finishedAt: new Date(), runAfter } },
    );
  }

  async runQueuedIngestionJobs(limit = 3): Promise<IngestionRunResult> {
    const normalizedLimit = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : 3;

    let processed = 0;
    let failed = 0;
    const results: IngestionRunResult['results'] = [];

    for (let i = 0; i < normalizedLimit; i++) {
      const job = await this.claimQueuedJob();
      if (!job) break;

      try {
        const outcome = await this.processJob(job);
        processed += 1;
        const routeOut = job.knowledgeBaseItemId;
        results.push({
          jobId: job._id.toString(),
          docId: routeOut ? routeOut.toString() : '',
          status: outcome === 'skipped' ? 'skipped' : 'done',
        });
      } catch (jobError) {
        const errorMessage =
          jobError instanceof Error && jobError.message ? jobError.message : 'ingestion_failed';

        await this.markJobFailed(job, errorMessage);

        failed += 1;
        const routeFail = job.knowledgeBaseItemId;
        results.push({
          jobId: job._id.toString(),
          docId: routeFail ? routeFail.toString() : '',
          status: 'failed',
          error: errorMessage,
        });
      }
    }

    const firstResult = results[0];
    return {
      ok: true,
      processed,
      processedCount: processed,
      failed,
      claimedJobId: firstResult?.jobId,
      finalDocStatus: firstResult
        ? firstResult.status === 'done'
          ? 'ready'
          : firstResult.status === 'skipped'
            ? undefined
            : 'failed'
        : undefined,
      results,
    };
  }
}
