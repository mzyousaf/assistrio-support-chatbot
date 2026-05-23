import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import type { DocumentTrainRouteRef } from '../ingestion/ingestion.service';
import { IngestionService } from '../ingestion/ingestion.service';
import { TableImportService } from '../ingestion/table-import.service';
import { SummaryJobService } from '../chat/summary-job.service';
import { KnowledgeTrainingJobService } from '../knowledge/knowledge-training-job.service';
import { KnowledgeTrainKbDriftReconcileService } from '../knowledge/knowledge-train-kb-drift-reconcile.service';
import { KnowledgeItemPurgeService } from '../knowledge/knowledge-item-purge.service';
import { BotPurgeService } from '../knowledge/bot-purge.service';
import { WorkspaceOnboardingKbTransferJobService } from '../workspace/workspace-onboarding-kb-transfer-job.service';
import type { AppMode } from '../config/app-mode.util';
import {
  logCronError,
  logCronFinish,
  logCronSkip,
  logCronStart,
} from './kb-cron-log.util';

const CRON_CONTENT_EXTRACTION = 'content_extraction';
const CRON_SUMMARY = 'summary_jobs';
const CRON_KB_TRAINING = 'knowledge_training';
const CRON_TABLE_IMPORT = 'table_import';
const CRON_ONBOARDING_KB_TRANSFER = 'onboarding_kb_transfer';
const CRON_KB_PURGE = 'knowledge_item_purge';
const CRON_BOT_PURGE = 'bot_purge';

function durationSince(t0: number): number {
  return Math.round(performance.now() - t0);
}

function isIngestReconcilerDisabled(): boolean {
  return (
    process.env.KNOWLEDGE_INGEST_RECONCILER_DISABLED === 'true' ||
    process.env.KNOWLEDGE_INGEST_RECONCILER_DISABLED === '1' ||
    process.env.EXTRACT_INGEST_RECONCILER_DISABLED === 'true' ||
    process.env.EXTRACT_INGEST_RECONCILER_DISABLED === '1'
  );
}

function isUploadBadSourceSweepDisabled(): boolean {
  return (
    process.env.KNOWLEDGE_UPLOAD_BAD_SOURCE_SWEEP_DISABLED === 'true' ||
    process.env.KNOWLEDGE_UPLOAD_BAD_SOURCE_SWEEP_DISABLED === '1'
  );
}

@Injectable()
export class JobsCronService {
  private ingestionRunning = false;
  private summaryRunning = false;
  private knowledgeTrainingRunning = false;

  constructor(
    private readonly config: ConfigService,
    private readonly ingestionService: IngestionService,
    private readonly summaryJobService: SummaryJobService,
    private readonly knowledgeTrainingJobService: KnowledgeTrainingJobService,
    private readonly knowledgeTrainKbDriftReconcileService: KnowledgeTrainKbDriftReconcileService,
    private readonly tableImportService: TableImportService,
    private readonly workspaceOnboardingKbTransferJobService: WorkspaceOnboardingKbTransferJobService,
    private readonly knowledgeItemPurgeService: KnowledgeItemPurgeService,
    private readonly botPurgeService: BotPurgeService,
  ) {}

  /**
   * In-process crons are disabled for `APP_MODE=api` and when `enableKbWorker` is false; see `configFactory` / `app-mode.util`.
   * Still registered with `@nestjs/schedule` when `JobsCronService` is in the module, so this guard is defense in depth.
   */
  private shouldRunInProcessCrons(): boolean {
    const mode = this.config.get<AppMode>('appMode');
    if (mode === 'api') return false;
    if (mode !== 'all' && mode !== 'worker') return false;
    return this.config.get<boolean>('enableKbWorker') === true;
  }

  private cronDisabledReason(): string | null {
    if (this.shouldRunInProcessCrons()) return null;
    const mode = this.config.get<AppMode>('appMode');
    if (mode === 'api') return 'APP_MODE=api';
    if (mode !== 'all' && mode !== 'worker') return `APP_MODE=${String(mode)}`;
    if (this.config.get<boolean>('enableKbWorker') !== true) return 'ENABLE_KB_WORKER=false';
    return 'in_process_kb_crons_disabled';
  }

