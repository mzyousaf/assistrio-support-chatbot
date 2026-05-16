import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Bot, TrainJob } from '../models';
import { KnowledgeBaseItem } from '../models/knowledge-base-item.schema';
import type { KnowledgeTrainingScope } from '../models/train-job.schema';
import { KnowledgeBaseChunkService } from './knowledge-base-chunk.service';
import { KnowledgeStatsService } from './knowledge-stats.service';
import { getKnowledgeTrainingSettings, trainingRunAfterFrom } from './bot-knowledge-training-settings.util';
import { latestQueuedKnowledgeItemRunAfter } from './knowledge-scopes-train-job-run-after.util';
import { estimateTextMetricsFromKnowledgeItemLean } from './knowledge-text-metrics';
import { mergeTrainingScopes } from './merge-training-scopes.util';
import {
  knowledgeItemExcludeDeletedOnlyClause,
  KnowledgeBaseItemAccessService,
} from './knowledge-base-item-access.service';
import { kbTrainingLog } from './kb-training-log.util';
import { botIsEffectivelyDeleted } from '../bots/bot-not-deleted.util';
import { PLAN_LIMIT_BOT_KB_TOTAL_CODE } from './bot-knowledge-total-limit.service';
import {
  KNOWLEDGE_TRAINING_MAX_STUCK_RECOVERIES,
  KNOWLEDGE_TRAINING_STUCK_TIMEOUT_MINUTES,
  STUCK_RECOVERY_LIMIT_JOB_ERROR,
} from './knowledge-pipeline-retry.constants';
import { mongoTrainProcessingJobStaleCriteria } from './pipeline-stuck-processing-query.util';

function scopeToSourceType(
  scope: KnowledgeTrainingScope,
): 'faq' | 'note' | 'table' | 'suggestion' {
  return scope;
}

function estimateSecondsFromCharacters(chars: number): number {
  return Math.min(3600, Math.max(5, Math.ceil(chars / 750) * 10));
}

@Injectable()
export class KnowledgeTrainingJobService {
  constructor(
    @InjectModel(TrainJob.name) private readonly jobModel: Model<TrainJob>,
    @InjectModel(KnowledgeBaseItem.name) private readonly itemModel: Model<KnowledgeBaseItem>,
    @InjectModel(Bot.name) private readonly botModel: Model<Bot>,
    private readonly knowledgeBaseItemAccess: KnowledgeBaseItemAccessService,
    private readonly knowledgeBaseChunkService: KnowledgeBaseChunkService,
    private readonly knowledgeStatsService: KnowledgeStatsService,
  ) {}

  /**
   * Queue non-document KB embedding for a bot (legacy name). Uses auto-train schedule + merge.
   */
  async enqueueForBot(botId: string, scopes: KnowledgeTrainingScope[]): Promise<void> {
    await this.scheduleTrainingForScopes(botId, scopes);
  }

