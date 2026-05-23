import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ONBOARDING_KB_TRANSFER_MAX_AUTO_RETRIES,
  ONBOARDING_KB_TRANSFER_MAX_STUCK_RECOVERIES,
  ONBOARDING_KB_TRANSFER_RETRY_BACKOFF_BASE_MS,
  ONBOARDING_KB_TRANSFER_STUCK_TIMEOUT_MINUTES,
  STUCK_RECOVERY_LIMIT_JOB_ERROR,
} from '../lib/global.constants';
import {
  ONBOARDING_KB_TRANSFER_JOB_TYPE,
  OnboardingKbTransferJob,
} from '../models/onboarding-kb-transfer-job.schema';
import { WorkspaceOnboardingService } from '../workspaces/workspace-onboarding.service';
import { WorkspaceOnboardingKnowledgeTransferService } from './workspace-onboarding-knowledge-transfer.service';

export type OnboardingKbTransferJobDoc = OnboardingKbTransferJob & {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  botId: Types.ObjectId;
  onboardingDraftId: Types.ObjectId;
};

function onboardingKbTransferStuckCutoff(): Date {
  return new Date(Date.now() - ONBOARDING_KB_TRANSFER_STUCK_TIMEOUT_MINUTES * 60_000);
}

@Injectable()
export class WorkspaceOnboardingKbTransferJobService {
  private readonly log = new Logger(WorkspaceOnboardingKbTransferJobService.name);

  constructor(
    @InjectModel(OnboardingKbTransferJob.name)
    private readonly jobModel: Model<OnboardingKbTransferJob>,
    private readonly workspaceOnboardingService: WorkspaceOnboardingService,
    private readonly workspaceOnboardingKnowledgeTransferService: WorkspaceOnboardingKnowledgeTransferService,
  ) {}

  /**
   * Idempotent: at most one live (queued/processing) job per workspace.
   * Requeues failed/done jobs when go-live is retried while knowledge is still pending.
   */
  async ensureQueuedTransferJob(params: {
    workspaceId: string;
    botId: string;
    onboardingDraftId: string;
  }): Promise<{ jobId: string; created: boolean }> {
    const { workspaceId, botId, onboardingDraftId } = params;
    if (
      !Types.ObjectId.isValid(workspaceId) ||
      !Types.ObjectId.isValid(botId) ||
      !Types.ObjectId.isValid(onboardingDraftId)
    ) {
      throw new Error('invalid_onboarding_kb_transfer_job_ids');
    }

    const wsOid = new Types.ObjectId(workspaceId);
    const botOid = new Types.ObjectId(botId);
    const draftOid = new Types.ObjectId(onboardingDraftId);
    const now = new Date();

    const active = await this.jobModel
      .findOne({ workspaceId: wsOid, status: { $in: ['queued', 'processing'] } })
      .select('_id')
      .lean();
    if (active) {
      return { jobId: String((active as { _id: Types.ObjectId })._id), created: false };
    }

    const requeuedFailed = await this.jobModel
      .findOneAndUpdate(
        { workspaceId: wsOid, botId: botOid, status: 'failed' },
        {
          $set: {
            status: 'queued',
            onboardingDraftId: draftOid,
            error: undefined,
            queuedAt: now,
            startedAt: undefined,
            finishedAt: undefined,
          },
        },
        { sort: { createdAt: -1 }, new: true },
      )
      .lean();
    if (requeuedFailed) {
      return { jobId: String((requeuedFailed as { _id: Types.ObjectId })._id), created: false };
    }

    const requeuedDone = await this.jobModel
      .findOneAndUpdate(
        { workspaceId: wsOid, botId: botOid, status: 'done' },
        {
          $set: {
            status: 'queued',
            onboardingDraftId: draftOid,
            error: undefined,
            queuedAt: now,
            startedAt: undefined,
            finishedAt: undefined,
          },
        },
        { sort: { createdAt: -1 }, new: true },
      )
      .lean();
    if (requeuedDone) {
      return { jobId: String((requeuedDone as { _id: Types.ObjectId })._id), created: false };
    }

    try {
      const created = await this.jobModel.create({
        type: ONBOARDING_KB_TRANSFER_JOB_TYPE,
        workspaceId: wsOid,
        botId: botOid,
        onboardingDraftId: draftOid,
        status: 'queued',
        queuedAt: now,
        retryCount: 0,
        stuckRecoveryCycles: 0,
      });
      return { jobId: String(created._id), created: true };
    } catch (err) {
      if ((err as { code?: number }).code === 11000) {
        const raced = await this.jobModel
          .findOne({ workspaceId: wsOid, status: { $in: ['queued', 'processing'] } })
          .select('_id')
          .lean();
        if (raced) {
          return { jobId: String((raced as { _id: Types.ObjectId })._id), created: false };
        }
      }
      throw err;
    }
  }