  /**
   * Content extraction (`ExtractJob`): every ~10s: stuck extract recovery, ingest reconcile, **mark unusable
   * S3/HTTPS sources upload_failed**, then claim/run queued extract jobs.
   */
  @Cron('*/10 * * * * *')
  async runContentExtractionCron(): Promise<void> {
    const disabled = this.cronDisabledReason();
    if (disabled) {
      logCronSkip(CRON_CONTENT_EXTRACTION, disabled);
      return;
    }
    if (this.ingestionRunning) {
      logCronSkip(CRON_CONTENT_EXTRACTION, 'previous_run_still_in_progress');
      return;
    }
    this.ingestionRunning = true;
    const limitRaw = process.env.JOBS_RUNNER_LIMIT ?? '5';
    const limit = Math.max(1, Math.floor(Number(limitRaw)) || 5);
    const t0 = performance.now();
    logCronStart(CRON_CONTENT_EXTRACTION, { jobRunnerLimit: limit });
    let attempted = 0;
    let completed = 0;
    let skippedInJob = 0;
    let failed = 0;
    try {
      const stuckExtractReset = await this.ingestionService.resetStuckJobs();
      const extractJobsRequeued = await this.ingestionService.requeueEligibleFailedExtractJobs();
      const rec = await this.ingestionService.reconcileDocumentIngestState();
      const badSrc = await this.ingestionService.markDocumentKbRowsWithUnusableUploadSources();
      for (let i = 0; i < limit; i++) {
        const job = await this.ingestionService.claimQueuedJob();
        if (!job) break;
        attempted += 1;
        try {
          const outcome = await this.ingestionService.processJob(job);
          if (outcome === 'skipped') skippedInJob += 1;
          else completed += 1;
        } catch (err: unknown) {
          failed += 1;
          const message = err instanceof Error ? err.message : 'ingestion_failed';
          logCronError(CRON_CONTENT_EXTRACTION, err, {
            phase: 'process_extract_job',
            extractJobId: String((job as { _id: { toString(): string } })._id),
          });
          await this.ingestionService.markJobFailed(job, message);
        }
      }
      logCronFinish(CRON_CONTENT_EXTRACTION, {
        durationMs: durationSince(t0),
        stuckExtractReset,
        extractJobsRequeued,
        phantomFixed: rec.phantomFixed,
        extractEnsured: rec.extractEnsured,
        ingestReconcilerDisabled: isIngestReconcilerDisabled(),
        uploadBadSourceMarked: badSrc.marked,
        uploadBadSourceSweepDisabled: isUploadBadSourceSweepDisabled(),
        claimed: attempted,
        completed,
        skippedInJob,
        failed,
      });
    } catch (err: unknown) {
      logCronError(CRON_CONTENT_EXTRACTION, err, { phase: 'cron_body' });
      logCronFinish(CRON_CONTENT_EXTRACTION, {
        durationMs: durationSince(t0),
        fatal: true,
        claimed: attempted,
        completed,
        skippedInJob,
        failed,
      });
    } finally {
      this.ingestionRunning = false;
    }
  }

  /**
   * Summary jobs: runs every 10 seconds (lower priority).
   */
  @Cron('*/10 * * * * *')
  async runSummaryCron(): Promise<void> {
    const disabled = this.cronDisabledReason();
    if (disabled) {
      logCronSkip(CRON_SUMMARY, disabled);
      return;
    }
    if (this.summaryRunning) {
      logCronSkip(CRON_SUMMARY, 'previous_run_still_in_progress');
      return;
    }
    this.summaryRunning = true;
    const limitRaw = process.env.SUMMARY_JOBS_RUNNER_LIMIT ?? '5';
    const limit = Math.max(1, Math.floor(Number(limitRaw)) || 5);
    const t0 = performance.now();
    logCronStart(CRON_SUMMARY, { jobRunnerLimit: limit, jobKind: 'summary' });
    let claimed = 0;
    let processed = 0;
    let failed = 0;
    try {
      for (let i = 0; i < limit; i++) {
        const job = await this.summaryJobService.claimOne();
        if (!job) break;
        claimed += 1;
        try {
          await this.summaryJobService.processJob(job);
          processed += 1;
        } catch (err) {
          failed += 1;
          logCronError(CRON_SUMMARY, err, {
            phase: 'process_summary_job',
            summaryJobId: String((job as { _id: { toString(): string } })._id),
          });
          const message = err instanceof Error ? err.message : 'summary_failed';
          await this.summaryJobService.markFailed(job, message);
        }
      }
      logCronFinish(CRON_SUMMARY, {
        durationMs: durationSince(t0),
        claimed,
        processed,
        failed,
        skipped: Math.max(0, claimed - processed - failed),
        jobKind: 'summary',
      });
    } catch (err: unknown) {
      logCronError(CRON_SUMMARY, err, { phase: 'cron_body' });
      logCronFinish(CRON_SUMMARY, {
        durationMs: durationSince(t0),
        fatal: true,
        claimed,
        processed,
        failed,
        jobKind: 'summary',
      });
    } finally {
      this.summaryRunning = false;
    }
  }