  /**
   * Merge or create a queued **scopes** {@link TrainJob} from current `queued` FAQ/note/table/suggestion rows.
   *
   * Central auto-train gate: when `bypassAutoTrainGate` is unset/false and the bot has
   * `knowledgeTraining.autoTrainEnabled === false`, this returns without creating jobs (manual retrain flows pass
   * `bypassAutoTrainGate: true`). Document extraction uses {@link IngestionService} / document `TrainJob` instead.
   */
  async scheduleTrainingForScopes(
    botId: string,
    scopes: KnowledgeTrainingScope[],
    options?: { bypassAutoTrainGate?: boolean; immediateJob?: boolean },
  ): Promise<void> {
    const merged = mergeTrainingScopes(scopes);
    if (merged.length === 0) return;
    if (!Types.ObjectId.isValid(botId)) return;
    const botOid = new Types.ObjectId(botId);
    const bot = await this.botModel.findById(botOid).select('knowledgeTraining').lean();
    const settings = getKnowledgeTrainingSettings(bot);
    if (!options?.bypassAutoTrainGate && !settings.autoTrainEnabled) {
      return;
    }

    const sourceTypes = merged.map(scopeToSourceType);
    const aggregate = await this.aggregateQueuedForSourceTypes(botOid, sourceTypes);
    const now = new Date();

    if (aggregate.queuedItems === 0) {
      kbTrainingLog('scheduleTrainingScopes: no queued items — deleting stale scope TrainJobs', {
        botId,
        sourceTypes: sourceTypes.join(','),
      });
      await this.jobModel.deleteMany({ botId: botOid, status: 'queued', kind: 'scopes' });
      return;
    }

    /**
     * One scopes job embeds every `queued` row in the scope. The job must not become due until
     * **each** row's `runAfter` (smart / fixed delay); use the latest time among queued rows.
     */
    const latestItemRunAfter = await this.getLatestQueuedItemRunAfter(botOid, sourceTypes, now);
    let runAfter: Date;
    if (options?.immediateJob) {
      runAfter = now;
    } else if (latestItemRunAfter) {
      runAfter = latestItemRunAfter;
    } else {
      runAfter = trainingRunAfterFrom(now, settings.trainingDelayMinutes);
    }
    const est = estimateSecondsFromCharacters(aggregate.queuedCharacters);

    const existing = await this.jobModel
      .findOne({ botId: botOid, status: 'queued', kind: 'scopes' })
      .select('_id scopes')
      .lean();
    if (existing) {
      const next = mergeTrainingScopes([...(existing as { scopes?: KnowledgeTrainingScope[] }).scopes ?? [], ...merged]);
      await this.jobModel.updateOne(
        { _id: (existing as { _id: Types.ObjectId })._id },
        {
          $set: {
            scopes: next,
            queuedAt: now,
            runAfter,
            skipRunAfterItemGate: options?.immediateJob === true,
            queuedItems: aggregate.queuedItems,
            queuedCharacters: aggregate.queuedCharacters,
            estimatedTrainingSeconds: est,
            error: undefined,
            trainStuckRecoveryCycles: 0,
          },
        },
      );
      kbTrainingLog('scopes TrainJob merged', {
        botId,
        trainJobId: String((existing as { _id: Types.ObjectId })._id),
        scopes: next.join('|'),
        runAfter: runAfter.toISOString(),
        queuedItems: aggregate.queuedItems,
      });
      return;
    }
    await this.jobModel.create({
      botId: botOid,
      kind: 'scopes',
      status: 'queued',
      scopes: merged,
      queuedAt: now,
      runAfter,
      skipRunAfterItemGate: options?.immediateJob === true,
      queuedItems: aggregate.queuedItems,
      queuedCharacters: aggregate.queuedCharacters,
      estimatedTrainingSeconds: est,
    });
    kbTrainingLog('scopes TrainJob created', {
      botId,
      kind: 'scopes',
      scopes: merged.join('|'),
      runAfter: runAfter.toISOString(),
      queuedItems: aggregate.queuedItems,
    });
  }

  private async getLatestQueuedItemRunAfter(
    botOid: Types.ObjectId,
    sourceTypes: Array<'faq' | 'note' | 'table' | 'suggestion'>,
    now: Date,
  ): Promise<Date | null> {
    const rows = await this.itemModel
      .find({
        botId: botOid,
        sourceType: { $in: sourceTypes },
        status: 'queued',
        $and: [knowledgeItemExcludeDeletedOnlyClause()],
      })
      .select('runAfter')
      .lean();
    return latestQueuedKnowledgeItemRunAfter(
      rows as Array<{ runAfter?: Date | null }>,
      now,
    );
  }