  async claimQueuedTransferJob(): Promise<OnboardingKbTransferJobDoc | null> {
    const startedAt = new Date();
    const job = await this.jobModel.findOneAndUpdate(
      { status: 'queued' },
      {
        $set: {
          status: 'processing',
          startedAt,
          error: undefined,
        },
      },
      { sort: { queuedAt: 1, createdAt: 1 }, new: true },
    );
    return (job as OnboardingKbTransferJobDoc | null) ?? null;
  }

  async resetStuckTransferJobs(): Promise<number> {
    const cutoff = onboardingKbTransferStuckCutoff();
    const stuck = await this.jobModel
      .find({
        status: 'processing',
        startedAt: { $lt: cutoff },
      })
      .select('_id stuckRecoveryCycles')
      .lean();
    let n = 0;
    const now = new Date();
    for (const raw of stuck) {
      const row = raw as { _id: Types.ObjectId; stuckRecoveryCycles?: number };
      const cycles = (row.stuckRecoveryCycles ?? 0) + 1;
      if (cycles >= ONBOARDING_KB_TRANSFER_MAX_STUCK_RECOVERIES) {
        await this.jobModel.updateOne(
          { _id: row._id },
          {
            $set: {
              status: 'failed',
              error: STUCK_RECOVERY_LIMIT_JOB_ERROR,
              finishedAt: now,
              stuckRecoveryCycles: cycles,
            },
          },
        );
      } else {
        await this.jobModel.updateOne(
          { _id: row._id },
          {
            $set: {
              status: 'queued',
              queuedAt: now,
              error: undefined,
              startedAt: undefined,
              stuckRecoveryCycles: cycles,
            },
          },
        );
      }
      n += 1;
    }
    return n;
  }

  async requeueEligibleFailedTransferJobs(batchLimit = 25): Promise<number> {
    const limit = Math.max(1, Math.floor(batchLimit));
    const rows = await this.jobModel
      .find({
        status: 'failed',
        retryCount: { $lt: ONBOARDING_KB_TRANSFER_MAX_AUTO_RETRIES },
        error: { $ne: STUCK_RECOVERY_LIMIT_JOB_ERROR },
      })
      .sort({ finishedAt: 1, updatedAt: 1 })
      .limit(limit)
      .select('_id retryCount finishedAt updatedAt')
      .lean();

    let n = 0;
    const now = new Date();
    for (const raw of rows) {
      const row = raw as { _id: Types.ObjectId; retryCount?: number; finishedAt?: Date; updatedAt?: Date };
      const retryCount = row.retryCount ?? 0;
      const base = row.finishedAt ?? row.updatedAt ?? now;
      const backoffMs = ONBOARDING_KB_TRANSFER_RETRY_BACKOFF_BASE_MS * Math.max(1, retryCount + 1);
      if (base.getTime() + backoffMs > now.getTime()) continue;

      const updated = await this.jobModel.findOneAndUpdate(
        { _id: row._id, status: 'failed', retryCount: { $lt: ONBOARDING_KB_TRANSFER_MAX_AUTO_RETRIES } },
        {
          $set: {
            status: 'queued',
            queuedAt: now,
            error: undefined,
            startedAt: undefined,
            finishedAt: undefined,
          },
        },
        { new: true },
      );
      if (updated) n += 1;
    }
    return n;
  }

  async processTransferJob(job: OnboardingKbTransferJobDoc): Promise<void> {
    const workspaceId = String(job.workspaceId);
    const botId = String(job.botId);
    const draftId = String(job.onboardingDraftId);
    const onboarding = await this.workspaceOnboardingService.getOnboardingForWorkspace(workspaceId);
    await this.workspaceOnboardingKnowledgeTransferService.transferDraftKnowledgeForBot(
      botId,
      onboarding.draft,
      draftId,
    );
    await this.markJobDone(job);
    this.log.log(
      `Onboarding KB transfer job completed jobId=${String(job._id)} workspaceId=${workspaceId} botId=${botId}`,
    );
  }

  async markJobDone(job: Pick<OnboardingKbTransferJobDoc, '_id'>): Promise<void> {
    const now = new Date();
    await this.jobModel.updateOne(
      { _id: job._id },
      {
        $set: {
          status: 'done',
          finishedAt: now,
          error: undefined,
        },
      },
    );
  }

  async markJobFailed(job: Pick<OnboardingKbTransferJobDoc, '_id'>, message: string): Promise<void> {
    const now = new Date();
    const err = message.slice(0, 500);
    await this.jobModel.updateOne(
      { _id: job._id },
      {
        $set: {
          status: 'failed',
          error: err,
          finishedAt: now,
        },
        $inc: { retryCount: 1 },
      },
    );
    this.log.warn(`Onboarding KB transfer job failed jobId=${String(job._id)}: ${err}`);
  }
}