  /**
   * Train jobs: document embedding (`kind: document`) + FAQ/note/table/suggestion (`kind: scopes`).
   */
  @Cron('*/10 * * * * *')
  async runKnowledgeTrainingCron(): Promise<void> {
    const disabled = this.cronDisabledReason();
    if (disabled) {
      logCronSkip(CRON_KB_TRAINING, disabled);
      return;
    }
    if (this.knowledgeTrainingRunning) {
      logCronSkip(CRON_KB_TRAINING, 'previous_run_still_in_progress');
      return;
    }
    this.knowledgeTrainingRunning = true;
    const limitRawRaw = process.env.KNOWLEDGE_TRAINING_JOBS_RUNNER_LIMIT ?? '3';
    const limit = Math.max(1, Math.floor(Number(limitRawRaw)) || 3);
    const tableLimitRaw = process.env.TABLE_IMPORT_JOBS_RUNNER_LIMIT ?? '3';
    const tableLimit = Math.max(1, Math.floor(Number(tableLimitRaw)) || 3);
    const t0 = performance.now();
    logCronStart(CRON_KB_TRAINING, {
      trainJobRunnerLimit: limit,
      tableImportJobRunnerLimit: tableLimit,
    });

    let trainStuckReset = 0;
    let tableStuckReset = 0;
    let sessionsRemoved = 0;
    let tableS3DeletesAttempted = 0;
    let tableS3DeletesFailed = 0;
    let tableJobsClaimed = 0;
    let tableJobsCompleted = 0;
    let tableJobsFailed = 0;
    let trainAttempted = 0;
    let trainProcessed = 0;
    let trainFailed = 0;
    let trainDocumentJobs = 0;
    let trainScopesJobs = 0;
    let trainKbDriftReconciled = 0;
    let onboardingTransferStuckReset = 0;
    let onboardingTransferRequeued = 0;
    let onboardingTransferClaimed = 0;
    let onboardingTransferCompleted = 0;
    let onboardingTransferFailed = 0;

    try {
      trainStuckReset = await this.knowledgeTrainingJobService.resetStuckJobs();
      trainKbDriftReconciled = await this.knowledgeTrainKbDriftReconcileService.reconcileDocumentTrainKbDrift();
      tableStuckReset = await this.tableImportService.resetStuckTableImportJobs();
      const cleanupLimitRaw = process.env.TABLE_IMPORT_SESSION_CLEANUP_BATCH ?? '50';
      const cleanupLimit = Math.max(1, Math.floor(Number(cleanupLimitRaw)) || 50);
      const cl = await this.tableImportService.cleanupStaleTableImportPreviewSessions(cleanupLimit);
      sessionsRemoved = cl.sessionsRemoved;
      tableS3DeletesAttempted = cl.s3DeletesAttempted;
      tableS3DeletesFailed = cl.s3DeletesFailed;

      logCronStart(CRON_TABLE_IMPORT, {
        tableStuckReset,
        sessionsRemoved,
        s3DeletesAttempted: tableS3DeletesAttempted,
        s3DeletesFailed: tableS3DeletesFailed,
      });
      const tTable = performance.now();
      try {
        const tableJobBatch = await this.tableImportService.claimQueuedTableImportJobsFair(tableLimit);
        for (const tj of tableJobBatch) {
          tableJobsClaimed += 1;
          try {
            await this.tableImportService.processTableImportJob(tj);
            tableJobsCompleted += 1;
          } catch (err) {
            tableJobsFailed += 1;
            const message = err instanceof Error ? err.message : 'table_import_failed';
            logCronError(CRON_TABLE_IMPORT, err, {
              phase: 'process_table_import_job',
              tableImportJobId: String(tj._id),
            });
            await this.tableImportService.handleProcessJobCrash(tj, message);
          }
        }
      } finally {
        logCronFinish(CRON_TABLE_IMPORT, {
          durationMs: durationSince(tTable),
          claimed: tableJobsClaimed,
          processed: tableJobsCompleted,
          failed: tableJobsFailed,
          skipped: Math.max(0, tableJobsClaimed - tableJobsCompleted - tableJobsFailed),
        });
      }

      const onboardingLimitRaw = process.env.ONBOARDING_KB_TRANSFER_JOBS_RUNNER_LIMIT ?? '3';
      const onboardingLimit = Math.max(1, Math.floor(Number(onboardingLimitRaw)) || 3);
      logCronStart(CRON_ONBOARDING_KB_TRANSFER, { jobRunnerLimit: onboardingLimit });
      const tOnboardingTransfer = performance.now();
      try {
        onboardingTransferStuckReset = await this.workspaceOnboardingKbTransferJobService.resetStuckTransferJobs();
        onboardingTransferRequeued =
          await this.workspaceOnboardingKbTransferJobService.requeueEligibleFailedTransferJobs();
        for (let i = 0; i < onboardingLimit; i++) {
          const transferJob = await this.workspaceOnboardingKbTransferJobService.claimQueuedTransferJob();
          if (!transferJob) break;
          onboardingTransferClaimed += 1;
          try {
            await this.workspaceOnboardingKbTransferJobService.processTransferJob(transferJob);
            onboardingTransferCompleted += 1;
          } catch (err) {
            onboardingTransferFailed += 1;
            const message = err instanceof Error ? err.message : 'onboarding_kb_transfer_failed';
            logCronError(CRON_ONBOARDING_KB_TRANSFER, err, {
              phase: 'process_onboarding_kb_transfer_job',
              onboardingKbTransferJobId: String(transferJob._id),
            });
            await this.workspaceOnboardingKbTransferJobService.markJobFailed(transferJob, message);
          }
        }
      } finally {
        logCronFinish(CRON_ONBOARDING_KB_TRANSFER, {
          durationMs: durationSince(tOnboardingTransfer),
          stuckReset: onboardingTransferStuckReset,
          requeuedFailed: onboardingTransferRequeued,
          claimed: onboardingTransferClaimed,
          processed: onboardingTransferCompleted,
          failed: onboardingTransferFailed,
          skipped: Math.max(
            0,
            onboardingTransferClaimed - onboardingTransferCompleted - onboardingTransferFailed,
          ),
        });
      }

      for (let i = 0; i < limit; i++) {
        const job = await this.knowledgeTrainingJobService.claimQueuedTrainJob();
        if (!job) break;
        trainAttempted += 1;
        const kind = (job as { kind?: string }).kind ?? 'unknown';
        if (kind === 'document') trainDocumentJobs += 1;
        if (kind === 'scopes') trainScopesJobs += 1;
        try {
          if (job.kind === 'document') {
            await this.ingestionService.processDocumentTrainJob(job as unknown as DocumentTrainRouteRef);
          } else {
            await this.knowledgeTrainingJobService.processScopesTrainJob(job);
          }
          trainProcessed += 1;
        } catch (err: unknown) {
          trainFailed += 1;
          const message = err instanceof Error ? err.message : 'knowledge_training_failed';
          const jid = job as {
            _id: { toString(): string };
            botId: { toString(): string };
            kind?: string;
            knowledgeBaseItemId?: { toString(): string };
          };
          logCronError(CRON_KB_TRAINING, err, {
            phase: 'process_train_job',
            trainJobId: String(jid._id),
            botId: String(jid.botId),
            kind: jid.kind,
            knowledgeBaseItemId: jid.knowledgeBaseItemId ? String(jid.knowledgeBaseItemId) : undefined,
          });
          await this.knowledgeTrainingJobService.markTrainJobFailed(job, message);
          if (job.kind === 'document') {
            await this.ingestionService.reflectDocumentTrainJobCatchFailure(job as DocumentTrainRouteRef, message);
          }
        }
      }
      logCronFinish(CRON_KB_TRAINING, {
        durationMs: durationSince(t0),
        trainStuckReset,
        trainKbDriftReconciled,
        tableStuckReset,
        tablePreviewSessionsRemoved: sessionsRemoved,
        tablePreviewS3DeletesAttempted: tableS3DeletesAttempted,
        tablePreviewS3DeletesFailed: tableS3DeletesFailed,
        tableJobsClaimed,
        tableJobsProcessed: tableJobsCompleted,
        tableJobsFailed,
        onboardingTransferStuckReset,
        onboardingTransferRequeued,
        onboardingTransferClaimed,
        onboardingTransferProcessed: onboardingTransferCompleted,
        onboardingTransferFailed,
        trainJobsClaimed: trainAttempted,
        trainJobsProcessed: trainProcessed,
        trainJobsFailed: trainFailed,
        trainDocumentJobs,
        trainScopesJobs,
      });
    } catch (err: unknown) {
      logCronError(CRON_KB_TRAINING, err, { phase: 'cron_body' });
      logCronFinish(CRON_KB_TRAINING, {
        durationMs: durationSince(t0),
        fatal: true,
        trainStuckReset,
        trainKbDriftReconciled,
        tableStuckReset,
        tableJobsClaimed,
        tableJobsProcessed: tableJobsCompleted,
        tableJobsFailed,
        onboardingTransferClaimed,
        onboardingTransferProcessed: onboardingTransferCompleted,
        onboardingTransferFailed,
        trainJobsClaimed: trainAttempted,
        trainJobsProcessed: trainProcessed,
        trainJobsFailed: trainFailed,
      });
    } finally {
      this.knowledgeTrainingRunning = false;
    }
  }