  private async aggregateQueuedForSourceTypes(
    botOid: Types.ObjectId,
    sourceTypes: Array<'faq' | 'note' | 'table' | 'suggestion'>,
  ): Promise<{ queuedItems: number; queuedCharacters: number }> {
    const items = await this.itemModel
      .find({ botId: botOid, sourceType: { $in: sourceTypes }, status: 'queued', $and: [knowledgeItemExcludeDeletedOnlyClause()] })
      .lean();
    let chars = 0;
    let n = 0;
    for (const it of items) {
      const c = (it as { characterCount?: number }).characterCount;
      if (typeof c === 'number' && c >= 0) {
        chars += c;
      } else {
        const m = estimateTextMetricsFromKnowledgeItemLean(it as Parameters<typeof estimateTextMetricsFromKnowledgeItemLean>[0]);
        chars += m.characterCount;
      }
      n += 1;
    }
    return { queuedItems: n, queuedCharacters: chars };
  }

  /**
   * Mark every `queued` item in a scope as `processing` before embedding.
   */
  private async markScopeQueuedToProcessing(
    botId: string,
    scope: KnowledgeTrainingScope,
    opts?: { skipRunAfterGate?: boolean },
  ): Promise<void> {
    if (!Types.ObjectId.isValid(botId)) return;
    const st = scopeToSourceType(scope);
    const when = new Date();
    const dueFilter =
      opts?.skipRunAfterGate === true
        ? {}
        : {
            $or: [{ runAfter: { $lte: when } }, { runAfter: null }, { runAfter: { $exists: false } }],
          };
    await this.itemModel.updateMany(
      {
        botId: new Types.ObjectId(botId),
        sourceType: st,
        status: 'queued',
        ...dueFilter,
        $and: [knowledgeItemExcludeDeletedOnlyClause()],
      },
      { $set: { status: 'processing', lastTrainingStartedAt: when, updatedAt: when } },
    );
  }

  private async markProcessingItemsFailedForJob(
    job: { botId: Types.ObjectId; scopes?: KnowledgeTrainingScope[] },
    message: string,
  ): Promise<void> {
    const scopes = mergeTrainingScopes(job.scopes ?? []);
    const st = scopes.map(scopeToSourceType);
    if (st.length === 0) return;
    const when = new Date();
    const msg = message.trim() || 'training_failed';
    await this.itemModel.updateMany(
      { botId: job.botId, sourceType: { $in: st }, status: 'processing', $and: [knowledgeItemExcludeDeletedOnlyClause()] },
      { $set: { status: 'failed', trainingError: msg, updatedAt: when } },
    );
  }

  /**
   * Oldest global queued train job that is due. Document jobs are claimed before scope jobs.
   *
   * Concurrency: each claim is a `findOneAndUpdate` that only matches `status: 'queued'`, so two workers
   * cannot move the same job row to `processing`. Duplicate queued document train jobs for one KB item are
   * collapsed in {@link IngestionService.upsertQueuedDocumentTrainJob}. For `scopes`, additional queued
   * jobs for the same bot are merged into the claimed job (scopes union) and the extras are deleted.
   */
  async claimQueuedTrainJob(): Promise<(TrainJob & { _id: Types.ObjectId; botId: Types.ObjectId }) | null> {
    const now = new Date();
    const startedAt = new Date();
    const dueOr = [
      { runAfter: { $exists: false } },
      { runAfter: null },
      { runAfter: { $lte: now } },
    ];

    const sort = { runAfter: 1 as const, createdAt: 1 as const };

    let job = (await this.jobModel
      .findOneAndUpdate(
        {
          status: 'queued',
          kind: 'document',
          $or: dueOr,
        },
        { $set: { status: 'processing', startedAt, error: undefined } },
        { sort, new: true },
      )
      .exec()) as (TrainJob & { _id: Types.ObjectId; botId: Types.ObjectId }) | null;

    if (!job) {
      job = (await this.jobModel
        .findOneAndUpdate(
          {
            status: 'queued',
            $or: dueOr,
          },
          { $set: { status: 'processing', startedAt, error: undefined } },
          { sort, new: true },
        )
        .exec()) as (TrainJob & { _id: Types.ObjectId; botId: Types.ObjectId }) | null;
    }

    if (!job) return null;
    const doc = job;
    kbTrainingLog('TrainJob claimed', {
      trainJobId: String(doc._id),
      botId: String(doc.botId),
      kind: doc.kind,
      scopes: doc.kind === 'scopes' ? (doc.scopes ?? []).join('|') : undefined,
      knowledgeBaseItemId:
        doc.kind === 'document' && doc.knowledgeBaseItemId ? String(doc.knowledgeBaseItemId) : undefined,
    });
    if (doc.kind !== 'scopes') {
      return doc;
    }
    const moreQueued = await this.jobModel
      .find({ botId: doc.botId, status: 'queued', kind: 'scopes' })
      .select('_id scopes skipRunAfterItemGate')
      .lean();
    if (moreQueued.length > 0) {
      let skipGate = Boolean((doc as { skipRunAfterItemGate?: boolean }).skipRunAfterItemGate);
      const extraScopes: KnowledgeTrainingScope[] = [];
      for (const row of moreQueued) {
        extraScopes.push(...((row as { scopes?: KnowledgeTrainingScope[] }).scopes ?? []));
        if ((row as { skipRunAfterItemGate?: boolean }).skipRunAfterItemGate) skipGate = true;
      }
      const combined = mergeTrainingScopes([...(doc.scopes ?? []), ...extraScopes]);
      const ids = moreQueued.map((r) => (r as { _id: Types.ObjectId })._id);
      await this.jobModel.deleteMany({ _id: { $in: ids } });
      await this.jobModel.updateOne(
        { _id: doc._id },
        { $set: { scopes: combined, skipRunAfterItemGate: skipGate } },
      );
      doc.scopes = combined;
      (doc as { skipRunAfterItemGate?: boolean }).skipRunAfterItemGate = skipGate;
    }
    return doc;
  }