  /**
   * Hard-purge soft-deleted knowledge items after grace ({@link KnowledgeItemPurgeService}).
   * Default schedule: every 30 minutes (see `KNOWLEDGE_ITEM_PURGE_*` env vars).
   */
  @Cron('0 */30 * * * *')
  async runKnowledgeItemPurgeCron(): Promise<void> {
    const disabled = this.cronDisabledReason();
    if (disabled) {
      logCronSkip(CRON_KB_PURGE, disabled);
      return;
    }
    const t0 = performance.now();
    logCronStart(CRON_KB_PURGE);
    try {
      const r = await this.knowledgeItemPurgeService.purgeDueItems();
      logCronFinish(CRON_KB_PURGE, {
        durationMs: durationSince(t0),
        eligibleCount: r.eligibleCount,
        purged: r.purged,
        purgeErrors: r.purgeErrors,
        chunksDeleted: r.chunksDeleted,
        extractJobsDeleted: r.extractJobsDeleted,
        trainDocumentJobsDeleted: r.trainDocumentJobsDeleted,
        tableImportJobsDeleted: r.tableImportJobsDeleted,
        tableSessionsDeleted: r.tableSessionsDeleted,
        s3DeleteAttempted: r.s3DeleteAttempted,
        s3DeleteFailed: r.s3DeleteFailed,
        botsRefreshed: r.botsToRefresh.length,
      });
    } catch (err) {
      logCronError(CRON_KB_PURGE, err);
      logCronFinish(CRON_KB_PURGE, { durationMs: durationSince(t0), fatal: true });
    }
  }