  /** @deprecated Use {@link claimQueuedTrainJob}. */
  async claimQueuedJob(): Promise<(TrainJob & { _id: Types.ObjectId; botId: Types.ObjectId }) | null> {
    return this.claimQueuedTrainJob();
  }

  async processScopesTrainJob(
    job: {
      _id: Types.ObjectId;
      botId: Types.ObjectId;
      scopes?: KnowledgeTrainingScope[];
      skipRunAfterItemGate?: boolean;
    },
  ): Promise<void> {
    const botId = String(job.botId);
    const botRow = await this.botModel.findById(job.botId).select('active deletedAt').lean();
    if (botIsEffectivelyDeleted(botRow as { active?: boolean; deletedAt?: Date | null })) {
      const finishedAt = new Date();
      await this.jobModel.updateOne(
        { _id: job._id },
        { $set: { status: 'done', finishedAt, error: 'skipped:kb_bot_deleted' } },
      );
      return;
    }
    const scopes = mergeTrainingScopes(job.scopes ?? []);
    kbTrainingLog('processScopesTrainJob start', {
      trainJobId: String(job._id),
      botId,
      scopes: scopes.join('|'),
    });
    for (const scope of scopes) {
      await this.markScopeQueuedToProcessing(botId, scope, {
        skipRunAfterGate: Boolean(job.skipRunAfterItemGate),
      });
    }
    const apiKey = await this.knowledgeBaseChunkService.getBotApiKeyOverride(botId);
    const scopeResults: Record<string, unknown> = {};
    try {
      for (const scope of scopes) {
        if (scope === 'faq') {
          scopeResults.faq = await this.knowledgeBaseChunkService.replaceFaqKnowledgeChunksForBot(botId, apiKey);
        } else if (scope === 'note') {
          scopeResults.note = await this.knowledgeBaseChunkService.replaceNoteKnowledgeChunksForBot(botId, apiKey);
        } else if (scope === 'table') {
          scopeResults.table = await this.knowledgeBaseChunkService.replaceTableKnowledgeChunksForBot(botId, apiKey);
        } else if (scope === 'suggestion') {
          scopeResults.suggestion =
            await this.knowledgeBaseChunkService.replaceSuggestionKnowledgeChunksForBot(botId, apiKey);
        }
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'knowledge_training_failed';
      kbTrainingLog('processScopesTrainJob failed', { trainJobId: String(job._id), botId, message });
      await this.markProcessingItemsFailedForJob(job, message);
      const finishedAt = new Date();
      await this.jobModel.updateOne(
        { _id: job._id },
        { $set: { status: 'failed', error: message, finishedAt } },
      );
      await this.knowledgeStatsService.recalculateKnowledgeStatsForBot(botId);
      console.error('[knowledge_training] processScopesTrainJob failed', e);
      return;
    }
    kbTrainingLog('processScopesTrainJob scopes embedded', {
      trainJobId: String(job._id),
      botId,
      scopes: scopes.join('|'),
      results: scopeResults,
    });
    /**
     * Chunk builders may move stale rows back to `queued` mid-job; ensure a follow-up scopes job exists
     * even when bot `autoTrainEnabled` is false (work is already marked queued from the stale guard).
     */
    await this.scheduleTrainingForScopes(botId, scopes, { bypassAutoTrainGate: true });
    const finishedAt = new Date();
    await this.jobModel.updateOne(
      { _id: job._id },
      { $set: { status: 'done', finishedAt, error: undefined } },
    );
    await this.knowledgeStatsService.recalculateKnowledgeStatsForBot(botId);
  }

  /** @deprecated Use {@link processScopesTrainJob}. */
  async processJob(
    job: { _id: Types.ObjectId; botId: Types.ObjectId; scopes: KnowledgeTrainingScope[] },
  ): Promise<void> {
    return this.processScopesTrainJob(job);
  }

  async markTrainJobFailed(job: { _id: Types.ObjectId }, errorMessage: string): Promise<void> {
    await this.jobModel.updateOne(
      { _id: job._id },
      { $set: { status: 'failed', error: errorMessage, finishedAt: new Date() } },
    );
  }

  /** @deprecated Use {@link markTrainJobFailed}. */
  async markJobFailed(job: { _id: Types.ObjectId; botId?: Types.ObjectId }, errorMessage: string): Promise<void> {
    return this.markTrainJobFailed(job, errorMessage);
  }

  /**
   * Manual stuck reset for one document KB item: `processing` document {@link TrainJob} older than
   * {@link KNOWLEDGE_TRAINING_STUCK_TIMEOUT_MINUTES}.
   */
  async manualResetStuckDocumentTrainForKnowledgeItem(botId: string, routeId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(botId) || !Types.ObjectId.isValid(routeId)) return false;
    const timeoutMinutes = Math.max(1, KNOWLEDGE_TRAINING_STUCK_TIMEOUT_MINUTES);
    const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000);
    const botOid = new Types.ObjectId(botId);
    const kbOid = new Types.ObjectId(routeId);
    const j = await this.jobModel
      .findOne({
        botId: botOid,
        kind: 'document',
        knowledgeBaseItemId: kbOid,
        ...mongoTrainProcessingJobStaleCriteria(cutoff),
      })
      .sort({ createdAt: -1 })
      .lean();
    if (!j) return false;