  /**
   * Hard-purge soft-deleted bots after grace ({@link BotPurgeService}). Env: `BOT_PURGE_*`.
   */
  @Cron('30 */30 * * * *')
  async runBotPurgeCron(): Promise<void> {
    const disabled = this.cronDisabledReason();
    if (disabled) {
      logCronSkip(CRON_BOT_PURGE, disabled);
      return;
    }
    const t0 = performance.now();
    logCronStart(CRON_BOT_PURGE);
    try {
      const r = await this.botPurgeService.purgeDueBots();
      logCronFinish(CRON_BOT_PURGE, {
        durationMs: durationSince(t0),
        eligibleCount: r.eligibleCount,
        purged: r.purged,
        botPurgeErrors: r.botPurgeErrors,
        chunksDeleted: r.chunksDeleted,
        kbItemsDeleted: r.kbItemsDeleted,
        extractJobsDeleted: r.extractJobsDeleted,
        trainJobsDeleted: r.trainJobsDeleted,
        summaryJobsDeleted: r.summaryJobsDeleted,
        tableImportJobsDeleted: r.tableImportJobsDeleted,
        tableSessionsDeleted: r.tableSessionsDeleted,
        conversationsDeleted: r.conversationsDeleted,
        messagesDeleted: r.messagesDeleted,
        visitorEventsDeleted: r.visitorEventsDeleted,
        s3DeleteAttempted: r.s3DeleteAttempted,
        s3DeleteFailed: r.s3DeleteFailed,
      });
    } catch (err) {
      logCronError(CRON_BOT_PURGE, err);
      logCronFinish(CRON_BOT_PURGE, { durationMs: durationSince(t0), fatal: true });
    }
  }
}