    const immediately = new Date();
    const kbItemId = (j as { knowledgeBaseItemId?: Types.ObjectId }).knowledgeBaseItemId;
    if (!kbItemId) {
      await this.jobModel.updateOne(
        { _id: j._id },
        {
          $set: {
            status: 'done',
            finishedAt: immediately,
            error: 'skipped:orphan_document_train_stuck_reset',
          },
          $unset: { startedAt: 1 },
        },
      );
      await this.knowledgeStatsService.recalculateKnowledgeStatsForBot(botId);
      return true;
    }
    const st = await this.knowledgeBaseItemAccess.getDocumentKbRouteStuckRecoverState(String(j.botId), String(kbItemId));
    if (st === 'missing' || st === 'inactive') {
      await this.jobModel.updateOne(
        { _id: j._id },
        {
          $set: {
            status: 'done',
            finishedAt: immediately,
            error: st === 'missing' ? 'skipped:document_missing_stuck_reset' : 'skipped:kb_inactive_stuck_reset',
          },
          $unset: { startedAt: 1 },
        },
      );
      await this.knowledgeStatsService.recalculateKnowledgeStatsForBot(botId);
      return true;
    }
    const tr = (j as { trainStuckRecoveryCycles?: number }).trainStuckRecoveryCycles ?? 0;
    if (tr >= KNOWLEDGE_TRAINING_MAX_STUCK_RECOVERIES) {
      await this.jobModel.updateOne(
        { _id: j._id },
        {
          $set: {
            status: 'failed',
            finishedAt: immediately,
            error: STUCK_RECOVERY_LIMIT_JOB_ERROR,
          },
          $unset: { startedAt: 1 },
        },
      );
      await this.itemModel.updateOne(
        {
          botId: j.botId,
          _id: kbItemId,
          sourceType: 'document',
          status: 'processing',
          $and: [
            knowledgeItemExcludeDeletedOnlyClause(),
            { $or: [{ extractionStatus: 'done' }, { isContentExtracted: true }] },
          ],
        },
        {
          $set: {
            status: 'failed',
            trainingError: STUCK_RECOVERY_LIMIT_JOB_ERROR,
            updatedAt: immediately,
          },
        },
      );
      await this.knowledgeStatsService.recalculateKnowledgeStatsForBot(botId);
      return true;
    }
    const nextTr = tr + 1;
    await this.jobModel.updateOne(
      { _id: j._id },
      {
        $set: {
          status: 'queued',
          error: 'reset_after_stuck',
          runAfter: immediately,
          queuedAt: immediately,
          trainStuckRecoveryCycles: nextTr,
        },
        $unset: { startedAt: 1, finishedAt: 1 },
      },
    );
    await this.itemModel.updateOne(
      {
        botId: j.botId,
        _id: kbItemId,
        sourceType: 'document',
        status: 'processing',
        $and: [
          knowledgeItemExcludeDeletedOnlyClause(),
          { $or: [{ extractionStatus: 'done' }, { isContentExtracted: true }] },
        ],
      },
      {
        $set: {
          status: 'queued',
          lastQueuedAt: immediately,
          runAfter: immediately,
          updatedAt: immediately,
        },
        $unset: { trainingError: 1 },
      },
    );
    await this.knowledgeStatsService.recalculateKnowledgeStatsForBot(botId);
    return true;
  }

  /**
   * Manual stuck reset for scope training: `processing` {@link TrainJob} of kind `scopes` that includes `scope`,
   * older than {@link KNOWLEDGE_TRAINING_STUCK_TIMEOUT_MINUTES}.
   */
  async manualResetStuckScopesTrainForBotScope(botId: string, scope: KnowledgeTrainingScope): Promise<boolean> {
    if (!Types.ObjectId.isValid(botId)) return false;
    const timeoutMinutes = Math.max(1, KNOWLEDGE_TRAINING_STUCK_TIMEOUT_MINUTES);
    const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000);
    const botOid = new Types.ObjectId(botId);
    const j = await this.jobModel
      .findOne({
        botId: botOid,
        kind: 'scopes',
        scopes: scope,
        ...mongoTrainProcessingJobStaleCriteria(cutoff),
      })
      .sort({ createdAt: -1 })
      .lean();
    if (!j) return false;

    const immediately = new Date();
    const scopes = mergeTrainingScopes((j as { scopes?: KnowledgeTrainingScope[] }).scopes ?? []);
    const sourceTypes = scopes.map(scopeToSourceType);
    const tr = (j as { trainStuckRecoveryCycles?: number }).trainStuckRecoveryCycles ?? 0;
    if (tr >= KNOWLEDGE_TRAINING_MAX_STUCK_RECOVERIES) {
      await this.jobModel.updateOne(
        { _id: (j as { _id: Types.ObjectId })._id },
        {
          $set: {
            status: 'failed',
            finishedAt: immediately,
            error: STUCK_RECOVERY_LIMIT_JOB_ERROR,
          },
          $unset: { startedAt: 1 },
        },
      );
      await this.markProcessingItemsFailedForJob({ botId: j.botId, scopes }, STUCK_RECOVERY_LIMIT_JOB_ERROR);
      await this.knowledgeStatsService.recalculateKnowledgeStatsForBot(botId);
      return true;
    }
    const nextTr = tr + 1;
    await this.jobModel.updateOne(
      { _id: (j as { _id: Types.ObjectId })._id },
      {
        $set: {
          status: 'queued',
          error: 'reset_after_stuck',
          runAfter: immediately,
          queuedAt: immediately,
          trainStuckRecoveryCycles: nextTr,
        },
        $unset: { startedAt: 1, finishedAt: 1 },
      },
    );
    if (sourceTypes.length > 0) {
      await this.itemModel.updateMany(
        {
          botId: botOid,
          sourceType: { $in: sourceTypes },
          status: 'processing',
          $and: [knowledgeItemExcludeDeletedOnlyClause()],
        },
        {
          $set: {
            status: 'queued',
            lastQueuedAt: immediately,
            runAfter: immediately,
            updatedAt: immediately,
          },
          $unset: { trainingError: 1 },
        },
      );
    }
    await this.knowledgeStatsService.recalculateKnowledgeStatsForBot(botId);
    return true;
  }

  /**
   * Re-queue training stuck in `processing` (worker crash). Does **not** insert new job rows; refreshes the
   * existing row and aligns KB training `status` (`queued` for retry). Document jobs keep `extractionStatus=done`.
   * Orphan / inactive document routes finish the train job as `done` with a `skipped:*` error.
   */
  async resetStuckJobs(): Promise<number> {
    const timeoutMinutes = Math.max(1, KNOWLEDGE_TRAINING_STUCK_TIMEOUT_MINUTES);
    const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000);
    const stuck = await this.jobModel.find({
      ...mongoTrainProcessingJobStaleCriteria(cutoff),
    });
    const immediately = new Date();
    const affectedBots = new Set<string>();

    for (const raw of stuck) {
      const j = raw as TrainJob & { _id: Types.ObjectId; botId: Types.ObjectId };
      affectedBots.add(String(j.botId));

      if (j.kind === 'document') {
        const kbItemId = j.knowledgeBaseItemId;
        if (!kbItemId) {
          await this.jobModel.updateOne(
            { _id: j._id },
            {
              $set: {
                status: 'done',
                finishedAt: immediately,
                error: 'skipped:orphan_document_train_stuck_reset',
              },
              $unset: { startedAt: 1 },
            },
          );
          continue;
        }
        const st = await this.knowledgeBaseItemAccess.getDocumentKbRouteStuckRecoverState(String(j.botId), String(kbItemId));
        if (st === 'missing' || st === 'inactive') {
          await this.jobModel.updateOne(
            { _id: j._id },
            {
              $set: {
                status: 'done',
                finishedAt: immediately,
                error: st === 'missing' ? 'skipped:document_missing_stuck_reset' : 'skipped:kb_inactive_stuck_reset',
              },
              $unset: { startedAt: 1 },
            },
          );
          continue;
        }
        const kbPlan = await this.itemModel
          .findOne({ botId: j.botId, _id: kbItemId })
          .select('trainingError')
          .lean();
        if (String((kbPlan as { trainingError?: string } | null)?.trainingError ?? '').trim() === PLAN_LIMIT_BOT_KB_TOTAL_CODE) {
          await this.jobModel.updateOne(
            { _id: j._id },
            {
              $set: {
                status: 'done',
                finishedAt: immediately,
                error: 'skipped:out_of_storage',
              },
              $unset: { startedAt: 1 },
            },
          );
          continue;
        }
        const tr = (j as { trainStuckRecoveryCycles?: number }).trainStuckRecoveryCycles ?? 0;
        if (tr >= KNOWLEDGE_TRAINING_MAX_STUCK_RECOVERIES) {
          await this.jobModel.updateOne(
            { _id: j._id },
            {
              $set: {
                status: 'failed',
                finishedAt: immediately,
                error: STUCK_RECOVERY_LIMIT_JOB_ERROR,
              },
              $unset: { startedAt: 1 },
            },
          );
          await this.itemModel.updateOne(
            {
              botId: j.botId,
              _id: kbItemId,
              sourceType: 'document',
              status: 'processing',
              $and: [
                knowledgeItemExcludeDeletedOnlyClause(),
                { $or: [{ extractionStatus: 'done' }, { isContentExtracted: true }] },
              ],
            },
            {
              $set: {
                status: 'failed',
                trainingError: STUCK_RECOVERY_LIMIT_JOB_ERROR,
                updatedAt: immediately,
              },
            },
          );
          continue;
        }
        const nextTr = tr + 1;
        await this.jobModel.updateOne(
          { _id: j._id },
          {
            $set: {
              status: 'queued',
              error: 'reset_after_stuck',
              runAfter: immediately,
              queuedAt: immediately,
              trainStuckRecoveryCycles: nextTr,
            },
            $unset: { startedAt: 1, finishedAt: 1 },
          },
        );
        await this.itemModel.updateOne(
          {
            botId: j.botId,
            _id: kbItemId,
            sourceType: 'document',
            status: 'processing',
            $and: [
              knowledgeItemExcludeDeletedOnlyClause(),
              { $or: [{ extractionStatus: 'done' }, { isContentExtracted: true }] },
            ],
          },
          {
            $set: {
              status: 'queued',
              lastQueuedAt: immediately,
              runAfter: immediately,
              updatedAt: immediately,
            },
          },
        );
        continue;
      }

      if (j.kind === 'scopes') {
        const scopes = mergeTrainingScopes(j.scopes ?? []);
        const sourceTypes = scopes.map(scopeToSourceType);
        const trs = (j as { trainStuckRecoveryCycles?: number }).trainStuckRecoveryCycles ?? 0;
        if (trs >= KNOWLEDGE_TRAINING_MAX_STUCK_RECOVERIES) {
          await this.jobModel.updateOne(
            { _id: j._id },
            {
              $set: {
                status: 'failed',
                finishedAt: immediately,
                error: STUCK_RECOVERY_LIMIT_JOB_ERROR,
              },
              $unset: { startedAt: 1 },
            },
          );
          await this.markProcessingItemsFailedForJob({ botId: j.botId, scopes }, STUCK_RECOVERY_LIMIT_JOB_ERROR);
          continue;
        }
        const nextTrs = trs + 1;
        await this.jobModel.updateOne(
          { _id: j._id },
          {
            $set: {
              status: 'queued',
              error: 'reset_after_stuck',
              runAfter: immediately,
              queuedAt: immediately,
              trainStuckRecoveryCycles: nextTrs,
            },
            $unset: { startedAt: 1, finishedAt: 1 },
          },
        );
        if (sourceTypes.length > 0) {
          await this.itemModel.updateMany(
            {
              botId: j.botId,
              sourceType: { $in: sourceTypes },
              status: 'processing',
              trainingError: { $ne: PLAN_LIMIT_BOT_KB_TOTAL_CODE },
              $and: [knowledgeItemExcludeDeletedOnlyClause()],
            },
            {
              $set: {
                status: 'queued',
                lastQueuedAt: immediately,
                runAfter: immediately,
                updatedAt: immediately,
              },
            },
          );
        }
        continue;
      }

      await this.jobModel.updateOne(
        { _id: j._id },
        {
          $set: {
            status: 'done',
            finishedAt: immediately,
            error: 'skipped:unknown_train_job_kind_stuck_reset',
          },
          $unset: { startedAt: 1 },
        },
      );
    }

    if (stuck.length > 0) {
      console.log(`[knowledge_training] reset ${stuck.length} stuck train job(s) (processing > ${timeoutMinutes} min)`);
      for (const botId of affectedBots) {
        await this.knowledgeStatsService.recalculateKnowledgeStatsForBot(botId);
      }
    }
    return stuck.length;
  }
}
